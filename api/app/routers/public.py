from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.db import get_db
from app.services.insights import InsightsService
from app.services.metrics import MetricsService
from app.crud import assets as crud_assets
from app.schemas_public import (
    PublicPortfolioInsights,
    PublicPerformanceMetrics,
    PublicRiskMetrics,
    PublicSectorAllocation,
    PublicGeographicAllocation,
    PublicHolding,
    PublicTimeSeriesPoint
)
from app.schemas import PortfolioInsights

router = APIRouter()


@router.get("/portfolio/{share_token}", response_model=PublicPortfolioInsights)
async def get_public_portfolio(
    share_token: str = Path(..., title="The share token of the portfolio", min_length=36, max_length=36),
    db: Session = Depends(get_db)
):
    """
    Get public, read-only portfolio insights by share token.
    Only accessible if the portfolio owner has enabled public sharing.
    Hides sensitive data like amounts, quantities, and costs.
    """
    insights_service = InsightsService(db)
    metrics_service = MetricsService(db)
    
    try:
        # Get portfolio by share token (only if public)
        from app.crud import portfolios as crud_portfolios
        portfolio = crud_portfolios.get_public_portfolio_by_share_token(db, share_token)
        
        if not portfolio:
            # Return generic error to prevent token enumeration
            raise HTTPException(
                status_code=404, 
                detail="Portfolio not found or not publicly shared"
            )
        
        portfolio_id = portfolio.id
        user_id = portfolio.user_id
        
        # Get insights for 1Y period as requested
        full_insights = await insights_service.get_portfolio_insights(
            portfolio_id=portfolio_id,
            user_id=user_id,
            period="1y"
        )
        
        # 2. Get positions for holdings table
        positions = await metrics_service.get_positions(portfolio_id)
        
        # 3. Construct Public Response
        
        # Map Allocations
        sector_allocation = [
            PublicSectorAllocation(sector=s.sector, percentage=s.percentage)
            for s in full_insights.sector_allocation
        ]
        
        geographic_allocation = [
            PublicGeographicAllocation(country=g.country, percentage=g.percentage)
            for g in full_insights.geographic_allocation
        ]
        
        # Map Holdings
        # Calculate total value to compute weights (if not available in positions)
        # positions have market_value
        total_value = sum(p.market_value for p in positions if p.market_value) or 1
        
        holdings = []
        for p in positions:
            if not p.market_value:
                continue
                
            weight_pct = (p.market_value / total_value) * 100
            
            # Get effective metadata (includes user overrides) for the asset
            asset = crud_assets.get_asset(db, p.asset_id)
            if asset:
                effective_data = crud_assets.get_effective_asset_metadata(db, asset, user_id)
                effective_sector = effective_data.get("effective_sector")
                effective_industry = effective_data.get("effective_industry")
                effective_country = effective_data.get("effective_country")
            else:
                effective_sector = p.sector
                effective_industry = p.industry
                effective_country = None
            
            holdings.append(PublicHolding(
                symbol=p.symbol,
                name=p.name,
                sector=effective_sector,
                industry=effective_industry,
                country=effective_country,
                weight_pct=weight_pct,
                asset_type=p.asset_type
            ))
            
        # Sort holdings by weight desc
        holdings.sort(key=lambda x: x.weight_pct, reverse=True)
        
        # Get owner username
        from app.crud import users as crud_users
        owner = crud_users.get_user_by_id(db, user_id)
        owner_username = owner.username if owner else "Unknown"
        
        return PublicPortfolioInsights(
            portfolio_id=portfolio_id,
            portfolio_name=full_insights.portfolio_name,
            owner_username=owner_username,
            as_of_date=full_insights.as_of_date,
            period="1y",
            sector_allocation=sector_allocation,
            geographic_allocation=geographic_allocation,
            holdings=holdings,
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
