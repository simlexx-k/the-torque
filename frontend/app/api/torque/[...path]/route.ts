import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PUBLIC_LISTING_RE = /^lst_[A-Za-z0-9_-]{22}$/;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9_-]{1,64}$/;
const OPERATOR_ROUTES = new Set(["overview", "posts", "status"]);

function backendBase() {
  const configured = process.env.TORQUE_API_BASE_URL || process.env.TORQUE_API_INTERNAL_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://127.0.0.1:8000";
  return "";
}

function backendHeaders() {
  const headers = new Headers({
    Accept: "application/json",
    "User-Agent": "the-torque-vercel-proxy/1.1",
  });

  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (clientId && clientSecret) {
    headers.set("CF-Access-Client-Id", clientId);
    headers.set("CF-Access-Client-Secret", clientSecret);
  }

  return headers;
}

function operatorRoutesEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.TORQUE_PUBLIC_OPERATOR_ROUTES === "true";
}

function routeAllowed(path: string[]) {
  if (!path.length || path.length > 2 || path.some((segment) => !SAFE_SEGMENT_RE.test(segment))) {
    return false;
  }

  if (path[0] === "listings") {
    if (path.length === 1) return true;
    // The public proxy intentionally refuses enumerable legacy numeric ids.
    // Old /listings/70 web URLs are resolved server-side and redirected to the
    // opaque canonical URL; direct backend API clients remain compatible.
    return PUBLIC_LISTING_RE.test(path[1]);
  }

  if (OPERATOR_ROUTES.has(path[0])) {
    return path.length === 1 && operatorRoutesEnabled();
  }

  return false;
}

function queryAllowed(request: NextRequest, path: string[]) {
  const keys = Array.from(request.nextUrl.searchParams.keys());
  if (path[0] === "listings" || path[0] === "posts") {
    return keys.every((key) => key === "limit");
  }
  return keys.length === 0;
}

function publicCacheControl(path: string[]) {
  if (path[0] === "listings") return "public, s-maxage=30, stale-while-revalidate=120";
  return "no-store";
}

async function forward(request: NextRequest, path: string[]) {
  if (!routeAllowed(path) || !queryAllowed(request, path)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      { detail: "TORQUE_API_BASE_URL is not configured for this deployment." },
      { status: 503 },
    );
  }

  const backendPath = `/api/${path.join("/")}`;
  const target = new URL(`${base}${backendPath}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  try {
    const response = await fetch(target, {
      method: "GET",
      headers: backendHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const text = await response.text();
    return new NextResponse(text || null, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": publicCacheControl(path),
        "x-robots-tag": "noindex, nofollow",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ detail: "The Torque API is unreachable." }, { status: 502 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, path);
}
