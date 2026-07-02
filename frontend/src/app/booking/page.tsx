"use client";

import Image from "next/image";
import { api, Booking as BookingType, getStoredToken } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function Booking() {
  const { t, formatMoney } = useLanguage();
  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [loading, setLoading] = useState(true);

  const getStatusLabel = (status?: string | null) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "pending") return t("bookings_status_pending");
    if (normalized === "accepted") return t("bookings_status_accepted");
    if (normalized === "payment_pending") return t("bookings_status_payment_pending");
    if (normalized === "confirmed") return t("bookings_status_confirmed");
    if (normalized === "in_progress") return t("bookings_status_in_progress");
    if (normalized === "completed") return t("bookings_status_completed");
    if (normalized === "rejected") return t("bookings_status_rejected");
    if (normalized === "cancelled") return t("bookings_status_cancelled");
    if (normalized === "refund_requested") return t("bookings_status_refund_requested");
    if (normalized === "refunded") return t("bookings_status_refunded");
    if (normalized === "disputed") return t("bookings_status_disputed");
    return status || t("bookings_status_pending");
  };

  const getStatusClass = (status?: string | null) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "accepted") return "bg-indigo-50 text-indigo-800 border-indigo-100";
    if (normalized === "payment_pending") return "bg-yellow-50 text-yellow-800 border-yellow-100";
    if (normalized === "confirmed") return "bg-green-50 text-green-700 border-green-100";
    if (normalized === "in_progress") return "bg-blue-50 text-blue-700 border-blue-100";
    if (normalized === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (normalized === "rejected") return "bg-red-50 text-red-700 border-red-100";
    if (normalized === "cancelled") return "bg-gray-50 text-gray-700 border-gray-200";
    if (normalized === "refund_requested") return "bg-orange-50 text-orange-800 border-orange-100";
    if (normalized === "refunded") return "bg-gray-50 text-gray-700 border-gray-200";
    if (normalized === "disputed") return "bg-purple-50 text-purple-800 border-purple-100";
    return "bg-blue-50 text-blue-700 border-blue-100";
  };

  const fetchBookings = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await api.bookings.getMine();
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchBookings();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchBookings]);

  const handleCancel = async (id: number) => {
    if (!confirm(t("bookings_confirm_cancel"))) return;
    
    try {
      const updated = await api.bookings.cancel(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch {
      alert(t("bookings_cancel_failed"));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 font-medium">{t("bookings_loading")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">{t("bookings_title")}</h1>
      
      {bookings.length > 0 ? (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow">
              <div className="relative w-full md:w-48 h-48 flex-shrink-0">
                <Image
                  src={booking.package?.image_url || "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop"}
                  alt={booking.package?.title || t("bookings_package_alt")}
                  fill
                  className="object-cover"
                  sizes="200px"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1 block">
                        {t("bookings_order", { id: booking.id })}
                      </span>
                      <h3 className="text-xl font-bold text-gray-900">{booking.package?.title}</h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusClass(booking.status)}`}>
                      {getStatusLabel(booking.status)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-gray-500 text-sm mt-1">
                    <p>
                      {booking.number_of_people}{" "}
                      {booking.number_of_people === 1 ? t("bookings_person") : t("bookings_people")}
                    </p>
                    <span>•</span>
                    <p>{t("bookings_travel_date", { date: new Date(booking.travel_date).toLocaleDateString() })}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-6 border-t border-gray-50 mt-4">
                  <div className="text-lg font-bold text-gray-900">
                    {t("bookings_total")}{" "}
                    <span className="text-blue-600">
                      {formatMoney(
                        booking.offered_total_price ??
                          booking.total_price ??
                          (booking.package?.price || 0) * (booking.number_of_people || 0)
                        ,
                        booking.currency || "USD"
                      )}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleCancel(booking.id)}
                    className="text-sm font-bold text-gray-400 hover:text-red-500 transition duration-200 py-2 px-4 rounded-lg hover:bg-red-50"
                  >
                    {t("bookings_cancel")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-20 text-center">
          <div className="text-5xl mb-6">✈️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("bookings_none_title")}</h2>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">{t("bookings_none_subtitle")}</p>
          <Link
            href="/results"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-4 rounded-2xl transition duration-200 shadow-lg shadow-blue-100"
          >
            {t("bookings_browse")}
          </Link>
        </div>
      )}
    </div>
  );
}
