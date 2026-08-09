"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripRequest, getStoredToken } from "@/lib/api";
import { agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function hoursRemaining(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
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
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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

  const flash = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2200);
  };

  const handleDecline = async (req: TripRequest) => {
    const ok = confirm(t("custom_trip_decline_confirm"));
    if (!ok) return;
    setBusyId(req.id);
    try {
      await api.tripMarketplace.agencyDeclineRequest(req.id);
      setItems((prev) => prev.filter((r) => r.id !== req.id));
      flash("ok", t("common_rejected"));
    } catch {
      flash("err", t("common_try_again"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell title={t("agency_nav_incoming_requests")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      {toast ? (
        <div className={`mb-4 rounded-2xl px-5 py-3 text-sm font-black ${toast.type === "ok" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
          {toast.text}
        </div>
      ) : null}

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">📨</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("agency_nav_incoming_requests")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("common_empty")}</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((req) => {
              const remaining = hoursRemaining(req.expires_at);
              return (
                <div key={req.id} className="p-6 md:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-xs font-black uppercase tracking-widest text-blue-600">{req.request_code}</div>
                        {req.travel_style ? (
                          <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700 uppercase tracking-wider">
                            {req.travel_style}
                          </span>
                        ) : null}
                        {req.visa_required ? (
                          <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700 uppercase tracking-wider">
                            🛂 VISA
                          </span>
                        ) : null}
                        {typeof remaining === "number" ? (
                          <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-800 uppercase tracking-wider">
                            {t("discover_hub_expiring_in")}: {remaining}h
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 text-2xl font-black text-gray-900 break-words">
                        {req.destination}
                        {req.country ? ` · ${req.country}` : ""}
                        {req.city ? `, ${req.city}` : ""}
                      </div>

                      <div className="mt-2 text-sm font-bold text-gray-500 flex flex-wrap gap-2">
                        <span>
                          {req.start_date && req.end_date ? `${req.start_date} → ${req.end_date}` : t("custom_trip_flexible_dates")}
                        </span>
                        {typeof req.duration === "number" ? (
                          <span className="text-gray-400">· {req.duration} {t("custom_trip_nights")}</span>
                        ) : null}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                          👤 {t("custom_trip_adults")}: {req.adults ?? 0}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                          👶 {t("custom_trip_children")}: {req.children ?? 0}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                          💰 {req.ideal_budget ?? req.budget ?? "-"} {req.budget_currency ?? req.currency ?? ""}
                        </span>
                        {typeof req.max_budget === "number" ? (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                            Max: {req.max_budget} {req.budget_currency ?? req.currency ?? ""}
                          </span>
                        ) : null}
                        {req.hotel_stars ? (
                          <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">
                            {"★".repeat(Math.max(0, Math.min(5, req.hotel_stars)))}
                          </span>
                        ) : null}
                        {req.transportation ? (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                            ✈️ {req.transportation}
                          </span>
                        ) : null}
                        {req.meal_preference ? (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                            🍽️ {req.meal_preference}
                          </span>
                        ) : null}
                      </div>

                      {req.special_requirements ? (
                        <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-100 px-5 py-3 text-sm font-bold text-gray-700 whitespace-pre-wrap line-clamp-3">
                          📝 {req.special_requirements}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-3 w-full lg:w-[220px] shrink-0">
                      <Link
                        href={`/agency/incoming-requests/${req.id}`}
                        prefetch={false}
                        className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 transition min-h-[48px]"
                      >
                        {t("common_view")}
                      </Link>
                      <Link
                        href={`/agency/incoming-requests/${req.id}/create-offer`}
                        prefetch={false}
                        className="inline-flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 transition shadow-lg shadow-blue-200 min-h-[48px]"
                      >
                        {t("custom_trip_create_offer")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDecline(req)}
                        disabled={busyId === req.id}
                        className={`inline-flex items-center justify-center rounded-2xl font-black px-6 py-3 transition min-h-[48px] ${
                          busyId === req.id
                            ? "bg-gray-100 text-gray-400 cursor-wait"
                            : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-900"
                        }`}
                      >
                        {busyId === req.id ? t("common_please_wait") : t("common_reject")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
