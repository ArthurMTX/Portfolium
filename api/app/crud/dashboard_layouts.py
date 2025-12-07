"""
CRUD operations for dashboard layouts
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import DashboardLayout
from app.schemas import DashboardLayoutCreate, DashboardLayoutUpdate


def get_user_layouts(
    db: Session,
    user_id: int,
    portfolio_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100
) -> List[DashboardLayout]:
    """Get all dashboard layouts for a user (layouts are now global across all portfolios)"""
    # Get all layouts for the user (both global and legacy per-portfolio ones)
    # This allows us to show existing layouts while new ones are created as global
    query = db.query(DashboardLayout).filter(
        DashboardLayout.user_id == user_id
    )
    
    return query.order_by(DashboardLayout.updated_at.desc()).offset(skip).limit(limit).all()


def get_layout_by_id(db: Session, layout_id: int, user_id: int) -> Optional[DashboardLayout]:
    """Get a specific dashboard layout by ID (must belong to user)"""
    return db.query(DashboardLayout).filter(
        and_(
            DashboardLayout.id == layout_id,
            DashboardLayout.user_id == user_id
        )
    ).first()


def get_default_layout(
    db: Session,
    user_id: int,
    portfolio_id: Optional[int] = None
) -> Optional[DashboardLayout]:
    """Get the default dashboard layout for a user (global across all portfolios)"""
    # First try to get a global default (portfolio_id = NULL)
    default = db.query(DashboardLayout).filter(
        and_(
            DashboardLayout.user_id == user_id,
            DashboardLayout.portfolio_id == None,
            DashboardLayout.is_default == True
        )
    ).first()
    
    # If no global default, try to get any default (for backward compatibility)
    if not default:
        default = db.query(DashboardLayout).filter(
            and_(
                DashboardLayout.user_id == user_id,
                DashboardLayout.is_default == True
            )
        ).first()
    
    return default


def create_layout(
    db: Session,
    layout: DashboardLayoutCreate,
    user_id: int
) -> DashboardLayout:
    """Create a new dashboard layout (global across all portfolios)"""
    # If setting as default, unset any existing defaults for this user (all layouts, not just global)
    if layout.is_default:
        db.query(DashboardLayout).filter(
            and_(
                DashboardLayout.user_id == user_id,
                DashboardLayout.is_default == True
            )
        ).update({"is_default": False})
    
    # Convert layout_config to dict for storage
    layout_dict = layout.model_dump()
    layout_dict['layout_config'] = layout_dict['layout_config']  # Already a dict from Pydantic
    # Force portfolio_id to None to make layouts global
    layout_dict['portfolio_id'] = None
    
    db_layout = DashboardLayout(
        user_id=user_id,
        **layout_dict
    )
    
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    
    return db_layout


def update_layout(
    db: Session,
    layout_id: int,
    user_id: int,
    layout_update: DashboardLayoutUpdate
) -> Optional[DashboardLayout]:
    """Update an existing dashboard layout"""
    db_layout = get_layout_by_id(db, layout_id, user_id)
    
    if not db_layout:
        return None
    
    # If setting as default, unset any existing defaults for this user (all layouts, not just global)
    if layout_update.is_default and layout_update.is_default != db_layout.is_default:
        db.query(DashboardLayout).filter(
            and_(
                DashboardLayout.user_id == user_id,
                DashboardLayout.is_default == True,
                DashboardLayout.id != layout_id
            )
        ).update({"is_default": False})
    
    # Update fields
    update_data = layout_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_layout, field, value)
    
    db.commit()
    db.refresh(db_layout)
    
    return db_layout


def delete_layout(db: Session, layout_id: int, user_id: int) -> bool:
    """Delete a dashboard layout"""
    db_layout = get_layout_by_id(db, layout_id, user_id)
    
    if not db_layout:
        return False
    
    db.delete(db_layout)
    db.commit()
    
    return True


def duplicate_layout(
    db: Session,
    layout_id: int,
    user_id: int,
    new_name: str
) -> Optional[DashboardLayout]:
    """Duplicate an existing layout with a new name (global across all portfolios)"""
    source_layout = get_layout_by_id(db, layout_id, user_id)
    
    if not source_layout:
        return None
    
    new_layout = DashboardLayout(
        user_id=user_id,
        portfolio_id=None,  # Force NULL to make layout global
        name=new_name,
        description=f"Copy of {source_layout.name}",
        is_default=False,  # Duplicates are never default
        is_shared=False,
        layout_config=source_layout.layout_config
    )
    
    db.add(new_layout)
    db.commit()
    db.refresh(new_layout)
    
    return new_layout
