from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.enrichment import VehicleEnricher, should_enrich
from app.models import Listing, Media, Post, Source
from app.schemas import ListingAnalysis, VehicleCandidate
from app.x_client import XClient

logger = logging.getLogger(__name__)


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

    def run_once(self, session: Session) -> dict[str, Any]:
        source = self._source(session)
        if not source.enabled:
            return {"status": "disabled", "new_posts": 0, "new_listings": 0}

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
            return {"status": "ok", "new_posts": 0, "new_listings": 0, "last_seen_post_id": source.last_seen_post_id}

        new_posts = 0
        new_listings = 0
        enricher: VehicleEnricher | None = None
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

            if not self.settings.openai_api_key:
                post.classification = "unknown"
                post.ai_status = "waiting_for_ai_key"
                session.commit()
                continue

            try:
                if enricher is None:
                    enricher = VehicleEnricher(self.settings)
                analysis: ListingAnalysis = enricher.analyze(post.text, images)
                post.classification = analysis.classification
                post.ai_status = "complete"
                post.ai_payload = analysis.model_dump(mode="json")
                for position, candidate in enumerate(analysis.vehicles):
                    post.listings.append(_make_listing(post.id, position, candidate))
                    new_listings += 1
                session.commit()
            except Exception as exc:
                logger.exception("AI enrichment failed for X post %s", post.x_post_id)
                post.ai_status = "error"
                post.ai_payload = {"error": str(exc)[:1000]}
                session.commit()

        source.last_seen_post_id = newest_id
        session.commit()
        return {
            "status": "ok",
            "new_posts": new_posts,
            "new_listings": new_listings,
            "last_seen_post_id": source.last_seen_post_id,
        }
