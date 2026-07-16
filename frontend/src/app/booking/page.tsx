"use client";

import Image from "next/image";
import { api, Booking as BookingType, getStoredToken } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

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
      <div className="tp-page-shell">
        <div className="relative z-[1] mx-auto max-w-5xl px-4 py-20 text-center">
          <p className="text-gray-500 font-medium">{t("bookings_loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tp-page-shell">
      <div className="relative z-[1] mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-[2.5rem] border border-white/70 bg-white/82 p-8 shadow-[0_28px_74px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{t("bookings_title")}</div>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{t("bookings_title")}</h1>
      </div>
      
      {bookings.length > 0 ? (
        <div className="mt-8 space-y-6">
          {bookings.map((booking) => (
            <Card
              key={booking.id}
              className="overflow-hidden p-0 hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]"
            >
              <div className="flex flex-col md:flex-row">
              <div className="relative w-full md:w-48 h-48 flex-shrink-0">
                <Image
                  src={booking.package?.image_url || "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop"}
                  alt={booking.package?.title || t("bookings_package_alt")}
                  fill
                  className="object-cover"
                  sizes="200px"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="mb-1 block text-xs font-black uppercase tracking-widest text-blue-600">
                        {t("bookings_order", { id: booking.id })}
                      </span>
                      <h3 className="text-xl font-black text-gray-900">{booking.package?.title}</h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClass(booking.status)}`}>
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
                  <div className="text-lg font-black text-gray-900">
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
                  <Button variant="ghost" size="sm" onClick={() => handleCancel(booking.id)} className="text-gray-500 hover:text-red-600 hover:bg-red-50/80">
                    {t("bookings_cancel")}
                  </Button>
                </div>
              </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mt-8 border-dashed py-20 text-center">
          <div className="text-5xl mb-6">✈️</div>
          <h2 className="mb-2 text-2xl font-black text-gray-900">{t("bookings_none_title")}</h2>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">{t("bookings_none_subtitle")}</p>
          <Link
            href="/results"
            className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-transparent bg-[linear-gradient(135deg,_rgba(2,42,107,0.98),_rgba(12,60,125,0.94)_55%,_rgba(255,106,26,0.94))] px-10 text-sm font-black tracking-[-0.01em] text-white shadow-[0_20px_48px_rgba(2,42,107,0.22)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(2,42,107,0.28)]"
          >
            {t("bookings_browse")}
          </Link>
        </Card>
      )}
      </div>
    </div>
  );
}
