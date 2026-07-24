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
    "expect",
  ]);
  const headers = new Headers();
  input.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

function filterResponseHeaders(input: Headers) {
  const blocked = new Set(["content-length", "content-encoding", "transfer-encoding", "connection"]);
  const headers = new Headers();
  input.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) headers.append(key, value);
  });
  return headers;
}

async function proxyToBackend(request: Request, path: string, body: ArrayBuffer | undefined) {
  const url = new URL(request.url);
  const base = BACKEND_BASE_URL.replace(/\/+$/g, "");
  const normalizedPath = path.replace(/^\/+|\/+$/g, "");
  const dest = new URL(normalizedPath ? `${base}/${normalizedPath}` : `${base}/`);

  dest.search = url.search;
  
  const init: RequestInit = {
    method: request.method,
    headers: filterProxyHeaders(request.headers),
  };

  if (body && request.method !== "GET" && request.method !== "HEAD") {
    init.body = body;
  }

  const res = await fetch(dest.toString(), init);
  const responseHeaders = filterResponseHeaders(res.headers);
  const responseBody = await res.arrayBuffer();
  return new NextResponse(responseBody, { status: res.status, headers: responseHeaders });
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  const path = (segments || []).join("/");
  const body = request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;

  try {
    return await proxyToBackend(request, path, body);
  } catch (err) {
  console.error("PROXY ERROR:", err);

  if (err instanceof Error) {
    console.error(err.stack);
    console.error(err.cause);
  }

  return json(
    {
      detail: err instanceof Error ? err.message : String(err),
      error: "backend_unavailable",
    },
    503
  );
}
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) 
{
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
