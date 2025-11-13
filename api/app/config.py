"""
Application configuration
"""
import os
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, model_validator
from typing_extensions import Self


class Settings(BaseSettings):
    """Application settings from environment variables"""
    model_config = SettingsConfigDict(
        # Don't specify env_file when running in Docker - environment variables are injected by docker-compose
        # For local development outside Docker, you can set environment variables or use python-dotenv
        case_sensitive=True,
        extra='ignore',  # Ignore unrelated env vars (e.g., frontend VITE_* keys)
    )
    
    # Database
    POSTGRES_DB: str = "portfolium"
    POSTGRES_USER: str = "portfolium"
    POSTGRES_PASSWORD: str = "portfolium"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    
    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_KEY: str = "dev-key-12345"
    
    # JWT Authentication
    SECRET_KEY: str = "your-secret-key-change-this-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Email Configuration (SMTP)
    ENABLE_EMAIL: bool = False  # Set to True to enable email sending
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""  # Your SMTP username (email address)
    SMTP_PASSWORD: str = ""  # Your SMTP password or app password
    SMTP_TLS: bool = True
    FROM_EMAIL: str = "noreply@example.com"
    FROM_NAME: str = "Portfolium"
    
    # Frontend URL (for email links)
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Price caching
    PRICE_CACHE_TTL_SECONDS: int = 300
    
    # Transaction validation
    VALIDATE_SELL_QUANTITY: bool = True  # Check if selling more shares than owned
    
    # Brandfetch API (for fetching company logos)
    BRANDFETCH_API_KEY: str = ""  # Optional: Leave empty to disable logo fetching
    
    # CORS - can be comma-separated string or list
    CORS_ORIGINS: Union[List[str], str] = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    # Admin bootstrap settings
    ADMIN_AUTO_CREATE: bool = True
    ADMIN_EMAIL: str | None = None
    ADMIN_USERNAME: str | None = None
    ADMIN_PASSWORD: str | None = None
    ADMIN_FULL_NAME: str | None = None
    ADMIN_IS_ACTIVE: bool = True
    ADMIN_IS_VERIFIED: bool = True
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS_ORIGINS from comma-separated string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',') if origin.strip()]
        return v
    
    @model_validator(mode='after')
    def validate_settings(self) -> Self:
        """Validate settings on startup"""
        errors = []
        
        # 1. Validate JWT secret key length
        if len(self.SECRET_KEY) < 32:
            errors.append(
                "SECRET_KEY must be at least 32 characters for security. "
                f"Current length: {len(self.SECRET_KEY)}"
            )
        
        # 2. Warn if using default/example secret key
        if self.SECRET_KEY in [
            "your-secret-key-change-this-in-production-min-32-chars",
            "dev-key-12345",
            "change-this"
        ]:
            errors.append(
                "SECRET_KEY is using a default value. "
                "Please set a unique secret key in production!"
            )
        
        # 3. Validate email configuration if enabled
        if self.ENABLE_EMAIL:
            if not self.SMTP_HOST:
                errors.append("Email enabled but SMTP_HOST is not set")
            if not self.SMTP_USER:
                errors.append("Email enabled but SMTP_USER is not set")
            if not self.SMTP_PASSWORD:
                errors.append("Email enabled but SMTP_PASSWORD is not set")
            if not self.FROM_EMAIL or self.FROM_EMAIL == "noreply@example.com":
                errors.append("Email enabled but FROM_EMAIL is not properly configured")
            if not self.FRONTEND_URL or self.FRONTEND_URL == "http://localhost:5173":
                # Warning only, not critical
                print(
                    "⚠️  WARNING: FRONTEND_URL is using default localhost value. "
                    "Email links may not work in production."
                )
        
        # 4. Validate admin bootstrap configuration
        if self.ADMIN_AUTO_CREATE:
            if not self.ADMIN_EMAIL:
                errors.append("ADMIN_AUTO_CREATE is enabled but ADMIN_EMAIL is not set")
            if not self.ADMIN_USERNAME:
                errors.append("ADMIN_AUTO_CREATE is enabled but ADMIN_USERNAME is not set")
            if not self.ADMIN_PASSWORD:
                errors.append("ADMIN_AUTO_CREATE is enabled but ADMIN_PASSWORD is not set")
            elif len(self.ADMIN_PASSWORD) < 8:
                errors.append(
                    "ADMIN_PASSWORD must be at least 8 characters. "
                    f"Current length: {len(self.ADMIN_PASSWORD)}"
                )
        
        # 5. Validate database configuration
        if not self.POSTGRES_DB:
            errors.append("POSTGRES_DB is required")
        if not self.POSTGRES_USER:
            errors.append("POSTGRES_USER is required")
        if not self.POSTGRES_PASSWORD:
            errors.append("POSTGRES_PASSWORD is required")
        if not self.POSTGRES_HOST:
            errors.append("POSTGRES_HOST is required")
        
        # 6. Validate port numbers
        if self.POSTGRES_PORT < 1 or self.POSTGRES_PORT > 65535:
            errors.append(f"POSTGRES_PORT must be between 1 and 65535. Current: {self.POSTGRES_PORT}")
        if self.API_PORT < 1 or self.API_PORT > 65535:
            errors.append(f"API_PORT must be between 1 and 65535. Current: {self.API_PORT}")
        if self.SMTP_PORT < 1 or self.SMTP_PORT > 65535:
            errors.append(f"SMTP_PORT must be between 1 and 65535. Current: {self.SMTP_PORT}")
        
        # 7. Validate token expiration (reasonable bounds)
        if self.ACCESS_TOKEN_EXPIRE_MINUTES < 5:
            errors.append(
                "ACCESS_TOKEN_EXPIRE_MINUTES must be at least 5 minutes. "
                f"Current: {self.ACCESS_TOKEN_EXPIRE_MINUTES}"
            )
        if self.ACCESS_TOKEN_EXPIRE_MINUTES > 60 * 24 * 365:  # 1 year
            print(
                f"⚠️  WARNING: ACCESS_TOKEN_EXPIRE_MINUTES is set to {self.ACCESS_TOKEN_EXPIRE_MINUTES} minutes "
                f"({self.ACCESS_TOKEN_EXPIRE_MINUTES / 60 / 24:.0f} days). "
                "This is very long and may pose a security risk."
            )
        
        # 8. Validate cache TTL
        if self.PRICE_CACHE_TTL_SECONDS < 0:
            errors.append(
                "PRICE_CACHE_TTL_SECONDS cannot be negative. "
                f"Current: {self.PRICE_CACHE_TTL_SECONDS}"
            )
        
        # 9. Validate CORS origins
        if not self.CORS_ORIGINS:
            print("⚠️  WARNING: CORS_ORIGINS is empty. API will not accept requests from any frontend.")
        elif isinstance(self.CORS_ORIGINS, list):
            for origin in self.CORS_ORIGINS:
                if not origin.startswith(('http://', 'https://')):
                    errors.append(
                        f"CORS origin '{origin}' must start with http:// or https://"
                    )
        
        # If any critical errors, raise ValueError
        if errors:
            error_message = "Configuration validation failed:\n" + "\n".join(f"  - {error}" for error in errors)
            raise ValueError(error_message)
        
        return self
    
    @property
    def database_url(self) -> str:
        """Construct database URL"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
settings = Settings()
