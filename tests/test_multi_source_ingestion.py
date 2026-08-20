from __future__ import annotations

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import Base
from app.models import Post, Source
from app.service import IngestionService
from app.x_client import XAPIError, XClient, XPostBatch


class FakeXClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def close(self) -> None:
        pass

    def resolve_user(self, username: str):
        if username == "broken":
            raise XAPIError("rate limited", status_code=429, rate_limit_reset="12345")
        return {"id": f"uid-{username}", "username": username, "protected": False}

    def fetch_user_posts(self, user_id: str, since_id: str | None = None):
        username = user_id.removeprefix("uid-")
        if username == "dealer_a":
            return XPostBatch(
                posts=[
                    {
                        "id": "1001",
                        "text": "General showroom update",
                        "created_at": "2026-08-20T10:00:00Z",
                        "conversation_id": "1001",
                    }
                ],
                media_by_key={},
            )
        if username == "dealer_b":
            return XPostBatch(
                posts=[
                    {
                        "id": "2001",
                        "text": "Another showroom update",
                        "created_at": "2026-08-20T10:01:00Z",
                        "conversation_id": "2001",
                    }
                ],
                media_by_key={},
            )
        if username == "thread_dealer":
            return XPostBatch(
                posts=[
                    {
                        "id": "3001",
                        "text": "Toyota Premio for sale KES 1m",
                        "created_at": "2026-08-20T10:02:00Z",
                        "conversation_id": "3001",
                    },
                    {
                        "id": "3002",
                        "text": "Mileage 120000 km, automatic",
                        "created_at": "2026-08-20T10:03:00Z",
                        "conversation_id": "3001",
                        "referenced_tweets": [{"type": "replied_to", "id": "3001"}],
                    },
                ],
                media_by_key={},
            )
        return XPostBatch(posts=[], media_by_key={})


def session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine, expire_on_commit=False)


def test_multi_source_settings_prefer_plural_and_keep_singular_compatibility():
    plural = Settings(x_target_usernames="@dealer_a, dealer_b,DEALER_A", x_target_username="legacy")
    assert plural.x_usernames == ["dealer_a", "dealer_b"]

    legacy = Settings(x_target_username="@legacy")
    assert legacy.x_usernames == ["legacy"]


def test_run_once_polls_multiple_sources_with_independent_cursors(monkeypatch):
    import app.service as service_module

    monkeypatch.setattr(service_module, "XClient", FakeXClient)
    settings = Settings(
        x_bearer_token="test",
        x_target_usernames="dealer_a,dealer_b",
        gemini_api_key="",
    )
    db = session()
    result = IngestionService(settings).run_once(db)

    assert result["status"] == "ok"
    assert result["source_count"] == 2
    assert result["new_posts"] == 2
    rows = list(db.scalars(select(Source).order_by(Source.username.asc())).all())
    assert [(row.username, row.last_seen_post_id) for row in rows] == [
        ("dealer_a", "1001"),
        ("dealer_b", "2001"),
    ]


def test_one_source_failure_does_not_block_other_accounts(monkeypatch):
    import app.service as service_module

    monkeypatch.setattr(service_module, "XClient", FakeXClient)
    settings = Settings(
        x_bearer_token="test",
        x_target_usernames="broken,dealer_a",
        gemini_api_key="",
    )
    db = session()
    result = IngestionService(settings).run_once(db)

    assert result["status"] == "partial_error"
    assert result["failed_sources"] == 1
    assert result["new_posts"] == 1
    assert result["sources"][0]["status"] == "rate_limited"
    assert result["sources"][1]["status"] == "ok"
    dealer = db.scalar(select(Source).where(Source.username == "dealer_a"))
    assert dealer is not None
    assert dealer.last_seen_post_id == "1001"


def test_same_source_reply_is_attached_to_thread_root(monkeypatch):
    import app.service as service_module

    monkeypatch.setattr(service_module, "XClient", FakeXClient)
    settings = Settings(
        x_bearer_token="test",
        x_target_usernames="thread_dealer",
        gemini_api_key="",
    )
    db = session()
    result = IngestionService(settings).run_once(db)

    assert result["new_posts"] == 2
    root = db.scalar(select(Post).where(Post.x_post_id == "3001"))
    reply = db.scalar(select(Post).where(Post.x_post_id == "3002"))
    assert root is not None and reply is not None
    assert root.ai_status == "waiting_for_ai_key"
    assert reply.ai_status == "thread_merged"
    assert reply.classification == "thread_supplement"
    assert reply.ai_payload["_meta"]["thread_root_x_post_id"] == "3001"


class PagingXClient(XClient):
    def __init__(self, settings: Settings):
        self.settings = settings
        self.calls: list[dict] = []

    def _get(self, path: str, params=None):
        params = dict(params or {})
        self.calls.append(params)
        token = params.get("pagination_token")
        start = 0 if token is None else int(token)
        count = params["max_results"]
        data = [{"id": str(10_000 + start + index), "text": "post"} for index in range(count)]
        next_token = str(start + count) if start + count < 300 else None
        return {"data": data, "meta": {"next_token": next_token} if next_token else {}}


def test_initial_x_history_uses_multiple_pages_until_lookback_target():
    settings = Settings(initial_lookback_posts=250, x_max_pages_per_poll=5)
    client = PagingXClient(settings)
    batch = client.fetch_user_posts("123")

    assert len(batch.posts) == 250
    assert len(client.calls) == 3
    assert [call["max_results"] for call in client.calls] == [100, 100, 50]
