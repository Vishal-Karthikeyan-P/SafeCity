"""
Application Configuration — pydantic-settings
"""
import json
from typing import Any, List, Optional, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────
    APP_NAME: str = "SafeCity"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://safecity:safecity_pass@localhost:5432/safecitydb"
    DATABASE_URL_SYNC: Optional[str] = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL_SYNC:
            return self.DATABASE_URL_SYNC.replace("postgresql+asyncpg://", "postgresql://")
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    # ── Security ──────────────────────────────────────────────
    SECRET_KEY: str = "change-me-to-a-very-long-random-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ──────────────────────────────────────────────────
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:80",
        "http://localhost",
        "https://safe-city-web.vercel.app",
        "https://safecity-web.vercel.app",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        origins: List[str] = []
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    origins = [str(item).strip().rstrip("/") for item in parsed if item]
                elif isinstance(parsed, str):
                    origins = [parsed.strip().rstrip("/")]
            except Exception:
                origins = [i.strip().rstrip("/") for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            origins = [str(i).strip().rstrip("/") for i in v if i]
        return origins

    # ── Routing / OSRM ─────────────────────────────────────────
    OSRM_BASE_URL: str = "http://router.project-osrm.org/route/v1/driving"

    # ── File Storage ──────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # ── Email / SMTP ─────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None       # Sender email address / SMTP login
    SMTP_PASSWORD: Optional[str] = None       # SMTP password or app password
    SMTP_FROM_EMAIL: Optional[str] = None     # Email displayed as From address
    SMTP_FROM_NAME: str = "SafeCity"          # Display name in From header
    OTP_EXPIRY_MINUTES: int = 10              # OTP validity period in minutes

    # Legacy aliases (kept for backward compatibility)
    SMTP_USER: Optional[str] = None
    EMAILS_FROM_EMAIL: str = "noreply@safecity.io"

    # ── Gemini AI & Chatbot ───────────────────────────────────
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_MAX_OUTPUT_TOKENS: int = 800
    GEMINI_TEMPERATURE: float = 0.2
    GEMINI_TIMEOUT_SECONDS: float = 15.0
    CHATBOT_RATE_LIMIT_PER_MINUTE: int = 20
    CHATBOT_MAX_MESSAGE_LENGTH: int = 600

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
