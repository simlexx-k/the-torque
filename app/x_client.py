from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings


class XAPIError(RuntimeError):
    pass


@dataclass(slots=True)
class XPostBatch:
    posts: list[dict[str, Any]]
    media_by_key: dict[str, dict[str, Any]]


class XClient:
    BASE_URL = "https://api.x.com/2"

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
            raise XAPIError(f"X API {response.status_code}: {detail}")
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

        for _ in range(self.settings.x_max_pages_per_poll):
            params: dict[str, Any] = {
                "max_results": self.settings.initial_lookback_posts if since_id is None else 100,
                "tweet.fields": "id,text,created_at,conversation_id,attachments,referenced_tweets,public_metrics",
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
            if since_id is None or not pagination_token:
                break

        return XPostBatch(posts=posts, media_by_key=media_by_key)
