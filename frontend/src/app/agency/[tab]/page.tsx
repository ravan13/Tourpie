"use client";

import DashboardShell from "@/components/DashboardShell";
import PackageModal from "@/components/PackageModal";
import { agencyNav } from "@/lib/dashboardNav";
import {
  Agency,
  AgencyAnalytics,
  AgencyAvailabilityEntry,
  AgencyCustomerSummary,
  AgencyReviewItem,
  AgencyTeamMember,
  api,
  Conversation,
  getStoredToken,
  getStoredTokenPayload,
  isAuthErrorMessage,
  Message,
  Package as PackageType,
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function AgencyTabPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const params = useParams();
  const tabRaw = params?.tab;
  const tab = typeof tabRaw === "string" ? tabRaw : Array.isArray(tabRaw) ? tabRaw[0] : "";

  const payload = getStoredTokenPayload();
  const agencyIdRaw = payload?.agency_id;
  const agencyIdCandidate = typeof agencyIdRaw === "number" ? agencyIdRaw : Number(agencyIdRaw);
  const agencyId = Number.isFinite(agencyIdCandidate) && agencyIdCandidate > 0 ? agencyIdCandidate : null;

  const needsAgencyId = tab !== "messages" && tab.length > 0;
  if (needsAgencyId && !agencyId) {
    return (
      <DashboardShell title={t("agency_nav_overview")} subtitle={t("agency_pending_note")} nav={nav}>
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <div className="text-xl font-black text-gray-900">{t("auth_error")}</div>
          <div className="mt-2 text-gray-500 font-medium">{t("agency_pending_note")}</div>
        </div>
      </DashboardShell>
    );
  }

  if (tab === "bookings") {
    return <AgencyBookings agencyId={agencyId || 0} />;
  }
  if (tab === "packages") {
    return <AgencyPackages agencyId={agencyId || 0} />;
  }
  if (tab === "messages") {
    return <AgencyMessages />;
  }
  if (tab === "calendar") {
    return <AgencyCalendar agencyId={agencyId || 0} />;
  }
  if (tab === "customers") {
    return <AgencyCustomers agencyId={agencyId || 0} />;
  }
  if (tab === "analytics") {
    return <AgencyAnalyticsPage agencyId={agencyId || 0} />;
  }
  if (tab === "reviews") {
    return <AgencyReviews agencyId={agencyId || 0} />;
  }
  if (tab === "team") {
    return <AgencyTeam agencyId={agencyId || 0} />;
  }
  if (tab === "settings") {
    return <AgencySettings agencyId={agencyId || 0} />;
  }

  return (
    <DashboardShell title={t("agency_nav_overview")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center">
        <div className="text-6xl mb-4">🧭</div>
        <div className="text-xl font-black text-gray-900">{t("common_page_not_found_title")}</div>
        <div className="mt-2 text-gray-500 font-medium">{t("common_page_not_found_subtitle")}</div>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/agency"
            prefetch={false}
            className="bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 rounded-2xl transition"
          >
            {t("agency_nav_overview")}
          </Link>
          <Link
            href="/agency/packages"
            prefetch={false}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 rounded-2xl transition"
          >
            {t("agency_nav_packages")}
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}

function AgencyBookings({ agencyId }: { agencyId: number }) {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<import("@/lib/api").Booking[]>([]);

  useEffect(() => {
    void (async () => {
      if (!agencyId || Number.isNaN(agencyId)) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [pending, paymentPending, accepted] = await Promise.all([
          api.bookings.getForAgency(agencyId, "pending"),
          api.bookings.getForAgency(agencyId, "payment_pending").catch(() => []),
          api.bookings.getForAgency(agencyId, "accepted").catch(() => []),
        ]);
        setItems([...pending, ...paymentPending, ...accepted]);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [agencyId]);

  return (
    <DashboardShell title={t("agency_nav_bookings")} subtitle={t("admin_booking_requests")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">📬</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_booking_none")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_notifications_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_booking_table_package")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_booking_table_travel_date")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_booking_table_people")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_booking_table_total")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("bookings_status_pending")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_booking_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{booking.package?.title || t("admin_booking_unknown_package")}</div>
                      <div className="text-xs text-gray-400 mt-1">{t("admin_booking_order", { id: booking.id })}</div>
                      {booking.additional_requests ? (
                        <div className="text-sm text-gray-500 mt-2">{booking.additional_requests}</div>
                      ) : null}
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{new Date(booking.travel_date).toLocaleDateString()}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{booking.number_of_people}</td>
                    <td className="px-10 py-6 font-black text-gray-900">
                      {formatMoney(Number(booking.offered_total_price ?? booking.total_price ?? 0), booking.currency || "USD")}
                      {typeof booking.offered_total_price === "number" ? (
                        <div className="text-xs font-black text-blue-600 mt-1">offer</div>
                      ) : null}
                      {booking.more_info_message ? (
                        <div className="text-xs font-bold text-gray-500 mt-2">{booking.more_info_message}</div>
                      ) : null}
                      {booking.offer_message ? (
                        <div className="text-xs font-bold text-gray-500 mt-2">{booking.offer_message}</div>
                      ) : null}
                    </td>
                    <td className="px-10 py-6 text-gray-900 font-black">{booking.status}</td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={booking.status !== "pending"}
                          onClick={() => {
                            void (async () => {
                              try {
                                const updated = await api.bookings.accept(booking.id, agencyId);
                                setItems((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
                              } catch {
                                alert(t("admin_booking_action_failed"));
                              }
                            })();
                          }}
                          className={`text-sm font-black transition-colors py-2.5 px-4 rounded-xl ${
                            booking.status !== "pending"
                              ? "text-gray-300 bg-gray-50 cursor-not-allowed"
                              : "text-green-700 hover:text-green-800 hover:bg-green-50"
                          }`}
                        >
                          {t("admin_booking_accept")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const message = prompt(t("agency_booking_prompt_request_info")) || "";
                            const trimmed = message.trim();
                            if (!trimmed) return;
                            void (async () => {
                              try {
                                const updated = await api.bookings.requestMoreInfo(booking.id, agencyId, trimmed);
                                setItems((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
                              } catch {
                                alert(t("admin_booking_action_failed"));
                              }
                            })();
                          }}
                          className="text-sm font-black text-gray-700 hover:text-gray-900 transition-colors py-2.5 px-4 rounded-xl hover:bg-gray-50 border border-gray-200 bg-white"
                        >
                          {t("agency_booking_request_info")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rawPrice =
                              prompt(t("agency_booking_prompt_change_price"), String(booking.offered_total_price ?? booking.total_price ?? 0)) || "";
                            const offered = Number(rawPrice);
                            if (!Number.isFinite(offered) || offered < 0) return;
                            const note = prompt(t("agency_booking_prompt_offer_message")) || "";
                            void (async () => {
                              try {
                                const updated = await api.bookings.changePrice(booking.id, agencyId, offered, note.trim() || null);
                                setItems((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
                              } catch {
                                alert(t("admin_booking_action_failed"));
                              }
                            })();
                          }}
                          className="text-sm font-black text-blue-700 hover:text-blue-800 transition-colors py-2.5 px-4 rounded-xl hover:bg-blue-50"
                        >
                          {t("agency_booking_change_price")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const note = prompt(t("agency_booking_prompt_send_offer")) || "";
                            const rawPrice =
                              prompt(t("agency_booking_prompt_offer_price"), String(booking.offered_total_price ?? booking.total_price ?? 0)) || "";
                            const offered = rawPrice.trim() ? Number(rawPrice) : null;
                            if (rawPrice.trim() && (!Number.isFinite(Number(rawPrice)) || Number(rawPrice) < 0)) return;
                            void (async () => {
                              try {
                                const updated = await api.bookings.sendOffer(booking.id, agencyId, offered, note.trim() || null);
                                setItems((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
                              } catch {
                                alert(t("admin_booking_action_failed"));
                              }
                            })();
                          }}
                          className="text-sm font-black text-purple-700 hover:text-purple-800 transition-colors py-2.5 px-4 rounded-xl hover:bg-purple-50"
                        >
                          {t("agency_booking_send_offer")}
                        </button>
                        <button
                          type="button"
                          disabled={booking.status !== "pending"}
                          onClick={() => {
                            if (!confirm(t("admin_booking_confirm_reject"))) return;
                            void (async () => {
                              try {
                                await api.bookings.reject(booking.id, agencyId);
                                setItems((prev) => prev.filter((b) => b.id !== booking.id));
                              } catch {
                                alert(t("admin_booking_action_failed"));
                              }
                            })();
                          }}
                          className={`text-sm font-black transition-colors py-2.5 px-4 rounded-xl ${
                            booking.status !== "pending"
                              ? "text-gray-300 bg-gray-50 cursor-not-allowed"
                              : "text-red-600 hover:text-red-700 hover:bg-red-50"
                          }`}
                        >
                          {t("admin_booking_reject")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AgencyPackages({ agencyId }: { agencyId: number }) {
  const { t, formatPackageMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageType | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    country: "",
    city: "",
    minPrice: "",
    maxPrice: "",
    status: "all" as "all" | "draft" | "active" | "expired" | "archived",
    sort: "date_desc" as
      | "alpha_asc"
      | "alpha_desc"
      | "price_asc"
      | "price_desc"
      | "date_desc"
      | "date_asc",
  });

  const load = useCallback(
    async (next = filters) => {
      if (!agencyId || Number.isNaN(agencyId)) {
        setPackages([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const sortBy = next.sort.startsWith("alpha") ? "alpha" : next.sort.startsWith("price") ? "price" : "date";
        const sortOrder = next.sort.endsWith("_asc") ? "asc" : "desc";
        const minPrice = next.minPrice.trim() ? Number(next.minPrice) : undefined;
        const maxPrice = next.maxPrice.trim() ? Number(next.maxPrice) : undefined;
        const rows = await api.packages.listMyAgency({
          skip: 0,
          limit: 200,
          q: next.q.trim() || undefined,
          country: next.country.trim() || undefined,
          city: next.city.trim() || undefined,
          minPrice: typeof minPrice === "number" && Number.isFinite(minPrice) ? minPrice : undefined,
          maxPrice: typeof maxPrice === "number" && Number.isFinite(maxPrice) ? maxPrice : undefined,
          status: next.status === "all" ? undefined : next.status,
          sortBy,
          sortOrder,
        });
        setPackages(rows);
      } catch {
        setPackages([]);
      } finally {
        setLoading(false);
      }
    },
    [agencyId, filters]
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load(filters);
    }, 250);
    return () => clearTimeout(id);
  }, [filters, load]);

  const clearFilters = () => {
    setFilters({
      q: "",
      country: "",
      city: "",
      minPrice: "",
      maxPrice: "",
      status: "all",
      sort: "date_desc",
    });
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.q.trim()) chips.push({ key: "q", label: `${t("agency_packages_filter_search")}: ${filters.q.trim()}`, onRemove: () => setFilters((p) => ({ ...p, q: "" })) });
    if (filters.country.trim()) chips.push({ key: "country", label: `${t("agency_packages_filter_country")}: ${filters.country.trim()}`, onRemove: () => setFilters((p) => ({ ...p, country: "" })) });
    if (filters.city.trim()) chips.push({ key: "city", label: `${t("agency_packages_filter_city")}: ${filters.city.trim()}`, onRemove: () => setFilters((p) => ({ ...p, city: "" })) });
    if (filters.minPrice.trim()) chips.push({ key: "minPrice", label: `${t("agency_packages_filter_min_price")}: ${filters.minPrice.trim()}`, onRemove: () => setFilters((p) => ({ ...p, minPrice: "" })) });
    if (filters.maxPrice.trim()) chips.push({ key: "maxPrice", label: `${t("agency_packages_filter_max_price")}: ${filters.maxPrice.trim()}`, onRemove: () => setFilters((p) => ({ ...p, maxPrice: "" })) });
    if (filters.status !== "all") chips.push({ key: "status", label: `${t("agency_packages_filter_status")}: ${t(`package_status_${filters.status}`)}`, onRemove: () => setFilters((p) => ({ ...p, status: "all" })) });
    if (filters.sort !== "date_desc") chips.push({ key: "sort", label: `${t("agency_packages_filter_sort")}: ${t(`agency_packages_sort_${filters.sort}`)}`, onRemove: () => setFilters((p) => ({ ...p, sort: "date_desc" })) });
    return chips;
  }, [filters, t]);

  const statusBadge = (s?: string) => {
    const v = (s || "active").toLowerCase();
    const base = "inline-flex items-center px-3 py-1 rounded-full text-xs font-black";
    if (v === "active") return <span className={`${base} bg-green-50 text-green-700`}>{t("package_status_active")}</span>;
    if (v === "draft") return <span className={`${base} bg-gray-100 text-gray-700`}>{t("package_status_draft")}</span>;
    if (v === "expired") return <span className={`${base} bg-amber-50 text-amber-700`}>{t("package_status_expired")}</span>;
    if (v === "archived") return <span className={`${base} bg-purple-50 text-purple-700`}>{t("package_status_archived")}</span>;
    return <span className={`${base} bg-gray-100 text-gray-700`}>{v}</span>;
  };

  const FilterFields = (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
      <div className="md:col-span-4">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_packages_filter_search")}</label>
        <input
          value={filters.q}
          onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
          placeholder={t("agency_packages_filter_search_ph")}
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_packages_filter_country")}</label>
        <input
          value={filters.country}
          onChange={(e) => setFilters((p) => ({ ...p, country: e.target.value }))}
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
          placeholder={t("agency_packages_filter_country_ph")}
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_packages_filter_city")}</label>
        <input
          value={filters.city}
          onChange={(e) => setFilters((p) => ({ ...p, city: e.target.value }))}
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
          placeholder={t("agency_packages_filter_city_ph")}
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_packages_filter_min_price")}</label>
        <input
          inputMode="decimal"
          value={filters.minPrice}
          onChange={(e) => setFilters((p) => ({ ...p, minPrice: e.target.value }))}
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
          placeholder="0"
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_packages_filter_max_price")}</label>
        <input
          inputMode="decimal"
          value={filters.maxPrice}
          onChange={(e) => setFilters((p) => ({ ...p, maxPrice: e.target.value }))}
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
          placeholder="9999"
        />
      </div>
      <div className="md:col-span-3">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_packages_filter_status")}</label>
        <select
          value={filters.status}
          onChange={(e) =>
            setFilters((p) => ({ ...p, status: e.target.value as "all" | "draft" | "active" | "expired" | "archived" }))
          }
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">{t("agency_packages_filter_status_all")}</option>
          <option value="draft">{t("package_status_draft")}</option>
          <option value="active">{t("package_status_active")}</option>
          <option value="expired">{t("package_status_expired")}</option>
          <option value="archived">{t("package_status_archived")}</option>
        </select>
      </div>
      <div className="md:col-span-3">
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_packages_filter_sort")}</label>
        <select
          value={filters.sort}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              sort: e.target.value as "alpha_asc" | "alpha_desc" | "price_asc" | "price_desc" | "date_desc" | "date_asc",
            }))
          }
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
        >
          <option value="date_desc">{t("agency_packages_sort_date_desc")}</option>
          <option value="date_asc">{t("agency_packages_sort_date_asc")}</option>
          <option value="alpha_asc">{t("agency_packages_sort_alpha_asc")}</option>
          <option value="alpha_desc">{t("agency_packages_sort_alpha_desc")}</option>
          <option value="price_asc">{t("agency_packages_sort_price_asc")}</option>
          <option value="price_desc">{t("agency_packages_sort_price_desc")}</option>
        </select>
      </div>
      <div className="md:col-span-6 flex items-end justify-between gap-2">
        <button
          type="button"
          onClick={clearFilters}
          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black py-3 px-5 rounded-2xl transition"
        >
          {t("agency_packages_filter_clear")}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingPackage(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-2xl transition shadow-sm shadow-blue-200"
        >
          {t("admin_create_package")}
        </button>
      </div>
    </div>
  );

  return (
    <DashboardShell title={t("agency_nav_packages")} subtitle={t("admin_subtitle")} nav={nav}>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="text-gray-500 font-medium">{t("admin_active_listings", { count: packages.length })}</div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="md:hidden bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black py-3 px-6 rounded-2xl transition"
        >
          {t("agency_packages_filter_button")}
        </button>
      </div>

      <div className="hidden md:block bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 mb-6">
        {FilterFields}
        {activeChips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.onRemove}
                className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs font-black text-gray-700 hover:bg-white"
              >
                <span className="truncate max-w-[220px]">{c.label}</span>
                <span className="text-gray-400">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-end md:hidden">
          <div className="w-full bg-white rounded-t-[2.5rem] p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-black text-gray-900">{t("agency_packages_filter_title")}</div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="text-gray-400 hover:text-gray-700 font-black px-3 py-2"
              >
                ✕
              </button>
            </div>
            {FilterFields}
            {activeChips.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {activeChips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={c.onRemove}
                    className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs font-black text-gray-700 hover:bg-white"
                  >
                    <span className="truncate max-w-[220px]">{c.label}</span>
                    <span className="text-gray-400">×</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition"
              >
                {t("agency_packages_filter_apply")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : packages.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">📭</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_no_packages")}</div>
            <button
              type="button"
              onClick={() => {
                setEditingPackage(null);
                setIsModalOpen(true);
              }}
              className="mt-6 text-blue-600 font-black hover:underline"
            >
              {t("admin_create_first_listing")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_table_package_name")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_table_destination")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_table_price")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_table_capacity")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{pkg.title}</div>
                      <div className="text-xs text-gray-400 mt-1">{t("admin_listing_id", { id: pkg.id })}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">
                      <div className="flex flex-col gap-2">
                        <div className="truncate">{pkg.city || pkg.destination}{pkg.country ? `, ${pkg.country}` : ""}</div>
                        <div>{statusBadge(pkg.status)}</div>
                      </div>
                    </td>
                    <td className="px-10 py-6 font-black text-gray-900">{formatPackageMoney(pkg)}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">
                      {pkg.capacity} {t("admin_people")}
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPackage(pkg);
                            setIsModalOpen(true);
                          }}
                          className="text-sm font-black text-blue-600 hover:text-blue-700 transition-colors py-2.5 px-4 rounded-xl hover:bg-blue-50"
                        >
                          {t("admin_edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              try {
                                const created = await api.packages.duplicate(pkg.id, { status: "draft" });
                                setEditingPackage(created);
                                setIsModalOpen(true);
                              } catch {
                                alert(t("agency_packages_duplicate_failed"));
                              }
                            })();
                          }}
                          className="text-sm font-black text-gray-900 hover:text-blue-700 transition-colors py-2.5 px-4 rounded-xl hover:bg-gray-50"
                        >
                          {t("agency_packages_duplicate")}
                        </button>
                        {pkg.status === "archived" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    const updated = await api.packages.setStatus(pkg.id, { status: "draft", reason: "restore" });
                                    setPackages((prev) => prev.map((p) => (p.id === pkg.id ? updated : p)));
                                  } catch {
                                    alert(t("agency_packages_restore_failed"));
                                  }
                                })();
                              }}
                              className="text-sm font-black text-purple-700 hover:text-purple-800 transition-colors py-2.5 px-4 rounded-xl hover:bg-purple-50"
                            >
                              {t("agency_packages_restore_draft")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    const updated = await api.packages.setStatus(pkg.id, { status: "active", reason: "restore" });
                                    setPackages((prev) => prev.map((p) => (p.id === pkg.id ? updated : p)));
                                  } catch {
                                    alert(t("agency_packages_restore_failed"));
                                  }
                                })();
                              }}
                              className="text-sm font-black text-green-700 hover:text-green-800 transition-colors py-2.5 px-4 rounded-xl hover:bg-green-50"
                            >
                              {t("agency_packages_restore_active")}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm(t("agency_packages_confirm_archive"))) return;
                              void (async () => {
                                try {
                                  const updated = await api.packages.setStatus(pkg.id, { status: "archived", reason: "archive" });
                                  setPackages((prev) => prev.map((p) => (p.id === pkg.id ? updated : p)));
                                } catch {
                                  alert(t("agency_packages_archive_failed"));
                                }
                              })();
                            }}
                            className="text-sm font-black text-purple-700 hover:text-purple-800 transition-colors py-2.5 px-4 rounded-xl hover:bg-purple-50"
                          >
                            {t("agency_packages_archive")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(t("admin_confirm_delete"))) return;
                            void (async () => {
                              try {
                                await api.packages.delete(pkg.id);
                                setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
                              } catch {
                                alert(t("admin_delete_failed"));
                              }
                            })();
                          }}
                          className="text-sm font-black text-gray-400 hover:text-red-500 transition-colors py-2.5 px-4 rounded-xl hover:bg-red-50"
                        >
                          {t("admin_delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PackageModal
        key={editingPackage ? `edit-${editingPackage.id}` : "create"}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          void load(filters);
        }}
        editingPackage={editingPackage}
        agencyId={agencyId || 1}
      />
    </DashboardShell>
  );
}

function AgencyMessages() {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setConversations([]);
        setActiveId(null);
        setMessages([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const convs = await api.messages.listConversations();
        setConversations(convs);
        const initial = convs[0]?.id;
        if (initial) {
          setMessages([]);
          setActiveId(initial);
        }
      } catch {
        setConversations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void (async () => {
      try {
        const msgs = await api.messages.listMessages(activeId);
        setMessages(msgs);
      } catch {
        setMessages([]);
      }
    })();
  }, [activeId]);

  return (
    <DashboardShell title={t("agency_nav_messages")} subtitle={t("dash_messages_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : conversations.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">💬</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_messages_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_messages_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50">
              <div className="p-5 font-black text-gray-900">{t("dash_messages_inbox")}</div>
              <div className="px-3 pb-3 space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setActiveId(c.id);
                    }}
                    className={`w-full text-left rounded-2xl px-4 py-4 border transition ${
                      activeId === c.id ? "bg-white border-blue-100 shadow-sm" : "bg-white/60 border-gray-100 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-black text-gray-900">{t("dash_messages_thread", { id: c.id })}</div>
                      <div className="text-xs font-black text-gray-400">{new Date(c.updated_at).toLocaleDateString()}</div>
                    </div>
                    <div className="mt-2 text-sm font-bold text-gray-500">
                      {c.package_id ? t("dash_messages_related_package", { id: c.package_id }) : t("dash_messages_general")}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8">
              {!activeId ? (
                <div className="p-10 text-center text-gray-500 font-bold">{t("dash_messages_select")}</div>
              ) : (
                <div className="flex flex-col h-[70vh]">
                  <div className="flex-1 overflow-auto p-6 space-y-3 bg-white">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 font-bold py-10">{t("dash_messages_no_messages")}</div>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-2xl px-5 py-4 border ${
                            m.sender_role === "agency"
                              ? "ml-auto bg-blue-600 text-white border-blue-600"
                              : "mr-auto bg-gray-50 text-gray-900 border-gray-100"
                          }`}
                        >
                          <div className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{m.content}</div>
                          <div className={`mt-2 text-[11px] font-black ${m.sender_role === "agency" ? "text-blue-100" : "text-gray-400"}`}>
                            {new Date(m.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!activeId) return;
                      const content = draft.trim();
                      if (!content) return;
                      setSending(true);
                      void (async () => {
                        try {
                          const sent = await api.messages.sendMessage(activeId, content);
                          setMessages((prev) => [...prev, sent]);
                          setDraft("");
                          setConversations((prev) =>
                            prev.map((c) => (c.id === activeId ? { ...c, updated_at: new Date().toISOString() } : c))
                          );
                        } catch {
                          return;
                        } finally {
                          setSending(false);
                        }
                      })();
                    }}
                    className="border-t border-gray-100 bg-white p-4"
                  >
                    <div className="flex gap-3">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t("dash_messages_placeholder")}
                      />
                      <button
                        type="submit"
                        disabled={sending}
                        className={`px-6 py-4 rounded-2xl font-black transition ${
                          sending ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                        }`}
                      >
                        {t("dash_messages_send")}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AgencyCalendar({ agencyId }: { agencyId: number }) {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<{ date: string; is_blocked: boolean; capacity_override: number | null }[]>([]);

  const start = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const end = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const days = useMemo(() => {
    const arr: string[] = [];
    const d = new Date(start);
    const endD = new Date(end);
    while (d <= endD) {
      arr.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [end, start]);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!agencyId || Number.isNaN(agencyId)) {
          setEntries([]);
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const rows = await api.agencies.getAvailability(agencyId, start, end);
          const mapped = (rows || []).map((r: AgencyAvailabilityEntry) => ({
            date: String(r.date).slice(0, 10),
            is_blocked: Boolean(r.is_blocked),
            capacity_override: r.capacity_override == null ? null : Number(r.capacity_override),
          }));
          setEntries(mapped);
        } catch {
          setEntries([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [agencyId, end, start]);

  const getEntry = (dateStr: string) => entries.find((e) => e.date === dateStr) || null;

  const save = async (dateStr: string, patch: { is_blocked?: boolean; capacity_override?: number | null }) => {
    const current = getEntry(dateStr) || { date: dateStr, is_blocked: false, capacity_override: null };
    const next = {
      date: dateStr,
      is_blocked: patch.is_blocked ?? current.is_blocked,
      capacity_override: patch.capacity_override !== undefined ? patch.capacity_override : current.capacity_override,
    };
    const saved = await api.agencies.upsertAvailability(agencyId, next.date, next.is_blocked, next.capacity_override);
    const normalized = {
      date: String(saved.date).slice(0, 10),
      is_blocked: Boolean(saved.is_blocked),
      capacity_override: saved.capacity_override == null ? null : Number(saved.capacity_override),
    };
    setEntries((prev) => {
      const rest = prev.filter((x) => x.date !== normalized.date);
      return [...rest, normalized].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  return (
    <DashboardShell title={t("agency_nav_calendar")} subtitle={t("agency_calendar_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_calendar_th_date")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_calendar_th_blocked")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_calendar_th_capacity")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {days.map((d) => {
                  const e = getEntry(d);
                  const blocked = e ? e.is_blocked : false;
                  const capacity = e ? e.capacity_override : null;
                  return (
                    <tr key={d} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-10 py-6 text-gray-900 font-black">{new Date(d).toLocaleDateString()}</td>
                      <td className="px-10 py-6">
                        <label className="inline-flex items-center gap-3 font-bold text-gray-700">
                          <input
                            type="checkbox"
                            checked={blocked}
                            onChange={(ev) => void save(d, { is_blocked: ev.target.checked })}
                            className="h-5 w-5"
                          />
                          {blocked ? t("common_yes") : t("common_no")}
                        </label>
                      </td>
                      <td className="px-10 py-6">
                        <input
                          type="number"
                          value={capacity ?? ""}
                          onChange={(ev) => {
                            const raw = ev.target.value;
                            const val = raw.trim() ? Number(raw) : null;
                            if (raw.trim() && Number.isNaN(val)) return;
                            void save(d, { capacity_override: val });
                          }}
                          className="w-40 bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900"
                          min={0}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AgencyCustomers({ agencyId }: { agencyId: number }) {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AgencyCustomerSummary[]>([]);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!agencyId || Number.isNaN(agencyId)) {
          setItems([]);
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const rows = await api.agencies.getCustomers(agencyId);
          setItems(rows || []);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [agencyId]);

  return (
    <DashboardShell title={t("agency_nav_customers")} subtitle={t("agency_customers_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">👥</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("agency_customers_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("agency_customers_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_customers_th_customer")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_customers_th_bookings")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_customers_th_total_spent")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((c) => (
                  <tr key={c.user_id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{c.full_name || "—"}</div>
                      <div className="text-xs font-bold text-gray-400 mt-1">{c.email}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{c.bookings_count}</td>
                    <td className="px-10 py-6 font-black text-blue-600">{formatMoney(Number(c.total_spent || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AgencyAnalyticsPage({ agencyId }: { agencyId: number }) {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AgencyAnalytics | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!agencyId || Number.isNaN(agencyId)) {
          setData(null);
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const res = await api.agencies.getAnalytics(agencyId);
          setData(res);
        } catch {
          setData(null);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [agencyId]);

  return (
    <DashboardShell title={t("agency_nav_analytics")} subtitle={t("agency_analytics_subtitle")} nav={nav}>
      {loading ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center font-bold text-gray-500">
          {t("common_loading")}
        </div>
      ) : !data ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-6xl">📈</div>
          <div className="mt-4 text-xl font-black text-gray-900">{t("agency_analytics_empty_title")}</div>
          <div className="mt-2 text-gray-500 font-medium">{t("agency_analytics_empty_subtitle")}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_analytics_card_revenue")}</div>
            <div className="mt-3 text-4xl font-black text-blue-600">{formatMoney(Number(data.revenue_total || 0))}</div>
          </div>
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_analytics_card_bookings")}</div>
            <div className="mt-3 text-4xl font-black text-gray-900">{data.bookings_total}</div>
          </div>
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_analytics_card_pending")}</div>
            <div className="mt-3 text-4xl font-black text-gray-900">{data.bookings_pending}</div>
          </div>
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_analytics_card_completed")}</div>
            <div className="mt-3 text-4xl font-black text-gray-900">{data.bookings_completed}</div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function AgencyReviews({ agencyId }: { agencyId: number }) {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AgencyReviewItem[]>([]);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!agencyId || Number.isNaN(agencyId)) {
          setItems([]);
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const rows = await api.agencies.getReviews(agencyId);
          setItems(rows || []);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [agencyId]);

  return (
    <DashboardShell title={t("agency_nav_reviews")} subtitle={t("agency_reviews_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">⭐</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("agency_reviews_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("agency_reviews_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_reviews_th_package")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_reviews_th_rating")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_reviews_th_user")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_reviews_th_comment")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6 font-black text-gray-900">
                      {r.package_title || t("dash_reviews_package_fallback", { id: r.package_id })}
                    </td>
                    <td className="px-10 py-6 font-black text-blue-600">{r.rating}/5</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{r.user?.full_name || "—"}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{r.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AgencyTeam({ agencyId }: { agencyId: number }) {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AgencyTeamMember[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<{ email: string; full_name: string; role: "owner" | "staff" }>({
    email: "",
    full_name: "",
    role: "staff",
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await api.agencies.getTeam(agencyId);
      setItems(rows || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const add = async () => {
    const email = addForm.email.trim().toLowerCase();
    const full_name = addForm.full_name.trim();
    const role = addForm.role;
    if (!email) return;
    try {
      setAddSaving(true);
      setAddError(null);
      const created = await api.agencies.addTeam(agencyId, { email, full_name: full_name || null, role });
      setItems((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      setShowAdd(false);
      setAddForm({ email: "", full_name: "", role: "staff" });
    } catch (e) {
      setAddError(e instanceof Error ? e.message : t("agency_team_add_failed"));
    } finally {
      setAddSaving(false);
    }
  };

  const remove = async (memberId: number) => {
    if (!confirm(t("agency_team_remove_confirm"))) return;
    try {
      await api.agencies.removeTeam(agencyId, memberId);
      setItems((prev) => prev.filter((x) => x.id !== memberId));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (isAuthErrorMessage(message)) return;
      alert(message || t("agency_team_remove_failed"));
    }
  };

  return (
    <DashboardShell title={t("agency_nav_team")} subtitle={t("agency_team_subtitle")} nav={nav}>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="text-gray-500 font-medium">
          {items.length} {t("agency_team_members")}
        </div>
        <button
          type="button"
          onClick={() => {
            setAddError(null);
            setShowAdd(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-2xl transition shadow-sm shadow-blue-200"
        >
          {t("agency_team_add_member")}
        </button>
      </div>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🧑‍🤝‍🧑</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("agency_team_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("agency_team_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_team_table_member")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_team_table_role")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("agency_team_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{m.full_name || "—"}</div>
                      <div className="text-xs font-bold text-gray-400 mt-1">{m.email}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">
                      {m.role === "owner" ? t("agency_team_role_owner") : t("agency_team_role_staff")}
                    </td>
                    <td className="px-10 py-6 text-right">
                      <button
                        type="button"
                        onClick={() => void remove(m.id)}
                        className="text-sm font-black text-red-600 hover:text-red-700 transition-colors py-2.5 px-4 rounded-xl hover:bg-red-50"
                      >
                        {t("common_delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100">
              <div className="text-xl font-black text-gray-900">{t("agency_team_add_title")}</div>
              <div className="mt-1 text-sm font-bold text-gray-500">{t("agency_team_add_subtitle")}</div>
            </div>
            <div className="p-8 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_team_member_email")}</label>
                <input
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  type="email"
                  required
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t("agency_team_member_email_placeholder")}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  {t("agency_team_member_name")}
                </label>
                <input
                  value={addForm.full_name}
                  onChange={(e) => setAddForm((p) => ({ ...p, full_name: e.target.value }))}
                  type="text"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t("agency_team_member_name_placeholder")}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("agency_team_member_role")}</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value === "owner" ? "owner" : "staff" }))}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="staff">{t("agency_team_role_staff")}</option>
                  <option value="owner">{t("agency_team_role_owner")}</option>
                </select>
              </div>
              {addError ? (
                <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-2xl p-4">{addError}</div>
              ) : null}
            </div>
            <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddError(null);
                }}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 rounded-2xl transition"
              >
                {t("common_cancel")}
              </button>
              <button
                type="button"
                disabled={addSaving || !addForm.email.trim()}
                onClick={() => void add()}
                className={`font-black px-6 py-3 rounded-2xl transition ${
                  addSaving || !addForm.email.trim()
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {addSaving ? t("common_please_wait") : t("common_save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function AgencySettings({ agencyId }: { agencyId: number }) {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [form, setForm] = useState<Pick<Agency, "name" | "description" | "website" | "contact_email" | "phone_number" | "country" | "office_address" | "tax_vat_info">>({
    name: "",
    description: "",
    website: "",
    contact_email: "",
    phone_number: "",
    country: "",
    office_address: "",
    tax_vat_info: "",
  });

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!agencyId || Number.isNaN(agencyId)) {
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const a = await api.agencies.getOne(agencyId);
          setForm({
            name: a.name || "",
            description: a.description || "",
            website: a.website || "",
            contact_email: a.contact_email || "",
            phone_number: a.phone_number || "",
            country: a.country || "",
            office_address: a.office_address || "",
            tax_vat_info: a.tax_vat_info || "",
          });
        } catch {
          return;
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [agencyId]);

  const save = async () => {
    try {
      setSaving(true);
      await api.agencies.update(agencyId, {
        name: form.name,
        description: form.description,
        website: form.website,
        contact_email: form.contact_email,
        phone_number: form.phone_number,
        country: form.country,
        office_address: form.office_address,
        tax_vat_info: form.tax_vat_info,
      });
      alert(t("common_saved"));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (isAuthErrorMessage(message)) return;
      alert(message || t("admin_action_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title={t("agency_nav_settings")} subtitle={t("agency_settings_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_name")}</div>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_contact_email")}</div>
              <input
                value={form.contact_email}
                onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_website")}</div>
              <input
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_phone")}</div>
              <input
                value={form.phone_number}
                onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))}
                className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_country")}</div>
              <input
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_office_address")}</div>
              <input
                value={form.office_address}
                onChange={(e) => setForm((p) => ({ ...p, office_address: e.target.value }))}
                className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_description")}</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 min-h-28"
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_tax_vat")}</div>
              <input
                value={form.tax_vat_info}
                onChange={(e) => setForm((p) => ({ ...p, tax_vat_info: e.target.value }))}
                className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={`w-full font-black py-4 px-6 rounded-2xl transition ${
                  saving ? "bg-gray-100 text-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {saving ? t("common_saving") : t("common_save_changes")}
              </button>
            </div>

            <div className="md:col-span-2 rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_security_title")}</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_current_password")}</div>
                  <input
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    type="password"
                    className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_new_password")}</div>
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_confirm_password")}</div>
                  <input
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    type="password"
                    className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={pwSaving}
                    onClick={async () => {
                      if (newPassword.trim() !== newPasswordConfirm.trim()) {
                        setPwMessage({ type: "error", text: t("auth_password_mismatch") });
                        return;
                      }
                      setPwSaving(true);
                      setPwMessage(null);
                      try {
                        await api.auth.changePassword({ current_password: currentPassword, new_password: newPassword.trim() });
                        setCurrentPassword("");
                        setNewPassword("");
                        setNewPasswordConfirm("");
                        setPwMessage({ type: "success", text: t("settings_password_changed") });
                      } catch (e) {
                        setPwMessage({ type: "error", text: e instanceof Error ? e.message : t("settings_password_change_failed") });
                      } finally {
                        setPwSaving(false);
                      }
                    }}
                    className={`w-full font-black py-4 px-6 rounded-2xl transition ${
                      pwSaving ? "bg-gray-100 text-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                    }`}
                  >
                    {pwSaving ? t("common_please_wait") : t("settings_change_password")}
                  </button>
                </div>
              </div>
              {pwMessage ? (
                <div
                  className={`mt-4 rounded-2xl p-4 text-sm font-black ${
                    pwMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {pwMessage.text}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
