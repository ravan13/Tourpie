"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { broadcastLogout, clearSessionToken, getStoredToken, markSessionExpired } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import DashboardShell from "@/components/DashboardShell";
import { userNav } from "@/lib/dashboardNav";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const { user, authReady } = useCurrentUser();

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!authReady) return;
    if (!user) {
      return;
    }
    if (!user.is_verified) {
      router.push("/login");
      return;
    }
    if (!user.onboarding_completed) {
      router.replace("/login");
      return;
    }
  }, [authReady, router, user]);

  useEffect(() => {
    if (!authReady || user) return;
    const token = getStoredToken();
    if (!token) return;
    void (async () => {
      markSessionExpired("auth");
      broadcastLogout("auth");
      await clearSessionToken();
      router.replace("/login?reason=session_expired");
    })();
  }, [authReady, router, user]);

  if (!authReady) {
    return (
      <div className="tp-page-shell">
        <div className="relative z-[1] mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-gray-500 font-medium animate-pulse">{t("common_loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="tp-page-shell">
        <div className="relative z-[1] mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-gray-900 font-bold text-xl mb-3">{t("auth_error")}</p>
        <p className="text-gray-500 font-medium mb-8">{t("session_expired_message")}</p>
        <Link
          href="/login"
          className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-transparent bg-[linear-gradient(135deg,_rgba(2,42,107,0.98),_rgba(12,60,125,0.94)_55%,_rgba(255,106,26,0.94))] px-8 text-sm font-black tracking-[-0.01em] text-white shadow-[0_20px_48px_rgba(2,42,107,0.22)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(2,42,107,0.28)]"
        >
          {t("auth_login")}
        </Link>
        </div>
      </div>
    );
  }

  const isAgency = user.role === "agency";
  const isAdmin = user.role === "admin";

  return (
    <DashboardShell
      title={t("dashboard_title")}
      subtitle={t("dashboard_welcome", { name: user.full_name || user.email })}
      nav={nav}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/dashboard/explore"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader>
              <div className="text-3xl">🧭</div>
              <CardTitle className="mt-1 text-lg">{t("dashboard_browse_title")}</CardTitle>
              <CardDescription>{t("dashboard_browse_subtitle")}</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link
          href="/dashboard/bookings"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader>
              <div className="text-3xl">📦</div>
              <CardTitle className="mt-1 text-lg">{t("dashboard_bookings_title")}</CardTitle>
              <CardDescription>{t("dashboard_bookings_subtitle")}</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {isAdmin ? (
          <Link
            href="/admin"
            prefetch={false}
            className="block"
          >
            <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
              <CardHeader>
                <div className="text-3xl">🛡️</div>
                <CardTitle className="mt-1 text-lg">{t("admin_nav_overview")}</CardTitle>
                <CardDescription>{t("admin_login_subtitle")}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : isAgency ? (
          <Link
            href="/agency"
            prefetch={false}
            className="block"
          >
            <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
              <CardHeader>
                <div className="text-3xl">🏢</div>
                <CardTitle className="mt-1 text-lg">{t("agency_nav_overview")}</CardTitle>
                <CardDescription>{t("dashboard_admin_subtitle")}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <Card className="h-full">
            <CardHeader>
              <div className="text-3xl">✨</div>
              <CardTitle className="mt-1 text-lg">{t("dashboard_profile_title")}</CardTitle>
              <CardDescription>{t("dashboard_profile_subtitle")}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
