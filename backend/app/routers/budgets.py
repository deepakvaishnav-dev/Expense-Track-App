from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.session import get_db
from app.models.models import User, Budget, Category
from app.schemas.schemas import BudgetCreate, BudgetResponse
from app.routers.deps import get_current_active_user
from uuid import UUID
from typing import List

router = APIRouter(prefix="/budgets", tags=["Budgets"])

@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_in: BudgetCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Sets a budget limit for a category (or total overall limit).
    """
    if budget_in.category_id:
        # Validate category ownership/existence
        cat_res = await db.execute(
            select(Category).where(
                (Category.id == budget_in.category_id) & 
                (and_(Category.user_id == current_user.id, Category.user_id != None) | (Category.user_id == None))
            )
        )
        if not cat_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found."
            )

    db_budget = Budget(
        user_id=current_user.id,
        category_id=budget_in.category_id,
        amount=budget_in.amount,
        period=budget_in.period,
        start_date=budget_in.start_date,
        end_date=budget_in.end_date
    )
    db.add(db_budget)
    await db.commit()
    await db.refresh(db_budget)
    return db_budget

@router.get("/", response_model=List[BudgetResponse])
async def list_budgets(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all active budgets for the authenticated user.
    """
    result = await db.execute(select(Budget).where(Budget.user_id == current_user.id))
    budgets = result.scalars().all()
    return budgets

@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves details for a single budget.
    """
    result = await db.execute(
        select(Budget).where(
            (Budget.id == budget_id) & (Budget.user_id == current_user.id)
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found."
        )
    return budget

@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Removes a budget definition.
    """
    result = await db.execute(
        select(Budget).where(
            (Budget.id == budget_id) & (Budget.user_id == current_user.id)
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found."
        )
        
    await db.delete(budget)
    await db.commit()
    return None
