"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, getStoredToken, Package } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function SavedPackagesPage() {
  const { t, formatPackageMoney } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Package[]>([]);

  const nav = useMemo(() => userNav(t), [t]);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const pkgs = await api.favorites.listPackages();
        setItems(pkgs);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell title={t("dash_saved_title")} subtitle={t("dash_saved_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-6xl">❤️</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_saved_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_saved_empty_subtitle")}</div>
            <Link
              href="/results"
              prefetch={false}
              className="inline-flex mt-8 bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-2xl transition"
            >
              {t("dash_saved_browse")}
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
                  <div className="mt-6 flex gap-3">
                    <Link
                      href={`/details/${pkg.id}`}
                      prefetch={false}
                      className="flex-1 text-center bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition"
                    >
                      {t("results_view_details")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          try {
                            await api.favorites.remove(pkg.id);
                            setItems((prev) => prev.filter((p) => p.id !== pkg.id));
                          } catch {
                            return;
                          }
                        })();
                      }}
                      className="px-4 py-3 rounded-2xl border border-gray-200 bg-white font-black text-gray-700 hover:bg-gray-50 transition"
                    >
                      {t("dash_saved_remove")}
                    </button>
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
