"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, getStoredTokenPayload } from "@/lib/api";
import { agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_total_packages")}</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{loading ? "…" : stats?.total_packages ?? 0}</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_active_bookings")}</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{loading ? "…" : stats?.active_bookings ?? 0}</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_total_revenue")}</div>
          <div className="mt-3 text-4xl font-black text-blue-600">
            {loading ? "…" : formatMoney(Number(stats?.total_revenue ?? 0))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/agency/bookings"
          prefetch={false}
          className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-black text-gray-900">{t("agency_nav_bookings")}</div>
              <div className="mt-2 text-gray-500 font-medium">
                {pendingCount > 0 ? `${pendingCount} ${t("common_pending")}` : t("admin_booking_none")}
              </div>
            </div>
            <div className="text-3xl">📥</div>
          </div>
        </Link>

        <Link
          href="/agency/packages"
          prefetch={false}
          className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-black text-gray-900">{t("agency_nav_packages")}</div>
              <div className="mt-2 text-gray-500 font-medium">{t("admin_create_package")}</div>
            </div>
            <div className="text-3xl">🧳</div>
          </div>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/agency/calendar"
          prefetch={false}
          className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-black text-gray-900">{t("agency_nav_calendar")}</div>
              <div className="mt-2 text-gray-500 font-medium">{t("agency_overview_calendar_hint")}</div>
            </div>
            <div className="text-3xl">📅</div>
          </div>
        </Link>
        <Link
          href="/agency/analytics"
          prefetch={false}
          className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-black text-gray-900">{t("agency_nav_analytics")}</div>
              <div className="mt-2 text-gray-500 font-medium">{t("agency_overview_analytics_hint")}</div>
            </div>
            <div className="text-3xl">📈</div>
          </div>
        </Link>
      </div>
    </DashboardShell>
  );
}
