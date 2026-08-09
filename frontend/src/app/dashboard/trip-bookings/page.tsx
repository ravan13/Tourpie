"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripBooking, getStoredToken, loadCurrentUser } from "@/lib/api";
import { userNav, agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@/lib/api";

const BOOKING_STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  payment_pending: "Payment Pending",
  payment_received: "Payment Received",
  paid: "Paid",
  preparing: "Preparing",
  ready: "Ready",
  travelling: "Travelling",
  completed: "Completed",
  reviewed: "Reviewed",
  cancelled: "Cancelled",
};

function statusBadgeClass(s: string): string {
  switch (s) {
    case "confirmed":
    case "paid":
    case "ready":
    case "completed":
    case "reviewed":
      return "bg-green-50 text-green-700 border-green-100";
    case "payment_pending":
    case "payment_received":
    case "preparing":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "travelling":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function fmtPrice(amount?: number | null, currency?: string | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(amount));
  } catch {
    return `${currency || "USD"} ${amount}`;
  }
}

export default function DashboardTripBookingsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<TripBooking[]>([]);
  const [tab, setTab] = useState<string>("all");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const u = await loadCurrentUser();
        setUser(u);
        const rows = await api.tripMarketplace.listMyBookings();
        setBookings(rows);
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nav = useMemo(() => {
    if (user?.role === "agency") return agencyNav(t);
    return userNav(t);
  }, [t, user?.role]);

  const TABS = [
    { key: "all", label: "All" },
    { key: "confirmed", label: "Confirmed" },
    { key: "payment_pending", label: "Payment Pending" },
    { key: "paid", label: "Paid" },
    { key: "travelling", label: "Travelling" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ] as const;

  const filtered = useMemo(() => {
    const base = bookings.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (tab === "all") return base;
    return base.filter((r) => r.status === tab);
  }, [bookings, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length };
    for (const b of bookings) c[b.status] = (c[b.status] || 0) + 1;
    return c;
  }, [bookings]);

  return (
    <DashboardShell title={t("dash_bookings")} subtitle="Manage your marketplace trip bookings" nav={nav}>
      <div className="space-y-6">
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 -mx-1 px-1 overflow-x-auto">
            {TABS.map((tb) => {
              const active = tab === tb.key;
              const cnt = counts[tb.key] || 0;
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setTab(tb.key)}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition-all ${
                    active ? "bg-gray-900 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100"
                  }`}
                >
                  <span>{tb.label}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${active ? "bg-white/20 text-white" : "bg-white text-gray-500 border border-gray-100"}`}>
                    {cnt}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-16 text-center font-bold text-gray-500">{t("common_loading")}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-6xl mb-4">🧾</div>
              <div className="text-xl font-black text-gray-900">No bookings yet</div>
              <div className="mt-2 text-gray-500 font-medium">Trip marketplace bookings will appear here</div>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((b) => (
                <Link
                  key={b.id}
                  href={`/dashboard/trip-bookings/${b.id}`}
                  className="block rounded-3xl border border-gray-100 p-5 sm:p-6 hover:shadow-lg transition-all group"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <span>🧾</span>
                          {b.booking_code || `#${b.id}`}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black border ${statusBadgeClass(b.status)}`}>
                          {BOOKING_STATUS_LABEL[b.status] || b.status}
                        </span>
                      </div>
                      <div className="text-xl font-black text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                        {b.destination || "Trip Booking"}
                      </div>
                      <div className="mt-1 text-sm text-gray-500 font-medium truncate">
                        {b.agency_name ? `with ${b.agency_name}` : "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black text-gray-900">{fmtPrice(b.total_price, b.currency)}</div>
                      <div className="mt-1 text-sm text-gray-500 font-medium">
                        {fmtDate(b.start_date)} → {fmtDate(b.end_date)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl bg-gray-50/60 p-3 border border-gray-100">
                      <div className="text-xs text-gray-500 font-semibold">Documents</div>
                      <div className="mt-1 text-lg font-black text-gray-900">
                        {b.documents_count || 0}
                        {b.pending_documents_count ? (
                          <span className="ml-1 text-xs font-bold text-amber-600">/ {b.pending_documents_count} pending</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-gray-50/60 p-3 border border-gray-100">
                      <div className="text-xs text-gray-500 font-semibold">Payments</div>
                      <div className="mt-1 text-lg font-black text-gray-900">{b.payments_count || 0}</div>
                    </div>
                    <div className="rounded-2xl bg-gray-50/60 p-3 border border-gray-100">
                      <div className="text-xs text-gray-500 font-semibold">Checklist</div>
                      <div className="mt-1 text-lg font-black text-gray-900">
                        {b.checklist_completed || 0}/{b.checklist_total || 0}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-gray-50/60 p-3 border border-gray-100">
                      <div className="text-xs text-gray-500 font-semibold">Review</div>
                      <div className="mt-1 text-lg font-black text-gray-900">
                        {b.review_submitted ? "✅ Done" : "—"}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
