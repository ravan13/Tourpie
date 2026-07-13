"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripOffer, TripRequest, getStoredToken } from "@/lib/api";
import { agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const priceReasons = [
  "better_hotel",
  "direct_flight",
  "private_transfer",
  "travel_insurance_included",
  "visa_included",
  "luxury_room",
  "premium_resort",
  "extra_activities",
  "peak_season_pricing",
  "other",
] as const;

export default function AgencyCreateOfferPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const params = useParams();
  const router = useRouter();
  const idRaw = params?.id;
  const requestId = typeof idRaw === "string" ? Number(idRaw) : Array.isArray(idRaw) ? Number(idRaw[0]) : NaN;

  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<TripRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [currency, setCurrency] = useState("USD");
  const [hotel, setHotel] = useState("");
  const [roomType, setRoomType] = useState("");
  const [mealPlan, setMealPlan] = useState("");
  const [flight, setFlight] = useState("");
  const [transfer, setTransfer] = useState("");
  const [visa, setVisa] = useState("");
  const [insurance, setInsurance] = useState("");
  const [activities, setActivities] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [additionalBenefits, setAdditionalBenefits] = useState("");
  const [offerExpirationHours, setOfferExpirationHours] = useState<number | "">("");

  const [priceDifferenceReason, setPriceDifferenceReason] = useState<(typeof priceReasons)[number] | "">("");
  const [priceDifferenceNotes, setPriceDifferenceNotes] = useState("");

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
        setCurrency(row.budget_currency || "USD");
      } catch {
        setReq(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const needsJustification = useMemo(() => {
    if (!req) return false;
    const price = typeof totalPrice === "number" ? totalPrice : Number(totalPrice);
    if (!Number.isFinite(price)) return false;
    if (price > req.ideal_budget) return true;
    if (typeof req.max_budget === "number" && price > req.max_budget) return true;
    return false;
  }, [req, totalPrice]);

  const submit = async () => {
    if (!req) return;
    const price = typeof totalPrice === "number" ? totalPrice : Number(totalPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setMessage({ type: "error", text: t("custom_trip_error_total_price") });
      return;
    }
    if (needsJustification && !priceDifferenceReason) {
      setMessage({ type: "error", text: t("custom_trip_error_price_reason") });
      return;
    }
    if (priceDifferenceReason === "other" && !priceDifferenceNotes.trim()) {
      setMessage({ type: "error", text: t("custom_trip_error_price_reason_notes") });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload: Parameters<typeof api.tripMarketplace.agencyCreateOffer>[1] = {
        total_price: price,
        currency: currency || req.budget_currency,
        hotel: hotel.trim() ? hotel.trim() : null,
        room_type: roomType.trim() ? roomType.trim() : null,
        meal_plan: mealPlan.trim() ? mealPlan.trim() : null,
        flight: flight.trim() ? flight.trim() : null,
        transfer: transfer.trim() ? transfer.trim() : null,
        visa: visa.trim() ? visa.trim() : null,
        insurance: insurance.trim() ? insurance.trim() : null,
        activities: activities.trim() ? activities.trim() : null,
        offer_description: offerDescription.trim() ? offerDescription.trim() : null,
        additional_benefits: additionalBenefits.trim() ? additionalBenefits.trim() : null,
        offer_expiration_hours: offerExpirationHours === "" ? null : Number(offerExpirationHours),
        price_difference_reason: priceDifferenceReason || null,
        price_difference_notes: priceDifferenceNotes.trim() ? priceDifferenceNotes.trim() : null,
      };

      const created: TripOffer = await api.tripMarketplace.agencyCreateOffer(req.id, payload);
      setMessage({ type: "success", text: t("custom_trip_success_offer_sent") });
      setTimeout(() => router.push(`/agency/incoming-requests/${req.id}`), 700);
      return created;
    } catch {
      setMessage({ type: "error", text: t("custom_trip_error_offer_submit") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title={t("custom_trip_create_offer")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
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
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("custom_trip_total_price")}>
                <input
                  type="number"
                  min={0}
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                />
              </Field>
              <Field label={t("custom_trip_budget_currency")}>
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                />
              </Field>
              <Field label={t("custom_trip_hotel")}>
                <input
                  value={hotel}
                  onChange={(e) => setHotel(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                />
              </Field>
              <Field label={t("custom_trip_room_type")}>
                <input
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                />
              </Field>
              <Field label={t("custom_trip_meal_plan")}>
                <input
                  value={mealPlan}
                  onChange={(e) => setMealPlan(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                />
              </Field>
              <Field label={t("custom_trip_offer_expiration")}>
                <input
                  type="number"
                  min={0}
                  value={offerExpirationHours}
                  onChange={(e) => setOfferExpirationHours(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  placeholder={t("custom_trip_optional")}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("custom_trip_flight")}>
                <textarea
                  value={flight}
                  onChange={(e) => setFlight(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                />
              </Field>
              <Field label={t("custom_trip_transfer")}>
                <textarea
                  value={transfer}
                  onChange={(e) => setTransfer(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                />
              </Field>
              <Field label={t("custom_trip_visa")}>
                <textarea
                  value={visa}
                  onChange={(e) => setVisa(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                />
              </Field>
              <Field label={t("custom_trip_insurance")}>
                <textarea
                  value={insurance}
                  onChange={(e) => setInsurance(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                />
              </Field>
            </div>

            <Field label={t("custom_trip_activities_interests")}>
              <textarea
                value={activities}
                onChange={(e) => setActivities(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
              />
            </Field>

            <Field label={t("custom_trip_offer_description")}>
              <textarea
                value={offerDescription}
                onChange={(e) => setOfferDescription(e.target.value)}
                rows={4}
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
              />
            </Field>

            <Field label={t("custom_trip_additional_benefits")}>
              <textarea
                value={additionalBenefits}
                onChange={(e) => setAdditionalBenefits(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
              />
            </Field>

            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
              <div className="text-sm font-black text-gray-900">{t("custom_trip_price_difference")}</div>
              <div className="mt-2 text-sm font-bold text-gray-600">{t("custom_trip_price_difference_hint")}</div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("custom_trip_price_difference_reason")} required={needsJustification}>
                  <select
                    value={priceDifferenceReason}
                    onChange={(e) => setPriceDifferenceReason(e.target.value as typeof priceDifferenceReason)}
                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  >
                    <option value="">{t("custom_trip_optional")}</option>
                    {priceReasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("custom_trip_price_difference_notes")} required={priceDifferenceReason === "other"}>
                  <input
                    value={priceDifferenceNotes}
                    onChange={(e) => setPriceDifferenceNotes(e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    placeholder={t("custom_trip_optional")}
                  />
                </Field>
              </div>
            </div>

            {message ? (
              <div className={`rounded-2xl px-6 py-4 text-sm font-black ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {message.text}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className={`inline-flex items-center justify-center rounded-2xl px-8 py-4 font-black transition ${
                  saving ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                }`}
              >
                {saving ? t("common_please_wait") : t("custom_trip_send_offer")}
              </button>
              <Link
                href={`/agency/incoming-requests/${req.id}`}
                prefetch={false}
                className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-8 py-4 transition"
              >
                {t("marketplace_back")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
        {label}
        {required ? <span className="ml-2 text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}

