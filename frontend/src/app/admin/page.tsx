"use client";

import DashboardShell from "@/components/DashboardShell";
import { adminNav } from "@/lib/dashboardNav";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function AdminDashboard() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    users: 0,
    verified_users: 0,
    new_registrations: 0,
    agencies: 0,
    packages: 0,
    bookings: 0,
    pending_apps: 0,
    pending_moderation: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<{
    recentUsers: import("@/lib/api").User[];
    recentLogs: import("@/lib/api").ModerationLog[];
  }>({ recentUsers: [], recentLogs: [] });

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const [userStatsRes, pkgsCountRes, agsCountRes, bookingsCountRes, appsRes, pendingPostsRes, logsRes] = await Promise.allSettled([
          api.users.adminOverview(),
          api.packages.count(),
          api.agencies.count(),
          api.bookings.count(),
          api.agencies.listApplications("pending_verification"),
          api.moderation.listCommunityPosts({ skip: 0, limit: 200, status: "pending_review" }),
          api.moderation.listLogs(0, 20),
        ]);

        const userStats = userStatsRes.status === "fulfilled" ? userStatsRes.value : null;
        const pkgsTotal = pkgsCountRes.status === "fulfilled" ? pkgsCountRes.value.total : 0;
        const agsTotal = agsCountRes.status === "fulfilled" ? agsCountRes.value.total : 0;
        const bookingsTotal = bookingsCountRes.status === "fulfilled" ? bookingsCountRes.value.total : 0;
        const apps = appsRes.status === "fulfilled" ? appsRes.value : [];
        const pendingPosts = pendingPostsRes.status === "fulfilled" ? pendingPostsRes.value : [];
        const logs = logsRes.status === "fulfilled" ? logsRes.value : [];

        const rejected = [userStatsRes, pkgsCountRes, agsCountRes, bookingsCountRes, appsRes, pendingPostsRes, logsRes].filter((r) => r.status === "rejected");
        if (rejected.length > 0) {
          const firstError = rejected[0].status === "rejected" ? rejected[0].reason : null;
          const text = firstError instanceof Error ? firstError.message : "";
          setError(text || "Some dashboard data could not be loaded.");
        }

        setCounts({
          users: userStats?.total_users ?? 0,
          verified_users: userStats?.verified_users ?? 0,
          new_registrations: userStats?.new_registrations_7d ?? 0,
          packages: pkgsTotal,
          agencies: agsTotal,
          bookings: bookingsTotal,
          pending_apps: apps.length,
          pending_moderation: pendingPosts.length,
        });

        setActivity({ recentUsers: userStats?.recent_users ?? [], recentLogs: logs.slice(0, 8) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell title={t("admin_nav_overview")} subtitle={t("admin_subtitle")} nav={nav}>
      {error ? (
        <div className="mb-6 rounded-[1.5rem] border border-amber-200 bg-amber-50/95 px-5 py-4 text-sm font-bold text-amber-800 shadow-[0_16px_36px_rgba(245,158,11,0.10)]">
          {error}
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_nav_users")}</div>
            <CardTitle className="mt-1 text-4xl">{loading ? "…" : counts.users}</CardTitle>
            <CardDescription className="text-xs">{loading ? "…" : `${counts.verified_users} verified`}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_total_packages")}</div>
            <CardTitle className="mt-1 text-4xl">{loading ? "…" : counts.packages}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_nav_agencies")}</div>
            <CardTitle className="mt-1 text-4xl">{loading ? "…" : counts.agencies}</CardTitle>
            <CardDescription className="text-xs">{loading ? "…" : `${counts.pending_apps} pending`}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_nav_bookings")}</div>
            <CardTitle className="mt-1 text-4xl">{loading ? "…" : counts.bookings}</CardTitle>
            <CardDescription className="text-xs">{loading ? "…" : `${counts.new_registrations} new (7d)`}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/agencies"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t("admin_nav_agencies")}</CardTitle>
                <CardDescription className="mt-2">{counts.pending_apps} pending applications</CardDescription>
              </div>
              <div className="text-3xl">✅</div>
            </CardHeader>
          </Card>
        </Link>

        <Link
          href="/admin/bookings"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t("admin_nav_bookings")}</CardTitle>
                <CardDescription className="mt-2">{t("admin_booking_requests")}</CardDescription>
              </div>
              <div className="text-3xl">🧾</div>
            </CardHeader>
          </Card>
        </Link>

        <Link
          href="/admin/moderation"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t("admin_nav_moderation_queue")}</CardTitle>
                <CardDescription className="mt-2">{t("admin_overview_pending_review", { count: counts.pending_moderation })}</CardDescription>
              </div>
              <div className="text-3xl">🛡️</div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-gray-100 bg-gray-50/55 px-10 py-8">
            <div className="text-lg font-black text-gray-900">{t("admin_overview_recent_registrations")}</div>
          </div>
          {loading ? (
            <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
          ) : activity.recentUsers.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-6xl">👤</div>
              <div className="mt-4 text-xl font-black text-gray-900">{t("admin_overview_no_recent_users")}</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activity.recentUsers.map((u) => (
                <div key={u.id} className="px-10 py-6 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-black text-gray-900">{u.full_name || "—"}</div>
                    <div className="text-xs text-gray-400 mt-1">{u.email}</div>
                  </div>
                  <div className="text-xs font-black text-gray-500">#{u.id}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-gray-100 bg-gray-50/55 px-10 py-8">
            <div className="text-lg font-black text-gray-900">{t("admin_overview_moderation_activity")}</div>
          </div>
          {loading ? (
            <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
          ) : activity.recentLogs.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-6xl">🛡️</div>
              <div className="mt-4 text-xl font-black text-gray-900">{t("admin_overview_no_recent_actions")}</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activity.recentLogs.map((l) => (
                <div key={l.id} className="px-10 py-6 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-black text-gray-900">{l.action}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {l.entity_type} • #{l.entity_id} • {l.reason}
                    </div>
                  </div>
                  <div className="text-xs font-black text-gray-500">{l.created_at ? new Date(l.created_at).toLocaleDateString() : ""}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
