# The Torque

The Torque is an AI-assisted vehicle listing intelligence service. The MVP watches one configurable public X account, incrementally ingests new posts and attached media, classifies listing activity, extracts vehicle details with provenance/confidence, and exposes normalized records through a FastAPI API.

## MVP capabilities

- Official X API v2 ingestion using a Bearer Token.
- Resolves the configured `X_TARGET_USERNAME` once and caches its numeric user ID in PostgreSQL.
- Uses the source's `last_seen_post_id` as X `since_id`, so normal polling only requests posts newer than the last successful cycle.
- Pulls attached media via `attachments.media_keys` expansion.
- Supports up to 100 posts per page and bounded pagination for catch-up cycles.
- Polls every 10 minutes from 06:00–22:00 Africa/Nairobi and hourly overnight by default.
- Cheap prefilter: image-bearing posts or text with both sale and vehicle signals proceed to AI; obvious unrelated text is stored but not sent to vision AI.
- OpenAI Responses API multimodal extraction with a Pydantic structured-output schema.
- One post can yield multiple normalized vehicle listings.
- Keeps seller claims / visual evidence / OCR / AI inference provenance and confidence values separate.
- PostgreSQL persistence plus FastAPI status, posts, listings, and manual-ingestion endpoints.
- Docker Compose deployment and GitHub Actions tests.

## Architecture

```text
X API v2
   |
   v
incremental ingestor ----> raw posts + media ----> PostgreSQL
                                  |
                                  v
                           candidate prefilter
                                  |
                                  v
                      OpenAI multimodal extractor
                                  |
                                  v
                    normalized vehicle listings
                                  |
                                  v
                            FastAPI / future UI
```

## Configuration

Copy `.env.example` to `.env` and supply at least:

```env
X_BEARER_TOKEN=...
X_TARGET_USERNAME=dealer_handle_without_at
OPENAI_API_KEY=...
POSTGRES_PASSWORD=use-a-strong-password
ADMIN_API_KEY=use-another-long-random-secret
```

Never commit credentials. For read-only public X data this service uses the app Bearer Token; no user-context OAuth credentials are needed.

### Polling window

Defaults are intentionally configurable:

```env
SCHEDULER_TIMEZONE=Africa/Nairobi
DAYTIME_START_HOUR=6
DAYTIME_END_HOUR=22
DAYTIME_POLL_SECONDS=600
NIGHTTIME_POLL_SECONDS=3600
```

This means 10-minute cycles during 06:00–21:59 EAT and hourly cycles during 22:00–05:59 EAT.

## Run with Docker

```bash
cp .env.example .env
# edit .env
docker compose up -d --build
```

Then open `http://localhost:8000/docs`.

Useful endpoints:

- `GET /health`
- `GET /api/status`
- `POST /api/ingest/run` (requires `X-Admin-Key`)
- `GET /api/posts`
- `GET /api/listings`

## First run behaviour

With no stored `last_seen_post_id`, the service retrieves up to `INITIAL_LOOKBACK_POSTS` (default 100) from the configured account. After that, it stores the newest X Post ID and supplies it as `since_id` on subsequent timeline requests.

If `OPENAI_API_KEY` is absent, candidate posts are safely retained with `ai_status=waiting_for_ai_key`; raw ingestion does not fail. The initial run intentionally stops after the configured lookback page instead of traversing the account history.

## Data-quality rules

The AI prompt is deliberately conservative. It must not infer mechanical condition, accident history, legal ownership, or authenticity from photographs. Missing values remain missing. Every extracted field carries a `source` and `confidence` value in the listing's `evidence` JSON.

The current enrichment layer identifies and normalizes what is present in the post. Manufacturer/reference specification matching is the next layer and should use trusted external vehicle data rather than model memory.

## Current scope and next steps

The MVP is intentionally backend-first. Recommended follow-on work:

1. Configure and validate the real seller account against 50–100 historical posts.
2. Add post-update linking (`price_drop`, `sold`, `reserved`, relists) across separate X posts.
3. Add manufacturer/reference specification providers and conflict resolution.
4. Add an admin review queue for medium-confidence extractions.
5. Add image/object storage only after confirming the desired X-content retention policy.
6. Build the searchable Next.js listing dashboard after extraction accuracy is measured.

## Deployment note

Run a single scheduler-enabled application replica for the MVP. If the API is later horizontally scaled, move scheduling to a dedicated worker or add a distributed lock so replicas do not duplicate X polling.
