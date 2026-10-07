from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.models import User, Notification
from app.schemas.schemas import NotificationResponse
from app.routers.deps import get_current_active_user
from uuid import UUID
from typing import List

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all notifications for the authenticated user, sorted by newest first.
    """
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
    )
    return result.scalars().all()

@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Marks a notification as read.
    """
    result = await db.execute(
        select(Notification).where(
            (Notification.id == notification_id) & (Notification.user_id == current_user.id)
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found."
        )

    notification.is_read = True
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification

@router.put("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Marks all notifications for the user as read.
    """
    result = await db.execute(
        select(Notification).where(
            (Notification.user_id == current_user.id) & (Notification.is_read == False)
        )
    )
    notifications = result.scalars().all()
    for notif in notifications:
        notif.is_read = True
        db.add(notif)
    await db.commit()
    return {"detail": f"Successfully marked {len(notifications)} notifications as read."}
