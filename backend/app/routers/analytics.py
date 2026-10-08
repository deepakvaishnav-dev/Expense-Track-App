from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc, case, text
from app.db.session import get_db
from app.models.models import User, Transaction, Budget, Category
from app.schemas.schemas import AnalyticsSummaryResponse, TransactionResponse
from app.routers.deps import get_current_active_user
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Dict, Any
from app.services.ai_service import ai_service, insights_cache

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns dashboard statistics: today's spending, weekly spending, monthly spending,
    remaining budget, category breakdowns, line chart data, recent transactions, and AI insights.
    All spending metrics are aggregated in a single unified SQL query.
    AI insights are non-blocking via TTL cache & background processing.
    """
    now = datetime.now(timezone.utc)
    now_naive = now.replace(tzinfo=None)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    week_start = today_start - timedelta(days=7)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    # 1. Calculate spending metrics in a single unified SQL query
    min_date = min(week_start, month_start)
    spending_query = select(
        func.coalesce(
            func.sum(case((Transaction.date >= today_start, Transaction.amount), else_=0.0)),
            0.0
        ).label("today"),
        func.coalesce(
            func.sum(case((Transaction.date >= week_start, Transaction.amount), else_=0.0)),
            0.0
        ).label("weekly"),
        func.coalesce(
            func.sum(case((Transaction.date >= month_start, Transaction.amount), else_=0.0)),
            0.0
        ).label("monthly")
    ).where(
        and_(
            Transaction.user_id == current_user.id,
            Transaction.type == "Expense",
            Transaction.date >= min_date
        )
    )
    spending_res = await db.execute(spending_query)
    spending_row = spending_res.one()
    today_spending = float(spending_row.today or 0.0)
    weekly_spending = float(spending_row.weekly or 0.0)
    monthly_spending = float(spending_row.monthly or 0.0)

    # 2. Budget Metrics
    budget_result = await db.execute(
        select(Budget).where(
            and_(
                Budget.user_id == current_user.id,
                Budget.start_date <= now_naive,
                Budget.end_date >= now_naive
            )
        )
    )
    active_budgets = budget_result.scalars().all()

    total_budget_amount = sum(float(b.amount) for b in active_budgets)
    remaining_budget = max(0.0, total_budget_amount - monthly_spending) if total_budget_amount > 0 else 5000.0 - monthly_spending

    # 3. Category Breakdown (Sum of expense per category)
    # Using LEFT OUTER JOIN to prevent dropping uncategorized transactions (category_id IS NULL)
    cat_query = (
        select(
            func.coalesce(Category.name, "Uncategorized").label("name"),
            func.coalesce(Category.color, "#9E9E9E").label("color"),
            func.sum(Transaction.amount).label("amount")
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            and_(
                Transaction.user_id == current_user.id,
                Transaction.type == "Expense",
                Transaction.date >= month_start
            )
        )
        .group_by(
            Category.name,
            Category.color
        )
        .order_by(desc(func.sum(Transaction.amount)))
    )
    cat_res = await db.execute(cat_query)
    category_breakdown: List[Dict[str, Any]] = []
    top_categories: List[Dict[str, Any]] = []

    for row in cat_res:
        name, color, amt = row
        amt_float = float(amt or 0.0)
        breakdown_item = {"name": name, "color": color, "amount": amt_float}
        category_breakdown.append(breakdown_item)
        if len(top_categories) < 3:
            top_categories.append(breakdown_item)

    # 4. Spending Trends (Daily expenses for the last 7 days)
    date_expr = func.date_trunc(text("'day'"), Transaction.date)
    trends_query = (
        select(date_expr, func.sum(Transaction.amount))
        .where(
            and_(
                Transaction.user_id == current_user.id,
                Transaction.type == "Expense",
                Transaction.date >= (today_start - timedelta(days=6))
            )
        )
        .group_by(date_expr)
        .order_by(date_expr)
    )
    trends_res = await db.execute(trends_query)

    # Pre-populate list to ensure all last 7 days have values
    trend_dict = {(today_start - timedelta(days=i)).strftime("%Y-%m-%d"): 0.0 for i in range(7)}
    for row in trends_res:
        dt, amt = row
        if dt:
            dt_str = dt.strftime("%Y-%m-%d")
            trend_dict[dt_str] = float(amt or 0.0)

    spending_trends = [{"date": k, "amount": v} for k, v in sorted(trend_dict.items())]

    # 5. Recent Transactions
    txn_res = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(desc(Transaction.date))
        .limit(5)
    )
    recent_transactions = txn_res.scalars().all()

    # 6. Decoupled AI Insights (Sub-millisecond retrieval via TTL cache or instant heuristics)
    cached_insights = insights_cache.get(str(current_user.id))
    if cached_insights:
        ai_insights = cached_insights
    else:
        # Instant heuristic summary (<1ms) returned immediately to avoid dashboard latency
        ai_insights = ai_service.generate_heuristic_insights(
            current_user.full_name,
            monthly_spending,
            category_breakdown
        )
        # Offload fresh LLM generation to background task
        background_tasks.add_task(
            ai_service.get_or_generate_insights,
            str(current_user.id),
            current_user.full_name,
            monthly_spending,
            category_breakdown,
            True
        )

    return AnalyticsSummaryResponse(
        today_spending=today_spending,
        weekly_spending=weekly_spending,
        monthly_spending=monthly_spending,
        remaining_budget=remaining_budget,
        category_breakdown=category_breakdown,
        spending_trends=spending_trends,
        recent_transactions=recent_transactions,
        top_categories=top_categories,
        ai_insights=ai_insights
    )


@router.get("/ai-insights", response_model=List[str])
async def get_ai_insights(
    force_refresh: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated non-blocking endpoint to retrieve or manually refresh AI insights.
    """
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    # Compute monthly spend
    monthly_result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            and_(
                Transaction.user_id == current_user.id,
                Transaction.type == "Expense",
                Transaction.date >= month_start
            )
        )
    )
    monthly_spending = float(monthly_result.scalar() or 0.0)

    # Compute category breakdown
    cat_res = await db.execute(
        select(
            func.coalesce(Category.name, "Uncategorized"),
            func.sum(Transaction.amount)
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            and_(
                Transaction.user_id == current_user.id,
                Transaction.type == "Expense",
                Transaction.date >= month_start
            )
        )
        .group_by(Category.name)
        .order_by(desc(func.sum(Transaction.amount)))
    )
    category_breakdown = [{"name": r[0], "amount": float(r[1] or 0.0)} for r in cat_res]

    return await ai_service.get_or_generate_insights(
        str(current_user.id),
        current_user.full_name,
        monthly_spending,
        category_breakdown,
        force_refresh=force_refresh
    )
