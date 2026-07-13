"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripOffer, TripRequest, getStoredToken } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type BudgetStatus = "within_ideal" | "within_maximum" | "above_ideal" | "above_maximum";

function computeBudgetStatus(
  t: (key: string, vars?: Record<string, string | number>) => string,
  req: TripRequest | undefined,
  offer: TripOffer
): { key: BudgetStatus; label: string; className: string } {
  const ideal = req?.ideal_budget ?? 0;
  const max = typeof req?.max_budget === "number" ? req.max_budget : null;
  const price = offer.total_price;
  if (price <= ideal) return { key: "within_ideal", label: t("custom_trip_budget_status_within_ideal"), className: "bg-green-50 text-green-700 border-green-100" };
  if (max !== null && price <= max) return { key: "within_maximum", label: t("custom_trip_budget_status_within_max"), className: "bg-blue-50 text-blue-700 border-blue-100" };
  if (max !== null && price > max) return { key: "above_maximum", label: t("custom_trip_budget_status_above_max"), className: "bg-red-50 text-red-700 border-red-100" };
  return { key: "above_ideal", label: t("custom_trip_budget_status_above_ideal"), className: "bg-orange-50 text-orange-800 border-orange-100" };
}

export default function DashboardOffersPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const searchParams = useSearchParams();
  const requestFilterRaw = searchParams?.get("request");
  const requestFilter = requestFilterRaw ? Number(requestFilterRaw) : null;

  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<TripOffer[]>([]);
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setOffers([]);
        setRequests([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [reqs, myOffers] = await Promise.all([api.tripMarketplace.listMyRequests(), api.tripMarketplace.listMyOffers()]);
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

  const requestById = useMemo(() => {
    const map = new Map<number, TripRequest>();
    for (const r of requests) map.set(r.id, r);
    return map;
  }, [requests]);

  const filteredOffers = useMemo(() => {
    const base = requestFilter ? offers.filter((o) => o.trip_request_id === requestFilter) : offers;
    return base.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [offers, requestFilter]);

  return (
    <DashboardShell title={t("dash_offers")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filteredOffers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🎁</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_offers")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("common_coming_soon")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_nav_overview")}</th>
                  <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("custom_trip_ideal_budget")}</th>
                  <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("dash_offers")}</th>
                  <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("custom_trip_offer_expiration")}</th>
                  <th className="px-8 py-5" />
                </tr>
              </thead>
              <tbody>
                {filteredOffers.map((offer) => {
                  const req = requestById.get(offer.trip_request_id);
                  const status = computeBudgetStatus(t, req, offer);
                  return (
                    <tr key={offer.id} className="border-t border-gray-100">
                      <td className="px-8 py-6">
                        <div className="font-black text-gray-900">#{offer.agency_id}</div>
                        <div className="mt-1 text-xs font-bold text-gray-500">{req?.destination || "-"}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-gray-900">
                          {req ? `${req.ideal_budget} ${req.budget_currency}` : "-"}
                        </div>
                        {typeof req?.max_budget === "number" ? (
                          <div className="mt-1 text-xs font-bold text-gray-500">
                            {t("custom_trip_max_budget")}: {req.max_budget} {req.budget_currency}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-gray-900">
                          {offer.total_price} {offer.currency}
                        </div>
                        <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-gray-600">{new Date(offer.expires_at).toLocaleString()}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                          <Link
                            href={`/dashboard/offers/${offer.id}`}
                            prefetch={false}
                            className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-5 py-3 transition"
                          >
                            {t("common_view")}
                          </Link>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await api.tripMarketplace.acceptOffer(offer.id);
                                setMessage({ type: "success", text: t("custom_trip_success_accepted") });
                                setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: "accepted" } : o)));
                              } catch {
                                setMessage({ type: "error", text: t("custom_trip_error_accept") });
                              }
                            }}
                            disabled={offer.status !== "submitted"}
                            className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 font-black transition ${
                              offer.status !== "submitted"
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                            }`}
                          >
                            {t("custom_trip_accept_offer")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {message ? (
          <div className={`px-8 py-5 text-sm font-black ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
