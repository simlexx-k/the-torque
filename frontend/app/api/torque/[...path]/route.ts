import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase() {
  const configured = process.env.TORQUE_API_BASE_URL || process.env.TORQUE_API_INTERNAL_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://127.0.0.1:8000";
  return "";
}

function backendHeaders() {
  const headers = new Headers({
    Accept: "application/json",
    "User-Agent": "the-torque-vercel-proxy/1.0",
  });

  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (clientId && clientSecret) {
    headers.set("CF-Access-Client-Id", clientId);
    headers.set("CF-Access-Client-Secret", clientSecret);
  }

  return headers;
}

async function forward(request: NextRequest, path: string[]) {
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
        "cache-control": "no-store",
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
