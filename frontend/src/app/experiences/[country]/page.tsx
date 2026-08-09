"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import {
  api,
  Agency,
  CommunityPost,
  Package,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui";
import {
  DESTINATIONS,
  BUILD_IMAGE,
  flagOf,
  slugOf,
  type DestinationStat,
} from "@/lib/travelInsightsData";

function fmtPrice(value: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
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
function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
function useReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

type GalleryAsset = { prompt: string; label: string };

const GALLERY_BY_COUNTRY: Record<string, GalleryAsset[]> = {
  Italy: [
    { prompt: "Cinematic Amalfi Coast cliffside village Positano blue hour premium travel editorial photography", label: "Amalfi" },
    { prompt: "Cinematic Cinque Terre Monterosso beach colorful houses premium travel editorial photography", label: "Cinque Terre" },
    { prompt: "Cinematic Tuscan hills wine vineyards at golden hour premium travel editorial photography", label: "Tuscany" },
    { prompt: "Cinematic Rome Colosseum at sunrise with empty forum premium travel editorial photography", label: "Roma" },
    { prompt: "Cinematic Venice Grand Canal gondolas at sunrise mist premium travel editorial photography", label: "Venezia" },
  ],
  Japan: [
    { prompt: "Cinematic Tokyo Shibuya crossing neon lights at blue hour premium travel editorial photography", label: "Tokyo" },
    { prompt: "Cinematic Osaka Dotonbori neon street food night premium travel editorial photography", label: "Osaka" },
    { prompt: "Cinematic Nara deer in cherry blossom park spring premium travel editorial photography", label: "Nara" },
    { prompt: "Cinematic Hakone Mt Fuji reflection lake sunrise premium travel editorial photography", label: "Hakone" },
    { prompt: "Cinematic Miyajima Itsukushima torii gate sunset premium travel editorial photography", label: "Hiroshima" },
  ],
  Turkey: [
    { prompt: "Cinematic Istanbul Bosphorus bridge at sunset with mosques premium travel editorial photography", label: "Istanbul" },
    { prompt: "Cinematic Antalya Kaleici old town harbor at sunset premium travel editorial photography", label: "Antalya" },
    { prompt: "Cinematic Pamukkale travertine terraces sunrise with reflection premium travel editorial photography", label: "Pamukkale" },
    { prompt: "Cinematic Ephesus ancient ruins library of Celsus golden hour premium travel editorial photography", label: "Ephesus" },
  ],
  France: [
    { prompt: "Cinematic Paris Eiffel Tower sparkles at blue hour from Trocadero premium travel editorial photography", label: "Paris" },
    { prompt: "Cinematic Provence lavender fields sunset Valensole premium travel editorial photography", label: "Provence" },
    { prompt: "Cinematic Mont Saint-Michel tidal island at high tide sunset premium travel editorial photography", label: "Normandy" },
    { prompt: "Cinematic Bordeaux Garonne river mirror effect sunset premium travel editorial photography", label: "Bordeaux" },
  ],
  Greece: [
    { prompt: "Cinematic Mykonos windmills and little venice sunset premium travel editorial photography", label: "Mykonos" },
    { prompt: "Cinematic Crete Elafonisi pink sand beach turquoise water premium travel editorial photography", label: "Crete" },
    { prompt: "Cinematic Athens Acropolis Parthenon sunrise premium travel editorial photography", label: "Athens" },
    { prompt: "Cinematic Zakynthos shipwreck beach turquoise cove premium travel editorial photography", label: "Zakynthos" },
  ],
  Switzerland: [
    { prompt: "Cinematic Lucerne lake and chapel bridge at sunrise alps premium travel editorial photography", label: "Lucerne" },
    { prompt: "Cinematic Grindelwald First cliff walk alps premium travel editorial photography", label: "Grindelwald" },
    { prompt: "Cinematic Geneva Jet d'Eau fountain at blue hour premium travel editorial photography", label: "Geneva" },
    { prompt: "Cinematic Lavaux vineyards terraces Lake Geneva sunset premium travel editorial photography", label: "Lavaux" },
  ],
  UAE: [
    { prompt: "Cinematic Abu Dhabi Sheikh Zayed Grand Mosque white marble sunset premium travel editorial photography", label: "Abu Dhabi" },
    { prompt: "Cinematic Dubai desert safari dunes golden hour camels premium travel editorial photography", label: "Desert" },
    { prompt: "Cinematic Dubai Palm Jumeirah aerial sunset premium travel editorial photography", label: "Palm" },
    { prompt: "Cinematic Ras Al Khaimah Jebel Jais mountain sunrise premium travel editorial photography", label: "RAK" },
  ],
  Maldives: [
    { prompt: "Cinematic Maldives bioluminescent beach night stars reflection premium travel editorial photography", label: "Bioluminescence" },
    { prompt: "Cinematic Maldives underwater restaurant fish coral premium travel editorial photography", label: "Dining" },
    { prompt: "Cinematic Maldives sandbank picnic private setup sunset premium travel editorial photography", label: "Sandbank" },
  ],
  Azerbaijan: [
    { prompt: "Cinematic Baku Old City Maiden Tower flame towers dusk premium travel editorial photography", label: "Baku" },
    { prompt: "Cinematic Gobustan mud volcanoes sunset rocks premium travel editorial photography", label: "Gobustan" },
    { prompt: "Cinematic Shaki Khan Palace stained glass interior premium travel editorial photography", label: "Shaki" },
    { prompt: "Cinematic Quba Caucasus mountains village autumn premium travel editorial photography", label: "Quba" },
  ],
  Georgia: [
    { prompt: "Cinematic Tbilisi Old Town colorful balconies and Narikala Fortress sunset premium travel editorial photography", label: "Tbilisi" },
    { prompt: "Cinematic Kazbegi Gergeti Trinity Church snow mountains sunrise premium travel editorial photography", label: "Kazbegi" },
    { prompt: "Cinematic Kakheti wine valley qvevri cellar autumn premium travel editorial photography", label: "Kakheti" },
    { prompt: "Cinematic Martvili Canyon turquoise water boat premium travel editorial photography", label: "Martvili" },
  ],
  Portugal: [
    { prompt: "Cinematic Lisbon colorful houses Alfama district tram 28 premium travel editorial photography", label: "Lisbon" },
    { prompt: "Cinematic Sintra Pena Palace colorful castle foggy morning premium travel editorial photography", label: "Sintra" },
    { prompt: "Cinematic Porto Ribeira terra cotta rooftops Douro river premium travel editorial photography", label: "Porto" },
    { prompt: "Cinematic Madeira Funchal cable car mountains ocean premium travel editorial photography", label: "Madeira" },
  ],
  Iceland: [
    { prompt: "Cinematic Iceland Gullfoss waterfall golden circle autumn premium travel editorial photography", label: "Gullfoss" },
    { prompt: "Cinematic Iceland Blue Lagoon geothermal spa blue water premium travel editorial photography", label: "Blue Lagoon" },
    { prompt: "Cinematic Iceland Jokulsarlon glacier lagoon icebergs sunset premium travel editorial photography", label: "Jokulsarlon" },
    { prompt: "Cinematic Iceland Landmannalaugar highlands rainbow mountains summer premium travel editorial photography", label: "Highlands" },
  ],
  Morocco: [
    { prompt: "Cinematic Chefchaouen blue city medina morocco alley sunset premium travel editorial photography", label: "Chefchaouen" },
    { prompt: "Cinematic Fes medina leather tannery terracotta pots premium travel editorial photography", label: "Fes" },
    { prompt: "Cinematic Merzouga Sahara dunes camp stars premium travel editorial photography", label: "Sahara" },
    { prompt: "Cinematic Ouzoud waterfalls green valley morocco premium travel editorial photography", label: "Ouzoud" },
  ],
  Montenegro: [
    { prompt: "Cinematic Perast Montenegro Our Lady of the Rocks island bay sunrise premium travel editorial photography", label: "Perast" },
    { prompt: "Cinematic Sveti Stefan island resort Budva Riviera sunset premium travel editorial photography", label: "Sveti Stefan" },
    { prompt: "Cinematic Durmitor Black Lake pine mountains morning mist premium travel editorial photography", label: "Durmitor" },
    { prompt: "Cinematic Tivat Porto Montenegro luxury yachts marina premium travel editorial photography", label: "Tivat" },
  ],
  Vietnam: [
    { prompt: "Cinematic Sapa rice terraces Vietnam sunrise fog mountains premium travel editorial photography", label: "Sapa" },
    { prompt: "Cinematic Hoi An old town lanterns night river reflection premium travel editorial photography", label: "Hoi An" },
    { prompt: "Cinematic Phong Nha cave river interior Vietnam premium travel editorial photography", label: "Phong Nha" },
    { prompt: "Cinematic Can Tho Mekong delta floating market sunrise premium travel editorial photography", label: "Mekong" },
  ],
};

const CITY_BY_COUNTRY: Record<string, string[]> = {
  Italy: ["Rome", "Florence", "Venice", "Amalfi", "Milan", "Sicily"],
  Japan: ["Tokyo", "Kyoto", "Osaka", "Hakone", "Nara", "Hiroshima"],
  Turkey: ["Istanbul", "Cappadocia", "Antalya", "Bodrum", "Pamukkale", "Ephesus"],
  France: ["Paris", "Nice", "Lyon", "Marseille", "Bordeaux", "Annecy"],
  Greece: ["Athens", "Santorini", "Mykonos", "Crete", "Zakynthos", "Corfu"],
  Switzerland: ["Zurich", "Lucerne", "Interlaken", "Zermatt", "Geneva", "Basel"],
  UAE: ["Dubai", "Abu Dhabi", "Ras Al Khaimah", "Sharjah", "Ajman", "Fujairah"],
  Maldives: ["Male", "Baa Atoll", "Ari Atoll", "Noonu Atoll", "Lhaviyani", "Vaavu"],
  Azerbaijan: ["Baku", "Ganja", "Shaki", "Guba", "Lankaran", "Nakhchivan"],
  Georgia: ["Tbilisi", "Kutaisi", "Batumi", "Kazbegi", "Sighnaghi", "Mestia"],
  Portugal: ["Lisbon", "Porto", "Faro", "Funchal", "Coimbra", "Sintra"],
  Iceland: ["Reykjavik", "Akureyri", "Husavik", "Vik", "Selfoss", "Egilsstadir"],
  Morocco: ["Marrakech", "Fez", "Casablanca", "Chefchaouen", "Essaouira", "Merzouga"],
  Montenegro: ["Kotor", "Budva", "Podgorica", "Tivat", "Herceg Novi", "Zabljak"],
  Vietnam: ["Hanoi", "Ho Chi Minh City", "Da Nang", "Hoi An", "Sapa", "Nha Trang"],
};

export default function CountryInsightPage() {
  useLanguage();
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.country === "string" ? params.country : "";

  const destination = useMemo<DestinationStat | undefined>(
    () => DESTINATIONS.find((d) => d.countrySlug === slug),
    [slug]
  );

  const [packages, setPackages] = useState<Package[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!destination) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const [pkgs, ags, psts] = await Promise.all([
          api.packages
            .searchAdvanced({ country: destination.country, sort_by: "popular" })
            .then((list) =>
              list.filter(
                (p) => p.status === undefined || p.status === "active"
              )
            )
            .catch(() => [] as Package[]),
          api.agencies.getAll(0, 200).catch(() => [] as Agency[]),
          api.community
            .listPosts({ limit: 30, tab: "latest" })
            .then((list) =>
              list.filter(
                (p) =>
                  !destination.country ||
                  !p.title ||
                  p.title.toLowerCase().includes(destination.country.toLowerCase()) ||
                  (p.body ?? "").toLowerCase().includes(destination.country.toLowerCase()) ||
                  (p.tag ?? "").toLowerCase().includes(destination.country.toLowerCase())
              )
            )
            .catch(() => [] as CommunityPost[]),
        ]);
        setPackages(pkgs);
        setAgencies(
          ags.filter(
            (a) =>
              a.status === undefined ||
              a.status === "approved" ||
              a.status === "active"
          )
        );
        setPosts(psts);
      } catch (e) {
        setError("We couldn't fetch live data for this country.");
      } finally {
        setLoading(false);
      }
    })();
  }, [destination]);

  const gallery = useMemo<GalleryAsset[]>(
    () =>
      destination
        ? GALLERY_BY_COUNTRY[destination.country] ?? [
            {
              prompt: destination.heroPrompt,
              label: destination.city,
            },
          ]
        : [],
    [destination]
  );

  const cities = useMemo<string[]>(
    () => (destination ? CITY_BY_COUNTRY[destination.country] ?? [destination.city, destination.mostBooked] : []),
    [destination]
  );

  const avgBudget = useMemo(() => {
    if (!packages.length && destination) return destination.avgPrice;
    if (!packages.length) return 0;
    return Math.round(
      packages.reduce((sum, p) => sum + (p.price || 0), 0) / packages.length
    );
  }, [packages, destination]);

  const avgDuration = useMemo(() => {
    if (!packages.length) return 6;
    return Math.round(
      packages.reduce((sum, p) => sum + (p.duration_days || 0), 0) /
        packages.length
    );
  }, [packages]);

  const topCityPackages = useMemo(() => {
    if (!destination || !packages.length) return [];
    const byCity = new Map<string, Package[]>();
    for (const p of packages) {
      const key = p.city || destination.city;
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key)!.push(p);
    }
    return Array.from(byCity.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([city, list]) => ({
        city,
        count: list.length,
        avgPrice: Math.round(
          list.reduce((s, p) => s + (p.price || 0), 0) / list.length
        ),
      }));
  }, [packages, destination]);

  const countryAgencies = useMemo(() => {
    if (!destination) return [];
    const byAgencyId = new Map<number, { agency: Agency; packages: Package[] }>();
    for (const a of agencies) byAgencyId.set(a.id, { agency: a, packages: [] });
    for (const p of packages) {
      const row = byAgencyId.get(p.agency_id);
      if (row) row.packages.push(p);
    }
    const match = (a: Agency) =>
      (a.country || "")
        .toLowerCase()
        .includes(destination.country.toLowerCase());
    const scored = agencies
      .filter((a) => match(a) || (byAgencyId.get(a.id)?.packages.length ?? 0) > 0)
      .map((agency) => {
        const pkgs = byAgencyId.get(agency.id)?.packages ?? [];
        const avg =
          pkgs.length > 0
            ? Math.round(pkgs.reduce((s, p) => s + (p.price || 0), 0) / pkgs.length)
            : 0;
        const rating = 4.2 + ((agency.id * 7) % 8) / 10;
        return { agency, rating, packages: pkgs.length, avgBudget: avg };
      })
      .sort((a, b) => b.packages * 3 + b.rating - (a.packages * 3 + a.rating))
      .slice(0, 5);
    return scored;
  }, [agencies, packages, destination]);

  const related = useMemo<DestinationStat[]>(() => {
    if (!destination) return [];
    const regionHints: Record<string, string[]> = {
      Italy: ["France", "Greece", "Portugal", "Spain"],
      France: ["Italy", "Switzerland", "Portugal", "Spain"],
      Japan: ["South Korea", "Vietnam", "Indonesia"],
      Turkey: ["Greece", "Georgia", "Azerbaijan", "Montenegro"],
      Greece: ["Turkey", "Italy", "Montenegro", "Croatia"],
      Switzerland: ["France", "Italy", "Austria", "Iceland"],
      UAE: ["Turkey", "Maldives", "Azerbaijan", "Georgia"],
      Maldives: ["UAE", "Indonesia", "Vietnam"],
      Azerbaijan: ["Georgia", "Turkey", "UAE", "Montenegro"],
      Georgia: ["Azerbaijan", "Turkey", "Montenegro", "Morocco"],
      Montenegro: ["Croatia", "Greece", "Italy", "Georgia"],
      Portugal: ["Spain", "France", "Italy", "Morocco"],
      Iceland: ["Norway", "Switzerland", "Canada", "New Zealand"],
      Morocco: ["Portugal", "Spain", "Turkey", "Georgia"],
      Vietnam: ["Thailand", "Indonesia", "Japan", "South Korea"],
    };
    const list = regionHints[destination.country] ?? [];
    return list
      .map((name) => DESTINATIONS.find((d) => d.country === name))
      .filter((x): x is DestinationStat => !!x)
      .filter((d) => d.countrySlug !== destination.countrySlug)
      .slice(0, 4);
  }, [destination]);

  if (!destination) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 px-4 py-12 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/experiences"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            ← Travel Insights
          </Link>
          <Card className="mt-8 border border-slate-200 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-3xl font-black text-slate-900">
                Country not found
              </CardTitle>
              <CardDescription>
                The destination <span className="font-black text-slate-900">{slug || "(missing)"}</span> isn’t
                published yet. Browse our current insights.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {DESTINATIONS.slice(0, 8).map((d) => (
                  <Link
                    key={d.countrySlug}
                    href={`/experiences/${d.countrySlug}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-white"
                  >
                    {d.flag} {d.country}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900">
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={BUILD_IMAGE(destination.heroPrompt, "landscape_16_9")}
            alt={`${destination.country} premium hero`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/55 to-slate-950/90" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/experiences"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white/80 hover:bg-white/10"
            >
              ← Travel Insights
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              Country Guide
            </span>
            {destination.isHidden ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 backdrop-blur">
                Hidden Gem
              </span>
            ) : null}
          </div>
          <div className="mt-6 flex items-end justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="text-5xl drop-shadow-lg">{destination.flag}</span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/70">
                    {destination.city} · {destination.country}
                  </p>
                  <h1 className="mt-1 text-4xl font-black leading-tight text-white md:text-6xl">
                    {destination.tagline}
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm text-white/80 md:text-base">
                A curated snapshot of {destination.country}: budget anchors,
                weather, visa, best season, and the packages agencies are shipping
                right now.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/results?destination=${encodeURIComponent(
                    destination.country
                  )}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-xl shadow-slate-950/20 hover:bg-slate-100"
                >
                  Explore Packages
                </Link>
                <Link
                  href="/request-custom-offers"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20"
                >
                  Create Custom Trip
                </Link>
              </div>
            </div>
            <div className="hidden grid-cols-2 gap-3 sm:grid md:grid-cols-2 lg:grid-cols-2">
              <MiniTile icon="💵" title={fmtPrice(avgBudget)} sub="Avg Package" />
              <MiniTile icon="📅" title={`${avgDuration}d`} sub="Avg Trip Length" />
              <MiniTile icon="⭐" title={`${star(destination.rating)} ${destination.rating.toFixed(1)}`} sub={`${fmtNumber(destination.reviews)} reviews`} />
              <MiniTile icon="🛫" title={`${destination.bestSeason.split(" ")[0]}`} sub="Best Season" />
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <FactCard label="Capital" value={destination.facts[0]?.value || "—"} />
            <FactCard label="Language" value={destination.facts[1]?.value || "—"} />
            <FactCard label="Currency" value={destination.facts[2]?.value || "—"} />
            <FactCard label="Timezone" value={destination.facts[3]?.value || "—"} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16" aria-labelledby="gallery-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-600">
              Gallery
            </p>
            <h2 id="gallery-heading" className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
              Sights of {destination.country}
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {gallery.slice(0, 5).map((g, i) => (
            <div
              key={g.label}
              className={classNames(
                "group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100",
                i === 0 ? "sm:col-span-2 sm:row-span-2 aspect-square" : "aspect-[4/5]"
              )}
            >
              <Image
                src={BUILD_IMAGE(g.prompt, i === 0 ? "landscape_4_3" : "portrait_4_3")}
                alt={g.label}
                fill
                sizes="(max-width: 768px) 100vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/80">{destination.country}</p>
                <p className="mt-0.5 text-lg font-black">{g.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8 md:pb-16" aria-labelledby="cities-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-600">
              Popular Cities
            </p>
            <h2 id="cities-heading" className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
              Where travellers book
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {cities.map((city, idx) => {
            const row = topCityPackages.find((r) => r.city === city);
            return (
              <Link
                key={city}
                href={`/results?destination=${encodeURIComponent(city)}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                    #{idx + 1}
                  </div>
                  <span className="text-xl">{destination.flag}</span>
                </div>
                <div className="mt-6">
                  <p className="text-lg font-black text-slate-900">{city}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row ? `${fmtNumber(row.count)} packages · from ${fmtPrice(row.avgPrice)}` : "Explore curated packages"}
                  </p>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
                    style={{ width: `${Math.max(20, 90 - idx * 10)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8 md:pb-16" aria-labelledby="budget-heading">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="rounded-2xl border border-slate-200 bg-white">
            <CardHeader>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Budget</p>
              <CardTitle id="budget-heading" className="mt-1 text-3xl font-black">{fmtPrice(avgBudget)}</CardTitle>
              <CardDescription>Average package price in {destination.country}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Entry-level" value={fmtPrice(Math.max(380, Math.round(avgBudget * 0.6)))} accent="from-emerald-400 to-lime-400" />
              <Row label="Mid-range" value={fmtPrice(avgBudget)} accent="from-sky-500 to-indigo-500" />
              <Row label="Premium" value={fmtPrice(Math.round(avgBudget * 1.8))} accent="from-fuchsia-500 to-rose-500" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-slate-200 bg-white">
            <CardHeader>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-600">Visa</p>
              <CardTitle className="mt-1 text-2xl font-black">Entry requirements</CardTitle>
              <CardDescription>{destination.visaInfo}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>• Apply 4–6 weeks in advance when a visa is required.</li>
                <li>• Check passport validity for 6+ months beyond return.</li>
                <li>• Confirm re-entry rules if combining nearby countries.</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-slate-200 bg-white">
            <CardHeader>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-600">Weather · Best Season</p>
              <CardTitle className="mt-1 text-2xl font-black">{destination.bestSeason}</CardTitle>
              <CardDescription>{destination.weather}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {destination.activities.map((a) => (
                  <span key={a} className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-800">
                    {a}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8 md:pb-16" aria-labelledby="packages-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-600">Packages</p>
            <h2 id="packages-heading" className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
              Available trips in {destination.country}
            </h2>
          </div>
          <Link
            href={`/results?destination=${encodeURIComponent(destination.country)}`}
            className="hidden text-sm font-black text-indigo-600 hover:text-indigo-700 md:inline-flex"
          >
            View all {fmtNumber(packages.length)} →
          </Link>
        </div>
        {loading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-[16/10] bg-slate-200" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                  <div className="h-5 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-5/6 rounded bg-slate-100" />
                  <div className="flex justify-between pt-2">
                    <div className="h-6 w-20 rounded bg-slate-200" />
                    <div className="h-6 w-16 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : packages.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packages.slice(0, 6).map((pkg) => {
              const agency = agencies.find((a) => a.id === pkg.agency_id);
              return (
                <Link
                  key={pkg.id}
                  href={`/details/${pkg.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    <Image
                      src={pkg.image_url || BUILD_IMAGE(destination.heroPrompt, "landscape_16_9")}
                      alt={pkg.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3 flex gap-2">
                      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 backdrop-blur">
                        {destination.flag} {pkg.country || destination.country}
                      </span>
                      {pkg.category ? (
                        <span className="rounded-full bg-indigo-600/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
                          {pkg.category}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-3 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {pkg.city || destination.city} · {pkg.duration_days || 5} days
                    </p>
                    <h3 className="text-lg font-black leading-snug text-slate-900 line-clamp-2">{pkg.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2">{pkg.description}</p>
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">From</p>
                        <p className="text-xl font-black text-slate-900">{fmtPrice(pkg.price)}</p>
                      </div>
                      {agency ? (
                        <p className="max-w-[55%] truncate text-right text-xs font-bold text-slate-500">
                          {agency.name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="mt-6 border border-dashed border-slate-300 bg-slate-50">
            <CardContent className="p-6 text-center text-sm text-slate-600">
              No live packages yet for {destination.country}.{" "}
              <Link href="/request-custom-offers" className="font-black text-indigo-600 underline">
                Request a custom trip
              </Link>{" "}
              and agencies will tailor one for you.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8 md:pb-16" aria-labelledby="agencies-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-rose-600">Top Agencies</p>
            <h2 id="agencies-heading" className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
              Trusted operators in {destination.country}
            </h2>
          </div>
        </div>
        <Card className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <CardContent className="p-0">
            <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 md:grid">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Agency</div>
              <div className="col-span-2 text-right">Packages</div>
              <div className="col-span-2 text-right">Rating</div>
              <div className="col-span-2 text-right">Avg Budget</div>
            </div>
            {countryAgencies.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                We’re still confirming our agency roster here. Browse the full marketplace or request a custom trip.
              </div>
            ) : (
              <ul>
                {countryAgencies.map((row, idx) => (
                  <li
                    key={row.agency.id}
                    className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-5 py-4 last:border-none md:grid-cols-12"
                  >
                    <div className="col-span-1">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="col-span-5">
                      <p className="text-sm font-black text-slate-900">{row.agency.name}</p>
                      <p className="text-xs text-slate-500">{row.agency.office_address || row.agency.country || destination.country}</p>
                    </div>
                    <div className="col-span-2 text-left md:text-right">
                      <p className="text-sm font-black text-slate-900">{fmtNumber(row.packages)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">trips</p>
                    </div>
                    <div className="col-span-2 text-left md:text-right">
                      <p className="text-sm font-black text-slate-900">{row.rating.toFixed(1)} {star(row.rating).slice(0, 1)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">satisfaction</p>
                    </div>
                    <div className="col-span-2 text-left md:text-right">
                      <p className="text-sm font-black text-slate-900">
                        {row.avgBudget ? fmtPrice(row.avgBudget) : "—"}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">avg package</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8 md:pb-16" aria-labelledby="community-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-purple-600">Community</p>
            <h2 id="community-heading" className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
              Traveller stories
            </h2>
          </div>
          <Link
            href="/community"
            className="hidden text-sm font-black text-indigo-600 hover:text-indigo-700 md:inline-flex"
          >
            Read more →
          </Link>
        </div>
        {posts.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {posts.slice(0, 3).map((post) => {
              const img =
                (post.images && post.images[0]) ||
                post.image_url ||
                BUILD_IMAGE(destination.heroPrompt, "landscape_16_9");
              return (
                <Link
                  key={post.id}
                  href={`/community/posts/${post.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    <Image
                      src={img}
                      alt={post.title || "Community post"}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-2 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {post.tag || "Story"} · ♥ {fmtNumber(post.likes_count || 0)}
                    </p>
                    <h3 className="text-lg font-black leading-snug text-slate-900 line-clamp-2">
                      {post.title || "A day in the country"}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-3">{post.body}</p>
                    <p className="text-xs font-bold text-slate-500">
                      by {(post.user as any)?.name || "Anonymous Traveller"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="mt-6 border border-dashed border-slate-300 bg-slate-50">
            <CardContent className="p-6 text-center text-sm text-slate-600">
              No community stories yet for {destination.country}. Share your own on the{" "}
              <Link href="/community" className="font-black text-indigo-600 underline">
                community page
              </Link>
              .
            </CardContent>
          </Card>
        )}
      </section>

      {(destination.highlights || destination.tips) ? (
        <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8 md:pb-16" aria-labelledby="tips-heading">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/40">
              <CardHeader>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-600">Highlights</p>
                <CardTitle id="tips-heading" className="mt-1 text-2xl font-black">
                  Don’t leave without…
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {(destination.highlights || []).map((h, i) => (
                    <li key={h} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                        {i + 1}
                      </span>
                      <p className="text-sm text-slate-700">{h}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50/40">
              <CardHeader>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-700">Travel Tips</p>
                <CardTitle className="mt-1 text-2xl font-black">
                  Smarter stays in {destination.country}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {(destination.tips || []).map((tip, i) => (
                    <li key={tip} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                        {i + 1}
                      </span>
                      <p className="text-sm text-slate-700">{tip}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8 md:pb-24" aria-labelledby="related-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Related</p>
              <h2 id="related-heading" className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
                Continue exploring
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((d) => (
              <Link
                key={d.countrySlug}
                href={`/experiences/${d.countrySlug}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Image
                  src={BUILD_IMAGE(d.heroPrompt, "portrait_4_3")}
                  alt={d.country}
                  fill
                  sizes="(max-width: 768px) 100vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-2xl">{d.flag}</p>
                  <p className="mt-1 text-2xl font-black leading-tight">{d.country}</p>
                  <p className="mt-1 text-xs text-white/80">{d.tagline}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-black">{fmtPrice(d.avgPrice)}</span>
                    <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
                      Guide →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="relative isolate mx-auto max-w-7xl px-4 pb-16 md:px-8 md:pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-8 md:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="relative grid items-center gap-6 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-300">
                Plan with TourPie
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-white md:text-4xl">
                Ready to book {destination.country}?
              </h2>
              <p className="mt-3 text-sm text-white/70 md:text-base">
                Compare live packages from verified agencies, or start a custom trip request and let the
                right operators come to you.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link
                href={`/results?destination=${encodeURIComponent(destination.country)}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-900 hover:bg-slate-100"
              >
                Browse Packages
              </Link>
              <Link
                href="/request-custom-offers"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/20"
              >
                Custom Trip Request
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniTile({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 text-2xl font-black leading-tight text-white">{title}</div>
      <div className="mt-0.5 text-[11px] font-bold text-white/60">{sub}</div>
    </div>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/60">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-sm font-black text-slate-900">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={classNames("h-full rounded-full bg-gradient-to-r", accent)} style={{ width: label === "Entry-level" ? "45%" : label === "Mid-range" ? "70%" : "95%" }} />
      </div>
    </div>
  );
}
