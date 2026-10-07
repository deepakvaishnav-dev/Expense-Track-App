from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.models import User, Account
from app.schemas.schemas import AccountCreate, AccountResponse
from app.routers.deps import get_current_active_user
from uuid import UUID
from typing import List

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_in: AccountCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new account for the user. Balances and names are encrypted transparently in PostgreSQL.
    """
    db_account = Account(
        user_id=current_user.id,
        name=account_in.name,
        type=account_in.type,
        balance=account_in.balance,
        currency=account_in.currency
    )
    db.add(db_account)
    await db.commit()
    await db.refresh(db_account)
    return db_account

@router.get("/", response_model=List[AccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists all accounts belonging to the authenticated user. Decrypted values are returned.
    """
    result = await db.execute(select(Account).where(Account.user_id == current_user.id))
    accounts = result.scalars().all()
    return accounts

@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves details for a single account.
    """
    result = await db.execute(
        select(Account).where(
            (Account.id == account_id) & (Account.user_id == current_user.id)
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found."
        )
    return account

@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: UUID,
    account_in: AccountCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates details for a single account.
    """
    result = await db.execute(
        select(Account).where(
            (Account.id == account_id) & (Account.user_id == current_user.id)
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found."
        )
        
    account.name = account_in.name
    account.type = account_in.type
    account.balance = account_in.balance
    account.currency = account_in.currency
    
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes an account. WARNING: This will cascade delete associated transactions.
    """
    result = await db.execute(
        select(Account).where(
            (Account.id == account_id) & (Account.user_id == current_user.id)
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found."
        )
        
    await db.delete(account)
    await db.commit()
    return None
