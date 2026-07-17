"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, getStoredToken } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useSearchParams } from "next/navigation";
import {
  MarketplaceAgency,
  MarketplacePackage,
  buildAgencyMap,
  buildCompanySummaries,
  buildRankingMap,
  getAgencyDisplayDescription,
  getAgencyDisplayName,
  getAgencyLogoUrl,
  getAgencyInitials,
  getDiscountedPackagePrice,
  getPackageAvailableDateRanges,
  getPackageDisplayCountry,
  getPackageDisplayDestination,
  getPackageDisplayDescription,
  getPackageDisplayTitle,
  getPackageIncludedServices,
  getPackagePopularityScore,
  getPackagePrimaryImage,
  getPackageRating,
  getPackageReviewCount,
  matchesDateAvailability,
  matchesDestination,
} from "@/lib/marketplace";
import {
  demoMarketplaceCompanies,
  demoMarketplacePackages,
  demoTopRatedMarketplacePackages,
  demoTrendingMarketplacePackages,
} from "@/lib/demoMarketplaceData";

type SortValue =
  | "alpha_asc"
  | "alpha_desc"
  | "price_asc"
  | "price_desc"
  | "popular"
  | "rating"
  | "newest";

function toLower(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function toCategoryKey(category: string) {
  const slug = category
    .trim()
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `marketplace_category_${slug}`;
}

function matchesQuery(pkg: MarketplacePackage, query: string, language: Parameters<typeof getPackageDisplayTitle>[1]) {
  if (!query.trim()) return true;
  const q = toLower(query);
  return toLower(getPackageDisplayTitle(pkg, language)).includes(q);
}

function getDiscountPercent(pkg: MarketplacePackage) {
  const originalPrice = getDiscountedPackagePrice(pkg);
  if (!originalPrice || originalPrice <= pkg.price) return null;
  const percent = Math.round(((originalPrice - pkg.price) / originalPrice) * 100);
  return Number.isFinite(percent) && percent > 0 ? percent : null;
}

export default function MarketplacePage() {
  const { t, language, formatPackageMoney, getPackagePriceAmount, formatCurrency } = useLanguage();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<MarketplacePackage[]>(demoMarketplacePackages);
  const [agencies, setAgencies] = useState<MarketplaceAgency[]>(demoMarketplaceCompanies);
  const [trendingIds, setTrendingIds] = useState<Map<number, number>>(new Map());
  const [topRatedIds, setTopRatedIds] = useState<Map<number, number>>(new Map());
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set<number>();
    try {
      const raw = localStorage.getItem("favorites");
      const ids = raw ? (JSON.parse(raw) as number[]) : [];
      return new Set(ids.filter((id) => typeof id === "number"));
    } catch {
      return new Set<number>();
    }
  });

  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState("");
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const [availableDate, setAvailableDate] = useState("");
  const [collection, setCollection] = useState("");
  const [sort, setSort] = useState<SortValue>("popular");
  const appliedUrlFiltersRef = useRef(false);

  useEffect(() => {
    if (appliedUrlFiltersRef.current) return;

    const safeGet = (key: string) => {
      const v = searchParams?.get(key);
      return typeof v === "string" ? v.trim() : "";
    };

    const urlDestination = safeGet("destination") || safeGet("country");
    const urlCategory = safeGet("category");
    const urlMinPrice = safeGet("minPrice");
    const urlMaxPrice = safeGet("maxPrice");
    const urlMinDuration = safeGet("minDuration");
    const urlMaxDuration = safeGet("maxDuration");
    const urlCollection = safeGet("collection");

    appliedUrlFiltersRef.current = true;
    window.setTimeout(() => {
      if (urlDestination) setDestination(urlDestination);
      if (urlCategory) setCategory(urlCategory);
      if (urlMinPrice) setMinPrice(urlMinPrice);
      if (urlMaxPrice) setMaxPrice(urlMaxPrice);
      if (urlMinDuration) setMinDuration(urlMinDuration);
      if (urlMaxDuration) setMaxDuration(urlMaxDuration);
      if (urlCollection) setCollection(urlCollection);
    }, 0);
  }, [searchParams]);

  useEffect(() => {
    const loadMarketplace = async () => {
      setLoading(true);

      const [packagesRes, agenciesRes, trendingRes, topRatedRes] = await Promise.allSettled([
        api.packages.getAll(0, 500),
        api.agencies.getAll(0, 300),
        api.recommendations.getTrending(24),
        api.recommendations.getTop_rated(24),
      ]);

      const livePackages = packagesRes.status === "fulfilled" ? packagesRes.value : [];
      const liveAgencies = agenciesRes.status === "fulfilled" ? agenciesRes.value : [];
      const liveTrending = trendingRes.status === "fulfilled" ? trendingRes.value : [];
      const liveTopRated = topRatedRes.status === "fulfilled" ? topRatedRes.value : [];

      setPackages([...demoMarketplacePackages, ...livePackages]);
      setAgencies([...demoMarketplaceCompanies, ...liveAgencies]);
      setTrendingIds(buildRankingMap([...demoTrendingMarketplacePackages, ...liveTrending]));
      setTopRatedIds(buildRankingMap([...demoTopRatedMarketplacePackages, ...liveTopRated]));
      setLoading(false);
    };

    void loadMarketplace();
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const loadFavorites = async () => {
      try {
        const items = await api.favorites.list();
        setFavorites(new Set(items.map((item) => item.package_id)));
      } catch {
        setFavorites(new Set<number>());
      }
    };

    void loadFavorites();
  }, []);

  const activePackages = useMemo(
    () => packages.filter((pkg) => !pkg.status || pkg.status === "active"),
    [packages]
  );

  const rankingMaps = useMemo(
    () => ({ trendingRanks: trendingIds, topRatedRanks: topRatedIds }),
    [topRatedIds, trendingIds]
  );

  const agencyMap = useMemo(() => buildAgencyMap(agencies, activePackages), [activePackages, agencies]);

  const companies = useMemo(
    () => buildCompanySummaries(agencyMap, activePackages, rankingMaps, language),
    [activePackages, agencyMap, rankingMaps, language]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(activePackages.map((pkg) => (pkg.category || pkg.package_type || "").trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [activePackages]
  );

  const filteredPackages = useMemo(() => {
    const min = Number(minPrice);
    const max = Number(maxPrice);
    const minDays = Number(minDuration);
    const maxDays = Number(maxDuration);
    const visaFree = new Set(["Turkey", "Georgia", "Montenegro"]);

    const filtered = activePackages.filter((pkg) => {
      const packagePrice = getPackagePriceAmount(pkg);

      if (collection) {
        const c = collection.trim().toLowerCase();
        const cat = (pkg.category || pkg.package_type || "").trim().toLowerCase();
        if (c === "summer") {
          const summerOk =
            cat === "beach" || cat === "cruise" || cat === "city break" || ["Turkey", "Greece", "Spain", "Italy"].includes(pkg.country || "");
          if (!summerOk) return false;
        } else if (c === "budget") {
          if (packagePrice > 650) return false;
        } else if (c === "luxury") {
          if (!(cat === "luxury" || packagePrice >= 1700)) return false;
        } else if (c === "family") {
          if (cat !== "family") return false;
        } else if (c === "honeymoon") {
          if (cat !== "honeymoon") return false;
        } else if (c === "adventure") {
          if (!(cat === "adventure" || cat === "nature" || cat === "ski")) return false;
        } else if (c === "weekend") {
          if (!(pkg.duration_days <= 3 || cat === "city" || cat === "city break")) return false;
        } else if (c === "visa_free") {
          if (!visaFree.has(pkg.country || "")) return false;
        }
      }

      if (!matchesQuery(pkg, search, language)) return false;
      if (!matchesDestination(pkg, destination)) return false;
      if (company && String(pkg.agency_id) !== company) return false;
      if (category) {
        const currentCategory = (pkg.category || pkg.package_type || "").trim().toLowerCase();
        if (currentCategory !== category.toLowerCase()) return false;
      }
      if (minPrice && Number.isFinite(min) && packagePrice < min) return false;
      if (maxPrice && Number.isFinite(max) && packagePrice > max) return false;
      if (minDuration && Number.isFinite(minDays) && pkg.duration_days < minDays) return false;
      if (maxDuration && Number.isFinite(maxDays) && pkg.duration_days > maxDays) return false;
      if (availableDate && !matchesDateAvailability(pkg, availableDate)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === "alpha_asc") return a.title.localeCompare(b.title);
      if (sort === "alpha_desc") return b.title.localeCompare(a.title);
      if (sort === "price_asc") return getPackagePriceAmount(a) - getPackagePriceAmount(b);
      if (sort === "price_desc") return getPackagePriceAmount(b) - getPackagePriceAmount(a);
      if (sort === "rating") {
        return (
          getPackageRating(b, rankingMaps.topRatedRanks) - getPackageRating(a, rankingMaps.topRatedRanks) ||
          getPackageReviewCount(b, rankingMaps) - getPackageReviewCount(a, rankingMaps)
        );
      }
      if (sort === "newest") {
        const aStamp = new Date(a.created_at || a.updated_at || 0).getTime() || a.id;
        const bStamp = new Date(b.created_at || b.updated_at || 0).getTime() || b.id;
        return bStamp - aStamp;
      }
      return getPackagePopularityScore(b, rankingMaps) - getPackagePopularityScore(a, rankingMaps);
    });

    return filtered;
  }, [
    activePackages,
    availableDate,
    category,
    company,
    destination,
    getPackagePriceAmount,
    language,
    maxDuration,
    maxPrice,
    minDuration,
    minPrice,
    rankingMaps,
    search,
    sort,
  ]);

  const visibleCompanies = useMemo(
    () => buildCompanySummaries(agencyMap, filteredPackages, rankingMaps, language),
    [agencyMap, filteredPackages, rankingMaps, language]
  );

  const activeFilterCount = [
    search,
    destination,
    company,
    category,
    minPrice,
    maxPrice,
    minDuration,
    maxDuration,
    availableDate,
    collection,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setDestination("");
    setCompany("");
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
    setMinDuration("");
    setMaxDuration("");
    setAvailableDate("");
    setCollection("");
    setSort("popular");
  };

  const toggleFavorite = async (pkgId: number) => {
    const token = getStoredToken();

    if (!token) {
      try {
        const next = new Set(favorites);
        if (next.has(pkgId)) next.delete(pkgId);
        else next.add(pkgId);
        localStorage.setItem("favorites", JSON.stringify(Array.from(next)));
        setFavorites(next);
      } catch {
        return;
      }
      return;
    }

    const next = new Set(favorites);
    const hasFavorite = next.has(pkgId);

    try {
      if (hasFavorite) await api.favorites.remove(pkgId);
      else await api.favorites.add(pkgId);
      if (hasFavorite) next.delete(pkgId);
      else next.add(pkgId);
      setFavorites(next);
    } catch {
      return;
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <section className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top,_rgba(2,42,107,0.10),_transparent_50%),linear-gradient(180deg,_#ffffff_0%,_#f7f8fc_100%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#022A6B] shadow-sm shadow-slate-200">
              {t("marketplace_badge")}
            </div>
            <div className="max-w-3xl space-y-4">
              <h1 className="break-words text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
                {t("marketplace_title")}
              </h1>
              <p className="max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
                {t("marketplace_subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-500">
              <Link href="/" className="transition hover:text-[#022A6B]">
                {t("common_home")}
              </Link>
              <span>/</span>
              <span className="text-slate-900">{t("nav_marketplace")}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="rounded-[2rem] bg-white p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70 sm:p-6 lg:p-8">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_package_name")}
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("marketplace_filter_package_name_placeholder")}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_destination")}
              </label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={t("marketplace_filter_destination_placeholder")}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_company")}
              </label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              >
                <option value="">{t("marketplace_filter_company_all")}</option>
                {companies.map((item) => (
                  <option key={item.agency.id} value={String(item.agency.id)}>
                    {getAgencyDisplayName(item.agency, language)}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_category")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              >
                <option value="">{t("marketplace_filter_category_all")}</option>
                {categoryOptions.map((item) => (
                  <option key={item} value={item}>
                    {(() => {
                      const key = toCategoryKey(item);
                      const translated = t(key);
                      return translated === key ? item : translated;
                    })()}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_min_price")}
              </label>
              <input
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_max_price")}
              </label>
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                inputMode="numeric"
                placeholder="5000"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_min_duration")}
              </label>
              <input
                value={minDuration}
                onChange={(e) => setMinDuration(e.target.value)}
                inputMode="numeric"
                placeholder="1"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_max_duration")}
              </label>
              <input
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                inputMode="numeric"
                placeholder="14"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_available_dates")}
              </label>
              <input
                value={availableDate}
                onChange={(e) => setAvailableDate(e.target.value)}
                type="date"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {t("marketplace_filter_sort")}
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
              >
                <option value="alpha_asc">{t("marketplace_sort_alpha_asc")}</option>
                <option value="alpha_desc">{t("marketplace_sort_alpha_desc")}</option>
                <option value="price_asc">{t("marketplace_sort_price_asc")}</option>
                <option value="price_desc">{t("marketplace_sort_price_desc")}</option>
                <option value="popular">{t("marketplace_sort_popular")}</option>
                <option value="rating">{t("marketplace_sort_rating")}</option>
                <option value="newest">{t("marketplace_sort_newest")}</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
              <span className="rounded-full bg-[#022A6B]/6 px-4 py-2 font-black text-[#022A6B]">
                {t("marketplace_stat_packages", { count: filteredPackages.length })}
              </span>
              <span className="rounded-full bg-[#FF6A1A]/8 px-4 py-2 font-black text-[#FF6A1A]">
                {t("marketplace_stat_companies", { count: visibleCompanies.length })}
              </span>
              <span>{t("marketplace_stat_active_filters", { count: activeFilterCount })}</span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
            >
              {t("marketplace_reset_filters")}
            </button>
          </div>
        </div>

        <section className="mt-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">{t("marketplace_filter_company")}</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{t("marketplace_section_companies")}</h2>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[2rem] bg-white px-6 py-16 text-center font-bold text-slate-500 shadow-sm ring-1 ring-slate-200/70">
              {t("common_loading")}
            </div>
          ) : visibleCompanies.length === 0 ? (
            <div className="rounded-[2rem] bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200/70">
              <p className="text-lg font-black text-slate-900">{t("marketplace_empty_companies_title")}</p>
              <p className="mt-2 text-slate-500">{t("marketplace_empty_companies_subtitle")}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {visibleCompanies.map((item) => (
                <Link
                  key={item.agency.id}
                  href={`/marketplace/company/${item.agency.id}`}
                  className="group aspect-square overflow-hidden rounded-[1.35rem] bg-white shadow-[0_20px_60px_-34px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-30px_rgba(2,42,107,0.28)]"
                >
                  <div className="relative h-full">
                    <div className="relative h-28 overflow-hidden">
                      <Image
                        src={item.coverImage}
                        alt={getAgencyDisplayName(item.agency, language)}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
                    </div>
                    <div className="flex h-[calc(100%-7rem)] flex-col p-5">
                      <div className="-mt-11 flex items-start justify-between gap-4">
                        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.1rem] border-4 border-white bg-gradient-to-br from-[#022A6B] to-[#0B4BB8] text-lg font-black text-white shadow-lg shadow-blue-200/60">
                          {item.logoUrl ? (
                            <Image
                              src={item.logoUrl}
                              alt={`${getAgencyDisplayName(item.agency, language)} logo`}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            getAgencyInitials(item.agency.name)
                          )}
                        </div>
                        {item.verified ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            {t("marketplace_company_badge_verified")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                            {t("marketplace_company_badge_growing")}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        <h3 className="text-xl font-black tracking-[-0.03em] text-slate-950 transition group-hover:text-[#022A6B]">
                          {getAgencyDisplayName(item.agency, language)}
                        </h3>
                        <p className="line-clamp-2 text-sm leading-6 text-slate-500">
                          {getAgencyDisplayDescription(item.agency, language)}
                        </p>
                      </div>

                      <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                            {t("marketplace_company_label_packages")}
                          </p>
                          <p className="mt-2 text-lg font-black text-slate-950">{item.packageCount}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                            {t("marketplace_company_label_rating")}
                          </p>
                          <p className="mt-2 text-lg font-black text-slate-950">{item.rating}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        <span>
                          {t("marketplace_company_label_reviews")}: {item.reviewCount}
                        </span>
                        <span>
                          {t("marketplace_company_label_years")}: {item.yearsOnTourPie || 1}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">{t("marketplace_company_label_packages")}</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{t("marketplace_section_packages")}</h2>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[2rem] bg-white px-6 py-16 text-center font-bold text-slate-500 shadow-sm ring-1 ring-slate-200/70">
              {t("common_loading")}
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="rounded-[2rem] bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200/70">
              <p className="text-lg font-black text-slate-900">{t("marketplace_empty_packages_title")}</p>
              <p className="mt-2 text-slate-500">{t("marketplace_empty_packages_subtitle")}</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredPackages.map((pkg) => {
                const companyInfo = agencyMap.get(pkg.agency_id);
                const rating = getPackageRating(pkg, rankingMaps.topRatedRanks);
                const reviewCount = getPackageReviewCount(pkg, rankingMaps);
                const isFavorite = favorites.has(pkg.id);
                const discountPercent = getDiscountPercent(pkg);
                const originalPrice = getDiscountedPackagePrice(pkg);
                const includedServices = getPackageIncludedServices(pkg).slice(0, 3);
                const dateLabels = getPackageAvailableDateRanges(pkg).slice(0, 2);
                const companyLogo = getAgencyLogoUrl(companyInfo);

                return (
                  <article
                    key={pkg.id}
                    className="group overflow-hidden rounded-[1.6rem] bg-white shadow-[0_24px_80px_-44px_rgba(15,23,42,0.52)] ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_80px_-38px_rgba(2,42,107,0.30)]"
                  >
                    <div className="relative aspect-[1.05/1] overflow-hidden">
                      <Image
                        src={getPackagePrimaryImage(pkg)}
                        alt={getPackageDisplayTitle(pkg, language)}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                        <span className="rounded-full bg-white/92 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[#022A6B] backdrop-blur">
                          {getPackageDisplayCountry(pkg, language) || getPackageDisplayDestination(pkg, language)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void toggleFavorite(pkg.id)}
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition ${
                            isFavorite
                              ? "bg-white text-rose-500 shadow-lg shadow-rose-100"
                              : "bg-white/92 text-slate-700 shadow-lg shadow-slate-200/70 hover:text-rose-500"
                          }`}
                          aria-label={isFavorite ? t("results_fav_remove") : t("results_fav_add")}
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 15.5 4 4.5 4.5 0 0 1 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
                          </svg>
                        </button>
                      </div>
                      <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950/78 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                          {t("details_duration", { days: pkg.duration_days })}
                        </span>
                        {discountPercent ? (
                          <span className="rounded-full bg-[#FF6A1A] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white">
                            {t("marketplace_discount_badge", { percent: discountPercent })}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-black tracking-[-0.03em] text-slate-950">
                            {getPackageDisplayTitle(pkg, language)}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {getPackageDisplayDestination(pkg, language)}
                            {getPackageDisplayCountry(pkg, language) ? `, ${getPackageDisplayCountry(pkg, language)}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_label_from")}</p>
                          <p className="mt-1 text-xl font-black text-[#022A6B]">{formatPackageMoney(pkg)}</p>
                          {originalPrice && originalPrice > pkg.price ? (
                            <p className="mt-1 text-xs font-bold text-slate-400 line-through">{formatCurrency(originalPrice, "AZN")}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                        <span className="font-black text-amber-500">★</span>
                        <span className="font-black text-slate-900">{rating}</span>
                        <span>{t("details_reviews", { count: reviewCount })}</span>
                      </div>

                      <p className="line-clamp-2 min-h-12 text-sm leading-6 text-slate-600">
                        {getPackageDisplayDescription(pkg, language)}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {includedServices.map((service) => (
                          <span key={service} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                            {service}
                          </span>
                        ))}
                      </div>

                      <div className="rounded-2xl bg-[#022A6B]/[0.03] px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_label_available_dates")}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {dateLabels.map((range) => (
                            <span key={range.label} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#022A6B] ring-1 ring-slate-200">
                              {range.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#022A6B] to-[#0B4BB8] text-xs font-black text-white">
                            {companyLogo ? (
                              <Image
                                src={companyLogo}
                                alt={`${companyInfo ? getAgencyDisplayName(companyInfo, language) : pkg.agency?.name || "Company"} logo`}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              getAgencyInitials(companyInfo?.name || pkg.agency?.name || "TP")
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_label_company")}</p>
                            <p className="mt-1 break-words font-black text-slate-900">
                              {companyInfo ? getAgencyDisplayName(companyInfo, language) : pkg.agency?.name || t("booking_partner")}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_label_max_travelers")}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{pkg.capacity}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <Link
                          href={`/details/${pkg.id}`}
                          className="inline-flex w-full items-center justify-center rounded-2xl bg-[#022A6B] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#0B4BB8]"
                        >
                          {t("booking_book_now")}
                        </Link>
                        <Link
                          href={`/marketplace/company/${pkg.agency_id}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-white"
                        >
                          {t("marketplace_view_company")}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
