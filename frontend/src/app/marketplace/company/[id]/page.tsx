"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, getStoredToken } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import {
  MARKETPLACE_FALLBACK_IMAGE,
  MarketplaceAgency,
  MarketplacePackage,
  buildAgencyMap,
  buildRankingMap,
  getAgencyDisplayDescription,
  getAgencyDisplayName,
  getAgencyCoverImage,
  getAgencyInitials,
  getAgencyLogoUrl,
  getAgencySocialLinks,
  getAgencyVerified,
  getAgencyYearsOnTourPie,
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
} from "@/lib/marketplace";
import {
  demoMarketplaceCompanyMap,
  demoMarketplacePackages,
  demoTopRatedMarketplacePackages,
  demoTrendingMarketplacePackages,
} from "@/lib/demoMarketplaceData";

type CompanySort = "popular" | "rating" | "price_asc" | "price_desc" | "newest" | "alpha_asc" | "alpha_desc";

function getDiscountPercent(pkg: MarketplacePackage) {
  const originalPrice = getDiscountedPackagePrice(pkg);
  if (!originalPrice || originalPrice <= pkg.price) return null;
  const percent = Math.round(((originalPrice - pkg.price) / originalPrice) * 100);
  return Number.isFinite(percent) && percent > 0 ? percent : null;
}

export default function CompanyMarketplacePage() {
  const { id } = useParams<{ id: string }>();
  const agencyId = Number(id);
  const { t, language, formatPackageMoney, getPackagePriceAmount, formatCurrency } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agency, setAgency] = useState<MarketplaceAgency | null>(null);
  const [packages, setPackages] = useState<MarketplacePackage[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set<number>();
    try {
      const raw = localStorage.getItem("favorites");
      const ids = raw ? (JSON.parse(raw) as number[]) : [];
      return new Set(ids.filter((item) => typeof item === "number"));
    } catch {
      return new Set<number>();
    }
  });
  const [trendingIds, setTrendingIds] = useState<Map<number, number>>(new Map());
  const [topRatedIds, setTopRatedIds] = useState<Map<number, number>>(new Map());
  const [search, setSearch] = useState("");
  const [availableDate, setAvailableDate] = useState("");
  const [sort, setSort] = useState<CompanySort>("popular");

  useEffect(() => {
    const loadPage = async () => {
      if (!Number.isFinite(agencyId)) {
        setError(t("marketplace_error_invalid_company"));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [agencyRes, packagesRes, trendingRes, topRatedRes] = await Promise.allSettled([
          api.agencies.getOne(agencyId),
          api.packages.getAll(0, 500),
          api.recommendations.getTrending(24),
          api.recommendations.getTop_rated(24),
        ]);

        const liveAgency = agencyRes.status === "fulfilled" ? agencyRes.value : null;
        const livePackages = packagesRes.status === "fulfilled" ? packagesRes.value : [];
        const activePackages = [...demoMarketplacePackages, ...livePackages].filter(
          (pkg) => (!pkg.status || pkg.status === "active") && pkg.agency_id === agencyId
        );
        const seedAgency = demoMarketplaceCompanyMap.get(agencyId) || null;
        const agencyMap = buildAgencyMap(
          [seedAgency, liveAgency].filter(Boolean) as MarketplaceAgency[],
          activePackages
        );
        const resolvedAgency = liveAgency || seedAgency || agencyMap.get(agencyId) || null;

        setAgency(resolvedAgency);
        setPackages(activePackages);
        setTrendingIds(
          buildRankingMap([
            ...demoTrendingMarketplacePackages,
            ...(trendingRes.status === "fulfilled" ? trendingRes.value : []),
          ])
        );
        setTopRatedIds(
          buildRankingMap([
            ...demoTopRatedMarketplacePackages,
            ...(topRatedRes.status === "fulfilled" ? topRatedRes.value : []),
          ])
        );

        if (!resolvedAgency && activePackages.length === 0) {
          setError(t("marketplace_error_company_not_found"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("marketplace_error_load_company"));
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [agencyId, t]);

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

  const rankingMaps = useMemo(
    () => ({ trendingRanks: trendingIds, topRatedRanks: topRatedIds }),
    [topRatedIds, trendingIds]
  );

  const filteredPackages = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = packages.filter((pkg) => {
      if (
        query &&
        !`${getPackageDisplayTitle(pkg, language)} ${getPackageDisplayDestination(pkg, language)} ${getPackageDisplayCountry(pkg, language)}`.toLowerCase().includes(query)
      )
        return false;
      if (availableDate && !matchesDateAvailability(pkg, availableDate)) return false;
      return true;
    });

    list.sort((a, b) => {
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

    return list;
  }, [availableDate, getPackagePriceAmount, language, packages, rankingMaps, search, sort]);

  const companyRating =
    packages.length === 0
      ? 0
      : agency?.marketplace_rating ||
        Number((packages.reduce((sum, pkg) => sum + getPackageRating(pkg, rankingMaps.topRatedRanks), 0) / packages.length).toFixed(1));

  const companyReviews =
    agency?.marketplace_review_count || packages.reduce((sum, pkg) => sum + getPackageReviewCount(pkg, rankingMaps), 0);

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

  const heroImage = getAgencyCoverImage(agency, packages[0] ? getPackagePrimaryImage(packages[0]) : MARKETPLACE_FALLBACK_IMAGE);
  const socialLinks = getAgencySocialLinks(agency);
  const companyLogo = getAgencyLogoUrl(agency);

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-500">
            <Link href="/" className="transition hover:text-[#022A6B]">
              {t("common_home")}
            </Link>
            <span>/</span>
            <Link href="/marketplace" className="transition hover:text-[#022A6B]">
              {t("nav_marketplace")}
            </Link>
            <span>/</span>
            <span className="text-slate-900">{agency ? getAgencyDisplayName(agency, language) : "Company"}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {loading ? (
          <div className="rounded-[2rem] bg-white px-6 py-20 text-center font-bold text-slate-500 shadow-sm ring-1 ring-slate-200/70">
            {t("common_loading")}
          </div>
        ) : error ? (
          <div className="rounded-[2rem] bg-white px-6 py-20 text-center shadow-sm ring-1 ring-slate-200/70">
            <p className="text-lg font-black text-slate-900">{error}</p>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[2rem] bg-white shadow-[0_26px_90px_-42px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70">
              <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
                <div className="p-6 sm:p-8 lg:p-10">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="flex items-start gap-5">
                      <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-[#022A6B] to-[#0B4BB8] text-2xl font-black text-white shadow-xl shadow-blue-200/70">
                        {companyLogo ? (
                          <Image
                            src={companyLogo}
                            alt={`${agency ? getAgencyDisplayName(agency, language) : "Company"} logo`}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : (
                          getAgencyInitials(agency?.name || "TourPie")
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
                            {agency ? getAgencyDisplayName(agency, language) : ""}
                          </h1>
                          {getAgencyVerified(agency) ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                              {t("marketplace_company_badge_verified")}
                            </span>
                          ) : null}
                        </div>
                        <p className="max-w-2xl text-base leading-7 text-slate-600">
                          {agency ? getAgencyDisplayDescription(agency, language) : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[1.35rem] bg-slate-50 px-5 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_company_label_packages")}</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{packages.length}</p>
                    </div>
                    <div className="rounded-[1.35rem] bg-slate-50 px-5 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_company_label_rating")}</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{companyRating}</p>
                    </div>
                    <div className="rounded-[1.35rem] bg-slate-50 px-5 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_company_label_reviews")}</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{companyReviews}</p>
                    </div>
                    <div className="rounded-[1.35rem] bg-slate-50 px-5 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_company_label_years")}</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{getAgencyYearsOnTourPie(agency) || 1}</p>
                    </div>
                    <div className="rounded-[1.35rem] bg-slate-50 px-5 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_filter_destination")}</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{agency?.country || t("marketplace_global")}</p>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                    {agency?.website ? (
                      <a
                        href={agency.website}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50"
                      >
                        {t("details_agency_website")}: {agency.website}
                      </a>
                    ) : null}
                    {agency?.contact_email ? (
                      <a
                        href={`mailto:${agency.contact_email}`}
                        className="rounded-2xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50"
                      >
                        {t("details_agency_contact")}: {agency.contact_email}
                      </a>
                    ) : null}
                    {agency?.phone_number ? (
                      <div className="rounded-2xl border border-slate-200 px-4 py-3">
                        {t("marketplace_contact_phone")}: {agency.phone_number}
                      </div>
                    ) : null}
                    {agency?.office_address ? (
                      <div className="rounded-2xl border border-slate-200 px-4 py-3">
                        {t("marketplace_contact_office")}: {agency.office_address}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {Object.entries(socialLinks)
                      .filter(([, value]) => Boolean(value))
                      .map(([label, value]) => (
                        <a
                          key={label}
                          href={value}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-50"
                        >
                          {label}
                        </a>
                      ))}
                  </div>
                </div>

                <div className="relative min-h-[320px]">
                  <Image
                    src={heroImage}
                    alt={agency ? getAgencyDisplayName(agency, language) : "Company cover"}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
                </div>
              </div>
            </section>

            <section className="mt-10 rounded-[2rem] bg-white p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70 sm:p-6 lg:p-8">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
                <div>
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
                <div>
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
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    {t("marketplace_filter_sort")}
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as CompanySort)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-[#022A6B] focus:bg-white"
                  >
                    <option value="popular">{t("marketplace_sort_popular")}</option>
                    <option value="rating">{t("marketplace_sort_rating")}</option>
                    <option value="price_asc">{t("marketplace_sort_price_asc")}</option>
                    <option value="price_desc">{t("marketplace_sort_price_desc")}</option>
                    <option value="newest">{t("marketplace_sort_newest")}</option>
                    <option value="alpha_asc">{t("marketplace_sort_alpha_asc")}</option>
                    <option value="alpha_desc">{t("marketplace_sort_alpha_desc")}</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="mt-10">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">{t("marketplace_section_packages")}</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
                    {agency ? t("marketplace_company_packages_title", { company: getAgencyDisplayName(agency, language) }) : ""}
                  </h2>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#022A6B] shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
                  {t("marketplace_stat_packages", { count: filteredPackages.length })}
                </div>
              </div>

              {filteredPackages.length === 0 ? (
                <div className="rounded-[2rem] bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200/70">
                  <p className="text-lg font-black text-slate-900">{t("marketplace_empty_packages_title")}</p>
                  <p className="mt-2 text-slate-500">{t("marketplace_empty_packages_subtitle")}</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredPackages.map((pkg) => {
                    const rating = getPackageRating(pkg, rankingMaps.topRatedRanks);
                    const reviewCount = getPackageReviewCount(pkg, rankingMaps);
                    const isFavorite = favorites.has(pkg.id);
                    const discountPercent = getDiscountPercent(pkg);
                    const originalPrice = getDiscountedPackagePrice(pkg);
                    const includedServices = getPackageIncludedServices(pkg).slice(0, 3);
                    const dateLabels = getPackageAvailableDateRanges(pkg).slice(0, 2);

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
                            <div>
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

                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("marketplace_label_company")}</p>
                            <p className="mt-1 font-black text-slate-900">{agency ? getAgencyDisplayName(agency, language) : ""}</p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                            <Link
                              href={`/details/${pkg.id}`}
                              className="inline-flex w-full items-center justify-center rounded-2xl bg-[#022A6B] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#0B4BB8]"
                            >
                              {t("booking_book_now")}
                            </Link>
                            <Link
                              href="/marketplace"
                              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            >
                              {t("marketplace_back")}
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
