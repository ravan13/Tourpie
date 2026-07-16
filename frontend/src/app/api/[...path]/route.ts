import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function filterProxyHeaders(input: Headers) {
  const blocked = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
  ]);
  const headers = new Headers();
  input.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

async function proxyToBackend(request: Request, path: string, body: ArrayBuffer | undefined) {
  const url = new URL(request.url);
  const base = BACKEND_BASE_URL.replace(/\/+$/g, "");
  const dest = new URL(`${base}/${path}`);
  dest.search = url.search;

  const init: RequestInit = {
    method: request.method,
    headers: filterProxyHeaders(request.headers),
  };

  if (body && request.method !== "GET" && request.method !== "HEAD") {
    init.body = body;
  }

  const res = await fetch(dest.toString(), init);
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  }

  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "content-type": contentType || "text/plain" } });
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  const path = (segments || []).join("/");
  const body = request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;

  try {
    return await proxyToBackend(request, path, body);
  } catch {
    return json(
      {
        detail: "Backend service is unavailable.",
        error: "backend_unavailable",
      },
      503
    );
  }
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context);
}

export function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context);
}

export function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context);
}

export function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context);
}

export function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context);
}
