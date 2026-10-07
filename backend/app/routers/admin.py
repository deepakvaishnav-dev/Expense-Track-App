from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.db.session import get_db
from app.models.models import User, Transaction, AIClassificationLog, Budget, Account
from app.schemas.schemas import UserResponse
from app.routers.deps import get_current_admin
from uuid import UUID
from typing import List, Dict, Any

router = APIRouter(prefix="/admin", tags=["Administration"])

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all registered users in the database. Restricted to admin users.
    """
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()

@router.get("/ai-logs", response_model=List[Dict[str, Any]])
async def list_ai_logs(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 50
):
    """
    Retrieves history logs of AI classifications and receipt parsing requests.
    """
    result = await db.execute(
        select(AIClassificationLog)
        .order_by(AIClassificationLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    # Cast models to dictionaries for JSON response compatibility
    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id),
            "raw_text": log.raw_text,
            "classification_result": log.classification_result,
            "confidence_score": float(log.confidence_score),
            "created_at": log.created_at
        } for log in logs
    ]

@router.get("/metrics")
async def get_system_metrics(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Aggregates global platform performance and usage metrics.
    """
    users_count = await db.execute(select(func.count(User.id)))
    transactions_count = await db.execute(select(func.count(Transaction.id)))
    ai_logs_count = await db.execute(select(func.count(AIClassificationLog.id)))
    budgets_count = await db.execute(select(func.count(Budget.id)))
    
    # Calculate average confidence
    avg_confidence_res = await db.execute(select(func.avg(AIClassificationLog.confidence_score)))
    avg_confidence = avg_confidence_res.scalar() or 0.0

    return {
        "total_users": users_count.scalar() or 0,
        "total_transactions": transactions_count.scalar() or 0,
        "total_ai_calls": ai_logs_count.scalar() or 0,
        "total_budgets_configured": budgets_count.scalar() or 0,
        "ai_average_confidence": float(avg_confidence)
    }

@router.put("/users/{user_id}/status")
async def toggle_user_active_status(
    user_id: UUID,
    is_active: bool,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Enables/disables a user account.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    user.is_active = is_active
    db.add(user)
    await db.commit()
    return {"detail": f"User status set to active={is_active}."}
