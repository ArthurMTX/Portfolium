"""
Database migration utilities using Alembic
"""
import logging
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_alembic_config() -> Config:
    """Get Alembic configuration"""
    # Path to alembic.ini
    api_dir = Path(__file__).resolve().parent.parent
    alembic_ini = api_dir / "alembic.ini"
    
    if not alembic_ini.exists():
        raise FileNotFoundError(f"Alembic configuration not found: {alembic_ini}")
    
    config = Config(str(alembic_ini))
    return config


def run_migrations():
    """Run pending database migrations"""
    try:
        logger.info("Checking for pending database migrations...")
        config = get_alembic_config()
        
        # Run migrations to head (latest version)
        command.upgrade(config, "head")
        
        logger.info("Database migrations completed successfully")
    except Exception as e:
        logger.error(f"Error running database migrations: {e}")
        raise


def create_migration(message: str, autogenerate: bool = True):
    """
    Create a new migration revision
    
    Args:
        message: Description of the migration
        autogenerate: Whether to auto-detect schema changes
    """
    try:
        config = get_alembic_config()
        
        if autogenerate:
            command.revision(config, message=message, autogenerate=True)
            logger.info(f"Created auto-generated migration: {message}")
        else:
            command.revision(config, message=message)
            logger.info(f"Created empty migration: {message}")
            
    except Exception as e:
        logger.error(f"Error creating migration: {e}")
        raise


def get_current_revision(db: Session) -> str:
    """Get current database revision"""
    try:
        result = db.execute("SELECT version_num FROM portfolio.alembic_version")
        row = result.fetchone()
        return row[0] if row else None
    except Exception:
        return None


def downgrade_migration(revision: str = "-1"):
    """
    Downgrade database to a previous revision
    
    Args:
        revision: Target revision (default: -1 for one step back)
    """
    try:
        config = get_alembic_config()
        command.downgrade(config, revision)
        logger.info(f"Downgraded database to revision: {revision}")
    except Exception as e:
        logger.error(f"Error downgrading database: {e}")
        raise


def show_migration_history():
    """Show migration history"""
    try:
        config = get_alembic_config()
        command.history(config)
    except Exception as e:
        logger.error(f"Error showing migration history: {e}")
        raise
