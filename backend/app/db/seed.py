import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import engine, async_session
from app.models.models import Base, User, Account, Category, Transaction, Budget, Subscription
from app.services.auth_service import auth_service

async def seed_data():
    print("Starting database seeding...")
    async with async_session() as session:
        # 1. Create System Categories (user_id = None)
        system_categories = [
            {"name": "Food", "icon": "food-fork-spoon", "color": "#EF4444", "type": "Expense"},
            {"name": "Grocery", "icon": "cart", "color": "#F59E0B", "type": "Expense"},
            {"name": "Shopping", "icon": "shopping", "color": "#EC4899", "type": "Expense"},
            {"name": "Bills", "icon": "file-document", "color": "#3B82F6", "type": "Expense"},
            {"name": "Fuel", "icon": "gas-station", "color": "#10B981", "type": "Expense"},
            {"name": "Travel", "icon": "bus", "color": "#8B5CF6", "type": "Expense"},
            {"name": "Medical", "icon": "medical-bag", "color": "#EF4444", "type": "Expense"},
            {"name": "Entertainment", "icon": "gamepad-variant", "color": "#EC4899", "type": "Expense"},
            {"name": "Salary", "icon": "cash-multiple", "color": "#10B981", "type": "Income"},
            {"name": "Investment", "icon": "trending-up", "color": "#3B82F6", "type": "Income"},
            {"name": "Rent", "icon": "home-variant", "color": "#6B7280", "type": "Expense"},
            {"name": "EMI", "icon": "credit-card", "color": "#EF4444", "type": "Expense"},
            {"name": "Others", "icon": "dots-horizontal", "color": "#9CA3AF", "type": "Expense"}
        ]

        inserted_categories = {}
        for cat in system_categories:
            q = select(Category).where((Category.name == cat["name"]) & (Category.user_id == None))
            res = await session.execute(q)
            db_cat = res.scalar_one_or_none()
            if not db_cat:
                db_cat = Category(
                    name=cat["name"],
                    icon=cat["icon"],
                    color=cat["color"],
                    type=cat["type"],
                    is_custom=False
                )
                session.add(db_cat)
                await session.flush()
            inserted_categories[cat["name"]] = db_cat

        # 2. Create Demo User
        demo_email = "demo@expenseai.com"
        user_res = await session.execute(select(User).where(User.email == demo_email))
        demo_user = user_res.scalar_one_or_none()
        
        if not demo_user:
            demo_user = User(
                email=demo_email,
                full_name="Demo User",
                password_hash=auth_service.get_password_hash("Password123!"),
                is_admin=True,
                is_active=True
            )
            session.add(demo_user)
            await session.flush()
            print(f"Created demo user: {demo_email} with password 'Password123!'")

        # 3. Create Accounts for Demo User
        accounts_to_create = [
            {"name": "HDFC Savings Bank", "type": "Bank", "balance": 45000.0, "currency": "INR"},
            {"name": "Cash Wallet", "type": "Cash", "balance": 3500.0, "currency": "INR"},
            {"name": "ICICI Amazon Credit Card", "type": "Credit Card", "balance": -12000.0, "currency": "INR"},
            {"name": "Paytm Wallet", "type": "Wallet", "balance": 1200.0, "currency": "INR"}
        ]
        
        inserted_accounts = {}
        for acc in accounts_to_create:
            # Note: account name is encrypted in the model, so we do a python check
            acc_query = await session.execute(select(Account).where(Account.user_id == demo_user.id))
            user_accs = acc_query.scalars().all()
            
            db_acc = None
            for existing_acc in user_accs:
                if existing_acc.name == acc["name"]:
                    db_acc = existing_acc
                    break
                    
            if not db_acc:
                db_acc = Account(
                    user_id=demo_user.id,
                    name=acc["name"],
                    type=acc["type"],
                    balance=acc["balance"],
                    currency=acc["currency"]
                )
                session.add(db_acc)
                await session.flush()
            inserted_accounts[acc["name"]] = db_acc

        # 4. Create Budgets for Demo User
        now = datetime.now(timezone.utc)
        budget_start = datetime(now.year, now.month, 1)
        budget_end = datetime(now.year, now.month, 28) + timedelta(days=4)
        budget_end = datetime(budget_end.year, budget_end.month, 1) - timedelta(days=1)
        
        budget_check = await session.execute(select(Budget).where(Budget.user_id == demo_user.id))
        if not budget_check.scalars().first():
            # Create total monthly budget
            overall_budget = Budget(
                user_id=demo_user.id,
                category_id=None,
                amount=Decimal("30000.00"),
                start_date=budget_start,
                end_date=budget_end
            )
            session.add(overall_budget)
            
            # Create Food budget
            food_budget = Budget(
                user_id=demo_user.id,
                category_id=inserted_categories["Food"].id,
                amount=Decimal("8000.00"),
                start_date=budget_start,
                end_date=budget_end
            )
            session.add(food_budget)

        # 5. Create Transactions spread over the last 5 days
        tx_check = await session.execute(select(Transaction).where(Transaction.user_id == demo_user.id))
        if not tx_check.scalars().first():
            today = datetime.now(timezone.utc)
            mock_txs = [
                # Salary income
                {
                    "account": "HDFC Savings Bank",
                    "category": "Salary",
                    "amount": Decimal("75000.00"),
                    "merchant": "IT INFOTECH PVT LTD",
                    "type": "Income",
                    "notes": "Monthly Salary credited",
                    "payment_method": "Bank",
                    "date": today - timedelta(days=5),
                    "raw_source": "SMS",
                    "ref_number": "TXN9876543210"
                },
                # Food Expense
                {
                    "account": "ICICI Amazon Credit Card",
                    "category": "Food",
                    "amount": Decimal("540.00"),
                    "merchant": "Zomato Restaurant",
                    "type": "Expense",
                    "notes": "Dinner order",
                    "payment_method": "Credit Card",
                    "date": today - timedelta(days=4),
                    "raw_source": "Notification",
                    "ref_number": "TXN123450001"
                },
                # Grocery Expense
                {
                    "account": "Paytm Wallet",
                    "category": "Grocery",
                    "amount": Decimal("1250.00"),
                    "merchant": "Blinkit Grocery",
                    "type": "Expense",
                    "notes": "Weekly household groceries",
                    "payment_method": "Wallet",
                    "date": today - timedelta(days=3),
                    "raw_source": "Manual",
                    "ref_number": None
                },
                # Fuel Expense
                {
                    "account": "Cash Wallet",
                    "category": "Fuel",
                    "amount": Decimal("1000.00"),
                    "merchant": "HP Petrol Pump",
                    "type": "Expense",
                    "notes": "Petrol for car",
                    "payment_method": "Cash",
                    "date": today - timedelta(days=2),
                    "raw_source": "Manual",
                    "ref_number": None
                },
                # Subscription Expense
                {
                    "account": "ICICI Amazon Credit Card",
                    "category": "Entertainment",
                    "amount": Decimal("649.00"),
                    "merchant": "Netflix India",
                    "type": "Expense",
                    "notes": "Monthly subscription",
                    "payment_method": "Credit Card",
                    "date": today - timedelta(days=1),
                    "raw_source": "SMS",
                    "ref_number": "TXN445566778"
                },
                # Rent Expense
                {
                    "account": "HDFC Savings Bank",
                    "category": "Rent",
                    "amount": Decimal("12000.00"),
                    "merchant": "House Owner Rent",
                    "type": "Expense",
                    "notes": "Rent payment",
                    "payment_method": "Bank",
                    "date": today,
                    "raw_source": "Manual",
                    "ref_number": "TXN11223344"
                }
            ]
            
            for tx in mock_txs:
                db_tx = Transaction(
                    user_id=demo_user.id,
                    account_id=inserted_accounts[tx["account"]].id,
                    category_id=inserted_categories[tx["category"]].id,
                    amount=tx["amount"],
                    merchant=tx["merchant"],
                    type=tx["type"],
                    notes=tx["notes"],
                    payment_method=tx["payment_method"],
                    date=tx["date"],
                    raw_source=tx["raw_source"],
                    ref_number=tx["ref_number"]
                )
                session.add(db_tx)

        await session.commit()
        print("Database seeded successfully with core demo data.")

if __name__ == "__main__":
    # Create tables first, then seed
    async def main():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await seed_data()
        await engine.dispose()
        
    asyncio.run(main())
