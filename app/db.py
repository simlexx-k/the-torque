from __future__ import annotations

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings
from app.public_ids import generate_listing_public_id


class Base(DeclarativeBase):
    pass


def _engine_kwargs(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    return {"pool_pre_ping": True}


settings = get_settings()
engine = create_engine(settings.database_url, **_engine_kwargs(settings.database_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _ensure_listing_public_ids() -> None:
    """Apply the additive public-id compatibility migration without Alembic.

    Existing installations keep their integer primary keys and existing API
    semantics. The migration only adds/backfills the new public_id column and a
    unique index. Fresh databases already receive the column via metadata.
    """
    inspector = inspect(engine)
    if "listings" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("listings")}
    with engine.begin() as connection:
        if "public_id" not in column_names:
            connection.exec_driver_sql("ALTER TABLE listings ADD COLUMN public_id VARCHAR(26)")

        rows = connection.execute(
            text("SELECT id FROM listings WHERE public_id IS NULL OR public_id = '' ORDER BY id")
        ).all()
        for (listing_id,) in rows:
            # 128 random bits make collisions astronomically unlikely. The
            # update predicate also prevents overwriting a value if startup is
            # ever raced by another process.
            connection.execute(
                text(
                    "UPDATE listings SET public_id = :public_id "
                    "WHERE id = :listing_id AND (public_id IS NULL OR public_id = '')"
                ),
                {"listing_id": listing_id, "public_id": generate_listing_public_id()},
            )

        # Supported by both PostgreSQL and SQLite. IF NOT EXISTS makes this safe
        # for fresh schemas where SQLAlchemy already created the index.
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_listings_public_id ON listings (public_id)"
        )


def _ensure_listing_intelligence_schema() -> None:
    """Add market-intelligence columns without changing legacy listing ids."""
    inspector = inspect(engine)
    if "listings" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("listings")}
    additions = {
        "fingerprint": "VARCHAR(64)",
        "canonical_listing_id": "INTEGER",
        "first_seen_at": "TIMESTAMP",
        "last_seen_at": "TIMESTAMP",
    }
    with engine.begin() as connection:
        for name, sql_type in additions.items():
            if name not in column_names:
                connection.exec_driver_sql(f"ALTER TABLE listings ADD COLUMN {name} {sql_type}")

        connection.execute(
            text(
                "UPDATE listings SET first_seen_at = created_at "
                "WHERE first_seen_at IS NULL"
            )
        )
        connection.execute(
            text(
                "UPDATE listings SET last_seen_at = created_at "
                "WHERE last_seen_at IS NULL"
            )
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_listings_fingerprint ON listings (fingerprint)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_listings_canonical_listing_id ON listings (canonical_listing_id)"
        )


def _backfill_listing_intelligence() -> None:
    from app.listing_intelligence import register_listing_intelligence
    from app.models import Listing, ListingSnapshot

    with SessionLocal() as session:
        rows = list(session.scalars(select(Listing).order_by(Listing.created_at.asc(), Listing.id.asc())).all())
        changed = False
        for listing in rows:
            has_snapshot = session.scalar(
                select(ListingSnapshot.id).where(ListingSnapshot.source_listing_id == listing.id)
            )
            if listing.canonical_listing_id is None or listing.fingerprint is None or has_snapshot is None:
                register_listing_intelligence(session, listing)
                session.flush()
                changed = True
        if changed:
            session.commit()


def create_db() -> None:
    from app import models  # noqa: F401

    # New tables (such as listing_snapshots) are created normally. Existing
    # listing installations are upgraded with small additive ALTER statements.
    Base.metadata.create_all(bind=engine)
    _ensure_listing_public_ids()
    _ensure_listing_intelligence_schema()
    _backfill_listing_intelligence()


def session_scope() -> Session:
    return SessionLocal()
