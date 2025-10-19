"""
Authentication utilities - Password hashing, JWT token management
"""
from datetime import datetime, timedelta
from typing import Optional
import secrets
import hashlib

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User
from app.schemas import TokenData


# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    Uses SHA256 pre-hashing to avoid bcrypt's 72-byte limit.
    """
    # Pre-hash the password with SHA256 to handle any length
    password_hash = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
    
    try:
        return bcrypt.checkpw(password_hash.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt with SHA256 pre-hashing.
    This avoids bcrypt's 72-byte limit while maintaining security.
    """
    # Pre-hash the password with SHA256 to handle any length
    password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    
    # Generate salt and hash with bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_hash.encode('utf-8'), salt)
    
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def generate_verification_token() -> str:
    """Generate a secure random token for email verification"""
    return secrets.token_urlsafe(32)


def generate_reset_token() -> str:
    """Generate a secure random token for password reset"""
    return secrets.token_urlsafe(32)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int = payload.get("user_id")
        email: str = payload.get("email")
        is_admin: bool = payload.get("is_admin", False)
        if user_id is None or email is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id, email=email)
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == token_data.user_id).first()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current verified user"""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email address."
        )
    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current superuser"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


# Admin dependency
async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current admin user"""
    if not (getattr(current_user, "is_admin", False) or getattr(current_user, "is_superuser", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user
