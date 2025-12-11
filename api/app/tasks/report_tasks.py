"""
Celery tasks for generating and sending daily portfolio reports
"""
import logging
from datetime import date, datetime
from typing import List, Tuple

from app.celery_app import celery_app
from app.db import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.report_tasks.send_daily_reports")
def send_daily_reports(self):
    """
    Celery task to generate and send daily portfolio reports
    
    This runs once per day (typically at 4:00 PM EST after market close) to send 
    PDF reports to all users who have daily reports enabled. Reports include 
    portfolio summary, heatmap, daily changes, transactions, and asset allocation.
    """
    logger.info("Starting daily report generation and distribution...")
    
    db = SessionLocal()
    try:
        from app.models import User, Portfolio
        from app.services.pdf_reports import PDFReportService
        from app.services.email import email_service
        from app.services.notifications import notification_service
        
        try:
            from zoneinfo import ZoneInfo
            eastern = ZoneInfo('America/New_York')
        except ImportError:
            from datetime import timezone, timedelta
            eastern = timezone(timedelta(hours=-5))  # EST fallback
        
        # Get current date in EST timezone (report for the trading day that just ended)
        # When this runs at 4:00 PM EST, it's for the current day's market close
        report_date = datetime.now(eastern).date()
        
        # Get all active users with daily reports enabled
        users = (
            db.query(User)
            .filter(User.is_active == True)
            .filter(User.is_verified == True)
            .filter(User.daily_report_enabled == True)
            .all()
        )
        
        if not users:
            logger.info("No users with daily reports enabled")
            return {
                "status": "success",
                "reports_sent": 0,
                "reports_failed": 0,
                "users_checked": 0,
                "report_date": report_date.isoformat()
            }
        
        pdf_service = PDFReportService(db)
        total_reports = 0
        total_failed = 0
        
        for user in users:
            try:
                logger.info(f"Generating daily report for user {user.id} ({user.email})")
                
                # Get user's portfolios
                portfolios = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
                
                if not portfolios:
                    logger.info(f"User {user.id} has no portfolios, skipping")
                    continue
                
                # Generate PDFs for each portfolio
                pdf_attachments: List[Tuple[str, bytes]] = []
                
                # Import asyncio for running async methods
                import asyncio
                
                # Create a new event loop for this thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    for portfolio in portfolios:
                        try:
                            # Generate PDF report asynchronously
                            pdf_data = loop.run_until_complete(
                                pdf_service.generate_daily_report(
                                    user_id=user.id,
                                    portfolio_id=portfolio.id,
                                    report_date=report_date
                                )
                            )
                            
                            # Clean portfolio name for filename (remove special chars)
                            clean_name = "".join(
                                c if c.isalnum() or c in (' ', '_', '-') else '_' 
                                for c in portfolio.name
                            )
                            filename = f"portfolio_report_{clean_name}_{report_date.strftime('%Y%m%d')}.pdf"
                            pdf_attachments.append((filename, pdf_data))
                            
                            logger.info(f"Generated PDF for portfolio '{portfolio.name}' ({portfolio.id})")
                            
                        except Exception as e:
                            logger.error(
                                f"Failed to generate PDF for portfolio {portfolio.id}: {e}",
                                exc_info=True
                            )
                            continue
                finally:
                    loop.close()
                
                if not pdf_attachments:
                    logger.warning(f"No PDFs generated for user {user.id}, skipping email")
                    total_failed += 1
                    continue
                
                # Send email with all PDF attachments (one per portfolio)
                success = email_service.send_daily_report_email(
                    to_email=user.email,
                    username=user.username,
                    report_date=report_date.strftime('%B %d, %Y'),
                    pdf_attachments=pdf_attachments,
                    language=user.preferred_language
                )
                
                if success:
                    total_reports += 1
                    logger.info(f"Daily report sent successfully to {user.email}")
                    
                    # Create notification for successful report delivery
                    try:
                        notification_service.create_system_notification(
                            db=db,
                            user_id=user.id,
                            title="📊 Daily Portfolio Report Sent",
                            message=f"Your daily portfolio report for {report_date.strftime('%B %d, %Y')} has been sent to {user.email}",
                            metadata={
                                "report_date": report_date.isoformat(),
                                "portfolios_count": len(portfolios)
                            }
                        )
                    except Exception as e:
                        logger.warning(f"Failed to create notification for user {user.id}: {e}")
                else:
                    total_failed += 1
                    logger.error(f"Failed to send daily report to {user.email}")
            
            except Exception as e:
                total_failed += 1
                logger.error(
                    f"Error generating/sending report for user {user.id}: {e}",
                    exc_info=True
                )
                continue
        
        result = {
            "status": "success",
            "reports_sent": total_reports,
            "reports_failed": total_failed,
            "users_checked": len(users),
            "report_date": report_date.isoformat()
        }
        
        logger.info(
            f"Daily report distribution completed. "
            f"Reports sent: {total_reports}, Failed: {total_failed}, "
            f"Users checked: {len(users)}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Daily report task failed: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "reports_sent": 0,
            "reports_failed": 0
        }
    finally:
        db.close()
