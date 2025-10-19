"""
Application configuration
"""
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Application settings from environment variables"""
    model_config = SettingsConfigDict(
        env_file="../.env",  # .env file is at project root
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
    FROM_EMAIL: str = "noreply@portfolium.com"
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
    
    @property
    def database_url(self) -> str:
        """Construct database URL"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
settings = Settings()
