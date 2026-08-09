"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripOffer, TripOfferMessage, TripOfferStatus, TripRequest, getStoredToken } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function offerStatusBadgeClass(s: TripOfferStatus): string {
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

function starRating(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return "-";
  const full = Math.max(0, Math.min(5, Math.round(n)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

export default function DashboardOfferDetailsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const params = useParams();
  const router = useRouter();
  const idRaw = params?.id;
  const offerId = typeof idRaw === "string" ? Number(idRaw) : Array.isArray(idRaw) ? Number(idRaw[0]) : NaN;

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<TripOffer | null>(null);
  const [req, setReq] = useState<TripRequest | null>(null);
  const [messages, setMessages] = useState<TripOfferMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token || !Number.isFinite(offerId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const offerRow = await api.tripMarketplace.getOffer(offerId);
        setOffer(offerRow);
        const requestRow = await api.tripMarketplace.getRequest(offerRow.trip_request_id);
        setReq(requestRow);
        const msgs = await api.tripMarketplace.listOfferMessages(offerRow.id).catch(() => []);
        setMessages(msgs);
      } catch {
        setOffer(null);
        setReq(null);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [offerId]);

  const flashToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2400);
  };

  const send = async () => {
    if (!offer) return;
    const content = chatDraft.trim();
    if (!content) return;
    setChatSending(true);
    try {
      const msg = await api.tripMarketplace.sendOfferMessage(offer.id, content);
      setMessages((prev) => [...prev, msg]);
      setChatDraft("");
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setChatSending(false);
    }
  };

  const refreshOffer = async () => {
    if (!Number.isFinite(offerId)) return;
    try {
      const row = await api.tripMarketplace.getOffer(offerId);
      setOffer(row);
    } catch {
      /* ignore */
    }
  };

  const handleBookmark = async () => {
    if (!offer || actionBusy) return;
    setActionBusy("bookmark");
    try {
      const next = !offer.is_bookmarked;
      await api.tripMarketplace.bookmarkOffer(offer.id, next);
      setOffer({ ...offer, is_bookmarked: next });
      flashToast("ok", next ? t("common_saved") : t("common_removed"));
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setActionBusy(null);
    }
  };

  const handleReject = async () => {
    if (!offer || actionBusy) return;
    const ok = confirm(t("custom_trip_decline_confirm"));
    if (!ok) return;
    setActionBusy("reject");
    try {
      await api.tripMarketplace.rejectOffer(offer.id);
      await refreshOffer();
      flashToast("ok", t("common_rejected"));
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setActionBusy(null);
    }
  };

  const handleAccept = async () => {
    if (!offer || actionBusy) return;
    if (offer.status !== "submitted") return;
    const ok = confirm(t("custom_trip_accept_offer"));
    if (!ok) return;
    setActionBusy("accept");
    try {
      const booking = await api.tripMarketplace.acceptOffer(offer.id);
      flashToast("ok", t("custom_trip_success_offer_accepted"));
      const targetId = booking?.id ? booking.id : null;
      setTimeout(() => router.push(targetId ? `/dashboard/trip-bookings/${targetId}` : "/dashboard/trip-bookings"), 800);
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setActionBusy(null);
    }
  };

  const handleRevision = async () => {
    if (!offer || actionBusy) return;
    const notes = revisionNotes.trim();
    if (!notes) {
      flashToast("err", t("custom_trip_error_revision_notes"));
      return;
    }
    setActionBusy("revision");
    try {
      await api.tripMarketplace.requestRevision(offer.id, notes);
      setRevisionOpen(false);
      setRevisionNotes("");
      await refreshOffer();
      flashToast("ok", t("custom_trip_success_revision_sent"));
    } catch {
      flashToast("err", t("common_try_again"));
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <DashboardShell title={t("dash_offers")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="space-y-6">
        {toast ? (
          <div className={`rounded-2xl px-5 py-3 text-sm font-black ${toast.type === "ok" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
            {toast.text}
          </div>
        ) : null}

        {loading ? (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center font-bold text-gray-500">
            {t("common_loading")}
          </div>
        ) : !offer || !req ? (
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center">
            <div className="text-6xl">🧭</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("common_page_not_found_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("common_page_not_found_subtitle")}</div>
            <div className="mt-8 flex justify-center">
              <Link
                href="/dashboard/offers"
                prefetch={false}
                className="bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 rounded-2xl transition"
              >
                {t("dash_offers")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs font-black uppercase tracking-widest text-blue-600">{req.request_code}</div>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${offerStatusBadgeClass(offer.status)}`}>
                      {offer.status}
                    </span>
                    {offer.is_bookmarked ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider">
                        ★ {t("common_saved")}
                      </span>
                    ) : null}
                    {offer.revision_requested_at ? (
                      <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider">
                        {t("custom_trip_revision_requested")}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-3xl font-black text-gray-900">
                    {req.destination}
                    {req.country ? ` · ${req.country}` : ""}
                    {req.city ? `, ${req.city}` : ""}
                  </div>
                  <div className="text-sm font-bold text-gray-500">
                    {req.start_date && req.end_date ? `${req.start_date} → ${req.end_date}` : t("custom_trip_flexible_dates")}
                    {typeof req.duration === "number" ? ` · ${req.duration} ${t("custom_trip_nights")}` : ""}
                  </div>
                  {offer.agency?.name ? (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-2 text-sm font-black text-gray-900">
                        🏢 {offer.agency.name}
                      </div>
                      {typeof offer.agency.rating === "number" ? (
                        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-2 text-sm font-black text-amber-700">
                          ★ {offer.agency.rating.toFixed(1)}
                        </div>
                      ) : null}
                      {typeof offer.agency.reviews_count === "number" ? (
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-2 text-sm font-bold text-gray-600">
                          {offer.agency.reviews_count} {t("dash_reviews")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 w-full xl:w-[280px] shrink-0">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{t("custom_trip_budget_section")}</div>
                    <div className="mt-2 text-lg font-black text-gray-900">
                      {t("custom_trip_ideal_budget")}: {req.ideal_budget ?? req.budget ?? "-"} {req.budget_currency ?? req.currency ?? ""}
                    </div>
                    {typeof req.max_budget === "number" ? (
                      <div className="mt-1 text-sm font-bold text-gray-600">
                        {t("custom_trip_max_budget")}: {req.max_budget} {req.budget_currency ?? req.currency ?? ""}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-blue-600 text-white px-6 py-4 shadow-lg shadow-blue-200">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">{t("dash_offers")}</div>
                    <div className="mt-2 text-2xl font-black">
                      {offer.total_price ?? offer.price ?? "-"} {offer.currency ?? ""}
                    </div>
                    {offer.expiration_date ? (
                      <div className="mt-2 text-xs font-bold text-white/80">
                        {t("custom_trip_valid_until")}: {new Date(offer.expiration_date).toLocaleDateString()}
                      </div>
                    ) : offer.expires_at ? (
                      <div className="mt-2 text-xs font-bold text-white/80">
                        {t("custom_trip_valid_until")}: {new Date(offer.expires_at).toLocaleDateString()}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleBookmark}
                    disabled={!!actionBusy}
                    className={`rounded-2xl px-6 py-3 font-black transition ${
                      actionBusy === "bookmark"
                        ? "bg-gray-100 text-gray-400 cursor-wait"
                        : offer.is_bookmarked
                        ? "bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800"
                        : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-900"
                    }`}
                  >
                    {offer.is_bookmarked ? `★ ${t("common_saved")}` : `☆ ${t("custom_trip_save_offer")}`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRevisionOpen((s) => !s)}
                    disabled={!!actionBusy || offer.status !== "submitted"}
                    className={`rounded-2xl px-6 py-3 font-black transition ${
                      actionBusy || offer.status !== "submitted"
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-white border border-purple-200 hover:bg-purple-50 text-purple-700"
                    }`}
                  >
                    {t("custom_trip_request_revision")}
                  </button>

                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={!!actionBusy || offer.status !== "submitted"}
                    className={`rounded-2xl px-6 py-3 font-black transition ${
                      actionBusy || offer.status !== "submitted"
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-white border border-red-200 hover:bg-red-50 text-red-700"
                    }`}
                  >
                    {t("common_reject")}
                  </button>

                  <button
                    type="button"
                    disabled={offer.status !== "submitted" || !!actionBusy}
                    onClick={handleAccept}
                    className={`rounded-2xl px-6 py-4 font-black transition ${
                      offer.status !== "submitted" || !!actionBusy
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-900 hover:bg-blue-700 text-white shadow-lg"
                    }`}
                  >
                    {actionBusy === "accept" ? t("common_please_wait") : t("custom_trip_accept_offer")}
                  </button>
                </div>
              </div>

              {revisionOpen ? (
                <div className="mt-8 rounded-3xl border border-purple-100 bg-purple-50/40 p-6">
                  <div className="text-lg font-black text-purple-900">{t("custom_trip_request_revision")}</div>
                  <div className="mt-1 text-sm font-bold text-purple-700/80">{t("custom_trip_revision_hint")}</div>
                  <textarea
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    rows={4}
                    className="mt-4 w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-purple-500 font-bold text-gray-900 resize-none"
                    placeholder={t("custom_trip_revision_notes_placeholder")}
                  />
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleRevision}
                      disabled={!!actionBusy}
                      className={`rounded-2xl px-6 py-3 font-black transition ${
                        actionBusy ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-purple-700 hover:bg-purple-800 text-white shadow-lg shadow-purple-200"
                      }`}
                    >
                      {actionBusy === "revision" ? t("common_please_wait") : t("custom_trip_send_revision")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevisionOpen(false)}
                      className="rounded-2xl px-6 py-3 font-black bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 transition"
                    >
                      {t("common_cancel")}
                    </button>
                  </div>
                </div>
              ) : null}

              {offer.revision_requested_at && offer.revision_notes ? (
                <div className="mt-8 rounded-3xl border border-purple-100 bg-purple-50/40 p-6">
                  <div className="text-[11px] font-black uppercase tracking-[0.28em] text-purple-700">
                    {t("custom_trip_revision_requested")} · {new Date(offer.revision_requested_at).toLocaleString()}
                  </div>
                  <div className="mt-3 text-sm font-bold text-purple-900 whitespace-pre-wrap">{offer.revision_notes}</div>
                </div>
              ) : null}

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <InfoCard title={t("custom_trip_hotel")} value={offer.hotel || "-"} />
                <InfoCard
                  title={t("custom_trip_hotel_stars")}
                  value={offer.hotel_stars ? starRating(offer.hotel_stars) : "-"}
                />
                <InfoCard title={t("custom_trip_flight_included")} value={offer.flight_included ? "✅" : offer.flight || "-"} />
                <InfoCard title={t("custom_trip_transfer_included")} value={offer.airport_transfer ? "✅" : offer.transfer || "-"} />
                <InfoCard title={t("custom_trip_travel_insurance")} value={offer.insurance_included ? "✅" : offer.insurance || "-"} />
                <InfoCard title={t("custom_trip_visa_assistance")} value={offer.visa_support ? "✅" : offer.visa || "-"} />
                <InfoCard title={t("custom_trip_breakfast")} value={offer.breakfast_included ? "✅" : "-"} />
                <InfoCard title={t("custom_trip_lunch")} value={offer.lunch_included ? "✅" : "-"} />
                <InfoCard title={t("custom_trip_dinner")} value={offer.dinner_included ? "✅" : "-"} />
                <InfoCard title={t("custom_trip_meal_type")} value={offer.meal_plan || "-"} span2 />
                {typeof offer.response_time_minutes === "number" ? (
                  <InfoCard title={t("custom_trip_response_time")} value={`${offer.response_time_minutes} min`} />
                ) : null}
                {typeof offer.rating === "number" ? (
                  <InfoCard title={t("dash_rating")} value={`${offer.rating.toFixed(1)} ${starRating(offer.rating)}`} />
                ) : null}
              </div>

              <div className="mt-10 space-y-4">
                {offer.activities ? <Block title={t("custom_trip_activities")} value={offer.activities} /> : null}
                {offer.travel_program ? <Block title={t("custom_trip_travel_program")} value={offer.travel_program} /> : null}
                {offer.included_services ? <Block title={t("custom_trip_included_services")} value={offer.included_services} /> : null}
                {offer.excluded_services ? <Block title={t("custom_trip_excluded_services")} value={offer.excluded_services} /> : null}
                {offer.offer_description ? <Block title={t("custom_trip_offer_description")} value={offer.offer_description} /> : null}
                {offer.additional_benefits ? <Block title={t("custom_trip_additional_benefits")} value={offer.additional_benefits} /> : null}
                {offer.notes ? <Block title={t("custom_trip_notes")} value={offer.notes} /> : null}
                {Array.isArray(offer.offer_attachments) && offer.offer_attachments.length > 0 ? (
                  <Block
                    title={t("custom_trip_attachments")}
                    value={
                      offer.offer_attachments
                        .map((u: string, i: number) => `📎 [${t("custom_trip_attachment")} ${i + 1}](${u})`)
                        .join("\n")
                    }
                  />
                ) : null}
                {offer.price_difference_reason ? (
                  <Block
                    title={t("custom_trip_price_difference_reason")}
                    value={`${offer.price_difference_reason}${offer.price_difference_notes ? ` — ${offer.price_difference_notes}` : ""}`}
                  />
                ) : null}
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xl font-black text-gray-900">{t("dash_messages")}</div>
                  <div className="mt-1 text-sm font-bold text-gray-500">{t("custom_trip_chat_hint")}</div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-gray-100 bg-gray-50 p-6 max-h-[420px] overflow-y-auto space-y-3">
                {messages.length === 0 ? (
                  <div className="text-sm font-bold text-gray-500">{t("custom_trip_chat_empty")}</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="rounded-2xl bg-white border border-gray-100 px-5 py-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">
                        {m.sender_role} · {new Date(m.created_at).toLocaleString()}
                      </div>
                      <div className="mt-2 text-sm font-bold text-gray-900 whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  className="flex-1 bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  placeholder={t("custom_trip_chat_placeholder")}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={chatSending}
                  className={`rounded-2xl px-8 py-4 font-black transition ${
                    chatSending ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                  }`}
                >
                  {t("custom_trip_chat_send")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function InfoCard({ title, value, span2 = false }: { title: string; value: string; span2?: boolean }) {
  return (
    <div className={`rounded-3xl border border-gray-100 bg-gray-50 p-6 ${span2 ? "md:col-span-2" : ""}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{title}</div>
      <div className="mt-2 text-sm font-bold text-gray-900 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function Block({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{title}</div>
      <div className="mt-2 text-sm font-bold text-gray-900 whitespace-pre-wrap">{value}</div>
    </div>
  );
}
