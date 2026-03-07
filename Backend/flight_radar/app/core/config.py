"""
Application configuration loaded from environment variables via Pydantic Settings.
All sensitive values (API keys, secrets) MUST be provided via environment or .env file.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────
    APP_NAME: str = "FlightRadar Intelligence Backend"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # ── Server ─────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    WORKER_TIMEOUT: int = 120
    API_PREFIX: str = "/api/v1"
    ENABLE_LEGACY_UNPREFIXED_ROUTES: bool = True

    # ── Security / JWT ─────────────────────────────────────────────
    SECRET_KEY: str = Field(..., description="JWT signing secret, min 32 chars")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    AUTH_USERNAME: str = "admin"
    AUTH_PASSWORD_HASH: str | None = Field(
        default=None,
        description="bcrypt hash for AUTH_USERNAME password",
    )

    # ── Redis ──────────────────────────────────────────────────────
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None
    REDIS_MAX_CONNECTIONS: int = 20
    REDIS_SOCKET_TIMEOUT: float = 5.0
    REDIS_SOCKET_CONNECT_TIMEOUT: float = 3.0
    REDIS_HEALTH_CHECK_INTERVAL: int = 30

    # ── OpenSky API ────────────────────────────────────────────────
    OPENSKY_URL: str = "https://opensky-network.org/api/states/all"
    OPENSKY_USERNAME: str | None = None
    OPENSKY_PASSWORD: str | None = None
    OPENSKY_TIMEOUT: float = 15.0
    OPENSKY_POLL_INTERVAL: int = 15
    OPENSKY_MAX_RETRIES: int = 3
    OPENSKY_BACKOFF_FACTOR: float = 2.0
    OPENSKY_CB_FAILURE_THRESHOLD: int = 5
    OPENSKY_CB_RECOVERY_TIMEOUT: int = 60

    # ── OpenWeather API ────────────────────────────────────────────
    OPENWEATHER_API_KEY: str = Field(..., description="OpenWeatherMap API key")
    OPENWEATHER_BASE_URL: str = "https://api.openweathermap.org/data/2.5/weather"
    OPENWEATHER_TIMEOUT: float = 10.0
    OPENWEATHER_POLL_INTERVAL: int = 300
    OPENWEATHER_MAX_RETRIES: int = 3
    OPENWEATHER_BACKOFF_FACTOR: float = 2.0
    OPENWEATHER_CB_FAILURE_THRESHOLD: int = 5
    OPENWEATHER_CB_RECOVERY_TIMEOUT: int = 120
    OPENWEATHER_CACHE_TTL: int = 600

    # ── Airspace Bounds (India) ────────────────────────────────────
    AIRSPACE_MIN_LAT: float = 6.0
    AIRSPACE_MAX_LAT: float = 38.0
    AIRSPACE_MIN_LON: float = 68.0
    AIRSPACE_MAX_LON: float = 98.0
    WEATHER_GRID_STEP: int = 3

    # ── Conflict Engine ────────────────────────────────────────────
    CONFLICT_H_SEP_KM: float = 10.0
    CONFLICT_V_SEP_FT: float = 1000.0
    CONFLICT_LOOKAHEAD_SECONDS: int = 600
    CONFLICT_GRID_H_CELL_KM: float = 10.0
    CONFLICT_GRID_V_CELL_FT: float = 1000.0

    # ── Rate Limiting ──────────────────────────────────────────────
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 60
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ── Logging ───────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: Literal["json", "text"] = "json"
    CORS_ALLOWED_ORIGINS: str = ""

    # ── Metrics ───────────────────────────────────────────────────
    METRICS_ENABLED: bool = True

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {allowed}")
        return upper

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @field_validator("AUTH_USERNAME")
    @classmethod
    def validate_auth_username(cls, v: str) -> str:
        username = v.strip()
        if not username:
            raise ValueError("AUTH_USERNAME cannot be empty")
        return username

    @field_validator("API_PREFIX")
    @classmethod
    def validate_api_prefix(cls, v: str) -> str:
        prefix = v.strip()
        if not prefix:
            raise ValueError("API_PREFIX cannot be empty")
        if not prefix.startswith("/"):
            raise ValueError("API_PREFIX must start with '/'")
        if len(prefix) > 1 and prefix.endswith("/"):
            prefix = prefix[:-1]
        return prefix

    @property
    def redis_url(self) -> str:
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def cors_allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return cached singleton Settings instance."""
    return Settings()  # type: ignore[call-arg]
