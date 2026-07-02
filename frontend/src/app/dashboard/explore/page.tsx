"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, Package } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function DashboardExplorePage() {
  const { t, formatPackageMoney } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Package[]>([]);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        try {
          setLoading(true);
          const data = await api.packages.search();
          setItems(data);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <DashboardShell title={t("dash_explore")} subtitle={t("dashboard_browse_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-6xl">🧭</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("results_none_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("results_none_subtitle")}</div>
            <Link
              href="/results"
              prefetch={false}
              className="inline-flex mt-8 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-2xl transition"
            >
              {t("dash_explore")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((pkg) => (
              <div key={pkg.id} className="bg-gray-50 rounded-[2rem] border border-gray-100 overflow-hidden">
                <div className="relative h-48">
                  <Image
                    src={
                      pkg.image_url ||
                      "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop"
                    }
                    alt={pkg.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-black text-gray-900">{pkg.title}</div>
                      <div className="text-sm font-bold text-gray-500 mt-1">📍 {pkg.destination}</div>
                    </div>
                    <div className="text-xl font-black text-blue-600">{formatPackageMoney(pkg)}</div>
                  </div>
                  <div className="mt-6">
                    <Link
                      href={`/details/${pkg.id}`}
                      prefetch={false}
                      className="block text-center bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition"
                    >
                      {t("results_view_details")}
                    </Link>
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
