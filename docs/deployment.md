# Deployment: Vercel frontend + VPS backend + Cloudflare Tunnel

The production topology is intentionally split:

```text
Browser
  |
  v
Vercel / Next.js
  |
  | server-side /api/torque/* proxy
  v
https://torque-api.a3slabs.co.ke
  |
  v
Cloudflare Tunnel
  |
  v
cloudflared container
  |
  | Docker network: http://app:8000
  v
FastAPI container ---> PostgreSQL container
```

The browser never needs the VPS IP, backend hostname internals, or backend secrets. The Next.js route handler proxies read-only API calls server-to-server.

## 1. VPS environment

Edit the existing production `.env` and configure the runtime secrets. Do not overwrite an existing `.env` with `.env.example` because it may already contain X, database, admin and tunnel credentials.

At minimum:

```env
POSTGRES_PASSWORD=...
X_BEARER_TOKEN=...
X_TARGET_USERNAME=...

AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite
AI_MAX_IMAGES=6
AI_RETRY_BATCH_SIZE=10
AI_RETRY_MAX_ATTEMPTS=5

ADMIN_API_KEY=...
CLOUDFLARED_TOKEN=...

TRUSTED_HOSTS=torque-api.a3slabs.co.ke,127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=
```

OpenAI is not required for the default deployment. `OPENAI_API_KEY`, `OPENAI_MODEL` and `OPENAI_IMAGE_DETAIL` are retained only for an intentional backwards-compatible `AI_PROVIDER=openai` deployment.

Never commit `.env`. It is ignored by Git.

If a Cloudflare Tunnel token has been pasted into chat, logs, tickets, source code, or another place outside the VPS secret store, rotate the tunnel token in Cloudflare before using it in production.

### Enrichment recovery

Candidate posts are always persisted before enrichment. If Gemini is unavailable, returns invalid structured output, or an image cannot be processed, the post remains visible in `/api/posts` with an enrichment state rather than disappearing from the system.

The scheduler retries `error` and `waiting_for_ai_key` posts in bounded batches before polling X for new posts. The relevant controls are:

```env
AI_RETRY_BATCH_SIZE=10
AI_RETRY_MAX_ATTEMPTS=5
```

Operator recovery endpoints are protected by `X-Admin-Key`:

```text
POST /api/enrichment/retry-failed?limit=25
POST /api/posts/{post_id}/retry-enrichment
```

Retry metadata is stored in the existing post `ai_payload` JSON, so this feature does not require a PostgreSQL schema migration.

## 2. Docker Compose stack

The VPS stack contains three services:

- `db` — PostgreSQL 17 with a startup grace period for first-volume initialization.
- `app` — FastAPI, reachable only on the Compose network as `http://app:8000`. Port 8000 is not published on the VPS host.
- `cloudflared` — remotely managed Cloudflare Tunnel connector using `CLOUDFLARED_TOKEN` from `.env`.

Start the stack in the background:

```bash
docker compose up -d --build
```

Inspect state:

```bash
docker compose ps
```

Follow logs when required:

```bash
docker compose logs -f db app cloudflared
```

Verify FastAPI from inside the app container:

```bash
docker compose exec app python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
```

No FastAPI port is bound on the VPS host. This avoids host-port conflicts and keeps the backend reachable only through the internal Compose network and Cloudflare Tunnel.

## 3. Remotely managed Cloudflare Tunnel

This deployment uses the token-based, remotely managed tunnel model. The Cloudflare dashboard owns the published hostname configuration; no local tunnel UUID/credentials JSON is required.

Configure the published application route as:

```text
Hostname: torque-api.a3slabs.co.ke
Service:  http://app:8000
```

The service hostname is `app`, not `127.0.0.1`, because `cloudflared` itself runs inside Docker. Docker DNS resolves `app` to the FastAPI container on the shared Compose network.

Do not launch a second standalone `docker run cloudflare/cloudflared ...` connector once the Compose-managed `cloudflared` service is running. Multiple replicas are valid, but a second ad-hoc container is unnecessary for this single-VPS deployment.

Verify the public route after the Compose stack is healthy:

```bash
curl https://torque-api.a3slabs.co.ke/health
```

### Optional: protect the API with Cloudflare Access

For a stronger production posture, place the API hostname behind a Cloudflare Access Service Auth policy and create a service token for Vercel. Add these to Vercel as encrypted server-side environment variables:

```env
CF_ACCESS_CLIENT_ID=...
CF_ACCESS_CLIENT_SECRET=...
```

The Next.js proxy forwards the Access headers when both values are configured.

## 4. Vercel frontend

The Vercel project uses the `frontend/` application as its working directory. Keep the deployment configuration that successfully builds the Next.js app and set:

```env
TORQUE_API_BASE_URL=https://torque-api.a3slabs.co.ke
```

Do not prefix this variable with `NEXT_PUBLIC_`; it is intentionally server-side and used by the Next.js route handler.

After changing Vercel environment variables, redeploy so the new deployment receives them.

## 5. Request flow

Frontend code calls same-origin routes such as:

```text
/api/torque/overview
/api/torque/posts
/api/torque/listings
/api/torque/listings/123
```

Vercel resolves those through the Next.js route handler, which calls:

```text
https://torque-api.a3slabs.co.ke/api/overview
https://torque-api.a3slabs.co.ke/api/posts
https://torque-api.a3slabs.co.ke/api/listings
https://torque-api.a3slabs.co.ke/api/listings/123
```

Manual ingestion and enrichment recovery remain protected. `POST /api/ingest/run`, `POST /api/enrichment/retry-failed`, and `POST /api/posts/{id}/retry-enrichment` require `X-Admin-Key` and are not exposed as public frontend actions.

## 6. Production checks

- `docker compose ps` shows `db` and `app` healthy and `cloudflared` running.
- The in-container `/health` check succeeds and reports `ai_provider=gemini` plus `ai_configured=true` after the Gemini key is configured.
- `curl https://torque-api.a3slabs.co.ke/health` succeeds through Cloudflare.
- The frontend `/signals` page shows captured posts even if enrichment has failed or is waiting.
- Cloudflare's published route points to `http://app:8000`.
- VPS firewall does not expose port 8000 publicly.
- PostgreSQL has no published host port.
- `TRUSTED_HOSTS` contains `torque-api.a3slabs.co.ke`, `127.0.0.1`, and `localhost`.
- X, Gemini, PostgreSQL, admin, and tunnel credentials exist only in the VPS `.env` file or an equivalent secret store.
- Vercel stores only `TORQUE_API_BASE_URL` and, if Access is enabled, the Cloudflare Access service-token credentials.
