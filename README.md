# The Torque

The Torque is an AI-assisted vehicle listing intelligence platform. It watches a configurable public X account, incrementally ingests new posts and attached media, classifies listing activity, extracts vehicle details with provenance/confidence, persists normalized records, and presents them in a multipage Next.js intelligence product.

## Production topology

```text
Browser
  |
  v
Vercel / Next.js frontend
  |
  | server-side read-only proxy
  v
Cloudflare API hostname
  |
  v
Cloudflare Tunnel
  |
  | Docker network: http://app:8000
  v
FastAPI container
  |
  v
PostgreSQL container
```

The frontend does not need direct database/X/AI-provider access. X, Gemini, PostgreSQL and administrative secrets stay on the VPS. The browser talks to same-origin Next.js routes under `/api/torque/*`; the Next.js server route forwards those requests to the tunneled FastAPI hostname.

See [`docs/deployment.md`](docs/deployment.md) for the Vercel + VPS + Cloudflare Tunnel deployment procedure.

## Current capabilities

- Official X API v2 ingestion using a Bearer Token.
- Resolves `X_TARGET_USERNAME` once and caches its numeric X user ID in PostgreSQL.
- Uses `last_seen_post_id` as X `since_id`, so normal polling only asks for newer posts.
- Pulls attached media via `attachments.media_keys` expansion.
- Configurable first-run lookback and bounded pagination.
- Polls every 10 minutes from 06:00–22:00 Africa/Nairobi and hourly overnight by default.
- Cheap prefilter before AI so obvious unrelated posts do not spend multimodal inference calls.
- Provider-neutral multimodal enrichment with Google Gemini as the default backend.
- Gemini structured JSON extraction with image understanding; OpenAI remains optional for backwards compatibility only.
- One post can yield multiple normalized vehicle listings.
- Seller claims, visual evidence, OCR, AI inference and confidence are kept distinct.
- Failed/waiting enrichment posts remain stored and are automatically retried on later scheduler cycles up to a configurable attempt limit.
- Protected bulk and per-post retry endpoints for operator recovery.
- PostgreSQL persistence plus FastAPI health, telemetry, posts, overview, listings and detail endpoints.
- Multipage frontend: Home, Inventory, Signals, Market, Watchlist, Compare, System and vehicle detail pages.
- Raw Signals feed shows captured X posts even when AI enrichment is waiting or failed.
- Optional Cloudflare Access service-token support between Vercel and the API hostname.
- Backend/frontend GitHub Actions CI.

## Backend configuration

Copy `.env.example` to `.env` on the VPS and supply at least:

```env
X_BEARER_TOKEN=...
X_TARGET_USERNAME=dealer_handle_without_at

AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite

POSTGRES_PASSWORD=use-a-strong-password
ADMIN_API_KEY=use-another-long-random-secret
CLOUDFLARED_TOKEN=...
```

OpenAI is not required. If it is intentionally used as a fallback provider, install the optional dependency and configure `AI_PROVIDER=openai` plus the corresponding OpenAI values.

Enrichment recovery controls:

```env
AI_MAX_IMAGES=6
AI_RETRY_BATCH_SIZE=10
AI_RETRY_MAX_ATTEMPTS=5
```

For the production tunnel hostname, harden Host validation:

```env
TRUSTED_HOSTS=torque-api.a3slabs.co.ke,127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=
```

CORS can remain empty because the Vercel frontend uses a server-side proxy rather than browser-to-backend cross-origin calls.

### Polling window

```env
SCHEDULER_TIMEZONE=Africa/Nairobi
DAYTIME_START_HOUR=6
DAYTIME_END_HOUR=22
DAYTIME_POLL_SECONDS=600
NIGHTTIME_POLL_SECONDS=3600
```

This means 10-minute cycles during 06:00–21:59 EAT and hourly cycles during 22:00–05:59 EAT.

## Run the VPS backend

```bash
# edit the existing .env; do not overwrite production secrets
docker compose up -d --build
```

FastAPI is not published on a VPS host port. `cloudflared` reaches it over the shared Compose network as:

```text
http://app:8000
```

Useful backend endpoints:

- `GET /health`
- `GET /api/status`
- `GET /api/overview`
- `POST /api/ingest/run` — requires `X-Admin-Key`
- `POST /api/enrichment/retry-failed` — requires `X-Admin-Key`
- `POST /api/posts/{id}/retry-enrichment` — requires `X-Admin-Key`
- `GET /api/posts`
- `GET /api/listings`
- `GET /api/listings/{id}`

## Deploy the frontend on Vercel

The Vercel project uses `frontend/` as its working directory. Configure the server-side backend URL:

```env
TORQUE_API_BASE_URL=https://torque-api.a3slabs.co.ke
```

Do not use a `NEXT_PUBLIC_` prefix. The URL is consumed by the Next.js server-side route handler.

If the API hostname is protected with Cloudflare Access Service Auth, also configure these as sensitive Vercel variables:

```env
CF_ACCESS_CLIENT_ID=...
CF_ACCESS_CLIENT_SECRET=...
```

## Frontend experience

The frontend is an automotive intelligence product rather than a generic admin template. It includes a cinematic home surface, dedicated inventory explorer, raw signal feed, market snapshot, local-first watchlist and comparison workflows, system telemetry, vehicle detail galleries, structured specifications, original X links, evidence/provenance maps and clearly labelled non-diagnostic visual observations.

The Signals page intentionally displays captured posts before normalization. An `ai_status=error` post therefore remains visible even if no `Listing` row exists yet.

## First run and recovery behaviour

With no stored `last_seen_post_id`, the service retrieves up to `INITIAL_LOOKBACK_POSTS` (default 100) from the configured account. It then stores the newest X Post ID and supplies it as `since_id` on subsequent requests.

If the selected provider key is absent, candidate posts are retained with `ai_status=waiting_for_ai_key`; raw ingestion does not fail. Once the provider becomes configured, waiting posts are automatically eligible for retry.

If a provider/network/structured-output request fails, the captured `Post` and `Media` rows remain intact with `ai_status=error`. Later scheduler cycles retry those records in bounded batches. Retry metadata (provider, model, attempts, last error and attempt time) is stored in the existing `ai_payload` JSON, so this recovery feature does not require a schema migration.

## Data-quality rules

The AI prompt is deliberately conservative. It must not infer mechanical condition, accident history, legal ownership, or authenticity from photographs. Missing values remain missing. Every extracted field can carry a `source` and `confidence` value in the listing's `evidence` JSON.

## Next development layers

1. Validate Gemini extraction quality against the real seller's historical posts.
2. Add cross-post identity linking for price drops, reservations, sold notices and relists.
3. Add trusted manufacturer/reference specification providers and conflict resolution.
4. Add admin review workflow for medium-confidence or exhausted-retry fields.
5. Add historical price/market comparison and alerting.
6. Add object storage only after the desired X-content retention policy is confirmed.

Run a single scheduler-enabled backend replica for the MVP. If FastAPI is horizontally scaled later, move scheduling to a dedicated worker or add a distributed lock so replicas do not duplicate X polling.
