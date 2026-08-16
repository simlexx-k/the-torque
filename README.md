# The Torque

The Torque is an AI-assisted vehicle listing intelligence platform. It watches one configurable public X account, incrementally ingests new posts and attached media, classifies listing activity, extracts vehicle details with provenance/confidence, persists normalized records, and presents them in an image-led Next.js intelligence dashboard.

## Current capabilities

- Official X API v2 ingestion using a Bearer Token.
- Resolves `X_TARGET_USERNAME` once and caches its numeric X user ID in PostgreSQL.
- Uses `last_seen_post_id` as X `since_id`, so normal polling only asks for newer posts.
- Pulls attached media via `attachments.media_keys` expansion.
- Configurable first-run lookback and bounded pagination.
- Polls every 10 minutes from 06:00–22:00 Africa/Nairobi and hourly overnight by default.
- Cheap prefilter before AI: obvious unrelated posts are stored but do not spend multimodal inference calls.
- OpenAI Responses API multimodal extraction with structured Pydantic output.
- One post can yield multiple normalized vehicle listings.
- Seller claims, visual evidence, OCR, AI inference and confidence are kept distinct.
- PostgreSQL persistence plus FastAPI health, telemetry, posts, overview, listings and detail endpoints.
- Highly visual Next.js 16 frontend with live inventory, search/filter/sort, system telemetry and vehicle intelligence detail pages.
- Server-side frontend proxy exposes read-only vehicle data without exposing backend secrets.
- Docker Compose deployment and backend/frontend GitHub Actions CI.

## Architecture

```text
                       X API v2
                          |
                          v
                 incremental ingestor
                          |
                raw posts + media
                          |
             +------------+-------------+
             |                          |
             v                          v
        PostgreSQL               candidate prefilter
                                        |
                                        v
                           OpenAI multimodal extractor
                                        |
                                        v
                              normalized listings
                                        |
                                        v
                                    FastAPI
                                        |
                            server-side Next proxy
                                        |
                                        v
                          Next.js intelligence UI
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

Never commit credentials. For read-only public X data, the backend uses the app Bearer Token; no user-context OAuth credentials are required for this MVP.

### Polling window

```env
SCHEDULER_TIMEZONE=Africa/Nairobi
DAYTIME_START_HOUR=6
DAYTIME_END_HOUR=22
DAYTIME_POLL_SECONDS=600
NIGHTTIME_POLL_SECONDS=3600
```

This means 10-minute cycles during 06:00–21:59 EAT and hourly cycles during 22:00–05:59 EAT.

## Run the complete stack with Docker

```bash
cp .env.example .env
# edit .env
docker compose up -d --build
```

Open:

- Frontend: `http://localhost:3000`
- FastAPI docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

The frontend container reaches FastAPI over the internal Compose network and proxies browser requests through `/api/torque/*`. Manual ingestion remains a backend-only administrative action and requires `X-Admin-Key`; the public frontend does not proxy it.

## Backend endpoints

- `GET /health`
- `GET /api/status`
- `GET /api/overview`
- `POST /api/ingest/run` — requires `X-Admin-Key`
- `GET /api/posts`
- `GET /api/listings`
- `GET /api/listings/{id}`

## Frontend experience

The dashboard is designed as an automotive intelligence product rather than a generic admin template. It includes:

- animated market-pulse instrument hero;
- indexed inventory and AI enrichment telemetry;
- seller-account monitoring state and polling cadence;
- live listing cards using original seller media;
- search, status filters and price/year sorting;
- available / reserved / sold / price-drop presentation;
- full vehicle detail pages with gallery, structured specifications, seller text and original X link;
- evidence/provenance map for extracted fields;
- visual observations clearly marked non-diagnostic;
- responsive mobile and desktop layouts;
- strong empty/error states so the product still communicates system state before the first listing arrives.

## First run behaviour

With no stored `last_seen_post_id`, the service retrieves up to `INITIAL_LOOKBACK_POSTS` (default 100) from the configured account. It then stores the newest X Post ID and supplies it as `since_id` on subsequent requests.

If `OPENAI_API_KEY` is absent, candidate posts are safely retained with `ai_status=waiting_for_ai_key`; raw ingestion does not fail.

## Data-quality rules

The AI prompt is deliberately conservative. It must not infer mechanical condition, accident history, legal ownership, or authenticity from photographs. Missing values remain missing. Every extracted field can carry a `source` and `confidence` value in the listing's `evidence` JSON.

The frontend preserves this distinction by visually separating source description, structured values, evidence provenance and non-diagnostic observations.

## Local frontend development

Run FastAPI first on port 8000, then from `frontend/`:

```bash
npm install
TORQUE_API_INTERNAL_URL=http://127.0.0.1:8000 npm run dev
```

## Next development layers

1. Validate extraction quality against the real seller's historical posts.
2. Add cross-post identity linking for price drops, reservations, sold notices and relists.
3. Add trusted manufacturer/reference specification providers and conflict resolution.
4. Add admin review workflow for medium-confidence fields.
5. Add historical price/market comparison and alerting.
6. Add object storage only after the desired X-content retention policy is confirmed.

## Deployment note

Run a single scheduler-enabled backend replica for the MVP. If FastAPI is horizontally scaled later, move scheduling to a dedicated worker or add a distributed lock so replicas do not duplicate X polling.
