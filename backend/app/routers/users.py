from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.models import User
from app.schemas.schemas import UserResponse, UserBase
from app.routers.deps import get_current_active_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """
    Returns the currently logged-in user profile.
    """
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_me(
    user_in: UserBase,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the logged-in user's profile information.
    """
    current_user.full_name = user_in.full_name
    current_user.email = user_in.email  # In a production app, email changes would require verification.
    
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user
