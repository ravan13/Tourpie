"use client";

import { useLanguage } from "@/context/LanguageContext";
import { api, getStoredToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type DestinationType = "any" | "country" | "city";
type BudgetFlex = "fixed" | "flexible_10" | "flexible_20" | "no_budget_limit";

type CustomTripRequestFormProps = {
  variant?: "page" | "drawer";
  onClose?: () => void;
  onSubmitted?: () => void;
  redirectAfterSubmit?: string;
};

export default function CustomTripRequestForm({
  variant = "page",
  onClose,
  onSubmitted,
  redirectAfterSubmit = "/dashboard/requests",
}: CustomTripRequestFormProps) {
  const { t, currency } = useLanguage();
  const router = useRouter();
  const budgetCurrencies = useMemo(() => ["AZN", "USD", "EUR", "RUB", "TRY"] as const, []);

  const [destination, setDestination] = useState("");
  const [destinationType, setDestinationType] = useState<DestinationType>("any");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [idealBudget, setIdealBudget] = useState<number | "">("");
  const [maxBudget, setMaxBudget] = useState<number | "">("");
  const [budgetCurrency, setBudgetCurrency] = useState<(typeof budgetCurrencies)[number]>(currency);
  const [budgetFlexibility, setBudgetFlexibility] = useState<BudgetFlex>("fixed");

  const [hotelStars, setHotelStars] = useState<number | "">("");
  const [mealType, setMealType] = useState("");
  const [flightIncluded, setFlightIncluded] = useState(false);
  const [transferIncluded, setTransferIncluded] = useState(false);
  const [visaAssistance, setVisaAssistance] = useState(false);
  const [travelInsurance, setTravelInsurance] = useState(false);
  const [preferredAirline, setPreferredAirline] = useState("");

  const [accommodationPreferences, setAccommodationPreferences] = useState("");
  const [activitiesInterests, setActivitiesInterests] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [offerExpirationHours, setOfferExpirationHours] = useState<24 | 48 | 72>(48);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const submit = async () => {
    if (!getStoredToken()) {
      router.push(`/login?redirect=${encodeURIComponent("/request-custom-offers")}`);
      return;
    }

    const cleanedDestination = destination.trim();
    if (!cleanedDestination) {
      setMessage({ type: "error", text: t("custom_trip_error_destination") });
      return;
    }
    if (!Number.isFinite(adults) || adults < 1) {
      setMessage({ type: "error", text: t("custom_trip_error_adults") });
      return;
    }
    if (!Number.isFinite(children) || children < 0) {
      setMessage({ type: "error", text: t("custom_trip_error_children") });
      return;
    }
    if (!flexibleDates) {
      if (!startDate || !endDate) {
        setMessage({ type: "error", text: t("custom_trip_error_dates") });
        return;
      }
      if (startDate > endDate) {
        setMessage({ type: "error", text: t("custom_trip_error_dates_order") });
        return;
      }
    }
    const ideal = typeof idealBudget === "number" ? idealBudget : Number(idealBudget);
    if (!Number.isFinite(ideal) || ideal <= 0) {
      setMessage({ type: "error", text: t("custom_trip_error_ideal_budget") });
      return;
    }
    const max = typeof maxBudget === "number" ? maxBudget : maxBudget === "" ? null : Number(maxBudget);
    if (max !== null && (!Number.isFinite(max) || max < ideal)) {
      setMessage({ type: "error", text: t("custom_trip_error_max_budget") });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      await api.tripMarketplace.createRequest({
        destination: cleanedDestination,
        destination_type: destinationType,
        start_date: flexibleDates ? null : startDate,
        end_date: flexibleDates ? null : endDate,
        flexible_dates: flexibleDates,
        adults,
        children,
        ideal_budget: ideal,
        max_budget: max,
        budget_currency: budgetCurrency,
        budget_flexibility: budgetFlexibility,
        hotel_stars: typeof hotelStars === "number" ? hotelStars : hotelStars === "" ? null : Number(hotelStars),
        meal_type: mealType.trim() ? mealType.trim() : null,
        flight_included: flightIncluded,
        transfer_included: transferIncluded,
        visa_assistance: visaAssistance,
        travel_insurance: travelInsurance,
        preferred_airline: preferredAirline.trim() ? preferredAirline.trim() : null,
        accommodation_preferences: accommodationPreferences.trim() ? accommodationPreferences.trim() : null,
        activities_interests: activitiesInterests.trim() ? activitiesInterests.trim() : null,
        special_notes: specialNotes.trim() ? specialNotes.trim() : null,
        offer_expiration_hours: offerExpirationHours,
      });
      setMessage({ type: "success", text: t("custom_trip_success_submitted") });
      onSubmitted?.();
      setTimeout(() => router.push(redirectAfterSubmit), 900);
    } catch {
      setMessage({ type: "error", text: t("custom_trip_error_submit") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={variant === "page" ? "min-h-screen bg-gray-50 py-16" : ""}>
      <div className={variant === "page" ? "max-w-5xl mx-auto px-4" : ""}>
        <div
          className={[
            variant === "page" ? "bg-white rounded-[2.75rem] border border-gray-100 shadow-sm p-10 sm:p-12" : "",
          ].join(" ")}
        >
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">{t("home_custom_trip_title")}</div>
            <h1 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-gray-900">{t("home_custom_trip_cta")}</h1>
            <p className="mt-4 text-gray-600 text-lg font-medium leading-relaxed">{t("home_custom_trip_subtitle")}</p>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-7">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_destination")}</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  placeholder={t("search_where")}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_destination_type")}</label>
                <select
                  value={destinationType}
                  onChange={(e) => setDestinationType(e.target.value as DestinationType)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                >
                  <option value="any">{t("custom_trip_destination_type_any")}</option>
                  <option value="country">{t("custom_trip_destination_type_country")}</option>
                  <option value="city">{t("custom_trip_destination_type_city")}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_start_date")}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={flexibleDates}
                    className="w-full bg-gray-50 disabled:opacity-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_end_date")}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={flexibleDates}
                    className="w-full bg-gray-50 disabled:opacity-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-5 py-4">
                <div>
                  <div className="text-sm font-black text-gray-900">{t("custom_trip_flexible_dates")}</div>
                  <div className="text-xs text-gray-500 font-medium">{t("custom_trip_flexible_dates_hint")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFlexibleDates((v) => !v)}
                  className={`h-10 w-16 rounded-full p-1 transition ${flexibleDates ? "bg-blue-600" : "bg-gray-200"}`}
                  aria-pressed={flexibleDates}
                >
                  <span className={`block h-8 w-8 rounded-full bg-white transition ${flexibleDates ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_adults")}</label>
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_children")}</label>
                  <input
                    type="number"
                    min={0}
                    value={children}
                    onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-7">
              <div className="rounded-[2.5rem] border border-gray-100 bg-white shadow-sm p-8">
                <div className="text-sm font-black text-gray-900">{t("custom_trip_budget_section")}</div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_ideal_budget")}</label>
                    <input
                      type="number"
                      min={0}
                      value={idealBudget}
                      onChange={(e) => setIdealBudget(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_max_budget")}</label>
                    <input
                      type="number"
                      min={0}
                      value={maxBudget}
                      onChange={(e) => setMaxBudget(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      placeholder={t("custom_trip_optional")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_budget_currency")}</label>
                    <select
                      value={budgetCurrency}
                      onChange={(e) => setBudgetCurrency(e.target.value as (typeof budgetCurrencies)[number])}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    >
                      {budgetCurrencies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_budget_flexibility")}</label>
                    <select
                      value={budgetFlexibility}
                      onChange={(e) => setBudgetFlexibility(e.target.value as BudgetFlex)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    >
                      <option value="fixed">{t("custom_trip_budget_fixed")}</option>
                      <option value="flexible_10">{t("custom_trip_budget_flex_10")}</option>
                      <option value="flexible_20">{t("custom_trip_budget_flex_20")}</option>
                      <option value="no_budget_limit">{t("custom_trip_budget_no_limit")}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_hotel_stars")}</label>
                  <select
                    value={hotelStars}
                    onChange={(e) => setHotelStars(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  >
                    <option value="">{t("custom_trip_optional")}</option>
                    {[3, 4, 5].map((star) => (
                      <option key={star} value={star}>
                        {star}★
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_meal_type")}</label>
                  <input
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    placeholder={t("custom_trip_optional")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Toggle label={t("custom_trip_flight_included")} value={flightIncluded} onChange={setFlightIncluded} />
                <Toggle label={t("custom_trip_transfer_included")} value={transferIncluded} onChange={setTransferIncluded} />
                <Toggle label={t("custom_trip_visa_assistance")} value={visaAssistance} onChange={setVisaAssistance} />
                <Toggle label={t("custom_trip_travel_insurance")} value={travelInsurance} onChange={setTravelInsurance} />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_preferred_airline")}</label>
                <input
                  value={preferredAirline}
                  onChange={(e) => setPreferredAirline(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  placeholder={t("custom_trip_optional")}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_accommodation_preferences")}</label>
                <textarea
                  value={accommodationPreferences}
                  onChange={(e) => setAccommodationPreferences(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                  placeholder={t("custom_trip_optional")}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_activities_interests")}</label>
                <textarea
                  value={activitiesInterests}
                  onChange={(e) => setActivitiesInterests(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                  placeholder={t("custom_trip_optional")}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_special_notes")}</label>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                  placeholder={t("custom_trip_optional")}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{t("custom_trip_offer_expiration")}</label>
                <select
                  value={offerExpirationHours}
                  onChange={(e) => setOfferExpirationHours(Number(e.target.value) as 24 | 48 | 72)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                >
                  <option value={24}>24 {t("custom_trip_hours")}</option>
                  <option value={48}>48 {t("custom_trip_hours")}</option>
                  <option value={72}>72 {t("custom_trip_hours")}</option>
                </select>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`mt-10 rounded-2xl px-6 py-4 text-sm font-black ${
                message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-10 flex flex-col sm:flex-row gap-4 sm:items-center">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className={`inline-flex items-center justify-center rounded-2xl px-8 py-4 font-black shadow-lg transition ${
                submitting ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
              }`}
            >
              {submitting ? t("common_please_wait") : t("custom_trip_submit")}
            </button>
            <div className="text-sm text-gray-500 font-medium">{t("custom_trip_submit_hint")}</div>
            {variant === "drawer" && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-8 py-4 transition"
              >
                {t("custom_trip_close")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-5 py-4 text-left"
      aria-pressed={value}
    >
      <span className="text-sm font-black text-gray-900">{label}</span>
      <span className={`h-9 w-14 rounded-full p-1 transition ${value ? "bg-blue-600" : "bg-gray-200"}`}>
        <span className={`block h-7 w-7 rounded-full bg-white transition ${value ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

