"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripOffer, TripOfferStatus, TripRequest, getStoredToken } from "@/lib/api";
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

export default function AgencyCreateOfferPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const params = useParams();
  const router = useRouter();
  const idRaw = params?.id;
  const requestId = typeof idRaw === "string" ? Number(idRaw) : Array.isArray(idRaw) ? Number(idRaw[0]) : NaN;

  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<TripRequest | null>(null);
  const [existing, setExisting] = useState<TripOffer | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [currency, setCurrency] = useState("USD");
  const [hotel, setHotel] = useState("");
  const [hotelStars, setHotelStars] = useState<number | "">("");
  const [roomType, setRoomType] = useState("");
  const [mealPlan, setMealPlan] = useState("");
  const [flightIncluded, setFlightIncluded] = useState(false);
  const [airportTransfer, setAirportTransfer] = useState(false);
  const [insuranceIncluded, setInsuranceIncluded] = useState(false);
  const [visaSupport, setVisaSupport] = useState(false);
  const [breakfastIncluded, setBreakfastIncluded] = useState(false);
  const [lunchIncluded, setLunchIncluded] = useState(false);
  const [dinnerIncluded, setDinnerIncluded] = useState(false);
  const [flight, setFlight] = useState("");
  const [transfer, setTransfer] = useState("");
  const [visa, setVisa] = useState("");
  const [insurance, setInsurance] = useState("");
  const [activities, setActivities] = useState("");
  const [travelProgram, setTravelProgram] = useState("");
  const [includedServices, setIncludedServices] = useState("");
  const [excludedServices, setExcludedServices] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [additionalBenefits, setAdditionalBenefits] = useState("");
  const [notes, setNotes] = useState("");
  const [offerExpirationHours, setOfferExpirationHours] = useState<number | "">("");
  const [expirationDate, setExpirationDate] = useState("");
  const [offerAttachments, setOfferAttachments] = useState<string[]>([]);
  const [newAttachment, setNewAttachment] = useState("");

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
        setCurrency(row.budget_currency || row.currency || "USD");

        const ofs = await api.tripMarketplace.agencyListOffers(requestId).catch(() => []);
        if (ofs && ofs.length > 0) {
          const draft = ofs.find((o) => o.status === "draft") || ofs[0];
          setExisting(draft);
          hydrate(draft, row);
        }
      } catch {
        setReq(null);
        setExisting(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const hydrate = (o: TripOffer, row: TripRequest) => {
    setTotalPrice(typeof (o.total_price ?? o.price) === "number" ? (o.total_price ?? o.price)! : "");
    setCurrency(o.currency || row.budget_currency || row.currency || "USD");
    setHotel(o.hotel || "");
    setHotelStars(typeof o.hotel_stars === "number" ? o.hotel_stars : "");
    setRoomType(o.room_type || "");
    setMealPlan(o.meal_plan || "");
    setFlightIncluded(!!o.flight_included);
    setAirportTransfer(!!o.airport_transfer);
    setInsuranceIncluded(!!o.insurance_included);
    setVisaSupport(!!o.visa_support);
    setBreakfastIncluded(!!o.breakfast_included);
    setLunchIncluded(!!o.lunch_included);
    setDinnerIncluded(!!o.dinner_included);
    setFlight(o.flight || "");
    setTransfer(o.transfer || "");
    setVisa(o.visa || "");
    setInsurance(o.insurance || "");
    setActivities(o.activities || "");
    setTravelProgram(o.travel_program || "");
    setIncludedServices(o.included_services || "");
    setExcludedServices(o.excluded_services || "");
    setOfferDescription(o.offer_description || "");
    setAdditionalBenefits(o.additional_benefits || "");
    setNotes(o.notes || "");
    if (o.expiration_date) {
      setExpirationDate(new Date(o.expiration_date).toISOString().slice(0, 10));
    }
    setOfferAttachments(Array.isArray(o.offer_attachments) ? o.offer_attachments : []);
    setPriceDifferenceReason((o.price_difference_reason as (typeof priceReasons)[number]) || "");
    setPriceDifferenceNotes(o.price_difference_notes || "");
  };

  const needsJustification = useMemo(() => {
    if (!req) return false;
    const price = typeof totalPrice === "number" ? totalPrice : Number(totalPrice);
    if (!Number.isFinite(price)) return false;
    const ideal = req.ideal_budget ?? req.budget ?? null;
    if (ideal !== null && price > ideal) return true;
    if (typeof req.max_budget === "number" && price > req.max_budget) return true;
    return false;
  }, [req, totalPrice]);

  const collectPayload = () => {
    const price = typeof totalPrice === "number" ? totalPrice : Number(totalPrice);
    const base = {
      total_price: price,
      price: price,
      currency: currency || req?.budget_currency || req?.currency || "USD",
      hotel: hotel.trim() ? hotel.trim() : null,
      hotel_stars: typeof hotelStars === "number" && hotelStars > 0 ? hotelStars : null,
      room_type: roomType.trim() ? roomType.trim() : null,
      meal_plan: mealPlan.trim() ? mealPlan.trim() : null,
      flight_included: flightIncluded,
      airport_transfer: airportTransfer,
      insurance_included: insuranceIncluded,
      visa_support: visaSupport,
      breakfast_included: breakfastIncluded,
      lunch_included: lunchIncluded,
      dinner_included: dinnerIncluded,
      flight: flight.trim() ? flight.trim() : null,
      transfer: transfer.trim() ? transfer.trim() : null,
      visa: visa.trim() ? visa.trim() : null,
      insurance: insurance.trim() ? insurance.trim() : null,
      activities: activities.trim() ? activities.trim() : null,
      travel_program: travelProgram.trim() ? travelProgram.trim() : null,
      included_services: includedServices.trim() ? includedServices.trim() : null,
      excluded_services: excludedServices.trim() ? excludedServices.trim() : null,
      offer_description: offerDescription.trim() ? offerDescription.trim() : null,
      additional_benefits: additionalBenefits.trim() ? additionalBenefits.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      expiration_date: expirationDate ? new Date(expirationDate).toISOString() : null,
      offer_attachments: offerAttachments,
      attachments: offerAttachments,
      offer_expiration_hours: offerExpirationHours === "" ? null : Number(offerExpirationHours),
      price_difference_reason: priceDifferenceReason || null,
      price_difference_notes: priceDifferenceNotes.trim() ? priceDifferenceNotes.trim() : null,
    };
    return base;
  };

  const validate = (): string | null => {
    const price = typeof totalPrice === "number" ? totalPrice : Number(totalPrice);
    if (!Number.isFinite(price) || price <= 0) return t("custom_trip_error_total_price");
    if (needsJustification && !priceDifferenceReason) return t("custom_trip_error_price_reason");
    if (priceDifferenceReason === "other" && !priceDifferenceNotes.trim()) return t("custom_trip_error_price_reason_notes");
    return null;
  };

  const saveDraft = async () => {
    if (!req) return;
    const err = validate();
    if (err && (!totalPrice || Number(totalPrice) <= 0)) {
      setMessage({ type: "error", text: err });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = collectPayload();
      let row: TripOffer;
      if (existing?.id) {
        row = await api.tripMarketplace.agencyUpdateOffer(existing.id, payload);
      } else {
        try {
          row = await api.tripMarketplace.agencyCreateOffer(req.id, { ...payload, is_draft: true });
        } catch (e: any) {
          const status = e?.status || e?.response?.status;
          if (status === 409 || status === 422) {
            const ofs = await api.tripMarketplace.agencyListOffers(req.id).catch(() => []);
            if (ofs.length > 0) {
              const draft = ofs.find((o) => o.status === "draft") || ofs[0];
              setExisting(draft);
              row = await api.tripMarketplace.agencyUpdateOffer(draft.id, payload);
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }
      }
      setExisting(row);
      setMessage({ type: "success", text: t("custom_trip_success_draft_saved") });
    } catch {
      setMessage({ type: "error", text: t("custom_trip_error_offer_submit") });
    } finally {
      setSaving(false);
    }
  };

  const submitOffer = async () => {
    if (!req) return;
    const err = validate();
    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = collectPayload();
      let row: TripOffer;
      if (existing?.id) {
        row = await api.tripMarketplace.agencyUpdateOffer(existing.id, { ...payload, submit: true });
      } else {
        try {
          row = await api.tripMarketplace.agencyCreateOffer(req.id, payload);
        } catch (e: any) {
          const status = e?.status || e?.response?.status;
          if (status === 409 || status === 422) {
            const ofs = await api.tripMarketplace.agencyListOffers(req.id).catch(() => []);
            if (ofs.length > 0) {
              const first = ofs[0];
              setExisting(first);
              row = await api.tripMarketplace.agencyUpdateOffer(first.id, { ...payload, submit: true });
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }
      }
      setExisting(row);
      setMessage({ type: "success", text: t("custom_trip_success_offer_sent") });
      setTimeout(() => router.push(`/agency/incoming-requests/${req.id}`), 800);
    } catch {
      setMessage({ type: "error", text: t("custom_trip_error_offer_submit") });
    } finally {
      setSaving(false);
    }
  };

  const cancelOffer = async () => {
    if (!existing?.id) return;
    const ok = confirm(t("custom_trip_cancel_confirm"));
    if (!ok) return;
    setSaving(true);
    try {
      const row = await api.tripMarketplace.agencyCancelOffer(existing.id);
      setExisting(row);
      setMessage({ type: "success", text: t("custom_trip_success_offer_cancelled") });
    } catch {
      setMessage({ type: "error", text: t("common_try_again") });
    } finally {
      setSaving(false);
    }
  };

  const addAttachment = () => {
    const u = newAttachment.trim();
    if (!u) return;
    setOfferAttachments((prev) => [...prev, u]);
    setNewAttachment("");
  };

  const canCancel = !!existing?.id && (existing.status === "draft" || existing.status === "submitted");

  return (
    <DashboardShell title={t("custom_trip_create_offer")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 md:p-8">
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
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs font-black uppercase tracking-widest text-blue-600">{req.request_code}</div>
                  {existing?.status ? (
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${offerStatusBadgeClass(existing.status)}`}>
                      {existing.status}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-2xl font-black text-gray-900 break-words">
                  {req.destination}
                  {req.country ? ` · ${req.country}` : ""}
                  {req.city ? `, ${req.city}` : ""}
                </div>
                <div className="mt-1 text-sm font-bold text-gray-500">
                  {req.start_date && req.end_date ? `${req.start_date} → ${req.end_date}` : t("custom_trip_flexible_dates")}
                </div>
              </div>
              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5 w-full md:w-[300px] shrink-0">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{t("custom_trip_budget_section")}</div>
                <div className="mt-2 text-lg font-black text-gray-900">
                  {t("custom_trip_ideal_budget")}: {req.ideal_budget ?? req.budget ?? "-"} {req.budget_currency ?? req.currency ?? ""}
                </div>
                {typeof req.max_budget === "number" ? (
                  <div className="mt-1 text-sm font-bold text-gray-600">
                    {t("custom_trip_max_budget")}: {req.max_budget} {req.budget_currency ?? req.currency ?? ""}
                  </div>
                ) : null}
                <div className="mt-3 text-xs font-bold text-gray-500">
                  {t("custom_trip_adults")}: {req.adults ?? 0} · {t("custom_trip_children")}: {req.children ?? 0}
                </div>
              </div>
            </div>

            <Section title={t("custom_trip_pricing")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("custom_trip_total_price")} required>
                  <input
                    type="number"
                    min={0}
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  />
                </Field>
                <Field label={t("custom_trip_budget_currency")} required>
                  <input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
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
                <Field label={t("custom_trip_expiration_date")}>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  />
                </Field>
              </div>
            </Section>

            <Section title={t("custom_trip_hotel_section")}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <Field label={t("custom_trip_hotel")}>
                  <input
                    value={hotel}
                    onChange={(e) => setHotel(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  />
                </Field>
                <Field label={t("custom_trip_hotel_stars")}>
                  <select
                    value={String(hotelStars)}
                    onChange={(e) => setHotelStars(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  >
                    <option value="">{t("custom_trip_optional")}</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {"★".repeat(n)}
                      </option>
                    ))}
                  </select>
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
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <Toggle label={t("custom_trip_breakfast")} checked={breakfastIncluded} onChange={setBreakfastIncluded} />
                <Toggle label={t("custom_trip_lunch")} checked={lunchIncluded} onChange={setLunchIncluded} />
                <Toggle label={t("custom_trip_dinner")} checked={dinnerIncluded} onChange={setDinnerIncluded} />
              </div>
            </Section>

            <Section title={t("custom_trip_services_section")}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Toggle label={t("custom_trip_flight_included")} checked={flightIncluded} onChange={setFlightIncluded} />
                <Toggle label={t("custom_trip_transfer_included")} checked={airportTransfer} onChange={setAirportTransfer} />
                <Toggle label={t("custom_trip_travel_insurance")} checked={insuranceIncluded} onChange={setInsuranceIncluded} />
                <Toggle label={t("custom_trip_visa_assistance")} checked={visaSupport} onChange={setVisaSupport} />
              </div>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </Section>

            <Section title={t("custom_trip_program_services")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("custom_trip_activities_interests")}>
                  <textarea
                    value={activities}
                    onChange={(e) => setActivities(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                  />
                </Field>
                <Field label={t("custom_trip_travel_program")}>
                  <textarea
                    value={travelProgram}
                    onChange={(e) => setTravelProgram(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                  />
                </Field>
                <Field label={t("custom_trip_included_services")}>
                  <textarea
                    value={includedServices}
                    onChange={(e) => setIncludedServices(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                  />
                </Field>
                <Field label={t("custom_trip_excluded_services")}>
                  <textarea
                    value={excludedServices}
                    onChange={(e) => setExcludedServices(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                  />
                </Field>
              </div>
            </Section>

            <Section title={t("custom_trip_details_notes")}>
              <div className="grid grid-cols-1 gap-4">
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
                <Field label={t("custom_trip_notes")}>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 resize-none"
                  />
                </Field>
              </div>
              <div className="mt-5">
                <Field label={t("custom_trip_attachments")}>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      value={newAttachment}
                      onChange={(e) => setNewAttachment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAttachment();
                        }
                      }}
                      className="flex-1 bg-gray-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      placeholder="https://..."
                    />
                    <button
                      type="button"
                      onClick={addAttachment}
                      className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 transition min-h-[48px]"
                    >
                      {t("common_add")}
                    </button>
                  </div>
                  {offerAttachments.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {offerAttachments.map((u, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
                          <a
                            href={u}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex-1 text-sm font-bold text-blue-700 break-all"
                          >
                            📎 {u}
                          </a>
                          <button
                            type="button"
                            onClick={() => setOfferAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                            className="rounded-xl bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 text-xs font-black transition"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Field>
              </div>
            </Section>

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

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className={`inline-flex items-center justify-center rounded-2xl px-8 py-4 font-black transition min-h-[56px] ${
                  saving ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                }`}
              >
                {saving ? t("common_please_wait") : t("custom_trip_save_draft")}
              </button>
              <button
                type="button"
                onClick={submitOffer}
                disabled={saving}
                className={`inline-flex items-center justify-center rounded-2xl px-8 py-4 font-black transition shadow-lg min-h-[56px] ${
                  saving ? "bg-blue-400 text-white/80 cursor-wait shadow-blue-200" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                }`}
              >
                {saving ? t("common_please_wait") : existing ? t("custom_trip_update_offer") : t("custom_trip_send_offer")}
              </button>
              {canCancel ? (
                <button
                  type="button"
                  onClick={cancelOffer}
                  disabled={saving}
                  className={`inline-flex items-center justify-center rounded-2xl px-8 py-4 font-black transition border min-h-[56px] ${
                    saving ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-white border-red-200 hover:bg-red-50 text-red-700"
                  }`}
                >
                  {t("custom_trip_cancel_offer")}
                </button>
              ) : null}
              <Link
                href={`/agency/incoming-requests/${req.id}`}
                prefetch={false}
                className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-8 py-4 transition min-h-[56px]"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-gray-50/60 p-6">
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-400 mb-5">{title}</div>
      {children}
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-2xl px-4 py-3 text-sm font-black transition border min-h-[52px] ${
        checked ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
      }`}
    >
      <span className="mr-2">{checked ? "✓" : "○"}</span>
      {label}
    </button>
  );
}
