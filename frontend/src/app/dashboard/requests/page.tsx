"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripOffer, TripRequest, getStoredToken } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function hoursRemaining(expiresAt: string) {
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, end - now);
  return Math.ceil(diffMs / (1000 * 60 * 60));
}

export default function DashboardRequestsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [offers, setOffers] = useState<TripOffer[]>([]);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setRequests([]);
        setOffers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [reqs, myOffers] = await Promise.all([
          api.tripMarketplace.listMyRequests(),
          api.tripMarketplace.listMyOffers().catch(() => []),
        ]);
        setRequests(reqs);
        setOffers(myOffers);
      } catch {
        setRequests([]);
        setOffers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const offersByRequest = useMemo(() => {
    const map = new Map<number, number>();
    for (const offer of offers) {
      map.set(offer.trip_request_id, (map.get(offer.trip_request_id) || 0) + 1);
    }
    return map;
  }, [offers]);

  return (
    <DashboardShell title={t("dash_requests")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-6xl">📝</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_requests")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("common_coming_soon")}</div>
            <div className="mt-8 flex justify-center">
              <Link
                href="/request-custom-offers"
                prefetch={false}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black px-7 py-3 rounded-2xl transition shadow-lg shadow-blue-200"
              >
                {t("home_custom_trip_cta")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((req) => {
              const offersCount = offersByRequest.get(req.id) || 0;
              const hours = hoursRemaining(req.expires_at);
              return (
                <div key={req.id} className="rounded-3xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                  <div className="p-7 sm:p-8 flex flex-col gap-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-blue-600">
                          {req.request_code}
                        </div>
                        <div className="mt-2 text-2xl font-black text-gray-900">{req.destination}</div>
                        <div className="mt-2 text-sm font-bold text-gray-500">
                          {req.start_date && req.end_date ? (
                            <span>
                              {req.start_date} → {req.end_date}
                            </span>
                          ) : (
                            <span>{t("custom_trip_flexible_dates")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                          {t("custom_trip_ideal_budget")}: {req.ideal_budget} {req.budget_currency}
                        </span>
                        {typeof req.max_budget === "number" ? (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                            {t("custom_trip_max_budget")}: {req.max_budget} {req.budget_currency}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label={t("custom_trip_adults")} value={req.adults} />
                      <Stat label={t("custom_trip_children")} value={req.children} />
                      <Stat label={t("dash_offers")} value={offersCount} />
                      <Stat label={t("discover_hub_expiring_in")} value={`${hours}h`} />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">
                        {req.status}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          href={`/dashboard/offers?request=${req.id}`}
                          prefetch={false}
                          className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 transition"
                        >
                          {t("dash_offers")}
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(t("common_cancel"))) return;
                            try {
                              const updated = await api.tripMarketplace.cancelRequest(req.id);
                              setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                            } catch {
                              alert(t("common_try_again"));
                            }
                          }}
                          className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 transition"
                        >
                          {t("common_cancel")}
                        </button>
                      </div>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{label}</div>
      <div className="mt-2 text-xl font-black text-gray-900">{value}</div>
    </div>
  );
}

