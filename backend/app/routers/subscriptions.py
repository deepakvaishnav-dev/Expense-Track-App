from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.models import User, Subscription, Account, Category
from app.schemas.schemas import SubscriptionCreate, SubscriptionResponse, SubscriptionUpdate
from app.routers.deps import get_current_active_user
from uuid import UUID
from typing import List

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

@router.post("/", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    sub_in: SubscriptionCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Registers a new active subscription.
    """
    # Verify account ownership
    acc_res = await db.execute(
        select(Account).where(
            (Account.id == sub_in.account_id) & (Account.user_id == current_user.id)
        )
    )
    if not acc_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked Account not found."
        )

    # Verify category ownership/existence
    cat_res = await db.execute(
        select(Category).where(
            (Category.id == sub_in.category_id) & 
            ((Category.user_id == current_user.id) | (Category.user_id == None))
        )
    )
    if not cat_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found."
        )

    db_sub = Subscription(
        user_id=current_user.id,
        account_id=sub_in.account_id,
        category_id=sub_in.category_id,
        name=sub_in.name,
        amount=sub_in.amount,
        billing_period=sub_in.billing_period,
        next_billing_date=sub_in.next_billing_date,
        is_active=True
    )
    db.add(db_sub)
    await db.commit()
    await db.refresh(db_sub)
    return db_sub

@router.get("/", response_model=List[SubscriptionResponse])
async def list_subscriptions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists all subscriptions for the user.
    """
    result = await db.execute(select(Subscription).where(Subscription.user_id == current_user.id))
    return result.scalars().all()

@router.put("/{sub_id}", response_model=SubscriptionResponse)
async def update_subscription(
    sub_id: UUID,
    sub_in: SubscriptionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Modifies subscription properties, including updating active status.
    """
    result = await db.execute(
        select(Subscription).where(
            (Subscription.id == sub_id) & (Subscription.user_id == current_user.id)
        )
    )
    db_sub = result.scalar_one_or_none()
    if not db_sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found or access denied."
        )

    # Multi-tenant account validation on reassignment
    if sub_in.account_id is not None:
        acc_res = await db.execute(
            select(Account).where(
                (Account.id == sub_in.account_id) & (Account.user_id == current_user.id)
            )
        )
        if not acc_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Linked Account not found or access denied."
            )

    # Multi-tenant category validation on reassignment
    if sub_in.category_id is not None:
        cat_res = await db.execute(
            select(Category).where(
                (Category.id == sub_in.category_id) & 
                ((Category.user_id == current_user.id) | (Category.user_id == None))
            )
        )
        if not cat_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found or access denied."
            )

    # Perform updates
    update_data = sub_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_sub, key, value)

    db.add(db_sub)
    await db.commit()
    await db.refresh(db_sub)
    return db_sub

@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription(
    sub_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a subscription.
    """
    result = await db.execute(
        select(Subscription).where(
            (Subscription.id == sub_id) & (Subscription.user_id == current_user.id)
        )
    )
    db_sub = result.scalar_one_or_none()
    if not db_sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found."
        )
        
    await db.delete(db_sub)
    await db.commit()
    return None
