import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import bcrypt
from app.config import settings

class AuthService:
    @staticmethod
    def generate_reset_token() -> str:
        """Generate a cryptographically secure URL-safe 32-byte reset token."""
        return secrets.token_urlsafe(32)

    @staticmethod
    def hash_reset_token(token: str) -> str:
        """Hash a reset token using SHA-256 for secure constant-length DB storage."""
        return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify plain password against hashed password."""
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"), 
                hashed_password.encode("utf-8")
            )
        except Exception:
            return False

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password using bcrypt."""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a short-lived JWT Access Token."""
        to_encode = data.copy()
        now = datetime.now(timezone.utc)
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": int(expire.timestamp()), "type": "access"})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @staticmethod
    def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a long-lived JWT Refresh Token."""
        to_encode = data.copy()
        now = datetime.now(timezone.utc)
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": int(expire.timestamp()), "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, settings.REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @staticmethod
    def decode_access_token(token: str) -> Optional[dict]:
        """Decode and validate a JWT Access Token."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if payload.get("type") != "access":
                return None
            return payload
        except jwt.PyJWTError:
            return None

    @staticmethod
    def decode_refresh_token(token: str) -> Optional[dict]:
        """Decode and validate a JWT Refresh Token."""
        try:
            payload = jwt.decode(token, settings.REFRESH_SECRET_KEY, algorithms=[settings.ALGORITHM])
            if payload.get("type") != "refresh":
                return None
            return payload
        except jwt.PyJWTError:
            return None

auth_service = AuthService()
