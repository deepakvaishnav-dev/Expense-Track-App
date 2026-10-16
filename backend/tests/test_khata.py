import pytest
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import importlib

from app.models.models import KhataPerson, KhataTransaction
from app.routers.khata import _build_person_response, router
from app.main import app

migration_003 = importlib.import_module("app.db.migrations.versions.003_khata_ledger_tables")


def test_khata_person_indexes_defined():
    """Verify KhataPerson table has proper indexing for fast lookups."""
    index_names = {idx.name for idx in KhataPerson.__table__.indexes}
    assert "ix_khata_persons_user_id" in index_names
    assert "ix_khata_persons_user_name" in index_names
    assert "ix_khata_persons_user_created" in index_names


def test_khata_transaction_indexes_defined():
    """Verify KhataTransaction table has composite and sorting indexes for sub-second queries."""
    index_names = {idx.name for idx in KhataTransaction.__table__.indexes}
    assert "ix_khata_txns_user_id_date" in index_names
    assert "ix_khata_txns_person_id_date" in index_names
    assert "ix_khata_txns_user_person" in index_names
    assert "ix_khata_txns_person_type" in index_names
    assert "ix_khata_txns_user_type_amt" in index_names
    assert "ix_khata_txns_person_type_amt" in index_names


def test_migration_003_metadata():
    """Verify Alembic migration 003 chains from 002."""
    assert migration_003.revision == "003_khata_ledger_tables"
    assert migration_003.down_revision == "002_performance_indexes"
    assert callable(migration_003.upgrade)
    assert callable(migration_003.downgrade)


def test_build_person_response_calculations():
    """Test ledger calculation logic for lent, borrowed, and net balance."""
    user_id = uuid.uuid4()
    person_id = uuid.uuid4()
    person = KhataPerson(
        id=person_id,
        user_id=user_id,
        name="Rahul Sharma",
        phone="+919876543210",
        color="#3B82F6",
        created_at=datetime.now(timezone.utc),
    )

    t1 = KhataTransaction(
        id=uuid.uuid4(),
        user_id=user_id,
        person_id=person_id,
        type="GAVE",
        amount=Decimal("1500.00"),
        date=datetime.now(timezone.utc),
        note="Dinner share",
    )
    t2 = KhataTransaction(
        id=uuid.uuid4(),
        user_id=user_id,
        person_id=person_id,
        type="GOT",
        amount=Decimal("500.00"),
        date=datetime.now(timezone.utc),
        note="Coffee refund",
    )
    person.transactions = [t1, t2]

    resp = _build_person_response(person)
    assert resp.name == "Rahul Sharma"
    assert resp.total_gave == 1500.00
    assert resp.total_got == 500.00
    assert resp.net_balance == 1000.00
    assert resp.txn_count == 2
    assert resp.last_note == "Dinner share"


def test_khata_routes_registered_in_fastapi():
    """Verify all Khata endpoints are properly mounted on FastAPI app."""
    paths = [route.path for route in app.routes]
    assert "/api/khata/summary" in paths
    assert "/api/khata/persons" in paths
    assert "/api/khata/persons/{person_id}" in paths
    assert "/api/khata/persons/{person_id}/transactions" in paths
    assert "/api/khata/transactions" in paths
    assert "/api/khata/transactions/{txn_id}" in paths
    assert "/api/khata/persons/{person_id}/settle" in paths
    assert "/api/khata/sync" in paths
