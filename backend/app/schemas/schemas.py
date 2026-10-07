from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from decimal import Decimal

# --- AUTH SCHEMAS ---

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str = Field(min_length=8, description="Password must be at least 8 characters long")

class UserResponse(UserBase):
    id: UUID
    is_admin: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


# --- ACCOUNT SCHEMAS ---

class AccountBase(BaseModel):
    name: str
    type: str = Field(description="Must be 'Cash', 'Bank', 'Wallet', or 'Credit Card'")
    currency: str = "INR"

class AccountCreate(AccountBase):
    balance: float = 0.0

class AccountResponse(AccountBase):
    id: UUID
    user_id: UUID
    balance: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- CATEGORY SCHEMAS ---

class CategoryBase(BaseModel):
    name: str
    icon: str
    color: str
    type: str = "Expense"  # Expense or Income

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: UUID
    user_id: Optional[UUID] = None
    is_custom: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- TRANSACTION SCHEMAS ---

class TransactionBase(BaseModel):
    account_id: UUID
    category_id: Optional[UUID] = None
    amount: Decimal = Field(gt=0)
    merchant: str
    type: str = Field(description="Must be 'Expense' or 'Income'")
    notes: Optional[str] = None
    payment_method: str = Field(description="Must be 'Cash', 'UPI', 'Debit Card', 'Credit Card', or 'Wallet'")
    date: datetime
    tags: Optional[List[str]] = None
    is_recurring: bool = False
    recurring_id: Optional[UUID] = None
    raw_source: str = "Manual"  # Manual, SMS, Notification, Receipt
    ref_number: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    account_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    merchant: Optional[str] = None
    type: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    date: Optional[datetime] = None
    tags: Optional[List[str]] = None
    is_recurring: Optional[bool] = None
    ref_number: Optional[str] = None

class TransactionResponse(TransactionBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# --- BUDGET SCHEMAS ---

class BudgetBase(BaseModel):
    category_id: Optional[UUID] = None  # Null for overall monthly budget
    amount: Decimal = Field(gt=0)
    period: str = "Monthly"
    start_date: datetime
    end_date: datetime

class BudgetCreate(BudgetBase):
    pass

class BudgetResponse(BudgetBase):
    id: UUID
    user_id: UUID
    alert_50_triggered: bool
    alert_75_triggered: bool
    alert_90_triggered: bool
    alert_100_triggered: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- SAVINGS GOAL SCHEMAS ---

class SavingsGoalBase(BaseModel):
    name: str
    target_amount: Decimal = Field(gt=0)
    target_date: datetime

class SavingsGoalCreate(SavingsGoalBase):
    current_amount: Decimal = Field(default=0.00, ge=0)

class SavingsGoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[Decimal] = Field(None, gt=0)
    current_amount: Optional[Decimal] = Field(None, ge=0)
    target_date: Optional[datetime] = None

class SavingsGoalResponse(SavingsGoalBase):
    id: UUID
    user_id: UUID
    current_amount: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- SUBSCRIPTION SCHEMAS ---

class SubscriptionBase(BaseModel):
    account_id: UUID
    category_id: UUID
    name: str
    amount: Decimal = Field(gt=0)
    billing_period: str = Field(description="Must be 'Daily', 'Weekly', 'Monthly', or 'Yearly'")
    next_billing_date: datetime

class SubscriptionCreate(SubscriptionBase):
    pass

class SubscriptionUpdate(BaseModel):
    account_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    name: Optional[str] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    billing_period: Optional[str] = None
    next_billing_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class SubscriptionResponse(SubscriptionBase):
    id: UUID
    user_id: UUID
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- NOTIFICATION SCHEMAS ---

class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- AUTO DETECTION & AI SCHEMAS ---

class AutoDetectRequest(BaseModel):
    text: str
    source: str = Field("SMS", description="Source of the text (SMS or Notification)")
    package_name: Optional[str] = Field(None, description="App package name if notification source")

class AIClassificationResponse(BaseModel):
    amount: Optional[float] = None
    merchant: Optional[str] = None
    date: Optional[str] = None
    bank_name: Optional[str] = None
    category: str
    confidence: float
    payment_method: str
    reference_number: Optional[str] = None

class ReceiptOCRResponse(BaseModel):
    merchant: str
    amount: float
    tax: float
    date: str
    items: List[Dict[str, Any]]
    payment_method: str


# --- ANALYTICS & REPORTS SCHEMAS ---

class AnalyticsSummaryResponse(BaseModel):
    today_spending: float
    weekly_spending: float
    monthly_spending: float
    remaining_budget: float
    category_breakdown: List[Dict[str, Any]]
    spending_trends: List[Dict[str, Any]]
    recent_transactions: List[TransactionResponse]
    top_categories: List[Dict[str, Any]]
    ai_insights: List[str]

class ReportGenerateRequest(BaseModel):
    format: str = Field("pdf", description="Format: 'pdf' or 'csv'")
    start_date: datetime
    end_date: datetime
