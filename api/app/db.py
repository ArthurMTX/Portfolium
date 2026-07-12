"""
Database connection and session management
"""
import time
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

# Create engine
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)


def _query_operation(statement: str) -> str:
    operation = statement.lstrip().split(None, 1)[0].upper() if statement.strip() else "OTHER"
    if operation in {"SELECT", "INSERT", "UPDATE", "DELETE"}:
        return operation.lower()
    return "other"


@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._portfolium_query_started = time.monotonic()


@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    from app.observability.metrics import DB_QUERY_DURATION, DB_SLOW_QUERIES

    started = getattr(context, "_portfolium_query_started", None)
    if started is None:
        return
    duration = time.monotonic() - started
    operation = _query_operation(statement)
    DB_QUERY_DURATION.labels(operation=operation).observe(duration)
    if duration > 1:
        DB_SLOW_QUERIES.labels(operation=operation).inc()

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Session:
    """
    Dependency for getting database session
    
    Usage:
        @app.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """
    Context manager for getting database session in Celery tasks
    
    Usage:
        with get_db_context() as db:
            # Use db session
            pass
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
