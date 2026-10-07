from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.session import get_db
from app.models.models import User, Category
from app.schemas.schemas import CategoryCreate, CategoryResponse
from app.routers.deps import get_current_active_user
from uuid import UUID
from typing import List

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new custom category for the user.
    """
    # Check if category name already exists for this user
    result = await db.execute(
        select(Category).where(
            (Category.name.ilike(category_in.name)) & 
            (Category.user_id == current_user.id)
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists."
        )

    db_category = Category(
        user_id=current_user.id,
        name=category_in.name,
        icon=category_in.icon,
        color=category_in.color,
        type=category_in.type,
        is_custom=True
    )
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category

@router.get("/", response_model=List[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns default system categories and custom user categories.
    """
    result = await db.execute(
        select(Category).where(
            or_(
                Category.user_id == None,  # System global categories
                Category.user_id == current_user.id  # User's custom categories
            )
        ).order_by(Category.name)
    )
    categories = result.scalars().all()
    
    # Filter duplicates: if user-specific category exists, ignore the system one with the same name
    user_categories = [c for c in categories if c.user_id == current_user.id]
    user_cat_names = {c.name.lower() for c in user_categories}
    
    filtered_categories = []
    for cat in categories:
        if cat.user_id is None and cat.name.lower() in user_cat_names:
            continue
        filtered_categories.append(cat)
        
    return filtered_categories

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates details for a custom category. Default system categories cannot be updated.
    """
    result = await db.execute(
        select(Category).where(
            (Category.id == category_id) & (Category.user_id == current_user.id)
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom category not found or is a system category."
        )
        
    category.name = category_in.name
    category.icon = category_in.icon
    category.color = category_in.color
    category.type = category_in.type
    
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a custom category. Default system categories cannot be deleted.
    """
    result = await db.execute(
        select(Category).where(
            (Category.id == category_id) & (Category.user_id == current_user.id)
        )
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom category not found or is a system category."
        )
        
    await db.delete(category)
    await db.commit()
    return None
