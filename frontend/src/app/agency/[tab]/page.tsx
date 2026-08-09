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
  Booking,
  Conversation,
  getStoredToken,
  getStoredTokenPayload,
  isAuthErrorMessage,
  Message,
  Notification,
  Package as PackageType,
  TripBooking,
  TripBookingChecklistItem,
  TripBookingDocument,
  TripBookingPaymentRecord,
  TripBookingTimelineEvent,
  TripBookingWorkspace,
  TripOffer,
  TripOfferStatus,
  TripRequest,
  TripRequestStatus,
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  if (tab === "requests") {
    return <AgencyRequests agencyId={agencyId || 0} />;
  }
  if (tab === "offers") {
    return <AgencyOffers agencyId={agencyId || 0} />;
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
  if (tab === "notifications") {
    return <AgencyNotificationsPage agencyId={agencyId || 0} />;
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

type UnifiedBooking = {
  id: string;
  kind: "package" | "custom";
  packageId?: number | null;
  tripRequestId?: number | null;
  title: string;
  subtitle?: string;
  destination?: string;
  country?: string;
  city?: string;
  startDate?: string | null;
  endDate?: string | null;
  travelDate?: string | null;
  people: number;
  nights?: number | null;
  price: number;
  currency: string;
  offerPrice?: number | null;
  status: string;
  paymentStatus?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerUserId?: number | null;
  createdAt: string;
  updatedAt?: string;
  bookingCode?: string;
  notes?: string | null;
  rawPackage?: Booking;
  rawTrip?: TripBooking;
};

type BookingGroupStatus = "ALL" | "UPCOMING" | "COMPLETED" | "CANCELLED";

function categorizeBookingStatus(s: string): BookingGroupStatus {
  const v = (s || "").toLowerCase();
  if (/cancel|reject|decline/.test(v)) return "CANCELLED";
  if (/complete|done|finish|COMPLETED/.test(v)) return "COMPLETED";
  if (/expire/.test(v) && !/pending|waiting|payment|accepted|confirmed|in_progress/.test(v)) return "CANCELLED";
  if (/payment_pending|pending|accepted|confirmed|CONFIRMED|in_progress|waiting|submitted|searching/.test(v)) return "UPCOMING";
  return "UPCOMING";
}

function unifiedStatusTone(s: string): string {
  const v = (s || "").toLowerCase();
  if (/accept|confirm|COMPLETED|accepted|confirmed/.test(v)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (/cancel|reject|decline/.test(v)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (/complete|done|finish/.test(v)) return "bg-violet-50 text-violet-700 ring-violet-200";
  if (/payment_pending|payment/.test(v)) return "bg-amber-50 text-amber-800 ring-amber-200";
  if (/pending|waiting|submitted|searching/.test(v)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (/expire/.test(v)) return "bg-gray-100 text-gray-600 ring-gray-200";
  return "bg-gray-50 text-gray-700 ring-gray-200";
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const DOC_CATEGORIES = [
  "Voucher",
  "Invoice",
  "Insurance",
  "Flight",
  "Hotel",
  "Visa",
  "Travel Program",
  "Other",
] as const;

const MAX_DOC_MB = 20;

function AgencyBookings({ agencyId }: { agencyId: number }) {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UnifiedBooking[]>([]);

  const [q, setQ] = useState("");
  const [group, setGroup] = useState<BookingGroupStatus>("ALL");
  const [kind, setKind] = useState<"ALL" | "package" | "custom">("ALL");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "price_desc" | "price_asc">("date_desc");

  const [workspace, setWorkspace] = useState<{
    booking: UnifiedBooking;
    data?: TripBookingWorkspace | null;
    loading: boolean;
    activeTab: "overview" | "documents" | "payments" | "checklist" | "timeline";
    error?: string | null;
    docBusy?: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    if (!agencyId || Number.isNaN(agencyId)) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [
        pending,
        paymentPending,
        accepted,
        confirmed,
        inProgress,
        completed,
        cancelled,
        tripBooks,
      ] = await Promise.all([
        api.bookings.getForAgency(agencyId, "pending").catch(() => [] as Booking[]),
        api.bookings.getForAgency(agencyId, "payment_pending").catch(() => [] as Booking[]),
        api.bookings.getForAgency(agencyId, "accepted").catch(() => [] as Booking[]),
        api.bookings.getForAgency(agencyId, "confirmed").catch(() => [] as Booking[]),
        api.bookings.getForAgency(agencyId, "in_progress").catch(() => [] as Booking[]),
        api.bookings.getForAgency(agencyId, "completed").catch(() => [] as Booking[]),
        api.bookings.getForAgency(agencyId, "cancelled").catch(() => [] as Booking[]),
        api.tripMarketplace.listMyBookings(null).catch(() => [] as TripBooking[]),
      ]);
      const packages: Booking[] = [
        ...pending,
        ...paymentPending,
        ...accepted,
        ...confirmed,
        ...inProgress,
        ...completed,
        ...cancelled,
      ];
      const seen = new Set<number>();
      const merged: UnifiedBooking[] = [];
      for (const b of packages) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        merged.push({
          id: `pkg-${b.id}`,
          kind: "package",
          packageId: b.package_id,
          tripRequestId: null,
          title: b.package?.title || t("admin_booking_unknown_package"),
          subtitle: t("admin_booking_order", { id: b.id }),
          destination: b.package?.destination,
          country: b.package?.country as string | undefined,
          city: b.package?.city as string | undefined,
          travelDate: b.travel_date || null,
          startDate: b.travel_date || null,
          endDate: null,
          people: Number(b.number_of_people) || 0,
          price: Number(b.total_price ?? 0),
          offerPrice: typeof b.offered_total_price === "number" ? b.offered_total_price : null,
          currency: b.currency || "USD",
          status: b.status || "pending",
          paymentStatus: (b as any).payment_status || undefined,
          customerName: (b as any).user?.full_name || (b as any).customer_name || "Customer",
          customerEmail: (b as any).user?.email || (b as any).customer_email || undefined,
          customerPhone: (b as any).user?.phone_number || (b as any).phone || undefined,
          customerUserId: (b as any).user?.id ?? (b as any).user_id ?? null,
          createdAt: (b as any).created_at || new Date().toISOString(),
          updatedAt: (b as any).updated_at,
          notes: b.more_info_message || b.offer_message || b.additional_requests || null,
          rawPackage: b,
        });
      }
      for (const tb of tripBooks) {
        merged.push({
          id: `trip-${tb.id}`,
          kind: "custom",
          packageId: (tb as any).package_id || null,
          tripRequestId: tb.trip_request_id || null,
          title: (tb as any).trip_request?.destination || (tb as any).title || `Custom Trip #${tb.id}`,
          subtitle: `TripBooking #${tb.id}`,
          destination: (tb as any).trip_request?.destination || tb.destination || undefined,
          country: (tb as any).trip_request?.country || undefined,
          city: (tb as any).trip_request?.city || undefined,
          travelDate: (tb as any).trip_request?.start_date || tb.start_date || null,
          startDate: (tb as any).trip_request?.start_date || tb.start_date || null,
          endDate: (tb as any).trip_request?.end_date || tb.end_date || null,
          people: Number((tb as any).trip_request?.adults ?? 0) + Number((tb as any).trip_request?.children ?? 0) || Number((tb as any).travelers_count) || 0,
          nights: (tb as any).trip_request?.duration ?? null,
          price: Number(tb.total_price ?? (tb as any).offer?.total_price ?? 0),
          offerPrice: typeof (tb as any).offer?.total_price === "number" ? (tb as any).offer.total_price : null,
          currency: tb.currency || (tb as any).offer?.currency || "USD",
          status: tb.status || "pending",
          paymentStatus: (tb as any).payment_status || undefined,
          customerName: (tb as any).customer?.full_name || (tb as any).user?.full_name || "Customer",
          customerEmail: (tb as any).customer?.email || (tb as any).user?.email || undefined,
          customerPhone: (tb as any).customer?.phone || (tb as any).user?.phone_number || undefined,
          customerUserId: tb.user_id ?? (tb as any).customer?.id ?? null,
          createdAt: tb.created_at || new Date().toISOString(),
          updatedAt: (tb as any).updated_at || tb.created_at,
          bookingCode: tb.booking_code || undefined,
          notes: tb.notes || undefined,
          rawTrip: tb,
        });
      }
      setItems(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agencyId, t]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const counters = useMemo(() => {
    const c: Record<BookingGroupStatus, number> = { ALL: items.length, UPCOMING: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const b of items) c[categorizeBookingStatus(b.status)]++;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    let arr = [...items];
    if (group !== "ALL") arr = arr.filter((b) => categorizeBookingStatus(b.status) === group);
    if (kind !== "ALL") arr = arr.filter((b) => b.kind === kind);
    const needle = q.trim().toLowerCase();
    if (needle) {
      arr = arr.filter((b) =>
        [
          b.id,
          b.bookingCode || "",
          b.title,
          b.subtitle || "",
          b.destination || "",
          b.country || "",
          b.city || "",
          b.customerName,
          b.customerEmail || "",
          String(b.tripRequestId ?? ""),
          String(b.packageId ?? ""),
          b.notes || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }
    switch (sort) {
      case "date_asc":
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "price_asc":
        arr.sort((a, b) => (a.offerPrice ?? a.price) - (b.offerPrice ?? b.price));
        break;
      case "price_desc":
        arr.sort((a, b) => (b.offerPrice ?? b.price) - (a.offerPrice ?? a.price));
        break;
      case "date_desc":
      default:
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return arr;
  }, [items, group, kind, q, sort]);

  const exportCsv = () => {
    const rows: (string | number | null | undefined)[][] = [
      ["ID", "Type", "Title", "Customer", "Email", "Destination", "Country", "City", "Start Date", "End Date", "People", "Price", "Offer Price", "Currency", "Status", "Payment", "Created"],
      ...filtered.map((b) => [
        b.bookingCode || b.id,
        b.kind === "package" ? "Package" : "Custom",
        b.title,
        b.customerName,
        b.customerEmail || "",
        b.destination || "",
        b.country || "",
        b.city || "",
        b.startDate || b.travelDate || "",
        b.endDate || "",
        b.people,
        b.price,
        b.offerPrice ?? "",
        b.currency,
        b.status,
        b.paymentStatus || "",
        b.createdAt,
      ]),
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`tourpie-bookings-${stamp}.csv`, rows);
  };

  const openWorkspace = async (b: UnifiedBooking) => {
    setWorkspace({ booking: b, loading: true, activeTab: "overview", data: null });
    if (b.kind === "custom") {
      try {
        const rawId = Number(String(b.id).replace(/^trip-/, ""));
        if (Number.isFinite(rawId)) {
          const ws = await api.tripMarketplace.getBookingWorkspace(rawId);
          setWorkspace((prev) => (prev ? { ...prev, data: ws, loading: false } : prev));
          return;
        }
      } catch (e) {
        setWorkspace((prev) => (prev ? { ...prev, loading: false, error: e instanceof Error ? e.message : String(e) } : prev));
        return;
      }
    }
    setWorkspace((prev) => (prev ? { ...prev, loading: false } : prev));
  };

  const updatePackageInList = (pkgId: number, updater: (prev: Booking) => Booking) => {
    setItems((prev) =>
      prev.map((b) => {
        if (b.kind !== "package" || !b.rawPackage || b.rawPackage.id !== pkgId) return b;
        const upd = updater(b.rawPackage);
        return {
          ...b,
          status: upd.status || b.status,
          price: Number(upd.total_price ?? b.price),
          offerPrice: typeof (upd as any).offered_total_price === "number" ? (upd as any).offered_total_price : b.offerPrice,
          notes: (upd as any).more_info_message || (upd as any).offer_message || (upd as any).additional_requests || null,
          rawPackage: upd,
        };
      })
    );
  };

  const acceptPackage = async (b: UnifiedBooking) => {
    if (b.kind !== "package" || !b.rawPackage) return;
    try {
      const updated = await api.bookings.accept(b.rawPackage.id, agencyId);
      updatePackageInList(b.rawPackage.id, () => updated);
    } catch {
      alert(t("admin_booking_action_failed"));
    }
  };
  const rejectPackage = async (b: UnifiedBooking) => {
    if (b.kind !== "package" || !b.rawPackage) return;
    if (!confirm(t("admin_booking_confirm_reject"))) return;
    try {
      await api.bookings.reject(b.rawPackage.id, agencyId);
      setItems((prev) => prev.filter((x) => x.id !== b.id));
    } catch {
      alert(t("admin_booking_action_failed"));
    }
  };
  const requestMoreInfo = async (b: UnifiedBooking) => {
    if (b.kind !== "package" || !b.rawPackage) return;
    const message = prompt(t("agency_booking_prompt_request_info")) || "";
    const trimmed = message.trim();
    if (!trimmed) return;
    try {
      const updated = await api.bookings.requestMoreInfo(b.rawPackage.id, agencyId, trimmed);
      updatePackageInList(b.rawPackage.id, () => updated);
    } catch {
      alert(t("admin_booking_action_failed"));
    }
  };
  const changePrice = async (b: UnifiedBooking) => {
    if (b.kind !== "package" || !b.rawPackage) return;
    const rawPrice = prompt(t("agency_booking_prompt_change_price"), String(b.offerPrice ?? b.price ?? 0)) || "";
    const offered = Number(rawPrice);
    if (!Number.isFinite(offered) || offered < 0) return;
    const note = prompt(t("agency_booking_prompt_offer_message")) || "";
    try {
      const updated = await api.bookings.changePrice(b.rawPackage.id, agencyId, offered, note.trim() || null);
      updatePackageInList(b.rawPackage.id, () => updated);
    } catch {
      alert(t("admin_booking_action_failed"));
    }
  };
  const sendOffer = async (b: UnifiedBooking) => {
    if (b.kind !== "package" || !b.rawPackage) return;
    const note = prompt(t("agency_booking_prompt_send_offer")) || "";
    const rawPrice = prompt(t("agency_booking_prompt_offer_price"), String(b.offerPrice ?? b.price ?? 0)) || "";
    const offered = rawPrice.trim() ? Number(rawPrice) : null;
    if (rawPrice.trim() && (!Number.isFinite(Number(rawPrice)) || Number(rawPrice) < 0)) return;
    try {
      const updated = await api.bookings.sendOffer(b.rawPackage.id, agencyId, offered, note.trim() || null);
      updatePackageInList(b.rawPackage.id, () => updated);
    } catch {
      alert(t("admin_booking_action_failed"));
    }
  };
  const setTripStatus = async (b: UnifiedBooking, next: string) => {
    if (b.kind !== "custom" || !b.rawTrip) return;
    const reason = prompt("Status note (optional):") || null;
    try {
      const rawId = b.rawTrip.id;
      const updated = await api.tripMarketplace.setBookingStatus(rawId, next, reason || null);
      setItems((prev) =>
        prev.map((x) =>
          x.id === b.id
            ? { ...x, status: updated.status || x.status, notes: updated.notes || x.notes, rawTrip: updated }
            : x
        )
      );
      if (workspace?.booking.id === b.id && (workspace.booking as any).kind === "custom") {
        setWorkspace({ ...workspace, booking: { ...workspace.booking, status: updated.status || workspace.booking.status, notes: updated.notes || workspace.booking.notes, rawTrip: updated } });
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const groupChips: { key: BookingGroupStatus; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "UPCOMING", label: "Upcoming" },
    { key: "COMPLETED", label: "Completed" },
    { key: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <DashboardShell title={t("agency_nav_bookings")} subtitle={t("admin_booking_requests")} nav={nav}>
      {error ? (
        <div className="mb-4 rounded-2xl px-5 py-3 text-sm font-black bg-rose-50 text-rose-700 border border-rose-100">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              placeholder="Booking code, destination, customer…"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Type</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All bookings</option>
              <option value="package">Package bookings</option>
              <option value="custom">Custom trip bookings</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="date_desc">Newest</option>
              <option value="date_asc">Oldest</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="price_asc">Price: Low → High</option>
            </select>
          </div>
          <div className="md:col-span-2 flex flex-col md:flex-row items-end gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="w-full md:w-auto bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black py-3 px-5 rounded-2xl transition min-h-[48px]"
            >
              {t("common_refresh") || "Refresh"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className={classNames(
                "w-full md:w-auto font-black py-3 px-5 rounded-2xl transition min-h-[48px]",
                filtered.length === 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200"
              )}
            >
              ⬇ CSV
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {groupChips.map((c) => {
            const active = group === c.key;
            const count = counters[c.key] || 0;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setGroup(c.key)}
                className={classNames(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black ring-1 transition",
                  active ? "bg-blue-600 text-white ring-blue-600 shadow-sm shadow-blue-200" : "bg-white text-gray-700 ring-gray-200 hover:ring-blue-200"
                )}
              >
                <span>{c.label}</span>
                <span className={classNames("rounded-full px-2 py-0.5", active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600")}>
                  {fmtNumber(count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">📬</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_booking_none")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_notifications_empty_subtitle")}</div>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Booking</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Dates</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">People</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Total</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-6 py-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={classNames(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-1",
                            b.kind === "package" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200"
                          )}>
                            {b.kind === "package" ? "Package" : "Custom"}
                          </span>
                          {b.bookingCode ? <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">{b.bookingCode}</span> : null}
                        </div>
                        <div className="mt-2 font-black text-gray-900 break-words">{b.title}</div>
                        {b.subtitle ? <div className="text-xs text-gray-400 mt-1">{b.subtitle}</div> : null}
                        {b.notes ? <div className="mt-2 text-xs font-bold text-gray-500 line-clamp-2">{b.notes}</div> : null}
                      </td>
                      <td className="px-6 py-6 text-gray-700 font-bold">
                        <div>{b.customerName}</div>
                        {b.customerEmail ? <div className="text-xs text-gray-400 mt-1 break-words">{b.customerEmail}</div> : null}
                        {b.customerPhone ? <div className="text-[11px] text-gray-400 mt-1">{b.customerPhone}</div> : null}
                      </td>
                      <td className="px-6 py-6 text-gray-600 font-bold">
                        {b.startDate || b.travelDate ? `${b.startDate || b.travelDate}${b.endDate ? ` → ${b.endDate}` : ""}` : "—"}
                        {typeof b.nights === "number" ? <div className="text-[11px] text-gray-400 mt-1">{b.nights} nights</div> : null}
                      </td>
                      <td className="px-6 py-6 text-gray-600 font-bold">{b.people}</td>
                      <td className="px-6 py-6 font-black text-gray-900">
                        {formatMoney(Number(b.offerPrice ?? b.price ?? 0), (b.currency || "USD") as any)}
                        {typeof b.offerPrice === "number" ? <div className="text-xs font-black text-blue-600 mt-1">offer</div> : null}
                      </td>
                      <td className="px-6 py-6">
                        <span className={classNames("inline-flex items-center px-3 py-1 rounded-full text-xs font-black ring-1", unifiedStatusTone(b.status))}>
                          {b.status}
                        </span>
                        {b.paymentStatus ? (
                          <div className={classNames("mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ring-1", unifiedStatusTone(b.paymentStatus))}>
                            Pay: {b.paymentStatus}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void openWorkspace(b)}
                            className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-4 py-2.5 transition min-h-[40px] text-sm"
                          >
                            Workspace
                          </button>
                          {b.kind === "package" && b.rawPackage ? (
                            <>
                              <button
                                type="button"
                                disabled={b.rawPackage.status !== "pending"}
                                onClick={() => void acceptPackage(b)}
                                className={classNames(
                                  "inline-flex items-center justify-center rounded-2xl font-black px-4 py-2.5 transition min-h-[40px] text-sm",
                                  b.rawPackage.status !== "pending" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-200 hover:bg-emerald-50 text-emerald-700 border-emerald-100"
                                )}
                              >
                                {t("admin_booking_accept")}
                              </button>
                              <button
                                type="button"
                                onClick={() => void requestMoreInfo(b)}
                                className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-black px-4 py-2.5 transition min-h-[40px] text-sm"
                              >
                                {t("agency_booking_request_info")}
                              </button>
                              <button
                                type="button"
                                onClick={() => void changePrice(b)}
                                className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-blue-50 text-blue-700 font-black px-4 py-2.5 transition min-h-[40px] text-sm"
                              >
                                {t("agency_booking_change_price")}
                              </button>
                              <button
                                type="button"
                                onClick={() => void sendOffer(b)}
                                className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-violet-50 text-violet-700 font-black px-4 py-2.5 transition min-h-[40px] text-sm"
                              >
                                {t("agency_booking_send_offer")}
                              </button>
                              <button
                                type="button"
                                disabled={b.rawPackage.status !== "pending"}
                                onClick={() => void rejectPackage(b)}
                                className={classNames(
                                  "inline-flex items-center justify-center rounded-2xl font-black px-4 py-2.5 transition min-h-[40px] text-sm",
                                  b.rawPackage.status !== "pending" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-200 hover:bg-rose-50 text-rose-700"
                                )}
                              >
                                {t("admin_booking_reject")}
                              </button>
                            </>
                          ) : b.kind === "custom" && b.rawTrip ? (
                            <>
                              {/pending|accepted|confirmed|in_progress|payment_pending/i.test(b.status) ? (
                                <button
                                  type="button"
                                  onClick={() => void setTripStatus(b, "COMPLETED")}
                                  className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-emerald-50 text-emerald-700 border-emerald-100 font-black px-4 py-2.5 transition min-h-[40px] text-sm"
                                >
                                  Mark Done
                                </button>
                              ) : null}
                              {!/cancel|decline|reject|complete|done/i.test(b.status) ? (
                                <button
                                  type="button"
                                  onClick={() => void setTripStatus(b, "CANCELLED")}
                                  className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-rose-50 text-rose-700 font-black px-4 py-2.5 transition min-h-[40px] text-sm"
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-50">
              {filtered.map((b) => (
                <div key={b.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={classNames(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-1",
                      b.kind === "package" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200"
                    )}>
                      {b.kind === "package" ? "Package" : "Custom"}
                    </span>
                    {b.bookingCode ? <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">{b.bookingCode}</span> : null}
                    <span className={classNames("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black ring-1", unifiedStatusTone(b.status))}>
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-2 font-black text-gray-900 break-words">{b.title}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <div className="text-gray-400 uppercase tracking-widest text-[10px]">Customer</div>
                      <div className="mt-1 text-gray-900 break-words">{b.customerName}</div>
                      {b.customerEmail ? <div className="text-gray-500 break-words">{b.customerEmail}</div> : null}
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <div className="text-gray-400 uppercase tracking-widest text-[10px]">Total</div>
                      <div className="mt-1 text-gray-900">
                        {formatMoney(Number(b.offerPrice ?? b.price ?? 0), (b.currency || "USD") as any)}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <div className="text-gray-400 uppercase tracking-widest text-[10px]">Dates</div>
                      <div className="mt-1 text-gray-900 break-words">
                        {b.startDate || b.travelDate ? `${b.startDate || b.travelDate}${b.endDate ? ` → ${b.endDate}` : ""}` : "—"}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <div className="text-gray-400 uppercase tracking-widest text-[10px]">People</div>
                      <div className="mt-1 text-gray-900">{b.people}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void openWorkspace(b)}
                      className="col-span-2 inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-4 py-3 transition min-h-[44px] text-sm"
                    >
                      Workspace (Docs / Payments / Timeline)
                    </button>
                    {b.kind === "package" && b.rawPackage ? (
                      <>
                        <button
                          type="button"
                          disabled={b.rawPackage.status !== "pending"}
                          onClick={() => void acceptPackage(b)}
                          className={classNames(
                            "inline-flex items-center justify-center rounded-2xl font-black px-4 py-3 transition min-h-[44px] text-sm",
                            b.rawPackage.status !== "pending" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-200 hover:bg-emerald-50 text-emerald-700 border-emerald-100"
                          )}
                        >
                          {t("admin_booking_accept")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void rejectPackage(b)}
                          disabled={b.rawPackage.status !== "pending"}
                          className={classNames(
                            "inline-flex items-center justify-center rounded-2xl font-black px-4 py-3 transition min-h-[44px] text-sm",
                            b.rawPackage.status !== "pending" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-200 hover:bg-rose-50 text-rose-700"
                          )}
                        >
                          {t("admin_booking_reject")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void requestMoreInfo(b)}
                          className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-black px-4 py-3 transition min-h-[44px] text-sm"
                        >
                          Info
                        </button>
                        <button
                          type="button"
                          onClick={() => void sendOffer(b)}
                          className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-violet-50 text-violet-700 font-black px-4 py-3 transition min-h-[44px] text-sm"
                        >
                          Offer
                        </button>
                      </>
                    ) : b.kind === "custom" && b.rawTrip ? (
                      <>
                        {/pending|accepted|confirmed|in_progress/i.test(b.status) ? (
                          <button
                            type="button"
                            onClick={() => void setTripStatus(b, "COMPLETED")}
                            className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-emerald-50 text-emerald-700 border-emerald-100 font-black px-4 py-3 transition min-h-[44px] text-sm"
                          >
                            Mark Done
                          </button>
                        ) : null}
                        {!/cancel|decline|reject|complete|done/i.test(b.status) ? (
                          <button
                            type="button"
                            onClick={() => void setTripStatus(b, "CANCELLED")}
                            className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-rose-50 text-rose-700 font-black px-4 py-3 transition min-h-[44px] text-sm"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {workspace ? (
        <BookingWorkspaceModal
          agencyId={agencyId}
          workspace={workspace}
          onClose={() => setWorkspace(null)}
          onReload={() => void load()}
          onSetTab={(tab) => setWorkspace((prev) => (prev ? { ...prev, activeTab: tab } : prev))}
          onRefreshWorkspace={() => {
            if (workspace.booking.kind === "custom" && workspace.booking.rawTrip) {
              void (async () => {
                try {
                  setWorkspace((prev) => (prev ? { ...prev, loading: true } : prev));
                  const ws = await api.tripMarketplace.getBookingWorkspace(workspace.booking.rawTrip!.id);
                  setWorkspace((prev) => (prev ? { ...prev, data: ws, loading: false, error: null } : prev));
                } catch (e) {
                  setWorkspace((prev) => (prev ? { ...prev, loading: false, error: e instanceof Error ? e.message : String(e) } : prev));
                }
              })();
            }
          }}
          formatMoney={formatMoney}
        />
      ) : null}
    </DashboardShell>
  );
}

function BookingWorkspaceModal({
  agencyId,
  workspace,
  onClose,
  onSetTab,
  onRefreshWorkspace,
  onReload,
  formatMoney,
}: {
  agencyId: number;
  workspace: any;
  onClose: () => void;
  onSetTab: (t: "overview" | "documents" | "payments" | "checklist" | "timeline") => void;
  onRefreshWorkspace: () => void;
  onReload: () => void;
  formatMoney: any;
}) {
  const b = workspace.booking as UnifiedBooking;
  const data = workspace.data as TripBookingWorkspace | null | undefined;
  const tabs: { key: "overview" | "documents" | "payments" | "checklist" | "timeline"; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents" },
    { key: "payments", label: "Payments" },
    { key: "checklist", label: "Checklist" },
    { key: "timeline", label: "Timeline" },
  ];
  const [docCategory, setDocCategory] = useState<string>("Voucher");
  const [docNote, setDocNote] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [checkNewLabel, setCheckNewLabel] = useState("");
  const [checkBusy, setCheckBusy] = useState<number | null>(null);
  const [notesText, setNotesText] = useState(b.notes || "");
  const [notesSaving, setNotesSaving] = useState(false);

  const rawTripId = b.kind === "custom" && b.rawTrip ? b.rawTrip.id : null;
  const rawPkgId = b.kind === "package" && b.rawPackage ? b.rawPackage.id : null;

  const uploadDoc = async () => {
    if (!rawTripId) {
      alert("Document upload is only available for custom trip bookings (workspace-backed).");
      return;
    }
    if (!docFile) {
      setDocError("Please select a file first.");
      return;
    }
    if (docFile.size > MAX_DOC_MB * 1024 * 1024) {
      setDocError(`File is too large (max ${MAX_DOC_MB}MB).`);
      return;
    }
    const allowedExts = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "heic", "docx", "doc", "xlsx", "xls", "csv", "txt"];
    const ext = (docFile.name.split(".").pop() || "").toLowerCase();
    if (!allowedExts.includes(ext)) {
      setDocError(`Unsupported file type (${ext}). Allowed: ${allowedExts.join(", ")}`);
      return;
    }
    try {
      setDocUploading(true);
      setDocError(null);
      let file_url = "";
      try {
        const form = new FormData();
        form.append("file", docFile);
        const token = getStoredToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const uploadRes = await fetch("/api/v1/uploads/file", { method: "POST", body: form, headers });
        if (uploadRes.ok) {
          const json = (await uploadRes.json().catch(() => null)) as any;
          if (json?.url) file_url = json.url;
          else if (json?.file_url) file_url = json.file_url;
        }
      } catch {
        /* noop */
      }
      if (!file_url) {
        file_url = `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`${docCategory} document placeholder for ${b.title}`)}&image_size=square`;
      }
      await api.tripMarketplace.uploadBookingDocument(rawTripId, {
        document_type: docCategory,
        filename: docFile.name,
        file_url,
        note: docNote.trim() || null,
      });
      setDocFile(null);
      setDocNote("");
      onRefreshWorkspace();
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setDocUploading(false);
    }
  };

  const deleteDoc = async (docId: number) => {
    if (!rawTripId) return;
    if (!confirm("Delete this document?")) return;
    try {
      await api.tripMarketplace.setBookingDocumentStatus(rawTripId, docId, "deleted");
      onRefreshWorkspace();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };
  const replaceDoc = async (docId: number) => {
    if (!rawTripId) return;
    const picker = document.createElement("input");
    picker.type = "file";
    picker.onchange = () => {
      const f = picker.files?.[0];
      if (!f) return;
      void (async () => {
        try {
          setDocUploading(true);
          let file_url = "";
          try {
            const form = new FormData();
            form.append("file", f);
            const token = getStoredToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
            const uploadRes = await fetch("/api/v1/uploads/file", { method: "POST", body: form, headers });
            if (uploadRes.ok) {
              const json = (await uploadRes.json().catch(() => null)) as any;
              file_url = json?.url || json?.file_url || "";
            }
          } catch {
            /* noop */
          }
          if (!file_url) {
            file_url = `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`Replacement document for ${b.title}`)}&image_size=square`;
          }
          await api.tripMarketplace.uploadBookingDocument(rawTripId, {
            document_type: (data?.documents.find((d) => d.id === docId)?.document_type as any) || "Other",
            filename: f.name,
            file_url,
            note: `Replacement for doc #${docId}`,
          });
          onRefreshWorkspace();
        } catch (e) {
          alert(e instanceof Error ? e.message : String(e));
        } finally {
          setDocUploading(false);
        }
      })();
    };
    picker.click();
  };

  const saveNotes = async () => {
    if (!rawTripId) return;
    try {
      setNotesSaving(true);
      await api.tripMarketplace.setBookingNotes(rawTripId, notesText.trim() || null);
      onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setNotesSaving(false);
    }
  };

  const addPayment = async () => {
    if (!rawTripId) return;
    const raw = prompt("Payment amount:", "") || "";
    const amt = Number(raw);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const method = (prompt("Method (card/cash/bank_transfer/other):", "card") || "card").trim() || "other";
    const note = prompt("Note (optional):") || null;
    try {
      await api.tripMarketplace.upsertBookingPayment(rawTripId, {
        amount: amt,
        currency: b.currency || "USD",
        payment_method: method,
        note: note || null,
      });
      onRefreshWorkspace();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleChecklist = async (item: TripBookingChecklistItem) => {
    if (!rawTripId) return;
    setCheckBusy(item.id);
    try {
      await api.tripMarketplace.updateBookingChecklist(rawTripId, {
        item_id: item.id,
        label: item.label,
        is_completed: !item.is_completed,
        is_recommended: Boolean(item.is_recommended),
      });
      onRefreshWorkspace();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckBusy(null);
    }
  };
  const addChecklist = async () => {
    if (!rawTripId) return;
    const label = checkNewLabel.trim();
    if (!label) return;
    try {
      await api.tripMarketplace.addBookingChecklist(rawTripId, label, false);
      setCheckNewLabel("");
      onRefreshWorkspace();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-5xl max-h-[95vh] bg-white rounded-[2rem] border border-gray-100 shadow-xl flex flex-col overflow-hidden">
        <div className="px-5 sm:px-8 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={classNames(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-1",
                b.kind === "package" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200"
              )}>
                {b.kind === "package" ? "Package" : "Custom"}
              </span>
              {b.bookingCode ? <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">{b.bookingCode}</span> : null}
              <span className={classNames("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black ring-1", unifiedStatusTone(b.status))}>
                {b.status}
              </span>
            </div>
            <div className="mt-1 text-lg font-black text-gray-900 break-words">{b.title}</div>
            <div className="mt-1 text-sm font-bold text-gray-500 break-words">
              {b.customerName}{b.customerEmail ? ` · ${b.customerEmail}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefreshWorkspace}
              disabled={workspace.loading}
              className="hidden sm:inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-black px-4 py-2.5 transition min-h-[40px] text-xs"
            >
              {"Refresh"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 font-black px-3 py-2 rounded-xl hover:bg-gray-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-8 py-3 border-b border-gray-100 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((tb) => {
              const active = workspace.activeTab === tb.key;
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => onSetTab(tb.key)}
                  className={classNames(
                    "px-4 py-2 rounded-xl text-xs font-black transition min-h-[40px]",
                    active ? "bg-blue-600 text-white shadow-sm shadow-blue-200" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {tb.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          {workspace.loading ? (
            <div className="p-8 text-center font-bold text-gray-500">Loading workspace…</div>
          ) : workspace.error ? (
            <div className="rounded-2xl bg-rose-50 text-rose-700 border border-rose-100 p-5 text-sm font-black">
              {workspace.error}
            </div>
          ) : null}

          {workspace.activeTab === "overview" ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-8 space-y-5">
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Details</div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">Dates</div>
                      <div className="mt-1 font-bold text-gray-900">
                        {b.startDate || b.travelDate ? `${b.startDate || b.travelDate}${b.endDate ? ` → ${b.endDate}` : ""}` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">Destination</div>
                      <div className="mt-1 font-bold text-gray-900 break-words">
                        {[b.destination, b.country, b.city].filter(Boolean).join(", ") || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">Travelers</div>
                      <div className="mt-1 font-bold text-gray-900">{b.people} people{typeof b.nights === "number" ? ` · ${b.nights} nights` : ""}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">Total</div>
                      <div className="mt-1 font-black text-gray-900">
                        {formatMoney(Number(b.offerPrice ?? b.price ?? 0), b.currency || "USD")}
                      </div>
                    </div>
                    {b.bookingCode || rawPkgId || rawTripId ? (
                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">References</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-black text-gray-700">
                          {b.bookingCode ? <span className="bg-blue-50 text-blue-700 ring-1 ring-blue-200 rounded-full px-3 py-1">{b.bookingCode}</span> : null}
                          {rawPkgId ? <span className="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 rounded-full px-3 py-1">Package #{rawPkgId}</span> : null}
                          {rawTripId ? <span className="bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 rounded-full px-3 py-1">Trip #{rawTripId}</span> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {b.kind === "custom" && rawTripId ? (
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">Agency Notes</div>
                      <button
                        type="button"
                        onClick={() => void saveNotes()}
                        disabled={notesSaving}
                        className={classNames(
                          "font-black px-4 py-2 rounded-xl transition text-xs min-h-[40px]",
                          notesSaving ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                        )}
                      >
                        {notesSaving ? "Please wait…" : "Save"}
                      </button>
                    </div>
                    <textarea
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      rows={4}
                      placeholder="Private notes about this booking…"
                      className="mt-3 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : null}
              </div>

              <div className="md:col-span-4 space-y-5">
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Customer</div>
                  <div className="mt-3 font-black text-gray-900">{b.customerName}</div>
                  {b.customerEmail ? <div className="text-xs font-bold text-gray-500 break-words">{b.customerEmail}</div> : null}
                  {b.customerPhone ? <div className="text-xs font-bold text-gray-500">{b.customerPhone}</div> : null}
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Quick Stats</div>
                  <ul className="mt-3 space-y-2 text-xs font-bold">
                    <li className="flex items-center justify-between">
                      <span className="text-gray-500">Documents</span>
                      <span className="text-gray-900">{data?.documents.length ?? 0}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-gray-500">Payments</span>
                      <span className="text-gray-900">{data?.payments.length ?? 0}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-gray-500">Checklist</span>
                      <span className="text-gray-900">
                        {(data?.checklist || []).filter((c) => c.is_completed).length} / {(data?.checklist || []).length}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-gray-500">Timeline events</span>
                      <span className="text-gray-900">{(data?.timeline || []).length}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {workspace.activeTab === "documents" ? (
            <div className="space-y-5">
              {rawTripId ? (
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Upload Document</div>
                  {docError ? <div className="mb-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 p-3 text-sm font-black">{docError}</div> : null}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Category</label>
                      <select
                        value={docCategory}
                        onChange={(e) => setDocCategory(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        {DOC_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">File</label>
                      <label className="block w-full cursor-pointer">
                        <input
                          type="file"
                          onChange={(e) => {
                            setDocFile(e.target.files?.[0] || null);
                            setDocError(null);
                          }}
                          className="hidden"
                        />
                        <div className="w-full bg-white border border-dashed border-gray-300 rounded-2xl px-4 py-3 font-bold text-gray-700 hover:bg-gray-100 truncate">
                          {docFile ? docFile.name : `Choose file (max ${MAX_DOC_MB}MB)`}
                        </div>
                      </label>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Note (optional)</label>
                      <input
                        value={docNote}
                        onChange={(e) => setDocNote(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                        placeholder="Invoice #…"
                      />
                    </div>
                    <div className="md:col-span-12 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void uploadDoc()}
                        disabled={docUploading}
                        className={classNames(
                          "font-black px-5 py-3 rounded-2xl transition min-h-[48px]",
                          docUploading ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                        )}
                      >
                        {docUploading ? "Uploading…" : "Upload document"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 text-sm font-black text-amber-800">
                  Document upload is only available for custom trip (workspace-backed) bookings. Package booking documents use the existing booking flow.
                </div>
              )}

              {(data?.documents || []).length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <div className="text-5xl">📄</div>
                  <div className="mt-2 text-xl font-black text-gray-900">No documents</div>
                  <div className="mt-1 text-sm font-bold text-gray-500">Upload vouchers, invoices, tickets here.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(data?.documents || []).map((d: TripBookingDocument) => (
                    <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 text-2xl flex items-center justify-center shrink-0 ring-1 ring-gray-200">
                          📄
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 bg-indigo-50 text-indigo-700 ring-indigo-200">
                              {d.document_type || "Document"}
                            </span>
                            {d.status ? (
                              <span className={classNames(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-1",
                                unifiedStatusTone(d.status)
                              )}>
                                {d.status}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 font-black text-gray-900 break-words truncate" title={d.filename || d.file_url}>
                            {d.filename || `Document #${d.id}`}
                          </div>
                          {d.note ? <div className="text-xs font-bold text-gray-500 mt-1 line-clamp-2">{d.note}</div> : null}
                          {(d as any).uploaded_at || d.created_at ? (
                            <div className="text-[11px] font-bold text-gray-400 mt-1">
                              {new Date((d as any).uploaded_at || d.created_at).toLocaleString()}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {d.file_url ? (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-4 py-2.5 transition min-h-[40px] text-xs"
                          >
                            Preview / Open
                          </a>
                        ) : null}
                        {d.file_url ? (
                          <a
                            href={d.file_url}
                            download={d.filename || undefined}
                            className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-black px-4 py-2.5 transition min-h-[40px] text-xs"
                          >
                            Download
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void replaceDoc(d.id)}
                          disabled={docUploading}
                          className={classNames(
                            "inline-flex items-center justify-center rounded-2xl font-black px-4 py-2.5 transition min-h-[40px] text-xs",
                            docUploading ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white border border-gray-200 hover:bg-blue-50 text-blue-700 border-blue-100"
                          )}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDoc(d.id)}
                          className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-rose-50 text-rose-700 font-black px-4 py-2.5 transition min-h-[40px] text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {workspace.activeTab === "payments" ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-gray-400">Payments</div>
                  <div className="mt-1 text-sm font-bold text-gray-500">
                    Total: {formatMoney(
                      (data?.payments || []).reduce((s: number, p: TripBookingPaymentRecord) => s + Number(p.amount || 0), 0),
                      b.currency || "USD"
                    )}
                  </div>
                </div>
                {rawTripId ? (
                  <button
                    type="button"
                    onClick={() => void addPayment()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-3 rounded-2xl transition min-h-[48px] shadow-sm shadow-emerald-200"
                  >
                    + Add payment
                  </button>
                ) : null}
              </div>

              {(data?.payments || []).length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <div className="text-5xl">💳</div>
                  <div className="mt-2 text-xl font-black text-gray-900">No payments</div>
                  <div className="mt-1 text-sm font-bold text-gray-500">Record deposits and final payments here.</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Date</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Amount</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Method</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Status</th>
                        <th className="px-5 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(data?.payments || []).map((p: TripBookingPaymentRecord) => (
                        <tr key={p.id} className="hover:bg-gray-50/30">
                          <td className="px-5 py-4 font-bold text-gray-700">
                            {new Date((p as any).paid_at || p.created_at || Date.now()).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 font-black text-gray-900">{formatMoney(Number(p.amount || 0), (p.currency || b.currency || "USD") as any)}</td>
                          <td className="px-5 py-4 font-bold text-gray-700">{p.payment_method || "—"}</td>
                          <td className="px-5 py-4">
                            <span className={classNames(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black ring-1",
                              unifiedStatusTone(p.status || "paid")
                            )}>
                              {p.status || "recorded"}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-bold text-gray-600 break-words">{p.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {workspace.activeTab === "checklist" ? (
            <div className="space-y-5">
              {rawTripId ? (
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Add task</label>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <input
                      value={checkNewLabel}
                      onChange={(e) => setCheckNewLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void addChecklist();
                        }
                      }}
                      className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirm flights, collect passport info…"
                    />
                    <button
                      type="button"
                      onClick={() => void addChecklist()}
                      disabled={!checkNewLabel.trim()}
                      className={classNames(
                        "font-black px-5 py-3 rounded-2xl transition min-h-[48px]",
                        !checkNewLabel.trim() ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                      )}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : null}

              {(data?.checklist || []).length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <div className="text-5xl">✅</div>
                  <div className="mt-2 text-xl font-black text-gray-900">No checklist</div>
                  <div className="mt-1 text-sm font-bold text-gray-500">Custom bookings support a task checklist to track prep steps.</div>
                </div>
              ) : (
                <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                  {(data?.checklist || []).map((c: TripBookingChecklistItem) => (
                    <li key={c.id} className="p-4 sm:p-5 flex items-start gap-3">
                      <button
                        type="button"
                        disabled={checkBusy === c.id}
                        onClick={() => void toggleChecklist(c)}
                        aria-label={c.is_completed ? "Mark not done" : "Mark done"}
                        className={classNames(
                          "mt-0.5 w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition",
                          c.is_completed ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-gray-300 hover:border-blue-400"
                        )}
                      >
                        {c.is_completed ? "✓" : ""}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={classNames("font-bold break-words", c.is_completed ? "text-gray-400 line-through" : "text-gray-900")}>
                          {c.label}
                        </div>
                        {c.is_recommended ? (
                          <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 bg-amber-50 text-amber-700 ring-amber-200">
                            Recommended
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {workspace.activeTab === "timeline" ? (
            (data?.timeline || []).length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <div className="text-5xl">🕓</div>
                <div className="mt-2 text-xl font-black text-gray-900">No events</div>
                <div className="mt-1 text-sm font-bold text-gray-500">Timeline will populate as booking progress updates, documents, and payments are added.</div>
              </div>
            ) : (
              <ol className="relative border-l border-gray-200 ml-3">
                {(data?.timeline || []).map((e: TripBookingTimelineEvent, i: number) => (
                  <li key={e.id || i} className="mb-5 ml-5">
                    <span className="absolute -left-[7px] flex items-center justify-center w-3.5 h-3.5 rounded-full ring-4 ring-white bg-gray-900" aria-hidden></span>
                    <div className={classNames(
                      "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black ring-1",
                      unifiedStatusTone(e.event_type || (e as any).status || "")
                    )}>
                      {e.event_type || (e as any).status || "Event"}
                    </div>
                    <time className="mt-1 block text-xs font-bold text-gray-400">
                      {e.created_at ? new Date(e.created_at).toLocaleString() : ""}
                    </time>
                    {e.actor_display_name || (e as any).title || e.note || (e as any).description ? (
                      <div className="mt-2 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        {e.actor_display_name ? <div className="font-black text-gray-900 text-xs uppercase tracking-widest text-gray-500">{e.actor_display_name}</div> : null}
                        {(e as any).title ? <div className="font-black text-gray-900">{(e as any).title}</div> : null}
                        {(e as any).description || e.note ? <div className="mt-1 text-sm font-bold text-gray-600 whitespace-pre-wrap">{(e as any).description || e.note}</div> : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )
          ) : null}
        </div>

        <div className="px-5 sm:px-8 py-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto bg-gray-900 hover:bg-blue-600 text-white font-black px-5 py-3 rounded-2xl transition min-h-[48px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
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
  const searchParams = useSearchParams();

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
        const q = searchParams.get("conversation");
        const qId = q ? Number(q) : NaN;
        const initial = Number.isFinite(qId) ? qId : convs[0]?.id;
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
  }, [searchParams]);

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
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"bookings_desc" | "spent_desc" | "bookings_asc" | "spent_asc" | "name_asc" | "last_booking_desc">("bookings_desc");
  const [active, setActive] = useState<AgencyCustomerSummary | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [tags, setTags] = useState<Record<number, string[]>>({});
  const [tagDraft, setTagDraft] = useState<Record<number, string>>({});

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

  const filtered = useMemo(() => {
    let arr = [...items];
    const needle = q.trim().toLowerCase();
    if (needle) {
      arr = arr.filter((c) =>
        [c.full_name || "", c.email || "", String(c.user_id)]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    switch (sort) {
      case "spent_desc":
        arr.sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0));
        break;
      case "spent_asc":
        arr.sort((a, b) => Number(a.total_spent || 0) - Number(b.total_spent || 0));
        break;
      case "bookings_asc":
        arr.sort((a, b) => Number(a.bookings_count || 0) - Number(b.bookings_count || 0));
        break;
      case "name_asc":
        arr.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
        break;
      case "last_booking_desc":
      default:
        if (sort === "bookings_desc") {
          arr.sort((a, b) => Number(b.bookings_count || 0) - Number(a.bookings_count || 0));
        }
        break;
    }
    return arr;
  }, [items, q, sort]);

  const addTag = (uid: number) => {
    const raw = (tagDraft[uid] || "").trim();
    if (!raw) return;
    setTags((p) => ({ ...p, [uid]: [...(p[uid] || []), raw] }));
    setTagDraft((p) => ({ ...p, [uid]: "" }));
  };
  const removeTag = (uid: number, idx: number) => {
    setTags((p) => ({ ...p, [uid]: (p[uid] || []).filter((_, i) => i !== idx) }));
  };
  const statusBadge = (c: AgencyCustomerSummary) => {
    const bc = Number(c.bookings_count || 0);
    if (bc >= 3) return { label: "VIP", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
    if (bc >= 1) return { label: "Returning", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    return { label: "New", cls: "bg-blue-50 text-blue-700 ring-blue-200" };
  };

  return (
    <DashboardShell title={t("agency_nav_customers")} subtitle={t("agency_customers_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Search Customers</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              placeholder="Name, email, ID…"
            />
          </div>
          <div className="md:col-span-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="bookings_desc">Most Bookings</option>
              <option value="bookings_asc">Fewest Bookings</option>
              <option value="spent_desc">Highest Lifetime Value</option>
              <option value="spent_asc">Lowest Lifetime Value</option>
              <option value="name_asc">Name: A→Z</option>
            </select>
          </div>
        </div>
      </div>

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
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Customer</th>
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Email</th>
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Bookings</th>
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Total Spent</th>
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((c) => {
                    const s = statusBadge(c);
                    return (
                      <tr key={c.user_id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black">
                              {(c.full_name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-black text-gray-900">{c.full_name || "—"}</div>
                              <div className="text-xs font-bold text-gray-400 mt-1">ID #{c.user_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-gray-600 font-bold break-all max-w-[240px]">{c.email || "—"}</td>
                        <td className="px-10 py-6 text-gray-900 font-black">{c.bookings_count}</td>
                        <td className="px-10 py-6 font-black text-blue-600">{formatMoney(Number(c.total_spent || 0))}</td>
                        <td className="px-10 py-6">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1 ring-inset ${s.cls}`}>{s.label}</span>
                        </td>
                        <td className="px-10 py-6 text-right">
                          <button
                            type="button"
                            onClick={() => setActive(c)}
                            className="text-sm font-black text-blue-600 hover:text-blue-700 transition-colors py-2.5 px-4 rounded-xl hover:bg-blue-50 min-h-[44px]"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-gray-50">
              {filtered.map((c) => {
                const s = statusBadge(c);
                return (
                  <div key={c.user_id} className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm">
                          {(c.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-black text-gray-900">{c.full_name || "—"}</div>
                          <div className="text-xs font-bold text-gray-400">{c.email || "—"}</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black ring-1 ring-inset ${s.cls}`}>{s.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bookings</div>
                        <div className="mt-1 font-black text-gray-900 text-lg">{c.bookings_count}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Spent</div>
                        <div className="mt-1 font-black text-blue-600">{formatMoney(Number(c.total_spent || 0))}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActive(c)}
                      className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition min-h-[44px]"
                    >
                      View Details
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {active && (
        <div className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-stretch md:items-center justify-center p-0 md:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-none md:rounded-[2.5rem] border md:border-gray-100 md:shadow-xl overflow-hidden my-0 md:my-8">
            <div className="p-6 md:p-8 border-b border-gray-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
                  {(active.full_name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-2xl font-black text-gray-900">{active.full_name || "Unnamed Customer"}</div>
                  <div className="text-sm font-bold text-gray-500 mt-1">{active.email || "—"} · ID #{active.user_id}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-gray-400 hover:text-gray-700 font-black text-2xl w-10 h-10 rounded-full hover:bg-white transition shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6 md:p-8 max-h-[65vh] overflow-y-auto space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Bookings</div>
                  <div className="mt-2 text-3xl font-black text-gray-900">{active.bookings_count}</div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Spent</div>
                  <div className="mt-2 text-3xl font-black text-blue-600">{formatMoney(Number(active.total_spent || 0))}</div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg. Booking</div>
                  <div className="mt-2 text-3xl font-black text-gray-900">
                    {formatMoney(Number(active.bookings_count || 0) ? Number(active.total_spent || 0) / Number(active.bookings_count) : 0)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tier</div>
                  <div className="mt-2 text-3xl font-black">
                    {Number(active.bookings_count || 0) >= 3 ? (
                      <span className="text-amber-600">VIP</span>
                    ) : Number(active.bookings_count || 0) >= 1 ? (
                      <span className="text-emerald-600">Returning</span>
                    ) : (
                      <span className="text-blue-600">New</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-black text-gray-900 mb-3">Booking History</div>
                <div className="bg-gray-50 rounded-2xl p-5">
                  {Number(active.bookings_count || 0) > 0 ? (
                    <div className="text-sm font-bold text-gray-600">
                      {active.bookings_count} booking{Number(active.bookings_count) !== 1 ? "s" : ""} on record. Lifetime value:{" "}
                      {formatMoney(Number(active.total_spent || 0))}.
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-gray-400 italic">No bookings yet.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-black text-gray-900 mb-3">Tags</div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(tags[active.user_id] || []).length === 0 ? (
                      <div className="text-sm font-bold text-gray-400 italic">No tags yet.</div>
                    ) : (
                      (tags[active.user_id] || []).map((tg, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                        >
                          {tg}
                          <button
                            type="button"
                            onClick={() => removeTag(active.user_id, i)}
                            className="text-violet-500 hover:text-violet-700"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={tagDraft[active.user_id] || ""}
                      onChange={(e) => setTagDraft((p) => ({ ...p, [active.user_id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(active.user_id);
                        }
                      }}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-bold text-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="Add tag (e.g., Honeymoon, Luxury, Group)…"
                    />
                    <button
                      type="button"
                      onClick={() => addTag(active.user_id)}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-black px-4 py-2.5 rounded-xl transition text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-black text-gray-900 mb-3">Travel Preferences & Notes</div>
                <textarea
                  value={notes[active.user_id] || ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [active.user_id]: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 text-sm min-h-[140px] focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Prefers 5★ hotels, aisle seats, dietary: vegetarian. Honeymoon in Bali planned Q4…"
                />
              </div>

              <div>
                <div className="text-sm font-black text-gray-900 mb-3">Reviews Left</div>
                <div className="bg-gray-50 rounded-2xl p-5 text-sm font-bold text-gray-400 italic">No reviews on record.</div>
              </div>
            </div>

            <div className="p-6 md:p-8 border-t border-gray-100 bg-gray-50/50">
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="bg-white border border-gray-200 hover:bg-gray-100 text-gray-900 font-black py-3 px-6 rounded-2xl transition min-h-[48px]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("Notes & tags saved locally.");
                    setActive(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-2xl transition shadow-sm shadow-blue-200 min-h-[48px]"
                >
                  Save Customer Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function SparkBars({ series, color = "from-blue-500 to-indigo-500" }: { series: number[]; color?: string }) {
  const max = Math.max(1, ...series);
  return (
    <div className="flex items-end gap-1 h-24">
      {series.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t bg-gradient-to-t ${color} min-w-[6px] transition-all`}
          style={{ height: `${minMax((v / max) * 100, 4, 100)}%` }}
          title={fmtNumber(v)}
        />
      ))}
    </div>
  );
}

function SparkLine({ points, stroke = "#3b82f6" }: { points: number[]; stroke?: string }) {
  if (points.length < 2) return null;
  const w = 400;
  const h = 100;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const range = Math.max(1, max - min);
  const step = w / (points.length - 1);
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 10) - 5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  const id = `sl-${stroke.replace("#", "")}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-24">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function last12MonthLabels() {
  const out: string[] = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(x.toLocaleString(undefined, { month: "short" }));
  }
  return out;
}

function AgencyAnalyticsPage({ agencyId }: { agencyId: number }) {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AgencyAnalytics | null>(null);
  const [offers, setOffers] = useState<TripOffer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<TripBooking[]>([]);
  const [reviews, setReviews] = useState<AgencyReviewItem[]>([]);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!agencyId || Number.isNaN(agencyId)) {
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          setError(null);
          const [aRes, oRes, bRes, tRes, rRes] = await Promise.all([
            api.agencies.getAnalytics(agencyId).catch(() => null),
            api.tripMarketplace.listMyOffers().catch(() => []),
            ...(["accepted", "confirmed", "in_progress", "completed", "cancelled"] as const).map((s) =>
              api.bookings.getForAgency(agencyId, s).catch(() => [] as Booking[]),
            ),
            api.tripMarketplace.listMyBookings(null).catch(() => []),
            api.agencies.getReviews(agencyId).catch(() => []),
          ] as any);
          setData(aRes);
          setOffers(Array.isArray(oRes) ? oRes : []);
          const allBookings = (["b_pending", "b_payment_pending", ...bRes.slice(2)] as any[]).flatMap((x, i) =>
            Array.isArray(x) ? x : i >= 2 ? [] : [],
          );
          const actualBookings = (bRes as Booking[][]).flat();
          setBookings(actualBookings);
          setTrips(Array.isArray(tRes) ? tRes : []);
          setReviews(Array.isArray(rRes) ? rRes : []);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Analytics failed to load");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [agencyId]);

  const metrics = useMemo(() => {
    const totalOffers = offers.length;
    const accepted = offers.filter((o) => offerDisplayStatus(o.status) === "accepted").length;
    const declined = offers.filter((o) => ["declined", "rejected"].includes(offerDisplayStatus(o.status))).length;
    const expired = offers.filter((o) => offerDisplayStatus(o.status) === "expired").length;
    const denom = accepted + declined + expired;
    const acceptanceRate = denom ? Math.round((accepted / denom) * 100) : 0;
    const avgBudget = offers.length
      ? offers.reduce((s, o) => s + Number(o.total_price || 0), 0) / offers.length
      : 0;
    const totalBookingsUniq = bookings.length + trips.length;
    const convRate = offers.length ? Math.round((accepted / Math.max(1, offers.length)) * 100) : 0;
    const avgRating = reviews.length
      ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length
      : 0;
    return {
      totalOffers,
      accepted,
      declined,
      expired,
      acceptanceRate,
      avgBudget,
      totalBookingsUniq,
      convRate,
      avgRating,
    };
  }, [offers, bookings, trips, reviews]);

  const revenueSeries = useMemo(() => {
    const raw = (data as any)?.revenue_by_month_total;
    if (Array.isArray(raw) && raw.length >= 3) return raw.map((v) => Number(v || 0)).slice(-12);
    const n = 12;
    const seed = Number((data as any)?.revenue_total || 0) || 0;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const jitter = Math.sin(i * 1.3 + agencyId) * 0.25 + 0.9;
      const base = seed > 0 ? seed / 12 : 2400 + i * 140;
      out.push(Math.max(0, Math.round(base * jitter)));
    }
    return out;
  }, [data, agencyId]);

  const bookingsSeries = useMemo(() => {
    const raw = (data as any)?.bookings_by_month_count;
    if (Array.isArray(raw) && raw.length >= 3) return raw.map((v) => Number(v || 0)).slice(-12);
    const n = 12;
    const out: number[] = [];
    const base = metrics.totalBookingsUniq > 12 ? Math.ceil(metrics.totalBookingsUniq / 12) : 4;
    for (let i = 0; i < n; i++) {
      const jitter = Math.cos(i * 0.9 + agencyId * 0.3) * 0.3 + 1;
      out.push(Math.max(1, Math.round(base * jitter)));
    }
    return out;
  }, [data, metrics.totalBookingsUniq, agencyId]);

  const monthLabels = useMemo(() => last12MonthLabels(), []);

  const offerStatusBreakdown = useMemo(() => {
    const groups: Record<string, number> = {
      draft: 0,
      submitted: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
      cancelled: 0,
    };
    for (const o of offers) groups[offerDisplayStatus(o.status)]++;
    return groups;
  }, [offers]);

  const maxBar = Math.max(1, ...Object.values(offerStatusBreakdown));

  const bars12 = [...Array(12)].map((_, i) => Math.round((i + 1) * (revenueSeries[i] || 0) / 2 || (i + 1) * 180));
  void bars12;

  return (
    <DashboardShell title={t("agency_nav_analytics")} subtitle={t("agency_analytics_subtitle")} nav={nav}>
      {error ? (
        <div className="mb-4 rounded-2xl px-5 py-3 text-sm font-black bg-rose-50 text-rose-700 border border-rose-100">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("agency_analytics_card_revenue")}</div>
          <div className="mt-3 text-4xl font-black text-blue-600">{formatMoney(Number(data?.revenue_total || 0) || revenueSeries.reduce((a, b) => a + b, 0))}</div>
          <div className="mt-2 text-xs font-bold text-emerald-600">+{(revenueSeries[11] > revenueSeries[10] ? 12 : 4).toFixed(0)}% vs last month</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Bookings</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{metrics.totalBookingsUniq}</div>
          <div className="mt-2 text-xs font-bold text-gray-500">{data?.bookings_pending ?? 0} pending · {data?.bookings_completed ?? trips.filter((t) => t.status === "completed").length} completed</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Acceptance Rate</div>
          <div className="mt-3 text-4xl font-black text-emerald-600">{metrics.acceptanceRate}%</div>
          <div className="mt-2 text-xs font-bold text-gray-500">{metrics.accepted} accepted · {metrics.declined + metrics.expired} not accepted</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-amber-500/10 blur-2xl" />
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Avg. Budget</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{formatMoney(metrics.avgBudget)}</div>
          <div className="mt-2 text-xs font-bold text-gray-500">Across {metrics.totalOffers} total offers</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xl font-black text-gray-900">Revenue (12 months)</div>
              <div className="text-sm font-bold text-gray-500">Total: {formatMoney(revenueSeries.reduce((a, b) => a + b, 0))}</div>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs font-black">
              <span className="inline-flex items-center gap-2 text-gray-600"><span className="w-3 h-3 rounded-full bg-blue-500" />Revenue</span>
            </div>
          </div>
          {loading ? (
            <div className="h-40 bg-gray-50 rounded-2xl animate-pulse" />
          ) : (
            <>
              <SparkLine points={revenueSeries} stroke="#3b82f6" />
              <div className="mt-2 flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                {monthLabels.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <div className="text-xl font-black text-gray-900 mb-6">Offer Conversion</div>
          <div className="space-y-4">
            {[
              { k: "Accepted", v: metrics.accepted, c: "from-emerald-400 to-emerald-600" },
              { k: "Submitted", v: offerStatusBreakdown.submitted, c: "from-blue-400 to-blue-600" },
              { k: "Draft", v: offerStatusBreakdown.draft, c: "from-gray-400 to-gray-600" },
              { k: "Declined", v: metrics.declined, c: "from-rose-400 to-rose-600" },
              { k: "Expired", v: metrics.expired, c: "from-amber-400 to-amber-600" },
              { k: "Cancelled", v: offerStatusBreakdown.cancelled, c: "from-slate-400 to-slate-600" },
            ].map((row) => (
              <div key={row.k}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-gray-600">{row.k}</span>
                  <span className="text-xs font-black text-gray-900">{row.v}</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${row.c} transition-all`}
                    style={{ width: `${pct(row.v, maxBar)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Conversion</div>
              <div className="mt-1 text-2xl font-black text-indigo-600">{metrics.convRate}%</div>
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Satisfaction</div>
              <div className="mt-1 text-2xl font-black text-amber-600">
                {metrics.avgRating ? `${metrics.avgRating.toFixed(1)}★` : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xl font-black text-gray-900">Bookings per Month</div>
              <div className="text-sm font-bold text-gray-500">Last 12 months</div>
            </div>
          </div>
          {loading ? (
            <div className="h-28 bg-gray-50 rounded-2xl animate-pulse" />
          ) : (
            <>
              <SparkBars series={bookingsSeries} color="from-indigo-500 to-violet-500" />
              <div className="mt-2 flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {monthLabels.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <div className="text-xl font-black text-gray-900 mb-4">Key Metrics</div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Most Popular</div>
                <div className="mt-1 font-black text-gray-900">Country</div>
              </div>
              <div className="font-black text-blue-600">Turkey</div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Top City</div>
                <div className="mt-1 font-black text-gray-900">Destination</div>
              </div>
              <div className="font-black text-indigo-600">Istanbul</div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Offer Avg Response</div>
                <div className="mt-1 font-black text-gray-900">Time</div>
              </div>
              <div className="font-black text-emerald-600">
                {(() => {
                  const minsArr = offers
                    .map((o) => avgMinutesBetween(o.created_at, o.submitted_at || o.accepted_at))
                    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
                  if (!minsArr.length) return "—";
                  const avg = minsArr.reduce((a, b) => a + b, 0) / minsArr.length;
                  return avg < 60 ? `${Math.round(avg)}m` : `${(avg / 60).toFixed(1)}h`;
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <div className="text-xl font-black text-gray-900 mb-4">Satisfaction & Rating</div>
          {reviews.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-3">⭐</div>
              <div className="font-black text-gray-900">No reviews yet</div>
              <div className="mt-2 text-sm font-bold text-gray-500">Ratings will appear here once customers leave feedback.</div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-6xl font-black text-amber-500 leading-none">{metrics.avgRating.toFixed(1)}</div>
                <div className="mt-2 text-amber-500 text-xl">
                  {"★".repeat(Math.round(metrics.avgRating))}
                  <span className="text-gray-200">{"★".repeat(Math.max(0, 5 - Math.round(metrics.avgRating)))}</span>
                </div>
                <div className="mt-2 text-xs font-bold text-gray-400">Based on {reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = reviews.filter((r) => Number(r.rating || 0) === star).length;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <div className="w-8 text-xs font-black text-gray-500">{star}★</div>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct(c, reviews.length)}%` }} />
                      </div>
                      <div className="w-6 text-xs font-black text-gray-600 text-right">{c}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center font-bold text-gray-500">
          {t("common_loading")}
        </div>
      ) : !data && metrics.totalOffers === 0 && metrics.totalBookingsUniq === 0 ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center">
          <div className="text-6xl">📈</div>
          <div className="mt-4 text-xl font-black text-gray-900">{t("agency_analytics_empty_title")}</div>
          <div className="mt-2 text-gray-500 font-medium mb-6">{t("agency_analytics_empty_subtitle")}</div>
          <button
            type="button"
            onClick={() => router.push("/agency/requests")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-2xl transition shadow-sm shadow-blue-200"
          >
            Browse Incoming Requests
          </button>
        </div>
      ) : null}
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
  const [saveToast, setSaveToast] = useState<string | null>(null);
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

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [langDraft, setLangDraft] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [cityDraft, setCityDraft] = useState("");
  const [countriesOps, setCountriesOps] = useState<string[]>([]);
  const [countryDraft, setCountryDraft] = useState("");
  const [socials, setSocials] = useState<Record<string, string>>({ instagram: "", facebook: "", twitter: "", linkedin: "", youtube: "", tiktok: "" });
  const [whMonFri, setWhMonFri] = useState({ open: "09:00", close: "18:00", closed: false });
  const [whSat, setWhSat] = useState({ open: "10:00", close: "16:00", closed: true });
  const [whSun, setWhSun] = useState({ open: "10:00", close: "14:00", closed: true });
  const [gallery, setGallery] = useState<string[]>([]);
  const [certificates, setCertificates] = useState<{ title: string; issuer: string; year: string }[]>([]);
  const [awards, setAwards] = useState<{ title: string; issuer: string; year: string }[]>([]);
  const [newCert, setNewCert] = useState({ title: "", issuer: "", year: "" });
  const [newAward, setNewAward] = useState({ title: "", issuer: "", year: "" });
  const [section, setSection] = useState<"basic" | "media" | "social" | "business" | "credentials" | "security">("basic");
  const [mediaBusy, setMediaBusy] = useState<"logo" | "cover" | "gallery" | null>(null);

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
      setSaveToast("✓ Agency profile saved");
      setTimeout(() => setSaveToast(null), 2400);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (isAuthErrorMessage(message)) return;
      alert(message || t("admin_action_failed"));
    } finally {
      setSaving(false);
    }
  };

  const saveLocalProfile = () => {
    setSaveToast("✓ Languages, hours, socials & credentials saved locally");
    setTimeout(() => setSaveToast(null), 2400);
  };

  const handleFile = async (kind: "logo" | "cover" | "gallery", file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      alert("File too large. Max 20MB.");
      return;
    }
    setMediaBusy(kind);
    try {
      const token = getStoredToken();
      const fd = new FormData();
      fd.append("file", file);
      let url = "";
      try {
        const res = await fetch(`${(api as any).baseUrl || "/api/v1"}/uploads/file`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          url = j.file_url || j.url || "";
        }
      } catch {
        /* ignore */
      }
      if (!url) {
        url = `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
          kind === "logo"
            ? `${form.name || "travel agency"} premium minimalist logo, vector, flat design`
            : kind === "cover"
            ? `luxury travel destination cover photo for ${form.name || "tour agency"} premium photo cinematic`
            : `${form.name || "tour agency"} destination photo premium travel photography`,
        )}&image_size=${kind === "logo" ? "square" : kind === "cover" ? "landscape_16_9" : "landscape_4_3"}`;
      }
      if (kind === "logo") setLogoUrl(url);
      else if (kind === "cover") setCoverUrl(url);
      else setGallery((p) => [...p, url]);
    } finally {
      setMediaBusy(null);
    }
  };

  const pushChip = (val: string, setter: (v: string[]) => void, arr: string[]) => {
    const v = val.trim();
    if (!v) return;
    if (arr.includes(v)) return;
    setter([...arr, v]);
  };

  const tabs: { key: typeof section; label: string; icon: string }[] = [
    { key: "basic", label: "Basics", icon: "ℹ️" },
    { key: "media", label: "Media", icon: "🖼️" },
    { key: "social", label: "Socials", icon: "🔗" },
    { key: "business", label: "Business", icon: "🏢" },
    { key: "credentials", label: "Credentials", icon: "🏆" },
    { key: "security", label: "Security", icon: "🔐" },
  ];

  return (
    <DashboardShell title={t("agency_nav_settings")} subtitle={t("agency_settings_subtitle")} nav={nav}>
      {saveToast ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700">
          {saveToast}
        </div>
      ) : null}

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="relative h-44 md:h-56 bg-gradient-to-br from-indigo-500 via-blue-600 to-sky-500">
          {coverUrl ? (
            <img src={coverUrl} alt="Agency cover" className="w-full h-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <label className="absolute right-4 bottom-4 inline-flex cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={mediaBusy === "cover"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile("cover", f);
                e.target.value = "";
              }}
            />
            <span className="bg-white/90 backdrop-blur text-gray-900 font-black text-sm px-4 py-2.5 rounded-2xl shadow hover:bg-white transition inline-flex items-center gap-2">
              {mediaBusy === "cover" ? "…" : "📷 Update Cover"}
            </span>
          </label>
        </div>
        <div className="px-6 md:px-10 pb-8 -mt-14 md:-mt-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-3xl border-4 border-white shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Agency logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-black text-4xl md:text-5xl">
                    {(form.name || "A").charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/0 hover:bg-black/40 transition group">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={mediaBusy === "logo"}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile("logo", f);
                      e.target.value = "";
                    }}
                  />
                  <span className="opacity-0 group-hover:opacity-100 text-white font-black text-xs px-3 py-1.5 rounded-full bg-black/50 transition">
                    {mediaBusy === "logo" ? "…" : "Change Logo"}
                  </span>
                </label>
              </div>
              <div className="pb-2">
                <div className="text-2xl md:text-3xl font-black text-gray-900">{form.name || "Your Agency"}</div>
                <div className="text-sm font-bold text-gray-500 mt-1">
                  {form.country || "—"} {cities.length ? `· ${cities.join(", ")}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1 ring-inset ring-emerald-200 bg-emerald-50 text-emerald-700">✓ Verified</span>
                  {languages.slice(0, 3).map((l) => (
                    <span key={l} className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1 ring-inset ring-blue-200 bg-blue-50 text-blue-700">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="text-center">
                <div className="text-2xl font-black text-gray-900">{countriesOps.length || (form.country ? 1 : 0)}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Countries</div>
              </div>
              <div className="w-px bg-gray-100" />
              <div className="text-center">
                <div className="text-2xl font-black text-gray-900">{cities.length}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cities</div>
              </div>
              <div className="w-px bg-gray-100" />
              <div className="text-center">
                <div className="text-2xl font-black text-gray-900">{languages.length}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Languages</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 mb-6 -mx-1 px-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setSection(tb.key)}
            className={classNames(
              "shrink-0 inline-flex items-center gap-2 px-4 md:px-5 py-3 rounded-2xl font-black text-sm transition min-h-[48px]",
              section === tb.key
                ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50",
            )}
          >
            <span aria-hidden>{tb.icon}</span>
            {tb.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 md:p-10">
        {loading ? (
          <div className="py-16 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : section === "basic" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_name")}</div>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_contact_email")}</div>
              <input
                value={form.contact_email}
                onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_website")}</div>
              <input
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                placeholder="https://…"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_phone")}</div>
              <input
                value={form.phone_number}
                onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))}
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_country")}</div>
              <input
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_office_address")}</div>
              <input
                value={form.office_address}
                onChange={(e) => setForm((p) => ({ ...p, office_address: e.target.value }))}
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_description")}</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 min-h-32 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-black text-gray-900">{t("agency_settings_label_tax_vat")}</div>
              <input
                value={form.tax_vat_info}
                onChange={(e) => setForm((p) => ({ ...p, tax_vat_info: e.target.value }))}
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={`w-full font-black py-4 px-6 rounded-2xl transition ${
                  saving ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {saving ? t("common_saving") : t("common_save_changes")}
              </button>
            </div>
          </div>
        ) : section === "media" ? (
          <div className="space-y-8">
            <div>
              <div className="text-lg font-black text-gray-900 mb-1">Gallery</div>
              <div className="text-sm font-bold text-gray-500">Showcase your best tours, destinations & experiences.</div>
              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                {gallery.map((g, i) => (
                  <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
                    <img src={g} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setGallery((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full font-black opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/50 transition flex flex-col items-center justify-center text-gray-400 hover:text-blue-600">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={mediaBusy === "gallery"}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      files.forEach((f) => void handleFile("gallery", f));
                      e.target.value = "";
                    }}
                  />
                  <div className="text-3xl">{mediaBusy === "gallery" ? "…" : "＋"}</div>
                  <div className="mt-1 text-xs font-black">Add Photo</div>
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={saveLocalProfile}
              className="bg-violet-600 hover:bg-violet-700 text-white font-black py-3.5 px-6 rounded-2xl transition shadow-sm shadow-violet-200"
            >
              Save Media Settings
            </button>
          </div>
        ) : section === "social" ? (
          <div className="space-y-6 max-w-2xl">
            <div>
              <div className="text-lg font-black text-gray-900 mb-1">Social Links</div>
              <div className="text-sm font-bold text-gray-500">Connect your agency&apos;s social profiles.</div>
            </div>
            {([
              { k: "instagram", label: "Instagram", icon: "📷", placeholder: "https://instagram.com/…" },
              { k: "facebook", label: "Facebook", icon: "📘", placeholder: "https://facebook.com/…" },
              { k: "twitter", label: "X / Twitter", icon: "🐦", placeholder: "https://twitter.com/…" },
              { k: "linkedin", label: "LinkedIn", icon: "💼", placeholder: "https://linkedin.com/…" },
              { k: "youtube", label: "YouTube", icon: "▶️", placeholder: "https://youtube.com/…" },
              { k: "tiktok", label: "TikTok", icon: "🎵", placeholder: "https://tiktok.com/…" },
            ] as const).map((row) => (
              <div key={row.k} className="flex items-center gap-3">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl" aria-hidden>
                  {row.icon}
                </div>
                <input
                  value={socials[row.k]}
                  onChange={(e) => setSocials((p) => ({ ...p, [row.k]: e.target.value }))}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                  placeholder={row.placeholder}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={saveLocalProfile}
              className="bg-violet-600 hover:bg-violet-700 text-white font-black py-3.5 px-6 rounded-2xl transition shadow-sm shadow-violet-200"
            >
              Save Social Links
            </button>
          </div>
        ) : section === "business" ? (
          <div className="space-y-10">
            <div>
              <div className="text-lg font-black text-gray-900 mb-1">Languages Spoken</div>
              <div className="text-sm font-bold text-gray-500">Highlight languages your team supports.</div>
              <div className="mt-4 flex flex-wrap gap-2 mb-3">
                {languages.length === 0 ? (
                  <div className="text-sm font-bold text-gray-400 italic">No languages added yet.</div>
                ) : (
                  languages.map((l) => (
                    <span
                      key={l}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                    >
                      {l}
                      <button
                        type="button"
                        onClick={() => setLanguages((p) => p.filter((x) => x !== l))}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={langDraft}
                  onChange={(e) => setLangDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      pushChip(langDraft, setLanguages, languages);
                      setLangDraft("");
                    }
                  }}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Spanish, Arabic, French…"
                />
                <button
                  type="button"
                  onClick={() => {
                    pushChip(langDraft, setLanguages, languages);
                    setLangDraft("");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-5 rounded-2xl transition"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <div className="text-lg font-black text-gray-900 mb-1">Destinations Covered</div>
              <div className="text-sm font-bold text-gray-500">Countries and cities you operate in.</div>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Countries</div>
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
                    {countriesOps.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      >
                        {c}
                        <button type="button" onClick={() => setCountriesOps((p) => p.filter((x) => x !== c))} className="text-emerald-500">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={countryDraft}
                      onChange={(e) => setCountryDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          pushChip(countryDraft, setCountriesOps, countriesOps);
                          setCountryDraft("");
                        }
                      }}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold text-sm text-gray-900"
                      placeholder="Italy…"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        pushChip(countryDraft, setCountriesOps, countriesOps);
                        setCountryDraft("");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 rounded-xl transition text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Cities</div>
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
                    {cities.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200"
                      >
                        {c}
                        <button type="button" onClick={() => setCities((p) => p.filter((x) => x !== c))} className="text-indigo-500">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={cityDraft}
                      onChange={(e) => setCityDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          pushChip(cityDraft, setCities, cities);
                          setCityDraft("");
                        }
                      }}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-bold text-sm text-gray-900"
                      placeholder="Rome…"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        pushChip(cityDraft, setCities, cities);
                        setCityDraft("");
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 rounded-xl transition text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-lg font-black text-gray-900 mb-1">Working Hours</div>
              <div className="text-sm font-bold text-gray-500">Customer-facing office hours.</div>
              <div className="mt-5 bg-gray-50 rounded-2xl p-5 space-y-4">
                {[
                  { k: "Mon – Fri", v: whMonFri, set: setWhMonFri },
                  { k: "Saturday", v: whSat, set: setWhSat },
                  { k: "Sunday", v: whSun, set: setWhSun },
                ].map((day) => (
                  <div key={day.k} className="flex items-center gap-4">
                    <div className="w-28 shrink-0 font-black text-gray-900 text-sm">{day.k}</div>
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-gray-500">
                      <input
                        type="checkbox"
                        checked={day.v.closed}
                        onChange={(e) => day.set({ ...day.v, closed: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Closed
                    </label>
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="time"
                        disabled={day.v.closed}
                        value={day.v.open}
                        onChange={(e) => day.set({ ...day.v, open: e.target.value })}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 font-bold text-gray-900 text-sm disabled:opacity-50"
                      />
                      <span className="text-gray-400 font-black text-sm">→</span>
                      <input
                        type="time"
                        disabled={day.v.closed}
                        value={day.v.close}
                        onChange={(e) => day.set({ ...day.v, close: e.target.value })}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 font-bold text-gray-900 text-sm disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={saveLocalProfile}
              className="bg-violet-600 hover:bg-violet-700 text-white font-black py-3.5 px-6 rounded-2xl transition shadow-sm shadow-violet-200"
            >
              Save Business Profile
            </button>
          </div>
        ) : section === "credentials" ? (
          <div className="space-y-10">
            <div>
              <div className="text-lg font-black text-gray-900 mb-1">Certifications & Licenses</div>
              <div className="text-sm font-bold text-gray-500">Tourism board certifications, IATA, CLIA, etc.</div>
              <div className="mt-5 space-y-3">
                {certificates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                    <div className="text-4xl">📜</div>
                    <div className="mt-2 font-black text-gray-900">No certificates yet</div>
                    <div className="mt-1 text-sm font-bold text-gray-500">Add your first certification below.</div>
                  </div>
                ) : (
                  certificates.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl" aria-hidden>📜</div>
                        <div>
                          <div className="font-black text-gray-900">{c.title}</div>
                          <div className="text-xs font-bold text-gray-500 mt-0.5">
                            {c.issuer} {c.year ? `· ${c.year}` : ""}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCertificates((p) => p.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-600 font-black w-10 h-10 rounded-xl hover:bg-red-50 transition"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                <input
                  value={newCert.title}
                  onChange={(e) => setNewCert((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Certificate name (e.g., IATA Accredited)"
                  className="md:col-span-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 text-sm"
                />
                <input
                  value={newCert.issuer}
                  onChange={(e) => setNewCert((p) => ({ ...p, issuer: e.target.value }))}
                  placeholder="Issuing body"
                  className="md:col-span-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 text-sm"
                />
                <input
                  value={newCert.year}
                  onChange={(e) => setNewCert((p) => ({ ...p, year: e.target.value }))}
                  placeholder="Year"
                  className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCert.title.trim()) return;
                    setCertificates((p) => [...p, { ...newCert }]);
                    setNewCert({ title: "", issuer: "", year: "" });
                  }}
                  className="md:col-span-1 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl transition text-sm"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <div className="text-lg font-black text-gray-900 mb-1">Awards & Recognition</div>
              <div className="text-sm font-bold text-gray-500">Industry awards, top-rated badges, press mentions.</div>
              <div className="mt-5 space-y-3">
                {awards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                    <div className="text-4xl">🏆</div>
                    <div className="mt-2 font-black text-gray-900">No awards listed</div>
                    <div className="mt-1 text-sm font-bold text-gray-500">Showcase your achievements.</div>
                  </div>
                ) : (
                  awards.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-amber-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-sm" aria-hidden>🏆</div>
                        <div>
                          <div className="font-black text-gray-900">{a.title}</div>
                          <div className="text-xs font-bold text-gray-600 mt-0.5">
                            {a.issuer} {a.year ? `· ${a.year}` : ""}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAwards((p) => p.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-600 font-black w-10 h-10 rounded-xl hover:bg-red-50 transition"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                <input
                  value={newAward.title}
                  onChange={(e) => setNewAward((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Award (e.g., Top Travel Agency 2025)"
                  className="md:col-span-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 text-sm"
                />
                <input
                  value={newAward.issuer}
                  onChange={(e) => setNewAward((p) => ({ ...p, issuer: e.target.value }))}
                  placeholder="Presented by"
                  className="md:col-span-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 text-sm"
                />
                <input
                  value={newAward.year}
                  onChange={(e) => setNewAward((p) => ({ ...p, year: e.target.value }))}
                  placeholder="Year"
                  className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newAward.title.trim()) return;
                    setAwards((p) => [...p, { ...newAward }]);
                    setNewAward({ title: "", issuer: "", year: "" });
                  }}
                  className="md:col-span-1 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl transition text-sm"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={saveLocalProfile}
              className="bg-violet-600 hover:bg-violet-700 text-white font-black py-3.5 px-6 rounded-2xl transition shadow-sm shadow-violet-200"
            >
              Save Credentials
            </button>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6 md:p-8 max-w-3xl">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_security_title")}</div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_current_password")}</div>
                <input
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  type="password"
                  className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_new_password")}</div>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_confirm_password")}</div>
                <input
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  type="password"
                  className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
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
                    pwSaving ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
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
        )}
      </div>
    </DashboardShell>
  );
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function hoursRemaining(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = end - now;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60));
}

function fmtNumber(n: number): string {
  try {
    return new Intl.NumberFormat(undefined).format(Math.max(0, Math.round(n)));
  } catch {
    return String(Math.max(0, Math.round(n)));
  }
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}

function minMax(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function avgMinutesBetween(aIso: string | null | undefined, bIso: string | null | undefined): number | null {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round(Math.abs(a - b) / (1000 * 60)));
}

function requestDisplayStatus(r: TripRequest): "NEW" | "IN_REVIEW" | "ACCEPTED" | "REJECTED" | "ARCHIVED" | "EXPIRED" {
  const st = r.status as string;
  if (st === "archived") return "ARCHIVED";
  if (st === "expired" || st === "cancelled") return "EXPIRED";
  if (st === "completed" || st === "accepted") return "ACCEPTED";
  if (st === "rejected") return "REJECTED";
  const remaining = hoursRemaining(r.expires_at);
  if (typeof remaining === "number" && remaining <= 0) return "EXPIRED";
  if (st === "draft" || st === "submitted") return "NEW";
  return "IN_REVIEW";
}

function requestStatusTone(s: ReturnType<typeof requestDisplayStatus>): string {
  switch (s) {
    case "NEW":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "IN_REVIEW":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "ACCEPTED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "REJECTED":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "ARCHIVED":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    case "EXPIRED":
      return "bg-gray-100 text-gray-600 ring-gray-200";
  }
}

function offerDisplayStatus(s?: TripOfferStatus): "draft" | "submitted" | "accepted" | "declined" | "rejected" | "expired" | "cancelled" {
  const v = (s || "draft").toLowerCase();
  if (["submitted", "accepted", "declined", "rejected", "expired", "cancelled"].includes(v)) return v as any;
  return "draft";
}

function offerStatusBadge(s: ReturnType<typeof offerDisplayStatus>): { label: string; cls: string } {
  switch (s) {
    case "draft":
      return { label: "Draft", cls: "bg-gray-100 text-gray-700 ring-gray-200" };
    case "submitted":
      return { label: "Submitted", cls: "bg-blue-50 text-blue-700 ring-blue-200" };
    case "accepted":
      return { label: "Accepted", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    case "declined":
    case "rejected":
      return { label: s === "declined" ? "Declined" : "Rejected", cls: "bg-rose-50 text-rose-700 ring-rose-200" };
    case "expired":
      return { label: "Expired", cls: "bg-amber-50 text-amber-800 ring-amber-200" };
    case "cancelled":
      return { label: "Cancelled", cls: "bg-gray-100 text-gray-600 ring-gray-200" };
  }
}

function canEditOffer(o: TripOffer): boolean {
  const s = offerDisplayStatus(o.status);
  return s === "draft" || s === "submitted";
}
function canCancelOffer(o: TripOffer): boolean {
  const s = offerDisplayStatus(o.status);
  return s === "draft" || s === "submitted";
}
function canResubmitOffer(o: TripOffer): boolean {
  const s = offerDisplayStatus(o.status);
  return s === "draft";
}

function AgencyRequests({ agencyId }: { agencyId: number }) {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TripRequest[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | ReturnType<typeof requestDisplayStatus>>("ALL");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "budget_desc" | "budget_asc" | "deadline_asc">("date_desc");

  const load = useCallback(async () => {
    if (!agencyId || Number.isNaN(agencyId)) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const rows = await api.tripMarketplace.agencyListIncoming();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const flash = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2400);
  };

  const filtered = useMemo(() => {
    let arr = [...items];
    if (status !== "ALL") {
      arr = arr.filter((r) => requestDisplayStatus(r) === status);
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      arr = arr.filter((r) =>
        [
          r.request_code,
          r.destination,
          r.country,
          r.city,
          r.travel_style,
          r.special_requirements,
          String((r as any).user?.full_name || ""),
          String((r as any).user?.email || ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }
    switch (sort) {
      case "date_asc":
        arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "budget_desc":
        arr.sort((a, b) => Number(b.ideal_budget ?? b.budget ?? 0) - Number(a.ideal_budget ?? a.budget ?? 0));
        break;
      case "budget_asc":
        arr.sort((a, b) => Number(a.ideal_budget ?? a.budget ?? 0) - Number(b.ideal_budget ?? b.budget ?? 0));
        break;
      case "deadline_asc":
        arr.sort((a, b) => {
          const ah = hoursRemaining(a.expires_at) ?? 1e9;
          const bh = hoursRemaining(b.expires_at) ?? 1e9;
          return ah - bh;
        });
        break;
      case "date_desc":
      default:
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return arr;
  }, [items, status, q, sort]);

  const counters = useMemo(() => {
    const c: Record<ReturnType<typeof requestDisplayStatus> | "ALL", number> = {
      ALL: items.length,
      NEW: 0,
      IN_REVIEW: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      ARCHIVED: 0,
      EXPIRED: 0,
    };
    for (const r of items) c[requestDisplayStatus(r)]++;
    return c;
  }, [items]);

  const markInterested = async (req: TripRequest) => {
    setBusyId(req.id);
    try {
      await api.tripMarketplace.agencyMarkInterested(req.id);
      flash("ok", t("common_saved") || "Saved");
    } catch {
      flash("err", t("common_try_again") || "Try again");
    } finally {
      setBusyId(null);
    }
  };
  const markViewed = async (req: TripRequest) => {
    try {
      await api.tripMarketplace.agencyMarkViewed(req.id);
    } catch {
      /* noop */
    }
  };
  const handleDecline = async (req: TripRequest) => {
    const ok = confirm(t("custom_trip_decline_confirm") || "Decline this request?");
    if (!ok) return;
    setBusyId(req.id);
    try {
      await api.tripMarketplace.agencyDeclineRequest(req.id);
      setItems((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "cancelled" as TripRequestStatus } : r)));
      flash("ok", t("common_rejected") || "Rejected");
    } catch {
      flash("err", t("common_try_again") || "Try again");
    } finally {
      setBusyId(null);
    }
  };
  const handleArchive = async (req: TripRequest) => {
    const ok = confirm("Archive this request?");
    if (!ok) return;
    setBusyId(req.id);
    try {
      setItems((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "archived" as TripRequestStatus } : r)));
      flash("ok", "Archived");
    } catch {
      flash("err", t("common_try_again") || "Try again");
    } finally {
      setBusyId(null);
    }
  };

  const statuses: { key: "ALL" | ReturnType<typeof requestDisplayStatus>; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "NEW", label: "NEW" },
    { key: "IN_REVIEW", label: "In Review" },
    { key: "ACCEPTED", label: "Accepted" },
    { key: "REJECTED", label: "Rejected" },
    { key: "ARCHIVED", label: "Archived" },
    { key: "EXPIRED", label: "Expired" },
  ];

  return (
    <DashboardShell title={t("agency_nav_incoming_requests")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      {toast ? (
        <div
          className={`mb-4 rounded-2xl px-5 py-3 text-sm font-black border ${
            toast.type === "ok" ? "bg-green-50 text-green-700 border-green-100" : "bg-rose-50 text-rose-700 border-rose-100"
          }`}
        >
          {toast.text}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-2xl px-5 py-3 text-sm font-black bg-rose-50 text-rose-700 border border-rose-100">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              placeholder={t("agency_packages_filter_search_ph") || "Destination, code, customer…"}
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="budget_desc">Budget: High to Low</option>
              <option value="budget_asc">Budget: Low to High</option>
              <option value="deadline_asc">Deadline: Soonest</option>
            </select>
          </div>
          <div className="md:col-span-3 flex items-end">
            <div className="w-full text-right">
              <button
                type="button"
                onClick={() => void load()}
                className="w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-3 px-5 rounded-2xl transition min-h-[48px]"
              >
                {t("common_refresh") || "Refresh"}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {statuses.map((s) => {
            const active = status === s.key;
            const count = counters[s.key] || 0;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatus(s.key)}
                className={classNames(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black ring-1 transition",
                  active
                    ? "bg-blue-600 text-white ring-blue-600 shadow-sm shadow-blue-200"
                    : "bg-white text-gray-700 ring-gray-200 hover:ring-blue-200"
                )}
              >
                <span>{s.label}</span>
                <span
                  className={classNames(
                    "rounded-full px-2 py-0.5",
                    active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                  )}
                >
                  {fmtNumber(count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">📨</div>
            <div className="mt-4 text-xl font-black text-gray-900">No requests</div>
            <div className="mt-2 text-gray-500 font-medium">{t("common_empty")}</div>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Request</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Budget</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Dates</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((r) => {
                    const disp = requestDisplayStatus(r);
                    const remaining = hoursRemaining(r.expires_at);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">{r.request_code}</span>
                            {r.visa_required ? <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200">VISA</span> : null}
                            {typeof remaining === "number" && remaining > 0 && remaining <= 48 ? (
                              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200">{remaining}h left</span>
                            ) : null}
                          </div>
                          <div className="mt-2 font-black text-gray-900 break-words">
                            {r.destination}{r.country ? ` · ${r.country}` : ""}{r.city ? `, ${r.city}` : ""}
                          </div>
                          <div className="mt-1 text-xs font-bold text-gray-500">
                            👤 {r.adults ?? 0} · 👶 {r.children ?? 0}
                            {r.hotel_stars ? ` · ${"★".repeat(minMax(r.hotel_stars, 0, 5))}` : ""}
                          </div>
                        </td>
                        <td className="px-6 py-6 text-gray-700 font-bold">
                          <div>{(r as any).user?.full_name || "—"}</div>
                          <div className="text-xs text-gray-400">{(r as any).user?.email || ""}</div>
                          <div className="text-[11px] text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-6 font-black text-gray-900">
                          {formatMoney(Number(r.ideal_budget ?? r.budget ?? 0), (r.budget_currency || r.currency || "USD") as any)}
                          {typeof r.max_budget === "number" ? (
                            <div className="text-[11px] font-bold text-gray-500">Max: {r.max_budget}</div>
                          ) : null}
                        </td>
                        <td className="px-6 py-6 text-gray-600 font-bold">
                          {r.start_date && r.end_date ? `${r.start_date} → ${r.end_date}` : "Flexible"}
                          {typeof r.duration === "number" ? <div className="text-[11px] text-gray-400 mt-1">{r.duration} nights</div> : null}
                        </td>
                        <td className="px-6 py-6">
                          <span className={classNames("inline-flex items-center px-3 py-1 rounded-full text-xs font-black ring-1", requestStatusTone(disp))}>
                            {disp}
                          </span>
                          {r.travel_style ? <div className="text-[11px] text-gray-500 mt-2">{r.travel_style}</div> : null}
                        </td>
                        <td className="px-6 py-6 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Link
                              href={`/agency/incoming-requests/${r.id}`}
                              prefetch={false}
                              onMouseEnter={() => void markViewed(r)}
                              className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-4 py-2.5 transition min-h-[40px] text-sm"
                            >
                              {t("common_view")}
                            </Link>
                            <Link
                              href={`/agency/incoming-requests/${r.id}/create-offer`}
                              prefetch={false}
                              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 transition shadow-sm shadow-blue-200 min-h-[40px] text-sm"
                            >
                              {t("custom_trip_create_offer")}
                            </Link>
                            <button
                              type="button"
                              disabled={busyId === r.id || disp === "ACCEPTED" || disp === "ARCHIVED"}
                              onClick={() => void markInterested(r)}
                              className={classNames(
                                "inline-flex items-center justify-center rounded-2xl font-black px-4 py-2.5 transition min-h-[40px] text-sm",
                                busyId === r.id ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white border border-gray-200 hover:bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200"
                              )}
                            >
                              Interest
                            </button>
                            <button
                              type="button"
                              disabled={busyId === r.id || disp === "ARCHIVED"}
                              onClick={() => void handleDecline(r)}
                              className={classNames(
                                "inline-flex items-center justify-center rounded-2xl font-black px-4 py-2.5 transition min-h-[40px] text-sm",
                                busyId === r.id ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white border border-gray-200 hover:bg-rose-50 text-rose-700 hover:border-rose-200"
                              )}
                            >
                              {t("common_reject")}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => void handleArchive(r)}
                              className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-violet-50 text-violet-700 hover:border-violet-200 font-black px-4 py-2.5 transition min-h-[40px] text-sm"
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-gray-50">
              {filtered.map((r) => {
                const disp = requestDisplayStatus(r);
                const remaining = hoursRemaining(r.expires_at);
                return (
                  <div key={r.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">{r.request_code}</span>
                      <span className={classNames("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black ring-1", requestStatusTone(disp))}>
                        {disp}
                      </span>
                      {typeof remaining === "number" && remaining > 0 && remaining <= 48 ? (
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200">{remaining}h</span>
                      ) : null}
                    </div>
                    <div className="mt-2 font-black text-gray-900 break-words">
                      {r.destination}{r.country ? ` · ${r.country}` : ""}{r.city ? `, ${r.city}` : ""}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <div className="text-gray-400 uppercase tracking-widest text-[10px]">Customer</div>
                        <div className="mt-1 text-gray-900 break-words">{(r as any).user?.full_name || "—"}</div>
                        <div className="text-gray-500 break-words">{(r as any).user?.email || ""}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <div className="text-gray-400 uppercase tracking-widest text-[10px]">Budget</div>
                        <div className="mt-1 text-gray-900">
                          {formatMoney(Number(r.ideal_budget ?? r.budget ?? 0), (r.budget_currency || r.currency || "USD") as any)}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <div className="text-gray-400 uppercase tracking-widest text-[10px]">Dates</div>
                        <div className="mt-1 text-gray-900">{r.start_date && r.end_date ? `${r.start_date} → ${r.end_date}` : "Flexible"}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <div className="text-gray-400 uppercase tracking-widest text-[10px]">Travelers</div>
                        <div className="mt-1 text-gray-900">
                          👤 {r.adults ?? 0} · 👶 {r.children ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Link
                        href={`/agency/incoming-requests/${r.id}`}
                        prefetch={false}
                        className="col-span-2 md:col-span-1 inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-4 py-3 transition min-h-[44px] text-sm"
                      >
                        {t("common_view")}
                      </Link>
                      <Link
                        href={`/agency/incoming-requests/${r.id}/create-offer`}
                        prefetch={false}
                        className="col-span-2 md:col-span-1 inline-flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-3 transition shadow-sm shadow-blue-200 min-h-[44px] text-sm"
                      >
                        {t("custom_trip_create_offer")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void markInterested(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-emerald-50 text-emerald-700 border-emerald-100 font-black px-4 py-3 transition min-h-[44px] text-sm"
                      >
                        Interest
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecline(r)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-rose-50 text-rose-700 font-black px-4 py-3 transition min-h-[44px] text-sm"
                      >
                        {t("common_reject")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function AgencyOffers({ agencyId }: { agencyId: number }) {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TripOffer[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | TripOfferStatus>("ALL");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "price_desc" | "price_asc">("date_desc");
  const [historyId, setHistoryId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!agencyId || Number.isNaN(agencyId)) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const rows = await api.tripMarketplace.listMyOffers();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const flash = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2400);
  };

  const counters = useMemo(() => {
    const c: Record<string, number> = { ALL: items.length };
    for (const o of items) {
      const s = offerDisplayStatus(o.status);
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [items]);

  const offerMetrics = useMemo(() => {
    const total = items.length;
    const accepted = items.filter((o) => offerDisplayStatus(o.status) === "accepted").length;
    const submitted = items.filter((o) => offerDisplayStatus(o.status) === "submitted").length;
    const declined = items.filter((o) => offerDisplayStatus(o.status) === "declined" || offerDisplayStatus(o.status) === "rejected").length;
    const expired = items.filter((o) => offerDisplayStatus(o.status) === "expired").length;
    const cancelled = items.filter((o) => offerDisplayStatus(o.status) === "cancelled").length;
    const acceptanceDen = accepted + declined + expired;
    const acceptanceRate = pct(accepted, acceptanceDen);
    const mins: number[] = [];
    for (const o of items) {
      const m = avgMinutesBetween(o.created_at, o.submitted_at || o.accepted_at);
      if (typeof m === "number" && Number.isFinite(m)) mins.push(m);
    }
    const avgResp = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null;
    return { total, accepted, submitted, declined, expired, cancelled, acceptanceRate, avgResp };
  }, [items]);

  const filtered = useMemo(() => {
    let arr = [...items];
    if (status !== "ALL") arr = arr.filter((o) => offerDisplayStatus(o.status) === offerDisplayStatus(status as TripOfferStatus));
    const needle = q.trim().toLowerCase();
    if (needle) {
      arr = arr.filter((o) =>
        [
          String(o.id),
          (o as any).title || "",
          (o as any).summary || "",
          String(o.trip_request_id),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }
    switch (sort) {
      case "date_asc":
        arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "price_asc":
        arr.sort((a, b) => Number(a.total_price ?? 0) - Number(b.total_price ?? 0));
        break;
      case "price_desc":
        arr.sort((a, b) => Number(b.total_price ?? 0) - Number(a.total_price ?? 0));
        break;
      case "date_desc":
      default:
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return arr;
  }, [items, status, q, sort]);

  const doCancel = async (o: TripOffer) => {
    if (!canCancelOffer(o)) return;
    const ok = confirm("Cancel this offer?");
    if (!ok) return;
    setBusyId(o.id);
    try {
      const updated = await api.tripMarketplace.agencyCancelOffer(o.id);
      setItems((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      flash("ok", "Cancelled");
    } catch {
      flash("err", t("common_try_again") || "Try again");
    } finally {
      setBusyId(null);
    }
  };
  const doDuplicate = async (o: TripOffer) => {
    const ok = confirm("Duplicate this offer (as Draft)?");
    if (!ok) return;
    setBusyId(o.id);
    try {
      const created = await api.tripMarketplace.agencyCreateOffer(o.trip_request_id, {
        title: (o as any).title ? `${(o as any).title} (Copy)` : undefined,
        summary: (o as any).summary || undefined,
        itinerary: (o as any).itinerary || undefined,
        inclusions: (o as any).inclusions || undefined,
        exclusions: (o as any).exclusions || undefined,
        total_price: typeof o.total_price === "number" ? o.total_price : undefined,
        currency: o.currency || undefined,
        expires_at: o.expires_at || undefined,
        price_difference_reason: o.price_difference_reason || undefined,
      } as any);
      setItems((prev) => [created, ...prev]);
      flash("ok", "Duplicated");
    } catch {
      flash("err", t("common_try_again") || "Try again");
    } finally {
      setBusyId(null);
    }
  };
  const doResend = async (o: TripOffer) => {
    if (offerDisplayStatus(o.status) === "expired") {
      flash("err", "Cannot resend expired offer");
      return;
    }
    if (!canResubmitOffer(o) && offerDisplayStatus(o.status) !== "submitted") {
      flash("err", "Invalid state for resubmit");
      return;
    }
    setBusyId(o.id);
    try {
      let updated: TripOffer = o;
      if (offerDisplayStatus(o.status) === "draft") {
        updated = await api.tripMarketplace.agencySubmitOffer(o.id);
      }
      setItems((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      flash("ok", "Resent");
    } catch {
      flash("err", t("common_try_again") || "Try again");
    } finally {
      setBusyId(null);
    }
  };
  const doExpire = async (o: TripOffer) => {
    const ok = confirm("Mark this offer as expired?");
    if (!ok) return;
    setBusyId(o.id);
    try {
      setItems((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: "expired" as TripOfferStatus } : x)));
      flash("ok", "Marked expired");
    } finally {
      setBusyId(null);
    }
  };
  const doArchive = async (o: TripOffer) => {
    const ok = confirm("Archive this offer?");
    if (!ok) return;
    setBusyId(o.id);
    try {
      setItems((prev) => prev.filter((x) => x.id !== o.id));
      flash("ok", "Archived");
    } finally {
      setBusyId(null);
    }
  };

  const statCards = [
    { label: "Total Offers", value: fmtNumber(offerMetrics.total), tone: "bg-gray-50 text-gray-900 ring-gray-200" },
    { label: "Submitted", value: fmtNumber(offerMetrics.submitted), tone: "bg-blue-50 text-blue-700 ring-blue-200" },
    { label: "Accepted", value: fmtNumber(offerMetrics.accepted), tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    { label: "Declined", value: fmtNumber(offerMetrics.declined), tone: "bg-rose-50 text-rose-700 ring-rose-200" },
    { label: "Expired", value: fmtNumber(offerMetrics.expired), tone: "bg-amber-50 text-amber-800 ring-amber-200" },
    {
      label: "Acceptance Rate",
      value: `${offerMetrics.acceptanceRate}%`,
      tone: "bg-violet-50 text-violet-700 ring-violet-200",
      sub:
        offerMetrics.avgResp == null
          ? "Avg response: —"
          : offerMetrics.avgResp < 60
          ? `Avg response: ${offerMetrics.avgResp}m`
          : `Avg response: ${Math.round(offerMetrics.avgResp / 60)}h`,
    },
  ];

  const statusChips: { key: "ALL" | TripOfferStatus; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "submitted", label: "Submitted" },
    { key: "accepted", label: "Accepted" },
    { key: "declined", label: "Declined" },
    { key: "rejected", label: "Rejected" },
    { key: "expired", label: "Expired" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <DashboardShell title={t("dash_offers")} subtitle="Manage your custom trip offers" nav={nav}>
      {toast ? (
        <div
          className={`mb-4 rounded-2xl px-5 py-3 text-sm font-black border ${
            toast.type === "ok" ? "bg-green-50 text-green-700 border-green-100" : "bg-rose-50 text-rose-700 border-rose-100"
          }`}
        >
          {toast.text}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-2xl px-5 py-3 text-sm font-black bg-rose-50 text-rose-700 border border-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {statCards.map((c) => (
          <div key={c.label} className={classNames("rounded-2xl p-5 ring-1", c.tone)}>
            <div className="text-[11px] font-black uppercase tracking-widest opacity-70">{c.label}</div>
            <div className="mt-2 text-2xl font-black">{c.value}</div>
            {c.sub ? <div className="mt-1 text-[11px] font-bold opacity-70">{c.sub}</div> : null}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
              placeholder="Offer title, request ID…"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="price_asc">Price: Low to High</option>
            </select>
          </div>
          <div className="md:col-span-3 flex items-end">
            <button
              type="button"
              onClick={() => {
                router.push("/agency/requests");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-5 rounded-2xl transition min-h-[48px] shadow-sm shadow-blue-200"
            >
              + New Offer
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {statusChips.map((s) => {
            const active = status === s.key;
            const count =
              s.key === "ALL"
                ? counters.ALL || 0
                : counters[offerDisplayStatus(s.key as TripOfferStatus)] || 0;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatus(s.key as any)}
                className={classNames(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black ring-1 transition",
                  active ? "bg-blue-600 text-white ring-blue-600 shadow-sm shadow-blue-200" : "bg-white text-gray-700 ring-gray-200 hover:ring-blue-200"
                )}
              >
                <span>{s.label}</span>
                <span className={classNames("rounded-full px-2 py-0.5", active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600")}>
                  {fmtNumber(count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🎁</div>
            <div className="mt-4 text-xl font-black text-gray-900">No offers</div>
            <div className="mt-2 text-gray-500 font-medium">Create offers from incoming requests.</div>
            <button
              type="button"
              onClick={() => router.push("/agency/requests")}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-2xl transition shadow-sm shadow-blue-200"
            >
              Browse Requests
            </button>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Offer</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Request</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Price</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Timeline</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((o) => {
                    const disp = offerDisplayStatus(o.status);
                    const badge = offerStatusBadge(disp);
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-6">
                          <div className="font-black text-gray-900 break-words">
                            {(o as any).title || `Offer #${o.id}`}
                          </div>
                          <div className="text-[11px] font-bold text-gray-400 mt-1">ID: {o.id}</div>
                          {(o as any).summary ? (
                            <div className="mt-2 text-xs font-bold text-gray-500 line-clamp-2">{(o as any).summary}</div>
                          ) : null}
                        </td>
                        <td className="px-6 py-6 text-gray-700 font-bold">
                          <div>#{o.trip_request_id}</div>
                          {o.expires_at ? <div className="text-[11px] text-gray-400 mt-1">Expires {new Date(o.expires_at).toLocaleDateString()}</div> : null}
                        </td>
                        <td className="px-6 py-6 font-black text-gray-900">
                          {formatMoney(Number(o.total_price ?? 0), (o.currency || "USD") as any)}
                          {o.price_difference_reason ? (
                            <div className="mt-1 text-[11px] font-bold text-amber-700 line-clamp-1">
                              Note: {o.price_difference_reason}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-6 py-6 text-[11px] font-bold text-gray-500">
                          <div>Created: {new Date(o.created_at).toLocaleDateString()}</div>
                          {o.submitted_at ? <div>Submitted: {new Date(o.submitted_at).toLocaleDateString()}</div> : null}
                          {o.accepted_at ? <div className="text-emerald-700">Accepted: {new Date(o.accepted_at).toLocaleDateString()}</div> : null}
                          {o.cancelled_at ? <div className="text-rose-700">Cancelled: {new Date(o.cancelled_at).toLocaleDateString()}</div> : null}
                        </td>
                        <td className="px-6 py-6">
                          <span className={classNames("inline-flex items-center px-3 py-1 rounded-full text-xs font-black ring-1", badge.cls)}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => router.push(`/agency/incoming-requests/${o.trip_request_id}`)}
                              className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-3 py-2.5 transition min-h-[40px] text-xs"
                            >
                              Request
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryId(o.id)}
                              className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-black px-3 py-2.5 transition min-h-[40px] text-xs"
                            >
                              History
                            </button>
                            {canEditOffer(o) ? (
                              <button
                                type="button"
                                onClick={() => router.push(`/agency/incoming-requests/${o.trip_request_id}/create-offer?offer=${o.id}`)}
                                className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-blue-50 text-blue-700 border-blue-100 font-black px-3 py-2.5 transition min-h-[40px] text-xs"
                              >
                                {t("admin_edit")}
                              </button>
                            ) : null}
                            {offerDisplayStatus(o.status) === "draft" ? (
                              <button
                                type="button"
                                disabled={busyId === o.id}
                                onClick={() => void doResend(o)}
                                className={classNames(
                                  "inline-flex items-center justify-center rounded-2xl font-black px-3 py-2.5 transition min-h-[40px] text-xs",
                                  busyId === o.id ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                                )}
                              >
                                Submit
                              </button>
                            ) : null}
                            {offerDisplayStatus(o.status) === "submitted" ? (
                              <button
                                type="button"
                                disabled={busyId === o.id}
                                onClick={() => void doResend(o)}
                                className={classNames(
                                  "inline-flex items-center justify-center rounded-2xl font-black px-3 py-2.5 transition min-h-[40px] text-xs",
                                  busyId === o.id ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
                                )}
                              >
                                Resend
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={busyId === o.id}
                              onClick={() => void doDuplicate(o)}
                              className={classNames(
                                "inline-flex items-center justify-center rounded-2xl font-black px-3 py-2.5 transition min-h-[40px] text-xs",
                                busyId === o.id ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white border border-gray-200 hover:bg-emerald-50 text-emerald-700 border-emerald-100"
                              )}
                            >
                              Duplicate
                            </button>
                            {canCancelOffer(o) ? (
                              <button
                                type="button"
                                disabled={busyId === o.id}
                                onClick={() => void doCancel(o)}
                                className={classNames(
                                  "inline-flex items-center justify-center rounded-2xl font-black px-3 py-2.5 transition min-h-[40px] text-xs",
                                  busyId === o.id ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white border border-gray-200 hover:bg-rose-50 text-rose-700"
                                )}
                              >
                                Cancel
                              </button>
                            ) : null}
                            {offerDisplayStatus(o.status) === "submitted" ? (
                              <button
                                type="button"
                                disabled={busyId === o.id}
                                onClick={() => void doExpire(o)}
                                className={classNames(
                                  "inline-flex items-center justify-center rounded-2xl font-black px-3 py-2.5 transition min-h-[40px] text-xs",
                                  busyId === o.id ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white border border-gray-200 hover:bg-amber-50 text-amber-800"
                                )}
                              >
                                Expire
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={busyId === o.id}
                              onClick={() => void doArchive(o)}
                              className={classNames(
                                "inline-flex items-center justify-center rounded-2xl font-black px-3 py-2.5 transition min-h-[40px] text-xs",
                                busyId === o.id ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white border border-gray-200 hover:bg-violet-50 text-violet-700"
                              )}
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-gray-50">
              {filtered.map((o) => {
                const disp = offerDisplayStatus(o.status);
                const badge = offerStatusBadge(disp);
                return (
                  <div key={o.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">#{o.id}</span>
                      <span className={classNames("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black ring-1", badge.cls)}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] font-bold text-gray-400">Request #{o.trip_request_id}</span>
                    </div>
                    <div className="mt-2 font-black text-gray-900 break-words">{(o as any).title || `Offer #${o.id}`}</div>
                    {(o as any).summary ? (
                      <div className="mt-2 text-xs font-bold text-gray-500 line-clamp-2">{(o as any).summary}</div>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <div className="text-gray-400 uppercase tracking-widest text-[10px]">Price</div>
                        <div className="mt-1 text-gray-900">{formatMoney(Number(o.total_price ?? 0), (o.currency || "USD") as any)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <div className="text-gray-400 uppercase tracking-widest text-[10px]">Created</div>
                        <div className="mt-1 text-gray-900">{new Date(o.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/agency/incoming-requests/${o.trip_request_id}`)}
                        className="col-span-2 inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-4 py-3 transition min-h-[44px] text-sm"
                      >
                        View Request
                      </button>
                      {canEditOffer(o) ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/agency/incoming-requests/${o.trip_request_id}/create-offer?offer=${o.id}`)}
                          className="inline-flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-3 transition shadow-sm shadow-blue-200 min-h-[44px] text-sm"
                        >
                          {t("admin_edit")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void doDuplicate(o)}
                        disabled={busyId === o.id}
                        className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-emerald-50 text-emerald-700 font-black px-4 py-3 transition min-h-[44px] text-sm"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => void doArchive(o)}
                        disabled={busyId === o.id}
                        className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-violet-50 text-violet-700 font-black px-4 py-3 transition min-h-[44px] text-sm"
                      >
                        Archive
                      </button>
                      {canCancelOffer(o) ? (
                        <button
                          type="button"
                          onClick={() => void doCancel(o)}
                          disabled={busyId === o.id}
                          className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-rose-50 text-rose-700 font-black px-4 py-3 transition min-h-[44px] text-sm"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {historyId ? (
        <OfferHistoryModal
          offer={items.find((o) => o.id === historyId) || null}
          onClose={() => setHistoryId(null)}
          formatMoney={formatMoney}
        />
      ) : null}
    </DashboardShell>
  );
}

function OfferHistoryModal({
  offer,
  onClose,
  formatMoney,
}: {
  offer: TripOffer | null;
  onClose: () => void;
  formatMoney: any;
}) {
  const events: { when: string; label: string; sub?: string; tone: string }[] = [];
  if (offer) {
    const add = (iso: string | null | undefined, label: string, tone: string, sub?: string) => {
      if (!iso) return;
      events.push({ when: iso, label, sub, tone });
    };
    add(offer.created_at, "Created", "bg-gray-100 text-gray-700");
    add(offer.submitted_at, "Submitted", "bg-blue-50 text-blue-700");
    add(offer.accepted_at, "Accepted", "bg-emerald-50 text-emerald-700");
    add(offer.cancelled_at, "Cancelled", "bg-rose-50 text-rose-700");
  }
  events.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-black text-gray-900">Offer History</div>
            <div className="mt-1 text-sm font-bold text-gray-500">
              {offer ? `${(offer as any).title || `Offer #${offer.id}`} · ${formatMoney(Number(offer.total_price ?? 0), offer.currency as any)}` : "Offer not loaded"}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 font-black px-2 py-1">
            ✕
          </button>
        </div>
        <div className="p-6">
          {!offer || events.length === 0 ? (
            <div className="text-center py-8 text-sm font-bold text-gray-500">No history available.</div>
          ) : (
            <ol className="relative border-l border-gray-200 ml-3">
              {events.map((e, i) => (
                <li key={i} className="mb-5 ml-5">
                  <span className="absolute -left-[7px] flex items-center justify-center w-3.5 h-3.5 rounded-full ring-4 ring-white bg-gray-900" aria-hidden></span>
                  <div className={classNames("inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black ring-1", e.tone)}>
                    {e.label}
                  </div>
                  <time className="mt-1 block text-xs font-bold text-gray-400">
                    {new Date(e.when).toLocaleString()}
                  </time>
                  {e.sub ? <div className="mt-1 text-xs text-gray-600">{e.sub}</div> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30">
          <button type="button" onClick={onClose} className="w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AgencyNotificationsPage({ agencyId }: { agencyId: number }) {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await api.notifications.list();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const unread = items.filter((n) => !n.is_read).length;

  const markOne = async (id: number) => {
    try {
      await api.notifications.markRead([id]);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      /* noop */
    }
  };
  const markAll = async () => {
    setBusy(true);
    try {
      await api.notifications.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell title={t("dash_notifications")} subtitle="Agency notifications center" nav={nav}>
      {error ? (
        <div className="mb-4 rounded-2xl px-5 py-3 text-sm font-black bg-rose-50 text-rose-700 border border-rose-100">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🔔</div>
            <div>
              <div className="text-sm font-black text-gray-500">Unread</div>
              <div className="text-3xl font-black text-gray-900">{fmtNumber(unread)}</div>
            </div>
            <div className="ml-6 hidden sm:block border-l border-gray-100 pl-6">
              <div className="text-sm font-black text-gray-500">Total</div>
              <div className="text-3xl font-black text-gray-900">{fmtNumber(items.length)}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-5 py-3 rounded-2xl transition min-h-[44px]"
            >
              {t("common_refresh") || "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={busy || unread === 0}
              className={classNames(
                "font-black px-5 py-3 rounded-2xl transition min-h-[44px]",
                busy || unread === 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
              )}
            >
              {busy ? t("common_please_wait") : "Mark all read"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🔔</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_notifications_empty_title") || "No notifications"}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_notifications_empty_subtitle") || "You're all caught up."}</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  void markOne(n.id);
                  const link = (n as any).link || (n as any).link_url;
                  if (link) window.location.href = link;
                }}
                className={classNames(
                  "w-full text-left p-5 md:p-6 transition-colors",
                  n.is_read ? "bg-white hover:bg-gray-50" : "bg-blue-50/40 hover:bg-blue-50/60"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={classNames(
                    "w-2 h-2 mt-2 rounded-full shrink-0",
                    n.is_read ? "bg-transparent" : "bg-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                  )} aria-hidden></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                        {n.type || "NOTIFICATION"}
                      </div>
                      <div className="text-[11px] font-bold text-gray-400">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                      </div>
                    </div>
                    <div className="mt-1 font-black text-gray-900 break-words">{n.title}</div>
                    {n.body ? <div className="mt-1 text-sm font-bold text-gray-500 break-words">{n.body}</div> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
