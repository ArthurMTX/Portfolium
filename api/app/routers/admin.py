"""
Admin and maintenance endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db

router = APIRouter(prefix="/admin")


@router.delete("/data")
def delete_all_data(db: Session = Depends(get_db)):
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
