"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripRequest, getStoredToken } from "@/lib/api";
import { adminNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function AdminTripRequestsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TripRequest[]>([]);

  useEffect(() => {
    void (async () => {
      if (!getStoredToken()) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await api.tripMarketplace.adminListRequests();
        setItems(rows);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell title={t("admin_nav_trip_requests")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_coming_soon")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("custom_trip_destination")}</th>
                  <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("custom_trip_offer_expiration")}</th>
                  <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_table_status")}</th>
                  <th className="px-8 py-5" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-8 py-6 font-black text-gray-900">{row.request_code}</td>
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-900">{row.destination}</div>
                      <div className="mt-1 text-xs font-bold text-gray-500">
                        {row.start_date && row.end_date ? `${row.start_date} → ${row.end_date}` : t("custom_trip_flexible_dates")}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-gray-600">{new Date(row.expires_at).toLocaleString()}</td>
                    <td className="px-8 py-6 text-xs font-black uppercase tracking-widest text-gray-500">{row.status}</td>
                    <td className="px-8 py-6 text-right">
                      <Link
                        href={`/admin/preview?role=user`}
                        prefetch={false}
                        className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-5 py-3 transition"
                      >
                        {t("common_view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

