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
    # Path to alembic.ini (in Docker: /app/alembic.ini, locally: api/alembic.ini)
    api_dir = Path(__file__).resolve().parent.parent  # app/ directory
    project_root = api_dir.parent  # Parent of app/ (contains alembic.ini)
    alembic_ini = project_root / "alembic.ini"
    
    if not alembic_ini.exists():
        raise FileNotFoundError(f"Alembic configuration not found: {alembic_ini}")
    
    config = Config(str(alembic_ini))
    return config


def run_migrations():
    """Run pending database migrations"""
    try:
        logger.info("Checking for pending database migrations...")
        config = get_alembic_config()
        
        # Check if schema already exists (created by init SQL scripts)
        from sqlalchemy import create_engine, inspect
        from app.config import settings
        
        engine = create_engine(settings.database_url)
        inspector = inspect(engine)
        
        # Check if tables exist in portfolio schema
        tables_exist = len(inspector.get_table_names(schema='portfolio')) > 0
        
        # Get current migration version
        try:
            with engine.connect() as conn:
                result = conn.execute("SELECT version_num FROM portfolio.alembic_version")
                current_version = result.scalar()
        except:
            current_version = None
        
        # If tables exist but no alembic version, stamp as current
        # (This means schema was created by SQL init scripts)
        if tables_exist and not current_version:
            logger.info("Database schema exists (created by SQL init scripts). Marking as migrated...")
            command.stamp(config, "head")
            logger.info("Database marked as up-to-date")
        else:
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
