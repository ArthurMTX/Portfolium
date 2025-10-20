"""
Authentication routes - Register, Login, Verify Email, Password Reset
"""
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth import (
    verify_password, 
    create_access_token, 
    get_current_user,
    get_current_active_user
)
from app.config import settings
from app.db import get_db
from app.models import User
from app.schemas import (
    UserCreate, 
    UserLogin, 
    User as UserSchema, 
    Token,
    UserPasswordReset,
    UserPasswordResetConfirm,
    UserPasswordChange,
    UserUpdate
)
from app.crud import users as crud_users
from app.services.email import email_service
from app.services.notifications import notification_service


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register(
    user_create: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Register a new user account
    
    - Creates a new user with email and password
    - Sends verification email
    - User must verify email before full access
    """
    # Check if email already exists
    if crud_users.get_user_by_email(db, user_create.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    if crud_users.get_user_by_username(db, user_create.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create user
    user = crud_users.create_user(db, user_create)
    
    # Send verification email in background
    background_tasks.add_task(
        email_service.send_verification_email,
        user.email,
        user.username,
        user.verification_token
    )
    
    logger.info(f"New user registered: {user.email}")
    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    Login with email and password
    
    - Returns JWT access token
    - Updates last login timestamp
    - Creates login notification with IP tracking
    """
    # Get user by email (username field contains email)
    user = crud_users.get_user_by_email(db, form_data.username)
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "is_admin": user.is_admin
        },
        expires_delta=access_token_expires
    )
    
    # Update last login
    crud_users.update_last_login(db, user)
    
    # Get IP address and user agent
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", None)
    
    # Create login notification in background
    background_tasks.add_task(
        notification_service.create_login_notification,
        db,
        user.id,
        client_ip,
        user_agent
    )
    
    logger.info(f"User logged in: {user.email} from IP {client_ip}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current authenticated user information"""
    return current_user


@router.put("/me", response_model=UserSchema)
async def update_current_user(
    user_update: UserUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update current authenticated user's profile information.

    - Allows updating full_name, username, and email
    - On email change, marks account as unverified and sends a new verification email
    - Validates uniqueness for email and username
    """
    changed_email = False

    # Validate and apply username change
    if user_update.username and user_update.username != current_user.username:
        # Ensure username is unique
        if crud_users.get_user_by_username(db, user_update.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        current_user.username = user_update.username

    # Validate and apply email change
    if user_update.email and user_update.email != current_user.email:
        # Ensure email is unique
        if crud_users.get_user_by_email(db, user_update.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        # Update email and mark unverified
        current_user.email = user_update.email
        current_user.is_verified = False

        # Generate a new verification token
        from datetime import datetime, timedelta
        from app.auth import generate_verification_token

        current_user.verification_token = generate_verification_token()
        current_user.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
        changed_email = True

    # Apply full_name change if provided
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name

    # Persist changes
    db.commit()
    db.refresh(current_user)

    # If email changed, send a new verification email in background
    if changed_email:
        background_tasks.add_task(
            email_service.send_verification_email,
            current_user.email,
            current_user.username,
            current_user.verification_token or ""
        )

    return current_user


@router.post("/verify-email")
async def verify_email(
    token: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Verify user email address
    
    - Validates verification token
    - Marks email as verified
    - Sends welcome email
    """
    user = crud_users.get_user_by_verification_token(db, token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Verify email
    crud_users.verify_user_email(db, user)
    
    # Send welcome email in background
    background_tasks.add_task(
        email_service.send_welcome_email,
        user.email,
        user.username
    )
    
    logger.info(f"Email verified for user: {user.email}")
    
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Resend verification email
    
    - Generates new verification token
    - Sends new verification email
    """
    user = crud_users.get_user_by_email(db, email)
    
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a verification email has been sent"}
    
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    # Generate new verification token
    from datetime import datetime, timedelta
    from app.auth import generate_verification_token
    
    user.verification_token = generate_verification_token()
    user.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
    db.commit()
    
    # Send verification email in background
    background_tasks.add_task(
        email_service.send_verification_email,
        user.email,
        user.username,
        user.verification_token
    )
    
    logger.info(f"Verification email resent to: {user.email}")
    
    return {"message": "Verification email sent"}


@router.post("/forgot-password")
async def forgot_password(
    password_reset: UserPasswordReset,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Request password reset
    
    - Generates reset token
    - Sends password reset email
    """
    user = crud_users.get_user_by_email(db, password_reset.email)
    
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a password reset email has been sent"}
    
    # Create reset token
    reset_token = crud_users.create_password_reset_token(db, user)
    
    # Send password reset email in background
    background_tasks.add_task(
        email_service.send_password_reset_email,
        user.email,
        user.username,
        reset_token
    )
    
    logger.info(f"Password reset requested for: {user.email}")
    
    return {"message": "Password reset email sent"}


@router.post("/reset-password")
async def reset_password(
    password_reset_confirm: UserPasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Reset password with token
    
    - Validates reset token
    - Updates password
    """
    user = crud_users.get_user_by_reset_token(db, password_reset_confirm.token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Reset password
    crud_users.reset_user_password(db, user, password_reset_confirm.new_password)
    
    logger.info(f"Password reset for user: {user.email}")
    
    return {"message": "Password reset successfully"}


@router.post("/change-password")
async def change_password(
    password_change: UserPasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change password (requires authentication)
    
    - Verifies current password
    - Updates to new password
    """
    # Verify current password
    if not verify_password(password_change.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # Update password
    crud_users.reset_user_password(db, current_user, password_change.new_password)
    
    logger.info(f"Password changed for user: {current_user.email}")
    
    return {"message": "Password changed successfully"}


@router.delete("/account")
async def delete_account(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete user account (requires authentication)
    
    - Permanently deletes user and all associated data
    """
    crud_users.delete_user(db, current_user)
    
    logger.info(f"Account deleted for user: {current_user.email}")
    
    return {"message": "Account deleted successfully"}
