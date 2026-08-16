from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "The Torque"
    environment: str = "development"
    database_url: str = "sqlite:///./the_torque.db"

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
