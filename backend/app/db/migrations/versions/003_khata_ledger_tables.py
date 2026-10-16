"""Add Khata ledger tables and performance indexes

Revision ID: 003_khata_ledger_tables
Revises: 002_performance_indexes
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '003_khata_ledger_tables'
down_revision = '002_performance_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create khata_persons table if not exists
    op.create_table(
        'khata_persons',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('color', sa.String(20), server_default='#3B82F6', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_khata_persons_user_id', 'khata_persons', ['user_id'], unique=False)
    op.create_index('ix_khata_persons_user_name', 'khata_persons', ['user_id', 'name'], unique=False)
    op.create_index('ix_khata_persons_user_created', 'khata_persons', ['user_id', sa.text('created_at DESC')], unique=False)

    # 2. Create khata_transactions table if not exists
    op.create_table(
        'khata_transactions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('person_id', UUID(as_uuid=True), sa.ForeignKey('khata_persons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('settlement_type', sa.String(20), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_khata_txns_user_id_date', 'khata_transactions', ['user_id', sa.text('date DESC')], unique=False)
    op.create_index('ix_khata_txns_person_id_date', 'khata_transactions', ['person_id', sa.text('date DESC')], unique=False)
    op.create_index('ix_khata_txns_user_person', 'khata_transactions', ['user_id', 'person_id'], unique=False)
    op.create_index('ix_khata_txns_person_type', 'khata_transactions', ['person_id', 'type'], unique=False)
    op.create_index('ix_khata_txns_user_type_amt', 'khata_transactions', ['user_id', 'type', 'amount'], unique=False)
    op.create_index('ix_khata_txns_person_type_amt', 'khata_transactions', ['person_id', 'type', 'amount'], unique=False)


def downgrade() -> None:
    op.drop_table('khata_transactions')
    op.drop_table('khata_persons')
