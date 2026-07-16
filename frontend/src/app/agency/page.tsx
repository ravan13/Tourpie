"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, getStoredTokenPayload } from "@/lib/api";
import { agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function AgencyOverviewPage() {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total_packages: number; active_bookings: number; total_revenue: number } | null>(
    null
  );
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    void (async () => {
      const payload = getStoredTokenPayload();
      const agencyIdRaw = payload?.agency_id;
      const agencyIdCandidate = typeof agencyIdRaw === "number" ? agencyIdRaw : Number(agencyIdRaw);
      const agencyId = Number.isFinite(agencyIdCandidate) && agencyIdCandidate > 0 ? agencyIdCandidate : null;
      if (!agencyId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [s, pending] = await Promise.all([
          api.agencies.getStats(agencyId),
          api.bookings.getForAgency(agencyId, "pending"),
        ]);
        setStats(s);
        setPendingCount(pending.length);
      } catch {
        setStats(null);
        setPendingCount(0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell title={t("agency_nav_overview")} subtitle={t("agency_overview_subtitle")} nav={nav}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_total_packages")}</div>
            <CardTitle className="mt-1 text-4xl">{loading ? "…" : stats?.total_packages ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_active_bookings")}</div>
            <CardTitle className="mt-1 text-4xl">{loading ? "…" : stats?.active_bookings ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_total_revenue")}</div>
            <CardTitle className="mt-1 text-4xl text-blue-600">{loading ? "…" : formatMoney(Number(stats?.total_revenue ?? 0))}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/agency/bookings"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t("agency_nav_bookings")}</CardTitle>
                <CardDescription className="mt-2">
                  {pendingCount > 0 ? `${pendingCount} ${t("common_pending")}` : t("admin_booking_none")}
                </CardDescription>
              </div>
              <div className="text-3xl">📥</div>
            </CardHeader>
          </Card>
        </Link>

        <Link
          href="/agency/packages"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t("agency_nav_packages")}</CardTitle>
                <CardDescription className="mt-2">{t("admin_create_package")}</CardDescription>
              </div>
              <div className="text-3xl">🧳</div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/agency/calendar"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t("agency_nav_calendar")}</CardTitle>
                <CardDescription className="mt-2">{t("agency_overview_calendar_hint")}</CardDescription>
              </div>
              <div className="text-3xl">📅</div>
            </CardHeader>
          </Card>
        </Link>
        <Link
          href="/agency/analytics"
          prefetch={false}
          className="block"
        >
          <Card className="h-full hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t("agency_nav_analytics")}</CardTitle>
                <CardDescription className="mt-2">{t("agency_overview_analytics_hint")}</CardDescription>
              </div>
              <div className="text-3xl">📈</div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </DashboardShell>
  );
}
