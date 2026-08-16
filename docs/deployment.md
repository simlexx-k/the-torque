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
https://api.example.com
  |
  v
Cloudflare Tunnel
  |
  v
127.0.0.1:8000 on VPS
  |
  v
FastAPI container ---> PostgreSQL container
```

The browser never needs the backend hostname or any backend secret. The Next.js route handler proxies read-only API calls server-to-server.

## 1. VPS backend

Copy `.env.example` to `.env` on the VPS and configure the X/OpenAI/database secrets. For production network hardening, use values similar to:

```env
TRUSTED_HOSTS=api.example.com,127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=
```

`CORS_ALLOWED_ORIGINS` can remain empty because Vercel calls FastAPI server-to-server. If a trusted browser client later calls FastAPI directly, explicitly list its origins as a comma-separated value rather than using a wildcard.

Start the backend:

```bash
docker compose up -d --build
```

The Compose file binds FastAPI to `127.0.0.1:8000` only. Do not open TCP/8000 in the VPS firewall.

Verify locally on the VPS:

```bash
curl http://127.0.0.1:8000/health
```

## 2. Cloudflare Tunnel

Publish one API hostname (for example `api.example.com`) to `http://127.0.0.1:8000`.

For a remotely managed tunnel, create the tunnel in the Cloudflare dashboard, install `cloudflared` on the VPS using the generated command, and add a published-application route whose service URL is:

```text
http://127.0.0.1:8000
```

For a locally managed tunnel, copy `deploy/cloudflared/config.yml.example`, substitute the tunnel UUID, credentials path and API hostname, then install it as a Linux service. A typical command is:

```bash
sudo cloudflared --config /etc/cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
```

Keep inbound VPS firewall rules closed except for administration paths you actually need. `cloudflared` establishes outbound tunnel connections.

### Optional: protect the API with Cloudflare Access

For a stronger production posture, place the API hostname behind a Cloudflare Access Service Auth policy and create a service token for Vercel. Add the generated values to Vercel as encrypted environment variables:

```env
CF_ACCESS_CLIENT_ID=...
CF_ACCESS_CLIENT_SECRET=...
```

The Next.js proxy already forwards those headers when both values are configured. This allows the public website to remain usable while direct requests to the backend hostname can be denied by Access.

## 3. Vercel frontend

The repository contains the Next.js application in `frontend/`, while the repository root also contains the Python backend. Normally Vercel would use **Root Directory = `frontend`**. If the Vercel project does not allow that setting to be changed, the repository-level `vercel.json` handles the nested frontend explicitly instead.

The root `vercel.json` configures:

```json
{
  "framework": "nextjs",
  "installCommand": "npm install --prefix frontend --no-audit --no-fund",
  "buildCommand": "npm run build --prefix frontend",
  "devCommand": "npm run dev --prefix frontend",
  "outputDirectory": "frontend/.next"
}
```

Therefore the Vercel project can remain rooted at the repository root. Do not additionally set a `frontend` Root Directory when using this configuration, otherwise paths can be doubled.

Set this server-side environment variable in Production and Preview as appropriate:

```env
TORQUE_API_BASE_URL=https://api.example.com
```

Do **not** prefix this variable with `NEXT_PUBLIC_`; it is intentionally server-side and used only by the Next.js route handler.

If Cloudflare Access Service Auth is enabled, also add `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` to Vercel as sensitive values.

After changing Vercel environment variables, redeploy so the new deployment receives them.

### Important branch note

Vercel production deployments normally follow the repository's production/default branch. The application and `vercel.json` must exist on that branch. Until PR #1 is merged, `main` does not contain the full application.

## 4. Request flow

Frontend code calls same-origin routes such as:

```text
/api/torque/overview
/api/torque/listings
/api/torque/listings/123
```

Vercel resolves those through the Next.js route handler, which calls:

```text
https://api.example.com/api/overview
https://api.example.com/api/listings
https://api.example.com/api/listings/123
```

Manual ingestion is deliberately not proxied by the frontend. `POST /api/ingest/run` remains protected with `X-Admin-Key` and should be invoked only from trusted administrative tooling.

## 5. Recommended production checks

- `https://api.example.com/health` returns `status: ok` (or is reachable with the Access service token if Access is enabled).
- Vercel deployment can load `/api/torque/overview`.
- VPS firewall does not expose port 8000 publicly.
- PostgreSQL is not published on a host port.
- `TRUSTED_HOSTS` contains the API hostname and loopback hosts.
- X, OpenAI, PostgreSQL and admin credentials exist only on the VPS.
- Cloudflare Access service-token credentials, if used, exist only in Vercel server-side environment variables.
