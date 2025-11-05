"""
Admin and maintenance endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr

from app.db import get_db
from app.auth import get_password_hash
from app.auth import get_current_admin_user
from app.models import User, NotificationType, Portfolio
from app.schemas import AdminUserCreate, AdminUserUpdate, User as UserSchema
from app.config import settings
from app.tasks.scheduler import check_price_alerts, refresh_all_prices
from app.crud import notifications as crud_notifications

router = APIRouter(prefix="/admin")


@router.delete("/data")
def delete_all_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
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
@router.get("/users", response_model=list[UserSchema])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """List all users (admin only)"""
    users = db.query(User).order_by(User.id.asc()).all()
    return users


@router.post("/users", response_model=UserSchema, status_code=201)
def create_user_admin(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new user (admin only)"""
    if db.query(User).filter((User.email == payload.email) | (User.username == payload.username)).first():
        raise HTTPException(status_code=400, detail="Email or username already exists")
    new_user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        is_active=payload.is_active,
        is_verified=payload.is_verified,
        is_admin=payload.is_admin,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/users/{user_id}", response_model=UserSchema)
def update_user_admin(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update user status or admin flag (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Protect the first/primary admin account from deactivation or admin revocation
    def is_protected_first_admin(u: User) -> bool:
        try:
            if settings.ADMIN_EMAIL and u.email == settings.ADMIN_EMAIL:
                return True
        except Exception:
            # settings might not be fully available in all contexts; ignore
            pass
        first_admin = (
            db.query(User)
            .filter((User.is_admin == True) | (User.is_superuser == True))
            .order_by(User.id.asc())
            .first()
        )
        return bool(first_admin and first_admin.id == u.id)

    if is_protected_first_admin(user):
        incoming = payload.model_dump(exclude_unset=True)
        if 'is_admin' in incoming and incoming['is_admin'] is False:
            raise HTTPException(status_code=400, detail="Cannot revoke admin from the first admin account")
        if 'is_active' in incoming and incoming['is_active'] is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate the first admin account")
    data = payload.model_dump(exclude_unset=True)
    # Duplicate checks for email/username if they are being changed
    new_email = data.get('email')
    if new_email and new_email != user.email:
        existing = db.query(User).filter(User.email == new_email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    new_username = data.get('username')
    if new_username and new_username != user.username:
        existing = db.query(User).filter(User.username == new_username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already in use")
    if 'password' in data and data['password']:
        user.hashed_password = get_password_hash(data.pop('password'))
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Also protect the first/primary admin from deletion
    def is_protected_first_admin(u: User) -> bool:
        try:
            if settings.ADMIN_EMAIL and u.email == settings.ADMIN_EMAIL:
                return True
        except Exception:
            pass
        first_admin = (
            db.query(User)
            .filter((User.is_admin == True) | (User.is_superuser == True))
            .order_by(User.id.asc())
            .first()
        )
        return bool(first_admin and first_admin.id == u.id)

    if is_protected_first_admin(user):
        raise HTTPException(status_code=400, detail="Cannot delete the first admin account")
    db.delete(user)
    db.commit()
    return


@router.post("/trigger/price-alerts")
def trigger_price_alerts(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Manually trigger the price alert check task
    
    This runs the scheduled price alert check immediately without waiting
    for the scheduled interval. Useful for testing and debugging.
    """
    try:
        check_price_alerts()
        return {
            "success": True,
            "message": "Price alert check triggered successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger price alerts: {str(e)}"
        )


@router.post("/trigger/refresh-prices")
def trigger_refresh_prices(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Manually trigger the price refresh task
    
    This runs the scheduled price refresh immediately without waiting
    for the scheduled interval. Useful for testing and debugging.
    """
    try:
        refresh_all_prices()
        return {
            "success": True,
            "message": "Price refresh triggered successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger price refresh: {str(e)}"
        )


@router.get("/logo-cache/stats")
def get_logo_cache_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get statistics about the logo cache
    
    Returns information about cached logos, total size, and cache hit rate.
    """
    try:
        # Count total assets
        total_assets = db.execute(text("SELECT COUNT(*) FROM portfolio.assets")).scalar()
        
        # Count cached logos
        cached_logos = db.execute(
            text("SELECT COUNT(*) FROM portfolio.assets WHERE logo_data IS NOT NULL")
        ).scalar()
        
        # Calculate total cache size
        total_size = db.execute(
            text("SELECT COALESCE(SUM(LENGTH(logo_data)), 0) FROM portfolio.assets WHERE logo_data IS NOT NULL")
        ).scalar()
        
        # Get breakdown by content type
        breakdown = db.execute(
            text("""
                SELECT 
                    logo_content_type,
                    COUNT(*) as count,
                    SUM(LENGTH(logo_data)) as total_size
                FROM portfolio.assets 
                WHERE logo_data IS NOT NULL
                GROUP BY logo_content_type
            """)
        ).fetchall()
        
        return {
            "total_assets": int(total_assets or 0),
            "cached_logos": int(cached_logos or 0),
            "cache_percentage": round((cached_logos / total_assets * 100) if total_assets > 0 else 0, 2),
            "total_size_bytes": int(total_size or 0),
            "total_size_mb": round((total_size or 0) / (1024 * 1024), 2),
            "breakdown": [
                {
                    "content_type": row[0],
                    "count": int(row[1]),
                    "size_bytes": int(row[2])
                }
                for row in breakdown
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get logo cache stats: {str(e)}"
        )


@router.delete("/logo-cache")
def clear_logo_cache(
    symbol: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Clear logo cache for a specific symbol or all symbols
    
    Query params:
    - symbol: Optional ticker symbol. If not provided, clears all cached logos.
    """
    try:
        if symbol:
            # Clear specific symbol
            result = db.execute(
                text("""
                    UPDATE portfolio.assets 
                    SET logo_data = NULL, logo_content_type = NULL, logo_fetched_at = NULL 
                    WHERE symbol = :symbol
                """),
                {"symbol": symbol.upper()}
            )
            db.commit()
            
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not found")
            
            return {
                "success": True,
                "message": f"Logo cache cleared for {symbol}",
                "cleared_count": result.rowcount
            }
        else:
            # Clear all logos
            result = db.execute(
                text("""
                    UPDATE portfolio.assets 
                    SET logo_data = NULL, logo_content_type = NULL, logo_fetched_at = NULL 
                    WHERE logo_data IS NOT NULL
                """)
            )
            db.commit()
            
            return {
                "success": True,
                "message": "All logo cache cleared",
                "cleared_count": result.rowcount
            }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear logo cache: {str(e)}"
        )


# ================================
# Email Configuration & Testing
# ================================

class EmailConfig(BaseModel):
    """Email configuration schema"""
    enable_email: bool
    smtp_host: str
    smtp_port: int
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None  # Optional for security (won't return in GET)
    smtp_tls: bool
    from_email: EmailStr
    from_name: str
    frontend_url: str


class EmailConfigUpdate(BaseModel):
    """Email configuration update schema"""
    enable_email: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_tls: Optional[bool] = None
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    frontend_url: Optional[str] = None


class EmailTestRequest(BaseModel):
    """Email test request schema"""
    to_email: EmailStr
    test_type: str = "simple"  # simple, verification, password_reset, daily_report


@router.get("/email/config", response_model=EmailConfig)
def get_email_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get current email configuration
    
    Returns the current SMTP settings from database. Password is masked for security.
    """
    # Get config from database
    config = db.execute(text("SELECT * FROM config WHERE id = 1")).first()
    
    if config:
        return EmailConfig(
            enable_email=config.enable_email,
            smtp_host=config.smtp_host,
            smtp_port=config.smtp_port,
            smtp_user=config.smtp_user,
            smtp_password="********" if config.smtp_password else None,
            smtp_tls=config.smtp_tls,
            from_email=config.from_email,
            from_name=config.from_name,
            frontend_url=config.frontend_url
        )
    else:
        # Fallback to settings if no config in database
        return EmailConfig(
            enable_email=settings.ENABLE_EMAIL,
            smtp_host=settings.SMTP_HOST,
            smtp_port=settings.SMTP_PORT,
            smtp_user=settings.SMTP_USER,
            smtp_password="********" if settings.SMTP_PASSWORD else None,
            smtp_tls=settings.SMTP_TLS,
            from_email=settings.FROM_EMAIL,
            from_name=settings.FROM_NAME,
            frontend_url=settings.FRONTEND_URL
        )


@router.patch("/email/config", response_model=EmailConfig)
def update_email_config(
    config_update: EmailConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Update email configuration
    
    Updates SMTP settings in database and runtime settings.
    """
    # Build update query dynamically
    update_fields = []
    update_values = {}
    
    if config_update.enable_email is not None:
        update_fields.append("enable_email = :enable_email")
        update_values["enable_email"] = config_update.enable_email
        settings.ENABLE_EMAIL = config_update.enable_email
    
    if config_update.smtp_host is not None:
        update_fields.append("smtp_host = :smtp_host")
        update_values["smtp_host"] = config_update.smtp_host
        settings.SMTP_HOST = config_update.smtp_host
    
    if config_update.smtp_port is not None:
        update_fields.append("smtp_port = :smtp_port")
        update_values["smtp_port"] = config_update.smtp_port
        settings.SMTP_PORT = config_update.smtp_port
    
    if config_update.smtp_user is not None:
        update_fields.append("smtp_user = :smtp_user")
        update_values["smtp_user"] = config_update.smtp_user
        settings.SMTP_USER = config_update.smtp_user
    
    if config_update.smtp_password is not None:
        update_fields.append("smtp_password = :smtp_password")
        update_values["smtp_password"] = config_update.smtp_password
        settings.SMTP_PASSWORD = config_update.smtp_password
    
    if config_update.smtp_tls is not None:
        update_fields.append("smtp_tls = :smtp_tls")
        update_values["smtp_tls"] = config_update.smtp_tls
        settings.SMTP_TLS = config_update.smtp_tls
    
    if config_update.from_email is not None:
        update_fields.append("from_email = :from_email")
        update_values["from_email"] = config_update.from_email
        settings.FROM_EMAIL = config_update.from_email
    
    if config_update.from_name is not None:
        update_fields.append("from_name = :from_name")
        update_values["from_name"] = config_update.from_name
        settings.FROM_NAME = config_update.from_name
    
    if config_update.frontend_url is not None:
        update_fields.append("frontend_url = :frontend_url")
        update_values["frontend_url"] = config_update.frontend_url
        settings.FRONTEND_URL = config_update.frontend_url
    
    # Update timestamp
    update_fields.append("updated_at = CURRENT_TIMESTAMP")
    
    # Execute update if there are fields to update
    if update_fields:
        query = text(f"UPDATE config SET {', '.join(update_fields)} WHERE id = 1")
        db.execute(query, update_values)
        db.commit()
    
    # Reload email service settings after updating config
    from app.services.email import email_service
    email_service.reload_settings()
    
    # Get updated config from database
    config = db.execute(text("SELECT * FROM config WHERE id = 1")).first()
    
    return EmailConfig(
        enable_email=config.enable_email,
        smtp_host=config.smtp_host,
        smtp_port=config.smtp_port,
        smtp_user=config.smtp_user,
        smtp_password="********" if config.smtp_password else None,
        smtp_tls=config.smtp_tls,
        from_email=config.from_email,
        from_name=config.from_name,
        frontend_url=config.frontend_url
    )


@router.post("/email/test")
async def test_email_connection(
    test_request: EmailTestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Test email configuration by sending a test email
    
    Supports different test types:
    - simple: Basic test email
    - verification: Email verification template
    - password_reset: Password reset template
    - daily_report: Daily report with PDF (requires portfolio data)
    """
    # Check if email system is enabled
    if not settings.ENABLE_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email system is disabled. Please enable it in the email configuration before testing."
        )
    
    from app.services.email import email_service
    
    # Reload settings before sending test email
    email_service.reload_settings()
    
    try:
        if test_request.test_type == "simple":
            # Send simple test email
            subject = "Portfolium Email Test"
            
            # Use inline styles for better email client compatibility
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f9fafb;">
                <div style="max-width: 600px; margin: 0 auto;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Email Configuration Test</h1>
                    </div>
                    
                    <!-- Content -->
                    <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Success Message -->
                        <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 0 0 20px 0; border-radius: 4px;">
                            <p style="margin: 0; color: #065f46; font-weight: 500;">🎉 Congratulations! Your email configuration is working correctly.</p>
                        </div>
                        
                        <p style="margin: 0 0 20px 0; color: #4b5563;">Your SMTP settings have been successfully validated and you can now send emails from Portfolium.</p>
                        
                        <!-- Configuration Box -->
                        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
                            <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px; font-weight: 600;">📋 Current Configuration</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 8px 0; color: #374151; font-weight: 600;">SMTP Host:</td>
                                    <td style="padding: 8px 0; color: #ec4899; font-family: 'Courier New', monospace; text-align: right;">{settings.SMTP_HOST}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 8px 0; color: #374151; font-weight: 600;">SMTP Port:</td>
                                    <td style="padding: 8px 0; color: #ec4899; font-family: 'Courier New', monospace; text-align: right;">{settings.SMTP_PORT}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 8px 0; color: #374151; font-weight: 600;">Encryption:</td>
                                    <td style="padding: 8px 0; color: #ec4899; font-family: 'Courier New', monospace; text-align: right;">{'SSL' if settings.SMTP_PORT == 465 else 'TLS (STARTTLS)' if settings.SMTP_TLS else 'None'}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 8px 0; color: #374151; font-weight: 600;">From Address:</td>
                                    <td style="padding: 8px 0; color: #ec4899; font-family: 'Courier New', monospace; text-align: right;">{settings.FROM_EMAIL}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #374151; font-weight: 600;">From Name:</td>
                                    <td style="padding: 8px 0; color: #ec4899; font-family: 'Courier New', monospace; text-align: right;">{settings.FROM_NAME}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <p style="margin: 20px 0 0 0; color: #4b5563;">This is a test email sent from the Portfolium admin panel to verify your email configuration.</p>
                        
                        <!-- Footer -->
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                            <p style="margin: 0;">Portfolium - Portfolio Management Platform</p>
                            <p style="margin: 5px 0 0 0;">© 2025 All rights reserved</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
            ✅ Email Configuration Test
            
            Congratulations! Your email configuration is working correctly.
            
            Current Configuration:
            - SMTP Host: {settings.SMTP_HOST}
            - SMTP Port: {settings.SMTP_PORT}
            - Encryption: {'SSL' if settings.SMTP_PORT == 465 else 'TLS (STARTTLS)' if settings.SMTP_TLS else 'None'}
            - From Address: {settings.FROM_EMAIL}
            - From Name: {settings.FROM_NAME}
            
            This is a test email sent from the Portfolium admin panel to verify your email configuration.
            
            ---
            Portfolium - Portfolio Management Platform
            © 2025 All rights reserved
            """
            
            success = email_service._send_email(
                test_request.to_email,
                subject,
                html_content,
                text_content
            )
            
        elif test_request.test_type == "verification":
            # Test verification email template using admin's preferred language
            success = email_service.send_verification_email(
                test_request.to_email,
                current_user.username,
                "test-token-12345",
                current_user.preferred_language or "en"
            )
            
        elif test_request.test_type == "password_reset":
            # Test password reset email template using admin's preferred language
            success = email_service.send_password_reset_email(
                test_request.to_email,
                current_user.username,
                "reset-token-12345",
                current_user.preferred_language or "en"
            )
            
        elif test_request.test_type == "daily_report":
            # Test daily report email with PDF
            # Try to find the user by email, otherwise use current admin user for testing
            user = db.query(User).filter(User.email == test_request.to_email).first()
            
            if not user:
                # Use current admin user as fallback for generating test report
                user = current_user
            
            from app.services.pdf_reports import PDFReportService
            from datetime import datetime, timedelta
            
            # Generate test report
            pdf_service = PDFReportService(db)
            report_date = (datetime.utcnow() - timedelta(days=1)).date()
            
            try:
                # Get user's portfolios to generate one PDF per portfolio
                portfolios = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
                
                if not portfolios:
                    raise ValueError(f"User {user.id} has no portfolios to generate a report for")
                
                # Generate PDFs for each portfolio
                pdf_attachments = []
                for portfolio in portfolios:
                    pdf_data = await pdf_service.generate_daily_report(
                        user_id=user.id,
                        portfolio_id=portfolio.id,
                        report_date=report_date
                    )
                    # Clean portfolio name for filename
                    clean_name = "".join(c if c.isalnum() or c in (' ', '_', '-') else '_' for c in portfolio.name)
                    filename = f"portfolio_report_{clean_name}_{report_date.strftime('%Y%m%d')}.pdf"
                    pdf_attachments.append((filename, pdf_data))
                
                # Extract username and language from the user account
                # Always use the actual user's language preference (either matched user or current admin)
                username = user.username
                language = user.preferred_language or "en"
                
                success = email_service.send_daily_report_email(
                    test_request.to_email,
                    username,
                    report_date.strftime('%B %d, %Y'),
                    pdf_attachments,
                    language
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot generate report: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid test_type: {test_request.test_type}. Use: simple, verification, password_reset, or daily_report"
            )
        
        if success:
            return {
                "success": True,
                "message": f"Test email sent successfully to {test_request.to_email}",
                "test_type": test_request.test_type,
                "smtp_host": settings.SMTP_HOST,
                "smtp_port": settings.SMTP_PORT,
                "from_email": settings.FROM_EMAIL
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send test email. Check logs for details."
            )
            
    except ValueError as e:
        # SMTP configuration error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Provide more helpful error messages for common issues
        if "timed out" in error_msg.lower():
            detail = "SMTP connection timed out. Please verify your SMTP host and port settings."
        elif "authentication" in error_msg.lower() or "login" in error_msg.lower():
            detail = "SMTP authentication failed. Please check your SMTP username and password."
        elif "connection" in error_msg.lower():
            detail = f"Failed to connect to SMTP server. {error_msg}"
        else:
            detail = f"Email test failed: {error_msg}"
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail
        )


@router.get("/email/stats")
def get_email_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get email-related statistics
    
    Returns counts of users with various email notification settings enabled.
    """
    try:
        total_users = db.execute(
            text("SELECT COUNT(*) FROM portfolio.users WHERE is_active = true")
        ).scalar()
        
        verified_users = db.execute(
            text("SELECT COUNT(*) FROM portfolio.users WHERE is_verified = true AND is_active = true")
        ).scalar()
        
        daily_reports_enabled = db.execute(
            text("SELECT COUNT(*) FROM portfolio.users WHERE daily_report_enabled = true AND is_active = true")
        ).scalar()
        
        daily_changes_enabled = db.execute(
            text("SELECT COUNT(*) FROM portfolio.users WHERE daily_change_notifications_enabled = true AND is_active = true")
        ).scalar()
        
        transaction_notifications_enabled = db.execute(
            text("SELECT COUNT(*) FROM portfolio.users WHERE transaction_notifications_enabled = true AND is_active = true")
        ).scalar()
        
        return {
            "total_active_users": int(total_users or 0),
            "verified_users": int(verified_users or 0),
            "email_enabled": settings.ENABLE_EMAIL,
            "notifications": {
                "daily_reports_enabled": int(daily_reports_enabled or 0),
                "daily_changes_enabled": int(daily_changes_enabled or 0),
                "transaction_notifications_enabled": int(transaction_notifications_enabled or 0)
            },
            "smtp_configured": bool(settings.SMTP_HOST and settings.SMTP_USER)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get email stats: {str(e)}"
        )


# ================================
# Test Notifications
# ================================

class CreateTestNotificationsRequest(BaseModel):
    """Request schema for creating test notifications"""
    notification_types: Optional[list[str]] = None  # If None, creates all types


@router.post("/notifications/test")
def create_test_notifications(
    request: CreateTestNotificationsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Create test notifications for each notification type
    
    This endpoint creates sample notifications for testing the UI.
    You can specify which notification types to create, or leave empty to create all types.
    
    Available notification types:
    - TRANSACTION_CREATED
    - TRANSACTION_UPDATED
    - TRANSACTION_DELETED
    - LOGIN
    - PRICE_ALERT
    - DAILY_CHANGE_UP
    - DAILY_CHANGE_DOWN
    - SYSTEM
    """
    try:
        # Determine which notification types to create
        if request.notification_types:
            types_to_create = [NotificationType(t) for t in request.notification_types]
        else:
            # Create all notification types
            types_to_create = [
                NotificationType.TRANSACTION_CREATED,
                NotificationType.TRANSACTION_UPDATED,
                NotificationType.TRANSACTION_DELETED,
                NotificationType.LOGIN,
                NotificationType.PRICE_ALERT,
                NotificationType.DAILY_CHANGE_UP,
                NotificationType.DAILY_CHANGE_DOWN,
                NotificationType.SYSTEM
            ]
        
        created_notifications = []
        
        for notification_type in types_to_create:
            if notification_type == NotificationType.TRANSACTION_CREATED:
                notification = crud_notifications.create_notification(
                    db=db,
                    user_id=current_user.id,
                    notification_type=notification_type,
                    title="Transaction Created",
                    message="You bought 10 shares of AAPL at $175.25",
                    metadata={
                        "symbol": "AAPL",
                        "tx_date": "2025-11-01",
                        "quantity": 10,
                        "price": 175.25,
                        "type": "BUY"
                    }
                )
            
            elif notification_type == NotificationType.TRANSACTION_UPDATED:
                notification = crud_notifications.create_notification(
                    db=db,
                    user_id=current_user.id,
                    notification_type=notification_type,
                    title="Transaction Updated",
                    message="Updated your TSLA transaction from 2025-10-15",
                    metadata={
                        "symbol": "TSLA",
                        "tx_date": "2025-10-15",
                        "quantity": 5,
                        "price": 242.50
                    }
                )
            
            elif notification_type == NotificationType.TRANSACTION_DELETED:
                notification = crud_notifications.create_notification(
                    db=db,
                    user_id=current_user.id,
                    notification_type=notification_type,
                    title="Transaction Deleted",
                    message="Deleted your MSFT sell transaction from 2025-10-20",
                    metadata={
                        "symbol": "MSFT",
                        "tx_date": "2025-10-20"
                    }
                )
            
            elif notification_type == NotificationType.LOGIN:
                notification = crud_notifications.create_notification(
                    db=db,
                    user_id=current_user.id,
                    notification_type=notification_type,
                    title="New Login Detected",
                    message="A new login to your account was detected from a new device or location.",
                    metadata={
                        "ip_address": "192.168.1.100",
                        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        "location": "New York, USA"
                    }
                )
            
            elif notification_type == NotificationType.PRICE_ALERT:
                notification = crud_notifications.create_notification(
                    db=db,
                    user_id=current_user.id,
                    notification_type=notification_type,
                    title="🎯 Price Alert: NVDA",
                    message="NVDA has reached your target price of $500.00",
                    metadata={
                        "symbol": "NVDA",
                        "target_price": 500.00,
                        "current_price": 501.25,
                        "alert_type": "above"
                    }
                )
            
            elif notification_type == NotificationType.DAILY_CHANGE_UP:
                notification = crud_notifications.create_notification(
                    db=db,
                    user_id=current_user.id,
                    notification_type=notification_type,
                    title="📈 AAPL Up +5.25%",
                    message="Apple Inc is up +5.25% today. Your 50 shares at $180.50 (+$472.06)",
                    metadata={
                        "asset_id": 1,
                        "portfolio_id": 1,
                        "symbol": "AAPL",
                        "current_price": 180.50,
                        "daily_change_pct": 5.25,
                        "quantity": 50.0,
                        "position_value": 9025.00,
                        "change_amount": 472.06,
                        "direction": "up"
                    }
                )
            
            elif notification_type == NotificationType.DAILY_CHANGE_DOWN:
                notification = crud_notifications.create_notification(
                    db=db,
                    user_id=current_user.id,
                    notification_type=notification_type,
                    title="📉 TSLA Down -3.15%",
                    message="Tesla Inc is down -3.15% today. Your 25 shares at $235.40 (-$191.33)",
                    metadata={
                        "asset_id": 2,
                        "portfolio_id": 1,
                        "symbol": "TSLA",
                        "current_price": 235.40,
                        "daily_change_pct": -3.15,
                        "quantity": 25.0,
                        "position_value": 5885.00,
                        "change_amount": -191.33,
                        "direction": "down"
                    }
                )
            
            elif notification_type == NotificationType.SYSTEM:
                notification = crud_notifications.create_notification(
                    db=db,
                    user_id=current_user.id,
                    notification_type=notification_type,
                    title="System Maintenance Scheduled",
                    message="Portfolium will be undergoing scheduled maintenance on November 5th, 2025 from 2:00 AM to 4:00 AM EST. During this time, the service may be temporarily unavailable.",
                    metadata={
                        "maintenance_date": "2025-11-05",
                        "start_time": "02:00",
                        "end_time": "04:00",
                        "timezone": "EST"
                    }
                )
            
            created_notifications.append({
                "id": notification.id,
                "type": notification.type.value,
                "title": notification.title
            })
        
        return {
            "success": True,
            "message": f"Created {len(created_notifications)} test notification(s)",
            "notifications": created_notifications
        }
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid notification type: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create test notifications: {str(e)}"
        )
