"""
Beautiful PDF report generation using HTML/CSS (WeasyPrint) with asset logos
"""
import logging
import io
import base64
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session

from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

from app.models import User, Portfolio, Transaction, TransactionType
from app.services.metrics import MetricsService
from app.services.logos import fetch_logo_with_validation

logger = logging.getLogger(__name__)


class PDFReportService:
    """Service for generating beautiful HTML-based PDF reports"""
    
    def __init__(self, db: Session):
        self.db = db
        self.metrics_service = MetricsService(db)
    
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
        """Build HTML content for the report"""
        
        # Start HTML
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Daily Portfolio Report - {report_date.strftime('%B %d, %Y')}</title>
    <style>
        @page {{
            size: A4;
            margin: 1cm;
        }}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            color: #1F2937;
            line-height: 1.5;
            background: #ffffff;
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #ec4899;
        }}
        
        .title {{
            font-size: 32px;
            font-weight: bold;
            color: #db2777;
            margin-bottom: 8px;
        }}
        
        .subtitle {{
            font-size: 14px;
            color: #6B7280;
        }}
        
        .portfolio-section {{
            margin-bottom: 40px;
            page-break-inside: avoid;
        }}
        
        .portfolio-header {{
            font-size: 22px;
            font-weight: bold;
            color: #ec4899;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #F3F4F6;
        }}
        
        /* Metrics Cards */
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }}
        
        .metric-card {{
            background: #F9FAFB;
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            padding: 12px 10px;
            text-align: center;
            min-height: 70px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }}
        
        .metric-label {{
            font-size: 9px;
            color: #6B7280;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 6px;
            line-height: 1.2;
        }}
        
        .metric-value {{
            font-size: 16px;
            font-weight: bold;
            line-height: 1.3;
            margin: 4px 0;
        }}
        
        .metric-value.pink {{ color: #ec4899; }}
        .metric-value.green {{ color: #10B981; }}
        .metric-value.red {{ color: #DC2626; }}
        .metric-value.purple {{ color: #8B5CF6; }}
        
        .metric-subvalue {{
            font-size: 9px;
            color: #6B7280;
            margin-top: 4px;
            line-height: 1.2;
        }}
        
        /* Section Headers */
        .section-header {{
            font-size: 18px;
            font-weight: bold;
            color: #ec4899;
            margin: 25px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #F3F4F6;
        }}
        
        /* Heatmap */
        .heatmap {{
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 2px;
            margin-bottom: 25px;
            width: 100%;
            max-width: 100%;
        }}
        
        .heatmap-tile {{
            border-radius: 3px;
            padding: 5px 4px;
            color: white;
            font-weight: bold;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 45px;
            overflow: visible;
            box-sizing: border-box;
        }}
        
        .tile-header {{
            display: flex;
            align-items: center;
            gap: 3px;
            margin-bottom: 2px;
            flex-wrap: nowrap;
        }}
        
        .tile-logo {{
            width: 18px;
            height: 18px;
            object-fit: contain;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
            padding: 1px;
            flex-shrink: 0;
        }}
        
        .tile-symbol {{
            font-size: 10px;
            font-weight: bold;
            line-height: 1.1;
            flex: 1;
            min-width: 0;
        }}
        
        .tile-footer {{
            font-size: 7px;
            opacity: 0.95;
            line-height: 1.3;
            white-space: nowrap;
        }}
        
        /* Color scale matching website */
        .bg-red-900 {{ background: #7f1d1d; }}
        .bg-red-800 {{ background: #991b1b; }}
        .bg-red-700 {{ background: #b91c1c; }}
        .bg-red-600 {{ background: #dc2626; }}
        .bg-red-500 {{ background: #ef4444; }}
        .bg-neutral-300 {{ background: #d1d5db; color: #374151; }}
        .bg-green-500 {{ background: #10b981; }}
        .bg-green-600 {{ background: #059669; }}
        .bg-green-700 {{ background: #047857; }}
        .bg-green-800 {{ background: #065f46; }}
        .bg-green-900 {{ background: #064e3b; }}
        
        /* Grid spans */
        .col-span-2 {{ grid-column: span 2; }}
        .col-span-3 {{ grid-column: span 3; }}
        .col-span-4 {{ grid-column: span 4; }}
        .col-span-6 {{ grid-column: span 6; }}
        
        /* Tables */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            font-size: 11px;
        }}
        
        th {{
            background: #ec4899;
            color: white;
            font-weight: bold;
            text-align: left;
            padding: 10px 8px;
            font-size: 11px;
        }}
        
        td {{
            padding: 8px;
            border-bottom: 1px solid #E5E7EB;
        }}
        
        tr:nth-child(even) {{
            background: #F9FAFB;
        }}
        
        tr:hover {{
            background: #F3F4F6;
        }}
        
        .text-right {{
            text-align: right;
        }}
        
        .text-center {{
            text-align: center;
        }}
        
        .text-green {{
            color: #059669;
            font-weight: bold;
        }}
        
        .text-red {{
            color: #DC2626;
            font-weight: bold;
        }}
        
        .asset-cell {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        
        .asset-logo {{
            width: 28px;
            height: 28px;
            object-fit: contain;
            border-radius: 4px;
        }}
        
        .asset-info {{
            display: flex;
            flex-direction: column;
        }}
        
        .asset-symbol {{
            font-weight: bold;
            font-size: 12px;
        }}
        
        .asset-name {{
            font-size: 9px;
            color: #6B7280;
        }}
        
        /* No transactions message */
        .no-data {{
            text-align: center;
            padding: 30px;
            background: #F9FAFB;
            border-radius: 8px;
            color: #6B7280;
            font-size: 13px;
        }}
        
        /* Footer */
        .footer {{
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #F3F4F6;
            color: #9CA3AF;
            font-size: 10px;
        }}
        
        .footer .dot {{
            color: #ec4899;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">📊 Daily Portfolio Report</div>
        <div class="subtitle">{report_date.strftime('%B %d, %Y')} • {user.full_name or user.username}</div>
    </div>
"""
        
        # Generate content for each portfolio
        for portfolio in portfolios:
            try:
                positions = await self.metrics_service.get_positions(portfolio.id)
                metrics = await self.metrics_service.get_metrics(portfolio.id)
                
                html += f"""
    <div class="portfolio-section">
        <div class="portfolio-header">💼 {portfolio.name}</div>
        
        <!-- Metrics Cards -->
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">💰 Total Value</div>
                <div class="metric-value pink">{portfolio.base_currency} {float(metrics.total_value):,.2f}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">📊 Daily Gain</div>
                <div class="metric-value {'green' if (metrics.daily_change_value or 0) >= 0 else 'red'}">
                    {portfolio.base_currency} {float(metrics.daily_change_value or 0):+,.2f}
                </div>
                <div class="metric-subvalue">
                    {float(metrics.daily_change_pct or 0):+.2f}%
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">💎 Unrealized P&L</div>
                <div class="metric-value {'green' if metrics.total_unrealized_pnl >= 0 else 'red'}">
                    {portfolio.base_currency} {float(metrics.total_unrealized_pnl):+,.2f}
                </div>
                <div class="metric-subvalue">
                    {float(metrics.total_unrealized_pnl_pct):+.2f}%
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">📈 P&L %</div>
                <div class="metric-value {'green' if metrics.total_unrealized_pnl_pct >= 0 else 'red'}">
                    {float(metrics.total_unrealized_pnl_pct):+.2f}%
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">🎯 Realized P&L</div>
                <div class="metric-value {'green' if metrics.total_realized_pnl >= 0 else 'red'}">
                    {portfolio.base_currency} {float(metrics.total_realized_pnl):+,.2f}
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">💵 Dividends</div>
                <div class="metric-value purple">{portfolio.base_currency} {float(metrics.total_dividends):,.2f}</div>
            </div>
        </div>
"""
                
                # Heatmap
                if positions:
                    heatmap_html = self._build_heatmap_html(positions)
                    if heatmap_html:
                        html += f"""
        <div class="section-header">📈 Daily Performance Heatmap</div>
        {heatmap_html}
"""
                
                # Holdings table
                html += f"""
        <div class="section-header">💎 Holdings & Daily Changes</div>
        {self._build_holdings_table_html(positions, portfolio.base_currency)}
"""
                
                # Transactions
                transactions = self._get_daily_transactions(portfolio.id, report_date)
                html += f"""
        <div class="section-header">📝 Daily Transactions</div>
        {self._build_transactions_html(transactions, portfolio.base_currency, report_date)}
"""
                
            except Exception as e:
                logger.error(f"Error generating report for portfolio {portfolio.id}: {e}")
                html += f"""
    <div class="portfolio-section">
        <div class="portfolio-header">💼 {portfolio.name}</div>
        <div class="no-data">⚠️ Error generating report: {str(e)}</div>
    </div>
"""
        
        # Footer
        html += f"""
    <div class="footer">
        <span class="dot">•</span> Generated by Portfolium on {datetime.utcnow().strftime('%Y-%m-%d at %H:%M')} UTC <span class="dot">•</span>
    </div>
</body>
</html>
"""
        
        return html
    
    def _build_heatmap_html(self, positions) -> Optional[str]:
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
    
    def _build_holdings_table_html(self, positions, currency: str) -> str:
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
    
    def _build_transactions_html(self, transactions: List[Transaction], currency: str, report_date: date) -> str:
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
