from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.enrichment import VehicleEnricher, should_enrich
from app.listing_intelligence import register_listing_intelligence
from app.models import Listing, Media, Post, Source
from app.schemas import ListingAnalysis, VehicleCandidate
from app.x_client import XAPIError, XClient

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


def _thread_image_urls(posts: list[Post]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for post in posts:
        for url in _image_urls(post):
            if url in seen:
                continue
            seen.add(url)
            urls.append(url)
    return urls


def _thread_text(posts: list[Post]) -> str:
    if len(posts) <= 1:
        return posts[0].text if posts else ""
    parts: list[str] = []
    for index, post in enumerate(posts, start=1):
        label = "ROOT POST" if index == 1 else f"FOLLOW-UP {index - 1}"
        parts.append(f"[{label}]\n{post.text}")
    return "\n\n".join(parts)


def _evidence_dict(candidate: VehicleCandidate) -> dict[str, Any]:
    fields = [
        "make", "model", "generation", "variant", "year", "body_type", "fuel", "engine_cc",
        "transmission", "drivetrain", "colour", "mileage_km", "price", "currency", "location",
    ]
    return {name: getattr(candidate, name).model_dump(mode="json") for name in fields}


def _make_listing(post_id: int, position: int, candidate: VehicleCandidate) -> Listing:
    listing = Listing(post_id=post_id, position=position)
    _apply_candidate(listing, candidate)
    return listing


def _apply_candidate(listing: Listing, candidate: VehicleCandidate) -> None:
    listing.make = candidate.make.value
    listing.model = candidate.model.value
    listing.generation = candidate.generation.value
    listing.variant = candidate.variant.value
    listing.year = candidate.year.value
    listing.body_type = candidate.body_type.value
    listing.fuel = candidate.fuel.value
    listing.engine_cc = candidate.engine_cc.value
    listing.transmission = candidate.transmission.value
    listing.drivetrain = candidate.drivetrain.value
    listing.colour = candidate.colour.value
    listing.mileage_km = candidate.mileage_km.value
    listing.price = candidate.price.value
    listing.currency = candidate.currency.value
    listing.location = candidate.location.value
    listing.status = candidate.status
    listing.evidence = _evidence_dict(candidate)
    listing.features = [feature.model_dump(mode="json") for feature in candidate.features]
    listing.observations = candidate.observations


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

    def _source(self, session: Session, username: str) -> Source:
        username = username.strip().lstrip("@")
        if not username:
            raise RuntimeError("X source username is empty")
        source = session.scalar(
            select(Source).where(func.lower(Source.username) == username.casefold())
        )
        if source is None:
            source = Source(username=username)
            session.add(source)
            session.flush()
        return source

    def _thread_members(self, session: Session, post: Post) -> tuple[Post, list[Post]]:
        conversation_id = post.conversation_id or post.x_post_id
        root = session.scalar(
            select(Post).where(
                Post.source_id == post.source_id,
                Post.x_post_id == conversation_id,
            )
        )
        # A reply to somebody else's post has the external root's conversation
        # id. Do not merge that reply into unrelated dealer content.
        if root is None:
            return post, [post]

        members = list(
            session.scalars(
                select(Post)
                .where(
                    Post.source_id == post.source_id,
                    or_(Post.x_post_id == conversation_id, Post.conversation_id == conversation_id),
                )
                .order_by(Post.id.asc())
            ).all()
        )
        return root, members or [root]

    def _mark_thread_supplements(self, session: Session, root: Post, members: list[Post]) -> None:
        for member in members:
            if member.id == root.id:
                continue
            member.classification = "thread_supplement"
            member.ai_status = "thread_merged"
            member.ai_payload = {
                "_meta": {
                    **_ai_meta(member),
                    "thread_root_x_post_id": root.x_post_id,
                    "thread_root_post_id": root.id,
                    "merged_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        session.flush()

    def _mark_waiting_for_provider(self, session: Session, post: Post) -> None:
        root, members = self._thread_members(session, post)
        root.ai_status = "waiting_for_ai_key"
        if root.classification == "unclassified":
            root.classification = "unknown"
        root.ai_payload = {
            "_meta": {
                **_ai_meta(root),
                "provider": self.settings.ai_provider,
                "model": self.settings.ai_model,
                "attempts": _attempt_count(root),
                "last_error": f"{self.settings.ai_provider} API key is not configured",
                "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                "thread_post_count": len(members),
            }
        }
        self._mark_thread_supplements(session, root, members)
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

    def _sync_analysis_listings(self, session: Session, post: Post, analysis: ListingAnalysis) -> int:
        existing_by_position = {listing.position: listing for listing in post.listings}
        created = 0
        touched: list[Listing] = []
        for position, candidate in enumerate(analysis.vehicles):
            listing = existing_by_position.get(position)
            if listing is None:
                listing = _make_listing(post.id, position, candidate)
                post.listings.append(listing)
                created += 1
            else:
                _apply_candidate(listing, candidate)
            touched.append(listing)

        # Never delete an existing listing because a later thread re-analysis
        # returns fewer candidates. Public ids and historic links must remain
        # stable; later runs may restore or improve the omitted candidate.
        session.flush()
        for listing in touched:
            register_listing_intelligence(session, listing)
        return created

    def _enrich_post(self, session: Session, post: Post, enricher: VehicleEnricher | None = None) -> int:
        root, members = self._thread_members(session, post)
        post = root
        if not self.settings.ai_configured:
            self._mark_waiting_for_provider(session, post)
            return 0

        if enricher is None:
            enricher = VehicleEnricher(self.settings)

        attempts = _attempt_count(post) + 1
        attempted_at = datetime.now(timezone.utc).isoformat()
        context_text = _thread_text(members)
        context_images = _thread_image_urls(members)

        # The model/network call happens before mutating listing rows. If the
        # provider fails, keep the already-captured Post + Media transaction and
        # persist only the error state; do not roll the source signal back.
        try:
            analysis: ListingAnalysis = enricher.analyze(context_text, context_images)
        except Exception as exc:
            logger.exception(
                "AI enrichment failed for X thread rooted at %s via %s",
                post.x_post_id,
                self.settings.ai_provider,
            )
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
                    "thread_post_count": len(members),
                    "thread_post_ids": [member.x_post_id for member in members],
                },
            }
            created = self._sync_analysis_listings(session, post, analysis)
            self._mark_thread_supplements(session, post, members)
            session.commit()
            return created
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
        processed_roots: set[int] = set()
        for post in rows:
            if post is None:
                continue
            root, _ = self._thread_members(session, post)
            if root.id in processed_roots:
                continue
            processed_roots.add(root.id)
            if not force and root.ai_status == "error" and _attempt_count(root) >= self.settings.ai_retry_max_attempts:
                continue
            attempted += 1
            created = self._enrich_post(session, root, enricher)
            refreshed = session.get(Post, root.id)
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

    def _capture_post(
        self,
        session: Session,
        source: Source,
        raw: dict[str, Any],
        media_by_key: dict[str, dict[str, Any]],
    ) -> Post:
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
            item = media_by_key.get(media_key, {})
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
        return post

    def _run_source(
        self,
        session: Session,
        username: str,
        x_client: XClient,
        enricher: VehicleEnricher | None,
    ) -> dict[str, Any]:
        source = self._source(session, username)
        if not source.enabled:
            return {
                "status": "disabled",
                "username": source.username,
                "new_posts": 0,
                "new_listings": 0,
                "last_seen_post_id": source.last_seen_post_id,
            }

        if not source.x_user_id:
            user = x_client.resolve_user(source.username)
            source.x_user_id = user["id"]
            # Keep the canonical spelling returned by X for future links/status.
            source.username = user.get("username") or source.username
            session.commit()

        batch = x_client.fetch_user_posts(source.x_user_id, since_id=source.last_seen_post_id)
        if not batch.posts:
            return {
                "status": "ok",
                "username": source.username,
                "x_user_id": source.x_user_id,
                "new_posts": 0,
                "new_listings": 0,
                "last_seen_post_id": source.last_seen_post_id,
            }

        new_posts = 0
        new_listings = 0
        newest_id = source.last_seen_post_id
        affected_post_ids: set[int] = set()

        # Capture the complete X batch first. A self-thread may contain important
        # details in a later reply, so enrichment must see all newly fetched
        # thread members rather than processing the root too early.
        for raw in sorted(batch.posts, key=lambda item: int(item["id"])):
            existing = session.scalar(select(Post).where(Post.x_post_id == raw["id"]))
            newest_id = raw["id"] if newest_id is None or int(raw["id"]) > int(newest_id) else newest_id
            if existing is not None:
                if existing.ai_status == "pending":
                    affected_post_ids.add(existing.id)
                continue

            post = self._capture_post(session, source, raw, batch.media_by_key)
            affected_post_ids.add(post.id)
            new_posts += 1

        # Persist source signals before any external AI request. If enrichment
        # later fails, the next cycle can recover pending/error rows safely.
        session.commit()

        root_ids: set[int] = set()
        for post_id in affected_post_ids:
            current = session.get(Post, post_id)
            if current is None:
                continue
            root, _ = self._thread_members(session, current)
            root_ids.add(root.id)

        for root_id in sorted(root_ids):
            root = session.get(Post, root_id)
            if root is None:
                continue
            thread_root, members = self._thread_members(session, root)
            context_text = _thread_text(members)
            context_images = _thread_image_urls(members)
            if not should_enrich(context_text, context_images):
                thread_root.classification = "non_vehicle"
                thread_root.ai_status = "skipped"
                self._mark_thread_supplements(session, thread_root, members)
                session.commit()
                continue
            new_listings += self._enrich_post(session, thread_root, enricher)

        source = session.get(Source, source.id) or source
        source.last_seen_post_id = newest_id
        session.commit()
        return {
            "status": "ok",
            "username": source.username,
            "x_user_id": source.x_user_id,
            "fetched_posts": len(batch.posts),
            "new_posts": new_posts,
            "new_listings": new_listings,
            "last_seen_post_id": source.last_seen_post_id,
        }

    def run_once(self, session: Session) -> dict[str, Any]:
        usernames = self.settings.x_usernames
        if not usernames:
            raise RuntimeError("X_TARGET_USERNAMES or X_TARGET_USERNAME is not configured")

        # Retry failed AI once per scheduler cycle, not once per tracked account.
        retry_result = self.retry_failed(session, limit=self.settings.ai_retry_batch_size)
        total_new_posts = 0
        total_new_listings = int(retry_result.get("new_listings", 0))
        source_results: list[dict[str, Any]] = []
        failed_sources = 0

        x_client = XClient(self.settings)
        enricher: VehicleEnricher | None = VehicleEnricher(self.settings) if self.settings.ai_configured else None
        try:
            for username in usernames:
                try:
                    result = self._run_source(session, username, x_client, enricher)
                except Exception as exc:
                    session.rollback()
                    failed_sources += 1
                    logger.exception("X ingestion failed for @%s", username)
                    result = {
                        "status": "rate_limited" if isinstance(exc, XAPIError) and exc.status_code == 429 else "error",
                        "username": username,
                        "new_posts": 0,
                        "new_listings": 0,
                        "error": str(exc)[:1000],
                    }
                    if isinstance(exc, XAPIError) and exc.rate_limit_reset:
                        result["rate_limit_reset"] = exc.rate_limit_reset
                source_results.append(result)
                total_new_posts += int(result.get("new_posts", 0))
                total_new_listings += int(result.get("new_listings", 0))
        finally:
            x_client.close()

        status = "ok" if failed_sources == 0 else ("error" if failed_sources == len(usernames) else "partial_error")
        payload: dict[str, Any] = {
            "status": status,
            "provider": self.settings.ai_provider,
            "source_count": len(usernames),
            "failed_sources": failed_sources,
            "new_posts": total_new_posts,
            "new_listings": total_new_listings,
            "retried_posts": retry_result.get("attempted", 0),
            "recovered_posts": retry_result.get("completed", 0),
            "sources": source_results,
        }
        # Preserve the legacy top-level cursor for single-source consumers.
        if len(source_results) == 1:
            payload["last_seen_post_id"] = source_results[0].get("last_seen_post_id")
        return payload
