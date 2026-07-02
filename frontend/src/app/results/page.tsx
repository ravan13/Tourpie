"use client";

import Image from "next/image";
import Link from "next/link";
import { api, getStoredToken, Package } from "@/lib/api";
import FiltersSidebar from "@/components/FiltersSidebar";
import { useLanguage } from "@/context/LanguageContext";
import { useMemo, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type SortKey = "recommended" | "price_asc" | "price_desc" | "top_rated";

function parseNumber(value: string | null) {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default function ResultsPage() {
  const { t, currency, getPackagePriceAmount, formatPackageMoney } = useLanguage();
  const searchParams = useSearchParams();
  const spKey = searchParams.toString();

  const min_budget = parseNumber(searchParams.get("min_budget"));
  const max_budget = parseNumber(searchParams.get("max_budget"));
  const country = (searchParams.get("country") || "").trim() || undefined;
  const city = (searchParams.get("city") || "").trim() || undefined;
  const region = (searchParams.get("region") || "").trim() || undefined;
  const destination = (searchParams.get("destination") || "").trim() || undefined;
  const category = (searchParams.get("category") || "").trim() || undefined;
  const currencyParam = (searchParams.get("currency") || "").trim().toUpperCase() || undefined;
  const depart_date = (searchParams.get("depart_date") || "").trim() || undefined;
  const return_date = (searchParams.get("return_date") || "").trim() || undefined;
  const flexible_days = parseNumber(searchParams.get("flexible_days"));
  const adults = parseNumber(searchParams.get("adults")) ?? 2;
  const children = parseNumber(searchParams.get("children")) ?? 0;
  const teenagers = parseNumber(searchParams.get("teenagers")) ?? 0;
  const infants = parseNumber(searchParams.get("infants")) ?? 0;
  const people = Math.max(1, adults + children + teenagers + infants);
  const duration_min = parseNumber(searchParams.get("duration_min"));
  const duration_max = parseNumber(searchParams.get("duration_max"));
  const package_type = (searchParams.get("package_type") || "").trim() || undefined;
  const hotel_rating_min = parseNumber(searchParams.get("hotel_rating_min"));
  const transportation_type = (searchParams.get("transportation_type") || "").trim() || undefined;

  const [sort, setSort] = useState<SortKey>("recommended");
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<Package[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set<number>();
    try {
      const raw = localStorage.getItem("favorites");
      const ids = raw ? (JSON.parse(raw) as number[]) : [];
      return new Set(ids.filter((x) => typeof x === "number"));
    } catch {
      return new Set<number>();
    }
  });

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    const loadFavorites = async () => {
      try {
        const favs = await api.favorites.list();
        setFavorites(new Set(favs.map((f) => f.package_id)));
      } catch {
        return;
      }
    };
    void loadFavorites();
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const sort_by: "cheapest" | "best_value" | "popular" =
          sort === "top_rated" ? "popular" : sort === "recommended" ? "best_value" : "cheapest";
        const data = await api.packages.searchAdvanced({
          min_budget,
          max_budget,
          people,
          adults,
          children,
          teenagers,
          infants,
          destination,
          country,
          city,
          region,
          category,
          package_type,
          hotel_rating_min,
          transportation_type,
          currency: (currencyParam as import("@/context/LanguageContext").Currency) || currency,
          depart_date,
          return_date,
          flexible_days,
          duration_min,
          duration_max,
          sort_by,
        });
        setPackages(data);
      } catch {
        setPackages([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchResults();
  }, [
    adults,
    children,
    city,
    country,
    currency,
    currencyParam,
    depart_date,
    destination,
    duration_max,
    duration_min,
    flexible_days,
    hotel_rating_min,
    infants,
    max_budget,
    min_budget,
    package_type,
    people,
    region,
    return_date,
    sort,
    teenagers,
    transportation_type,
    category,
  ]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      sessionStorage.setItem("tourpie:last_results_query", window.location.search || "");
    } catch {
      return;
    }
  }, [spKey]);

  const filtered = useMemo(() => {
    const sorted = [...packages];
    if (sort === "price_asc") sorted.sort((a, b) => getPackagePriceAmount(a) - getPackagePriceAmount(b));
    if (sort === "price_desc") sorted.sort((a, b) => getPackagePriceAmount(b) - getPackagePriceAmount(a));
    if (sort === "top_rated") sorted.sort((a, b) => a.id - b.id);
    return sorted;
  }, [packages, sort, getPackagePriceAmount]);

  const title = destination
    ? t("results_title_destination", { destination })
    : category
      ? t("results_title_category", { category })
      : t("results_title_all");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">{title}</h1>
          <div className="flex items-center gap-3 text-blue-100 font-medium">
            <Link href="/" className="hover:text-white transition-colors">
              {t("common_home")}
            </Link>
            <span>/</span>
            <span className="text-white">{t("results_breadcrumb")}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="lg:w-80">
            <FiltersSidebar />
          </div>

          <div className="flex-1">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
              <div className="text-gray-900">
                <span className="text-3xl font-black">{filtered.length}</span>
                <span className="text-gray-500 font-bold ml-2 uppercase tracking-widest text-sm">
                  {t("results_packages_found")}
                </span>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="bg-white border border-gray-200 rounded-2xl px-6 py-3 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                <option value="recommended">{t("results_sort_recommended")}</option>
                <option value="price_asc">{t("results_sort_price_low")}</option>
                <option value="price_desc">{t("results_sort_price_high")}</option>
                <option value="top_rated">{t("results_sort_top_rated")}</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {loading ? (
                <div className="bg-white rounded-[3rem] border border-gray-100 py-24 text-center">
                  <div className="text-gray-500 font-bold">{t("common_loading")}</div>
                </div>
              ) : filtered.length > 0 ? (
                filtered.map((pkg) => {
                  const isFavorite = favorites.has(pkg.id);
                  return (
                    <div
                      key={pkg.id}
                      className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden flex flex-col md:flex-row hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 group"
                    >
                      <div className="relative w-full md:w-80 h-64 md:h-auto overflow-hidden">
                        <Image
                          src={
                            pkg.image_url ||
                            "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop"
                          }
                          alt={pkg.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-700"
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                        <div className="absolute top-6 left-6 bg-white/90 backdrop-blur px-4 py-1.5 rounded-xl text-xs font-black text-blue-600 uppercase tracking-widest">
                          {t("results_days", { days: pkg.duration_days })}
                        </div>
                      </div>
                      <div className="p-8 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                              {pkg.title}
                            </h3>
                            <div className="text-3xl font-black text-blue-600">{formatPackageMoney(pkg)}</div>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500 font-bold text-sm mb-6">
                            <span>
                              📍 {pkg.destination}
                            </span>
                            {pkg.category && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="text-blue-500 uppercase tracking-tighter">#{pkg.category}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mb-8">
                            <div className="flex text-yellow-400 text-lg">{"★".repeat(5)}</div>
                            <span className="text-sm font-black text-gray-900">4.8</span>
                            <span className="text-sm text-gray-400 font-medium">{t("results_reviews")}</span>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <Link
                            href={`/details/${pkg.id}`}
                            className="flex-1 text-center bg-gray-900 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-blue-200"
                          >
                            {t("results_view_details")}
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              const token = getStoredToken();
                              if (!token) {
                                setFavorites((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(pkg.id)) next.delete(pkg.id);
                                  else next.add(pkg.id);
                                  localStorage.setItem("favorites", JSON.stringify(Array.from(next)));
                                  return next;
                                });
                                return;
                              }
                              void (async () => {
                                try {
                                  if (isFavorite) await api.favorites.remove(pkg.id);
                                  else await api.favorites.add(pkg.id);
                                  setFavorites((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(pkg.id)) next.delete(pkg.id);
                                    else next.add(pkg.id);
                                    return next;
                                  });
                                } catch {
                                  return;
                                }
                              })();
                            }}
                            className={`px-5 py-4 rounded-2xl transition-all duration-300 border ${
                              isFavorite
                                ? "bg-red-50 text-red-600 border-red-100"
                                : "bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 border-gray-100"
                            }`}
                            aria-label={isFavorite ? t("results_fav_remove") : t("results_fav_add")}
                          >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-[3rem] border border-dashed border-gray-200 py-32 text-center">
                  <div className="text-7xl mb-8">🔍</div>
                  <h2 className="text-3xl font-black text-gray-900 mb-4">{t("results_none_title")}</h2>
                  <p className="text-gray-500 font-medium max-w-md mx-auto mb-10">
                    {t("results_none_subtitle")}
                  </p>
                  <Link
                    href="/"
                    className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 hover:-translate-y-1 transition-all"
                  >
                    {t("results_reset")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

