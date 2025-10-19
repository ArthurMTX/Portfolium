"""
CRUD operations for users
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models import User
from app.schemas import UserCreate, UserUpdate
from app.auth import get_password_hash, generate_verification_token, generate_reset_token


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID"""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get user by email"""
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Get user by username"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_verification_token(db: Session, token: str) -> Optional[User]:
    """Get user by verification token"""
    return db.query(User).filter(
        User.verification_token == token,
        User.verification_token_expires > datetime.utcnow()
    ).first()


def get_user_by_reset_token(db: Session, token: str) -> Optional[User]:
    """Get user by password reset token"""
    return db.query(User).filter(
        User.reset_password_token == token,
        User.reset_password_token_expires > datetime.utcnow()
    ).first()


def create_user(db: Session, user: UserCreate) -> User:
    """Create a new user"""
    # Generate verification token
    verification_token = generate_verification_token()
    verification_expires = datetime.utcnow() + timedelta(hours=24)
    
    db_user = User(
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        hashed_password=get_password_hash(user.password),
        is_active=True,  # Active but not verified
        is_verified=False,
        # is_admin must not be set via public registration
        verification_token=verification_token,
        verification_token_expires=verification_expires
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user: User, user_update: UserUpdate) -> User:
    """Update user information"""
    update_data = user_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user


def verify_user_email(db: Session, user: User) -> User:
    """Mark user email as verified"""
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    
    db.commit()
    db.refresh(user)
    return user


def create_password_reset_token(db: Session, user: User) -> str:
    """Create a password reset token for user"""
    reset_token = generate_reset_token()
    reset_expires = datetime.utcnow() + timedelta(hours=1)
    
    user.reset_password_token = reset_token
    user.reset_password_token_expires = reset_expires
    
    db.commit()
    return reset_token


def reset_user_password(db: Session, user: User, new_password: str) -> User:
    """Reset user password"""
    user.hashed_password = get_password_hash(new_password)
    user.reset_password_token = None
    user.reset_password_token_expires = None
    
    db.commit()
    db.refresh(user)
    return user


def update_last_login(db: Session, user: User) -> User:
    """Update user's last login timestamp"""
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user: User) -> User:
    """Deactivate user account"""
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


def activate_user(db: Session, user: User) -> User:
    """Activate user account"""
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User) -> None:
    """Delete user account"""
    db.delete(user)
    db.commit()
