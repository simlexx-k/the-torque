from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "The Torque"
    environment: str = "development"
    database_url: str = "sqlite:///./the_torque.db"
    admin_api_key: str = ""

    # Network hardening. Keep CORS empty when the Vercel server-side proxy is used.
    cors_allowed_origins: str = ""
    trusted_hosts: str = "*"
    # API discovery surfaces are off by default. Enable only on a trusted
    # development/operator deployment, never on the public API hostname.
    api_docs_enabled: bool = False

    x_bearer_token: str = ""
    x_target_username: str = ""
    x_exclude_replies: bool = False
    x_exclude_retweets: bool = True
    x_max_pages_per_poll: int = Field(default=5, ge=1, le=20)
    initial_lookback_posts: int = Field(default=100, ge=5, le=100)

    # Multimodal enrichment. Gemini is the default because it supports image
    # understanding + structured JSON and has a useful free developer tier.
    ai_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    ai_max_images: int = Field(default=6, ge=0, le=8)
    ai_retry_batch_size: int = Field(default=10, ge=1, le=100)
    ai_retry_max_attempts: int = Field(default=5, ge=1, le=20)

    # Optional backwards-compatible provider. Not required when AI_PROVIDER=gemini.
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

    @field_validator("ai_provider")
    @classmethod
    def validate_ai_provider(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"gemini", "openai"}:
            raise ValueError("AI_PROVIDER must be gemini or openai")
        return value

    @field_validator("openai_image_detail")
    @classmethod
    def validate_image_detail(cls, value: str) -> str:
        value = value.lower()
        if value not in {"low", "high", "auto"}:
            raise ValueError("OPENAI_IMAGE_DETAIL must be low, high, or auto")
        return value

    @property
    def ai_configured(self) -> bool:
        if self.ai_provider == "gemini":
            return bool(self.gemini_api_key)
        if self.ai_provider == "openai":
            return bool(self.openai_api_key)
        return False

    @property
    def ai_model(self) -> str:
        return self.gemini_model if self.ai_provider == "gemini" else self.openai_model

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
