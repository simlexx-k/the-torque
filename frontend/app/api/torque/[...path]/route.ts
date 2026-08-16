import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase() {
  return (process.env.TORQUE_API_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function forward(request: NextRequest, path: string[]) {
  const backendPath = `/api/${path.join("/")}`;
  const target = new URL(`${backendBase()}${backendPath}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers = new Headers({ Accept: "application/json" });

  try {
    const response = await fetch(target, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text || null, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ detail: "The Torque API is unreachable." }, { status: 502 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(request, path);
}
