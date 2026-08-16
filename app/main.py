from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import SessionLocal, create_db
from app.models import Listing, Post, Source
from app.scheduler import scheduler_loop
from app.service import IngestionService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def get_db():
    with SessionLocal() as session:
        yield session


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    create_db()
    stop_event = asyncio.Event()
    task: asyncio.Task | None = None
    if settings.scheduler_enabled:
        task = asyncio.create_task(scheduler_loop(settings, stop_event))
    app.state.scheduler_stop = stop_event
    app.state.scheduler_task = task
    yield
    stop_event.set()
    if task:
        await task


app = FastAPI(title="The Torque", version="0.1.0", lifespan=lifespan)


@app.get("/")
def root():
    return {"name": "The Torque", "service": "x-vehicle-intelligence", "docs": "/docs"}


@app.get("/health")
def health(settings: Settings = Depends(get_settings)):
    return {
        "status": "ok",
        "scheduler_enabled": settings.scheduler_enabled,
        "target_configured": bool(settings.x_target_username),
        "x_credentials_configured": bool(settings.x_bearer_token),
        "ai_configured": bool(settings.openai_api_key),
    }


@app.get("/api/status")
def status(db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    source = db.scalar(select(Source).where(Source.username == settings.x_target_username)) if settings.x_target_username else None
    return {
        "target": settings.x_target_username or None,
        "x_user_id": source.x_user_id if source else None,
        "last_seen_post_id": source.last_seen_post_id if source else None,
        "source_enabled": source.enabled if source else None,
        "daytime_poll_seconds": settings.daytime_poll_seconds,
        "nighttime_poll_seconds": settings.nighttime_poll_seconds,
        "timezone": settings.scheduler_timezone,
    }


@app.post("/api/ingest/run")
def run_ingestion(db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    try:
        return IngestionService(settings).run_once(db)
    except Exception as exc:
        logger.exception("manual ingestion failed")
        raise HTTPException(status_code=502, detail=str(exc)[:1000]) from exc


@app.get("/api/posts")
def posts(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = db.scalars(select(Post).order_by(desc(Post.x_created_at), desc(Post.id)).limit(limit)).all()
    return [
        {
            "id": row.id,
            "x_post_id": row.x_post_id,
            "text": row.text,
            "created_at": row.x_created_at,
            "classification": row.classification,
            "ai_status": row.ai_status,
            "media": [
                {"type": media.media_type, "url": media.url, "preview_image_url": media.preview_image_url}
                for media in row.media
            ],
        }
        for row in rows
    ]


@app.get("/api/listings")
def listings(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = db.scalars(select(Listing).order_by(desc(Listing.created_at), desc(Listing.id)).limit(limit)).all()
    return [
        {
            "id": row.id,
            "post_id": row.post_id,
            "make": row.make,
            "model": row.model,
            "generation": row.generation,
            "variant": row.variant,
            "year": row.year,
            "price": row.price,
            "currency": row.currency,
            "mileage_km": row.mileage_km,
            "location": row.location,
            "status": row.status,
            "evidence": row.evidence,
            "features": row.features,
            "observations": row.observations,
        }
        for row in rows
    ]
