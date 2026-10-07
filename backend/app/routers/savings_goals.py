from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.models import User, SavingsGoal
from app.schemas.schemas import SavingsGoalCreate, SavingsGoalResponse, SavingsGoalUpdate
from app.routers.deps import get_current_active_user
from uuid import UUID
from typing import List

router = APIRouter(prefix="/savings-goals", tags=["Savings Goals"])

@router.post("/", response_model=SavingsGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_in: SavingsGoalCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new savings goal (e.g., Laptop, Emergency Fund).
    """
    db_goal = SavingsGoal(
        user_id=current_user.id,
        name=goal_in.name,
        target_amount=goal_in.target_amount,
        current_amount=goal_in.current_amount,
        target_date=goal_in.target_date
    )
    db.add(db_goal)
    await db.commit()
    await db.refresh(db_goal)
    return db_goal

@router.get("/", response_model=List[SavingsGoalResponse])
async def list_goals(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all savings goals for the user.
    """
    result = await db.execute(select(SavingsGoal).where(SavingsGoal.user_id == current_user.id))
    return result.scalars().all()

@router.put("/{goal_id}", response_model=SavingsGoalResponse)
async def update_goal(
    goal_id: UUID,
    goal_in: SavingsGoalUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates savings goal details, including current progress.
    """
    result = await db.execute(
        select(SavingsGoal).where(
            (SavingsGoal.id == goal_id) & (SavingsGoal.user_id == current_user.id)
        )
    )
    db_goal = result.scalar_one_or_none()
    if not db_goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings goal not found."
        )

    update_data = goal_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_goal, key, value)

    db.add(db_goal)
    await db.commit()
    await db.refresh(db_goal)
    return db_goal

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Removes a savings goal.
    """
    result = await db.execute(
        select(SavingsGoal).where(
            (SavingsGoal.id == goal_id) & (SavingsGoal.user_id == current_user.id)
        )
    )
    db_goal = result.scalar_one_or_none()
    if not db_goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings goal not found."
        )
        
    await db.delete(db_goal)
    await db.commit()
    return None
