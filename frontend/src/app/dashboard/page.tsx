"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { broadcastLogout, clearSessionToken, getStoredToken, markSessionExpired } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import DashboardShell from "@/components/DashboardShell";
import { userNav } from "@/lib/dashboardNav";
import { useCurrentUser } from "@/hooks/useCurrentUser";

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
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 font-medium animate-pulse">{t("common_loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-900 font-bold text-xl mb-3">{t("auth_error")}</p>
        <p className="text-gray-500 font-medium mb-8">{t("session_expired_message")}</p>
        <Link href="/login" className="inline-flex bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-2xl">
          {t("auth_login")}
        </Link>
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
          className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-4">🧭</div>
          <div className="text-lg font-black text-gray-900 mb-1">{t("dashboard_browse_title")}</div>
          <div className="text-gray-500 font-medium">{t("dashboard_browse_subtitle")}</div>
        </Link>

        <Link
          href="/dashboard/bookings"
          prefetch={false}
          className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-4">📦</div>
          <div className="text-lg font-black text-gray-900 mb-1">{t("dashboard_bookings_title")}</div>
          <div className="text-gray-500 font-medium">{t("dashboard_bookings_subtitle")}</div>
        </Link>

        {isAdmin ? (
          <Link
            href="/admin"
            prefetch={false}
            className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-4">🛡️</div>
            <div className="text-lg font-black text-gray-900 mb-1">{t("admin_nav_overview")}</div>
            <div className="text-gray-500 font-medium">{t("admin_login_subtitle")}</div>
          </Link>
        ) : isAgency ? (
          <Link
            href="/agency"
            prefetch={false}
            className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-4">🏢</div>
            <div className="text-lg font-black text-gray-900 mb-1">{t("agency_nav_overview")}</div>
            <div className="text-gray-500 font-medium">{t("dashboard_admin_subtitle")}</div>
          </Link>
        ) : (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
            <div className="text-3xl mb-4">✨</div>
            <div className="text-lg font-black text-gray-900 mb-1">{t("dashboard_profile_title")}</div>
            <div className="text-gray-500 font-medium">{t("dashboard_profile_subtitle")}</div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
