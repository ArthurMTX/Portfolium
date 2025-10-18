"""
Application configuration
"""
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
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
    
    # Price caching
    PRICE_CACHE_TTL_SECONDS: int = 300
    
    # Transaction validation
    VALIDATE_SELL_QUANTITY: bool = True  # Check if selling more shares than owned
    
    # Brandfetch API (for fetching company logos)
    BRANDFETCH_API_KEY: str = ""  # Optional: Leave empty to disable logo fetching
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
    ]
    
    @property
    def database_url(self) -> str:
        """Construct database URL"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
