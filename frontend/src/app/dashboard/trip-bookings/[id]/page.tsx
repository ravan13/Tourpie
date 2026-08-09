"use client";

import DashboardShell from "@/components/DashboardShell";
import {
  api,
  TripBookingDocument,
  TripBookingChecklistItem,
  TripBookingMessage,
  TripBookingPaymentRecord,
  TripBookingReview,
  TripBookingTimelineEvent,
  TripBookingWorkspace,
  loadCurrentUser,
  getStoredToken,
} from "@/lib/api";
import type { User } from "@/lib/api";
import { userNav, agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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

const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  uploaded: "Uploaded",
  viewed: "Viewed",
  approved: "Approved",
  rejected: "Rejected",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  voucher: "Voucher",
  flight_ticket: "Flight Ticket",
  hotel_confirmation: "Hotel Confirmation",
  insurance: "Insurance",
  invoice: "Invoice",
  travel_program: "Travel Program",
  visa_document: "Visa Documents",
  other: "Other",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  waiting_payment: "Waiting Payment",
  payment_sent: "Payment Sent",
  agency_confirmed: "Agency Confirmed",
  customer_confirmed: "Customer Confirmed",
  completed: "Completed",
};

const EVENT_LABEL: Record<string, string> = {
  request_created: "Request Created",
  booking_created: "Booking Created",
  offer_accepted: "Offer Accepted",
  payment_pending: "Payment Pending",
  payment_confirmed: "Payment Confirmed",
  booking_confirmed: "Booking Confirmed",
  documents_uploaded: "Documents Uploaded",
  document_approved: "Document Approved",
  document_rejected: "Document Rejected",
  trip_started: "Trip Started",
  trip_completed: "Trip Completed",
  review_submitted: "Review Submitted",
  status_confirmed: "Status: Confirmed",
  status_payment_pending: "Status: Payment Pending",
  status_payment_received: "Status: Payment Received",
  status_paid: "Status: Paid",
  status_preparing: "Status: Preparing",
  status_ready: "Status: Ready",
  status_travelling: "Status: Travelling",
  status_completed: "Status: Completed",
  status_reviewed: "Status: Reviewed",
  status_cancelled: "Status: Cancelled",
  payment_updated: "Payment Updated",
  message_sent: "Message Sent",
};

const DOC_TYPES = Object.entries(DOC_TYPE_LABEL).map(([k, v]) => ({ key: k, label: v }));
const PAYMENT_METHODS = ["Bank Transfer", "Credit Card", "Cash", "PayPal", "Cryptocurrency", "Other"];

function statusBadgeClass(s: string, map: "booking" | "doc" | "payment" = "booking"): string {
  if (map === "doc") {
    switch (s) {
      case "approved":
        return "bg-green-50 text-green-700 border-green-100";
      case "uploaded":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "viewed":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "rejected":
        return "bg-red-50 text-red-700 border-red-100";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  }
  if (map === "payment") {
    switch (s) {
      case "completed":
        return "bg-green-50 text-green-700 border-green-100";
      case "agency_confirmed":
      case "customer_confirmed":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "payment_sent":
        return "bg-blue-50 text-blue-700 border-blue-100";
      default:
        return "bg-amber-50 text-amber-700 border-amber-100";
    }
  }
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

function fmt(s?: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
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
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(amount));
  } catch {
    return `${currency || "USD"} ${amount}`;
  }
}

function star(n: number): string {
  const full = Math.max(0, Math.min(5, Math.round(n)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

const TABS = [
  { key: "overview", label: "Overview", icon: "🏠" },
  { key: "timeline", label: "Timeline", icon: "⏱️" },
  { key: "offer", label: "Offer", icon: "🎁" },
  { key: "documents", label: "Documents", icon: "📄" },
  { key: "payment", label: "Payment", icon: "💳" },
  { key: "checklist", label: "Checklist", icon: "✅" },
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "notes", label: "Notes", icon: "📝" },
  { key: "agreement", label: "Agreement", icon: "📜" },
  { key: "review", label: "Review", icon: "⭐" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function DashboardTripBookingWorkspacePage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const idRaw = params?.id;
  const bookingId = typeof idRaw === "string" ? Number(idRaw) : Array.isArray(idRaw) ? Number(idRaw[0]) : NaN;

  const [loading, setLoading] = useState(true);
  const [ws, setWs] = useState<TripBookingWorkspace | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Documents state
  const [docType, setDocType] = useState<string>("voucher");
  const [docFilename, setDocFilename] = useState<string>("");
  const [docUrl, setDocUrl] = useState<string>("");
  const [docNote, setDocNote] = useState<string>("");

  // Payment state
  const [pmtStatus, setPmtStatus] = useState<string>("waiting_payment");
  const [pmtMethod, setPmtMethod] = useState<string>("Bank Transfer");
  const [pmtRef, setPmtRef] = useState<string>("");
  const [pmtAmount, setPmtAmount] = useState<string>("");
  const [pmtCurrency, setPmtCurrency] = useState<string>("USD");
  const [pmtDate, setPmtDate] = useState<string>("");
  const [pmtNote, setPmtNote] = useState<string>("");

  // Checklist
  const [newItemLabel, setNewItemLabel] = useState<string>("");
  const [newItemRec, setNewItemRec] = useState<boolean>(false);

  // Chat
  const [chatDraft, setChatDraft] = useState<string>("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Notes
  const [notesDraft, setNotesDraft] = useState<string>("");

  // Review
  const [revRating, setRevRating] = useState<number>(5);
  const [revComment, setRevComment] = useState<string>("");
  const [revStory, setRevStory] = useState<string>("");
  const [revPhotos, setRevPhotos] = useState<string>("");
  const [agencyRespDraft, setAgencyRespDraft] = useState<string>("");

  const flashToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2400);
  };

  const refresh = async () => {
    if (!Number.isFinite(bookingId)) return;
    try {
      const w = await api.tripMarketplace.getBookingWorkspace(bookingId);
      setWs(w);
      // Hydrate draft fields from first records where applicable
      if (w.payments?.[0]) {
        const p = w.payments[0];
        setPmtStatus(p.status || "waiting_payment");
        setPmtMethod(p.payment_method || "Bank Transfer");
        setPmtRef(p.reference_number || "");
        setPmtAmount(p.amount != null ? String(p.amount) : "");
        setPmtCurrency(p.currency || w.booking.currency || "USD");
        setPmtDate(p.payment_date ? p.payment_date.slice(0, 10) : "");
        setPmtNote(p.note || "");
      } else {
        setPmtCurrency(w.booking.currency || "USD");
        if (w.booking.total_price != null) setPmtAmount(String(w.booking.total_price));
      }
      setNotesDraft(w.booking.notes || "");
    } catch (e) {
      setWs(null);
      flashToast("err", "Failed to load booking");
    }
  };

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token || !Number.isFinite(bookingId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [u] = await Promise.all([loadCurrentUser()]);
        setUser(u);
        await refresh();
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [ws?.messages?.length]);

  const nav = useMemo(() => {
    if (user?.role === "agency") return agencyNav(t);
    return userNav(t);
  }, [t, user?.role]);

  const isAgency = user?.role === "agency";
  const isUser = user?.role === "user";
  const isAdmin = user?.role === "admin";
  const booking = ws?.booking;
  const req = ws?.trip_request;
  const ofr = ws?.trip_offer;
  const timeline = ws?.timeline || [];
  const documents = ws?.documents || [];
  const payments = ws?.payments || [];
  const checklist = ws?.checklist || [];
  const messages = ws?.messages || [];
  const review = ws?.review || null;
  const agreement = ws?.agreement_snapshot || booking?.agreement || null;

  const completedFor: TripBookingPaymentRecord | undefined = payments[0];
  const agencyConfirmed = !!completedFor?.agency_confirmed_at;
  const customerConfirmed = !!completedFor?.customer_confirmed_at;
  const checklistTotal = checklist.length || booking?.checklist_total || 0;
  const checklistCompleted = checklist.filter((i) => i.is_completed).length || booking?.checklist_completed || 0;
  const bookingCompletedOrReviewed = booking?.status === "completed" || booking?.status === "reviewed" || !!booking?.trip_completed_at;

  const setStatus = async (next: string) => {
    if (!booking || busy) return;
    setBusy("status");
    try {
      await api.tripMarketplace.setBookingStatus(booking.id, next);
      await refresh();
      flashToast("ok", `Status updated to ${BOOKING_STATUS_LABEL[next] || next}`);
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const saveNotes = async () => {
    if (!booking || busy) return;
    setBusy("notes");
    try {
      await api.tripMarketplace.setBookingNotes(booking.id, notesDraft || null);
      await refresh();
      flashToast("ok", "Notes saved");
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const uploadDocument = async () => {
    if (!booking || busy) return;
    const file_url = docUrl.trim();
    if (!file_url) {
      flashToast("err", "File URL is required");
      return;
    }
    setBusy("doc");
    try {
      await api.tripMarketplace.uploadBookingDocument(booking.id, {
        document_type: docType,
        filename: docFilename.trim() || null,
        file_url,
        note: docNote.trim() || null,
      });
      setDocFilename("");
      setDocUrl("");
      setDocNote("");
      await refresh();
      flashToast("ok", "Document uploaded");
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const setDocStatus = async (doc: TripBookingDocument, status: string) => {
    if (!booking || busy) return;
    setBusy(`doc-${doc.id}`);
    try {
      await api.tripMarketplace.setBookingDocumentStatus(booking.id, doc.id, status);
      await refresh();
      flashToast("ok", `Document ${DOC_STATUS_LABEL[status] || status}`);
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const upsertPayment = async (opts?: { agency_confirm?: boolean; customer_confirm?: boolean }) => {
    if (!booking || busy) return;
    setBusy("payment");
    try {
      const amount = pmtAmount.trim() !== "" && Number.isFinite(Number(pmtAmount)) ? Number(pmtAmount) : null;
      await api.tripMarketplace.upsertBookingPayment(booking.id, {
        status: pmtStatus || null,
        payment_method: pmtMethod || null,
        reference_number: pmtRef.trim() || null,
        amount,
        currency: pmtCurrency || null,
        payment_date: pmtDate || null,
        note: pmtNote.trim() || null,
        agency_confirm: opts?.agency_confirm ? true : null,
        customer_confirm: opts?.customer_confirm ? true : null,
      });
      await refresh();
      flashToast("ok", "Payment tracking updated");
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const toggleCheck = async (item: TripBookingChecklistItem) => {
    if (!booking || busy) return;
    setBusy(`chk-${item.id}`);
    try {
      await api.tripMarketplace.updateBookingChecklist(booking.id, {
        item_id: item.id,
        is_completed: !item.is_completed,
      });
      await refresh();
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const toggleRec = async (item: TripBookingChecklistItem) => {
    if (!booking || busy) return;
    setBusy(`chkr-${item.id}`);
    try {
      await api.tripMarketplace.updateBookingChecklist(booking.id, {
        item_id: item.id,
        is_recommended: !item.is_recommended,
      });
      await refresh();
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const addChecklistItem = async () => {
    if (!booking || busy) return;
    const label = newItemLabel.trim();
    if (!label) return;
    setBusy("chka");
    try {
      await api.tripMarketplace.addBookingChecklist(booking.id, label, !!newItemRec);
      setNewItemLabel("");
      setNewItemRec(false);
      await refresh();
      flashToast("ok", "Item added");
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const sendMessage = async () => {
    if (!booking || busy) return;
    const content = chatDraft.trim();
    if (!content) return;
    setBusy("msg");
    try {
      await api.tripMarketplace.sendBookingMessage(booking.id, content);
      setChatDraft("");
      await refresh();
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const submitReview = async () => {
    if (!booking || busy) return;
    if (revRating < 1 || revRating > 5) {
      flashToast("err", "Rating must be 1-5");
      return;
    }
    setBusy("review");
    try {
      const photosList = revPhotos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await api.tripMarketplace.submitBookingReview(booking.id, {
        rating: revRating,
        comment: revComment.trim() || null,
        photos: photosList.length ? photosList : null,
        trip_story: revStory.trim() || null,
      });
      flashToast("ok", "Review submitted");
      await refresh();
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  const submitAgencyResponse = async () => {
    if (!booking || busy) return;
    const body = agencyRespDraft.trim();
    if (!body) return;
    setBusy("agencyResp");
    try {
      await api.tripMarketplace.agencyReviewResponse(booking.id, body);
      setAgencyRespDraft("");
      flashToast("ok", "Response submitted");
      await refresh();
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardShell title="Trip Booking Workspace" subtitle={booking?.booking_code || "Loading..."} nav={nav}>
      <div className="space-y-6">
        {toast ? (
          <div
            className={`rounded-2xl px-5 py-3 text-sm font-black ${
              toast.type === "ok" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
            }`}
          >
            {toast.text}
          </div>
        ) : null}

        {loading ? (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-16 text-center font-bold text-gray-500">
            {t("common_loading")}
          </div>
        ) : !ws || !booking ? (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-16 text-center">
            <div className="text-6xl mb-4">🧭</div>
            <div className="text-xl font-black text-gray-900">Booking not found or access denied</div>
            <div className="mt-2 text-gray-500 font-medium">You may not have permission to view this booking.</div>
            <div className="mt-8 flex justify-center">
              <Link href="/dashboard/trip-bookings" className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-6 py-3 font-black">
                ← Back to Bookings
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                      🧾 {booking.booking_code || `#${booking.id}`}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black border ${statusBadgeClass(
                        booking.status,
                        "booking"
                      )}`}
                    >
                      {BOOKING_STATUS_LABEL[booking.status] || booking.status}
                    </span>
                    <Link
                      href="/dashboard/trip-bookings"
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900 bg-gray-50 border border-gray-100"
                    >
                      ← All Bookings
                    </Link>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight break-words">
                    {booking.destination || "Trip Booking"}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500 font-medium">
                    <span>
                      📅 {fmtDate(booking.start_date)} → {fmtDate(booking.end_date)}
                      {booking.duration ? ` · ${booking.duration} nights` : ""}
                    </span>
                    <span>
                      🏢 {booking.agency_name || "Agency"}
                      {booking.agency_rating ? ` · ${star(booking.agency_rating)} (${booking.agency_reviews_count || 0})` : ""}
                    </span>
                    <span>📝 Request: {booking.request_code || `#${booking.trip_request_id}`}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-4xl sm:text-5xl font-black text-gray-900">
                    {fmtPrice(booking.total_price, booking.currency)}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 font-semibold">Accepted {fmt(booking.accepted_at || booking.created_at)}</div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-white p-4 border border-indigo-100">
                  <div className="text-xs text-indigo-600 font-semibold">Documents</div>
                  <div className="mt-1 text-2xl font-black text-gray-900">
                    {booking.documents_count ?? documents.length}
                    {booking.pending_documents_count ? (
                      <span className="ml-1 text-xs font-bold text-amber-600">/ {booking.pending_documents_count}</span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 border border-emerald-100">
                  <div className="text-xs text-emerald-600 font-semibold">Payment</div>
                  <div className="mt-1 text-2xl font-black text-gray-900 capitalize">
                    {PAYMENT_STATUS_LABEL[completedFor?.status || "waiting_payment"] || completedFor?.status || "Waiting"}
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-4 border border-amber-100">
                  <div className="text-xs text-amber-600 font-semibold">Checklist</div>
                  <div className="mt-1 text-2xl font-black text-gray-900">
                    {checklistCompleted}/{checklistTotal}
                  </div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-white p-4 border border-rose-100">
                  <div className="text-xs text-rose-600 font-semibold">Review</div>
                  <div className="mt-1 text-2xl font-black text-gray-900">
                    {review ? "✅ Done" : bookingCompletedOrReviewed ? "📝 Ready" : "—"}
                  </div>
                </div>
              </div>

              {(isAgency || isAdmin) && booking.status !== "cancelled" && booking.status !== "reviewed" ? (
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <div className="text-sm font-black text-gray-900 mb-3">Agency Status Controls</div>
                  <div className="flex flex-wrap gap-2">
                    {["preparing", "ready", "travelling", "completed", "cancelled"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy === "status"}
                        onClick={() => setStatus(s)}
                        className={`rounded-full px-4 py-2 text-sm font-black transition-all disabled:opacity-50 ${
                          booking.status === s
                            ? "bg-gray-900 text-white shadow"
                            : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        Mark {BOOKING_STATUS_LABEL[s] || s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-3 sm:p-4">
              <div className="flex gap-1 sm:gap-2 overflow-x-auto -mx-1 px-1">
                {TABS.map((tb) => {
                  const active = tab === tb.key;
                  if (tb.key === "review" && !bookingCompletedOrReviewed && !review) return null;
                  return (
                    <button
                      key={tb.key}
                      type="button"
                      onClick={() => setTab(tb.key)}
                      className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-black transition-all ${
                        active ? "bg-gray-900 text-white shadow-md" : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span>{tb.icon}</span>
                      <span>{tb.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {tab === "overview" ? (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                  <div className="text-lg font-black text-gray-900 mb-4">Booking Summary</div>
                  <dl className="space-y-3 text-sm">
                    {[
                      ["Booking Code", booking.booking_code || `#${booking.id}`],
                      ["Status", BOOKING_STATUS_LABEL[booking.status] || booking.status],
                      ["Destination", booking.destination || "—"],
                      ["Travel Period", `${fmtDate(booking.start_date)} → ${fmtDate(booking.end_date)}`],
                      ["Duration", booking.duration ? `${booking.duration} nights` : "—"],
                      ["Agency", booking.agency_name || "—"],
                      ["Request Ref", booking.request_code || `#${booking.trip_request_id}`],
                      ["Total", fmtPrice(booking.total_price, booking.currency)],
                      ["Accepted", fmt(booking.accepted_at || booking.created_at)],
                      ["Trip Started", booking.trip_started_at ? fmt(booking.trip_started_at) : "—"],
                      ["Trip Completed", booking.trip_completed_at ? fmt(booking.trip_completed_at) : "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                        <dt className="text-gray-500 font-semibold shrink-0">{k}</dt>
                        <dd className="text-gray-900 font-bold text-right break-words">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="space-y-6">
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-lg font-black text-gray-900">Recent Activity</div>
                      <button
                        type="button"
                        onClick={() => setTab("timeline")}
                        className="text-xs font-black text-indigo-600 hover:text-indigo-700"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="space-y-3">
                      {timeline.slice(-5).reverse().map((ev) => (
                        <TimelineRow key={ev.id} ev={ev} compact />
                      ))}
                      {!timeline.length ? <div className="text-sm text-gray-500 font-medium">No activity yet.</div> : null}
                    </div>
                  </div>
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-lg font-black text-gray-900">Checklist Progress</div>
                      <button
                        type="button"
                        onClick={() => setTab("checklist")}
                        className="text-xs font-black text-indigo-600 hover:text-indigo-700"
                      >
                        Open →
                      </button>
                    </div>
                    {checklistTotal > 0 ? (
                      <>
                        <div className="text-3xl font-black text-gray-900 mb-3">
                          {checklistCompleted}
                          <span className="text-xl text-gray-400">/{checklistTotal}</span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (checklistCompleted / Math.max(1, checklistTotal)) * 100)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 font-medium">No checklist items yet.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "timeline" ? (
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                <div className="text-lg font-black text-gray-900 mb-6">Booking Timeline</div>
                {timeline.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 font-medium">No events yet.</div>
                ) : (
                  <div className="relative pl-6 sm:pl-10">
                    <div className="absolute left-2 sm:left-4 top-1 bottom-1 w-0.5 bg-gradient-to-b from-indigo-200 via-indigo-200 to-transparent" />
                    <div className="space-y-6">
                      {timeline.map((ev) => (
                        <TimelineRow key={ev.id} ev={ev} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {tab === "offer" ? (
              <div className="space-y-6">
                {ofr ? (
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Accepted Offer</div>
                        <div className="text-2xl font-black text-gray-900 mt-1">Offer #{ofr.id as number}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-gray-900">
                          {fmtPrice(
                            (ofr as any).total_price ?? (ofr as any).price,
                            (ofr as any).currency || booking.currency
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-semibold mt-1">
                          Expires: {fmt((ofr as any).expires_at || (ofr as any).expiration_date)}
                        </div>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {[
                        ["Hotel", (ofr as any).hotel],
                        ["Stars", (ofr as any).hotel_stars ? `${(ofr as any).hotel_stars} ★` : null],
                        ["Room", (ofr as any).room_type],
                        ["Meal Plan", (ofr as any).meal_plan],
                        ["Flight", (ofr as any).flight],
                        ["Transfer", (ofr as any).transfer],
                        ["Visa Support", (ofr as any).visa],
                        ["Insurance", (ofr as any).insurance],
                      ].map(([k, v]) =>
                        v ? (
                          <div key={k as string} className="rounded-2xl bg-gray-50/60 p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 font-semibold">{k as string}</div>
                            <div className="mt-0.5 font-bold text-gray-900 break-words">{String(v)}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                    {["offer_description", "included_services", "excluded_services", "travel_program", "activities", "additional_benefits", "notes"].map(
                      (k) => {
                        const v = (ofr as any)[k];
                        if (!v) return null;
                        const title = k
                          .split("_")
                          .map((x) => x[0]?.toUpperCase() + x.slice(1))
                          .join(" ");
                        return (
                          <div key={k} className="mt-5 rounded-2xl border border-gray-100 p-5">
                            <div className="text-sm font-black text-gray-900 mb-2">{title}</div>
                            <div className="text-sm text-gray-700 font-medium whitespace-pre-wrap break-words">{String(v)}</div>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : null}
                {req ? (
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                    <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">Trip Request</div>
                    <div className="text-2xl font-black text-gray-900 mt-1 mb-4">
                      {(req as any).destination_country || (req as any).destination || "Request"}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {[
                        ["Code", (req as any).request_code || `#${(req as any).id}`],
                        ["Country", (req as any).destination_country],
                        ["City", (req as any).destination_city],
                        ["Dates", `${fmtDate((req as any).start_date)} → ${fmtDate((req as any).end_date)}`],
                        ["Travellers", (req as any).travelers_count || (req as any).people_count],
                        ["Budget", (req as any).budget ? fmtPrice((req as any).budget, (req as any).currency) : null],
                      ].map(([k, v]) =>
                        v ? (
                          <div key={k} className="rounded-2xl bg-gray-50/60 p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 font-semibold">{k}</div>
                            <div className="mt-0.5 font-bold text-gray-900 break-words">{String(v)}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "documents" ? (
              <div className="space-y-6">
                {(isAgency || isAdmin) ? (
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                    <div className="text-lg font-black text-gray-900 mb-4">Upload Document</div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <label className="block">
                        <div className="text-xs font-bold text-gray-500 mb-1.5">Document Type</div>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 focus:border-indigo-500 focus:ring-0 outline-none"
                        >
                          {DOC_TYPES.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <div className="text-xs font-bold text-gray-500 mb-1.5">Filename (optional)</div>
                        <input
                          type="text"
                          value={docFilename}
                          onChange={(e) => setDocFilename(e.target.value)}
                          placeholder="e.g. hotel_voucher.pdf"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <div className="text-xs font-bold text-gray-500 mb-1.5">File URL</div>
                        <input
                          type="text"
                          value={docUrl}
                          onChange={(e) => setDocUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <div className="text-xs font-bold text-gray-500 mb-1.5">Note (optional)</div>
                        <textarea
                          rows={2}
                          value={docNote}
                          onChange={(e) => setDocNote(e.target.value)}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none resize-y"
                          placeholder="Any additional details..."
                        />
                      </label>
                    </div>
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={uploadDocument}
                        className="rounded-full bg-gray-900 text-white px-6 py-3 text-sm font-black disabled:opacity-50"
                      >
                        {busy === "doc" ? "Uploading..." : "Upload Document"}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-lg font-black text-gray-900">Documents ({documents.length})</div>
                  </div>
                  {documents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 font-medium">
                      No documents uploaded yet.
                      {(isAgency || isAdmin) ? " Use the form above to upload." : ""}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((d) => (
                        <div
                          key={d.id}
                          className="rounded-2xl border border-gray-100 p-4 sm:p-5 flex flex-wrap items-start gap-4 hover:shadow-sm transition-all"
                        >
                          <div className="shrink-0 w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl border border-indigo-100">
                            📄
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-black text-gray-900 break-words">
                                {d.filename || DOC_TYPE_LABEL[d.document_type] || d.document_type}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black border ${statusBadgeClass(
                                  d.status,
                                  "doc"
                                )}`}
                              >
                                {DOC_STATUS_LABEL[d.status] || d.status}
                              </span>
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                {DOC_TYPE_LABEL[d.document_type] || d.document_type}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 font-medium">
                              Uploaded by {d.uploader_display_name || "Agency"} · {fmt(d.created_at)}
                            </div>
                            {d.note ? (
                              <div className="mt-2 text-sm text-gray-600 font-medium break-words">{d.note}</div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={
                                isUser && d.status === "uploaded"
                                  ? async () => {
                                      await setDocStatus(d, "viewed").catch(() => undefined);
                                    }
                                  : undefined
                              }
                              className="rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-xs font-black text-gray-700 hover:bg-gray-100"
                            >
                              View ↗
                            </a>
                            <a
                              href={d.file_url}
                              download
                              className="rounded-full bg-indigo-50 border border-indigo-100 px-4 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                            >
                              Download ⬇
                            </a>
                            {isUser || isAdmin ? (
                              <>
                                <button
                                  type="button"
                                  disabled={!!busy}
                                  onClick={() => setDocStatus(d, "approved")}
                                  className="rounded-full bg-green-50 border border-green-100 px-4 py-2 text-xs font-black text-green-700 hover:bg-green-100 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={!!busy}
                                  onClick={() => setDocStatus(d, "rejected")}
                                  className="rounded-full bg-red-50 border border-red-100 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "payment" ? (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                  <div className="text-lg font-black text-gray-900 mb-4">Payment Tracking</div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block">
                      <div className="text-xs font-bold text-gray-500 mb-1.5">Status</div>
                      <select
                        value={pmtStatus}
                        onChange={(e) => setPmtStatus(e.target.value)}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 focus:border-indigo-500 focus:ring-0 outline-none"
                      >
                        {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-xs font-bold text-gray-500 mb-1.5">Method</div>
                      <select
                        value={pmtMethod}
                        onChange={(e) => setPmtMethod(e.target.value)}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 focus:border-indigo-500 focus:ring-0 outline-none"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-xs font-bold text-gray-500 mb-1.5">Reference #</div>
                      <input
                        type="text"
                        value={pmtRef}
                        onChange={(e) => setPmtRef(e.target.value)}
                        placeholder="TXN123..."
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none"
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs font-bold text-gray-500 mb-1.5">Date</div>
                      <input
                        type="date"
                        value={pmtDate}
                        onChange={(e) => setPmtDate(e.target.value)}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 focus:border-indigo-500 focus:ring-0 outline-none"
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs font-bold text-gray-500 mb-1.5">Amount</div>
                      <input
                        type="number"
                        step="0.01"
                        value={pmtAmount}
                        onChange={(e) => setPmtAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none"
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs font-bold text-gray-500 mb-1.5">Currency</div>
                      <input
                        type="text"
                        value={pmtCurrency}
                        onChange={(e) => setPmtCurrency(e.target.value.toUpperCase())}
                        placeholder="USD"
                        maxLength={6}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <div className="text-xs font-bold text-gray-500 mb-1.5">Note (optional)</div>
                      <textarea
                        rows={2}
                        value={pmtNote}
                        onChange={(e) => setPmtNote(e.target.value)}
                        placeholder="Add payment notes..."
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none resize-y"
                      />
                    </label>
                  </div>
                  <div className="mt-6 grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => upsertPayment()}
                      className="rounded-full bg-gray-900 text-white px-5 py-3 text-sm font-black disabled:opacity-50"
                    >
                      {busy === "payment" ? "Saving..." : "Save Payment Details"}
                    </button>
                    <div className="flex gap-2">
                      {isAgency || isAdmin ? (
                        <button
                          type="button"
                          disabled={!!busy || agencyConfirmed}
                          onClick={() => upsertPayment({ agency_confirm: true })}
                          className="flex-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 px-5 py-3 text-sm font-black disabled:opacity-50 hover:bg-indigo-100"
                        >
                          {agencyConfirmed ? "✓ Agency Confirmed" : "Agency Confirm"}
                        </button>
                      ) : null}
                      {isUser || isAdmin ? (
                        <button
                          type="button"
                          disabled={!!busy || customerConfirmed}
                          onClick={() => upsertPayment({ customer_confirm: true })}
                          className="flex-1 rounded-full bg-green-50 border border-green-200 text-green-700 px-5 py-3 text-sm font-black disabled:opacity-50 hover:bg-green-100"
                        >
                          {customerConfirmed ? "✓ Customer Confirmed" : "Customer Confirm"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                    <div className="text-lg font-black text-gray-900 mb-4">Payment Status</div>
                    <div className="space-y-3">
                      {[
                        ["waiting_payment", "Waiting Payment", "Customer initiates payment"],
                        ["payment_sent", "Payment Sent", "Customer confirms sending"],
                        ["agency_confirmed", "Agency Confirmed", "Agency received funds"],
                        ["customer_confirmed", "Customer Confirmed", "Customer confirms delivery"],
                        ["completed", "Completed", "Booking fully paid"],
                      ].map(([k, title, desc]) => {
                        const active = completedFor?.status === k;
                        const passed =
                          completedFor?.status === "completed" ||
                          (completedFor?.status === k) ||
                          (["agency_confirmed", "customer_confirmed", "completed"].includes(completedFor?.status || "") &&
                            ["waiting_payment", "payment_sent"].includes(k)) ||
                          (["customer_confirmed", "completed"].includes(completedFor?.status || "") && k === "agency_confirmed") ||
                          (completedFor?.status === "completed" && k === "customer_confirmed");
                        return (
                          <div
                            key={k}
                            className={`rounded-2xl border p-4 ${
                              active
                                ? "bg-indigo-50/60 border-indigo-200"
                                : passed
                                  ? "bg-green-50/40 border-green-100"
                                  : "bg-gray-50/40 border-gray-100"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                                    active
                                      ? "bg-indigo-600 text-white"
                                      : passed
                                        ? "bg-green-500 text-white"
                                        : "bg-gray-200 text-gray-500"
                                  }`}
                                >
                                  {passed ? "✓" : k[0]?.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-black text-gray-900 text-sm truncate">{title}</div>
                                  <div className="text-xs text-gray-500 font-medium truncate">{desc}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {completedFor ? (
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                      <div className="text-sm font-black text-gray-900 mb-4">Confirmations</div>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-semibold">Agency</span>
                          <span className={`font-black ${agencyConfirmed ? "text-green-600" : "text-gray-400"}`}>
                            {agencyConfirmed ? `✓ ${fmt(completedFor.agency_confirmed_at)}` : "Pending"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 font-semibold">Customer</span>
                          <span className={`font-black ${customerConfirmed ? "text-green-600" : "text-gray-400"}`}>
                            {customerConfirmed ? `✓ ${fmt(completedFor.customer_confirmed_at)}` : "Pending"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "checklist" ? (
              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                    <div>
                      <div className="text-lg font-black text-gray-900 mb-1">Travel Checklist</div>
                      <div className="text-sm text-gray-500 font-medium">
                        {checklistCompleted} of {checklistTotal} items completed
                      </div>
                    </div>
                    <div className="w-full sm:w-80">
                      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
                          style={{
                            width: checklistTotal
                              ? `${Math.min(100, (checklistCompleted / checklistTotal) * 100)}%`
                              : "0%",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  {checklist.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 font-medium">No checklist items.</div>
                  ) : (
                    <div className="space-y-2">
                      {checklist.map((it) => (
                        <div
                          key={it.id}
                          className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-3 transition-all ${
                            it.is_completed ? "bg-green-50/60 border-green-100" : "bg-white border-gray-100"
                          }`}
                        >
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => toggleCheck(it)}
                            className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all disabled:opacity-50 ${
                              it.is_completed
                                ? "bg-green-600 border-green-600 text-white"
                                : "border-gray-300 text-transparent hover:border-indigo-400"
                            }`}
                          >
                            ✓
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`font-black text-gray-900 break-words ${
                                it.is_completed ? "line-through decoration-green-400 decoration-2" : ""
                              }`}
                            >
                              {it.label}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {it.is_recommended ? (
                                <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[10px] font-black border border-amber-100">
                                  ⭐ Recommended
                                </span>
                              ) : null}
                              {it.is_completed && it.completed_at ? (
                                <span className="text-[10px] font-bold text-gray-500">
                                  Done {fmt(it.completed_at)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {(isAgency || isAdmin) ? (
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => toggleRec(it)}
                              className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black border disabled:opacity-50 ${
                                it.is_recommended
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              {it.is_recommended ? "★ Rec" : "☆ Mark Rec"}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                  {(isAgency || isAdmin || isUser) ? (
                    <div className="mt-6 pt-5 border-t border-gray-100">
                      <div className="text-sm font-black text-gray-900 mb-3">Add Item</div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={newItemLabel}
                          onChange={(e) => setNewItemLabel(e.target.value)}
                          placeholder="New checklist item..."
                          className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none"
                        />
                        {(isAgency || isAdmin) ? (
                          <label className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 select-none cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newItemRec}
                              onChange={(e) => setNewItemRec(e.target.checked)}
                              className="w-4 h-4 rounded"
                            />
                            <span>Recommended</span>
                          </label>
                        ) : null}
                        <button
                          type="button"
                          disabled={!!busy || !newItemLabel.trim()}
                          onClick={addChecklistItem}
                          className="rounded-2xl bg-gray-900 text-white px-5 py-3 text-sm font-black disabled:opacity-50"
                        >
                          {busy === "chka" ? "Adding..." : "+ Add"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "chat" ? (
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="font-black text-gray-900">Booking Support Chat</div>
                    <div className="text-xs text-gray-500 font-medium">Private conversation with the agency</div>
                  </div>
                  <div className="text-xs font-bold text-indigo-600">
                    {messages.filter((m) => !m.is_read && m.sender_user_id !== user?.id).length || 0} unread
                  </div>
                </div>
                <div
                  ref={chatScrollRef}
                  className="h-[50vh] overflow-y-auto p-5 sm:p-8 space-y-4 bg-gradient-to-b from-gray-50/50 to-white"
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-gray-500 font-medium">
                      No messages yet. Start the conversation below.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_user_id === user?.id;
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] sm:max-w-[70%] ${mine ? "order-2" : ""}`}>
                            <div
                              className={`rounded-3xl px-4 py-3 text-sm font-medium break-words whitespace-pre-wrap shadow-sm ${
                                mine
                                  ? "bg-indigo-600 text-white rounded-br-md"
                                  : "bg-white text-gray-800 border border-gray-100 rounded-bl-md"
                              }`}
                            >
                              {m.content}
                            </div>
                            <div className={`mt-1 text-[10px] font-bold text-gray-400 flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                              <span>{m.sender_display_name || (mine ? "You" : "Agency")}</span>
                              <span>·</span>
                              <span>{fmt(m.created_at)}</span>
                              {mine ? (
                                <span className={m.is_read ? "text-green-500" : ""}>
                                  {m.is_read ? "✓✓" : "✓"}
                                </span>
                              ) : null}
                            </div>
                            {m.attachment_url ? (
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
                                  mine ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                📎 Attachment ↗
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-4 sm:p-5 border-t border-gray-100 bg-white">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Type your message..."
                      className="flex-1 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none"
                    />
                    <button
                      type="button"
                      disabled={!!busy || !chatDraft.trim()}
                      onClick={sendMessage}
                      className="rounded-full bg-gray-900 text-white px-6 py-3 text-sm font-black disabled:opacity-50 shrink-0"
                    >
                      {busy === "msg" ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "notes" ? (
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-lg font-black text-gray-900">Booking Notes</div>
                    <div className="text-xs text-gray-500 font-medium">Private notes visible to all parties.</div>
                  </div>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={saveNotes}
                    className="rounded-full bg-gray-900 text-white px-5 py-2.5 text-sm font-black disabled:opacity-50"
                  >
                    {busy === "notes" ? "Saving..." : "Save Notes"}
                  </button>
                </div>
                <textarea
                  rows={10}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Write any notes about this booking..."
                  className="w-full rounded-3xl border border-gray-200 bg-white px-5 py-4 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none resize-y"
                />
              </div>
            ) : null}

            {tab === "agreement" ? (
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-10">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                    📜 BOOKING AGREEMENT
                  </div>
                  <div className="mt-4 text-3xl font-black text-gray-900">Trip Booking Agreement</div>
                  <div className="mt-2 text-gray-500 font-medium">Booking Reference: {booking.booking_code || `#${booking.id}`}</div>
                </div>
                <div className="space-y-6 text-sm">
                  <Section title="Parties">
                    <Row k="Customer" v={agreement?.customer?.full_name || agreement?.customer?.email || "Customer"} />
                    <Row k="Agency" v={agreement?.agency?.name || booking.agency_name || "Agency"} />
                    <Row k="Booking Code" v={booking.booking_code || `#${booking.id}`} />
                    <Row k="Status" v={BOOKING_STATUS_LABEL[booking.status] || booking.status} />
                    <Row k="Accepted" v={fmt(booking.accepted_at || booking.created_at)} />
                  </Section>
                  <Section title="Trip Details">
                    <Row
                      k="Destination"
                      v={
                        [agreement?.destination, agreement?.country, agreement?.city, booking.destination]
                          .filter(Boolean)[0] || "—"
                      }
                    />
                    <Row
                      k="Travel Period"
                      v={`${fmtDate(agreement?.travel_start_date || booking.start_date)} → ${fmtDate(
                        agreement?.travel_end_date || booking.end_date
                      )}`}
                    />
                    <Row
                      k="Duration"
                      v={
                        agreement?.duration || booking.duration
                          ? `${agreement?.duration || booking.duration} nights`
                          : "—"
                      }
                    />
                  </Section>
                  <Section title="Price & Terms">
                    <Row
                      k="Total Price"
                      v={fmtPrice(
                        agreement?.price ?? (agreement?.accepted_offer as any)?.total_price ?? booking.total_price,
                        (agreement?.currency || booking.currency) as string | undefined
                      )}
                    />
                    <Row
                      k="Currency"
                      v={(agreement?.currency || booking.currency) as string | undefined}
                    />
                    {agreement?.included_services ? (
                      <Row k="Included" v={String(agreement.included_services)} multiline />
                    ) : null}
                    {agreement?.excluded_services ? (
                      <Row k="Excluded" v={String(agreement.excluded_services)} multiline />
                    ) : null}
                    {agreement?.terms ? <Row k="Terms" v={String(agreement.terms)} multiline /> : null}
                  </Section>
                  <Section title="Accepted Offer Snapshot">
                    {agreement?.accepted_offer ? (
                      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 text-xs">
                        <pre className="whitespace-pre-wrap break-words font-mono text-gray-700 max-h-64 overflow-y-auto">
                          {JSON.stringify(agreement.accepted_offer, null, 2)}
                        </pre>
                      </div>
                    ) : booking.offer_accepted ? (
                      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 text-xs">
                        <pre className="whitespace-pre-wrap break-words font-mono text-gray-700 max-h-64 overflow-y-auto">
                          {JSON.stringify(booking.offer_accepted, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-gray-500 font-medium">Offer snapshot attached to booking.</div>
                    )}
                  </Section>
                </div>
              </div>
            ) : null}

            {tab === "review" && bookingCompletedOrReviewed ? (
              <div className="space-y-6">
                {review ? (
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                      <div>
                        <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">Customer Review</div>
                        <div className="mt-1 text-3xl font-black text-amber-500">{star(review.rating)}</div>
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        Submitted {fmt(review.created_at)}
                        <br />
                        by {review.user_display_name || "Customer"}
                      </div>
                    </div>
                    {review.comment ? (
                      <div className="rounded-2xl bg-gray-50/60 p-4 text-gray-800 font-medium whitespace-pre-wrap break-words border border-gray-100">
                        {review.comment}
                      </div>
                    ) : null}
                    {review.trip_story ? (
                      <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
                        <div className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-2">Trip Story</div>
                        <div className="text-sm text-gray-800 font-medium whitespace-pre-wrap break-words">{review.trip_story}</div>
                      </div>
                    ) : null}
                    {review.photos?.length ? (
                      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(review.photos as string[]).map((p, i) => (
                          <a
                            key={i}
                            href={p}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-square rounded-2xl overflow-hidden border border-gray-100"
                          >
                            <img
                              src={p}
                              alt={`Photo ${i + 1}`}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {review.agency_response ? (
                      <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-black text-emerald-700 uppercase tracking-wider">
                            Agency Response
                          </div>
                          <div className="text-[10px] font-bold text-emerald-600">
                            {fmt(review.agency_response_at)}
                          </div>
                        </div>
                        <div className="text-sm text-gray-800 font-medium whitespace-pre-wrap break-words">
                          {review.agency_response}
                        </div>
                      </div>
                    ) : isAgency && booking.agency_id === user?.agency_id ? (
                      <div className="mt-6 rounded-2xl border border-gray-100 p-5">
                        <div className="text-sm font-black text-gray-900 mb-3">Respond to Review</div>
                        <textarea
                          rows={4}
                          value={agencyRespDraft}
                          onChange={(e) => setAgencyRespDraft(e.target.value)}
                          placeholder="Thank the customer for their feedback..."
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none resize-y"
                        />
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            disabled={!!busy || !agencyRespDraft.trim()}
                            onClick={submitAgencyResponse}
                            className="rounded-full bg-gray-900 text-white px-5 py-2.5 text-sm font-black disabled:opacity-50"
                          >
                            {busy === "agencyResp" ? "..." : "Submit Response"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : isUser && booking.user_id === user?.id ? (
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 sm:p-8">
                    <div className="text-lg font-black text-gray-900 mb-6">Share Your Experience</div>
                    <div className="space-y-5">
                      <div>
                        <div className="text-xs font-bold text-gray-500 mb-2">Your Rating</div>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setRevRating(n)}
                              className="text-4xl transition-transform hover:scale-110"
                            >
                              <span className={n <= revRating ? "text-amber-400" : "text-gray-200"}>★</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="block">
                        <div className="text-xs font-bold text-gray-500 mb-1.5">Your Review</div>
                        <textarea
                          rows={4}
                          value={revComment}
                          onChange={(e) => setRevComment(e.target.value)}
                          placeholder="How was your trip?"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none resize-y"
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs font-bold text-gray-500 mb-1.5">Trip Story (optional)</div>
                        <textarea
                          rows={4}
                          value={revStory}
                          onChange={(e) => setRevStory(e.target.value)}
                          placeholder="Share highlights, favorite moments, tips..."
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none resize-y"
                        />
                      </label>
                      <label className="block">
                        <div className="text-xs font-bold text-gray-500 mb-1.5">Photo URLs (optional, comma-separated)</div>
                        <textarea
                          rows={2}
                          value={revPhotos}
                          onChange={(e) => setRevPhotos(e.target.value)}
                          placeholder="https://... , https://..."
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-0 outline-none resize-y"
                        />
                      </label>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={submitReview}
                          className="rounded-full bg-gray-900 text-white px-6 py-3 text-sm font-black disabled:opacity-50"
                        >
                          {busy === "review" ? "..." : "Submit Review"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-16 text-center text-gray-500 font-medium">
                    Review not available.
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function TimelineRow({ ev, compact = false }: { ev: TripBookingTimelineEvent; compact?: boolean }) {
  return (
    <div className={`relative ${compact ? "" : ""}`}>
      <div className="flex items-start gap-4">
        {!compact ? (
          <div className="absolute -left-[1.1rem] sm:-left-[0.6rem] top-1 shrink-0 w-5 h-5 rounded-full bg-white border-2 border-indigo-500 shadow" />
        ) : (
          <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600 shrink-0">
            {(EVENT_LABEL[ev.event_type] || ev.event_type || "?").toString().charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-black text-gray-900 text-sm">
              {EVENT_LABEL[ev.event_type] || ev.event_type || "Event"}
            </div>
          </div>
          <div className="text-xs text-gray-500 font-semibold">
            {ev.actor_display_name || (ev.actor_role ? `${ev.actor_role}` : "System")} · {fmt(ev.created_at)}
          </div>
          {ev.note ? (
            <div className="mt-2 text-sm text-gray-700 font-medium break-words whitespace-pre-wrap">{ev.note}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-100 p-5 sm:p-6">
      <div className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-4">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ k, v, multiline = false }: { k: string; v?: string | number | null; multiline?: boolean }) {
  if (v == null || v === "") return null;
  return (
    <div className={`flex ${multiline ? "flex-col gap-1" : "justify-between gap-4"}`}>
      <dt className="text-gray-500 font-semibold shrink-0">{k}</dt>
      <dd className={`text-gray-900 font-bold ${multiline ? "" : "text-right"} break-words`}>{String(v)}</dd>
    </div>
  );
}
