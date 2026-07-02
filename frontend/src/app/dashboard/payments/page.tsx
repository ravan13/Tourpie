"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, Booking, getStoredToken, isAuthErrorMessage } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo, useState } from "react";

export default function PaymentsPage() {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setBookings([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const mine = await api.bookings.getMine();
        setBookings(mine);
      } catch {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const payNow = async (id: number) => {
    try {
      const updated = await api.bookings.confirmPayment(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (isAuthErrorMessage(message)) return;
      alert(message || t("dash_payments_payment_failed"));
    }
  };

  const requestRefund = async (id: number) => {
    if (!confirm(t("dash_payments_refund_confirm"))) return;
    try {
      const updated = await api.bookings.requestRefund(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (isAuthErrorMessage(message)) return;
      alert(message || t("dash_payments_refund_failed"));
    }
  };

  const dispute = async (id: number) => {
    if (!confirm(t("dash_payments_dispute_confirm"))) return;
    try {
      const updated = await api.bookings.dispute(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (isAuthErrorMessage(message)) return;
      alert(message || t("dash_payments_dispute_failed"));
    }
  };

  return (
    <DashboardShell title={t("dash_payments_title")} subtitle={t("dash_payments_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : bookings.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-6xl">💳</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_payments_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_payments_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="font-black text-gray-900">
                      {b.package?.title ? b.package.title : t("dash_payments_booking", { id: b.id })}
                    </div>
                    <div className="mt-2 text-sm font-bold text-gray-500">
                      {t("dash_payments_status", { status: String(b.payment_status || "none") })}
                    </div>
                    {b.payment_reference ? (
                      <div className="mt-1 text-xs font-black text-gray-400">{b.payment_reference}</div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(b.status === "accepted" || b.status === "payment_pending" || b.payment_status === "awaiting_user_payment") ? (
                        <button
                          type="button"
                          onClick={() => void payNow(b.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-2xl transition"
                        >
                          {t("dash_payments_pay_now")}
                        </button>
                      ) : null}
                      {(b.status === "confirmed" || b.status === "completed" || b.status === "in_progress") ? (
                        <button
                          type="button"
                          onClick={() => void requestRefund(b.id)}
                          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
                        >
                          {t("dash_payments_refund")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void dispute(b.id)}
                        className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
                      >
                        {t("dash_payments_dispute")}
                      </button>
                    </div>
                  </div>
                  <div className="text-xl font-black text-blue-600">
                    {formatMoney(b.offered_total_price ?? b.total_price, b.currency || "USD")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
