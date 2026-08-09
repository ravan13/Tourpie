"use client";

import { useLanguage } from "@/context/LanguageContext";
import { api, TripRequest, TripDestinationType, TripBudgetFlexibility, getStoredToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TRAVEL_STYLES = ["Luxury", "Budget", "Adventure", "Family", "Romantic", "Solo", "Group"] as const;
const MEAL_PREFS = ["None", "Bed & Breakfast", "Half Board", "Full Board", "All Inclusive", "Room Only"] as const;
const TRANSPORT_OPTIONS = ["Any", "Flight Included", "Private Transfer", "Rental Car", "Train", "Bus"] as const;
const STEPS = ["destination", "travelers", "budget", "preferences", "details"] as const;
const AUTOSAVE_DEBOUNCE_MS = 3500;
const DRAFT_STORAGE_PREFIX = "tourpie:trip_draft:";

type CustomTripRequestFormProps = {
  variant?: "page" | "drawer";
  editId?: number | null;
  onClose?: () => void;
  onSubmitted?: () => void;
  onSavedDraft?: (req: TripRequest) => void;
  redirectAfterSubmit?: string;
};

type DraftState = {
  destination?: string;
  destination_type?: TripDestinationType;
  country?: string;
  city?: string;
  start_date?: string;
  end_date?: string;
  flexible_dates?: boolean;
  duration?: number;
  adults?: number;
  children?: number;
  ideal_budget?: number;
  max_budget?: number;
  budget_currency?: string;
  budget_flexibility?: TripBudgetFlexibility;
  hotel_stars?: number;
  meal_preference?: string;
  transportation?: string;
  visa_required?: boolean;
  travel_style?: string;
  flight_included?: boolean;
  transfer_included?: boolean;
  visa_assistance?: boolean;
  travel_insurance?: boolean;
  preferred_airline?: string;
  accommodation_preferences?: string;
  activities_interests?: string;
  special_requirements?: string;
  notes?: string;
  attachments?: string[];
  offer_expiration_hours?: 24 | 48 | 72;
};

export default function CustomTripRequestForm({
  variant = "page",
  editId = null,
  onClose,
  onSubmitted,
  onSavedDraft,
  redirectAfterSubmit = "/dashboard/requests",
}: CustomTripRequestFormProps) {
  const { t, currency } = useLanguage();
  const router = useRouter();
  const budgetCurrencies = useMemo(() => ["AZN", "USD", "EUR", "RUB", "TRY"] as const, []);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lastSavedPayloadRef = useRef<string | null>(null);

  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [persistedId, setPersistedId] = useState<number | null>(editId ?? null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [destination, setDestination] = useState("");
  const [destinationType, setDestinationType] = useState<TripDestinationType>("any");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [duration, setDuration] = useState<number | "">("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [idealBudget, setIdealBudget] = useState<number | "">("");
  const [maxBudget, setMaxBudget] = useState<number | "">("");
  const [budgetCurrency, setBudgetCurrency] = useState<(typeof budgetCurrencies)[number]>(currency);
  const [budgetFlexibility, setBudgetFlexibility] = useState<TripBudgetFlexibility>("fixed");

  const [hotelStars, setHotelStars] = useState<number | "">("");
  const [mealPreference, setMealPreference] = useState<string>("");
  const [transportation, setTransportation] = useState<string>("");
  const [visaRequired, setVisaRequired] = useState(false);
  const [travelStyle, setTravelStyle] = useState<string>("");
  const [flightIncluded, setFlightIncluded] = useState(false);
  const [transferIncluded, setTransferIncluded] = useState(false);
  const [visaAssistance, setVisaAssistance] = useState(false);
  const [travelInsurance, setTravelInsurance] = useState(false);
  const [preferredAirline, setPreferredAirline] = useState("");

  const [accommodationPreferences, setAccommodationPreferences] = useState("");
  const [activitiesInterests, setActivitiesInterests] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachmentDraft, setAttachmentDraft] = useState("");
  const [offerExpirationHours, setOfferExpirationHours] = useState<24 | 48 | 72>(48);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editId) {
      try {
        const cached = sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}new`);
        if (cached) {
          const parsed = JSON.parse(cached) as DraftState;
          applyDraft(parsed);
        }
      } catch {}
      return;
    }
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const row = await api.tripMarketplace.getRequest(editId);
        setPersistedId(row.id);
        setDestination(row.destination || "");
        setDestinationType(row.destination_type || "any");
        setCountry(row.country || "");
        setCity(row.city || "");
        setStartDate(row.start_date || "");
        setEndDate(row.end_date || "");
        setFlexibleDates(!!row.flexible_dates);
        setDuration(row.duration ?? "");
        setAdults(row.adults ?? 1);
        setChildren(row.children ?? 0);
        setIdealBudget(row.ideal_budget ?? row.budget ?? "");
        setMaxBudget(row.max_budget ?? "");
        setBudgetCurrency((row.budget_currency || row.currency || currency) as (typeof budgetCurrencies)[number]);
        setBudgetFlexibility(row.budget_flexibility || "fixed");
        setHotelStars(row.hotel_stars ?? "");
        setMealPreference(row.meal_preference || row.meal_type || "");
        setTransportation(row.transportation || "");
        setVisaRequired(!!row.visa_required);
        setTravelStyle(row.travel_style || "");
        setFlightIncluded(!!row.flight_included);
        setTransferIncluded(!!row.transfer_included);
        setVisaAssistance(!!row.visa_assistance);
        setTravelInsurance(!!row.travel_insurance);
        setPreferredAirline(row.preferred_airline || "");
        setAccommodationPreferences(row.accommodation_preferences || "");
        setActivitiesInterests(row.activities_interests || "");
        setSpecialRequirements(row.special_requirements || "");
        setNotes(row.notes || row.special_notes || "");
        setAttachments(Array.isArray(row.attachments) ? row.attachments : []);
        setOfferExpirationHours((row.offer_expiration_hours as 24 | 48 | 72) || 48);
      } catch {
        setMessage({ type: "error", text: t("common_try_again") });
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, currency, budgetCurrencies, t]);

  const currentPayload = useCallback((): DraftState => {
    const idealNum = typeof idealBudget === "number" ? idealBudget : idealBudget === "" ? undefined : Number(idealBudget);
    const maxNum = typeof maxBudget === "number" ? maxBudget : maxBudget === "" ? undefined : Number(maxBudget);
    const durNum = typeof duration === "number" ? duration : duration === "" ? undefined : Number(duration);
    const starsNum = typeof hotelStars === "number" ? hotelStars : hotelStars === "" ? undefined : Number(hotelStars);
    return {
      destination: destination.trim() || undefined,
      destination_type: destinationType,
      country: country.trim() || undefined,
      city: city.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      flexible_dates: flexibleDates,
      duration: durNum,
      adults,
      children,
      ideal_budget: idealNum,
      max_budget: maxNum,
      budget_currency: budgetCurrency,
      budget_flexibility: budgetFlexibility,
      hotel_stars: starsNum,
      meal_preference: mealPreference.trim() || undefined,
      transportation: transportation.trim() || undefined,
      visa_required: visaRequired,
      travel_style: travelStyle.trim() || undefined,
      flight_included: flightIncluded,
      transfer_included: transferIncluded,
      visa_assistance: visaAssistance,
      travel_insurance: travelInsurance,
      preferred_airline: preferredAirline.trim() || undefined,
      accommodation_preferences: accommodationPreferences.trim() || undefined,
      activities_interests: activitiesInterests.trim() || undefined,
      special_requirements: specialRequirements.trim() || undefined,
      notes: notes.trim() || undefined,
      attachments: attachments.length ? attachments : undefined,
      offer_expiration_hours: offerExpirationHours,
    };
  }, [destination, destinationType, country, city, startDate, endDate, flexibleDates, duration, adults, children, idealBudget, maxBudget, budgetCurrency, budgetFlexibility, hotelStars, mealPreference, transportation, visaRequired, travelStyle, flightIncluded, transferIncluded, visaAssistance, travelInsurance, preferredAirline, accommodationPreferences, activitiesInterests, specialRequirements, notes, attachments, offerExpirationHours]);

  const applyDraft = (d: DraftState) => {
    if (d.destination !== undefined) setDestination(d.destination);
    if (d.destination_type !== undefined) setDestinationType(d.destination_type);
    if (d.country !== undefined) setCountry(d.country);
    if (d.city !== undefined) setCity(d.city);
    if (d.start_date !== undefined) setStartDate(d.start_date);
    if (d.end_date !== undefined) setEndDate(d.end_date);
    if (d.flexible_dates !== undefined) setFlexibleDates(d.flexible_dates);
    if (d.duration !== undefined) setDuration(d.duration);
    if (d.adults !== undefined) setAdults(d.adults);
    if (d.children !== undefined) setChildren(d.children);
    if (d.ideal_budget !== undefined) setIdealBudget(d.ideal_budget);
    if (d.max_budget !== undefined) setMaxBudget(d.max_budget);
    if (d.budget_currency !== undefined) setBudgetCurrency(d.budget_currency as (typeof budgetCurrencies)[number]);
    if (d.budget_flexibility !== undefined) setBudgetFlexibility(d.budget_flexibility);
    if (d.hotel_stars !== undefined) setHotelStars(d.hotel_stars);
    if (d.meal_preference !== undefined) setMealPreference(d.meal_preference);
    if (d.transportation !== undefined) setTransportation(d.transportation);
    if (d.visa_required !== undefined) setVisaRequired(d.visa_required);
    if (d.travel_style !== undefined) setTravelStyle(d.travel_style);
    if (d.flight_included !== undefined) setFlightIncluded(d.flight_included);
    if (d.transfer_included !== undefined) setTransferIncluded(d.transfer_included);
    if (d.visa_assistance !== undefined) setVisaAssistance(d.visa_assistance);
    if (d.travel_insurance !== undefined) setTravelInsurance(d.travel_insurance);
    if (d.preferred_airline !== undefined) setPreferredAirline(d.preferred_airline);
    if (d.accommodation_preferences !== undefined) setAccommodationPreferences(d.accommodation_preferences);
    if (d.activities_interests !== undefined) setActivitiesInterests(d.activities_interests);
    if (d.special_requirements !== undefined) setSpecialRequirements(d.special_requirements);
    if (d.notes !== undefined) setNotes(d.notes);
    if (d.attachments !== undefined) setAttachments(d.attachments);
    if (d.offer_expiration_hours !== undefined) setOfferExpirationHours(d.offer_expiration_hours);
  };

  const saveDraft = useCallback(async () => {
    const payload = currentPayload();
    const payloadKey = JSON.stringify(payload);
    if (payloadKey === lastSavedPayloadRef.current) return;
    setSaving(true);
    try {
      if (!persistedId) {
        const token = getStoredToken();
        if (!token) {
          try {
            sessionStorage.setItem(`${DRAFT_STORAGE_PREFIX}new`, JSON.stringify(payload));
          } catch {}
          lastSavedPayloadRef.current = payloadKey;
          setSavedAt(Date.now());
          setSaving(false);
          return;
        }
        const created = await api.tripMarketplace.createRequest({
          ...payload,
          save_as_draft: true,
          flexible_dates: payload.flexible_dates ?? false,
          adults: payload.adults ?? 1,
          children: payload.children ?? 0,
          ideal_budget: payload.ideal_budget ?? 0,
          budget_currency: payload.budget_currency ?? "USD",
          budget_flexibility: payload.budget_flexibility ?? "fixed",
          offer_expiration_hours: payload.offer_expiration_hours ?? 48,
        });
        setPersistedId(created.id);
        onSavedDraft?.(created);
      } else {
        await api.tripMarketplace.updateRequest(persistedId, payload);
      }
      lastSavedPayloadRef.current = payloadKey;
      setSavedAt(Date.now());
      try { sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}new`); } catch {}
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
    } finally {
      setSaving(false);
    }
  }, [currentPayload, persistedId, onSavedDraft, t]);

  useEffect(() => {
    if (loading) return;
    if (!getStoredToken()) {
      try {
        sessionStorage.setItem(`${DRAFT_STORAGE_PREFIX}new`, JSON.stringify(currentPayload()));
      } catch {}
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void saveDraft();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [loading, saveDraft, currentPayload]);

  const validateForSubmit = () => {
    const cleanedDestination = destination.trim();
    if (!cleanedDestination) return t("custom_trip_error_destination");
    if (!Number.isFinite(adults) || adults < 1) return t("custom_trip_error_adults");
    if (!Number.isFinite(children) || children < 0) return t("custom_trip_error_children");
    if (!flexibleDates) {
      if (!startDate || !endDate) return t("custom_trip_error_dates");
      if (startDate > endDate) return t("custom_trip_error_dates_order");
    }
    const ideal = typeof idealBudget === "number" ? idealBudget : Number(idealBudget);
    if (!Number.isFinite(ideal) || ideal <= 0) return t("custom_trip_error_ideal_budget");
    const max = typeof maxBudget === "number" ? maxBudget : maxBudget === "" ? null : Number(maxBudget);
    if (max !== null && (!Number.isFinite(max) || max < ideal)) return t("custom_trip_error_max_budget");
    return null;
  };

  const submit = async () => {
    if (!getStoredToken()) {
      router.push(`/login?redirect=${encodeURIComponent("/request-custom-offers")}`);
      return;
    }
    const err = validateForSubmit();
    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const payload = currentPayload();
      const normalized = {
        ...payload,
        destination: destination.trim(),
        flexible_dates: payload.flexible_dates ?? false,
        adults: payload.adults ?? 1,
        children: payload.children ?? 0,
        ideal_budget: typeof payload.ideal_budget === "number" ? payload.ideal_budget : Number(payload.ideal_budget),
        max_budget: payload.max_budget !== undefined ? (Number.isFinite(payload.max_budget) ? payload.max_budget : null) : null,
        budget_currency: payload.budget_currency || "USD",
        budget_flexibility: payload.budget_flexibility || "fixed",
        offer_expiration_hours: payload.offer_expiration_hours ?? 48,
      };
      let result: TripRequest;
      if (!persistedId) {
        result = await api.tripMarketplace.createRequest({
          ...normalized,
          save_as_draft: false,
        });
      } else {
        result = await api.tripMarketplace.updateRequest(persistedId, {
          ...normalized,
          submit: true,
        });
      }
      setPersistedId(result.id);
      try { sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}new`); } catch {}
      setMessage({ type: "success", text: t("custom_trip_success_submitted") });
      onSubmitted?.();
      setTimeout(() => router.push(redirectAfterSubmit), 900);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : t("custom_trip_error_submit") });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraftClick = async () => {
    if (!getStoredToken()) {
      router.push(`/login?redirect=${encodeURIComponent("/request-custom-offers")}`);
      return;
    }
    await saveDraft();
    setMessage({ type: "success", text: t("common_saved") });
  };

  const addAttachment = () => {
    const url = attachmentDraft.trim();
    if (!url) return;
    setAttachments((prev) => [...prev, url]);
    setAttachmentDraft("");
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const canPrev = stepIdx > 0;
  const canNext = stepIdx < STEPS.length - 1;
  const isLastStep = stepIdx === STEPS.length - 1;

  if (loading) {
    return (
      <div className={variant === "page" ? "min-h-screen bg-gray-50 py-24" : ""}>
        <div className="max-w-5xl mx-auto px-4 py-24 text-center font-black text-gray-500">{t("common_loading")}</div>
      </div>
    );
  }

  return (
    <div className={variant === "page" ? "min-h-screen bg-gray-50 py-12 sm:py-16" : ""}>
      <div className={variant === "page" ? "max-w-5xl mx-auto px-4" : ""}>
        <div className={[variant === "page" ? "bg-white rounded-[2.75rem] border border-gray-100 shadow-sm p-6 sm:p-10" : ""].join(" ")}>
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">
              {persistedId ? t("common_edit") : t("home_custom_trip_title")}
            </div>
            <h1 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-gray-900">{t("home_custom_trip_cta")}</h1>
            <p className="mt-3 text-gray-600 text-lg font-medium leading-relaxed">{t("home_custom_trip_subtitle")}</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2 sm:gap-3">
            {STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStepIdx(i)}
                aria-current={i === stepIdx}
                className={`inline-flex items-center gap-2 rounded-full px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-black transition border ${
                  i === stepIdx
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200"
                    : i < stepIdx
                    ? "bg-green-50 text-green-700 border-green-100"
                    : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                }`}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-black">
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{t(`custom_trip_step_${s}` as Parameters<typeof t>[0])}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs font-bold text-gray-400">
            {savedAt ? (
              <span className="inline-flex items-center gap-1 text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {t("common_saved")} · {new Date(savedAt).toLocaleTimeString()}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                {t("custom_trip_autosave_hint")}
              </span>
            )}
            {saving ? <span className="text-blue-600">{t("common_please_wait")}…</span> : null}
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            {STEPS[stepIdx] === "destination" && (
              <>
                <div className="space-y-6">
                  <Field label={t("custom_trip_destination")}>
                    <input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      placeholder={t("search_where")}
                    />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t("custom_trip_country")}>
                      <input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                        placeholder={t("custom_trip_optional")}
                      />
                    </Field>
                    <Field label={t("custom_trip_city")}>
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                        placeholder={t("custom_trip_optional")}
                      />
                    </Field>
                  </div>
                  <Field label={t("custom_trip_destination_type")}>
                    <select
                      value={destinationType}
                      onChange={(e) => setDestinationType(e.target.value as TripDestinationType)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    >
                      <option value="any">{t("custom_trip_destination_type_any")}</option>
                      <option value="country">{t("custom_trip_destination_type_country")}</option>
                      <option value="city">{t("custom_trip_destination_type_city")}</option>
                    </select>
                  </Field>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t("custom_trip_start_date")}>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={flexibleDates}
                        className="w-full bg-gray-50 disabled:opacity-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      />
                    </Field>
                    <Field label={t("custom_trip_end_date")}>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={flexibleDates}
                        className="w-full bg-gray-50 disabled:opacity-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      />
                    </Field>
                  </div>
                  <Toggle label={t("custom_trip_flexible_dates")} hint={t("custom_trip_flexible_dates_hint")} value={flexibleDates} onChange={setFlexibleDates} />
                  <Field label={t("custom_trip_duration_days")}>
                    <input
                      type="number"
                      min={1}
                      value={duration}
                      onChange={(e) => setDuration(e.target.value === "" ? "" : Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      placeholder={t("custom_trip_optional")}
                    />
                  </Field>
                </div>
              </>
            )}

            {STEPS[stepIdx] === "travelers" && (
              <>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t("custom_trip_adults")}>
                      <input
                        type="number"
                        min={1}
                        value={adults}
                        onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      />
                    </Field>
                    <Field label={t("custom_trip_children")}>
                      <input
                        type="number"
                        min={0}
                        value={children}
                        onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      />
                    </Field>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="rounded-[2.5rem] border border-gray-100 bg-white shadow-sm p-8 text-sm font-bold text-gray-500 leading-relaxed">
                    <div className="font-black text-gray-900 text-base mb-2">{t("custom_trip_travelers_hint_title")}</div>
                    {t("custom_trip_travelers_hint")}
                  </div>
                </div>
              </>
            )}

            {STEPS[stepIdx] === "budget" && (
              <>
                <div className="space-y-6">
                  <div className="rounded-[2.5rem] border border-gray-100 bg-white shadow-sm p-8">
                    <div className="text-sm font-black text-gray-900">{t("custom_trip_budget_section")}</div>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label={t("custom_trip_ideal_budget")}>
                        <input
                          type="number"
                          min={0}
                          value={idealBudget}
                          onChange={(e) => setIdealBudget(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                        />
                      </Field>
                      <Field label={t("custom_trip_max_budget")}>
                        <input
                          type="number"
                          min={0}
                          value={maxBudget}
                          onChange={(e) => setMaxBudget(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                          placeholder={t("custom_trip_optional")}
                        />
                      </Field>
                      <Field label={t("custom_trip_budget_currency")}>
                        <select
                          value={budgetCurrency}
                          onChange={(e) => setBudgetCurrency(e.target.value as (typeof budgetCurrencies)[number])}
                          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                        >
                          {budgetCurrencies.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label={t("custom_trip_budget_flexibility")}>
                        <select
                          value={budgetFlexibility}
                          onChange={(e) => setBudgetFlexibility(e.target.value as TripBudgetFlexibility)}
                          className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                        >
                          <option value="fixed">{t("custom_trip_budget_fixed")}</option>
                          <option value="flexible_10">{t("custom_trip_budget_flex_10")}</option>
                          <option value="flexible_20">{t("custom_trip_budget_flex_20")}</option>
                          <option value="no_budget_limit">{t("custom_trip_budget_no_limit")}</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <Field label={t("custom_trip_offer_expiration")}>
                    <select
                      value={offerExpirationHours}
                      onChange={(e) => setOfferExpirationHours(Number(e.target.value) as 24 | 48 | 72)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    >
                      <option value={24}>24 {t("custom_trip_hours")}</option>
                      <option value={48}>48 {t("custom_trip_hours")}</option>
                      <option value={72}>72 {t("custom_trip_hours")}</option>
                    </select>
                  </Field>
                </div>
              </>
            )}

            {STEPS[stepIdx] === "preferences" && (
              <>
                <div className="space-y-6">
                  <Field label={t("custom_trip_hotel_stars")}>
                    <select
                      value={hotelStars}
                      onChange={(e) => setHotelStars(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    >
                      <option value="">{t("custom_trip_optional")}</option>
                      {[3, 4, 5].map((star) => (
                        <option key={star} value={star}>{star}★</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("custom_trip_meal_preference")}>
                    <select
                      value={mealPreference}
                      onChange={(e) => setMealPreference(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    >
                      <option value="">{t("custom_trip_optional")}</option>
                      {MEAL_PREFS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("custom_trip_transportation")}>
                    <select
                      value={transportation}
                      onChange={(e) => setTransportation(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    >
                      <option value="">{t("custom_trip_optional")}</option>
                      {TRANSPORT_OPTIONS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("custom_trip_travel_style")}>
                    <select
                      value={travelStyle}
                      onChange={(e) => setTravelStyle(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    >
                      <option value="">{t("custom_trip_optional")}</option>
                      {TRAVEL_STYLES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Toggle label={t("custom_trip_flight_included")} value={flightIncluded} onChange={setFlightIncluded} />
                    <Toggle label={t("custom_trip_transfer_included")} value={transferIncluded} onChange={setTransferIncluded} />
                    <Toggle label={t("custom_trip_visa_assistance")} value={visaAssistance} onChange={setVisaAssistance} />
                    <Toggle label={t("custom_trip_travel_insurance")} value={travelInsurance} onChange={setTravelInsurance} />
                  </div>
                  <Toggle label={t("custom_trip_visa_required")} value={visaRequired} onChange={setVisaRequired} />
                  <Field label={t("custom_trip_preferred_airline")}>
                    <input
                      value={preferredAirline}
                      onChange={(e) => setPreferredAirline(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      placeholder={t("custom_trip_optional")}
                    />
                  </Field>
                </div>
              </>
            )}

            {STEPS[stepIdx] === "details" && (
              <>
                <div className="space-y-6">
                  <Field label={t("custom_trip_accommodation_preferences")}>
                    <textarea
                      value={accommodationPreferences}
                      onChange={(e) => setAccommodationPreferences(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                      placeholder={t("custom_trip_optional")}
                    />
                  </Field>
                  <Field label={t("custom_trip_activities_interests")}>
                    <textarea
                      value={activitiesInterests}
                      onChange={(e) => setActivitiesInterests(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                      placeholder={t("custom_trip_optional")}
                    />
                  </Field>
                  <Field label={t("custom_trip_special_requirements")}>
                    <textarea
                      value={specialRequirements}
                      onChange={(e) => setSpecialRequirements(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                      placeholder={t("custom_trip_optional")}
                    />
                  </Field>
                </div>
                <div className="space-y-6">
                  <Field label={t("custom_trip_notes")}>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                      placeholder={t("custom_trip_optional")}
                    />
                  </Field>
                  <Field label={t("custom_trip_attachments")}>
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input
                          value={attachmentDraft}
                          onChange={(e) => setAttachmentDraft(e.target.value)}
                          className="flex-1 bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                          placeholder="https://…"
                        />
                        <button
                          type="button"
                          onClick={addAttachment}
                          className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-5 py-4 transition"
                        >
                          +
                        </button>
                      </div>
                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {attachments.map((url, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-100 px-4 py-2 text-xs font-bold text-gray-700 max-w-full"
                            >
                              <a href={url} target="_blank" rel="noreferrer noopener" className="truncate max-w-[200px] underline-offset-2 hover:underline">{url}</a>
                              <button type="button" onClick={() => removeAttachment(i)} className="text-gray-400 hover:text-red-600 font-black">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              </>
            )}
          </div>

          {message && (
            <div className={`mt-8 rounded-2xl px-6 py-4 text-sm font-black ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {message.text}
            </div>
          )}

          <div className="mt-10 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-3 lg:order-1">
              {canPrev && (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-7 py-3.5 transition"
                >
                  {t("marketplace_back")}
                </button>
              )}
              {canNext && (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
                  className="inline-flex items-center justify-center rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-7 py-3.5 transition shadow-lg"
                >
                  {t("common_next")}
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center lg:order-2">
              <button
                type="button"
                onClick={handleSaveDraftClick}
                disabled={saving || submitting}
                className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-7 py-3.5 transition disabled:opacity-50"
              >
                {t("custom_trip_save_draft")}
              </button>
              {persistedId && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(t("common_delete"))) return;
                    try {
                      await api.tripMarketplace.deleteRequest(persistedId);
                      try { sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}new`); } catch {}
                      router.push(redirectAfterSubmit);
                    } catch (e) {
                      setMessage({ type: "error", text: e instanceof Error ? e.message : t("common_try_again") });
                    }
                  }}
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-2xl bg-white border border-red-200 hover:bg-red-50 text-red-700 font-black px-7 py-3.5 transition"
                >
                  {t("common_delete")}
                </button>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={saving || submitting}
                className={`inline-flex items-center justify-center rounded-2xl px-7 py-3.5 font-black shadow-lg transition ${
                  saving || submitting ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                }`}
              >
                {submitting ? t("common_please_wait") : isLastStep ? t("custom_trip_submit") : t("custom_trip_submit_anyway")}
              </button>
              {variant === "drawer" && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-7 py-3.5 transition"
                >
                  {t("custom_trip_close")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
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

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-5 py-4 text-left border border-transparent hover:border-gray-100 transition"
      aria-pressed={value}
    >
      <div className="min-w-0">
        <div className="text-sm font-black text-gray-900">{label}</div>
        {hint ? <div className="text-xs text-gray-500 font-medium mt-1">{hint}</div> : null}
      </div>
      <span className={`h-9 w-14 flex-shrink-0 rounded-full p-1 transition ${value ? "bg-blue-600" : "bg-gray-200"}`}>
        <span className={`block h-7 w-7 rounded-full bg-white shadow transition ${value ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
