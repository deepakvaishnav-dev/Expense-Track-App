import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator, field_validator

DEFAULT_INSECURE_KEYS = {
    "SECRET_KEY": "supersecretaccesskeychangeitinproduction1234567890",
    "REFRESH_SECRET_KEY": "supersecretrefreshkeychangeitinproduction0987654321",
    "ENCRYPTION_KEY": "y1B9N8Wq6M4w8E-XjA4Vn5K6jV4W4l7R4x1D8f9V2s0=",
}

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    # Database Settings
    DATABASE_URL: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/expense_tracker")
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v
    
    # Security Settings
    SECRET_KEY: str = Field(default=DEFAULT_INSECURE_KEYS["SECRET_KEY"])
    REFRESH_SECRET_KEY: str = Field(default=DEFAULT_INSECURE_KEYS["REFRESH_SECRET_KEY"])
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # AES Encryption Key (must be a 32-byte URL-safe base64 key for Fernet)
    ENCRYPTION_KEY: str = Field(default=DEFAULT_INSECURE_KEYS["ENCRYPTION_KEY"])

    # Gemini AI Settings
    GEMINI_API_KEY: str = Field(default="")

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """
        Enforces strict fail-fast validation in production environments.
        Prevents deployment with default fallback or weak cryptographic secrets.
        """
        env = (self.ENVIRONMENT or "").lower().strip()
        if env == "production":
            insecure_findings = []

            # Check SECRET_KEY
            if not self.SECRET_KEY or self.SECRET_KEY == DEFAULT_INSECURE_KEYS["SECRET_KEY"] or "changeit" in self.SECRET_KEY.lower() or len(self.SECRET_KEY) < 32:
                insecure_findings.append("SECRET_KEY is using a default development placeholder or is under 32 characters.")

            # Check REFRESH_SECRET_KEY
            if not self.REFRESH_SECRET_KEY or self.REFRESH_SECRET_KEY == DEFAULT_INSECURE_KEYS["REFRESH_SECRET_KEY"] or "changeit" in self.REFRESH_SECRET_KEY.lower() or len(self.REFRESH_SECRET_KEY) < 32:
                insecure_findings.append("REFRESH_SECRET_KEY is using a default development placeholder or is under 32 characters.")

            # Check ENCRYPTION_KEY
            if not self.ENCRYPTION_KEY or self.ENCRYPTION_KEY == DEFAULT_INSECURE_KEYS["ENCRYPTION_KEY"] or len(self.ENCRYPTION_KEY) < 32:
                insecure_findings.append("ENCRYPTION_KEY is using the default development Fernet key.")

            if insecure_findings:
                error_msg = (
                    "CRITICAL PRODUCTION SECURITY ERROR: Cannot start application with insecure keys:\n"
                    + "\n".join(f"- {f}" for f in insecure_findings)
                    + "\nPlease provide strong, distinct secrets in production environment variables."
                )
                raise ValueError(error_msg)

        return self

settings = Settings()
