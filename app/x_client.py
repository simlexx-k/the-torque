from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings


class XAPIError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None, rate_limit_reset: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.rate_limit_reset = rate_limit_reset


@dataclass(slots=True)
class XPostBatch:
    posts: list[dict[str, Any]]
    media_by_key: dict[str, dict[str, Any]]


class XClient:
    BASE_URL = "https://api.x.com/2"
    MAX_TIMELINE_PAGES = 32

    def __init__(self, settings: Settings):
        if not settings.x_bearer_token:
            raise XAPIError("X_BEARER_TOKEN is not configured")
        self.settings = settings
        self.client = httpx.Client(
            base_url=self.BASE_URL,
            headers={"Authorization": f"Bearer {settings.x_bearer_token}"},
            timeout=30.0,
        )

    def close(self) -> None:
        self.client.close()

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        response = self.client.get(path, params=params)
        if response.status_code >= 400:
            detail = response.text[:1000]
            reset = response.headers.get("x-rate-limit-reset")
            raise XAPIError(
                f"X API {response.status_code}: {detail}",
                status_code=response.status_code,
                rate_limit_reset=reset,
            )
        return response.json()

    def resolve_user(self, username: str) -> dict[str, Any]:
        payload = self._get(
            f"/users/by/username/{username}",
            params={"user.fields": "id,name,username,protected,public_metrics"},
        )
        data = payload.get("data")
        if not data:
            raise XAPIError(f"X user @{username} was not found")
        if data.get("protected"):
            raise XAPIError(f"X user @{username} is protected; public app-only ingestion is unavailable")
        return data

    def fetch_user_posts(self, user_id: str, since_id: str | None = None) -> XPostBatch:
        posts: list[dict[str, Any]] = []
        media_by_key: dict[str, dict[str, Any]] = {}
        pagination_token: str | None = None
        initial_target = self.settings.initial_lookback_posts if since_id is None else None

        if initial_target is not None:
            required_pages = max(1, math.ceil(initial_target / 100))
            page_limit = min(
                self.MAX_TIMELINE_PAGES,
                max(self.settings.x_max_pages_per_poll, required_pages),
            )
        else:
            # Once a cursor exists, exhaust the available timeline window before
            # advancing last_seen_post_id. Stopping after an arbitrary page cap
            # and then moving the cursor to the newest id would permanently skip
            # posts in the unfetched middle of a burst.
            page_limit = self.MAX_TIMELINE_PAGES

        for _ in range(page_limit):
            if initial_target is not None:
                remaining = initial_target - len(posts)
                if remaining <= 0:
                    break
                max_results = min(100, max(5, remaining))
            else:
                max_results = 100

            params: dict[str, Any] = {
                "max_results": max_results,
                "tweet.fields": (
                    "id,text,created_at,author_id,in_reply_to_user_id,conversation_id,"
                    "attachments,referenced_tweets,public_metrics"
                ),
                "expansions": "attachments.media_keys,referenced_tweets.id",
                "media.fields": "media_key,type,url,preview_image_url,width,height,alt_text",
            }
            excluded: list[str] = []
            if self.settings.x_exclude_replies:
                excluded.append("replies")
            if self.settings.x_exclude_retweets:
                excluded.append("retweets")
            if excluded:
                params["exclude"] = ",".join(excluded)
            if since_id:
                params["since_id"] = since_id
            if pagination_token:
                params["pagination_token"] = pagination_token

            payload = self._get(f"/users/{user_id}/tweets", params=params)
            posts.extend(payload.get("data", []))
            for media in payload.get("includes", {}).get("media", []):
                key = media.get("media_key")
                if key:
                    media_by_key[key] = media

            pagination_token = payload.get("meta", {}).get("next_token")
            if not pagination_token:
                break
            if initial_target is not None and len(posts) >= initial_target:
                break

        if pagination_token and initial_target is None:
            # The endpoint only exposes the most recent 3,200 posts. Reaching
            # this guard means the account produced more than that since our
            # cursor, so advancing would hide a gap. Fail the source instead and
            # preserve its existing cursor for operator intervention.
            raise XAPIError(
                "X timeline still has more than 3,200 posts after the current cursor; cursor was not advanced"
            )

        if initial_target is not None and len(posts) > initial_target:
            posts = posts[:initial_target]

        return XPostBatch(posts=posts, media_by_key=media_by_key)
