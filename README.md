# The Torque

The Torque is an AI-assisted vehicle listing intelligence platform. It watches a configurable public X account, incrementally ingests new posts and attached media, classifies listing activity, extracts vehicle details with provenance/confidence, persists normalized records, and presents them in an image-led Next.js intelligence dashboard.

## Production topology

The production deployment is split deliberately:

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
  v
FastAPI on VPS (127.0.0.1:8000)
  |
  v
PostgreSQL
```

The frontend does not need direct database/X/OpenAI access. X, OpenAI, PostgreSQL and administrative secrets stay on the VPS. The browser talks to same-origin Next.js routes under `/api/torque/*`; the Next.js server route forwards those requests to the tunneled FastAPI hostname.

See [`docs/deployment.md`](docs/deployment.md) for the Vercel + VPS + Cloudflare Tunnel deployment procedure.

## Current capabilities

- Official X API v2 ingestion using a Bearer Token.
- Resolves `X_TARGET_USERNAME` once and caches its numeric X user ID in PostgreSQL.
- Uses `last_seen_post_id` as X `since_id`, so normal polling only asks for newer posts.
- Pulls attached media via `attachments.media_keys` expansion.
- Configurable first-run lookback and bounded pagination.
- Polls every 10 minutes from 06:00–22:00 Africa/Nairobi and hourly overnight by default.
- Cheap prefilter before AI so obvious unrelated posts do not spend multimodal inference calls.
- OpenAI Responses API multimodal extraction with structured Pydantic output.
- One post can yield multiple normalized vehicle listings.
- Seller claims, visual evidence, OCR, AI inference and confidence are kept distinct.
- PostgreSQL persistence plus FastAPI health, telemetry, posts, overview, listings and detail endpoints.
- Highly visual Next.js frontend with live inventory, search/filter/sort, system telemetry and vehicle intelligence detail pages.
- Optional Cloudflare Access service-token support between Vercel and the API hostname.
- Backend/frontend GitHub Actions CI.

## Backend configuration

Copy `.env.example` to `.env` on the VPS and supply at least:

```env
X_BEARER_TOKEN=...
X_TARGET_USERNAME=dealer_handle_without_at
OPENAI_API_KEY=...
POSTGRES_PASSWORD=use-a-strong-password
ADMIN_API_KEY=use-another-long-random-secret
```

For the production tunnel hostname, harden Host validation:

```env
TRUSTED_HOSTS=api.example.com,127.0.0.1,localhost
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
cp .env.example .env
# edit .env
docker compose up -d --build
```

FastAPI is bound only to VPS loopback:

```text
127.0.0.1:8000
```

Cloudflare Tunnel publishes the external API hostname to that local service. Do not expose port 8000 publicly.

Useful backend endpoints:

- `GET /health`
- `GET /api/status`
- `GET /api/overview`
- `POST /api/ingest/run` — requires `X-Admin-Key`
- `GET /api/posts`
- `GET /api/listings`
- `GET /api/listings/{id}`

## Deploy the frontend on Vercel

Import this GitHub repository into Vercel and set the project **Root Directory** to `frontend`.

Configure the server-side backend URL:

```env
TORQUE_API_BASE_URL=https://api.example.com
```

Do not use a `NEXT_PUBLIC_` prefix. The URL is consumed by the Next.js server-side route handler.

If the API hostname is protected with Cloudflare Access Service Auth, also configure these as sensitive Vercel variables:

```env
CF_ACCESS_CLIENT_ID=...
CF_ACCESS_CLIENT_SECRET=...
```

## Local frontend development

Run FastAPI locally on port 8000, then from `frontend/`:

```bash
cp .env.example .env.local
npm install
npm run dev
```

The development fallback is `http://127.0.0.1:8000`.

## Frontend experience

The dashboard is designed as an automotive intelligence product rather than a generic admin template. It includes an animated market-pulse hero, seller-account monitoring state, live vehicle cards using seller media, search/filter/sort controls, vehicle detail galleries, structured specifications, original X links, evidence/provenance maps and clearly labelled non-diagnostic visual observations.

## First run behaviour

With no stored `last_seen_post_id`, the service retrieves up to `INITIAL_LOOKBACK_POSTS` (default 100) from the configured account. It then stores the newest X Post ID and supplies it as `since_id` on subsequent requests.

If `OPENAI_API_KEY` is absent, candidate posts are safely retained with `ai_status=waiting_for_ai_key`; raw ingestion does not fail.

## Data-quality rules

The AI prompt is deliberately conservative. It must not infer mechanical condition, accident history, legal ownership, or authenticity from photographs. Missing values remain missing. Every extracted field can carry a `source` and `confidence` value in the listing's `evidence` JSON.

## Next development layers

1. Validate extraction quality against the real seller's historical posts.
2. Add cross-post identity linking for price drops, reservations, sold notices and relists.
3. Add trusted manufacturer/reference specification providers and conflict resolution.
4. Add admin review workflow for medium-confidence fields.
5. Add historical price/market comparison and alerting.
6. Add object storage only after the desired X-content retention policy is confirmed.

Run a single scheduler-enabled backend replica for the MVP. If FastAPI is horizontally scaled later, move scheduling to a dedicated worker or add a distributed lock so replicas do not duplicate X polling.
