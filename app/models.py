from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.public_ids import generate_listing_public_id


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(20), default="x")
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    x_user_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    last_seen_post_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    posts: Mapped[list["Post"]] = relationship(back_populates="source", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), index=True)
    x_post_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    conversation_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    x_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    classification: Mapped[str] = mapped_column(String(40), default="unclassified", index=True)
    ai_status: Mapped[str] = mapped_column(String(24), default="pending")
    ai_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    source: Mapped[Source] = relationship(back_populates="posts")
    media: Mapped[list["Media"]] = relationship(back_populates="post", cascade="all, delete-orphan")
    listings: Mapped[list["Listing"]] = relationship(back_populates="post", cascade="all, delete-orphan")


class Media(Base):
    __tablename__ = "media"
    __table_args__ = (UniqueConstraint("post_id", "media_key", name="uq_post_media_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    media_key: Mapped[str] = mapped_column(String(80))
    media_type: Mapped[str] = mapped_column(String(20))
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alt_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    post: Mapped[Post] = relationship(back_populates="media")


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (UniqueConstraint("post_id", "position", name="uq_post_listing_position"),)

    # Keep the integer primary key internal for joins and backwards-compatible
    # API clients. Public web routes use the independent random public_id.
    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(
        String(26),
        unique=True,
        index=True,
        default=generate_listing_public_id,
    )
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    make: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    model: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    generation: Mapped[str | None] = mapped_column(String(80), nullable=True)
    variant: Mapped[str | None] = mapped_column(String(120), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    body_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    fuel: Mapped[str | None] = mapped_column(String(40), nullable=True)
    engine_cc: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transmission: Mapped[str | None] = mapped_column(String(80), nullable=True)
    drivetrain: Mapped[str | None] = mapped_column(String(40), nullable=True)
    colour: Mapped[str | None] = mapped_column(String(60), nullable=True)
    mileage_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    currency: Mapped[str | None] = mapped_column(String(12), nullable=True)
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="available", index=True)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    features: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    observations: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    post: Mapped[Post] = relationship(back_populates="listings")
