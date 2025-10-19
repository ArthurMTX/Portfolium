"""
Admin bootstrap utilities: create or update the administrator account from env
"""
import logging
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User
from app.auth import get_password_hash

logger = logging.getLogger(__name__)


def ensure_admin_user(db: Session) -> None:
    """Create or update the admin user based on environment settings.

    Behavior:
    - If ADMIN_AUTO_CREATE is false, do nothing.
    - If user with ADMIN_EMAIL exists, update username/full_name/flags and optionally password.
      Password is only updated when ADMIN_PASSWORD is set (prevents accidental resets).
    - If not exists and required fields are provided, create the admin user.
    """
    if not settings.ADMIN_AUTO_CREATE:
        logger.info("ADMIN_AUTO_CREATE disabled; skipping admin bootstrap")
        return

    # Validate required values
    if not settings.ADMIN_EMAIL or not settings.ADMIN_USERNAME:
        logger.warning("ADMIN_AUTO_CREATE enabled but ADMIN_EMAIL/ADMIN_USERNAME not set; skipping admin bootstrap")
        return

    admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()

    if admin:
        # Update fields as needed
        changed = False
        if admin.username != settings.ADMIN_USERNAME:
            admin.username = settings.ADMIN_USERNAME
            changed = True
        if settings.ADMIN_FULL_NAME is not None and admin.full_name != settings.ADMIN_FULL_NAME:
            admin.full_name = settings.ADMIN_FULL_NAME
            changed = True
        if admin.is_active != bool(settings.ADMIN_IS_ACTIVE):
            admin.is_active = bool(settings.ADMIN_IS_ACTIVE)
            changed = True
        if admin.is_verified != bool(settings.ADMIN_IS_VERIFIED):
            admin.is_verified = bool(settings.ADMIN_IS_VERIFIED)
            changed = True
        if not admin.is_superuser:
            admin.is_superuser = True
            changed = True
        # Ensure new admin flag
        if not getattr(admin, "is_admin", False):
            admin.is_admin = True
            changed = True
        if settings.ADMIN_PASSWORD:
            admin.hashed_password = get_password_hash(settings.ADMIN_PASSWORD)
            changed = True

        if changed:
            db.commit()
            logger.info("Admin user updated: %s", settings.ADMIN_EMAIL)
        else:
            logger.info("Admin user already up-to-date: %s", settings.ADMIN_EMAIL)
        return

    # Create admin if not exists and password is provided
    if not settings.ADMIN_PASSWORD:
        logger.warning("ADMIN_PASSWORD not set; cannot create admin user")
        return

    admin = User(
        email=settings.ADMIN_EMAIL,
        username=settings.ADMIN_USERNAME,
        full_name=settings.ADMIN_FULL_NAME,
        hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
        is_active=bool(settings.ADMIN_IS_ACTIVE),
        is_verified=bool(settings.ADMIN_IS_VERIFIED),
        is_superuser=True,
        is_admin=True,
    )

    db.add(admin)
    db.commit()
    logger.info("Admin user created: %s", settings.ADMIN_EMAIL)
