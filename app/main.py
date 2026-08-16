from __future__ import annotations

import asyncio
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import Settings, get_settings
from app.db import SessionLocal, create_db
from app.models import Listing, Post, Source
from app.public_ids import is_legacy_numeric_listing_ref, is_listing_public_id
from app.scheduler import scheduler_loop
from app.service import IngestionService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def get_db():
    with SessionLocal() as session:
        yield session


def require_admin(
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY is not configured")
    if x_admin_key is None or not secrets.compare_digest(x_admin_key, settings.admin_api_key):
        raise HTTPException(status_code=401, detail="Invalid admin key")


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


settings = get_settings()
app = FastAPI(
    title="The Torque",
    version="0.5.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.api_docs_enabled else None,
    redoc_url="/redoc" if settings.api_docs_enabled else None,
    openapi_url="/openapi.json" if settings.api_docs_enabled else None,
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type", "X-Admin-Key"],
        max_age=600,
    )

if settings.trusted_host_list != ["*"]:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.trusted_host_list,
        www_redirect=False,
    )


def _serialize_media(media) -> dict:
    return {
        "type": media.media_type,
        "url": media.url,
        "preview_image_url": media.preview_image_url,
        "width": media.width,
        "height": media.height,
    }


def _post_ai_meta(post: Post) -> dict:
    payload = post.ai_payload if isinstance(post.ai_payload, dict) else {}
    meta = payload.get("_meta") if isinstance(payload.get("_meta"), dict) else {}
    return meta


def _serialize_listing(row: Listing) -> dict:
    post = row.post
    return {
        # id/post_id remain for backwards-compatible API consumers. Public web
        # routes and new clients should use public_id/public_url instead.
        "id": row.id,
        "public_id": row.public_id,
        "public_url": f"/listings/{row.public_id}",
        "post_id": row.post_id,
        "x_url": f"https://x.com/{post.source.username}/status/{post.x_post_id}",
        "make": row.make,
        "model": row.model,
        "generation": row.generation,
        "variant": row.variant,
        "year": row.year,
        "body_type": row.body_type,
        "fuel": row.fuel,
        "engine_cc": row.engine_cc,
        "transmission": row.transmission,
        "drivetrain": row.drivetrain,
        "colour": row.colour,
        "price": row.price,
        "currency": row.currency,
        "mileage_km": row.mileage_km,
        "location": row.location,
        "status": row.status,
        "evidence": row.evidence,
        "features": row.features,
        "observations": row.observations,
        "created_at": row.created_at,
        "post": {
            "x_post_id": post.x_post_id,
            "text": post.text,
            "created_at": post.x_created_at,
            "classification": post.classification,
            "ai_status": post.ai_status,
            "media": [_serialize_media(media) for media in post.media],
        },
    }


def _listing_from_reference(db: Session, listing_ref: str) -> tuple[Listing | None, bool]:
    """Resolve a new public reference or an old integer primary-key reference.

    Returns (row, used_legacy_numeric_id). Invalid/unbounded path input is not
    sent to the database.
    """
    reference = listing_ref.strip()
    if is_listing_public_id(reference):
        return db.scalar(select(Listing).where(Listing.public_id == reference)), False
    if is_legacy_numeric_listing_ref(reference):
        return db.get(Listing, int(reference)), True
    return None, False


@app.get("/")
def root():
    payload = {"name": "The Torque", "service": "vehicle-listings-api"}
    if settings.api_docs_enabled:
        payload["docs"] = "/docs"
    return payload


@app.get("/health")
def health(settings: Settings = Depends(get_settings)):
    return {
        "status": "ok",
        "scheduler_enabled": settings.scheduler_enabled,
        "target_configured": bool(settings.x_target_username),
        "x_credentials_configured": bool(settings.x_bearer_token),
        "ai_provider": settings.ai_provider,
        "ai_model": settings.ai_model,
        "ai_configured": settings.ai_configured,
    }


@app.get("/api/status")
def status(db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    source = db.scalar(select(Source).where(Source.username == settings.x_target_username)) if settings.x_target_username else None
    failed_ai = db.scalar(select(func.count(Post.id)).where(Post.ai_status == "error")) or 0
    waiting_ai = db.scalar(select(func.count(Post.id)).where(Post.ai_status == "waiting_for_ai_key")) or 0
    return {
        "target": settings.x_target_username or None,
        "x_user_id": source.x_user_id if source else None,
        "last_seen_post_id": source.last_seen_post_id if source else None,
        "source_enabled": source.enabled if source else None,
        "daytime_poll_seconds": settings.daytime_poll_seconds,
        "nighttime_poll_seconds": settings.nighttime_poll_seconds,
        "timezone": settings.scheduler_timezone,
        "ai_provider": settings.ai_provider,
        "ai_model": settings.ai_model,
        "ai_configured": settings.ai_configured,
        "ai_failed_posts": failed_ai,
        "ai_waiting_posts": waiting_ai,
        "ai_retry_max_attempts": settings.ai_retry_max_attempts,
    }


@app.get("/api/overview")
def overview(db: Session = Depends(get_db)):
    listings_total = db.scalar(select(func.count(Listing.id))) or 0
    posts_total = db.scalar(select(func.count(Post.id))) or 0
    enriched_posts = db.scalar(select(func.count(Post.id)).where(Post.ai_status == "complete")) or 0
    failed_posts = db.scalar(select(func.count(Post.id)).where(Post.ai_status == "error")) or 0
    waiting_posts = db.scalar(select(func.count(Post.id)).where(Post.ai_status == "waiting_for_ai_key")) or 0
    available_total = db.scalar(select(func.count(Listing.id)).where(func.lower(Listing.status) == "available")) or 0
    sold_total = db.scalar(select(func.count(Listing.id)).where(func.lower(Listing.status) == "sold")) or 0
    latest_post_at = db.scalar(select(func.max(Post.x_created_at)))
    latest_listing_at = db.scalar(select(func.max(Listing.created_at)))
    enrichment_rate = (enriched_posts / posts_total * 100) if posts_total else 0.0
    return {
        "listings_total": listings_total,
        "posts_total": posts_total,
        "available_total": available_total,
        "sold_total": sold_total,
        "enriched_posts": enriched_posts,
        "failed_posts": failed_posts,
        "waiting_posts": waiting_posts,
        "enrichment_rate": round(enrichment_rate, 1),
        "latest_post_at": latest_post_at,
        "latest_listing_at": latest_listing_at,
    }


@app.post("/api/ingest/run", dependencies=[Depends(require_admin)])
def run_ingestion(db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    try:
        return IngestionService(settings).run_once(db)
    except Exception as exc:
        logger.exception("manual ingestion failed")
        raise HTTPException(status_code=502, detail=str(exc)[:1000]) from exc


@app.post("/api/enrichment/retry-failed", dependencies=[Depends(require_admin)])
def retry_failed_enrichment(
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return IngestionService(settings).retry_failed(db, limit=limit)


@app.post("/api/posts/{post_id}/retry-enrichment", dependencies=[Depends(require_admin)])
def retry_post_enrichment(
    post_id: int,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.ai_status not in {"error", "waiting_for_ai_key"}:
        raise HTTPException(status_code=409, detail=f"Post is not retryable from state {post.ai_status}")
    return IngestionService(settings).retry_failed(db, post_id=post_id, force=True)


@app.get("/api/posts")
def posts(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = db.scalars(select(Post).order_by(desc(Post.x_created_at), desc(Post.id)).limit(limit)).all()
    result = []
    for row in rows:
        meta = _post_ai_meta(row)
        result.append(
            {
                "id": row.id,
                "x_post_id": row.x_post_id,
                "text": row.text,
                "created_at": row.x_created_at,
                "classification": row.classification,
                "ai_status": row.ai_status,
                "ai_provider": meta.get("provider"),
                "ai_model": meta.get("model"),
                "ai_attempts": meta.get("attempts", 0),
                "ai_error": meta.get("last_error") or ((row.ai_payload or {}).get("error") if isinstance(row.ai_payload, dict) else None),
                "listing_count": len(row.listings),
                "x_url": f"https://x.com/{row.source.username}/status/{row.x_post_id}",
                "media": [_serialize_media(media) for media in row.media],
            }
        )
    return result


@app.get("/api/listings")
def listings(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = db.scalars(select(Listing).order_by(desc(Listing.created_at), desc(Listing.id)).limit(limit)).all()
    return [_serialize_listing(row) for row in rows]


@app.get("/api/listings/{listing_ref}")
def listing_detail(listing_ref: str, response: Response, db: Session = Depends(get_db)):
    row, legacy_numeric = _listing_from_reference(db, listing_ref)
    if row is None:
        raise HTTPException(status_code=404, detail="Listing not found")

    if legacy_numeric:
        # Old integrations keep receiving a normal 200 JSON response. These
        # headers advertise the canonical public reference without forcing a
        # redirect that could break API clients.
        response.headers["Deprecation"] = "true"
        response.headers["Link"] = f'</api/listings/{row.public_id}>; rel="canonical"'
        response.headers["X-Torque-Public-Id"] = row.public_id

    return _serialize_listing(row)
