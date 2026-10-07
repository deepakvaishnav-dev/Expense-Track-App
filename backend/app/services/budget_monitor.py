from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.models.models import Budget, Notification, Transaction
from decimal import Decimal
from datetime import datetime, timezone

class BudgetMonitor:
    @staticmethod
    async def evaluate_transaction_for_alerts(session: AsyncSession, user_id: str, category_id: str = None):
        """
        Re-evaluates the user's spending against their budget for a specific category
        (or overall budget if category_id is None) and triggers notifications if thresholds are breached.
        """
        # 1. Fetch active budgets for this category
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        budget_query = select(Budget).where(
            and_(
                Budget.user_id == user_id,
                Budget.category_id == category_id,
                Budget.start_date <= now,
                Budget.end_date >= now
            )
        )
        result = await session.execute(budget_query)
        active_budgets = result.scalars().all()

        for budget in active_budgets:
            # 2. Calculate current spending for this budget period
            spending_query = select(func.sum(Transaction.amount)).where(
                and_(
                    Transaction.user_id == user_id,
                    Transaction.type == "Expense",
                    Transaction.category_id == budget.category_id if budget.category_id else True,
                    Transaction.date >= budget.start_date,
                    Transaction.date <= budget.end_date
                )
            )
            spending_result = await session.execute(spending_query)
            current_spending = spending_result.scalar() or Decimal('0.00')

            budget_amount = Decimal(str(budget.amount))
            if budget_amount <= 0:
                continue

            pct = (current_spending / budget_amount) * 100

            # Determine category name for the notification
            cat_name = "Overall"
            if budget.category_id:
                # We can fetch the category name or use a default
                from app.models.models import Category
                cat_result = await session.execute(select(Category.name).where(Category.id == budget.category_id))
                cat_name = cat_result.scalar() or "Category"

            # Check thresholds in descending order
            triggered_threshold = None
            if pct >= 100 and not budget.alert_100_triggered:
                budget.alert_100_triggered = True
                triggered_threshold = "100%"
            elif pct >= 90 and not budget.alert_90_triggered:
                budget.alert_90_triggered = True
                triggered_threshold = "90%"
            elif pct >= 75 and not budget.alert_75_triggered:
                budget.alert_75_triggered = True
                triggered_threshold = "75%"
            elif pct >= 50 and not budget.alert_50_triggered:
                budget.alert_50_triggered = True
                triggered_threshold = "50%"

            if triggered_threshold:
                # Add to DB session
                session.add(budget)
                
                # Create a notification record
                alert_notification = Notification(
                    user_id=budget.user_id,
                    title=f"Budget Warning: {cat_name} {triggered_threshold}",
                    message=f"You have spent INR {current_spending:,.2f} of your INR {budget_amount:,.2f} budget ({pct:.1f}%) for {cat_name}.",
                    type="BudgetAlert",
                    is_read=False
                )
                session.add(alert_notification)
                
        await session.commit()

budget_monitor = BudgetMonitor()
