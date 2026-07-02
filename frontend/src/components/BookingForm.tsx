"use client";

import { useState } from "react";
import { api, Package } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

export default function BookingForm({ pkg }: { pkg: Package }) {
  const { t, currency, formatPackageMoney } = useLanguage();
  const [guests, setGuests] = useState(1);
  const [date, setDate] = useState("");
  const [additionalRequests, setAdditionalRequests] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleBooking = async () => {
    if (!date) {
      setMessage({ type: "error", text: t("booking_error_date") });
      return;
    }
    if (!Number.isFinite(guests) || guests < 1) {
      setMessage({ type: "error", text: t("booking_error_generic") });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await api.bookings.initiatePayment({
        package_id: pkg.id,
        number_of_people: guests,
        travel_date: new Date(date).toISOString(),
        additional_requests: additionalRequests.trim() ? additionalRequests.trim() : null,
        currency,
      });
      setMessage({ type: "success", text: t("booking_payment_initiated") });
      setTimeout(() => {
        router.push("/booking");
      }, 1200);
    } catch {
      setMessage({ type: "error", text: t("booking_error_generic") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 sticky top-24">
      <div className="flex justify-between items-end mb-8">
        <div>
          <span className="text-3xl font-extrabold text-blue-600">{formatPackageMoney(pkg)}</span>
          <span className="text-gray-400 font-medium ml-1">{t("booking_per_person")}</span>
        </div>
        <div className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
          {t("booking_best_value")}
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {t("booking_travel_date")}
          </label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {t("booking_guests_label")}
          </label>
          <select
            value={guests}
            onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? t("booking_guest") : t("booking_guests")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {t("booking_additional_requests")}
          </label>
          <textarea
            value={additionalRequests}
            onChange={(e) => setAdditionalRequests(e.target.value)}
            rows={3}
            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium resize-none"
            placeholder={t("booking_additional_requests_placeholder")}
          />
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl text-sm font-bold ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleBooking}
        disabled={loading}
        className={`w-full font-bold py-4 rounded-2xl transition duration-200 shadow-lg mb-4 ${
          loading
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
        }`}
      >
        {loading ? t("booking_processing") : t("booking_book_now")}
      </button>
      <p className="text-center text-xs text-gray-400">{t("booking_payment_note")}</p>

      <div className="mt-8 pt-8 border-t border-gray-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl">
            🏝️
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t("booking_offered_by")}</p>
            <p className="font-bold text-gray-900">{t("booking_partner")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
