# Public routing and identifier security

The Torque separates database identity from public web identity.

## Listing identifiers

`listings.id` remains the integer PostgreSQL primary key. It is retained for joins, foreign-key stability and backwards-compatible API consumers.

Public web links use `listings.public_id`, a stored 128-bit random URL-safe identifier with the form:

```text
lst_<22 random URL-safe characters>
```

Example:

```text
/listings/lst_7y2JAuN5sR9dXBk4MxqQpA
```

The public identifier is generated independently of the integer primary key. It does not encode the database ID, creation time or record order.

Existing databases receive the `public_id` column and a unique index during startup. Existing listing rows are backfilled without replacing or renumbering their integer primary keys.

## Backwards compatibility

The FastAPI endpoint accepts both forms:

```text
GET /api/listings/lst_7y2JAuN5sR9dXBk4MxqQpA   # preferred
GET /api/listings/70                           # legacy
```

A successful legacy numeric lookup remains HTTP 200 and includes the same listing response, plus:

```text
Deprecation: true
Link: </api/listings/<public_id>>; rel="canonical"
X-Torque-Public-Id: <public_id>
```

This avoids breaking existing backend clients while advertising the replacement identifier.

Old web links such as `/listings/70` are resolved server-side and redirected to the canonical opaque URL as soon as the backend has `public_id` support.

## Public Next.js proxy allowlist

The Vercel proxy is no longer an unrestricted pass-through to arbitrary backend GET routes. It validates path depth, path characters and query keys.

Normal public production routes are limited to:

```text
GET /api/torque/listings
GET /api/torque/listings/<public_id>
GET /api/torque/listings/<public_id>/history
```

The listings collection accepts only the bounded/read-only query keys `limit`, `page` and `source`. The backend keeps the original array response for callers that omit `page`; callers using `page` receive a pagination envelope with `items` and pagination metadata. This permits catalogue traversal without reopening arbitrary proxy query forwarding.

Operator data routes (`overview`, `posts`, `status`) return 404 in production unless `TORQUE_PUBLIC_OPERATOR_ROUTES=true` is explicitly set. When enabled, the posts collection uses the same `limit`, `page` and `source` query allowlist. The `/system` and `/signals` pages use the same production gate.

Malformed or unexpectedly nested paths return 404 before they are forwarded to FastAPI.

`TORQUE_ALLOW_LEGACY_PUBLIC_IDS=true` exists only as a rolling-deploy compatibility switch. After the backend migration is live, set it to `false` in Vercel so requests such as `/api/torque/listings/70` are rejected at the public proxy. Old browser URLs continue to redirect through the server-side listing page.

## API hostname boundary

The backend hostname should be treated as an origin/API service for Vercel, not as a second public browsing API.

Protect the Cloudflare hostname with a Cloudflare Access Service Auth policy and configure the Vercel deployment with:

```env
CF_ACCESS_CLIENT_ID=...
CF_ACCESS_CLIENT_SECRET=...
```

Both the public proxy and server-side listing metadata requests send these headers when configured.

Do not put these credentials in `NEXT_PUBLIC_*` variables.

FastAPI Swagger, ReDoc and OpenAPI discovery routes are disabled by default with:

```env
API_DOCS_ENABLED=false
```

Only enable API docs on a trusted development/operator deployment.

## Safe rollout

1. Merge the change with `TORQUE_ALLOW_LEGACY_PUBLIC_IDS=true` in Vercel for the transition window.
2. Pull the merged backend on the VPS and rebuild/restart the Compose app.
3. App startup adds/backfills `listings.public_id` while preserving all existing integer IDs and foreign keys.
4. Verify a listing response contains `public_id`:

   ```bash
   curl -s https://torque-api.a3slabs.co.ke/api/listings?limit=1
   ```

   If Cloudflare Access is enabled, perform the verification from the app container or include the service-auth credentials without exposing them in shell history.
5. Verify an old browser route such as `/listings/70` redirects to `/listings/lst_...`.
6. In Vercel set:

   ```env
   TORQUE_ALLOW_LEGACY_PUBLIC_IDS=false
   TORQUE_PUBLIC_OPERATOR_ROUTES=false
   ```

   Redeploy.
7. Confirm `/api/torque/listings/70`, `/system`, `/signals`, `/api/torque/posts`, `/api/torque/status` and `/api/torque/overview` return 404 on the public Vercel deployment.
8. Keep the backend numeric API compatibility until all non-browser integrations have migrated to `public_id`.

## Additional abuse controls

Opaque identifiers reduce trivial sequential enumeration; they are not an authorization mechanism. Public listing data is intentionally readable, while operator/admin data must remain behind an authenticated boundary.

Use Cloudflare Access on the API hostname, Cloudflare/Vercel rate limiting for abnormal request volumes, bounded per-request API limits, server-side secret storage, and the existing admin-key protection for mutation/retry endpoints. Pagination removes the former 100/200-record frontend ceilings without removing the per-request bound of 200 records.
