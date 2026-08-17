from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Listing, ListingSnapshot


FINGERPRINT_VERSION = "v1"


def _normalise(value: object | None) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().lower().split())


def _mileage_bucket(value: int | None) -> str:
    if value is None or value < 0:
        return ""
    # Mileage is useful for distinguishing otherwise similar cars, but exact
    # odometer values can change between reposts. A 5,000 km bucket keeps the
    # signal stable while remaining conservative.
    return str(int(round(value / 5000)) * 5000)


def build_listing_fingerprint(listing: Listing) -> str | None:
    """Return a conservative fingerprint for likely repost detection.

    The fingerprint deliberately ignores price and location because those can
    change between seller reposts. It requires make/model/year plus at least two
    further identity signals before it will classify two listings as likely the
    same vehicle. Low-information listings therefore remain independent.
    """
    make = _normalise(listing.make)
    model = _normalise(listing.model)
    year = _normalise(listing.year)
    if not make or not model or not year:
        return None

    optional = [
        _normalise(listing.generation),
        _normalise(listing.variant),
        _normalise(listing.engine_cc),
        _normalise(listing.transmission),
        _normalise(listing.drivetrain),
        _normalise(listing.colour),
        _mileage_bucket(listing.mileage_km),
    ]
    if sum(bool(value) for value in optional) < 2:
        return None

    raw = "|".join([FINGERPRINT_VERSION, make, model, year, *optional])
    return sha256(raw.encode("utf-8")).hexdigest()


def register_listing_intelligence(session: Session, listing: Listing) -> None:
    """Attach one listing observation to its conservative canonical cluster."""
    if listing.id is None:
        session.flush()

    observed_at = listing.created_at or datetime.utcnow()
    listing.fingerprint = build_listing_fingerprint(listing)
    listing.first_seen_at = listing.first_seen_at or observed_at
    listing.last_seen_at = observed_at

    canonical_id = listing.id
    if listing.fingerprint:
        existing = session.scalar(
            select(Listing)
            .where(Listing.fingerprint == listing.fingerprint, Listing.id != listing.id)
            .order_by(Listing.created_at.asc(), Listing.id.asc())
            .limit(1)
        )
        if existing is not None:
            canonical_id = existing.canonical_listing_id or existing.id
            root = session.get(Listing, canonical_id)
            if root is not None:
                listing.first_seen_at = root.first_seen_at or root.created_at or observed_at
                root.last_seen_at = observed_at

    listing.canonical_listing_id = canonical_id
    session.flush()

    existing_snapshot = session.scalar(
        select(ListingSnapshot).where(ListingSnapshot.source_listing_id == listing.id)
    )
    if existing_snapshot is None:
        session.add(
            ListingSnapshot(
                canonical_listing_id=canonical_id,
                source_listing_id=listing.id,
                observed_at=observed_at,
                price=listing.price,
                currency=listing.currency,
                mileage_km=listing.mileage_km,
                status=listing.status,
            )
        )


def summarise_history(snapshots: Sequence[ListingSnapshot]) -> dict:
    rows = sorted(snapshots, key=lambda item: (item.observed_at, item.id or 0))
    if not rows:
        return {
            "first_seen_at": None,
            "last_seen_at": None,
            "days_listed": 0,
            "repost_count": 0,
            "first_price": None,
            "latest_price": None,
            "price_change": None,
            "price_change_percent": None,
            "observations": [],
        }

    first_seen = rows[0].observed_at
    last_seen = rows[-1].observed_at
    elapsed = max(0, (last_seen - first_seen).days)
    priced = [row for row in rows if row.price is not None and row.price > 0]
    first_price = priced[0].price if priced else None
    latest_price = priced[-1].price if priced else None
    price_change = None
    price_change_percent = None
    if first_price is not None and latest_price is not None:
        price_change = latest_price - first_price
        price_change_percent = round((price_change / first_price) * 100, 1)

    return {
        "first_seen_at": first_seen,
        "last_seen_at": last_seen,
        "days_listed": elapsed,
        "repost_count": max(0, len({row.source_listing_id for row in rows}) - 1),
        "first_price": first_price,
        "latest_price": latest_price,
        "price_change": price_change,
        "price_change_percent": price_change_percent,
        "observations": [
            {
                "observed_at": row.observed_at,
                "price": row.price,
                "currency": row.currency,
                "mileage_km": row.mileage_km,
                "status": row.status,
            }
            for row in rows
        ],
    }
