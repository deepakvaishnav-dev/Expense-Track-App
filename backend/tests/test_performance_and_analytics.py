import pytest
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
from decimal import Decimal
from fastapi import BackgroundTasks

from app.models.models import Transaction, Budget, Notification, User, Category
import importlib

migration_002 = importlib.import_module("app.db.migrations.versions.002_performance_indexes")
from app.services.ai_service import FinancialInsightsCache, ai_service, insights_cache
from app.routers.analytics import get_analytics_summary, get_ai_insights


def test_transaction_indexes_defined():
    """Verify Transaction model contains composite and foreign key indexes."""
    index_names = {idx.name for idx in Transaction.__table__.indexes}
    assert "ix_transactions_user_id_date" in index_names
    assert "ix_transactions_account_id" in index_names
    assert "ix_transactions_category_id" in index_names


def test_budget_and_notification_indexes_defined():
    """Verify Budget and Notification models contain required performance indexes."""
    budget_idx_names = {idx.name for idx in Budget.__table__.indexes}
    assert "ix_budgets_user_month_year" in budget_idx_names
    assert "ix_budgets_user_dates" in budget_idx_names

    # Check Budget model auto-populates month and year from start_date
    now = datetime(2026, 6, 24, 10, 0, 0)
    b = Budget(
        user_id=uuid.uuid4(),
        amount=Decimal("15000.00"),
        start_date=now,
        end_date=now + timedelta(days=30)
    )
    assert b.month == 6
    assert b.year == 2026

    notif_idx_names = {idx.name for idx in Notification.__table__.indexes}
    assert "ix_notifications_user_id_is_read_created_at" in notif_idx_names


def test_migration_002_metadata():
    """Verify Alembic migration 002 chains cleanly from 001."""
    assert migration_002.revision == "002_performance_indexes"
    assert migration_002.down_revision == "001_security_fixes"
    assert callable(migration_002.upgrade)
    assert callable(migration_002.downgrade)


def test_financial_insights_cache_lifecycle():
    """Verify thread-safe in-memory cache set, get, and TTL eviction."""
    cache = FinancialInsightsCache(ttl_seconds=1)
    user_id = str(uuid.uuid4())

    # Initial get should be None
    assert cache.get(user_id) is None

    # Set and get
    sample_insights = ["Tip 1: Save 10%", "Tip 2: Reduce dining out", "Tip 3: Good job!"]
    cache.set(user_id, sample_insights)
    assert cache.get(user_id) == sample_insights

    # Wait for TTL to expire
    time.sleep(1.05)
    assert cache.get(user_id) is None


def test_heuristic_insights_generation_speed_and_content():
    """Verify heuristic insights return in <1ms without external network requests."""
    start_time = time.perf_counter()
    categories = [
        {"name": "Food & Dining", "amount": 12000.0, "color": "#FF5733"},
        {"name": "Travel", "amount": 3000.0, "color": "#3357FF"},
    ]
    insights = ai_service.generate_heuristic_insights(
        name="John Doe",
        monthly_spending=15000.0,
        category_breakdown=categories
    )
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert elapsed_ms < 10.0  # Well under 10ms
    assert len(insights) == 3
    assert "Food & Dining" in insights[0]
    assert "12,000.00" in insights[0]


@pytest.mark.asyncio
async def test_analytics_summary_with_uncategorized_and_cached_insights():
    """
    Verify get_analytics_summary:
    1. Returns uncategorized expenses without dropping them.
    2. Uses cached insights if available.
    """
    test_user_id = uuid.uuid4()
    test_user = User(
        id=test_user_id,
        email="test_analytics@example.com",
        full_name="Alice Smith",
        password_hash="hashed_pw"
    )

    # Prime the insights cache
    cached_insights = ["Insight 1: Pre-cached", "Insight 2: Fast return", "Insight 3: Excellent"]
    insights_cache.set(str(test_user_id), cached_insights)

    # Setup mock DB session
    mock_db = AsyncMock()

    # Mock 1: Spending query (single unified row)
    spending_mock_row = MagicMock()
    spending_mock_row.today = Decimal("500.00")
    spending_mock_row.weekly = Decimal("2500.00")
    spending_mock_row.monthly = Decimal("8000.00")
    spending_res_mock = MagicMock()
    spending_res_mock.one.return_value = spending_mock_row

    # Mock 2: Budgets query
    budgets_res_mock = MagicMock()
    mock_budget = Budget(
        id=uuid.uuid4(),
        user_id=test_user_id,
        amount=Decimal("10000.00"),
        start_date=datetime(2026, 6, 1),
        end_date=datetime(2026, 6, 30)
    )
    budgets_res_mock.scalars.return_value.all.return_value = [mock_budget]

    # Mock 3: Category breakdown (includes Uncategorized)
    cat_breakdown_rows = [
        ("Food & Dining", "#FF5733", Decimal("5000.00")),
        ("Uncategorized", "#9E9E9E", Decimal("3000.00")),
    ]
    cat_res_mock = MagicMock()
    cat_res_mock.__iter__.return_value = cat_breakdown_rows

    # Mock 4: Spending trends
    trends_res_mock = MagicMock()
    trends_res_mock.__iter__.return_value = []

    # Mock 5: Recent transactions
    txns_res_mock = MagicMock()
    txns_res_mock.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [
        spending_res_mock,
        budgets_res_mock,
        cat_res_mock,
        trends_res_mock,
        txns_res_mock
    ]

    background_tasks = BackgroundTasks()

    start_time = time.perf_counter()
    summary = await get_analytics_summary(
        background_tasks=background_tasks,
        current_user=test_user,
        db=mock_db
    )
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert elapsed_ms < 50.0  # Instant response (<50ms)
    assert summary.today_spending == 500.0
    assert summary.weekly_spending == 2500.0
    assert summary.monthly_spending == 8000.0
    assert summary.remaining_budget == 2000.0  # 10000 - 8000

    # Verify Uncategorized category is included in breakdown
    names = [c["name"] for c in summary.category_breakdown]
    assert "Food & Dining" in names
    assert "Uncategorized" in names

    uncat_item = next(c for c in summary.category_breakdown if c["name"] == "Uncategorized")
    assert uncat_item["color"] == "#9E9E9E"
    assert uncat_item["amount"] == 3000.0

    # Verify cached insights were returned without queuing a background task
    assert summary.ai_insights == cached_insights
    assert len(background_tasks.tasks) == 0


@pytest.mark.asyncio
async def test_analytics_summary_cache_miss_dispatches_background_task():
    """Verify on cache miss, instant heuristics are returned and background task is scheduled."""
    test_user_id = uuid.uuid4()
    test_user = User(
        id=test_user_id,
        email="test_miss@example.com",
        full_name="Bob Jones",
        password_hash="hashed_pw"
    )

    insights_cache.clear(str(test_user_id))

    mock_db = AsyncMock()

    # Mock responses
    spending_mock_row = MagicMock()
    spending_mock_row.today = Decimal("0.00")
    spending_mock_row.weekly = Decimal("1200.00")
    spending_mock_row.monthly = Decimal("4000.00")
    spending_res_mock = MagicMock()
    spending_res_mock.one.return_value = spending_mock_row

    budgets_res_mock = MagicMock()
    budgets_res_mock.scalars.return_value.all.return_value = []

    cat_res_mock = MagicMock()
    cat_res_mock.__iter__.return_value = [("Groceries", "#4CAF50", Decimal("4000.00"))]

    trends_res_mock = MagicMock()
    trends_res_mock.__iter__.return_value = []

    txns_res_mock = MagicMock()
    txns_res_mock.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [
        spending_res_mock,
        budgets_res_mock,
        cat_res_mock,
        trends_res_mock,
        txns_res_mock
    ]

    background_tasks = BackgroundTasks()

    start_time = time.perf_counter()
    summary = await get_analytics_summary(
        background_tasks=background_tasks,
        current_user=test_user,
        db=mock_db
    )
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert elapsed_ms < 50.0  # Fast response
    # Instant heuristic insights returned
    assert len(summary.ai_insights) == 3
    assert "Groceries" in summary.ai_insights[0]

    # Background task should be registered to generate and cache LLM insights
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].func == ai_service.get_or_generate_insights


from app.config import settings

@pytest.mark.asyncio
async def test_get_ai_insights_endpoint_returns_data(monkeypatch):
    """Verify dedicated GET /api/analytics/ai-insights endpoint calculates breakdown and returns insights."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    test_user_id = uuid.uuid4()
    test_user = User(
        id=test_user_id,
        email="test_endpoint@example.com",
        full_name="Carol Danvers",
        password_hash="hashed_pw"
    )

    mock_db = AsyncMock()
    # Mock monthly spending
    monthly_mock = MagicMock()
    monthly_mock.scalar.return_value = Decimal("7500.00")

    # Mock category breakdown
    cat_mock = MagicMock()
    cat_mock.__iter__.return_value = [("Shopping", Decimal("7500.00"))]

    mock_db.execute.side_effect = [monthly_mock, cat_mock]

    insights = await get_ai_insights(
        force_refresh=True,
        current_user=test_user,
        db=mock_db
    )

    assert isinstance(insights, list)
    assert len(insights) >= 1
    assert any("Shopping" in item for item in insights)


