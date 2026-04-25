"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "VeriCash API"
    debug: bool = True
    secret_key: str = "change-me-in-prod-please-use-a-long-random-string"
    access_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"

    database_url: str = "sqlite+aiosqlite:///./vericash.db"
    upload_dir: str = "./uploads"
    max_upload_mb: int = 10

    # Detection thresholds (calibrated for phone-camera captures)
    authentic_threshold: float = 0.60
    suspicious_threshold: float = 0.38

    cors_origins: str = "*"


settings = Settings()
