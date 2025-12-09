"""
Two-Factor Authentication (TOTP) Service
Handles TOTP generation, validation, QR code creation, and backup codes
"""
import secrets
import hashlib
import json
import base64
import logging
from io import BytesIO
from typing import List, Tuple, Optional

import pyotp
import qrcode
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User

logger = logging.getLogger(__name__)


class TOTPService:
    """Service for managing TOTP-based two-factor authentication"""
    
    @staticmethod
    def generate_secret() -> str:
        """
        Generate a new random TOTP secret
        Returns: Base32-encoded secret string
        """
        return pyotp.random_base32()
    
    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        """
        Generate backup codes for 2FA recovery
        Args:
            count: Number of backup codes to generate (default: 10)
        Returns: List of backup codes (e.g., ['ABCD-EFGH-IJKL', ...])
        """
        codes = []
        for _ in range(count):
            # Generate 12-character alphanumeric code in format XXXX-XXXX-XXXX
            code = secrets.token_hex(6).upper()
            formatted = f"{code[0:4]}-{code[4:8]}-{code[8:12]}"
            codes.append(formatted)
        return codes
    
    @staticmethod
    def hash_backup_code(code: str) -> str:
        """
        Hash a backup code for secure storage
        Args:
            code: Plain backup code
        Returns: SHA256 hash of the code
        """
        return hashlib.sha256(code.encode()).hexdigest()
    
    @staticmethod
    def verify_backup_code(code: str, hashed_codes: List[str]) -> bool:
        """
        Verify a backup code against stored hashes
        Args:
            code: Plain backup code to verify
            hashed_codes: List of hashed backup codes
        Returns: True if code is valid
        """
        code_hash = TOTPService.hash_backup_code(code)
        return code_hash in hashed_codes
    
    @staticmethod
    def remove_used_backup_code(code: str, hashed_codes: List[str]) -> List[str]:
        """
        Remove a used backup code from the list
        Args:
            code: Plain backup code that was used
            hashed_codes: List of hashed backup codes
        Returns: Updated list of hashed codes
        """
        code_hash = TOTPService.hash_backup_code(code)
        return [h for h in hashed_codes if h != code_hash]
    
    @staticmethod
    def generate_qr_code(secret: str, user_email: str, issuer: str = "Portfolium") -> str:
        """
        Generate QR code for TOTP setup
        Args:
            secret: TOTP secret
            user_email: User's email address
            issuer: Application name (default: Portfolium)
        Returns: Base64-encoded PNG image
        """
        # Generate provisioning URI
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(
            name=user_email,
            issuer_name=issuer
        )
        
        # Create QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(uri)
        qr.make(fit=True)
        
        # Generate image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    @staticmethod
    def verify_token(secret: str, token: str, valid_window: int = 4) -> bool:
        """
        Verify a TOTP token
        Args:
            secret: User's TOTP secret
            token: 6-digit token to verify
            valid_window: Number of time steps to check before/after current (default: 4 = ±2 minutes)
        Returns: True if token is valid
        """
        try:
            # Strip whitespace and validate format
            token = token.strip()
            if not token.isdigit() or len(token) != 6:
                return False
            
            totp = pyotp.TOTP(secret)
            return totp.verify(token, valid_window=valid_window)
        except Exception as e:
            logger.error(f"Error verifying TOTP token: {e}")
            return False
    
    @staticmethod
    def setup_totp(user: User, db: Session) -> Tuple[str, str, List[str]]:
        """
        Initialize TOTP setup for a user
        Args:
            user: User model instance
            db: Database session
        Returns: Tuple of (secret, qr_code_data_url, backup_codes)
        """
        # Generate secret and backup codes
        secret = TOTPService.generate_secret()
        backup_codes = TOTPService.generate_backup_codes()
        
        # Hash backup codes for storage
        hashed_codes = [TOTPService.hash_backup_code(code) for code in backup_codes]
        
        # Store secret and hashed backup codes (but don't enable yet)
        user.totp_secret = secret
        user.totp_backup_codes = json.dumps(hashed_codes)
        user.totp_enabled = False  # User must verify before enabling
        db.commit()
        
        # Generate QR code
        qr_code = TOTPService.generate_qr_code(secret, user.email)
        
        return secret, qr_code, backup_codes
    
    @staticmethod
    def enable_totp(user: User, token: str, db: Session) -> bool:
        """
        Enable TOTP after successful verification
        Args:
            user: User model instance
            token: 6-digit token to verify
            db: Database session
        Returns: True if enabled successfully
        """
        if not user.totp_secret:
            return False
        
        # Verify token
        if not TOTPService.verify_token(user.totp_secret, token):
            return False
        
        # Enable 2FA
        user.totp_enabled = True
        db.commit()
        return True
    
    @staticmethod
    def disable_totp(user: User, db: Session) -> None:
        """
        Disable TOTP for a user
        Args:
            user: User model instance
            db: Database session
        """
        user.totp_enabled = False
        user.totp_secret = None
        user.totp_backup_codes = None
        db.commit()
    
    @staticmethod
    def verify_totp_or_backup(user: User, token: str, db: Session) -> bool:
        """
        Verify TOTP token or backup code
        Args:
            user: User model instance
            token: Token or backup code to verify
            db: Database session
        Returns: True if valid
        """
        if not user.totp_enabled or not user.totp_secret:
            return False
        
        # Try TOTP token first
        if TOTPService.verify_token(user.totp_secret, token):
            return True
        
        # Try backup code
        if user.totp_backup_codes:
            try:
                hashed_codes = json.loads(user.totp_backup_codes)
                if TOTPService.verify_backup_code(token, hashed_codes):
                    # Remove used backup code
                    updated_codes = TOTPService.remove_used_backup_code(token, hashed_codes)
                    user.totp_backup_codes = json.dumps(updated_codes)
                    db.commit()
                    return True
            except (json.JSONDecodeError, TypeError):
                pass
        
        return False
    
    @staticmethod
    def get_backup_codes_remaining(user: User) -> int:
        """
        Get count of remaining backup codes
        Args:
            user: User model instance
        Returns: Number of backup codes remaining
        """
        if not user.totp_backup_codes:
            return 0
        
        try:
            hashed_codes = json.loads(user.totp_backup_codes)
            return len(hashed_codes)
        except (json.JSONDecodeError, TypeError):
            return 0


# Singleton instance
totp_service = TOTPService()
