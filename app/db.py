from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import Settings, get_settings


class Base(DeclarativeBase):
    pass


def build_database_target(settings: Settings) -> str | URL:
    """Return a SQLAlchemy database target without interpolating credentials into a URI."""
    if settings.database_host:
        return URL.create(
            drivername="postgresql+psycopg",
            username=settings.database_user or None,
            password=settings.database_password or None,
            host=settings.database_host,
            port=settings.database_port,
            database=settings.database_name or None,
        )
    return settings.database_url


def _engine_kwargs(url: str | URL) -> dict:
    if str(url).startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    return {"pool_pre_ping": True}


settings = get_settings()
database_target = build_database_target(settings)
engine = create_engine(database_target, **_engine_kwargs(database_target))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def create_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def session_scope() -> Session:
    return SessionLocal()
