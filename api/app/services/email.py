"""
Email service for sending verification and password reset emails
"""
import logging
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication

from app.config import settings
from app.services.email_translations import get_all_translations


logger = logging.getLogger(__name__)


class EmailService:
    """Email service for authentication emails"""
    
    def __init__(self):
        # Don't load settings from database during init - let ensure_email_config() handle syncing
        # Just use the current settings values
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
        self.from_name = settings.FROM_NAME
        self.use_tls = settings.SMTP_TLS
    
    def _load_settings(self):
        """Load or reload settings from database"""
        # Load from database (used when reloading after config updates)
        try:
            from app.db import SessionLocal
            from sqlalchemy import text
            
            db = SessionLocal()
            try:
                config = db.execute(text("SELECT * FROM config WHERE id = 1")).first()
                if config:
                    # Update instance variables from database
                    self.smtp_host = config.smtp_host
                    self.smtp_port = config.smtp_port
                    self.smtp_user = config.smtp_user or self.smtp_user
                    self.smtp_password = config.smtp_password or self.smtp_password
                    self.use_tls = config.smtp_tls
                    self.from_email = config.from_email
                    self.from_name = config.from_name
            finally:
                db.close()
        except Exception as e:
            # If database not available or table doesn't exist, keep current settings
            logger.debug(f"Could not load email config from database: {e}")
    
    def reload_settings(self):
        """Reload settings from database - call after updating settings"""
        self._load_settings()
        
    def _send_email(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str,
        text_content: Optional[str] = None,
        attachment_data: Optional[bytes] = None,
        attachment_filename: Optional[str] = None
    ) -> bool:
        """Send an email via SMTP with optional PDF attachment"""
        if not settings.ENABLE_EMAIL:
            logger.info(f"Email disabled. Would send to {to_email}: {subject}")
            logger.debug(f"Email content: {html_content}")
            if attachment_filename:
                logger.info(f"Would attach: {attachment_filename} ({len(attachment_data) if attachment_data else 0} bytes)")
            return True
        
        # Check if SMTP is configured
        if not self.smtp_host or not self.smtp_user or not self.smtp_password:
            error_msg = "SMTP not fully configured. Please configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD."
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Add text and HTML parts
            if text_content:
                part1 = MIMEText(text_content, 'plain')
                msg.attach(part1)
            
            part2 = MIMEText(html_content, 'html')
            msg.attach(part2)
            
            # Add PDF attachment if provided
            if attachment_data and attachment_filename:
                pdf_part = MIMEApplication(attachment_data, _subtype='pdf')
                pdf_part.add_header('Content-Disposition', 'attachment', filename=attachment_filename)
                msg.attach(pdf_part)
            
            # Send email - use SSL for port 465, TLS for other ports
            if self.smtp_port == 465:
                # Use SMTP_SSL for port 465 (implicit SSL)
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=10) as server:
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg)
            else:
                # Use SMTP with STARTTLS for other ports (587, 25, etc.)
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                    if self.use_tls:
                        server.starttls()
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_verification_email(
        self, 
        to_email: str, 
        username: str, 
        verification_token: str,
        language: str = 'en'
    ) -> bool:
        """Send email verification email"""
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        verification_url = f"{frontend_url}/verify-email?token={verification_token}"
        
        # Get translations for the specified language
        t = get_all_translations(language, 'verification')
        
        subject = t['subject']
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">{t['header_emoji']}</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600;">{t['header_title']}</h1>
                </div>
                
                <!-- Content -->
                <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px;">{t['greeting'].format(username=username)}</p>
                    
                    <p style="margin: 0 0 20px 0; color: #4b5563;">{t['intro']}</p>
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{verification_url}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(236, 72, 153, 0.3);">{t['button_text']}</a>
                    </div>
                    
                    <!-- Alternative Link -->
                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">{t['alt_link_text']}</p>
                        <p style="margin: 0; word-break: break-all; color: #ec4899; font-size: 12px; font-family: 'Courier New', monospace;">{verification_url}</p>
                    </div>
                    
                    <!-- Warning Box -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px;">{t['expiry_warning']}</p>
                    </div>
                    
                    <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">{t['footer_text']}</p>
                    
                    <!-- Footer -->
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                        <p style="margin: 0;">{t['company_name']}</p>
                        <p style="margin: 5px 0 0 0;">{t['copyright']}</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {t['header_title']}
        
        {t['text_greeting'].format(username=username)}
        
        {t['text_intro']}
        
        {verification_url}
        
        {t['text_expiry']}
        
        {t['text_footer']}
        
        {t['copyright']}
        """
        
        return self._send_email(to_email, subject, html_content, text_content)
    
    def send_password_reset_email(
        self, 
        to_email: str, 
        username: str, 
        reset_token: str,
        language: str = 'en'
    ) -> bool:
        """Send password reset email"""
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        
        # Get translations for the specified language
        t = get_all_translations(language, 'password_reset')
        
        subject = t['subject']
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">{t['header_emoji']}</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600;">{t['header_title']}</h1>
                </div>
                
                <!-- Content -->
                <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px;">{t['greeting'].format(username=username)}</p>
                    
                    <p style="margin: 0 0 20px 0; color: #4b5563;">{t['intro']}</p>
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">{t['button_text']}</a>
                    </div>
                    
                    <!-- Alternative Link -->
                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">{t['alt_link_text']}</p>
                        <p style="margin: 0; word-break: break-all; color: #dc2626; font-size: 12px; font-family: 'Courier New', monospace;">{reset_url}</p>
                    </div>
                    
                    <!-- Warning Box -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px;">{t['expiry_warning']}</p>
                    </div>
                    
                    <!-- Security Notice -->
                    <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; color: #991b1b; font-weight: 600; font-size: 14px;">{t['security_title']}</p>
                        <p style="margin: 0; color: #991b1b; font-size: 14px;">{t['security_text']}</p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                        <p style="margin: 0;">{t['company_name']}</p>
                        <p style="margin: 5px 0 0 0;">{t['copyright']}</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {t['header_title']}
        
        {t['text_greeting'].format(username=username)}
        
        {t['text_intro']}
        
        {reset_url}
        
        {t['text_expiry']}
        
        {t['text_security']}
        
        {t['copyright']}
        """
        
        return self._send_email(to_email, subject, html_content, text_content)
    
    def send_welcome_email(self, to_email: str, username: str, language: str = 'en') -> bool:
        """Send welcome email after successful verification"""
        t = get_all_translations(language, 'welcome')
        subject = t['subject']
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">{t['header_emoji']}</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600;">{t['header_title']}</h1>
                </div>
                
                <!-- Content -->
                <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px;">{t['greeting'].format(username=username)}</p>
                    
                    <p style="margin: 0 0 20px 0; color: #4b5563;">{t['intro']}</p>
                    
                    <!-- Features Box -->
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #065f46; font-size: 18px; font-weight: 600;">{t['features_title']}</h3>
                        <div style="margin: 10px 0;">
                            <div style="display: inline-block; width: 30px; color: #10b981; font-size: 20px;">✅</div>
                            <span style="color: #065f46; font-size: 15px;">{t['feature_1']}</span>
                        </div>
                        <div style="margin: 10px 0;">
                            <div style="display: inline-block; width: 30px; color: #10b981; font-size: 20px;">✅</div>
                            <span style="color: #065f46; font-size: 15px;">{t['feature_2']}</span>
                        </div>
                        <div style="margin: 10px 0;">
                            <div style="display: inline-block; width: 30px; color: #10b981; font-size: 20px;">✅</div>
                            <span style="color: #065f46; font-size: 15px;">{t['feature_3']}</span>
                        </div>
                        <div style="margin: 10px 0;">
                            <div style="display: inline-block; width: 30px; color: #10b981; font-size: 20px;">✅</div>
                            <span style="color: #065f46; font-size: 15px;">{t['feature_4']}</span>
                        </div>
                    </div>
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{settings.FRONTEND_URL.rstrip('/')}/dashboard" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(236, 72, 153, 0.3);">{t['button_text']}</a>
                    </div>
                    
                    <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; text-align: center;">{t['help_text']}</p>
                    
                    <!-- Footer -->
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                        <p style="margin: 0;">{t['company_name']}</p>
                        <p style="margin: 5px 0 0 0;">{t['copyright']}</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {t['header_title']}
        
        {t['text_greeting'].format(username=username)}
        
        {t['text_intro']}
        
        {t['text_features_title']}
        {t['text_feature_1']}
        {t['text_feature_2']}
        {t['text_feature_3']}
        {t['text_feature_4']}
        
        {t['text_dashboard']} {settings.FRONTEND_URL.rstrip('/')}/dashboard
        
        {t['text_help']}
        
        {t['copyright']}
        """
        
        return self._send_email(to_email, subject, html_content, text_content)
    
    def send_daily_report_email(
        self,
        to_email: str,
        username: str,
        report_date: str,
        pdf_data: bytes,
        language: str = 'en'
    ) -> bool:
        """Send daily portfolio report email with PDF attachment"""
        t = get_all_translations(language, 'daily_report')
        subject = t['subject'].format(report_date=report_date)
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">{t['header_emoji']}</div>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600;">{t['header_title']}</h1>
                </div>
                
                <!-- Content -->
                <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px;">{t['greeting'].format(username=username)}</p>
                    
                    <p style="margin: 0 0 20px 0; color: #4b5563;">{t['intro'].format(report_date=report_date)}</p>
                    
                    <!-- Report Info Box -->
                    <div style="background: linear-gradient(135deg, #eef2ff 0%, #fce7f3 100%); border: 1px solid #e9d5ff; border-radius: 6px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #6b21a8; font-size: 18px; font-weight: 600;">{t['report_title']}</h3>
                        <div style="margin: 8px 0;">
                            <div style="display: inline-block; width: 30px; color: #ec4899; font-size: 18px;">📈</div>
                            <span style="color: #4b5563; font-size: 15px;">{t['report_item_1']}</span>
                        </div>
                        <div style="margin: 8px 0;">
                            <div style="display: inline-block; width: 30px; color: #ec4899; font-size: 18px;">🗺️</div>
                            <span style="color: #4b5563; font-size: 15px;">{t['report_item_2']}</span>
                        </div>
                        <div style="margin: 8px 0;">
                            <div style="display: inline-block; width: 30px; color: #ec4899; font-size: 18px;">💰</div>
                            <span style="color: #4b5563; font-size: 15px;">{t['report_item_3']}</span>
                        </div>
                        <div style="margin: 8px 0;">
                            <div style="display: inline-block; width: 30px; color: #ec4899; font-size: 18px;">📋</div>
                            <span style="color: #4b5563; font-size: 15px;">{t['report_item_4']}</span>
                        </div>
                        <div style="margin: 8px 0;">
                            <div style="display: inline-block; width: 30px; color: #ec4899; font-size: 18px;">🥧</div>
                            <span style="color: #4b5563; font-size: 15px;">{t['report_item_5']}</span>
                        </div>
                    </div>
                    
                    <p style="margin: 20px 0; color: #4b5563;">{t['attachment_text']}</p>
                    
                    <!-- Settings Link -->
                    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                            {t['settings_text_1']} 
                            <a href="{settings.FRONTEND_URL.rstrip('/')}/settings" style="color: #ec4899; text-decoration: none; font-weight: 600;">{t['settings_link']}</a>
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                        <p style="margin: 0;">{t['company_name']}</p>
                        <p style="margin: 5px 0 0 0;">{t['copyright']}</p>
                        <p style="margin: 10px 0 0 0;">
                            <a href="{settings.FRONTEND_URL.rstrip('/')}" style="color: #ec4899; text-decoration: none;">{t['visit_dashboard']}</a>
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {t['header_title']}
        
        {t['text_greeting'].format(username=username)}
        
        {t['text_intro'].format(report_date=report_date)}
        
        {t['text_report_title']}
        {t['text_report_item_1']}
        {t['text_report_item_2']}
        {t['text_report_item_3']}
        {t['text_report_item_4']}
        {t['text_report_item_5']}
        
        {t['text_attachment']}
        
        {t['text_settings']} {settings.FRONTEND_URL.rstrip('/')}/settings
        
        {t['copyright']}
        """
        
        filename = f"portfolio_report_{report_date}.pdf"
        
        return self._send_email(
            to_email, 
            subject, 
            html_content, 
            text_content,
            attachment_data=pdf_data,
            attachment_filename=filename
        )


# Singleton instance
email_service = EmailService()
