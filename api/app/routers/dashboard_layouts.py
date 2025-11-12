"""
Dashboard layouts API endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.auth import get_current_user
from app.models import User
from app.schemas import (
    DashboardLayoutCreate,
    DashboardLayoutUpdate,
    DashboardLayoutResponse,
    DashboardLayoutExport
)
from app.crud import dashboard_layouts as crud

router = APIRouter(prefix="/dashboard-layouts", tags=["dashboard-layouts"])


@router.get("/", response_model=List[DashboardLayoutResponse])
def list_layouts(
    portfolio_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all dashboard layouts for the current user.
    Optionally filter by portfolio_id.
    """
    return crud.get_user_layouts(db, current_user.id, portfolio_id)


@router.get("/default", response_model=DashboardLayoutResponse | None)
def get_default_layout(
    portfolio_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the default dashboard layout for the current user and portfolio.
    Returns null if no default is set.
    """
    layout = crud.get_default_layout(db, current_user.id, portfolio_id)
    return layout


@router.get("/{layout_id}", response_model=DashboardLayoutResponse)
def get_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific dashboard layout by ID"""
    layout = crud.get_layout_by_id(db, layout_id, current_user.id)
    
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard layout not found"
        )
    
    return layout


@router.post("/", response_model=DashboardLayoutResponse, status_code=status.HTTP_201_CREATED)
def create_layout(
    layout: DashboardLayoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new dashboard layout"""
    try:
        return crud.create_layout(db, layout, current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create layout: {str(e)}"
        )


@router.put("/{layout_id}", response_model=DashboardLayoutResponse)
def update_layout(
    layout_id: int,
    layout_update: DashboardLayoutUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing dashboard layout"""
    updated_layout = crud.update_layout(db, layout_id, current_user.id, layout_update)
    
    if not updated_layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard layout not found"
        )
    
    return updated_layout


@router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a dashboard layout"""
    success = crud.delete_layout(db, layout_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard layout not found"
        )
    
    return None


@router.post("/{layout_id}/duplicate", response_model=DashboardLayoutResponse, status_code=status.HTTP_201_CREATED)
def duplicate_layout(
    layout_id: int,
    new_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Duplicate an existing layout with a new name"""
    new_layout = crud.duplicate_layout(db, layout_id, current_user.id, new_name)
    
    if not new_layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source layout not found"
        )
    
    return new_layout


@router.get("/{layout_id}/export", response_model=DashboardLayoutExport)
def export_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export a dashboard layout as JSON for sharing or backup.
    This format can be imported by any user.
    """
    layout = crud.get_layout_by_id(db, layout_id, current_user.id)
    
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard layout not found"
        )
    
    return DashboardLayoutExport(
        name=layout.name,
        description=layout.description,
        layout_config=layout.layout_config
    )


@router.post("/import", response_model=DashboardLayoutResponse, status_code=status.HTTP_201_CREATED)
def import_layout(
    layout_export: DashboardLayoutExport,
    portfolio_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import a dashboard layout from exported JSON.
    Creates a new layout for the current user.
    """
    try:
        # Create a new layout from the imported data (global across all portfolios)
        layout_create = DashboardLayoutCreate(
            name=layout_export.name,
            description=layout_export.description or f"Imported on {layout_export.exported_at}",
            portfolio_id=None,  # Force NULL to make layout global
            is_default=False,
            is_shared=False,
            layout_config=layout_export.layout_config
        )
        
        return crud.create_layout(db, layout_create, current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to import layout: {str(e)}"
        )
