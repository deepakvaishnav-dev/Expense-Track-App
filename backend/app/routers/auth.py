from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
from app.db.session import get_db
from app.models.models import User, Account, Category, PasswordResetToken
from app.schemas.schemas import (
    UserCreate, 
    UserResponse, 
    Token, 
    LoginRequest, 
    RefreshTokenRequest,
    PasswordResetRequest,
    PasswordResetConfirm
)
from app.services.auth_service import auth_service
from app.routers.deps import get_current_active_user
import uuid

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Registers a new user, hashes their password, and sets up default categories 
    and a default 'Cash' account.
    """
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Create new user
    hashed_password = auth_service.get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        password_hash=hashed_password
    )
    db.add(db_user)
    await db.flush()  # Flush to get the db_user.id generated

    # Prepopulate default categories for the new user
    default_categories = [
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
        {"name": "EMI", "icon": "credit-card", "color": "#EF4444", "type": "Expense"}
    ]
    for cat in default_categories:
        db_cat = Category(
            user_id=db_user.id,
            name=cat["name"],
            icon=cat["icon"],
            color=cat["color"],
            type=cat["type"],
            is_custom=False
        )
        db.add(db_cat)

    # Prepopulate a default cash account
    default_account = Account(
        user_id=db_user.id,
        name="Cash Wallet",
        type="Cash",
        balance=0.0,
        currency="INR"
    )
    db.add(default_account)

    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
async def login(login_in: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticates user credentials and returns JWT Access and Refresh Tokens.
    """
    result = await db.execute(select(User).where(User.email == login_in.email))
    user = result.scalar_one_or_none()
    
    if not user or not auth_service.verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="User account is inactive."
        )

    # Generate tokens
    access_token = auth_service.create_access_token(data={"sub": str(user.id)})
    refresh_token = auth_service.create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_in: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """
    Verifies a refresh token and generates a new access token.
    """
    payload = auth_service.decode_refresh_token(refresh_in.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token."
        )
        
    user_id_str = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id_str)))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive."
        )

    access_token = auth_service.create_access_token(data={"sub": str(user.id)})
    new_refresh_token = auth_service.create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """
    Logs out the user. Client-side should clear local JWT tokens.
    """
    return {"detail": "Successfully logged out."}

@router.post("/password-reset")
async def password_reset(reset_in: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    """
    Initiates a password reset. Generates a secure single-use token with a 15-minute TTL.
    Returns a constant generic response to prevent user enumeration attacks.
    """
    result = await db.execute(select(User).where(User.email == reset_in.email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        # Invalidate any previously unconsumed tokens for this user
        existing_tokens_res = await db.execute(
            select(PasswordResetToken).where(
                (PasswordResetToken.user_id == user.id) & (PasswordResetToken.is_used == False)
            )
        )
        for old_token in existing_tokens_res.scalars().all():
            old_token.is_used = True
            db.add(old_token)

        # Generate cryptographically secure token and its SHA-256 hash
        raw_token = auth_service.generate_reset_token()
        token_hash = auth_service.hash_reset_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

        db_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            is_used=False
        )
        db.add(db_token)
        await db.commit()

        # In production, dispatch email with raw_token link here.
        # Constant generic detail prevents user account enumeration:
    return {"detail": "If the account exists, password recovery instructions have been sent."}

@router.post("/password-reset/confirm")
async def confirm_password_reset(confirm_in: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    """
    Confirms password reset and updates user password in DB.
    Validates token presence, expiration, and single-use status atomically.
    """
    raw_token = confirm_in.token.strip() if confirm_in.token else ""
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )

    token_hash = auth_service.hash_reset_token(raw_token)
    now = datetime.now(timezone.utc)

    # Atomically locate and lock token row
    token_res = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash
        ).with_for_update()
    )
    db_token = token_res.scalar_one_or_none()

    if not db_token or db_token.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )

    # Check token expiry
    token_expiry = db_token.expires_at
    if token_expiry.tzinfo is None:
        token_expiry = token_expiry.replace(tzinfo=timezone.utc)

    if token_expiry < now:
        db_token.is_used = True
        db.add(db_token)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )

    # Locate and lock user record associated strictly with this token
    user_res = await db.execute(
        select(User).where(User.id == db_token.user_id).with_for_update()
    )
    user = user_res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token."
        )

    # Atomically update password hash and mark token consumed
    user.password_hash = auth_service.get_password_hash(confirm_in.new_password)
    db_token.is_used = True
    db.add(user)
    db.add(db_token)
    await db.commit()

    return {"detail": "Password successfully updated."}
