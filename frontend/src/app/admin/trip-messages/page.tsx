"use client";

import DashboardShell from "@/components/DashboardShell";
import { adminNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import { useMemo } from "react";

export default function AdminTripMessagesPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  return (
    <DashboardShell title={t("admin_nav_trip_messages")} subtitle={t("home_custom_trip_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center">
        <div className="text-6xl mb-4">💬</div>
        <div className="text-xl font-black text-gray-900">{t("admin_nav_trip_messages")}</div>
        <div className="mt-2 text-gray-500 font-medium">{t("common_coming_soon")}</div>
      </div>
    </DashboardShell>
  );
}

