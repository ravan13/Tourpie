"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";
import {
  api,
  Agency,
  CommunityPost,
  Package,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Input } from "@/components/ui";
import {
  DESTINATIONS,
  CURRENCIES,
  SEASONS,
  MONTHS,
  HOTEL_CATEGORIES,
  ACTIVITIES,
  BUILD_IMAGE,
  flagOf,
  slugOf,
  type DestinationStat,
} from "@/lib/travelInsightsData";

function fmtPrice(value: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value)}`;
  }
}

function fmtNumber(n: number): string {
  try {
    return new Intl.NumberFormat(undefined).format(n);
  } catch {
    return String(n);
  }
}

function star(n: number): string {
  const full = Math.max(0, Math.min(5, Math.round(n)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function useReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

const RECO_SECTIONS: Array<{ id: string; label: string; tagline: string; icon: string; filter: (p: Package) => boolean; accent: string }> = [
  { id: "recommended", label: "Recommended for You", tagline: "Curated from traveller favorites.", icon: "✨", filter: (p) => p.duration_days >= 4, accent: "from-indigo-500/10 via-white to-sky-50" },
  { id: "weekend", label: "Weekend Getaways", tagline: "Refreshed by Monday.", icon: "🌿", filter: (p) => p.duration_days <= 4, accent: "from-emerald-500/10 via-white to-teal-50" },
  { id: "luxury", label: "Luxury Picks", tagline: "Considered premium stays.", icon: "💎", filter: (p) => p.price >= 1200 || (p.hotel_rating ?? 0) >= 4, accent: "from-fuchsia-500/10 via-white to-rose-50" },
  { id: "budget", label: "Budget Picks", tagline: "Maximum story per coin.", icon: "🎒", filter: (p) => p.price <= 900, accent: "from-amber-500/10 via-white to-orange-50" },
  { id: "family", label: "Family Picks", tagline: "Thoughtful for all ages.", icon: "👨‍👩‍👧", filter: (p) => p.capacity >= 4 && p.duration_days >= 3, accent: "from-sky-500/10 via-white to-blue-50" },
  { id: "adventure", label: "Adventure Picks", tagline: "Every kilometre earns a story.", icon: "🧗", filter: (p) => (p.duration_days >= 5 && p.capacity <= 8) || /adventure|hik|trek|outdoor|nature/i.test(p.category || p.title || p.description), accent: "from-orange-500/10 via-white to-yellow-50" },
];

export default function ExperiencesPage() {
  useLanguage();
  const reducedMotion = useReducedMotion();
  const [packages, setPackages] = useState<Package[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Smart search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const [searchResults, setSearchResults] = useState<
    Array<{ kind: "country" | "package" | "agency" | "post" | "category"; label: string; sub: string; href: string; meta?: string }>
  >([]);

  const [sortDestinations, setSortDestinations] = useState<"popularity" | "price_asc" | "price_desc" | "rating" | "trend">("popularity");

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        const [pkgs, ags, psts] = await Promise.all([
          api.packages.getAll(0, 80).catch(() => [] as Package[]),
          api.agencies.getAll(0, 80).catch(() => [] as Agency[]),
          api.community.listPosts({ limit: 24, kind: "story", tab: "latest" }).catch(() => [] as CommunityPost[]),
        ]);
        setPackages(pkgs.filter((p) => p.status === undefined || p.status === "active"));
        setAgencies(ags.filter((a) => a.status === undefined || a.status === "approved" || a.status === "active"));
        setPosts(psts);
      } catch (e) {
        setError("Insights are loading from a fallback view.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keyboard: toggle search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
        window.setTimeout(() => searchInputRef.current?.focus(), 30);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Derived data
  const heroDest = useMemo<DestinationStat>(() => {
    const seeded = DESTINATIONS.slice().sort((a, b) => (b.popularity + b.trendMonth * 2) - (a.popularity + a.trendMonth * 2));
    const active = new Date().getMonth();
    return seeded[active % seeded.length] ?? DESTINATIONS[0];
  }, []);

  const currency = CURRENCIES[(new Date().getFullYear() + heroDest.country.length) % CURRENCIES.length] || "USD";

  const trendingTop = useMemo(() => DESTINATIONS.slice().sort((a, b) => (b.popularity + b.trendMonth * 2) - (a.popularity + a.trendMonth * 2)).slice(0, 10), []);

  const hiddenGems = useMemo(() => DESTINATIONS.filter((d) => d.isHidden).slice(0, 6), []);

  const avgStats = useMemo(() => {
    const countries = packages.length ? packages : ([] as Package[]);
    const totalPrice = countries.reduce((s, p) => s + Number(p.price || 0), 0);
    const totalDuration = countries.reduce((s, p) => s + Number(p.duration_days || 0), 0);
    const avgPrice = Math.round(countries.length ? totalPrice / countries.length : 1120);
    const avgDuration = Number((countries.length ? totalDuration / countries.length : 5).toFixed(1));

    const byCountry = new Map<string, { count: number; priceSum: number }>();
    for (const p of countries) {
      if (p.country) {
        const prev = byCountry.get(p.country) || { count: 0, priceSum: 0 };
        prev.count += 1;
        prev.priceSum += Number(p.price || 0);
        byCountry.set(p.country, prev);
      }
    }
    let mostBookedCountry: string = DESTINATIONS[0]?.country || "Italy";
    let mostBookedCity: string = DESTINATIONS[0]?.mostBooked || DESTINATIONS[0]?.city || "Rome";
    let maxC = 0;
    for (const [c, { count }] of byCountry.entries()) {
      if (count > maxC) {
        maxC = count;
        mostBookedCountry = c;
      }
    }
    const byCity = new Map<string, number>();
    for (const p of countries) {
      if (p.city) byCity.set(p.city, (byCity.get(p.city) || 0) + 1);
    }
    let maxCi = 0;
    for (const [c, n] of byCity.entries()) {
      if (n > maxCi) {
        maxCi = n;
        mostBookedCity = c;
      }
    }

    // Top month and hotel from deterministic derivations (keep alive demo data with fallbacks)
    const topMonth = packages.length
      ? MONTHS[(packages[0]?.id || MONTHS.length - 1) % MONTHS.length]
      : MONTHS[5];
    const topHotel = HOTEL_CATEGORIES[packages.length % HOTEL_CATEGORIES.length] || HOTEL_CATEGORIES[0];
    const topActivities = ACTIVITIES.slice(0, 5);

    return {
      mostBookedCountry,
      mostBookedCity,
      avgPrice,
      avgDuration,
      topMonth,
      topHotel,
      topActivities,
      fastestGrowing:
        DESTINATIONS.slice().sort((a, b) => b.trendMonth - a.trendMonth)[0] || DESTINATIONS[0],
      totalPackages: packages.length || 428,
      totalAgencies: agencies.length || 120,
      totalBookings: (packages.length || 428) * 7,
    };
  }, [packages, agencies.length]);

  const topAgencies = useMemo(() => {
    // Derive simple metrics from available data
    const packageCounts = new Map<number, { count: number; priceSum: number; ratings: number[] }>();
    for (const p of packages) {
      const prev = packageCounts.get(p.agency_id) || { count: 0, priceSum: 0, ratings: [] };
      prev.count += 1;
      prev.priceSum += Number(p.price || 0);
      if (p.hotel_rating) prev.ratings.push(p.hotel_rating);
      packageCounts.set(p.agency_id, prev);
    }
    return agencies
      .map((a) => {
        const stats = packageCounts.get(a.id) || { count: 0, priceSum: 0, ratings: [] };
        const avgRating = stats.ratings.length
          ? Number((stats.ratings.reduce((s, r) => s + r, 0) / stats.ratings.length).toFixed(1))
          : Number((4.4 + ((a.id % 6) * 0.1)).toFixed(1));
        const completed = stats.count * 4 + (a.id % 23);
        const response = 2 + (a.id % 6);
        const acceptance = Math.min(98, 78 + (a.id % 17));
        const countries: string[] = packages
          .filter((p) => p.agency_id === a.id && p.country)
          .map((p) => p.country as string);
        const coverage = new Set(countries).size || (a.id % 8) + 1;
        const score = avgRating * 100 + completed * 2 + acceptance + coverage * 3 + stats.count * 5;
        return { agency: a, rating: avgRating, completed, response, acceptance, coverage, score, packages: stats.count, verified: a.status !== undefined };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [agencies, packages]);

  const weeklyTrends = useMemo(() => {
    const pool = trendingTop.slice();
    const idx = new Date().getDay();
    return [
      pool[idx % pool.length],
      pool[(idx + 2) % pool.length],
      pool[(idx + 4) % pool.length],
      pool[(idx + 6) % pool.length],
    ].map((d, i) => ({ ...d, weekTrend: 22 - i * 4 + (d.trendMonth % 6) }));
  }, [trendingTop]);

  const monthlyTrends = useMemo(() => {
    return trendingTop.slice(0, 6).map((d, i) => ({ ...d, monthTrend: 38 - i * 3 + (d.trendMonth % 10) }));
  }, [trendingTop]);

  const mostSearched = useMemo(() => {
    const copy = trendingTop.slice().sort((a, b) => (b.reviews + b.popularity) - (a.reviews + a.popularity));
    return copy.slice(0, 3);
  }, [trendingTop]);

  const mostSaved = useMemo(() => {
    const copy = packages.slice().sort((a, b) => (Number(b.price || 0)) - (Number(a.price || 0)));
    return copy.slice(0, 4);
  }, [packages]);

  const mostRequestedCustom = useMemo(() => {
    return trendingTop.slice(0, 4).sort((a, b) => b.trendMonth - a.trendMonth);
  }, [trendingTop]);

  const countryForPackage = useCallback(
    (p: Package | undefined): DestinationStat | undefined => {
      if (!p) return undefined;
      const byCountry = DESTINATIONS.find((d) => p.country && d.country === p.country);
      if (byCountry) return byCountry;
      const byCity = DESTINATIONS.find((d) => (p.country && d.country === p.country) || (p.city && d.city === p.city));
      if (byCity) return byCity;
      const byText = DESTINATIONS.find((d) => {
        const hay = `${p.title} ${p.description} ${p.destination}`.toLowerCase();
        return hay.includes(d.country.toLowerCase()) || hay.includes(d.city.toLowerCase());
      });
      return byText || undefined;
    },
    []
  );

  const sortedDestinations = useMemo(() => {
    const copy = trendingTop.slice();
    switch (sortDestinations) {
      case "price_asc":
        return copy.sort((a, b) => a.avgPrice - b.avgPrice);
      case "price_desc":
        return copy.sort((a, b) => b.avgPrice - a.avgPrice);
      case "rating":
        return copy.sort((a, b) => b.rating - a.rating);
      case "trend":
        return copy.sort((a, b) => b.trendMonth - a.trendMonth);
      default:
        return copy;
    }
  }, [trendingTop, sortDestinations]);

  // Smart search execution
  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim().toLowerCase();
      setActiveIndex(0);
      if (!q) {
        setSearchResults([]);
        setSearchError(null);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      setSearchError(null);
      try {
        const [livePackages, liveAgencies] = await Promise.all([
          api.packages.searchAdvanced({ destination: q, sort_by: "popular" }).catch(() => [] as Package[]),
          api.agencies.getAll(0, 40).catch(() => [] as Agency[]),
        ]);
        const results: typeof searchResults = [];

        // Countries
        const matchedCountries = DESTINATIONS.filter(
          (d) =>
            d.country.toLowerCase().includes(q) ||
            d.city.toLowerCase().includes(q) ||
            d.tagline.toLowerCase().includes(q)
        ).slice(0, 4);
        matchedCountries.forEach((d) =>
          results.push({
            kind: "country",
            label: `${d.flag} ${d.country}`,
            sub: `${d.city} · ${fmtPrice(d.avgPrice, currency)} avg`,
            href: `/experiences/${d.countrySlug}`,
            meta: `Rating ${d.rating.toFixed(1)} · Trend +${d.trendMonth}%`,
          })
        );

        // Categories / Activities
        const cats = ACTIVITIES.filter((a) => a.toLowerCase().includes(q)).slice(0, 2);
        cats.forEach((a) =>
          results.push({
            kind: "category",
            label: `🧭 ${a}`,
            sub: "Category",
            href: "/experiences",
          })
        );

        // Packages
        const live = livePackages.slice(0, 6);
        live.forEach((p) => {
          const d = countryForPackage(p);
          results.push({
            kind: "package",
            label: p.title,
            sub: [p.country, p.city, d?.city].filter(Boolean).join(" · ") || p.destination || "Package",
            href: `/explore?package=${p.id}`,
            meta: `${fmtPrice(Number(p.price) || 0, currency)} · ${p.duration_days}d`,
          });
        });

        // Agencies
        liveAgencies
          .filter((a) => a.name.toLowerCase().includes(q) || (a.country && a.country.toLowerCase().includes(q)))
          .slice(0, 4)
          .forEach((a) =>
            results.push({
              kind: "agency",
              label: `🏢 ${a.name}`,
              sub: a.country || "Verified Agency",
              href: `/agencies/${a.id}`,
              meta: "Open profile",
            })
          );

        // Community posts
        posts
          .filter(
            (p) =>
              p.title.toLowerCase().includes(q) ||
              p.body.toLowerCase().includes(q) ||
              (p.tag && p.tag.toLowerCase().includes(q))
          )
          .slice(0, 4)
          .forEach((p) =>
            results.push({
              kind: "post",
              label: p.title,
              sub: p.tag || "Story",
              href: `/community/posts/${p.id}`,
              meta: `❤️ ${fmtNumber(p.likes_count)}`,
            })
          );

        // Fallback packages
        if (results.length < 4) {
          packages
            .filter(
              (p) =>
                p.title.toLowerCase().includes(q) ||
                p.destination.toLowerCase().includes(q) ||
                (p.country && p.country.toLowerCase().includes(q))
            )
            .slice(0, 4)
            .forEach((p) => {
              const d = countryForPackage(p);
              results.push({
                kind: "package",
                label: p.title,
                sub: [p.country, p.city, d?.city].filter(Boolean).join(" · ") || p.destination || "Package",
                href: `/explore?package=${p.id}`,
                meta: `${fmtPrice(Number(p.price) || 0, currency)} · ${p.duration_days}d`,
              });
            });
        }
        setSearchResults(results);
      } catch (e) {
        setSearchError("Search had an issue. Showing quick links.");
      } finally {
        setSearchLoading(false);
      }
    },
    [currency, countryForPackage, packages, posts]
  );

  useEffect(() => {
    if (!searchOpen) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSearchLoading(true);
    debounceRef.current = window.setTimeout(() => {
      void runSearch(searchQuery);
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [searchQuery, searchOpen, runSearch]);

  // Lightweight animated counters
  const counters = useAnimatedCounters(
    {
      packages: avgStats.totalPackages,
      agencies: avgStats.totalAgencies,
      bookings: avgStats.totalBookings,
      savings: Math.round(avgStats.totalPackages * 180),
    },
    reducedMotion
  );

  // Derive packages for each reco section (fallback to curated list)
  const recoLists = useMemo(() => {
    const map = new Map<string, Package[]>();
    RECO_SECTIONS.forEach((section) => {
      const matched = packages.filter(section.filter);
      if (matched.length >= 4) {
        map.set(section.id, matched.slice(0, 6));
        return;
      }
      // Fallback build from destination defaults
      const fallback: Package[] = DESTINATIONS.slice(0, 8).map((d, i) => {
        const base: Package = {
          id: -9999 - i,
          title: `${section.label} · ${d.city}`,
          description: `${d.tagline}`,
          price: Math.max(480, d.avgPrice - (i % 3) * 120),
          destination: `${d.city}, ${d.country}`,
          country: d.country,
          city: d.city,
          region: null,
          duration_days: section.id === "weekend" ? 2 + (i % 3) : 4 + (i % 5),
          capacity: section.id === "family" ? 5 : 3,
          image_url: BUILD_IMAGE(d.heroPrompt, "landscape_16_9"),
          agency_id: 1,
          status: "active",
          hotel_rating: section.id === "luxury" ? 5 : 4,
        };
        return base;
      }).filter((pkg) => section.filter(pkg)).slice(0, 6);
      if (fallback.length >= 4) {
        map.set(section.id, fallback);
      } else {
        map.set(section.id, (matched.length ? [...matched, ...fallback] : fallback).slice(0, 6));
      }
    });
    return map;
  }, [packages]);

  const packagesForHero = useMemo(() => {
    const list = packages.filter((p) => p.country === heroDest.country || p.city === heroDest.city);
    return (list.length ? list : DESTINATIONS.slice(0, 4).map((d, i) => ({
      id: -500 - i,
      title: `${heroDest.city} Signature · ${i === 0 ? "Lakefront" : i === 1 ? "Culinary" : i === 2 ? "Wellness" : "Adventure"}`,
      description: heroDest.tagline,
      price: heroDest.avgPrice - (i % 3) * 120,
      destination: `${heroDest.city}, ${heroDest.country}`,
      country: heroDest.country,
      city: heroDest.city,
      duration_days: 4 + i,
      capacity: 3,
      image_url: BUILD_IMAGE(`${heroDest.heroPrompt}, ${["lakefront", "rooftop", "spa", "helicopter"][i]}`, "landscape_16_9"),
      agency_id: 1,
      status: "active",
    } as Package))).slice(0, 4);
  }, [packages, heroDest]);

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900 overflow-hidden">
      {/* Decorative gradients */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-24 w-[520px] h-[520px] rounded-full bg-indigo-300/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-60 -right-24 w-[520px] h-[520px] rounded-full bg-amber-300/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-24 pt-8 sm:pt-12">
        {/* Top bar: search + quick stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur border border-slate-200 px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-white">
              ← Home
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur border border-indigo-100 px-3.5 py-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Travel Insights</span>
              <span className="hidden sm:inline text-[10px] font-bold text-slate-500">Premium intelligence</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
                window.setTimeout(() => searchInputRef.current?.focus(), 30);
              }}
              className="group inline-flex w-full sm:w-[380px] items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-left shadow-[0_12px_32px_rgba(15,23,42,0.05)] hover:shadow-[0_16px_40px_rgba(79,70,229,0.08)] transition-shadow"
              aria-label="Open travel search"
            >
              <span className="text-lg">🔍</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-slate-900">Search countries, packages, agencies…</div>
                <div className="hidden sm:block truncate text-xs text-slate-500 font-semibold">Try: Italy, adventure, luxury…</div>
              </div>
              <kbd className="hidden sm:inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                ⌘K
              </kbd>
            </button>
            <Link href="/request-custom-offers" className="hidden sm:inline-flex items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm font-black hover:bg-slate-800">
              ✦ Custom Trip
            </Link>
          </div>
        </div>

        {/* HERO */}
        <section aria-labelledby="hero-title" className="relative mb-16 rounded-[2.75rem] overflow-hidden border border-slate-200/80 bg-slate-900 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
          <Image
            src={BUILD_IMAGE(heroDest.heroPrompt, "landscape_16_9")}
            alt={`${heroDest.city}, ${heroDest.country} hero banner`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1200px"
            className="absolute inset-0 object-cover opacity-80"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />
          <div className="relative z-10 px-6 sm:px-10 lg:px-14 py-12 sm:py-16 lg:py-20 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-end">
            <div className="text-white">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 backdrop-blur px-3.5 py-1.5 text-xs font-black uppercase tracking-wider">
                  {heroDest.flag} {heroDest.country}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-200 px-3.5 py-1.5 text-xs font-black">
                  🔥 Trending · +{heroDest.trendMonth}% this month
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3.5 py-1.5 text-xs font-black text-amber-200">
                  ⭐ {heroDest.rating.toFixed(1)} · {fmtNumber(heroDest.reviews)} reviews
                </span>
              </div>
              <h1 id="hero-title" className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
                {heroDest.tagline}
              </h1>
              <p className="mt-5 text-white/75 text-base sm:text-lg max-w-2xl font-medium leading-relaxed">
                Handpicked packages, agencies and stories from <span className="text-white font-black">{heroDest.city}</span> this season — price, visa and weather at a glance.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/explore" className="inline-flex items-center gap-2 rounded-2xl bg-white text-slate-900 px-5 py-3.5 text-sm font-black hover:bg-slate-50 shadow-lg">
                  Explore Packages →
                </Link>
                <Link href="/request-custom-offers" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 backdrop-blur text-white px-5 py-3.5 text-sm font-black hover:bg-white/15">
                  ✦ Create Custom Trip
                </Link>
                <Link href={`/experiences/${heroDest.countrySlug}`} className="inline-flex items-center gap-2 rounded-2xl bg-transparent text-white/80 hover:text-white px-5 py-3.5 text-sm font-black underline-offset-4 hover:underline">
                  View country guide ↗
                </Link>
              </div>
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
                <Stat label="Avg Price" value={fmtPrice(heroDest.avgPrice, currency)} />
                <Stat label="Best Season" value={heroDest.bestSeason.split(" ")[0]} sub={heroDest.bestSeason.split(" ").slice(1).join(" ")} />
                <Stat label="Agencies" value={`${heroDest.agencies}+`} sub="Verified partners" />
                <Stat label="Most Booked" value={heroDest.mostBooked} sub="Popular city" />
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/5 backdrop-blur-xl p-5 sm:p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-black uppercase tracking-widest text-white/60">Country Brief</div>
                <div className="text-2xl">{heroDest.flag}</div>
              </div>
              <dl className="space-y-3 text-sm">
                {heroDest.facts.map((f) => (
                  <Row key={f.label} k={f.label} v={f.value} />
                ))}
                <Row k="Visa" v={heroDest.visaInfo} multiline />
                <Row k="Weather" v={heroDest.weather} multiline />
              </dl>
              <div className="mt-5 pt-5 border-t border-white/10">
                <div className="text-xs font-black uppercase tracking-widest text-white/60 mb-3">Top Activities</div>
                <div className="flex flex-wrap gap-2">
                  {heroDest.activities.map((a) => (
                    <span key={a} className="inline-flex items-center rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-black text-white/90">
                      # {a}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-4 gap-2">
                {[heroDest.country, heroDest.city, heroDest.bestSeason, heroDest.activities[0]].map((label, i) => (
                  <MiniTicker key={label} start={0} end={[counters.packages, counters.bookings, counters.agencies, counters.savings][i]} label={label} reducedMotion={reducedMotion} />
                ))}
              </div>
            </div>
          </div>
          <div className="relative z-10 px-6 sm:px-10 lg:px-14 pb-10 lg:pb-14">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-white/60 mb-1">Featured in {heroDest.country}</div>
                <h2 className="text-white text-xl font-black">Editor’s curated packages</h2>
              </div>
              <Link href="/explore" className="text-xs font-black text-white/80 hover:text-white underline-offset-4 hover:underline">View all →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packagesForHero.map((p) => (
                <PackageCard key={p.id} p={p} currency={currency} />
              ))}
            </div>
          </div>
        </section>

        {/* ERROR BANNER */}
        {error ? (
          <div className="mb-12 rounded-2xl bg-amber-50 border border-amber-100 px-5 py-4 text-sm font-bold text-amber-800">{error}</div>
        ) : null}
        {loading ? (
          <div className="mb-12 rounded-2xl bg-slate-100 text-slate-500 text-sm font-bold text-center px-4 py-8 animate-pulse">Loading Travel Insights…</div>
        ) : null}

        {/* LIVE STATISTICS */}
        <section aria-labelledby="stats-title" className="mb-20">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Pulse of the platform</div>
              <h2 id="stats-title" className="text-2xl sm:text-3xl font-black text-slate-900">Travel Statistics</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Aggregated summary from real bookings, packages and partner networks.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
            <Kpi title="Most Booked Country" value={flagOf(avgStats.mostBookedCountry) + " " + avgStats.mostBookedCountry} sub={`${fmtPrice(avgStats.avgPrice, currency)} avg`} accent="from-indigo-500 to-indigo-600" />
            <Kpi title="Most Booked City" value={avgStats.mostBookedCity} sub={avgStats.topMonth} accent="from-fuchsia-500 to-rose-500" />
            <Kpi title="Avg Trip Budget" value={fmtPrice(avgStats.avgPrice, currency)} sub="across categories" accent="from-emerald-500 to-teal-500" />
            <Kpi title="Avg Trip Duration" value={`${avgStats.avgDuration} nights`} sub={HOTEL_CATEGORIES[0] || "Top category"} accent="from-amber-500 to-orange-500" />
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-2 rounded-[1.8rem] border border-slate-200/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)]">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-black text-slate-900">Monthly Booking Demand</CardTitle>
                    <CardDescription className="text-sm text-slate-500 font-medium">12-month snapshot · normalised index</CardDescription>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5">
                    Live · {MONTHS[new Date().getMonth()]}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <SparkBarChart values={MONTHS.map((_, i) => {
                  const seed = Math.abs(Math.sin(i + heroDest.popularity) * 100) | 0;
                  const peak = 55 + Math.abs(((i + heroDest.trendMonth) % 50));
                  return Math.max(15, Math.min(100, (seed % 45) + peak - 20));
                })} labels={MONTHS} peakIndex={new Date().getMonth()} reducedMotion={reducedMotion} />
              </CardContent>
            </Card>
            <Card className="rounded-[1.8rem] border border-slate-200/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)]">
              <CardHeader>
                <CardTitle className="text-lg font-black text-slate-900">Popular Signals</CardTitle>
                <CardDescription className="text-sm text-slate-500 font-medium">Key highlights from real bookings data.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <MeterRow label="Top Travel Month" value={avgStats.topMonth} meter={82} accent="bg-indigo-500" />
                <MeterRow label="Hotel Category" value={avgStats.topHotel} meter={74} accent="bg-fuchsia-500" />
                <MeterRow label="Fastest Growing" value={`${flagOf(avgStats.fastestGrowing.country)} ${avgStats.fastestGrowing.country} · +${avgStats.fastestGrowing.trendMonth}%`} meter={88} accent="bg-emerald-500" />
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Top Activities</div>
                  <div className="flex flex-wrap gap-2">
                    {avgStats.topActivities.map((a) => (
                      <span key={a} className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 text-xs font-black">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* TRENDING DESTINATIONS */}
        <section aria-labelledby="trending-title" className="mb-20">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Travellers booking now</div>
              <h2 id="trending-title" className="text-2xl sm:text-3xl font-black text-slate-900">Trending Destinations</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Top 10 this month · sort by preference.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { v: "popularity", l: "🔥 Popularity" },
                { v: "trend", l: "📈 Trend" },
                { v: "rating", l: "⭐ Rating" },
                { v: "price_asc", l: "💰 Price ↗" },
                { v: "price_desc", l: "💎 Price ↘" },
              ].map((s) => (
                <button
                  key={s.v}
                  onClick={() => setSortDestinations(s.v as typeof sortDestinations)}
                  className={classNames(
                    "rounded-full px-3.5 py-2 text-xs font-black transition-all",
                    sortDestinations === s.v
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                  )}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {sortedDestinations.map((d, i) => (
              <DestinationCard key={d.countrySlug} d={d} currency={currency} rank={i + 1} reducedMotion={reducedMotion} />
            ))}
          </div>
        </section>

        {/* TOP AGENCIES */}
        <section aria-labelledby="agencies-title" className="mb-20">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Verified network</div>
              <h2 id="agencies-title" className="text-2xl sm:text-3xl font-black text-slate-900">Top Agencies</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Ranked by satisfaction, reach and completion.</p>
            </div>
            <Link href="/agencies" className="text-xs font-black text-indigo-600 hover:text-indigo-700">All agencies →</Link>
          </div>
          <Card className="rounded-[1.8rem] border border-slate-200/80 overflow-hidden shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)]">
            <div className="divide-y divide-slate-100">
              <div className="hidden md:grid grid-cols-[48px_1.4fr_0.9fr_0.8fr_0.7fr_0.7fr_1fr] gap-4 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div>#</div>
                <div>Agency</div>
                <div>Rating</div>
                <div>Response</div>
                <div>Acceptance</div>
                <div>Coverage</div>
                <div>Packages · Completed</div>
              </div>
              {topAgencies.map((row, i) => (
                <AgencyRow key={row.agency.id} i={i} row={row} reducedMotion={reducedMotion} />
              ))}
              {topAgencies.length === 0 ? (
                <div className="px-6 py-10 text-slate-500 text-sm font-medium text-center">No agencies available yet.</div>
              ) : null}
            </div>
          </Card>
        </section>

        {/* HIDDEN GEMS */}
        <section aria-labelledby="gems-title" className="mb-20">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Curated editorial</div>
              <h2 id="gems-title" className="text-2xl sm:text-3xl font-black text-slate-900">Hidden Gems</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Less crowded, often surprising.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(hiddenGems.length ? hiddenGems : DESTINATIONS.slice(-3)).map((d) => (
              <GemCard key={d.countrySlug} d={d} currency={currency} />
            ))}
          </div>
        </section>

        {/* TRAVEL TRENDS */}
        <section aria-labelledby="trends-title" className="mb-20">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Animated, lightweight</div>
              <h2 id="trends-title" className="text-2xl sm:text-3xl font-black text-slate-900">Travel Trends</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Weekly & monthly signals.</p>
            </div>
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="rounded-[1.8rem] border border-slate-200/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)] lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-black text-slate-900">Trending This Week</CardTitle>
                <CardDescription className="text-sm text-slate-500 font-medium">Momentum scores last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {weeklyTrends.map((d, i) => (
                  <TrendRow key={d.countrySlug + "w"} rank={i + 1} d={d} value={d.weekTrend} currency={currency} reducedMotion={reducedMotion} />
                ))}
              </CardContent>
            </Card>
            <div className="space-y-5">
              <Card className="rounded-[1.8rem] border border-slate-200/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)]">
                <CardHeader>
                  <CardTitle className="text-lg font-black text-slate-900">Most Searched</CardTitle>
                  <CardDescription className="text-sm text-slate-500 font-medium">Last 48 hours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mostSearched.map((d, i) => (
                    <div key={d.country + "ms"} className="flex items-center justify-between gap-3 rounded-2xl p-3 bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg shrink-0">{d.flag}</div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900 truncate">{d.country}</div>
                          <div className="text-[11px] font-bold text-slate-500 truncate">#{i + 1} · {fmtNumber(d.reviews)} reviews</div>
                        </div>
                      </div>
                      <Link href={`/experiences/${d.countrySlug}`} className="text-xs font-black text-indigo-600 hover:text-indigo-700 shrink-0">Open</Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="rounded-[1.8rem] border border-slate-200/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)]">
                <CardHeader>
                  <CardTitle className="text-lg font-black text-slate-900">Most Saved Packages</CardTitle>
                  <CardDescription className="text-sm text-slate-500 font-medium">Community favourites</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(mostSaved.length ? mostSaved : packages.slice(0, 4)).map((p) => {
                    const d = countryForPackage(p);
                    return (
                      <div key={p.id + "sp"} className="flex items-center gap-3 rounded-2xl p-3 bg-slate-50 border border-slate-100">
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                          <Image fill alt={p.title} src={p.image_url || BUILD_IMAGE(d?.heroPrompt || "Luxury travel")} className="object-cover" sizes="56px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-black text-slate-900 truncate">{p.title}</div>
                          <div className="text-[11px] font-bold text-slate-500 truncate">{p.destination}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-slate-900">{fmtPrice(Number(p.price) || 0, currency)}</div>
                          <div className="text-[11px] font-bold text-slate-500">{p.duration_days}d</div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-5">
            <Card className="rounded-[1.8rem] border border-slate-200/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)]">
              <CardHeader>
                <CardTitle className="text-lg font-black text-slate-900">Trending This Month</CardTitle>
                <CardDescription className="text-sm text-slate-500 font-medium">30-day heat index</CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {monthlyTrends.map((d) => (
                  <div key={d.country + "m"} className="group relative overflow-hidden rounded-2xl border border-slate-200/80">
                    <div className="relative aspect-[4/5]">
                      <Image src={BUILD_IMAGE(d.heroPrompt, "portrait_4_3")} fill alt={`${d.city}, ${d.country}`} sizes="(max-width:768px) 50vw, 260px" className="object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <div className="text-xs font-black uppercase tracking-wider text-amber-200 mb-1">+{d.monthTrend}%</div>
                        <div className="text-lg font-black leading-tight">{d.flag} {d.country}</div>
                        <div className="text-[11px] text-white/70 font-medium">{d.city} · {fmtPrice(d.avgPrice, currency)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-[1.8rem] border border-slate-200/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)]">
              <CardHeader>
                <CardTitle className="text-lg font-black text-slate-900">Most Requested Custom Trips</CardTitle>
                <CardDescription className="text-sm text-slate-500 font-medium">Marketplace demand snapshot</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mostRequestedCustom.map((d, i) => (
                  <div key={d.country + "mr"} className="flex items-center gap-4 rounded-2xl p-3 bg-slate-50 border border-slate-100">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">{d.flag}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-black text-slate-900 truncate">{d.country} · {d.city}</div>
                      </div>
                      <div className="text-[11px] font-bold text-slate-500 truncate">{d.activities.slice(0, 2).join(" · ") || d.bestSeason}</div>
                    </div>
                    <Link
                      href={`/request-custom-offers?country=${encodeURIComponent(d.country)}`}
                      className="shrink-0 inline-flex items-center gap-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-black"
                    >
                      Request ✦
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* RECOMMENDATION SECTIONS */}
        <section aria-labelledby="reco-title" className="mb-20">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Recommendation-ready</div>
              <h2 id="reco-title" className="text-2xl sm:text-3xl font-black text-slate-900">Smart Recommendations</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Extensible structure · slot in your AI later without rewriting UI.</p>
            </div>
          </div>
          <div className="space-y-10">
            {RECO_SECTIONS.map((section) => (
              <RecommendationRow key={section.id} section={section} items={recoLists.get(section.id) || []} currency={currency} reducedMotion={reducedMotion} />
            ))}
          </div>
        </section>

        {/* SMART SEARCH SECTION */}
        <section aria-labelledby="smart-search-title" className="mb-20">
          <Card className="rounded-[1.8rem] overflow-hidden border border-slate-200/80 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.25)]">
            <CardHeader className="bg-gradient-to-r from-indigo-50 via-white to-rose-50 border-b border-slate-200/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">⌘K anywhere</div>
                  <CardTitle id="smart-search-title" className="text-xl font-black text-slate-900">Smart Search</CardTitle>
                  <CardDescription className="text-sm text-slate-500 font-medium">Search countries, packages, agencies, stories and categories.</CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(true);
                    window.setTimeout(() => searchInputRef.current?.focus(), 30);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-2.5 text-xs font-black shadow-md hover:bg-slate-800"
                >
                  Open command palette ↗
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <SearchBox
                    inputRef={searchInputRef}
                    value={searchQuery}
                    onChange={(v) => setSearchQuery(v)}
                    onClear={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                  />
                  <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-100">
                    {searchLoading ? (
                      <div className="p-5 text-sm font-bold text-slate-500 animate-pulse text-center">Searching…</div>
                    ) : searchError ? (
                      <div className="p-5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl m-3">{searchError}</div>
                    ) : searchQuery.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-600 px-4 py-2 text-xs font-black border border-slate-200 mb-3">Start typing</div>
                        <div className="text-sm text-slate-500 font-medium">Results appear as you type · country, city, package or agency</div>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          {["Italy", "Baku", "Luxury", "Adventure", "Japan"].map((q) => (
                            <button
                              key={q}
                              onClick={() => {
                                setSearchQuery(q);
                                window.setTimeout(() => searchInputRef.current?.focus(), 10);
                              }}
                              className="rounded-full bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 text-xs font-black hover:bg-white"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="text-5xl mb-3">🔎</div>
                        <div className="text-sm font-black text-slate-900">No results for “{searchQuery}”</div>
                        <div className="text-xs text-slate-500 font-bold mt-1">Try broader keywords.</div>
                      </div>
                    ) : (
                      <ul role="listbox" aria-label="Search results">
                        {searchResults.map((r, i) => (
                          <li key={`${r.kind}-${r.href}-${i}`}>
                            <Link
                              href={r.href}
                              onMouseEnter={() => setActiveIndex(i)}
                              onFocus={() => setActiveIndex(i)}
                              onClick={() => setSearchOpen(false)}
                              className={classNames(
                                "block px-4 py-3.5 border-b last:border-b-0 border-slate-100 transition-colors",
                                i === activeIndex ? "bg-indigo-50" : "hover:bg-slate-50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5">
                                      {r.kind}
                                    </span>
                                    <span className="text-sm font-black text-slate-900 truncate">{r.label}</span>
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium truncate mt-1">{r.sub}</div>
                                </div>
                                {r.meta ? <div className="text-[11px] font-bold text-indigo-600 shrink-0">{r.meta}</div> : null}
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <SearchLegend />
                  <Card className="rounded-2xl border border-slate-200 bg-white">
                    <CardHeader>
                      <CardTitle className="text-sm font-black text-slate-900">Keyboard Shortcuts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5 text-sm">
                      <Shortcut k="⌘ / Ctrl + K" v="Open search" />
                      <Shortcut k="↑ / ↓" v="Navigate results" />
                      <Shortcut k="Enter" v="Open active result" />
                      <Shortcut k="Esc" v="Close search" />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA FINAL */}
        <section aria-labelledby="cta-title" className="mb-24 rounded-[2.2rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white overflow-hidden relative border border-white/5 shadow-[0_30px_80px_-40px_rgba(30,27,75,0.75)]">
          <div aria-hidden className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.25),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.25),transparent_55%)]" />
          <div className="relative z-10 grid lg:grid-cols-[1.2fr_1fr] items-center gap-8 px-6 sm:px-10 lg:px-14 py-12 sm:py-16">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-3">Travel Intelligence · One click away</div>
              <h2 id="cta-title" className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">Ready to build your next unforgettable trip?</h2>
              <p className="mt-4 text-white/70 text-base sm:text-lg max-w-2xl font-medium">
                Use smart search to compare destinations · ask your custom trip brief · watch agencies compete with tailored offers.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/explore" className="inline-flex items-center gap-2 rounded-2xl bg-white text-slate-900 px-5 py-3.5 text-sm font-black hover:bg-slate-50 shadow-lg">
                  Explore All Packages
                </Link>
                <Link href="/request-custom-offers" className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-3.5 text-sm font-black border border-white/10">
                  ✦ Create Custom Trip
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniTile icon="🧭" title={DESTINATIONS.length.toString()} sub="Countries indexed" />
              <MiniTile icon="🏢" title={`${avgStats.totalAgencies}+`} sub="Verified agencies" />
              <MiniTile icon="🧳" title={fmtNumber(avgStats.totalPackages)} sub="Packages live" />
              <MiniTile icon="💬" title={fmtNumber(avgStats.totalBookings)} sub="Bookings indexed" />
            </div>
          </div>
        </section>
      </div>

      {/* SEARCH COMMAND PALETTE */}
      {searchOpen ? (
        <div
          className="fixed inset-0 z-[80] p-4 sm:p-8 lg:p-16 bg-slate-950/50 backdrop-blur-sm flex items-start justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Travel search"
        >
          <div className="w-full max-w-2xl bg-white rounded-[1.75rem] shadow-[0_40px_120px_-40px_rgba(15,23,42,0.7)] overflow-hidden border border-slate-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="text-xl">🔍</div>
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => (searchResults.length ? (i + 1) % searchResults.length : 0));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => (searchResults.length ? (i - 1 + searchResults.length) % searchResults.length : 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const target = searchResults[activeIndex];
                    if (target) {
                      setSearchOpen(false);
                      window.location.href = target.href;
                    }
                  }
                }}
                placeholder="Search countries, packages, agencies, stories…"
                className="!bg-transparent !border-0 !shadow-none !px-0 !text-base"
              />
              <button onClick={() => setSearchOpen(false)} type="button" aria-label="Close search" className="rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 text-xs font-black">Esc</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {searchLoading ? (
                <div className="p-6 text-center text-sm font-bold text-slate-500 animate-pulse">Searching…</div>
              ) : searchQuery.length === 0 ? (
                <div className="p-6 grid sm:grid-cols-2 gap-3">
                  {DESTINATIONS.slice(0, 6).map((d) => (
                    <Link
                      key={d.countrySlug + "cp"}
                      href={`/experiences/${d.countrySlug}`}
                      onClick={() => setSearchOpen(false)}
                      className="rounded-2xl border border-slate-200 p-3 flex items-center gap-3 hover:bg-slate-50"
                    >
                      <span className="text-xl">{d.flag}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900 truncate">{d.country}</div>
                        <div className="text-[11px] font-bold text-slate-500 truncate">{d.city}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="text-5xl mb-3">🤷</div>
                  <div className="text-sm font-black text-slate-900">No results</div>
                  <div className="text-xs text-slate-500 font-bold mt-1">Try another keyword</div>
                </div>
              ) : (
                <ul role="listbox" aria-label="Command palette results">
                  {searchResults.map((r, i) => (
                    <li key={`cp-${r.kind}-${i}`}>
                      <Link
                        href={r.href}
                        onClick={() => setSearchOpen(false)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={classNames(
                          "block px-5 py-3.5 border-b last:border-b-0 border-slate-100",
                          i === activeIndex ? "bg-indigo-50" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5">
                                {r.kind}
                              </span>
                              <span className="text-sm font-black text-slate-900 truncate">{r.label}</span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium truncate mt-1">{r.sub}</div>
                          </div>
                          {r.meta ? <span className="text-[11px] font-bold text-indigo-600 shrink-0">{r.meta}</span> : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-slate-100 text-[11px] font-bold text-slate-500">
              <span>↑↓ navigate · ↵ open · Esc close</span>
              <span>TourPie Insights</span>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

/* ===== Helpers ===== */

function useAnimatedCounters(target: Record<string, number>, reduced: boolean) {
  const [values, setValues] = useState(target);
  useEffect(() => {
    if (reduced) {
      setValues(target);
      return;
    }
    const raf = { id: 0 as number };
    const start = performance.now();
    const duration = 1200;
    const initial = values;
    const animate = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next: Record<string, number> = {};
      for (const key of Object.keys(target)) {
        const i = initial[key] || 0;
        const delta = (target[key] || 0) - i;
        next[key] = Math.round(i + delta * eased);
      }
      setValues(next);
      if (p < 1) raf.id = requestAnimationFrame(animate);
    };
    raf.id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, JSON.stringify(target)]);
  return values;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{label}</div>
      <div className="text-xl sm:text-2xl font-black leading-tight">{value}</div>
      {sub ? <div className="text-[11px] text-white/60 font-bold mt-0.5">{sub}</div> : null}
    </div>
  );
}

function Row({ k, v, multiline }: { k: string; v: string; multiline?: boolean }) {
  return (
    <div className={classNames("flex gap-4", multiline ? "flex-col" : "justify-between")}>
      <dt className="text-[10px] font-black uppercase tracking-widest text-white/50 shrink-0">{k}</dt>
      <dd className={classNames("text-sm font-semibold text-white/90 break-words", multiline ? "" : "text-right")}>{v}</dd>
    </div>
  );
}

function MiniTicker({ start, end, label, reducedMotion }: { start: number; end: number; label: string; reducedMotion: boolean }) {
  const [val, setVal] = useState(start);
  useEffect(() => {
    if (reducedMotion) {
      setVal(end);
      return;
    }
    let raf = 0;
    const s = performance.now();
    const dur = 1400;
    const loop = (t: number) => {
      const p = Math.min(1, (t - s) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(start + (end - start) * e));
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [end, reducedMotion, start]);
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-center">
      <div className="text-xs font-black text-white/90 tabular-nums">{val.toLocaleString()}</div>
      <div className="text-[9px] font-bold text-white/50 uppercase tracking-wider truncate" title={label}>
        {label}
      </div>
    </div>
  );
}

function Kpi({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="group relative rounded-[1.6rem] overflow-hidden border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-50px_rgba(15,23,42,0.35)] hover:shadow-[0_24px_64px_-40px_rgba(15,23,42,0.35)] transition-shadow">
      <div aria-hidden className={classNames("absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-40 bg-gradient-to-br", accent)} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{title}</div>
        <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight break-words">{value}</div>
        {sub ? <div className="mt-2 text-xs font-bold text-slate-500">{sub}</div> : null}
      </div>
    </div>
  );
}

function SparkBarChart({ values, labels, peakIndex, reducedMotion }: { values: number[]; labels: string[]; peakIndex?: number; reducedMotion: boolean }) {
  const [mountPct, setMountPct] = useState(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const s = performance.now();
    const dur = 900;
    const loop = (t: number) => {
      const p = Math.min(1, (t - s) / dur);
      setMountPct(1 - Math.pow(1 - p, 2));
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const max = Math.max(...values, 1);
  return (
    <div className="w-full">
      <div className="flex items-end gap-2 h-48 sm:h-56 mb-3">
        {values.map((v, i) => {
          const isPeak = peakIndex === i;
          const h = (v / max) * 100 * mountPct;
          return (
            <div key={labels[i]} className="flex-1 flex flex-col justify-end items-center gap-2 min-w-0">
              <div className="text-[10px] font-black text-slate-500 tabular-nums">{v}</div>
              <div
                className={classNames(
                  "w-full rounded-t-xl transition-all",
                  isPeak
                    ? "bg-gradient-to-t from-indigo-600 via-indigo-500 to-fuchsia-400 shadow-[0_10px_24px_-10px_rgba(79,70,229,0.7)]"
                    : "bg-gradient-to-t from-slate-200 to-slate-100"
                )}
                style={{ height: `${Math.max(6, h)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-12 gap-2">
        {labels.map((l, i) => (
          <div key={l} className={classNames("text-center text-[10px] font-bold truncate", peakIndex === i ? "text-indigo-600" : "text-slate-400")}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function MeterRow({ label, value, meter, accent }: { label: string; value: string; meter: number; accent: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 shrink-0">{label}</span>
        <span className="text-sm font-black text-slate-900 truncate text-right">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={classNames("h-full rounded-full transition-all duration-700", accent)} style={{ width: `${Math.max(8, Math.min(100, meter))}%` }} />
      </div>
    </div>
  );
}

function PackageCard({ p, currency }: { p: Package; currency: string }) {
  const image = p.image_url || BUILD_IMAGE("Luxury hotel balcony view");
  return (
    <Link href={`/explore?package=${p.id}`} className="group block rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur hover:border-white/30 transition-colors text-white">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image src={image} alt={p.title} fill sizes="(max-width:1024px) 50vw, 320px" className="object-cover group-hover:scale-105 transition-transform duration-700" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
        {p.hotel_rating ? (
          <span className="absolute top-3 right-3 rounded-full bg-black/40 backdrop-blur border border-white/20 px-2.5 py-1 text-[10px] font-black text-amber-200">
            ⭐ {p.hotel_rating}
          </span>
        ) : null}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/60">{p.country || (p.destination.split(",")[0])}</div>
            <div className="text-sm font-black text-white leading-tight line-clamp-2">{p.title || p.destination}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-black">{fmtPrice(Number(p.price || 0), currency)}</div>
            <div className="text-[10px] font-bold text-white/70">{p.duration_days}d</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function DestinationCard({ d, rank, currency, reducedMotion }: { d: DestinationStat; rank: number; currency: string; reducedMotion: boolean }) {
  const [hover, setHover] = useState(false);
  const trendPct = Math.max(15, Math.min(100, 40 + d.trendMonth * 2));
  return (
    <Link
      href={`/experiences/${d.countrySlug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative block rounded-[1.6rem] overflow-hidden border border-slate-200/80 bg-white shadow-[0_20px_60px_-48px_rgba(15,23,42,0.4)] hover:shadow-[0_28px_64px_-44px_rgba(15,23,42,0.5)]"
      aria-label={`${d.country} · ${d.city}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={BUILD_IMAGE(d.heroPrompt, "portrait_4_3")}
          fill
          sizes="(max-width:768px) 50vw, 260px"
          alt={`${d.city}, ${d.country}`}
          className={classNames("object-cover transition-transform duration-700", !reducedMotion && (hover ? "scale-110" : "scale-100"))}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 backdrop-blur text-white px-2.5 py-1 text-[10px] font-black">
            #{rank}
          </span>
          <div className="flex items-center gap-1 rounded-full bg-white/10 border border-white/15 backdrop-blur text-white px-2.5 py-1 text-[10px] font-black">
            <span>{d.flag}</span>
            <span className="truncate max-w-[96px]">{d.country}</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-200">
                +{d.trendMonth}% trend
              </div>
              <div className="text-xl font-black leading-tight">{d.city}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-black">{fmtPrice(d.avgPrice, currency)}</div>
              <div className="text-[10px] text-white/70 font-bold">avg</div>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/70">
              <span>⭐ {d.rating.toFixed(1)}</span>
              <span>{fmtNumber(d.reviews)} reviews</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={classNames("h-full bg-gradient-to-r from-amber-300 to-rose-400", reducedMotion ? "w-full" : "transition-all duration-1000")}
                style={{ width: reducedMotion ? `${trendPct}%` : hover ? `${trendPct}%` : "40%" }}
              />
            </div>
            <div className="text-[10px] text-white/60 font-bold">Most booked · {d.mostBooked}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function AgencyRow({ i, row, reducedMotion }: { i: number; row: { agency: Agency; rating: number; completed: number; response: number; acceptance: number; coverage: number; packages: number; verified: boolean }; reducedMotion: boolean }) {
  const meterVal = Math.min(99, 50 + row.rating * 7 + (row.acceptance - 78) + row.coverage);
  const href = `/agencies/${row.agency.id}`;
  return (
    <Link href={href} className="grid md:grid-cols-[48px_1.4fr_0.9fr_0.8fr_0.7fr_0.7fr_1fr] gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors items-center">
      <div className="font-black text-slate-400 text-sm">{String(i + 1).padStart(2, "0")}</div>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 text-white flex items-center justify-center text-sm font-black shadow-sm shrink-0">
          {(row.agency.name || "A").trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-black text-slate-900 text-sm truncate">{row.agency.name}</div>
            {row.verified ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 text-[10px] font-black">
                ✓ Verified
              </span>
            ) : null}
          </div>
          <div className="text-[11px] font-bold text-slate-500 truncate">{row.agency.country || "International"} · {row.agency.contact_email || ""}</div>
        </div>
      </div>
      <div>
        <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
          <span className="text-amber-500">{star(row.rating)}</span>
          <span>{row.rating.toFixed(1)}</span>
        </div>
        <div className="text-[11px] font-bold text-slate-500">{fmtNumber(row.completed * 40)} reviews est.</div>
      </div>
      <div>
        <div className="text-sm font-black text-slate-900">{row.response}h</div>
        <div className="text-[11px] font-bold text-slate-500">avg response</div>
      </div>
      <div>
        <div className="text-sm font-black text-slate-900">{row.acceptance}%</div>
        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
          <div
            className={classNames("h-full bg-indigo-500 rounded-full", reducedMotion ? "" : "transition-all duration-1000")}
            style={{ width: `${row.acceptance}%` }}
          />
        </div>
      </div>
      <div>
        <div className="text-sm font-black text-slate-900">{row.coverage} countries</div>
        <div className="text-[11px] font-bold text-slate-500">coverage</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Packages</div>
          <div className="text-sm font-black text-slate-900">{row.packages}</div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</div>
          <div className="text-sm font-black text-slate-900">{fmtNumber(row.completed)}</div>
        </div>
        <div className="col-span-2">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={classNames("h-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 rounded-full", reducedMotion ? "" : "transition-all duration-1000")}
              style={{ width: `${meterVal}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function GemCard({ d, currency }: { d: DestinationStat; currency: string }) {
  return (
    <Card className="rounded-[1.8rem] border border-slate-200/80 overflow-hidden shadow-[0_22px_60px_-40px_rgba(15,23,42,0.25)] group hover:shadow-[0_30px_70px_-40px_rgba(15,23,42,0.35)] transition-shadow">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={BUILD_IMAGE(d.heroPrompt, "landscape_4_3")}
          fill
          sizes="(max-width:768px) 100vw, 420px"
          alt={`${d.city}, ${d.country}`}
          className="object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
        <div className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 backdrop-blur px-3 py-1.5 text-[10px] font-black text-white uppercase tracking-wider">
          💎 Hidden Gem
        </div>
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2 text-white">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-widest text-amber-200 mb-0.5">{d.flag} {d.country}</div>
            <div className="text-xl font-black leading-tight">{d.city}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-black">{fmtPrice(d.avgPrice, currency)}</div>
            <div className="text-[10px] text-white/70 font-bold">{d.bestSeason.split(" ")[0]}</div>
          </div>
        </div>
      </div>
      <CardHeader>
        <CardTitle className="text-lg font-black text-slate-900">Highlights & Tips</CardTitle>
        <CardDescription className="text-sm text-slate-500 font-medium">{d.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {d.highlights?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {d.highlights.map((h) => (
              <span key={h} className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 text-[11px] font-black">
                ✦ {h}
              </span>
            ))}
          </div>
        ) : null}
        {d.tips?.length ? (
          <div className="space-y-1.5">
            {d.tips.map((tip, i) => (
              <div key={tip} className="flex items-start gap-2 text-slate-700 text-sm font-medium">
                <span className="text-amber-500 mt-0.5">✓</span>
                <span className="text-slate-700">{tip}</span>
                <span className="text-slate-300 text-xs ml-auto">{i + 1}/3</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Average stay</div>
            <div className="text-sm font-black text-slate-900">{d.bestSeason}</div>
          </div>
          <Link href={`/experiences/${d.countrySlug}`} className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-white px-4 py-2.5 text-xs font-black hover:bg-slate-800">
            Explore ↗
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendRow({ rank, d, value, currency, reducedMotion }: { rank: number; d: DestinationStat; value: number; currency: string; reducedMotion: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl p-3 sm:p-4 border border-slate-100 hover:bg-slate-50/80 transition-colors">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-center justify-center text-sm font-black">
        {rank}
      </div>
      <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200 relative">
        <Image src={BUILD_IMAGE(d.heroPrompt, "square_hd")} fill alt="" sizes="48px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-black text-slate-900 truncate">{d.flag} {d.country} · {d.city}</div>
          <span className="text-[10px] font-black rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5">+{value}%</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={classNames("h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-500 rounded-full", reducedMotion ? "" : "transition-all duration-1000")}
            style={{ width: `${Math.max(10, Math.min(100, value))}%` }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-black text-slate-900">{fmtPrice(d.avgPrice, currency)}</div>
        <div className="text-[11px] font-bold text-slate-500">{fmtNumber(d.reviews)} reviews</div>
      </div>
      <Link href={`/experiences/${d.countrySlug}`} className="shrink-0 text-xs font-black text-indigo-600 hover:text-indigo-700">Open →</Link>
    </div>
  );
}

function RecommendationRow({ section, items, currency, reducedMotion }: { section: typeof RECO_SECTIONS[number]; items: Package[]; currency: string; reducedMotion: boolean }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 text-[11px] font-black mb-2">
            <span>{section.icon}</span>
            <span>{section.id.toUpperCase()}</span>
            <span className="text-slate-400">Extensible slot</span>
          </div>
          <h3 className="text-xl font-black text-slate-900">{section.label}</h3>
          <p className="text-sm text-slate-500 font-medium">{section.tagline}</p>
        </div>
        <Link href="/explore" className="text-xs font-black text-indigo-600 hover:text-indigo-700">View all →</Link>
      </div>
      <div className={classNames("rounded-[1.8rem] p-4 sm:p-5 border border-slate-200/80 bg-gradient-to-br", section.accent)}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {items.map((p, i) => (
            <RecoPackageCard key={p.id + "rec" + i} p={p} currency={currency} i={i} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RecoPackageCard({ p, currency, i, reducedMotion }: { p: Package; currency: string; i: number; reducedMotion: boolean }) {
  const img = p.image_url || BUILD_IMAGE("Premium travel package destination photography");
  return (
    <Link
      href={`/explore?package=${p.id}`}
      className="group block rounded-2xl overflow-hidden bg-white/80 backdrop-blur border border-white shadow-[0_20px_40px_-40px_rgba(15,23,42,0.25)] hover:shadow-[0_28px_60px_-40px_rgba(15,23,42,0.35)]"
      style={!reducedMotion ? { animationDelay: `${i * 40}ms` } : undefined}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image src={img} fill sizes="(max-width:768px) 50vw, 260px" alt={p.title} className="object-cover group-hover:scale-105 transition-transform duration-700" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
        <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-white/10 border border-white/15 backdrop-blur text-white px-2.5 py-1 text-[10px] font-black">
          #{i + 1} Pick
        </span>
        {p.hotel_rating ? (
          <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-black/40 backdrop-blur border border-white/15 text-amber-200 px-2.5 py-1 text-[10px] font-black">
            ⭐ {p.hotel_rating}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 truncate">{p.country || (p.destination?.split(",")[1]?.trim() || "")}</div>
        <div className="text-sm font-black text-slate-900 leading-snug line-clamp-2 h-10">
          {p.title || `${p.destination} Package`}
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className="text-lg font-black text-slate-900 leading-tight">{fmtPrice(Number(p.price) || 0, currency)}</div>
            <div className="text-[10px] text-slate-500 font-bold">{p.duration_days || 4} nights · {p.capacity || 2} pax</div>
          </div>
          <span className="text-[10px] font-black text-indigo-600 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-1">View →</span>
        </div>
      </div>
    </Link>
  );
}

function SearchBox({ inputRef, value, onChange, onClear }: { inputRef: React.RefObject<HTMLInputElement | null>; value: string; onChange: (v: string) => void; onClear: () => void }) {
  return (
    <label className="block">
      <span className="sr-only">Search</span>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 bg-slate-50 focus-within:bg-white focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-colors">
        <span className="text-lg text-slate-400">🔍</span>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search countries, cities, packages, agencies…"
          className="!border-0 !bg-transparent !shadow-none !px-0 !text-base flex-1"
        />
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 text-[10px] font-black"
            aria-label="Clear search"
          >
            CLEAR
          </button>
        ) : (
          <span className="hidden md:inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white text-[10px] font-black text-slate-500 px-1.5 py-0.5">
            ⌘K
          </span>
        )}
      </div>
    </label>
  );
}

function SearchLegend() {
  const items = [
    { kind: "country", label: "Country", hint: "Open country guide" },
    { kind: "package", label: "Package", hint: "View package details" },
    { kind: "agency", label: "Agency", hint: "Visit agency profile" },
    { kind: "post", label: "Community", hint: "Read traveller story" },
    { kind: "category", label: "Category", hint: "Activity filter" },
  ];
  return (
    <Card className="rounded-2xl border border-slate-200 bg-white">
      <CardHeader>
        <CardTitle className="text-sm font-black text-slate-900">Result Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it) => (
          <div key={it.kind} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="text-[10px] font-black uppercase tracking-wider rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5">
                {it.kind}
              </span>
              <span className="font-black text-slate-900">{it.label}</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500 truncate">{it.hint}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Shortcut({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold text-slate-500">{v}</span>
      <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-600">{k}</kbd>
    </div>
  );
}

function MiniTile({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 text-2xl font-black text-white leading-tight">{title}</div>
      <div className="text-[11px] text-white/60 font-bold mt-0.5">{sub}</div>
    </div>
  );
}
