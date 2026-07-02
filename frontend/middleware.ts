import { NextRequest, NextResponse } from "next/server";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function roleHome(role: string | null): string {
  if (role === "admin") return "/admin";
  if (role === "agency") return "/agency";
  if (role === "user") return "/dashboard";
  return "/login";
}

function agencyStatusTarget(status: string | null): string {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "/agency";
  if (s === "rejected") return "/agency/rejected";
  return "/agency/pending-review";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("tourpie_token")?.value || null;

  const payload = token ? decodeJwtPayload(token) : null;
  const role = typeof payload?.role === "string" ? (payload.role as string) : null;
  const agencyStatus = typeof payload?.agency_status === "string" ? (payload.agency_status as string) : null;

  if (pathname === "/login") {
    if (role === "admin" || role === "agency") {
      return NextResponse.redirect(new URL(roleHome(role), req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/agency/register") {
    if (role === "agency") {
      return NextResponse.redirect(new URL(agencyStatusTarget(agencyStatus), req.url));
    }
    if (role === "admin") return NextResponse.redirect(new URL("/admin", req.url));
    if (role === "user") return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login")) {
    if (role === "admin") return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!token) return NextResponse.next();
    if (!role) return NextResponse.redirect(new URL("/admin/login", req.url));
    if (role !== "admin") return NextResponse.redirect(new URL(roleHome(role), req.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/agency")) {
    if (pathname.startsWith("/agency/register")) return NextResponse.next();
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (!role) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "agency") return NextResponse.redirect(new URL(roleHome(role), req.url));
    const target = agencyStatusTarget(agencyStatus);
    if (pathname.startsWith("/agency/pending-review")) {
      if (target !== "/agency/pending-review") return NextResponse.redirect(new URL(target, req.url));
      return NextResponse.next();
    }
    if (pathname.startsWith("/agency/rejected")) {
      if (target !== "/agency/rejected") return NextResponse.redirect(new URL(target, req.url));
      return NextResponse.next();
    }
    if (target !== "/agency") return NextResponse.redirect(new URL(target, req.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (!token) return NextResponse.next();
    if (!role) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "user") return NextResponse.redirect(new URL(roleHome(role), req.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/agency/:path*", "/dashboard/:path*", "/login", "/agency/register"],
};
