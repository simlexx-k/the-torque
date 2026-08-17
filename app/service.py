from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.enrichment import VehicleEnricher, should_enrich
from app.listing_intelligence import register_listing_intelligence
from app.models import Listing, Media, Post, Source
from app.schemas import ListingAnalysis, VehicleCandidate
from app.x_client import XClient

logger = logging.getLogger(__name__)

RETRYABLE_AI_STATUSES = ("error", "waiting_for_ai_key")


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _image_urls(post: Post) -> list[str]:
    urls: list[str] = []
    for media in post.media:
        if media.media_type == "photo" and media.url:
            urls.append(media.url)
        elif media.preview_image_url:
            urls.append(media.preview_image_url)
    return urls


def _evidence_dict(candidate: VehicleCandidate) -> dict[str, Any]:
    fields = [
        "make", "model", "generation", "variant", "year", "body_type", "fuel", "engine_cc",
        "transmission", "drivetrain", "colour", "mileage_km", "price", "currency", "location",
    ]
    return {name: getattr(candidate, name).model_dump(mode="json") for name in fields}


def _make_listing(post_id: int, position: int, candidate: VehicleCandidate) -> Listing:
    return Listing(
        post_id=post_id,
        position=position,
        make=candidate.make.value,
        model=candidate.model.value,
        generation=candidate.generation.value,
        variant=candidate.variant.value,
        year=candidate.year.value,
        body_type=candidate.body_type.value,
        fuel=candidate.fuel.value,
        engine_cc=candidate.engine_cc.value,
        transmission=candidate.transmission.value,
        drivetrain=candidate.drivetrain.value,
        colour=candidate.colour.value,
        mileage_km=candidate.mileage_km.value,
        price=candidate.price.value,
        currency=candidate.currency.value,
        location=candidate.location.value,
        status=candidate.status,
        evidence=_evidence_dict(candidate),
        features=[feature.model_dump(mode="json") for feature in candidate.features],
        observations=candidate.observations,
    )


def _ai_meta(post: Post) -> dict[str, Any]:
    payload = post.ai_payload if isinstance(post.ai_payload, dict) else {}
    meta = payload.get("_meta") if isinstance(payload.get("_meta"), dict) else {}
    return dict(meta)


def _attempt_count(post: Post) -> int:
    value = _ai_meta(post).get("attempts", 0)
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


class IngestionService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _source(self, session: Session) -> Source:
        username = self.settings.x_target_username
        if not username:
            raise RuntimeError("X_TARGET_USERNAME is not configured")
        source = session.scalar(select(Source).where(Source.username == username))
        if source is None:
            source = Source(username=username)
            session.add(source)
            session.flush()
        return source

    def _mark_waiting_for_provider(self, session: Session, post: Post) -> None:
        post.ai_status = "waiting_for_ai_key"
        if post.classification == "unclassified":
            post.classification = "unknown"
        post.ai_payload = {
            "_meta": {
                **_ai_meta(post),
                "provider": self.settings.ai_provider,
                "model": self.settings.ai_model,
                "attempts": _attempt_count(post),
                "last_error": f"{self.settings.ai_provider} API key is not configured",
                "last_attempt_at": datetime.now(timezone.utc).isoformat(),
            }
        }
        session.commit()

    def _record_ai_error(
        self,
        session: Session,
        post: Post,
        exc: Exception,
        *,
        attempts: int,
        attempted_at: str,
    ) -> None:
        post.ai_status = "error"
        post.ai_payload = {
            "_meta": {
                **_ai_meta(post),
                "provider": self.settings.ai_provider,
                "model": self.settings.ai_model,
                "attempts": attempts,
                "last_attempt_at": attempted_at,
                "last_error": str(exc)[:1000],
            },
            "error": str(exc)[:1000],
        }
        session.commit()

    def _enrich_post(self, session: Session, post: Post, enricher: VehicleEnricher | None = None) -> int:
        if not self.settings.ai_configured:
            self._mark_waiting_for_provider(session, post)
            return 0

        if enricher is None:
            enricher = VehicleEnricher(self.settings)

        attempts = _attempt_count(post) + 1
        attempted_at = datetime.now(timezone.utc).isoformat()

        # The model/network call happens before mutating listing rows. If the
        # provider fails, keep the already-captured Post + Media transaction and
        # persist only the error state; do not roll the source signal back.
        try:
            analysis: ListingAnalysis = enricher.analyze(post.text, _image_urls(post))
        except Exception as exc:
            logger.exception("AI enrichment failed for X post %s via %s", post.x_post_id, self.settings.ai_provider)
            self._record_ai_error(session, post, exc, attempts=attempts, attempted_at=attempted_at)
            return 0

        try:
            post.classification = analysis.classification
            post.ai_status = "complete"
            post.ai_payload = {
                **analysis.model_dump(mode="json"),
                "_meta": {
                    "provider": enricher.provider,
                    "model": enricher.model,
                    "attempts": attempts,
                    "last_attempt_at": attempted_at,
                    "last_error": None,
                },
            }
            created_listings: list[Listing] = []
            for position, candidate in enumerate(analysis.vehicles):
                listing = _make_listing(post.id, position, candidate)
                post.listings.append(listing)
                created_listings.append(listing)

            # Flush first so every listing has its stable integer id. The market
            # intelligence layer then records the observation and links only
            # conservative likely reposts; it never deletes or merges source rows.
            session.flush()
            for listing in created_listings:
                register_listing_intelligence(session, listing)
            session.commit()
            return len(created_listings)
        except Exception as exc:
            logger.exception("Failed to persist enrichment for X post %s", post.x_post_id)
            post_id = post.id
            session.rollback()
            current = session.get(Post, post_id)
            if current is None:
                raise
            self._record_ai_error(session, current, exc, attempts=attempts, attempted_at=attempted_at)
            return 0

    def retry_failed(
        self,
        session: Session,
        *,
        post_id: int | None = None,
        limit: int | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        if not self.settings.ai_configured:
            return {
                "status": "provider_not_configured",
                "provider": self.settings.ai_provider,
                "attempted": 0,
                "completed": 0,
                "failed": 0,
                "new_listings": 0,
            }

        if post_id is not None:
            post = session.get(Post, post_id)
            rows = [post] if post is not None and post.ai_status in RETRYABLE_AI_STATUSES else []
        else:
            retry_limit = limit or self.settings.ai_retry_batch_size
            rows = list(
                session.scalars(
                    select(Post)
                    .where(Post.ai_status.in_(RETRYABLE_AI_STATUSES))
                    .order_by(Post.ingested_at.asc(), Post.id.asc())
                    .limit(retry_limit)
                ).all()
            )

        enricher = VehicleEnricher(self.settings)
        attempted = 0
        completed = 0
        failed = 0
        new_listings = 0
        for post in rows:
            if post is None:
                continue
            if not force and post.ai_status == "error" and _attempt_count(post) >= self.settings.ai_retry_max_attempts:
                continue
            attempted += 1
            created = self._enrich_post(session, post, enricher)
            refreshed = session.get(Post, post.id)
            if refreshed is not None and refreshed.ai_status == "complete":
                completed += 1
                new_listings += created
            else:
                failed += 1

        return {
            "status": "ok",
            "provider": self.settings.ai_provider,
            "attempted": attempted,
            "completed": completed,
            "failed": failed,
            "new_listings": new_listings,
        }

    def run_once(self, session: Session) -> dict[str, Any]:
        source = self._source(session)
        if not source.enabled:
            return {"status": "disabled", "new_posts": 0, "new_listings": 0}

        # Recover previously captured signals before fetching newer X posts. This
        # prevents a transient provider outage from permanently stranding a
        # legitimate listing in the posts table.
        retry_result = self.retry_failed(session, limit=self.settings.ai_retry_batch_size)

        x_client = XClient(self.settings)
        try:
            if not source.x_user_id:
                user = x_client.resolve_user(source.username)
                source.x_user_id = user["id"]
                session.commit()

            batch = x_client.fetch_user_posts(source.x_user_id, since_id=source.last_seen_post_id)
        finally:
            x_client.close()

        if not batch.posts:
            return {
                "status": "ok",
                "new_posts": 0,
                "new_listings": retry_result.get("new_listings", 0),
                "retried_posts": retry_result.get("attempted", 0),
                "recovered_posts": retry_result.get("completed", 0),
                "last_seen_post_id": source.last_seen_post_id,
            }

        new_posts = 0
        new_listings = int(retry_result.get("new_listings", 0))
        enricher: VehicleEnricher | None = VehicleEnricher(self.settings) if self.settings.ai_configured else None
        newest_id = source.last_seen_post_id

        for raw in sorted(batch.posts, key=lambda item: int(item["id"])):
            existing = session.scalar(select(Post).where(Post.x_post_id == raw["id"]))
            newest_id = raw["id"] if newest_id is None or int(raw["id"]) > int(newest_id) else newest_id
            if existing is not None:
                continue

            post = Post(
                source_id=source.id,
                x_post_id=raw["id"],
                conversation_id=raw.get("conversation_id"),
                text=raw.get("text", ""),
                x_created_at=_parse_datetime(raw.get("created_at")),
                raw_json=raw,
            )
            session.add(post)
            session.flush()

            for media_key in raw.get("attachments", {}).get("media_keys", []):
                item = batch.media_by_key.get(media_key, {})
                post.media.append(
                    Media(
                        media_key=media_key,
                        media_type=item.get("type", "unknown"),
                        url=item.get("url"),
                        preview_image_url=item.get("preview_image_url"),
                        width=item.get("width"),
                        height=item.get("height"),
                        alt_text=item.get("alt_text"),
                    )
                )
            session.flush()
            new_posts += 1

            images = _image_urls(post)
            if not should_enrich(post.text, images):
                post.classification = "non_vehicle"
                post.ai_status = "skipped"
                session.commit()
                continue

            new_listings += self._enrich_post(session, post, enricher)

        source = session.get(Source, source.id) or source
        source.last_seen_post_id = newest_id
        session.commit()
        return {
            "status": "ok",
            "provider": self.settings.ai_provider,
            "new_posts": new_posts,
            "new_listings": new_listings,
            "retried_posts": retry_result.get("attempted", 0),
            "recovered_posts": retry_result.get("completed", 0),
            "last_seen_post_id": source.last_seen_post_id,
        }
