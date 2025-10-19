"""
Admin and maintenance endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.auth import get_password_hash
from app.auth import get_current_admin_user
from app.models import User
from app.schemas import AdminUserCreate, AdminUserUpdate, User as UserSchema
from app.config import settings

router = APIRouter(prefix="/admin")


@router.delete("/data")
def delete_all_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Danger: Delete all user data (transactions, prices, portfolios, assets)

    Returns counts of deleted rows. This operation is irreversible.
    """
    try:
        # Count existing rows before deletion
        counts = {}
        for table in ["transactions", "prices", "portfolios", "assets"]:
            result = db.execute(text(f"SELECT COUNT(*) FROM portfolio.{table}"))
            counts[table] = int(result.scalar() or 0)

        # Truncate all tables, reset identities, and cascade
        db.execute(
            text(
                "TRUNCATE TABLE \n"
                "  portfolio.transactions,\n"
                "  portfolio.prices,\n"
                "  portfolio.portfolios,\n"
                "  portfolio.assets\n"
                "RESTART IDENTITY CASCADE"
            )
        )
        db.commit()

        return {
            "success": True,
            "message": "All data deleted successfully",
            "deleted": counts,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete data: {str(e)}",
        )
@router.get("/users", response_model=list[UserSchema])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """List all users (admin only)"""
    users = db.query(User).order_by(User.id.asc()).all()
    return users


@router.post("/users", response_model=UserSchema, status_code=201)
def create_user_admin(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new user (admin only)"""
    if db.query(User).filter((User.email == payload.email) | (User.username == payload.username)).first():
        raise HTTPException(status_code=400, detail="Email or username already exists")
    new_user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        is_active=payload.is_active,
        is_verified=payload.is_verified,
        is_admin=payload.is_admin,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/users/{user_id}", response_model=UserSchema)
def update_user_admin(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update user status or admin flag (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Protect the first/primary admin account from deactivation or admin revocation
    def is_protected_first_admin(u: User) -> bool:
        try:
            if settings.ADMIN_EMAIL and u.email == settings.ADMIN_EMAIL:
                return True
        except Exception:
            # settings might not be fully available in all contexts; ignore
            pass
        first_admin = (
            db.query(User)
            .filter((User.is_admin == True) | (User.is_superuser == True))
            .order_by(User.id.asc())
            .first()
        )
        return bool(first_admin and first_admin.id == u.id)

    if is_protected_first_admin(user):
        incoming = payload.model_dump(exclude_unset=True)
        if 'is_admin' in incoming and incoming['is_admin'] is False:
            raise HTTPException(status_code=400, detail="Cannot revoke admin from the first admin account")
        if 'is_active' in incoming and incoming['is_active'] is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate the first admin account")
    data = payload.model_dump(exclude_unset=True)
    # Duplicate checks for email/username if they are being changed
    new_email = data.get('email')
    if new_email and new_email != user.email:
        existing = db.query(User).filter(User.email == new_email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    new_username = data.get('username')
    if new_username and new_username != user.username:
        existing = db.query(User).filter(User.username == new_username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already in use")
    if 'password' in data and data['password']:
        user.hashed_password = get_password_hash(data.pop('password'))
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Also protect the first/primary admin from deletion
    def is_protected_first_admin(u: User) -> bool:
        try:
            if settings.ADMIN_EMAIL and u.email == settings.ADMIN_EMAIL:
                return True
        except Exception:
            pass
        first_admin = (
            db.query(User)
            .filter((User.is_admin == True) | (User.is_superuser == True))
            .order_by(User.id.asc())
            .first()
        )
        return bool(first_admin and first_admin.id == u.id)

    if is_protected_first_admin(user):
        raise HTTPException(status_code=400, detail="Cannot delete the first admin account")
    db.delete(user)
    db.commit()
    return


# Removed raw environment management endpoints for security
    """
    Danger: Delete all user data (transactions, prices, portfolios, assets)

    Returns counts of deleted rows. This operation is irreversible.
    """
    try:
        # Count existing rows before deletion
        counts = {}
        for table in ["transactions", "prices", "portfolios", "assets"]:
            result = db.execute(text(f"SELECT COUNT(*) FROM portfolio.{table}"))
            counts[table] = int(result.scalar() or 0)

        # Truncate all tables, reset identities, and cascade
        db.execute(
            text(
                "TRUNCATE TABLE \n"
                "  portfolio.transactions,\n"
                "  portfolio.prices,\n"
                "  portfolio.portfolios,\n"
                "  portfolio.assets\n"
                "RESTART IDENTITY CASCADE"
            )
        )
        db.commit()

        return {
            "success": True,
            "message": "All data deleted successfully",
            "deleted": counts,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete data: {str(e)}",
        )
