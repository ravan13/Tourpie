"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  demoMarketplaceCompanies,
  demoMarketplacePackages,
  demoTopRatedMarketplacePackages,
  demoTrendingMarketplacePackages,
} from "@/lib/demoMarketplaceData";
import {
  buildAgencyMap,
  buildCompanySummaries,
  buildRankingMap,
  getAgencyDisplayName,
  getAgencyInitials,
  getPackageDisplayCountry,
  getPackageDisplayDestination,
  getPackageDisplayTitle,
  getPackagePrimaryImage,
  getPackageRating,
  getPackageReviewCount,
  type MarketplaceAgency,
  type MarketplacePackage,
} from "@/lib/marketplace";

type HubTab = "trending" | "agencies" | "deals" | "map" | "collections";

type HotNowHubProps = {
  mode?: "compact" | "full";
};

function formatCountdown(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 99) return `${hours}h`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-100 bg-white shadow-sm text-xs font-black tracking-[0.28em] uppercase text-blue-700">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="mt-4 text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{title}</h2>
      {subtitle ? <p className="mt-3 text-gray-600 text-base md:text-lg max-w-3xl">{subtitle}</p> : null}
    </div>
  );
}

export default function HotNowHub({ mode = "compact" }: HotNowHubProps) {
  const { t, language, formatCurrency } = useLanguage();
  const router = useRouter();
  const [tab, setTab] = useState<HubTab>("trending");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentSort, setRecentSort] = useState<"newest" | "rating" | "price_asc">("newest");

  useEffect(() => {
    const active = mode === "full" || tab === "deals";
    if (!active) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [mode, tab]);

  const rankings = useMemo(
    () => ({
      trendingRanks: buildRankingMap(demoTrendingMarketplacePackages),
      topRatedRanks: buildRankingMap(demoTopRatedMarketplacePackages),
    }),
    []
  );

  const packages = demoMarketplacePackages as MarketplacePackage[];
  const agencies = demoMarketplaceCompanies as MarketplaceAgency[];
  const agencyMap = useMemo(() => buildAgencyMap(agencies, packages), [agencies, packages]);

  const companySummaries = useMemo(
    () => buildCompanySummaries(agencyMap, packages, rankings, language),
    [agencyMap, language, packages, rankings]
  );

  const topAgencies = useMemo(() => {
    const list = [...companySummaries];
    list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount || b.packageCount - a.packageCount);
    return list.slice(0, 6);
  }, [companySummaries]);

  const trendingDestinations = useMemo(() => {
    const grouped = new Map<string, { sample: MarketplacePackage; sumPrice: number; count: number; bookings: number }>();

    for (const pkg of packages) {
      const key = `${pkg.destination}__${pkg.country || ""}`;
      const current = grouped.get(key) || { sample: pkg, sumPrice: 0, count: 0, bookings: 0 };
      const reviews = getPackageReviewCount(pkg, rankings);
      const rating = getPackageRating(pkg, rankings.topRatedRanks);
      const bookingScore = Math.round(reviews * 2.2 + rating * 18 + (pkg.id % 11));
      grouped.set(key, {
        sample: current.sample,
        sumPrice: current.sumPrice + Number(pkg.price || 0),
        count: current.count + 1,
        bookings: current.bookings + bookingScore,
      });
    }

    return Array.from(grouped.values())
      .map((v) => ({
        sample: v.sample,
        avgPrice: v.count ? v.sumPrice / v.count : Number(v.sample.price || 0),
        bookings: v.bookings,
        packageCount: v.count,
      }))
      .sort((a, b) => b.bookings - a.bookings || b.packageCount - a.packageCount)
      .slice(0, 6);
  }, [packages, rankings]);

  const hotDeals = useMemo(() => {
    return packages
      .map((pkg) => {
        const original = typeof pkg.discount_price === "number" ? pkg.discount_price : null;
        if (!original || original <= pkg.price) return null;
        const percent = Math.round(((original - pkg.price) / original) * 100);
        return { pkg, original, percent };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.percent || 0) - (a?.percent || 0))
      .slice(0, 6) as { pkg: MarketplacePackage; original: number; percent: number }[];
  }, [packages]);

  const weekEndsAt = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const delta = ((8 - day) % 7) || 7;
    d.setDate(d.getDate() + delta);
    return d.getTime();
  }, []);

  const mapStats = useMemo(() => {
    const grouped = new Map<string, { packageCount: number; minPrice: number; agencies: Set<number>; sample: MarketplacePackage }>();
    for (const pkg of packages) {
      const country = (pkg.country || "").trim();
      if (!country) continue;
      const existing = grouped.get(country);
      if (!existing) {
        grouped.set(country, {
          packageCount: 1,
          minPrice: Number(pkg.price || 0),
          agencies: new Set([pkg.agency_id]),
          sample: pkg,
        });
      } else {
        existing.packageCount += 1;
        existing.minPrice = Math.min(existing.minPrice, Number(pkg.price || 0));
        existing.agencies.add(pkg.agency_id);
      }
    }
    return grouped;
  }, [packages]);

  const pins = useMemo(
    () => [
      { country: "Turkey", x: 56, y: 42 },
      { country: "Italy", x: 47, y: 44 },
      { country: "France", x: 43, y: 40 },
      { country: "Greece", x: 54, y: 46 },
      { country: "Georgia", x: 62, y: 40 },
      { country: "Azerbaijan", x: 68, y: 44 },
      { country: "Egypt", x: 60, y: 56 },
      { country: "UAE", x: 70, y: 58 },
      { country: "Spain", x: 38, y: 48 },
      { country: "Switzerland", x: 46, y: 38 },
      { country: "Montenegro", x: 50, y: 44 },
      { country: "Japan", x: 86, y: 44 },
      { country: "Thailand", x: 78, y: 62 },
      { country: "Indonesia", x: 82, y: 74 },
      { country: "Maldives", x: 76, y: 70 },
    ],
    []
  );

  const collections = useMemo(() => {
    const defs = [
      { id: "summer", titleKey: "discover_hub_collection_summer", cover: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop" },
      { id: "budget", titleKey: "discover_hub_collection_budget", cover: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=1400&auto=format&fit=crop" },
      { id: "luxury", titleKey: "discover_hub_collection_luxury", cover: "https://images.unsplash.com/photo-1491557345352-5929e343eb89?q=80&w=1400&auto=format&fit=crop" },
      { id: "family", titleKey: "discover_hub_collection_family", cover: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=1400&auto=format&fit=crop" },
      { id: "honeymoon", titleKey: "discover_hub_collection_honeymoon", cover: "https://images.unsplash.com/photo-1526779259212-939e64788e3c?q=80&w=1400&auto=format&fit=crop" },
      { id: "adventure", titleKey: "discover_hub_collection_adventure", cover: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?q=80&w=1400&auto=format&fit=crop" },
      { id: "visa_free", titleKey: "discover_hub_collection_visa_free", cover: "https://images.unsplash.com/photo-1496307653780-42ee777d4833?q=80&w=1400&auto=format&fit=crop" },
      { id: "weekend", titleKey: "discover_hub_collection_weekend", cover: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=1400&auto=format&fit=crop" },
    ];

    const scoreFor = (pkg: MarketplacePackage) => getPackageRating(pkg, rankings.topRatedRanks) * 100 + getPackageReviewCount(pkg, rankings);
    const matches = (id: string, pkg: MarketplacePackage) => {
      const cat = (pkg.category || pkg.package_type || "").trim().toLowerCase();
      const price = Number(pkg.price || 0);
      if (id === "summer") return cat === "beach" || cat === "cruise" || ["Turkey", "Greece", "Spain", "Italy"].includes(pkg.country || "");
      if (id === "budget") return price <= 650;
      if (id === "luxury") return cat === "luxury" || price >= 1700;
      if (id === "family") return cat === "family";
      if (id === "honeymoon") return cat === "honeymoon";
      if (id === "adventure") return cat === "adventure" || cat === "nature" || cat === "ski";
      if (id === "weekend") return pkg.duration_days <= 3 || cat === "city" || cat === "city break";
      if (id === "visa_free") return ["Turkey", "Georgia", "Montenegro"].includes(pkg.country || "");
      return false;
    };

    return defs.map((d) => {
      const pkgs = packages.filter((p) => matches(d.id, p));
      const best = pkgs.slice().sort((a, b) => scoreFor(b) - scoreFor(a))[0] || null;
      return {
        ...d,
        count: pkgs.length,
        image: best ? getPackagePrimaryImage(best) : d.cover,
      };
    });
  }, [packages, rankings]);

  const recentPackages = useMemo(() => {
    const q = recentSearch.trim().toLowerCase();
    const list = packages.filter((pkg) => {
      if (!q) return true;
      const hay = [getPackageDisplayTitle(pkg, language), getPackageDisplayDestination(pkg, language), getPackageDisplayCountry(pkg, language), pkg.agency?.name || ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    list.sort((a, b) => {
      if (recentSort === "price_asc") return Number(a.price || 0) - Number(b.price || 0);
      if (recentSort === "rating") return getPackageRating(b, rankings.topRatedRanks) - getPackageRating(a, rankings.topRatedRanks);
      const at = new Date(a.created_at || a.updated_at || 0).getTime() || 0;
      const bt = new Date(b.created_at || b.updated_at || 0).getTime() || 0;
      return bt - at;
    });

    return list.slice(0, 8);
  }, [language, packages, rankings.topRatedRanks, recentSearch, recentSort]);

  const tabs = useMemo(
    () => [
      { id: "trending" as const, label: t("discover_hub_tab_trending") },
      { id: "agencies" as const, label: t("discover_hub_tab_agencies") },
      { id: "deals" as const, label: t("discover_hub_tab_deals") },
      { id: "map" as const, label: t("discover_hub_tab_map") },
      { id: "collections" as const, label: t("discover_hub_tab_collections") },
    ],
    [t]
  );

  const hoveredStats = hoveredCountry ? mapStats.get(hoveredCountry) : null;

  const renderTrending = (title: string, subtitle?: string) => (
    <div>
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {trendingDestinations.map((item) => {
          const dest = getPackageDisplayDestination(item.sample, language);
          const country = getPackageDisplayCountry(item.sample, language);
          return (
            <button
              key={`${item.sample.destination}-${item.sample.country}`}
              type="button"
              onClick={() => router.push(`/marketplace?destination=${encodeURIComponent(item.sample.destination)}`)}
              className="group text-left bg-white rounded-[1.4rem] md:rounded-[1.6rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative h-44 overflow-hidden">
                <Image src={getPackagePrimaryImage(item.sample)} alt={dest} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-xs font-black text-gray-900">{country || t("marketplace_global")}</div>
              </div>
              <div className="p-6">
                <div className="text-xl font-black text-gray-900">{dest}</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t("discover_hub_avg_price")}</div>
                    <div className="mt-2 text-sm font-black text-gray-900">{formatCurrency(Math.round(item.avgPrice), "AZN")}</div>
                  </div>
                  <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t("discover_hub_bookings")}</div>
                    <div className="mt-2 text-sm font-black text-gray-900">{item.bookings}</div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderAgencies = (title: string) => (
    <div>
      <SectionTitle title={title} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {topAgencies.map((c) => (
          <Link key={c.agency.id} href={`/marketplace/company/${c.agency.id}`} prefetch={false} className="group bg-white rounded-[1.4rem] md:rounded-[1.6rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center">
                {c.logoUrl ? (
                  <Image src={c.logoUrl} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <div className="text-sm font-black text-gray-800">{getAgencyInitials(c.agency.name || "TP")}</div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate text-lg font-black text-gray-900">{getAgencyDisplayName(c.agency, language)}</div>
                  {c.verified ? <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">{t("discover_hub_verified")}</span> : null}
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm font-black text-gray-700">
                  <span className="inline-flex items-center gap-1"><span className="text-amber-500">★</span>{c.rating.toFixed(1)}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-500 font-bold">{t("discover_hub_packages")}: {c.packageCount}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  const renderDeals = (title: string, subtitle?: string) => (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <SectionTitle title={title} subtitle={subtitle} />
        <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3 self-start">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t("discover_hub_expiring_in")}</div>
          <div className="mt-1 text-sm font-black text-gray-900 tabular-nums">{formatCountdown(weekEndsAt - nowMs)}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {hotDeals.map(({ pkg, original, percent }) => (
          <Link key={pkg.id} href={`/details/${pkg.id}`} prefetch={false} className="group bg-white rounded-[1.4rem] md:rounded-[1.6rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="relative h-44 overflow-hidden">
              <Image src={getPackagePrimaryImage(pkg)} alt={getPackageDisplayTitle(pkg, language)} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute top-4 left-4 rounded-full bg-[#FF6A1A] text-white px-3 py-1 text-xs font-black shadow-lg">-{percent}%</div>
            </div>
            <div className="p-6">
              <div className="text-lg font-black text-gray-900 line-clamp-1">{getPackageDisplayTitle(pkg, language)}</div>
              <div className="mt-2 text-sm font-bold text-gray-500">{getPackageDisplayDestination(pkg, language)}{getPackageDisplayCountry(pkg, language) ? ` • ${getPackageDisplayCountry(pkg, language)}` : ""}</div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t("discover_hub_original")}</div>
                  <div className="mt-2 text-sm font-black text-gray-700 line-through">{formatCurrency(original, "AZN")}</div>
                </div>
                <div className="rounded-2xl bg-blue-600/10 border border-blue-100 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">{t("discover_hub_now")}</div>
                  <div className="mt-2 text-sm font-black text-blue-700">{formatCurrency(pkg.price, "AZN")}</div>
                </div>
              </div>
              <div className="mt-6 inline-flex items-center justify-center w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition">{t("discover_hub_view_offer")}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  const renderMap = (title: string, subtitle?: string) => (
    <div>
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">
          <div className="relative aspect-[16/9] rounded-[1.8rem] bg-gradient-to-br from-slate-900 via-[#022A6B] to-[#0F6AA8] overflow-hidden border border-gray-100 shadow-sm">
            <div className="absolute inset-0 opacity-35">
              <svg viewBox="0 0 100 56" className="h-full w-full" aria-hidden="true">
                <path d="M7 29c7-10 18-15 30-16 9-1 18 0 26 4 9 4 18 6 30 5v30H7V29Z" fill="white" opacity="0.14" />
                <path d="M4 22c9-8 22-11 36-9 8 1 16 4 24 7 9 3 18 5 32 2" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="0.7" />
              </svg>
            </div>
            {pins.filter((p) => mapStats.has(p.country)).map((p) => (
              <button
                key={p.country}
                type="button"
                onMouseEnter={() => setHoveredCountry(p.country)}
                onMouseLeave={() => setHoveredCountry(null)}
                onClick={() => router.push(`/marketplace?destination=${encodeURIComponent(p.country)}`)}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                aria-label={p.country}
              >
                <span className="relative flex h-4 w-4">
                  <span className={`absolute inline-flex h-full w-full rounded-full ${hoveredCountry === p.country ? "bg-white/35" : "bg-white/20"} tp-float`} />
                  <span className={`relative inline-flex h-4 w-4 rounded-full ${hoveredCountry === p.country ? "bg-[#FF6A1A]" : "bg-white"} shadow-lg`} />
                </span>
              </button>
            ))}
            {hoveredCountry && hoveredStats ? (
              <div className="absolute left-6 bottom-6 rounded-[1.5rem] bg-white/12 border border-white/18 backdrop-blur-xl px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)] max-w-[320px]">
                <div className="text-sm font-black text-white">{getPackageDisplayCountry(hoveredStats.sample, language) || hoveredCountry}</div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-xs font-black text-white/90">
                  <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-white/65">{t("discover_hub_packages")}</div>
                    <div className="mt-1 tabular-nums">{hoveredStats.packageCount}</div>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-white/65">{t("discover_hub_starting_from")}</div>
                    <div className="mt-1 tabular-nums">{formatCurrency(Math.round(hoveredStats.minPrice), "AZN")}</div>
                  </div>
                  <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-white/65">{t("discover_hub_agencies")}</div>
                    <div className="mt-1 tabular-nums">{hoveredStats.agencies.size}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="w-full lg:w-[360px]">
          <div className="rounded-[1.8rem] bg-gray-50 border border-gray-100 p-6">
            <div className="text-sm font-black text-gray-900">{t("discover_hub_view_in_marketplace")}</div>
            <div className="mt-2 text-sm font-bold text-gray-600">
              {hoveredCountry && hoveredStats ? `${getPackageDisplayCountry(hoveredStats.sample, language) || hoveredCountry}` : t("marketplace_title")}
            </div>
            <button type="button" onClick={() => router.push(hoveredCountry ? `/marketplace?destination=${encodeURIComponent(hoveredCountry)}` : "/marketplace")} className="mt-6 w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition shadow-lg hover:shadow-blue-200">
              {t("discover_hub_cta")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCollections = (title: string) => (
    <div>
      <SectionTitle title={title} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {collections.map((c) => (
          <button key={c.id} type="button" onClick={() => router.push(`/marketplace?collection=${encodeURIComponent(c.id)}`)} className="group text-left bg-white rounded-[1.4rem] md:rounded-[1.6rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="relative h-40 overflow-hidden">
              <Image src={c.image} alt={t(c.titleKey)} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </div>
            <div className="p-6">
              <div className="text-lg font-black text-gray-900">{t(c.titleKey)}</div>
              <div className="mt-2 text-sm font-bold text-gray-500">{t("common_packages_count", { count: c.count })}</div>
              <div className="mt-6 inline-flex items-center gap-2 text-blue-600 font-black text-sm">{t("discover_hub_view_in_marketplace")}<span className="group-hover:translate-x-1 transition-transform">→</span></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderRecent = () => (
    <div>
      <SectionTitle title={t("hot_now_recent_title")} />
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <input
          value={recentSearch}
          onChange={(e) => setRecentSearch(e.target.value)}
          placeholder={t("hot_now_recent_search_placeholder")}
          className="flex-1 bg-white border border-gray-200 rounded-2xl px-5 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={recentSort}
          onChange={(e) => setRecentSort(e.target.value as typeof recentSort)}
          className="bg-white border border-gray-200 rounded-2xl px-5 py-3 font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="newest">{t("hot_now_sort_newest")}</option>
          <option value="rating">{t("hot_now_sort_rating")}</option>
          <option value="price_asc">{t("hot_now_sort_price_asc")}</option>
        </select>
      </div>

      {recentPackages.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-gray-500 font-bold">
          {t("hot_now_recent_empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {recentPackages.map((pkg) => (
            <Link key={pkg.id} href={`/details/${pkg.id}`} prefetch={false} className="group bg-white rounded-[1.4rem] md:rounded-[1.6rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="relative h-44 overflow-hidden">
                <Image src={getPackagePrimaryImage(pkg)} alt={getPackageDisplayTitle(pkg, language)} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              </div>
              <div className="p-5">
                <div className="text-lg font-black text-gray-900 line-clamp-1">{getPackageDisplayTitle(pkg, language)}</div>
                <div className="mt-2 text-sm font-bold text-gray-500 line-clamp-1">{pkg.agency?.name || t("booking_partner")}</div>
                <div className="mt-4 flex items-center justify-between text-sm font-black">
                  <span className="inline-flex items-center gap-1 text-amber-500">★ <span className="text-gray-900">{getPackageRating(pkg, rankings.topRatedRanks).toFixed(1)}</span></span>
                  <span className="text-blue-700">{formatCurrency(pkg.price, "AZN")}</span>
                </div>
                <div className="mt-4 text-xs font-bold text-gray-400">
                  {t("hot_now_recent_published")}: {new Date(pkg.created_at || pkg.updated_at || Date.now()).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  if (mode === "full") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
        <section className="max-w-7xl mx-auto px-4 pt-14 pb-10">
          <div className="rounded-[2.5rem] border border-gray-100 bg-white shadow-sm p-8 md:p-12 overflow-hidden relative">
            <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-blue-100/70 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-orange-100/60 blur-3xl" />
            <div className="relative">
              <SectionTitle eyebrow={t("nav_hot_now")} title={t("hot_now_title")} subtitle={t("hot_now_subtitle")} />
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 pb-24 space-y-18">
          {renderTrending(t("hot_now_trending_title"))}
          {renderDeals(t("hot_now_flash_deals_title"))}
          {renderAgencies(t("hot_now_top_agencies_title"))}
          {renderMap(t("hot_now_map_title"), t("discover_hub_map_hint"))}
          {renderCollections(t("hot_now_collections_title"))}
          {renderRecent()}
        </div>
      </div>
    );
  }

  return (
    <section className="py-24 bg-gradient-to-b from-white via-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <SectionTitle eyebrow={t("discover_hub_title")} title={t("discover_hub_title")} subtitle={t("discover_hub_subtitle")} />
          </div>
          <button type="button" onClick={() => router.push("/hot-now")} className="inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-4 rounded-2xl transition shadow-lg shadow-blue-200">
            {t("nav_hot_now")}
            <span className="text-lg">→</span>
          </button>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 sm:px-10 py-6 border-b border-gray-50 bg-gray-50/40">
            <div className="flex flex-wrap gap-2">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setTab(x.id)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-black transition border ${tab === x.id ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"}`}
                  aria-pressed={tab === x.id}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-10">
            {tab === "trending" ? renderTrending(t("discover_hub_trending_title"), t("discover_hub_trending_this_week")) : null}
            {tab === "agencies" ? renderAgencies(t("discover_hub_top_agencies_title")) : null}
            {tab === "deals" ? renderDeals(t("discover_hub_hot_deals_title"), t("discover_hub_ends_this_week")) : null}
            {tab === "map" ? renderMap(t("discover_hub_map_title"), t("discover_hub_map_hint")) : null}
            {tab === "collections" ? renderCollections(t("discover_hub_collections_title")) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
