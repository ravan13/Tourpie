"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo } from "react";
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

  useEffect(() => {
    void (async () => {
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
        await clearSessionToken();
        router.replace(`${loginHref}?reason=session_expired`);
        return;
      }

      if (pathname.startsWith("/admin") && role !== "admin") {
        markSessionExpired("auth");
        broadcastLogout("auth");
        await clearSessionToken();
        router.replace("/admin/login");
        return;
      }
      if (pathname.startsWith("/agency") && role !== "agency") {
        markSessionExpired("auth");
        broadcastLogout("auth");
        await clearSessionToken();
        router.replace("/login");
        return;
      }
      if (pathname.startsWith("/dashboard") && role !== "user") {
        markSessionExpired("auth");
        broadcastLogout("auth");
        await clearSessionToken();
        router.replace("/login");
      }
    })();
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
    <div className="tp-page-shell min-h-screen overflow-x-clip">
      <div className="relative z-[1] mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-6 lg:py-10">
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-10">
            <div className="rounded-[2rem] border border-white/70 bg-white/82 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
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

        <main className="min-w-0 flex-1 overflow-x-clip">
          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/82 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[2.5rem] sm:p-6 lg:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <div className="w-7 shrink-0 text-2xl">{activeItem ? activeItem.icon : null}</div>
                  <div className="break-words text-2xl font-black text-gray-900 sm:text-3xl">{title}</div>
                </div>
                {subtitle ? <div className="text-gray-500 font-medium mt-2">{subtitle}</div> : null}
              </div>
            </div>
          </div>

          <div className="mt-4 lg:hidden">
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2 px-1">
                {nav.map((item) =>
                  item.href === "/" || item.href === "/login" || item.href === "/agency/register" ? (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        activeHref === item.href ? "bg-blue-600 text-white" : "border border-white/80 bg-white/90 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        activeHref === item.href ? "bg-blue-600 text-white" : "border border-white/80 bg-white/90 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
