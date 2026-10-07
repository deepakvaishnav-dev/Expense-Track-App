"""Add performance composite and foreign key indexes

Revision ID: 002_performance_indexes
Revises: 001_security_fixes
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_performance_indexes'
down_revision = '001_security_fixes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Update budgets table schema with month/year columns if not present
    op.add_column('budgets', sa.Column('month', sa.Integer(), nullable=True))
    op.add_column('budgets', sa.Column('year', sa.Integer(), nullable=True))

    # 2. Indexes on transactions table
    # Composite index for chronological ledger pagination by user
    op.create_index(
        'ix_transactions_user_id_date',
        'transactions',
        ['user_id', sa.text('date DESC')],
        unique=False
    )
    # Foreign key indexes for join optimization
    op.create_index(
        'ix_transactions_account_id',
        'transactions',
        ['account_id'],
        unique=False
    )
    op.create_index(
        'ix_transactions_category_id',
        'transactions',
        ['category_id'],
        unique=False
    )

    # 3. Indexes on budgets table
    op.create_index(
        'ix_budgets_user_month_year',
        'budgets',
        ['user_id', 'month', 'year'],
        unique=False
    )
    op.create_index(
        'ix_budgets_user_dates',
        'budgets',
        ['user_id', 'start_date', 'end_date'],
        unique=False
    )

    # 4. Indexes on notifications table
    op.create_index(
        'ix_notifications_user_id_is_read_created_at',
        'notifications',
        ['user_id', 'is_read', sa.text('created_at DESC')],
        unique=False
    )


def downgrade() -> None:
    # Drop notifications index
    op.drop_index('ix_notifications_user_id_is_read_created_at', table_name='notifications')

    # Drop budgets indexes and columns
    op.drop_index('ix_budgets_user_dates', table_name='budgets')
    op.drop_index('ix_budgets_user_month_year', table_name='budgets')
    op.drop_column('budgets', 'year')
    op.drop_column('budgets', 'month')

    # Drop transactions indexes
    op.drop_index('ix_transactions_category_id', table_name='transactions')
    op.drop_index('ix_transactions_account_id', table_name='transactions')
    op.drop_index('ix_transactions_user_id_date', table_name='transactions')
