"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import { broadcastLogout, clearSessionToken, getStoredToken, getStoredTokenPayload, markSessionExpired } from "@/lib/api";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

export default function DashboardShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  nav: DashboardNavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isProtected =
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/agency" ||
      pathname.startsWith("/agency/") ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/");
    if (!isProtected) return;

    const token = getStoredToken();
    const loginHref = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    if (!token) {
      router.replace(loginHref);
      return;
    }

    const payload = getStoredTokenPayload();
    const role = typeof payload?.role === "string" ? payload.role.toLowerCase() : null;
    const expRaw = payload ? (payload as Record<string, unknown>)["exp"] : null;
    const exp = typeof expRaw === "number" ? expRaw : typeof expRaw === "string" ? Number(expRaw) : null;
    if (typeof exp === "number" && Number.isFinite(exp) && exp > 0 && Date.now() >= exp * 1000) {
      markSessionExpired("auth");
      broadcastLogout("auth");
      clearSessionToken();
      router.replace(`${loginHref}?reason=session_expired`);
      return;
    }

    if (pathname.startsWith("/admin") && role !== "admin") {
      markSessionExpired("auth");
      broadcastLogout("auth");
      clearSessionToken();
      router.replace("/admin/login");
      return;
    }
    if (pathname.startsWith("/agency") && role !== "agency") {
      markSessionExpired("auth");
      broadcastLogout("auth");
      clearSessionToken();
      router.replace("/login");
      return;
    }
    if (pathname.startsWith("/dashboard") && role !== "user") {
      markSessionExpired("auth");
      broadcastLogout("auth");
      clearSessionToken();
      router.replace("/login");
      return;
    }
  }, [pathname, router]);

  const activeHref = useMemo(() => {
    const matches = nav
      .map((n) => n.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length);
    return matches[0] || "";
  }, [nav, pathname]);

  const activeItem = useMemo(() => {
    if (!activeHref) return null;
    return nav.find((n) => n.href === activeHref) || null;
  }, [activeHref, nav]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="px-4 h-16 flex items-center justify-between">
          <Logo className="gap-3" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-black text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
        {open ? (
          <div className="px-4 pb-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
              {nav.map((item) => (
                item.href === "/" || item.href === "/login" || item.href === "/agency/register" ? (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      activeHref === item.href ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      activeHref === item.href ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </Link>
                )
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-10 flex gap-8">
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-10">
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6">
              <Logo className="gap-3" />
              <div className="mt-6 space-y-1">
                {nav.map((item) => (
                  item.href === "/" || item.href === "/login" || item.href === "/agency/register" ? (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        activeHref === item.href
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm">{item.label}</span>
                    </a>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        activeHref === item.href
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  )
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl w-7">{activeItem ? activeItem.icon : null}</div>
                  <div className="text-3xl font-black text-gray-900">{title}</div>
                </div>
                {subtitle ? <div className="text-gray-500 font-medium mt-2">{subtitle}</div> : null}
              </div>
            </div>
          </div>

          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
