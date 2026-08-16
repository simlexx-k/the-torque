from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "The Torque"
    environment: str = "development"

    # Local development can continue to use DATABASE_URL (SQLite by default).
    # Production Compose supplies the structured DATABASE_* fields below so
    # passwords never have to be interpolated into a URI.
    database_url: str = "sqlite:///./the_torque.db"
    database_host: str = ""
    database_port: int = Field(default=5432, ge=1, le=65535)
    database_user: str = "thetorque"
    database_password: str = ""
    database_name: str = "thetorque"

    admin_api_key: str = ""

    # Network hardening. Keep CORS empty when the Vercel server-side proxy is used.
    cors_allowed_origins: str = ""
    trusted_hosts: str = "*"

    x_bearer_token: str = ""
    x_target_username: str = ""
    x_exclude_replies: bool = False
    x_exclude_retweets: bool = True
    x_max_pages_per_poll: int = Field(default=5, ge=1, le=20)
    initial_lookback_posts: int = Field(default=100, ge=5, le=100)

    openai_api_key: str = ""
    openai_model: str = "gpt-5.6"
    openai_image_detail: str = "auto"

    scheduler_enabled: bool = True
    scheduler_timezone: str = "Africa/Nairobi"
    daytime_start_hour: int = Field(default=6, ge=0, le=23)
    daytime_end_hour: int = Field(default=22, ge=1, le=24)
    daytime_poll_seconds: int = Field(default=600, ge=60)
    nighttime_poll_seconds: int = Field(default=3600, ge=60)

    @field_validator("x_target_username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lstrip("@")

    @field_validator("openai_image_detail")
    @classmethod
    def validate_image_detail(cls, value: str) -> str:
        value = value.lower()
        if value not in {"low", "high", "auto"}:
            raise ValueError("OPENAI_IMAGE_DETAIL must be low, high, or auto")
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip().rstrip("/") for item in self.cors_allowed_origins.split(",") if item.strip()]

    @property
    def trusted_host_list(self) -> list[str]:
        hosts = [item.strip() for item in self.trusted_hosts.split(",") if item.strip()]
        return hosts or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
