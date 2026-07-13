"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripRequest, getStoredToken } from "@/lib/api";
import { agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function hoursRemaining(expiresAt: string) {
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, end - now);
  return Math.ceil(diffMs / (1000 * 60 * 60));
}

export default function AgencyIncomingRequestsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TripRequest[]>([]);

  useEffect(() => {
    void (async () => {
      if (!getStoredToken()) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await api.tripMarketplace.agencyListIncoming();
        setItems(rows);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell title={t("agency_nav_incoming_requests")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">📨</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("agency_nav_incoming_requests")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("common_coming_soon")}</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((req) => (
              <div key={req.id} className="p-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-blue-600">{req.request_code}</div>
                    <div className="mt-2 text-2xl font-black text-gray-900">{req.destination}</div>
                    <div className="mt-2 text-sm font-bold text-gray-500">
                      {req.start_date && req.end_date ? `${req.start_date} → ${req.end_date}` : t("custom_trip_flexible_dates")}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                        {t("custom_trip_adults")}: {req.adults}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                        {t("custom_trip_children")}: {req.children}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                        {t("custom_trip_ideal_budget")}: {req.ideal_budget} {req.budget_currency}
                      </span>
                      {typeof req.max_budget === "number" ? (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                          {t("custom_trip_max_budget")}: {req.max_budget} {req.budget_currency}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-black text-amber-800">
                        {t("discover_hub_expiring_in")}: {hoursRemaining(req.expires_at)}h
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[220px]">
                    <Link
                      href={`/agency/incoming-requests/${req.id}`}
                      prefetch={false}
                      className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 transition"
                    >
                      {t("common_view")}
                    </Link>
                    <Link
                      href={`/agency/incoming-requests/${req.id}/create-offer`}
                      prefetch={false}
                      className="inline-flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 transition shadow-lg shadow-blue-200"
                    >
                      {t("custom_trip_create_offer")}
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = confirm(t("custom_trip_decline_confirm"));
                        if (!ok) return;
                        try {
                          await api.tripMarketplace.agencyDeclineRequest(req.id);
                          setItems((prev) => prev.filter((r) => r.id !== req.id));
                        } catch {
                          alert(t("common_try_again"));
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 transition"
                    >
                      {t("common_reject")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

