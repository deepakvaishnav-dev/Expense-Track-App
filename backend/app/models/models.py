import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Numeric,
    Integer,
    ForeignKey,
    Text,
    JSON,
    Index,
    desc,
    func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base
from app.services.encryption_service import EncryptedString, EncryptedFloat

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    savings_goals = relationship("SavingsGoal", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    receipts = relationship("Receipt", back_populates="user", cascade="all, delete-orphan")
    ai_classification_logs = relationship("AIClassificationLog", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(EncryptedString(255), nullable=False)  # Encrypted: e.g. "HDFC Bank (8901)"
    type = Column(String(50), nullable=False)  # Cash, Bank, Wallet, Credit Card
    balance = Column(EncryptedFloat(255), default=0.0, nullable=False)  # Encrypted float
    currency = Column(String(10), default="INR", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="account", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # Null for system defaults
    name = Column(String(100), nullable=False, index=True)
    icon = Column(String(50), nullable=False)  # e.g. "food-fork-spoon", "bus"
    color = Column(String(7), nullable=False)  # e.g. "#FF5733"
    type = Column(String(20), default="Expense", nullable=False)  # Expense, Income
    is_custom = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="category", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    merchant = Column(String(255), index=True, nullable=False)
    type = Column(String(20), nullable=False)  # Expense, Income
    notes = Column(Text, nullable=True)
    payment_method = Column(String(50), nullable=False)  # Cash, UPI, Debit Card, Credit Card, Wallet
    date = Column(DateTime(timezone=True), index=True, nullable=False)
    tags = Column(JSON, nullable=True)  # List of strings
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurring_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    raw_source = Column(String(50), default="Manual", nullable=False)  # Manual, SMS, Notification, Receipt
    ref_number = Column(EncryptedString(255), nullable=True)  # Encrypted: e.g. UPI Ref Id
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_transactions_user_id_date", "user_id", desc("date")),
        Index("ix_transactions_account_id", "account_id"),
        Index("ix_transactions_category_id", "category_id"),
    )

    # Relationships
    user = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    subscription = relationship("Subscription", back_populates="transactions")
    receipts = relationship("Receipt", back_populates="transaction")


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)  # Null means total overall budget
    amount = Column(Numeric(12, 2), nullable=False)
    period = Column(String(50), default="Monthly", nullable=False)
    month = Column(Integer, nullable=True)
    year = Column(Integer, nullable=True)
    start_date = Column(DateTime(timezone=False), nullable=False)
    end_date = Column(DateTime(timezone=False), nullable=False)
    alert_50_triggered = Column(Boolean, default=False, nullable=False)
    alert_75_triggered = Column(Boolean, default=False, nullable=False)
    alert_90_triggered = Column(Boolean, default=False, nullable=False)
    alert_100_triggered = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_budgets_user_month_year", "user_id", "month", "year"),
        Index("ix_budgets_user_dates", "user_id", "start_date", "end_date"),
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.month is None and getattr(self, "start_date", None):
            self.month = self.start_date.month
        if self.year is None and getattr(self, "start_date", None):
            self.year = self.start_date.year

    # Relationships
    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    target_amount = Column(Numeric(12, 2), nullable=False)
    current_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    target_date = Column(DateTime(timezone=False), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="savings_goals")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    billing_period = Column(String(50), nullable=False)  # Daily, Weekly, Monthly, Yearly
    next_billing_date = Column(DateTime(timezone=False), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="subscriptions")
    account = relationship("Account", back_populates="subscriptions")
    category = relationship("Category", back_populates="subscriptions")
    transactions = relationship("Transaction", back_populates="subscription")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)  # BudgetAlert, SubscriptionRenewal, DailyReminder, System
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_notifications_user_id_is_read_created_at", "user_id", "is_read", desc("created_at")),
    )

    # Relationships
    user = relationship("User", back_populates="notifications")


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    file_url = Column(String(512), nullable=False)
    raw_ocr_text = Column(Text, nullable=True)
    extracted_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="receipts")
    transaction = relationship("Transaction", back_populates="receipts")


class AIClassificationLog(Base):
    __tablename__ = "ai_classification_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    raw_text = Column(Text, nullable=False)
    classification_result = Column(JSON, nullable=False)
    confidence_score = Column(Numeric(5, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="ai_classification_logs")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")
