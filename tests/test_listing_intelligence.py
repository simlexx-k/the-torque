from datetime import datetime, timedelta

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app import db as db_module
from app.db import Base
from app.listing_intelligence import build_listing_fingerprint, register_listing_intelligence, summarise_history
from app.models import Listing, ListingSnapshot


def _listing(**overrides):
    values = {
        "post_id": 1,
        "position": 0,
        "make": "Toyota",
        "model": "Premio",
        "year": 2014,
        "generation": "T260",
        "variant": "1.8",
        "engine_cc": 1800,
        "transmission": "Automatic",
        "drivetrain": "FWD",
        "colour": "Silver",
        "mileage_km": 84200,
        "price": 1250000,
        "currency": "KES",
        "location": "Nairobi",
        "status": "available",
        "evidence": {},
        "features": [],
        "observations": [],
    }
    values.update(overrides)
    return Listing(**values)


def test_fingerprint_ignores_price_and_location_for_reposts():
    first = _listing(price=1250000, location="Nairobi", mileage_km=84200)
    repost = _listing(price=1180000, location="Kiambu", mileage_km=85100)
    assert build_listing_fingerprint(first) == build_listing_fingerprint(repost)


def test_fingerprint_refuses_low_information_listing():
    listing = _listing(generation=None, variant=None, engine_cc=None, transmission=None, drivetrain=None, colour=None, mileage_km=None)
    assert build_listing_fingerprint(listing) is None


def test_register_preserves_source_rows_and_builds_history():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    start = datetime(2026, 8, 1, 10, 0, 0)

    with Session(engine) as session:
        first = _listing(post_id=10, created_at=start, price=1250000)
        session.add(first)
        session.flush()
        register_listing_intelligence(session, first)
        session.flush()

        repost = _listing(post_id=11, created_at=start + timedelta(days=8), price=1180000, mileage_km=85000)
        session.add(repost)
        session.flush()
        register_listing_intelligence(session, repost)
        session.commit()

        assert first.id != repost.id
        assert first.canonical_listing_id == first.id
        assert repost.canonical_listing_id == first.id

        snapshots = list(
            session.scalars(
                select(ListingSnapshot)
                .where(ListingSnapshot.canonical_listing_id == first.id)
                .order_by(ListingSnapshot.observed_at)
            ).all()
        )
        summary = summarise_history(snapshots)
        assert len(snapshots) == 2
        assert summary["repost_count"] == 1
        assert summary["first_price"] == 1250000
        assert summary["latest_price"] == 1180000
        assert summary["price_change"] == -70000
        assert summary["days_listed"] == 8


def test_intelligence_columns_are_added_without_renumbering(tmp_path, monkeypatch):
    migration_engine = create_engine(f"sqlite:///{tmp_path / 'legacy-intelligence.db'}")
    with migration_engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE listings (id INTEGER PRIMARY KEY, created_at TIMESTAMP)")
        connection.exec_driver_sql("INSERT INTO listings (id, created_at) VALUES (7, '2026-08-01 10:00:00'), (70, '2026-08-02 10:00:00')")

    monkeypatch.setattr(db_module, "engine", migration_engine)
    db_module._ensure_listing_intelligence_schema()

    columns = {column["name"] for column in inspect(migration_engine).get_columns("listings")}
    assert {"fingerprint", "canonical_listing_id", "first_seen_at", "last_seen_at"}.issubset(columns)

    with migration_engine.connect() as connection:
        rows = connection.execute(text("SELECT id, first_seen_at, last_seen_at FROM listings ORDER BY id")).all()

    assert [row.id for row in rows] == [7, 70]
    assert all(row.first_seen_at is not None for row in rows)
    assert all(row.last_seen_at is not None for row in rows)
