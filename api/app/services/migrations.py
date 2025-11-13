"""
Database migration utilities using Alembic
"""
import logging
import os
import subprocess
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
    """Run pending database migrations using Alembic CLI"""
    import sys
    
    try:
        logger.info("Checking for pending database migrations...")
        sys.stdout.flush()
        
        from sqlalchemy import create_engine, inspect, text
        from app.config import settings
        
        # Quick check if schema exists
        engine = create_engine(settings.database_url)
        inspector = inspect(engine)
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'portfolio'"))
            schema_exists = result.fetchone() is not None
        
        logger.info(f"Portfolio schema exists: {schema_exists}")
        sys.stdout.flush()
        
        # Clean up check connection
        engine.dispose()
        
        # Run alembic via CLI subprocess - this avoids hanging issues
        logger.info("Running Alembic migrations via CLI...")
        sys.stdout.flush()
        
        # Get path to alembic executable and config
        api_dir = Path(__file__).resolve().parent.parent.parent  # Go up to api/ directory
        alembic_ini = api_dir / "alembic.ini"
        
        # Run alembic upgrade head
        result = subprocess.run(
            ["alembic", "-c", str(alembic_ini), "upgrade", "head"],
            cwd=str(api_dir),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        # Log output
        if result.stdout:
            for line in result.stdout.splitlines():
                logger.info(f"  {line}")
        if result.stderr:
            for line in result.stderr.splitlines():
                logger.warning(f"  {line}")
        
        if result.returncode != 0:
            logger.error(f"Alembic migration failed with code {result.returncode}")
            sys.stdout.flush()
            raise RuntimeError(f"Migration failed: {result.stderr}")
        
        logger.info("Database migrations completed successfully")
        sys.stdout.flush()
            
    except subprocess.TimeoutExpired:
        logger.error("Migration timed out after 30 seconds!")
        sys.stdout.flush()
        raise
    except Exception as e:
        logger.error(f"✗ Error running database migrations: {e}")
        sys.stdout.flush()
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
