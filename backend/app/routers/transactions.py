import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from app.db.session import get_db
from app.models.models import User, Transaction, Account, Category, AIClassificationLog
from app.schemas.schemas import (
    TransactionCreate, 
    TransactionResponse, 
    TransactionUpdate, 
    AutoDetectRequest,
    AIClassificationResponse
)
from app.services.ai_service import ai_service
from app.services.budget_monitor import budget_monitor
from app.routers.deps import get_current_active_user
from app.routers.analytics import invalidate_analytics_cache
from uuid import UUID
from datetime import datetime, timezone
from typing import List, Optional
from decimal import Decimal

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    txn_in: TransactionCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually creates a new transaction and adjusts the linked account balance.
    Also triggers budget threshold checks.
    """
    # Verify account ownership with row-level lock
    acc_result = await db.execute(
        select(Account).where(
            (Account.id == txn_in.account_id) & (Account.user_id == current_user.id)
        ).with_for_update()
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or access denied."
        )

    # Validate category ownership/validity if specified
    if txn_in.category_id:
        cat_result = await db.execute(
            select(Category).where(
                (Category.id == txn_in.category_id) &
                ((Category.user_id == current_user.id) | (Category.user_id == None))
            )
        )
        if not cat_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found or access denied."
            )

    # Adjust account balance atomically
    amount = Decimal(str(txn_in.amount))
    if txn_in.type.lower() == "expense":
        account.balance -= float(amount)
    else:
        account.balance += float(amount)

    db_txn = Transaction(
        user_id=current_user.id,
        account_id=txn_in.account_id,
        category_id=txn_in.category_id,
        amount=txn_in.amount,
        merchant=txn_in.merchant,
        type=txn_in.type,
        notes=txn_in.notes,
        payment_method=txn_in.payment_method,
        date=txn_in.date,
        tags=txn_in.tags,
        is_recurring=txn_in.is_recurring,
        recurring_id=txn_in.recurring_id,
        raw_source=txn_in.raw_source,
        ref_number=txn_in.ref_number
    )
    db.add(db_txn)
    db.add(account)
    await db.commit()
    await db.refresh(db_txn)

    # Trigger budget monitoring as a post-commit hook task
    await budget_monitor.evaluate_transaction_for_alerts(
        db, current_user.id, txn_in.category_id
    )
    invalidate_analytics_cache(str(current_user.id))

    return db_txn

@router.get("/", response_model=List[TransactionResponse])
async def list_transactions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    category_id: Optional[UUID] = None,
    account_id: Optional[UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    type: Optional[str] = None,
    merchant: Optional[str] = None
):
    """
    Lists transactions for the authenticated user, supporting pagination and filters.
    """
    offset = (page - 1) * limit
    filters = [Transaction.user_id == current_user.id]

    if category_id:
        filters.append(Transaction.category_id == category_id)
    if account_id:
        filters.append(Transaction.account_id == account_id)
    if start_date:
        filters.append(Transaction.date >= start_date)
    if end_date:
        filters.append(Transaction.date <= end_date)
    if type:
        filters.append(Transaction.type == type)
    if merchant:
        filters.append(Transaction.merchant.ilike(f"%{merchant}%"))

    query = select(Transaction).where(and_(*filters)).order_by(desc(Transaction.date)).offset(offset).limit(limit)
    result = await db.execute(query)
    transactions = result.scalars().all()
    return transactions

@router.put("/{txn_id}", response_model=TransactionResponse)
async def update_transaction(
    txn_id: UUID,
    txn_in: TransactionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates an existing transaction, modifying account balances appropriately.
    Enforces multi-tenant ownership validation and row-level locking on all touched accounts.
    """
    result = await db.execute(
        select(Transaction).where(
            (Transaction.id == txn_id) & (Transaction.user_id == current_user.id)
        ).with_for_update()
    )
    db_txn = result.scalar_one_or_none()
    if not db_txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or access denied."
        )

    # Validate category ownership if category_id is being changed
    if txn_in.category_id is not None:
        cat_result = await db.execute(
            select(Category).where(
                (Category.id == txn_in.category_id) &
                ((Category.user_id == current_user.id) | (Category.user_id == None))
            )
        )
        if not cat_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found or access denied."
            )

    prev_account_id = db_txn.account_id
    target_account_id = txn_in.account_id if txn_in.account_id is not None else prev_account_id

    if prev_account_id == target_account_id:
        # Same account: single row lock
        acc_result = await db.execute(
            select(Account).where(
                (Account.id == prev_account_id) & (Account.user_id == current_user.id)
            ).with_for_update()
        )
        account = acc_result.scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found or access denied."
            )

        # 1. Reverse previous transaction effect
        prev_amount = Decimal(str(db_txn.amount))
        if db_txn.type.lower() == "expense":
            account.balance += float(prev_amount)
        else:
            account.balance -= float(prev_amount)

        # 2. Apply new values to transaction model
        update_data = txn_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_txn, key, value)

        # 3. Apply updated transaction effect
        new_amount = Decimal(str(db_txn.amount))
        if db_txn.type.lower() == "expense":
            account.balance -= float(new_amount)
        else:
            account.balance += float(new_amount)

        db.add(account)
    else:
        # Cross-account transaction move: strictly lock and verify ownership of BOTH accounts
        prev_acc_res = await db.execute(
            select(Account).where(
                (Account.id == prev_account_id) & (Account.user_id == current_user.id)
            ).with_for_update()
        )
        prev_account = prev_acc_res.scalar_one_or_none()
        if not prev_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Original account not found or access denied."
            )

        new_acc_res = await db.execute(
            select(Account).where(
                (Account.id == target_account_id) & (Account.user_id == current_user.id)
            ).with_for_update()
        )
        new_account = new_acc_res.scalar_one_or_none()
        if not new_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target account not found or access denied."
            )

        # Reverse from previous account
        prev_amount = Decimal(str(db_txn.amount))
        if db_txn.type.lower() == "expense":
            prev_account.balance += float(prev_amount)
        else:
            prev_account.balance -= float(prev_amount)

        # Apply updates
        update_data = txn_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_txn, key, value)

        # Apply to new account
        new_amount = Decimal(str(db_txn.amount))
        if db_txn.type.lower() == "expense":
            new_account.balance -= float(new_amount)
        else:
            new_account.balance += float(new_amount)

        db.add(prev_account)
        db.add(new_account)

    db.add(db_txn)
    await db.commit()
    await db.refresh(db_txn)

    # Re-evaluate budget alerts
    await budget_monitor.evaluate_transaction_for_alerts(
        db, current_user.id, db_txn.category_id
    )
    invalidate_analytics_cache(str(current_user.id))

    return db_txn

@router.delete("/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    txn_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a transaction and restores the corresponding account balance.
    Enforces multi-tenant ownership validation and row-level locking.
    """
    result = await db.execute(
        select(Transaction).where(
            (Transaction.id == txn_id) & (Transaction.user_id == current_user.id)
        ).with_for_update()
    )
    db_txn = result.scalar_one_or_none()
    if not db_txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or access denied."
        )

    # Restore account balance with row-level lock and tenant check
    acc_result = await db.execute(
        select(Account).where(
            (Account.id == db_txn.account_id) & (Account.user_id == current_user.id)
        ).with_for_update()
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked account not found or access denied."
        )

    amount = Decimal(str(db_txn.amount))
    if db_txn.type.lower() == "expense":
        account.balance += float(amount)
    else:
        account.balance -= float(amount)

    db.add(account)
    await db.delete(db_txn)
    await db.commit()
    invalidate_analytics_cache(str(current_user.id))
    return None

@router.post("/auto-detect", response_model=TransactionResponse)
async def auto_detect_transaction(
    req: AutoDetectRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Parses incoming SMS or payment notification text using Gemini Flash,
    determines classification details, creates the transaction, and adjusts balances.
    """
    # 1. Ask Gemini to classify
    parsed: AIClassificationResponse = await asyncio.to_thread(ai_service.classify_text, req.text)

    # 2. Log classification run
    log = AIClassificationLog(
        user_id=current_user.id,
        raw_text=req.text,
        classification_result=parsed.model_dump(),
        confidence_score=parsed.confidence
    )
    db.add(log)

    if parsed.amount is None or parsed.amount <= 0 or parsed.confidence < 0.4:
        # Save log and return error/empty result
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unable to securely parse transaction info from the provided text."
        )

    # 3. Check for duplicate transaction ingestion (Idempotency guarantee)
    if parsed.reference_number:
        dup_res = await db.execute(
            select(Transaction).where(
                (Transaction.user_id == current_user.id) &
                (Transaction.ref_number == parsed.reference_number)
            )
        )
        existing_txn = dup_res.scalars().first()
        if existing_txn:
            await db.commit()  # Preserve classification log
            return existing_txn

    # 4. Match user account based on bank name with row-level locking
    accounts_result = await db.execute(
        select(Account).where(Account.user_id == current_user.id).with_for_update()
    )
    user_accounts = accounts_result.scalars().all()
    if not user_accounts:
        acc_name = parsed.bank_name if parsed.bank_name and parsed.bank_name != "Bank" else "Primary Bank"
        target_account = Account(
            user_id=current_user.id,
            name=f"{acc_name} A/C",
            type="Bank",
            balance=10000.0,
            currency="INR"
        )
        db.add(target_account)
        await db.flush()
    else:
        target_account = user_accounts[0]  # Default fallback
        if parsed.bank_name:
            for acc in user_accounts:
                if parsed.bank_name.lower() in acc.name.lower():
                    target_account = acc
                    break

    # 5. Match category by name (case-insensitive), default to "Others"
    cat_result = await db.execute(
        select(Category).where(
            (Category.name.ilike(parsed.category)) & 
            (or_(Category.user_id == current_user.id, Category.user_id == None))
        )
    )
    category = cat_result.scalars().first()
    
    if not category:
        # Fallback to system "Others" category
        others_result = await db.execute(
            select(Category).where(
                (Category.name.ilike("Others")) & (Category.user_id == None)
            )
        )
        category = others_result.scalars().first()
        if not category:
            any_cat_res = await db.execute(
                select(Category).where(or_(Category.user_id == current_user.id, Category.user_id == None)).limit(1)
            )
            category = any_cat_res.scalars().first()

    # 6. Determine Transaction Type
    # UPI transfers, cards debit are Expenses. Deposits/Salary are Income.
    txn_type = "Expense"
    text_lower = req.text.lower()
    if "credited" in text_lower or "deposited" in text_lower or "received" in text_lower or "salary" in text_lower:
        txn_type = "Income"

    # 7. Adjust account balance atomically
    amount = Decimal(str(parsed.amount))
    if txn_type == "Expense":
        target_account.balance -= float(amount)
    else:
        target_account.balance += float(amount)

    # 8. Create the auto transaction
    db_txn = Transaction(
        user_id=current_user.id,
        account_id=target_account.id,
        category_id=category.id if category else None,
        amount=amount,
        merchant=parsed.merchant or "Auto Merchant",
        type=txn_type,
        notes=f"Auto-detected {req.source}. SMS: \"{req.text[:60]}...\"",
        payment_method=parsed.payment_method,
        date=datetime.now(timezone.utc),
        raw_source=req.source,
        ref_number=parsed.reference_number
    )

    db.add(target_account)
    db.add(db_txn)
    await db.commit()
    await db.refresh(db_txn)

    # Trigger budget monitoring
    if category:
        await budget_monitor.evaluate_transaction_for_alerts(
            db, current_user.id, category.id
        )
    invalidate_analytics_cache(str(current_user.id))

    return db_txn
