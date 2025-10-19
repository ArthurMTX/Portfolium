"""
Email service for sending verification and password reset emails
"""
import logging
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings


logger = logging.getLogger(__name__)


class EmailService:
    """Email service for authentication emails"""
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
        self.from_name = settings.FROM_NAME
        self.use_tls = settings.SMTP_TLS
        
    def _send_email(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send an email via SMTP"""
        if not settings.ENABLE_EMAIL:
            logger.info(f"Email disabled. Would send to {to_email}: {subject}")
            logger.debug(f"Email content: {html_content}")
            return True
        
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
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
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
        verification_token: str
    ) -> bool:
        """Send email verification email"""
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
        
        subject = "Verify your Portfolium account"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }}
                .button {{ display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Portfolium!</h1>
                </div>
                <div class="content">
                    <p>Hi {username},</p>
                    <p>Thank you for registering with Portfolium. To complete your registration and start tracking your investment portfolio, please verify your email address.</p>
                    <p style="text-align: center;">
                        <a href="{verification_url}" class="button">Verify Email Address</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666; font-size: 12px;">{verification_url}</p>
                    <p>This verification link will expire in 24 hours.</p>
                    <p>If you didn't create this account, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2025 Portfolium. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Welcome to Portfolium!
        
        Hi {username},
        
        Thank you for registering with Portfolium. To complete your registration, please verify your email address by clicking the link below:
        
        {verification_url}
        
        This verification link will expire in 24 hours.
        
        If you didn't create this account, please ignore this email.
        
        © 2025 Portfolium. All rights reserved.
        """
        
        return self._send_email(to_email, subject, html_content, text_content)
    
    def send_password_reset_email(
        self, 
        to_email: str, 
        username: str, 
        reset_token: str
    ) -> bool:
        """Send password reset email"""
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        
        subject = "Reset your Portfolium password"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }}
                .button {{ display: inline-block; padding: 12px 30px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                .warning {{ background-color: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset Request</h1>
                </div>
                <div class="content">
                    <p>Hi {username},</p>
                    <p>We received a request to reset your Portfolium account password. Click the button below to reset it:</p>
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666; font-size: 12px;">{reset_url}</p>
                    <p>This password reset link will expire in 1 hour.</p>
                    <div class="warning">
                        <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure.
                    </div>
                </div>
                <div class="footer">
                    <p>&copy; 2025 Portfolium. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Password Reset Request
        
        Hi {username},
        
        We received a request to reset your Portfolium account password. Click the link below to reset it:
        
        {reset_url}
        
        This password reset link will expire in 1 hour.
        
        If you didn't request a password reset, please ignore this email and ensure your account is secure.
        
        © 2025 Portfolium. All rights reserved.
        """
        
        return self._send_email(to_email, subject, html_content, text_content)
    
    def send_welcome_email(self, to_email: str, username: str) -> bool:
        """Send welcome email after successful verification"""
        subject = "Welcome to Portfolium - Let's Get Started!"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }}
                .button {{ display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                .feature {{ margin: 15px 0; padding-left: 25px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Account Verified!</h1>
                </div>
                <div class="content">
                    <p>Hi {username},</p>
                    <p>Your email has been successfully verified! You now have full access to Portfolium.</p>
                    <h3>What you can do now:</h3>
                    <div class="feature">✅ Create and manage multiple portfolios</div>
                    <div class="feature">✅ Track stocks, ETFs, and cryptocurrencies</div>
                    <div class="feature">✅ Monitor real-time prices and performance</div>
                    <div class="feature">✅ Analyze your investment returns</div>
                    <p style="text-align: center;">
                        <a href="{settings.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
                    </p>
                    <p>If you have any questions or need help getting started, feel free to reach out!</p>
                </div>
                <div class="footer">
                    <p>&copy; 2025 Portfolium. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Account Verified!
        
        Hi {username},
        
        Your email has been successfully verified! You now have full access to Portfolium.
        
        What you can do now:
        - Create and manage multiple portfolios
        - Track stocks, ETFs, and cryptocurrencies
        - Monitor real-time prices and performance
        - Analyze your investment returns
        
        Visit your dashboard: {settings.FRONTEND_URL}/dashboard
        
        If you have any questions or need help getting started, feel free to reach out!
        
        © 2025 Portfolium. All rights reserved.
        """
        
        return self._send_email(to_email, subject, html_content, text_content)


# Singleton instance
email_service = EmailService()
