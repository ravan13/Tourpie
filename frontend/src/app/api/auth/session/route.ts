import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tourpie_token";

function isSecureRequest(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.toLowerCase() === "https";
  return req.nextUrl.protocol === "https:";
}

export async function POST(req: NextRequest) {
  const data = (await req.json().catch(() => null)) as { token?: unknown; maxAgeSeconds?: unknown; sessionOnly?: unknown } | null;
  const token = typeof data?.token === "string" ? data.token.trim() : "";
  if (!token) return NextResponse.json({ detail: "Token is required" }, { status: 400 });

  const maxAgeSecondsRaw = data?.maxAgeSeconds;
  const sessionOnly = data?.sessionOnly === true;
  const maxAgeSeconds =
    !sessionOnly && typeof maxAgeSecondsRaw === "number" && Number.isFinite(maxAgeSecondsRaw) && maxAgeSecondsRaw > 0
      ? Math.floor(maxAgeSecondsRaw)
      : undefined;

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/",
    ...(typeof maxAgeSeconds === "number" ? { maxAge: maxAgeSeconds } : {}),
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/",
    maxAge: 0,
  });
  return res;
}
