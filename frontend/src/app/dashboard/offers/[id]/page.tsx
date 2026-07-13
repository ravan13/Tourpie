"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripOffer, TripOfferMessage, TripRequest, getStoredToken } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
    } finally {
      setChatSending(false);
    }
  };

  return (
    <DashboardShell title={t("dash_offers")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="space-y-6">
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
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-blue-600">{req.request_code}</div>
                  <div className="mt-2 text-3xl font-black text-gray-900">{req.destination}</div>
                  <div className="mt-2 text-sm font-bold text-gray-500">
                    {req.start_date && req.end_date ? `${req.start_date} → ${req.end_date}` : t("custom_trip_flexible_dates")}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{t("custom_trip_budget_section")}</div>
                    <div className="mt-2 text-lg font-black text-gray-900">
                      {t("custom_trip_ideal_budget")}: {req.ideal_budget} {req.budget_currency}
                    </div>
                    {typeof req.max_budget === "number" ? (
                      <div className="mt-1 text-sm font-bold text-gray-600">
                        {t("custom_trip_max_budget")}: {req.max_budget} {req.budget_currency}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-blue-600 text-white px-6 py-4 shadow-lg shadow-blue-200">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">{t("dash_offers")}</div>
                    <div className="mt-2 text-2xl font-black">
                      {offer.total_price} {offer.currency}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={offer.status !== "submitted"}
                    onClick={async () => {
                      try {
                        await api.tripMarketplace.acceptOffer(offer.id);
                        router.push("/dashboard/requests");
                      } catch {
                      }
                    }}
                    className={`rounded-2xl px-6 py-4 font-black transition ${
                      offer.status !== "submitted"
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-900 hover:bg-blue-700 text-white shadow-lg"
                    }`}
                  >
                    {t("custom_trip_accept_offer")}
                  </button>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InfoCard title={t("custom_trip_hotel_stars")} value={offer.hotel || "-"} />
                <InfoCard title={t("custom_trip_meal_type")} value={offer.meal_plan || "-"} />
                <InfoCard title={t("custom_trip_flight_included")} value={offer.flight || "-"} />
                <InfoCard title={t("custom_trip_transfer_included")} value={offer.transfer || "-"} />
                <InfoCard title={t("custom_trip_visa_assistance")} value={offer.visa || "-"} />
                <InfoCard title={t("custom_trip_travel_insurance")} value={offer.insurance || "-"} />
              </div>

              <div className="mt-10 space-y-4">
                <Block title={t("custom_trip_offer_description")} value={offer.offer_description} />
                <Block title={t("custom_trip_additional_benefits")} value={offer.additional_benefits} />
                {offer.price_difference_reason ? (
                  <Block title={t("custom_trip_price_difference_reason")} value={`${offer.price_difference_reason}${offer.price_difference_notes ? ` — ${offer.price_difference_notes}` : ""}`} />
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

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
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

