"""
Beautiful PDF report generation using HTML/CSS (WeasyPrint) with asset logos
"""
import logging
import io
import base64
import os
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session

from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from jinja2 import Environment, FileSystemLoader

from app.models import User, Portfolio, Transaction, TransactionType
from app.services.metrics import MetricsService
from app.services.logos import fetch_logo_with_validation

logger = logging.getLogger(__name__)


class PDFReportService:
    """Service for generating beautiful HTML-based PDF reports"""
    
    def __init__(self, db: Session):
        self.db = db
        self.metrics_service = MetricsService(db)
        
        # Setup Jinja2 environment
        templates_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
        self.jinja_env = Environment(
            loader=FileSystemLoader(templates_dir),
            autoescape=True
        )
    
    def _get_portfolium_logo_base64(self) -> str:
        """Get Portfolium logo as base64 data URL"""
        import os
        # Try Docker/production path first, then development path
        logo_paths = [
            os.path.join(os.path.dirname(__file__), "..", "..", "static", "logo.png"),
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "web", "public", "favicon-96x96.png"),
        ]
        for path in logo_paths:
            if os.path.exists(path):
                try:
                    with open(path, "rb") as f:
                        logo_bytes = f.read()
                        b64 = base64.b64encode(logo_bytes).decode('utf-8')
                        return f"data:image/png;base64,{b64}"
                except Exception as e:
                    logger.warning(f"Failed to read logo from {path}: {e}")
        logger.warning("Portfolium logo not found in expected paths.")
        return ""
    
    def _get_logo_base64(self, symbol: str, name: Optional[str] = None, asset_type: Optional[str] = None) -> Optional[str]:
        """Get asset logo as base64 data URL"""
        try:
            logo_bytes = fetch_logo_with_validation(symbol, name, asset_type)
            if logo_bytes:
                b64 = base64.b64encode(logo_bytes).decode('utf-8')
                return f"data:image/png;base64,{b64}"
        except Exception as e:
            logger.warning(f"Failed to get logo for {symbol}: {e}")
        return None
    
    async def generate_daily_report(
        self, 
        user_id: int,
        portfolio_id: Optional[int] = None,
        report_date: Optional[date] = None
    ) -> bytes:
        """
        Generate a beautiful HTML-based PDF daily report
        
        Args:
            user_id: User ID
            portfolio_id: Specific portfolio ID (if None, generate for all portfolios)
            report_date: Date for the report (defaults to yesterday)
        
        Returns:
            PDF file as bytes
        """
        if report_date is None:
            report_date = (datetime.utcnow() - timedelta(days=1)).date()
        
        # Get user
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        # Get portfolios
        if portfolio_id:
            portfolios = [self.db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()]
            if not portfolios[0]:
                raise ValueError(f"Portfolio {portfolio_id} not found")
        else:
            portfolios = self.db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
        
        if not portfolios:
            raise ValueError(f"No portfolios found for user {user_id}")
        
        # Build HTML content
        html_content = await self._build_html(user, portfolios, report_date)
        
        # Generate PDF from HTML
        font_config = FontConfiguration()
        html = HTML(string=html_content)
        pdf_bytes = html.write_pdf(font_config=font_config)
        
        return pdf_bytes
    
    async def _build_html(self, user: User, portfolios: List[Portfolio], report_date: date) -> str:
        """Build HTML content for the report using Jinja2 template"""
        
        # Get Portfolium logo
        portfolium_logo = self._get_portfolium_logo_base64()
        
        # Prepare portfolio data
        portfolios_data = []
        for portfolio in portfolios:
            try:
                positions = await self.metrics_service.get_positions(portfolio.id)
                metrics = await self.metrics_service.get_metrics(portfolio.id)
                transactions = self._get_daily_transactions(portfolio.id, report_date)
                
                # Prepare metrics (keep as numbers for template comparisons, format in template)
                metrics_data = {
                    'total_value': float(metrics.total_value),
                    'daily_change_value': float(metrics.daily_change_value or 0),
                    'daily_change_pct': float(metrics.daily_change_pct or 0),
                    'unrealized_pnl': float(metrics.total_unrealized_pnl),
                    'unrealized_pnl_pct': float(metrics.total_unrealized_pnl_pct),
                    'realized_pnl': float(metrics.total_realized_pnl),
                    'dividends': float(metrics.total_dividends)
                }
                
                # Prepare heatmap
                heatmap_data = self._prepare_heatmap_data(positions)
                
                # Prepare positions
                positions_data = self._prepare_positions_data(positions)
                
                # Prepare transactions
                transactions_data = self._prepare_transactions_data(transactions, portfolio.base_currency)
                
                portfolios_data.append({
                    'name': portfolio.name,
                    'currency': portfolio.base_currency,
                    'metrics': metrics_data,
                    'heatmap': heatmap_data,
                    'positions': positions_data,
                    'transactions': transactions_data,
                    'error': None
                })
            except Exception as e:
                logger.error(f"Error generating report for portfolio {portfolio.id}: {e}")
                portfolios_data.append({
                    'name': portfolio.name,
                    'error': str(e)
                })
        
        # Render template
        template = self.jinja_env.get_template('pdf/daily_report.html')
        html_content = template.render(
            portfolium_logo=portfolium_logo,
            report_date=report_date.strftime('%B %d, %Y'),
            user_name=user.full_name or user.username,
            portfolios=portfolios_data,
            generation_time=datetime.utcnow().strftime('%Y-%m-%d at %H:%M')
        )
        
        return html_content
    
    def _prepare_heatmap_data(self, positions) -> Optional[List[dict]]:
        """Prepare heatmap data for template"""
        try:
            # Filter positions with daily change data
            positions_with_data = [
                p for p in positions 
                if p.daily_change_pct is not None and p.market_value is not None and p.market_value > 0
            ]
            
            if not positions_with_data:
                return None
            
            # Sort by market value
            positions_with_data.sort(key=lambda x: float(x.market_value or 0), reverse=True)
            
            # Calculate percentages
            total_value = sum(float(p.market_value) for p in positions_with_data)
            
            heatmap_data = []
            for p in positions_with_data:
                value = float(p.market_value or 0)
                percentage = (value / total_value * 100) if total_value > 0 else 0
                daily_pct = float(p.daily_change_pct) if p.daily_change_pct else 0
                
                # Get color class based on performance
                if daily_pct <= -20: color_class = "bg-red-900"
                elif daily_pct <= -15: color_class = "bg-red-800"
                elif daily_pct <= -10: color_class = "bg-red-700"
                elif daily_pct <= -5: color_class = "bg-red-600"
                elif daily_pct < 0: color_class = "bg-red-500"
                elif daily_pct == 0: color_class = "bg-neutral-300"
                elif daily_pct < 5: color_class = "bg-green-500"
                elif daily_pct < 10: color_class = "bg-green-600"
                elif daily_pct < 15: color_class = "bg-green-700"
                elif daily_pct < 20: color_class = "bg-green-800"
                else: color_class = "bg-green-900"
                
                # Determine grid span based on percentage
                if percentage >= 25: col_span = "col-span-6"
                elif percentage >= 15: col_span = "col-span-4"
                elif percentage >= 8: col_span = "col-span-3"
                elif percentage >= 4: col_span = "col-span-2"
                else: col_span = "col-span-2"
                
                heatmap_data.append({
                    'symbol': p.symbol,
                    'logo_url': self._get_logo_base64(p.symbol, p.name, p.asset_type),
                    'color_class': color_class,
                    'col_span': col_span,
                    'percentage': f"{percentage:.1f}",
                    'daily_pct': f"{daily_pct:+.1f}"
                })
            
            return heatmap_data
        except Exception as e:
            logger.error(f"Error preparing heatmap data: {e}")
            return None
    
    def _prepare_positions_data(self, positions) -> List[dict]:
        """Prepare positions data for template"""
        if not positions:
            return []
        
        positions_data = []
        for p in positions:
            positions_data.append({
                'symbol': p.symbol,
                'name': p.name,
                'logo_url': self._get_logo_base64(p.symbol, p.name, p.asset_type),
                'quantity': float(p.quantity),
                'avg_cost': float(p.avg_cost),
                'current_price': float(p.current_price or 0),
                'market_value': float(p.market_value or 0),
                'unrealized_pnl_pct': float(p.unrealized_pnl_pct),
                'daily_change_pct': float(p.daily_change_pct) if p.daily_change_pct else None
            })
        
        return positions_data
    
    def _prepare_transactions_data(self, transactions: List[Transaction], currency: str) -> List[dict]:
        """Prepare transactions data for template"""
        if not transactions:
            return []
        
        transactions_data = []
        for tx in transactions:
            symbol = tx.asset.symbol if tx.asset else 'N/A'
            total = float(tx.quantity * tx.price)
            
            # Get logo
            logo_url = self._get_logo_base64(
                symbol, 
                tx.asset.name if tx.asset else None, 
                tx.asset.asset_type if tx.asset else None
            )
            
            # Transaction type with emoji
            if tx.type == TransactionType.BUY:
                type_display = '<span style="color: #10B981;">🟢 BUY</span>'
            elif tx.type == TransactionType.SELL:
                type_display = '<span style="color: #DC2626;">🔴 SELL</span>'
            else:
                type_display = tx.type.value
            
            transactions_data.append({
                'symbol': symbol,
                'logo_url': logo_url,
                'type_display': type_display,
                'quantity': f"{float(tx.quantity):.4f}",
                'price': f"{float(tx.price):.2f}",
                'total': f"{total:,.2f}",
                'fees': f"{float(tx.fees):.2f}"
            })
        
        return transactions_data
    
    def _get_daily_transactions(self, portfolio_id: int, report_date: date) -> List[Transaction]:
        """Get transactions from the report date"""
        return (
            self.db.query(Transaction)
            .filter(
                Transaction.portfolio_id == portfolio_id,
                Transaction.tx_date == report_date
            )
            .order_by(Transaction.created_at.desc())
            .all()
        )
    
    def _build_heatmap_html_old(self, positions) -> Optional[str]:
        """Build heatmap HTML exactly like the website"""
        try:
            # Filter positions with daily change data
            positions_with_data = [
                p for p in positions 
                if p.daily_change_pct is not None and p.market_value is not None and p.market_value > 0
            ]
            
            if not positions_with_data:
                return None
            
            # Sort by market value
            positions_with_data.sort(key=lambda x: float(x.market_value or 0), reverse=True)
            # Show all positions (no limit) for PDF
            # positions_with_data = positions_with_data[:20]  # Removed limit
            
            # Calculate percentages
            total_value = sum(float(p.market_value) for p in positions_with_data)
            
            tiles_html = ""
            for p in positions_with_data:
                value = float(p.market_value or 0)
                percentage = (value / total_value * 100) if total_value > 0 else 0
                daily_pct = float(p.daily_change_pct) if p.daily_change_pct else 0
                
                # Get color class based on performance (same as website)
                if daily_pct <= -20: color_class = "bg-red-900"
                elif daily_pct <= -15: color_class = "bg-red-800"
                elif daily_pct <= -10: color_class = "bg-red-700"
                elif daily_pct <= -5: color_class = "bg-red-600"
                elif daily_pct < 0: color_class = "bg-red-500"
                elif daily_pct == 0: color_class = "bg-neutral-300"
                elif daily_pct < 5: color_class = "bg-green-500"
                elif daily_pct < 10: color_class = "bg-green-600"
                elif daily_pct < 15: color_class = "bg-green-700"
                elif daily_pct < 20: color_class = "bg-green-800"
                else: color_class = "bg-green-900"
                
                # Determine grid span based on percentage (adjusted for more tiles)
                if percentage >= 25: col_span = "col-span-6"
                elif percentage >= 15: col_span = "col-span-4"
                elif percentage >= 8: col_span = "col-span-3"
                elif percentage >= 4: col_span = "col-span-2"
                else: col_span = "col-span-2"
                
                # Get logo
                logo_url = self._get_logo_base64(p.symbol, p.name, p.asset_type)
                logo_html = f'<img class="tile-logo" src="{logo_url}" alt="{p.symbol}">' if logo_url else ""
                
                tiles_html += f"""
            <div class="heatmap-tile {color_class} {col_span}">
                <div class="tile-header">
                    {logo_html}
                    <span class="tile-symbol">{p.symbol}</span>
                </div>
                <div class="tile-footer">
                    {percentage:.1f}% | {daily_pct:+.1f}%
                </div>
            </div>
"""
            
            return f'<div class="heatmap">{tiles_html}</div>'
            
        except Exception as e:
            logger.error(f"Error building heatmap: {e}")
            return None
    
    def _build_holdings_table_html_old(self, positions, currency: str) -> str:
        """Build holdings table with logos and colored P&L"""
        if not positions:
            return '<div class="no-data">No holdings found.</div>'
        
        rows_html = ""
        for p in positions:
            # Get logo
            logo_url = self._get_logo_base64(p.symbol, p.name, p.asset_type)
            logo_html = f'<img class="asset-logo" src="{logo_url}" alt="{p.symbol}">' if logo_url else ""
            
            # Color classes for P&L
            pnl_class = "text-green" if (p.unrealized_pnl_pct or 0) >= 0 else "text-red"
            daily_class = "text-green" if (p.daily_change_pct or 0) >= 0 else "text-red"
            
            rows_html += f"""
        <tr>
            <td>
                <div class="asset-cell">
                    {logo_html}
                    <div class="asset-info">
                        <div class="asset-symbol">{p.symbol}</div>
                        {f'<div class="asset-name">{p.name}</div>' if p.name else ''}
                    </div>
                </div>
            </td>
            <td class="text-right">{float(p.quantity):.4f}</td>
            <td class="text-right">{float(p.avg_cost):.2f}</td>
            <td class="text-right">{float(p.current_price or 0):.2f}</td>
            <td class="text-right">{float(p.market_value or 0):,.2f}</td>
            <td class="text-right {pnl_class}">{float(p.unrealized_pnl_pct):+.2f}%</td>
            <td class="text-right {daily_class}">{f'{float(p.daily_change_pct):+.2f}%' if p.daily_change_pct else 'N/A'}</td>
        </tr>
"""
        
        return f"""
        <table>
            <thead>
                <tr>
                    <th>Asset</th>
                    <th class="text-right">Quantity</th>
                    <th class="text-right">Avg Cost</th>
                    <th class="text-right">Current</th>
                    <th class="text-right">Value</th>
                    <th class="text-right">P&L %</th>
                    <th class="text-right">Daily Δ%</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
"""
    
    def _build_transactions_html_old(self, transactions: List[Transaction], currency: str, report_date: date) -> str:
        """Build transactions section"""
        if not transactions:
            return f'<div class="no-data">✨ No transactions recorded on {report_date.strftime("%B %d, %Y")}.</div>'
        
        rows_html = ""
        for tx in transactions:
            symbol = tx.asset.symbol if tx.asset else 'N/A'
            total = float(tx.quantity * tx.price)
            
            # Get logo
            logo_url = self._get_logo_base64(symbol, tx.asset.name if tx.asset else None, tx.asset.asset_type if tx.asset else None)
            logo_html = f'<img class="asset-logo" src="{logo_url}" alt="{symbol}">' if logo_url else ""
            
            # Transaction type with emoji
            if tx.type == TransactionType.BUY:
                tx_type_display = '<span style="color: #10B981;">🟢 BUY</span>'
            elif tx.type == TransactionType.SELL:
                tx_type_display = '<span style="color: #DC2626;">🔴 SELL</span>'
            else:
                tx_type_display = tx.type.value
            
            rows_html += f"""
        <tr>
            <td>
                <div class="asset-cell">
                    {logo_html}
                    <div class="asset-symbol">{symbol}</div>
                </div>
            </td>
            <td class="text-center">{tx_type_display}</td>
            <td class="text-right">{float(tx.quantity):.4f}</td>
            <td class="text-right">{float(tx.price):.2f}</td>
            <td class="text-right">{total:,.2f}</td>
            <td class="text-right">{float(tx.fees):.2f}</td>
        </tr>
"""
        
        return f"""
        <table>
            <thead>
                <tr>
                    <th>Asset</th>
                    <th class="text-center">Type</th>
                    <th class="text-right">Quantity</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Total</th>
                    <th class="text-right">Fees</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
"""


# Singleton instance
def get_pdf_report_service(db: Session) -> PDFReportService:
    """Get PDF report service instance"""
    return PDFReportService(db)
