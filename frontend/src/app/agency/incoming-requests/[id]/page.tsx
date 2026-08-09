"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, MatchAgencyStatus, TripOffer, TripRequest, TripRequestAgencyMatch, getStoredToken } from "@/lib/api";
import { agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function matchBadgeClass(s: MatchAgencyStatus | null): string {
  switch (s) {
    case "pending":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "viewed":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "interested":
      return "bg-green-50 text-green-700 border-green-100";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-100";
    case "offered":
      return "bg-indigo-50 text-indigo-700 border-indigo-100";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function offerStatusBadgeClass(s: string): string {
  switch (s) {
    case "draft":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "submitted":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "accepted":
      return "bg-green-50 text-green-700 border-green-100";
    case "declined":
    case "rejected":
      return "bg-red-50 text-red-700 border-red-100";
    case "expired":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export default function AgencyIncomingRequestDetailsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const params = useParams();
  const idRaw = params?.id;
  const requestId = typeof idRaw === "string" ? Number(idRaw) : Array.isArray(idRaw) ? Number(idRaw[0]) : NaN;

  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<TripRequest | null>(null);
  const [match, setMatch] = useState<TripRequestAgencyMatch | null>(null);
  const [myOffers, setMyOffers] = useState<TripOffer[]>([]);
  const [action, setAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2200);
  };

  const refreshAll = async () => {
    try {
      const m = await api.tripMarketplace.agencyGetMatch(requestId).catch(() => null);
      setMatch(m);
      const ofs = await api.tripMarketplace.agencyListOffers(requestId).catch(() => []);
      setMyOffers(ofs);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void (async () => {
      if (!getStoredToken() || !Number.isFinite(requestId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const row = await api.tripMarketplace.getRequest(requestId);
        setReq(row);
        const m = await api.tripMarketplace.agencyMarkViewed(requestId).catch(async () => {
          return api.tripMarketplace.agencyGetMatch(requestId).catch(() => null);
        });
        setMatch(m);
        const ofs = await api.tripMarketplace.agencyListOffers(requestId).catch(() => []);
        setMyOffers(ofs);
      } catch {
        setReq(null);
        setMatch(null);
        setMyOffers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const handleInterested = async () => {
    if (action || !Number.isFinite(requestId)) return;
    setAction("interested");
    try {
      const m = await api.tripMarketplace.agencyMarkInterested(requestId);
      setMatch(m);
      flash("ok", t("custom_trip_success_interested"));
    } catch {
      flash("err", t("common_try_again"));
    } finally {
      setAction(null);
    }
  };

  const handleDecline = async () => {
    if (action || !Number.isFinite(requestId)) return;
    const ok = confirm(t("custom_trip_decline_confirm"));
    if (!ok) return;
    setAction("decline");
    try {
      await api.tripMarketplace.agencyDeclineRequest(requestId);
      await refreshAll();
      flash("ok", t("common_rejected"));
    } catch {
      flash("err", t("common_try_again"));
    } finally {
      setAction(null);
    }
  };

  return (
    <DashboardShell title={t("agency_nav_incoming_requests")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="space-y-6">
        {toast ? (
          <div className={`rounded-2xl px-5 py-3 text-sm font-black ${toast.type === "ok" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
            {toast.text}
          </div>
        ) : null}

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 md:p-8">
          {loading ? (
            <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
          ) : !req ? (
            <div className="py-12 text-center">
              <div className="text-6xl">🧭</div>
              <div className="mt-4 text-xl font-black text-gray-900">{t("common_page_not_found_title")}</div>
              <div className="mt-2 text-gray-500 font-medium">{t("common_page_not_found_subtitle")}</div>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/agency/incoming-requests"
                  prefetch={false}
                  className="bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 rounded-2xl transition"
                >
                  {t("agency_nav_incoming_requests")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs font-black uppercase tracking-widest text-blue-600">{req.request_code}</div>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${matchBadgeClass(match?.status || null)}`}>
                      {match?.status || "pending"}
                    </span>
                    {req.travel_style ? (
                      <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700 uppercase tracking-wider">
                        {req.travel_style}
                      </span>
                    ) : null}
                    {req.visa_required ? (
                      <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700 uppercase tracking-wider">
                        🛂 {t("custom_trip_visa_required")}
                      </span>
                    ) : null}
                  </div>

                  <div className="text-3xl font-black text-gray-900 break-words">
                    {req.destination}
                    {req.country ? ` · ${req.country}` : ""}
                    {req.city ? `, ${req.city}` : ""}
                  </div>

                  <div className="text-sm font-bold text-gray-500 flex flex-wrap gap-2">
                    <span>
                      {req.start_date && req.end_date ? `${req.start_date} → ${req.end_date}` : t("custom_trip_flexible_dates")}
                    </span>
                    {req.flexible_dates ? (
                      <span className="text-gray-400">· ({t("custom_trip_flexible_dates")})</span>
                    ) : null}
                    {typeof req.duration === "number" ? (
                      <span className="text-gray-400">· {req.duration} {t("custom_trip_nights")}</span>
                    ) : null}
                  </div>

                  {match?.viewed_at ? (
                    <div className="text-xs font-bold text-gray-400 pt-1">
                      👁️ {t("custom_trip_viewed_at")}: {new Date(match.viewed_at).toLocaleString()}
                    </div>
                  ) : null}
                  {match?.interested_at ? (
                    <div className="text-xs font-bold text-green-600 pt-1">
                      ✅ {t("custom_trip_interested_at")}: {new Date(match.interested_at).toLocaleString()}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 w-full xl:w-[260px] shrink-0">
                  <Link
                    href={`/agency/incoming-requests/${req.id}/create-offer`}
                    prefetch={false}
                    className="inline-flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 transition shadow-lg shadow-blue-200 min-h-[48px]"
                  >
                    {myOffers.length > 0 ? t("custom_trip_edit_offer") : t("custom_trip_create_offer")}
                  </Link>
                  <button
                    type="button"
                    onClick={handleInterested}
                    disabled={!!action || match?.status === "rejected"}
                    className={`rounded-2xl px-6 py-3 font-black transition min-h-[48px] ${
                      action || match?.status === "rejected"
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-white border border-green-200 hover:bg-green-50 text-green-800"
                    }`}
                  >
                    {action === "interested" ? t("common_please_wait") : t("custom_trip_mark_interested")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={!!action || match?.status === "rejected"}
                    className={`rounded-2xl px-6 py-3 font-black transition min-h-[48px] ${
                      action || match?.status === "rejected"
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-white border border-red-200 hover:bg-red-50 text-red-700"
                    }`}
                  >
                    {action === "decline" ? t("common_please_wait") : t("common_reject")}
                  </button>
                  <Link
                    href="/agency/incoming-requests"
                    prefetch={false}
                    className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 transition min-h-[48px]"
                  >
                    {t("marketplace_back")}
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <Card title={t("custom_trip_adults")} value={String(req.adults ?? 0)} />
                <Card title={t("custom_trip_children")} value={String(req.children ?? 0)} />
                <Card
                  title={t("custom_trip_ideal_budget")}
                  value={`${req.ideal_budget ?? req.budget ?? "-"} ${req.budget_currency ?? req.currency ?? ""}`}
                />
                <Card
                  title={t("custom_trip_max_budget")}
                  value={typeof req.max_budget === "number" ? `${req.max_budget} ${req.budget_currency ?? req.currency ?? ""}` : t("custom_trip_optional")}
                />
                <Card title={t("custom_trip_hotel_stars")} value={req.hotel_stars ? `${"★".repeat(req.hotel_stars)}` : t("custom_trip_optional")} />
                <Card title={t("custom_trip_meal_preference")} value={req.meal_preference || req.meal_type || t("custom_trip_optional")} />
                <Card title={t("custom_trip_transportation")} value={req.transportation || t("custom_trip_optional")} />
                <Card title={t("custom_trip_country")} value={req.country || t("custom_trip_optional")} />
                <Card title={t("custom_trip_city")} value={req.city || t("custom_trip_optional")} />
              </div>

              {req.accommodation_preferences ? <Block title={t("custom_trip_accommodation_preferences")} value={req.accommodation_preferences} /> : null}
              {req.activities_interests ? <Block title={t("custom_trip_activities_interests")} value={req.activities_interests} /> : null}
              {req.special_requirements ? <Block title={t("custom_trip_special_requirements")} value={req.special_requirements} /> : null}
              {req.notes || req.special_notes ? <Block title={t("custom_trip_notes")} value={req.notes || req.special_notes || ""} /> : null}
              {Array.isArray(req.attachments) && req.attachments.length > 0 ? (
                <Block
                  title={t("custom_trip_attachments")}
                  value={req.attachments
                    .map((u, i) => `📎 [${t("custom_trip_attachment")} ${i + 1}](${u})`)
                    .join("\n")}
                />
              ) : null}

              {myOffers.length > 0 ? (
                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-6">
                  <div className="text-lg font-black text-indigo-900">
                    {t("custom_trip_my_offers")} ({myOffers.length})
                  </div>
                  <div className="mt-4 space-y-3">
                    {myOffers.map((o) => (
                      <Link
                        key={o.id}
                        href={`/agency/incoming-requests/${req.id}/create-offer`}
                        prefetch={false}
                        className="block rounded-2xl border border-indigo-100 bg-white p-4 hover:bg-indigo-50/60 transition"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-gray-900">
                              {o.total_price ?? o.price ?? "-"} {o.currency ?? req.budget_currency ?? ""}
                              {o.hotel ? ` · ${o.hotel}` : ""}
                            </div>
                            <div className="mt-1 text-xs font-bold text-gray-500">
                              {o.created_at ? new Date(o.created_at).toLocaleString() : ""}
                              {o.expiration_date || o.expires_at
                                ? ` · ${t("custom_trip_valid_until")}: ${new Date(o.expiration_date || o.expires_at || "").toLocaleDateString()}`
                                : ""}
                            </div>
                          </div>
                          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${offerStatusBadgeClass(o.status)}`}>
                            {o.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{title}</div>
      <div className="mt-2 text-sm font-bold text-gray-900 whitespace-pre-wrap break-words">{value}</div>
    </div>
  );
}

function Block({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{title}</div>
      <div className="mt-2 text-sm font-bold text-gray-900 whitespace-pre-wrap break-words">{value}</div>
    </div>
  );
}
