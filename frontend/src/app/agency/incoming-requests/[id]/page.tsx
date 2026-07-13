"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, TripRequest, getStoredToken } from "@/lib/api";
import { agencyNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function AgencyIncomingRequestDetailsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => agencyNav(t), [t]);
  const params = useParams();
  const idRaw = params?.id;
  const requestId = typeof idRaw === "string" ? Number(idRaw) : Array.isArray(idRaw) ? Number(idRaw[0]) : NaN;

  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<TripRequest | null>(null);

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
      } catch {
        setReq(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  return (
    <DashboardShell title={t("agency_nav_incoming_requests")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
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
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-blue-600">{req.request_code}</div>
                <div className="mt-2 text-3xl font-black text-gray-900">{req.destination}</div>
                <div className="mt-2 text-sm font-bold text-gray-500">
                  {req.start_date && req.end_date ? `${req.start_date} → ${req.end_date}` : t("custom_trip_flexible_dates")}
                </div>
              </div>
              <div className="flex flex-col gap-3 min-w-[240px]">
                <Link
                  href={`/agency/incoming-requests/${req.id}/create-offer`}
                  prefetch={false}
                  className="inline-flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 transition shadow-lg shadow-blue-200"
                >
                  {t("custom_trip_create_offer")}
                </Link>
                <Link
                  href="/agency/incoming-requests"
                  prefetch={false}
                  className="inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 transition"
                >
                  {t("marketplace_back")}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title={t("custom_trip_adults")} value={String(req.adults)} />
              <Card title={t("custom_trip_children")} value={String(req.children)} />
              <Card title={t("custom_trip_ideal_budget")} value={`${req.ideal_budget} ${req.budget_currency}`} />
              <Card title={t("custom_trip_max_budget")} value={typeof req.max_budget === "number" ? `${req.max_budget} ${req.budget_currency}` : t("custom_trip_optional")} />
              <Card title={t("custom_trip_hotel_stars")} value={req.hotel_stars ? `${req.hotel_stars}★` : t("custom_trip_optional")} />
              <Card title={t("custom_trip_meal_type")} value={req.meal_type || t("custom_trip_optional")} />
            </div>

            {req.accommodation_preferences ? <Block title={t("custom_trip_accommodation_preferences")} value={req.accommodation_preferences} /> : null}
            {req.activities_interests ? <Block title={t("custom_trip_activities_interests")} value={req.activities_interests} /> : null}
            {req.special_notes ? <Block title={t("custom_trip_special_notes")} value={req.special_notes} /> : null}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{title}</div>
      <div className="mt-2 text-sm font-bold text-gray-900 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function Block({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-400">{title}</div>
      <div className="mt-2 text-sm font-bold text-gray-900 whitespace-pre-wrap">{value}</div>
    </div>
  );
}
