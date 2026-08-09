"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripOffer, TripRequest, getStoredToken } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const TABS = [
  { key: "all", label: "custom_trip_tab_all" },
  { key: "draft", label: "custom_trip_tab_drafts" },
  { key: "active", label: "custom_trip_tab_active" },
  { key: "waiting_offers", label: "custom_trip_tab_waiting" },
  { key: "completed", label: "custom_trip_tab_completed" },
  { key: "cancelled", label: "custom_trip_tab_cancelled" },
  { key: "archived", label: "custom_trip_tab_archived" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function hoursRemaining(expiresAt: string) {
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, end - now);
  return Math.ceil(diffMs / (1000 * 60 * 60));
}

export default function DashboardRequestsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [offers, setOffers] = useState<TripOffer[]>([]);
  const [tab, setTab] = useState<TabKey>("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      if (offer.status !== "draft" && offer.status !== "cancelled") {
        map.set(offer.trip_request_id, (map.get(offer.trip_request_id) || 0) + 1);
      }
    }
    return map;
  }, [offers]);

  const filteredRequests = useMemo(() => {
    const base = requests.slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    switch (tab) {
      case "draft":
        return base.filter((r) => r.status === "draft");
      case "active":
        return base.filter((r) =>
          ["active", "submitted", "searching_agencies", "receiving_offers", "comparing_offers"].includes(r.status)
        );
      case "waiting_offers":
        return base.filter((r) => {
          const c = offersByRequest.get(r.id) || 0;
          return (
            ["active", "submitted", "searching_agencies", "receiving_offers", "comparing_offers"].includes(r.status) &&
            c === 0
          );
        });
      case "completed":
        return base.filter((r) => r.status === "completed" || r.status === "accepted");
      case "cancelled":
        return base.filter((r) => r.status === "cancelled" || r.status === "expired");
      case "archived":
        return base.filter((r) => r.status === "archived");
      default:
        return base;
    }
  }, [requests, tab, offersByRequest]);

  const mutateRow = (row: TripRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === row.id ? row : r)));
  };

  const removeRow = (id: number) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <DashboardShell title={t("dash_requests")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 -mx-1 px-1 overflow-x-auto">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              aria-pressed={tab === tb.key}
              className={`inline-flex flex-shrink-0 items-center rounded-full px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-black transition border ${
                tab === tb.key
                  ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200"
                  : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
              }`}
            >
              {t(tb.label as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>

        {message ? (
          <div className={`mb-6 rounded-2xl px-6 py-4 text-sm font-black ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        ) : null}

        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-6xl">📝</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_requests")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("common_empty")}</div>
            <div className="mt-8 flex justify-center gap-3 flex-wrap">
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
          <div className="space-y-5">
            {filteredRequests.map((req) => {
              const offersCount = req.offers_count ?? offersByRequest.get(req.id) ?? 0;
              const hours = req.status === "draft" || req.status === "completed" || req.status === "archived" || req.status === "cancelled"
                ? null
                : hoursRemaining(req.expires_at);
              return (
                <div key={req.id} className="rounded-3xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                  <div className="p-6 sm:p-7 flex flex-col gap-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <div className="text-xs font-black uppercase tracking-widest text-blue-600">
                            {req.request_code}
                          </div>
                          <StatusBadge status={req.status} t={t} />
                        </div>
                        <div className="mt-2 text-2xl font-black text-gray-900 truncate">
                          {req.destination || `${req.country || "-"}${req.city ? ` / ${req.city}` : ""}`}
                        </div>
                        <div className="mt-1 text-sm font-bold text-gray-500">
                          {req.country || req.city ? (
                            <span className="mr-3">
                              {req.country}
                              {req.city ? ` · ${req.city}` : ""}
                            </span>
                          ) : null}
                          {req.start_date && req.end_date ? (
                            <span>{req.start_date} → {req.end_date}</span>
                          ) : req.flexible_dates ? (
                            <span>{t("custom_trip_flexible_dates")}</span>
                          ) : null}
                          {typeof req.duration === "number" ? (
                            <span className="ml-3">
                              {req.duration} {t("custom_trip_days")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                          {req.ideal_budget ?? req.budget ?? 0} {req.budget_currency || req.currency || "USD"}
                        </span>
                        {typeof req.max_budget === "number" ? (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-black text-gray-700">
                            Max: {req.max_budget} {req.budget_currency || req.currency || "USD"}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label={t("custom_trip_adults")} value={req.adults} />
                      <Stat label={t("custom_trip_children")} value={req.children} />
                      <Stat label={t("dash_offers")} value={offersCount} />
                      <Stat
                        label={t("custom_trip_updated")}
                        value={new Date(req.updated_at).toLocaleDateString()}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        {hours !== null ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-100 px-4 py-2 text-xs font-black">
                            {t("discover_hub_expiring_in")}: {hours}h
                          </span>
                        ) : null}
                        {req.travel_style ? (
                          <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 border border-purple-100 px-4 py-2 text-xs font-black">
                            {req.travel_style}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/request-custom-offers?edit=${req.id}`}
                          prefetch={false}
                          className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-5 py-3 transition"
                        >
                          {t("common_edit")}
                        </Link>
                        <Link
                          href={`/dashboard/offers?request=${req.id}`}
                          prefetch={false}
                          className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-5 py-3 transition"
                        >
                          {t("dash_offers")}
                        </Link>
                        {req.status === "draft" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const updated = await api.tripMarketplace.submitRequest(req.id);
                                mutateRow(updated);
                                setMessage({ type: "success", text: t("custom_trip_success_submitted") });
                              } catch (e) {
                                setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black px-5 py-3 transition shadow-lg shadow-green-200"
                          >
                            {t("custom_trip_submit")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(t("custom_trip_duplicate_confirm"))) return;
                            try {
                              const clone = await api.tripMarketplace.duplicateRequest(req.id);
                              setRequests((prev) => [clone, ...prev]);
                              setMessage({ type: "success", text: t("common_saved") });
                              router.push(`/request-custom-offers?edit=${clone.id}`);
                            } catch (e) {
                              setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
                            }
                          }}
                          className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-5 py-3 transition"
                        >
                          {t("custom_trip_duplicate")}
                        </button>
                        {req.status !== "archived" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(t("custom_trip_archive_confirm"))) return;
                              try {
                                const updated = await api.tripMarketplace.archiveRequest(req.id);
                                mutateRow(updated);
                              } catch (e) {
                                setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-5 py-3 transition"
                          >
                            {t("custom_trip_archive")}
                          </button>
                        ) : null}
                        {["draft", "cancelled", "expired", "archived"].includes(req.status) ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(t("common_delete"))) return;
                              try {
                                await api.tripMarketplace.deleteRequest(req.id);
                                removeRow(req.id);
                              } catch (e) {
                                setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-2xl bg-white border border-red-200 hover:bg-red-50 text-red-700 font-black px-5 py-3 transition"
                          >
                            {t("common_delete")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(t("common_cancel"))) return;
                              try {
                                const updated = await api.tripMarketplace.cancelRequest(req.id);
                                mutateRow(updated);
                              } catch (e) {
                                setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-5 py-3 transition"
                          >
                            {t("common_cancel")}
                          </button>
                        )}
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
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 sm:px-5 py-3 sm:py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{label}</div>
      <div className="mt-1 text-lg sm:text-xl font-black text-gray-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status, t }: { status: TripRequest["status"]; t: (k: string) => string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: t("custom_trip_status_draft"), cls: "bg-gray-100 text-gray-700 border-gray-200" },
    active: { label: t("custom_trip_status_active"), cls: "bg-blue-50 text-blue-700 border-blue-100" },
    submitted: { label: t("custom_trip_status_submitted"), cls: "bg-blue-50 text-blue-700 border-blue-100" },
    searching_agencies: { label: t("custom_trip_status_searching"), cls: "bg-indigo-50 text-indigo-700 border-indigo-100" },
    receiving_offers: { label: t("custom_trip_status_receiving"), cls: "bg-purple-50 text-purple-700 border-purple-100" },
    comparing_offers: { label: t("custom_trip_status_comparing"), cls: "bg-purple-50 text-purple-700 border-purple-100" },
    accepted: { label: t("custom_trip_status_accepted"), cls: "bg-green-50 text-green-700 border-green-100" },
    completed: { label: t("custom_trip_status_completed"), cls: "bg-green-50 text-green-700 border-green-100" },
    expired: { label: t("custom_trip_status_expired"), cls: "bg-amber-50 text-amber-800 border-amber-100" },
    cancelled: { label: t("custom_trip_status_cancelled"), cls: "bg-red-50 text-red-700 border-red-100" },
    archived: { label: t("custom_trip_status_archived"), cls: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const cfg = map[status] || { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
