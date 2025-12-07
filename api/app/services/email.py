"""
Email service for sending verification and password reset emails
"""
import logging
from typing import Optional, List, Tuple
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
import os
from jinja2 import Environment, FileSystemLoader, select_autoescape

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
        
        # Setup Jinja2 template environment
        template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates', 'emails')
        self.jinja_env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml'])
        )
    
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
        attachment_filename: Optional[str] = None,
        attachments: Optional[List[Tuple[str, bytes]]] = None,
        embed_logo: bool = True
    ) -> bool:
        """
        Send an email via SMTP with optional PDF attachment(s) and embedded logo
        """
        if not settings.ENABLE_EMAIL:
            logger.info(f"Email disabled. Would send to {to_email}: {subject}")
            logger.debug(f"Email content: {html_content}")
            if attachment_filename:
                logger.info(f"Would attach: {attachment_filename} ({len(attachment_data) if attachment_data else 0} bytes)")
            if attachments:
                for filename, data in attachments:
                    logger.info(f"Would attach: {filename} ({len(data)} bytes)")
            return True
        
        # Check if SMTP is configured
        if not self.smtp_host or not self.smtp_user or not self.smtp_password:
            error_msg = "SMTP not fully configured. Please configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD."
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Root message: mixed = html+cid + attachments
            msg_root = MIMEMultipart("mixed")
            msg_root["Subject"] = subject
            msg_root["From"] = f"{self.from_name} <{self.from_email}>"
            msg_root["To"] = to_email

            # related = html + inline images (CID)
            msg_related = MIMEMultipart("related")

            # alternative = text/plain + text/html
            msg_alt = MIMEMultipart("alternative")

            # Plain text part
            if text_content:
                part_text = MIMEText(text_content, "plain", "utf-8")
                msg_alt.attach(part_text)

            # HTML part
            part_html = MIMEText(html_content, "html", "utf-8")
            msg_alt.attach(part_html)

            # Attach alternative (text + html) to related
            msg_related.attach(msg_alt)

            # Embed logo as CID attachment if requested
            if embed_logo:
                # Try Docker/production path first, then development path
                logo_paths = [
                    os.path.join(os.path.dirname(__file__), "..", "..", "static", "logo.png"),
                    os.path.join(os.path.dirname(__file__), "..", "..", "..", "web", "public", "favicon-96x96.png"),
                ]
                logo_path = None
                for path in logo_paths:
                    if os.path.exists(path):
                        logo_path = path
                        break
                
                if logo_path:
                    with open(logo_path, "rb") as logo_file:
                        logo_data = logo_file.read()
                        logo_image = MIMEImage(logo_data, _subtype="png")
                        logo_image.add_header("Content-ID", "<portfolium-logo>")
                        logo_image.add_header(
                            "Content-Disposition",
                            "inline",
                            filename="logo.png",
                        )
                        msg_related.attach(logo_image)
                else:
                    logger.warning(f"Logo file not found in any of the expected paths: {logo_paths}")

            # Attach the related (html + cid) to root
            msg_root.attach(msg_related)

            # Single PDF attachment (backward compatibility)
            if attachment_data and attachment_filename:
                pdf_part = MIMEApplication(attachment_data, _subtype="pdf")
                pdf_part.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=attachment_filename,
                )
                msg_root.attach(pdf_part)

            # Multiple PDF attachments
            if attachments:
                for filename, data in attachments:
                    pdf_part = MIMEApplication(data, _subtype="pdf")
                    pdf_part.add_header(
                        "Content-Disposition",
                        "attachment",
                        filename=filename,
                    )
                    msg_root.attach(pdf_part)
                    logger.info(f"Added attachment: {filename} ({len(data)} bytes)")

            # Send email - use SSL for port 465, TLS for other ports
            if self.smtp_port == 465:
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=10) as server:
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg_root)
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                    if self.use_tls:
                        server.starttls()
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg_root)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True

        except Exception as e:
            logger.exception(f"Failed to send email to {to_email}")
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
        
        # Render HTML template
        template = self.jinja_env.get_template('verification.html')
        html_content = template.render(
            t=t,
            username=username,
            verification_url=verification_url
        )
        
        # Text fallback
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
        t = get_all_translations(language, 'passwordReset')
        
        subject = t['subject']
        
        # Render HTML template
        template = self.jinja_env.get_template('password_reset.html')
        html_content = template.render(
            t=t,
            username=username,
            reset_url=reset_url
        )
        
        # Text fallback
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
        dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard"
        
        # Render HTML template
        template = self.jinja_env.get_template('welcome.html')
        html_content = template.render(
            t=t,
            username=username,
            dashboard_url=dashboard_url
        )
        
        # Text fallback
        text_content = f"""
        {t['header_title']}
        
        {t['text_greeting'].format(username=username)}
        
        {t['text_intro']}
        
        {t['text_features_title']}
        {t['text_feature_1']}
        {t['text_feature_2']}
        {t['text_feature_3']}
        {t['text_feature_4']}
        
        {t['text_dashboard']} {dashboard_url}
        
        {t['text_help']}
        
        {t['copyright']}
        """
        
        return self._send_email(to_email, subject, html_content, text_content)
    
    def send_daily_report_email(
        self,
        to_email: str,
        username: str,
        report_date: str,
        pdf_attachments: List[Tuple[str, bytes]],
        language: str = 'en'
    ) -> bool:
        """
        Send daily portfolio report email with multiple PDF attachments (one per portfolio)
        
        Args:
            to_email: Recipient email
            username: User's username
            report_date: Report date string (formatted)
            pdf_attachments: List of tuples (filename, pdf_data) for each portfolio
            language: User's preferred language
        """
        t = get_all_translations(language, 'dailyReport')
        subject = t['subject'].format(reportDate=report_date)
        
        # Update the email content to mention multiple portfolios
        portfolios_count = len(pdf_attachments)
        portfolios_text = f"{portfolios_count} portfolio{'s' if portfolios_count > 1 else ''}"
        
        # Render HTML template
        template = self.jinja_env.get_template('daily_report.html')
        html_content = template.render(
            t=t,
            username=username,
            report_date=report_date,
            portfolios_count=portfolios_count,
            portfolios_text=portfolios_text,
            settings_url=f"{settings.FRONTEND_URL.rstrip('/')}/settings",
            dashboard_url=settings.FRONTEND_URL.rstrip('/')
        )
        
        # Text fallback
        text_content = f"""
        {t['header_title']}
        
        {t['text_greeting'].format(username=username)}
        
        {t['text_intro'].format(reportDate=report_date)}
        
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
        
        return self._send_email(
            to_email, 
            subject, 
            html_content, 
            text_content,
            attachments=pdf_attachments
        )


# Singleton instance
email_service = EmailService()
