"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripOffer, TripRequest, getStoredToken, TripOfferStatus } from "@/lib/api";
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
  const ideal = req?.ideal_budget ?? req?.budget ?? 0;
  const max = typeof req?.max_budget === "number" ? req.max_budget : null;
  const price = offer.total_price ?? offer.price ?? 0;
  if (price <= ideal) return { key: "within_ideal", label: t("custom_trip_budget_status_within_ideal"), className: "bg-green-50 text-green-700 border-green-100" };
  if (max !== null && price <= max) return { key: "within_maximum", label: t("custom_trip_budget_status_within_max"), className: "bg-blue-50 text-blue-700 border-blue-100" };
  if (max !== null && price > max) return { key: "above_maximum", label: t("custom_trip_budget_status_above_max"), className: "bg-red-50 text-red-700 border-red-100" };
  return { key: "above_ideal", label: t("custom_trip_budget_status_above_ideal"), className: "bg-orange-50 text-orange-800 border-orange-100" };
}

function OfferStatusBadge({ status, t }: { status: TripOfferStatus; t: (k: string) => string }) {
  const map: Record<TripOfferStatus, { label: string; cls: string }> = {
    draft: { label: t("custom_trip_offer_status_draft"), cls: "bg-gray-100 text-gray-700 border-gray-200" },
    submitted: { label: t("custom_trip_offer_status_submitted"), cls: "bg-blue-50 text-blue-700 border-blue-100" },
    accepted: { label: t("custom_trip_offer_status_accepted"), cls: "bg-green-50 text-green-700 border-green-100" },
    declined: { label: t("custom_trip_offer_status_declined"), cls: "bg-gray-100 text-gray-600 border-gray-200" },
    rejected: { label: t("custom_trip_offer_status_rejected"), cls: "bg-red-50 text-red-700 border-red-100" },
    expired: { label: t("custom_trip_offer_status_expired"), cls: "bg-amber-50 text-amber-800 border-amber-100" },
    cancelled: { label: t("custom_trip_offer_status_cancelled"), cls: "bg-red-50 text-red-700 border-red-100" },
  };
  const cfg = map[status] || { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
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
  const [revisionOfferId, setRevisionOfferId] = useState<number | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
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

  const mutateOffer = (row: TripOffer) => {
    setOffers((prev) => prev.map((o) => (o.id === row.id ? row : o)));
  };

  const allForSameRequest = useMemo(() => {
    if (!requestFilter) return false;
    const ids = Array.from(new Set(filteredOffers.map((o) => o.trip_request_id)));
    return ids.length === 1 && filteredOffers.length >= 2;
  }, [filteredOffers, requestFilter]);

  const comparisonFields: Array<{ key: string; label: string; get: (o: TripOffer) => string | number | boolean | undefined | null }> = [
    { key: "agency", label: t("dash_agency") || "Agency", get: (o) => o.agency?.name || `#${o.agency_id}` },
    { key: "price", label: t("custom_trip_total_price") || "Price", get: (o) => `${o.total_price ?? o.price ?? 0} ${o.currency}` },
    { key: "hotel", label: t("custom_trip_hotel") || "Hotel", get: (o) => `${o.hotel || "-"}${o.hotel_stars ? ` ${o.hotel_stars}★` : ""}` },
    { key: "flight", label: t("custom_trip_flight_included") || "Flight", get: (o) => (o.flight_included || o.flight ? t("common_yes") : t("common_no")) },
    { key: "breakfast", label: t("custom_trip_breakfast") || "Breakfast", get: (o) => (o.breakfast_included ? t("common_yes") : t("common_no")) },
    { key: "lunch", label: t("custom_trip_lunch") || "Lunch", get: (o) => (o.lunch_included ? t("common_yes") : t("common_no")) },
    { key: "dinner", label: t("custom_trip_dinner") || "Dinner", get: (o) => (o.dinner_included ? t("common_yes") : t("common_no")) },
    { key: "activities", label: t("custom_trip_activities_interests") || "Activities", get: (o) => (o.activities ? t("common_yes") : t("common_no")) },
    { key: "insurance", label: t("custom_trip_travel_insurance") || "Insurance", get: (o) => (o.insurance_included || o.insurance ? t("common_yes") : t("common_no")) },
    { key: "transfer", label: t("custom_trip_transfer_included") || "Transfer", get: (o) => (o.airport_transfer || o.transfer ? t("common_yes") : t("common_no")) },
    { key: "rating", label: t("dash_rating") || "Rating", get: (o) => (o.rating ? `${o.rating.toFixed(1)}${o.reviews_count ? ` (${o.reviews_count})` : ""}` : "-") },
    { key: "response", label: t("custom_trip_response_time") || "Response", get: (o) => (typeof o.response_time_minutes === "number" ? `${o.response_time_minutes}m` : "-") },
    { key: "valid", label: t("custom_trip_valid_until") || "Valid until", get: (o) => (o.expiration_date || o.expires_at ? new Date(o.expiration_date || o.expires_at).toLocaleDateString() : "-") },
  ];

  return (
    <DashboardShell title={t("dash_offers")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filteredOffers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🎁</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_offers")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("common_empty")}</div>
          </div>
        ) : (
          <>
            {allForSameRequest && (
              <div className="border-b border-gray-100 p-6 sm:p-8 bg-gradient-to-r from-blue-50/60 to-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">{t("custom_trip_comparison") || "Comparison"}</div>
                  <div className="text-sm font-bold text-gray-500">{requestById.get(filteredOffers[0].trip_request_id)?.destination || ""}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-white/80 border-b border-gray-100">
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.28em] text-gray-400 w-48">{t("custom_trip_feature") || "Feature"}</th>
                        {filteredOffers.map((o) => (
                          <th key={o.id} className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.28em] text-gray-400 min-w-[200px]">
                            {o.agency?.name || `#${o.agency_id}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFields.map((f, idx) => (
                        <tr key={f.key} className={idx % 2 ? "bg-gray-50/40" : "bg-white"}>
                          <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">{f.label}</th>
                          {filteredOffers.map((o) => {
                            const val = f.get(o);
                            const isBool = typeof val === "boolean";
                            const display = isBool ? (val ? t("common_yes") : t("common_no")) : (val === null || val === undefined ? "-" : String(val));
                            return (
                              <td key={o.id} className="px-4 py-3 text-sm font-bold text-gray-900">
                                {display}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="bg-white border-t border-gray-100">
                        <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">{t("common_actions")}</th>
                        {filteredOffers.map((o) => (
                          <td key={o.id} className="px-4 py-4">
                            <ActionRow offer={o} t={t} mutateOffer={mutateOffer} setMessage={setMessage} setRevisionOfferId={setRevisionOfferId} />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {filteredOffers.map((offer) => {
                const req = requestById.get(offer.trip_request_id);
                const status = computeBudgetStatus(t, req, offer);
                return (
                  <div key={offer.id} className="p-6 sm:p-8">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <OfferStatusBadge status={offer.status} t={t} />
                          {offer.is_bookmarked ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                              ★ {t("custom_trip_bookmarked") || "Bookmarked"}
                            </span>
                          ) : null}
                          {offer.revision_requested_at ? (
                            <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                              {t("custom_trip_revision_requested") || "Revision requested"}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs font-black uppercase tracking-widest text-blue-600">{req?.request_code || `R#${offer.trip_request_id}`}</div>
                        <div className="mt-1 text-2xl font-black text-gray-900">{req?.destination || "-"}</div>
                        <div className="mt-1 text-sm font-bold text-gray-500">{offer.agency?.name || `Agency #${offer.agency_id}`}</div>
                        {offer.rating ? (
                          <div className="mt-2 text-xs font-bold text-gray-500">
                            ⭐ {offer.rating.toFixed(1)}{offer.reviews_count ? ` · ${offer.reviews_count} ${t("dash_reviews") || "reviews"}` : ""}
                          </div>
                        ) : null}
                      </div>

                      <div className="w-full lg:w-auto flex lg:flex-col gap-3">
                        <div className="rounded-2xl bg-blue-600 text-white px-5 py-4 shadow-lg shadow-blue-200 flex-1 lg:min-w-[220px]">
                          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">{t("dash_offers")}</div>
                          <div className="mt-1 text-2xl font-black">
                            {offer.total_price ?? offer.price ?? 0} {offer.currency}
                          </div>
                          <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black bg-white/10 border-white/20 text-white`}>
                            {status.label}
                          </span>
                        </div>
                        {!allForSameRequest && (
                          <ActionRow offer={offer} t={t} mutateOffer={mutateOffer} setMessage={setMessage} setRevisionOfferId={setRevisionOfferId} stacked />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {revisionOfferId !== null ? (
          <div className="border-t border-gray-100 p-6 sm:p-8 bg-purple-50/40">
            <div className="text-sm font-black text-gray-900 mb-3">{t("custom_trip_request_revision") || "Request revision"}</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                className="flex-1 bg-white border border-gray-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                placeholder={t("custom_trip_revision_notes") || "Notes (optional)"}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const updated = await api.tripMarketplace.requestRevision(revisionOfferId, revisionNotes.trim() || null);
                      mutateOffer(updated);
                      setMessage({ type: "success", text: t("common_saved") });
                      setRevisionOfferId(null);
                      setRevisionNotes("");
                    } catch (e) {
                      setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black px-6 py-3 transition shadow-lg shadow-purple-200"
                >
                  {t("custom_trip_submit")}
                </button>
                <button
                  type="button"
                  onClick={() => { setRevisionOfferId(null); setRevisionNotes(""); }}
                  className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 transition"
                >
                  {t("common_cancel")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {message ? (
          <div className={`px-8 py-5 text-sm font-black ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function ActionRow({
  offer,
  t,
  mutateOffer,
  setMessage,
  setRevisionOfferId,
  stacked = false,
}: {
  offer: TripOffer;
  t: (k: string) => string;
  mutateOffer: (o: TripOffer) => void;
  setMessage: (m: { type: "success" | "error"; text: string }) => void;
  setRevisionOfferId: (id: number | null) => void;
  stacked?: boolean;
}) {
  const containerCls = stacked ? "flex flex-col sm:flex-row" : "flex flex-wrap";
  return (
    <div className={`${containerCls} gap-3 lg:justify-end`}>
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
            const updated = await api.tripMarketplace.bookmarkOffer(offer.id);
            mutateOffer(updated);
          } catch (e) {
            setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
          }
        }}
        className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 font-black transition border ${
          offer.is_bookmarked
            ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
            : "bg-white border-gray-200 hover:bg-gray-50 text-gray-900"
        }`}
      >
        ★ {t("custom_trip_bookmark") || "Bookmark"}
      </button>
      <button
        type="button"
        disabled={offer.status !== "submitted"}
        onClick={() => setRevisionOfferId(offer.id)}
        className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 font-black transition border ${
          offer.status !== "submitted"
            ? "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-800"
        }`}
      >
        {t("custom_trip_revision") || "Revision"}
      </button>
      <button
        type="button"
        disabled={offer.status !== "submitted"}
        onClick={async () => {
          if (!confirm(t("custom_trip_reject_confirm") || t("common_cancel"))) return;
          try {
            const updated = await api.tripMarketplace.rejectOffer(offer.id);
            mutateOffer(updated);
          } catch (e) {
            setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
          }
        }}
        className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 font-black transition border ${
          offer.status !== "submitted"
            ? "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-white border-red-200 hover:bg-red-50 text-red-700"
        }`}
      >
        {t("common_reject")}
      </button>
      <button
        type="button"
        disabled={offer.status !== "submitted"}
        onClick={async () => {
          try {
            await api.tripMarketplace.acceptOffer(offer.id);
            setMessage({ type: "success", text: t("custom_trip_success_accepted") });
            mutateOffer({ ...offer, status: "accepted" });
          } catch (e) {
            setMessage({ type: "error", text: e instanceof Error ? e.message : t("custom_trip_error_accept") });
          }
        }}
        className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 font-black transition ${
          offer.status !== "submitted"
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
        }`}
      >
        {t("custom_trip_accept_offer")}
      </button>
    </div>
  );
}
