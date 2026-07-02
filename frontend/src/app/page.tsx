"use client";

import Image from "next/image";
import Link from "next/link";
import { api, Package } from "@/lib/api";
import { Currency, useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import HotNowHub from "@/components/HotNowHub";

export default function Home() {
  const { t, currency, setCurrency, formatPackageMoney } = useLanguage();
  const [featuredPackages, setFeaturedPackages] = useState<Package[]>([]);
  const [trendingPackages, setTrendingPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "success">("idle");

  const socialLinks: Record<string, string> = {
    Twitter: "https://twitter.com",
    Instagram: "https://www.instagram.com",
    Facebook: "https://www.facebook.com",
    LinkedIn: "https://www.linkedin.com",
  };
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setApiError(null);
        const [allPkgs, trendingPkgs] = await Promise.all([
          api.packages.getAll(0, 6),
          api.recommendations.getTrending(3)
        ]);
        setFeaturedPackages(allPkgs);
        setTrendingPackages(trendingPkgs);
      } catch (error) {
        setFeaturedPackages([]);
        setTrendingPackages([]);
        setApiError(error instanceof Error ? error.message : "Failed to load packages");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setNewsletterStatus("loading");
    // Simulate API call
    setTimeout(() => {
      setNewsletterStatus("success");
      setNewsletterEmail("");
      setTimeout(() => setNewsletterStatus("idle"), 3000);
    }, 1500);
  };

  const categories = [
    { name: t('section_countries'), slug: "countries", icon: "🌍", color: "bg-blue-100 text-blue-600", image: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=1000&auto=format&fit=crop" },
    { name: t('section_cities'), slug: "cities", icon: "🏙️", color: "bg-purple-100 text-purple-600", image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=1000&auto=format&fit=crop" },
    { name: t('section_sightseeing'), slug: "sightseeing", icon: "🏛️", color: "bg-orange-100 text-orange-600", image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop" },
    { name: t('cat_nature'), slug: "nature", icon: "🌿", color: "bg-green-100 text-green-600", image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1000&auto=format&fit=crop" },
    { name: t('cat_adventure'), slug: "adventure", icon: "🧗", color: "bg-red-100 text-red-600", image: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?q=80&w=1000&auto=format&fit=crop" },
  ];

  const topCountries = [
    { name: "Switzerland", packages: 12, image: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=800" },
    { name: "Japan", packages: 8, image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800" },
    { name: "Italy", packages: 15, image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=800" },
    { name: "Iceland", packages: 6, image: "https://images.unsplash.com/photo-1504109586057-7a2ae83d1338?q=80&w=800" },
  ];

  const popularCities = [
    { name: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800" },
    { name: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=800" },
    { name: "New York", country: "USA", image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=800" },
    { name: "Baku", country: "Azerbaijan", image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=800" },
  ];

  return (
    <div className="relative min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative min-h-[750px] flex items-center justify-center text-white overflow-hidden py-16 sm:py-20 lg:py-24">
        {/* Modern Vibrant Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/80 via-blue-600/40 to-purple-500/30 z-10" />
        <div className="absolute inset-0 bg-black/20 z-10" />
        
        <Image
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop"
          alt="Hero background"
          fill
          className="object-cover scale-105"
          priority
          sizes="100vw"
        />
        
        <div className="relative z-20 w-full px-4">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center text-center">
              <div className="flex flex-col items-center gap-6 md:gap-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black tracking-[0.3em] uppercase bg-white/20 backdrop-blur-md rounded-full border border-white/30 shadow-2xl">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  {t("home_hero_badge")}
                </div>

                <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] drop-shadow-2xl max-w-4xl mx-auto">
                  {t("hero_title")
                    .split(" ")
                    .map((word, i, arr) => (
                      <span key={i} className={i === arr.length - 1 ? "text-blue-400" : ""}>
                        {word}{" "}
                      </span>
                    ))}
                </h1>

                <p className="text-xl md:text-2xl text-blue-50/90 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-lg">
                  {t("hero_subtitle")}
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link
                    href="/login"
                    prefetch={false}
                    className="inline-flex justify-center bg-white/15 hover:bg-white/20 backdrop-blur-md text-white font-bold px-8 py-4 rounded-2xl border border-white/25 transition-colors"
                  >
                    {t("nav_login")}
                  </Link>
                  <Link
                    href="/agency/register"
                    prefetch={false}
                    className="inline-flex justify-center bg-blue-500 hover:bg-blue-400 text-white font-bold px-8 py-4 rounded-2xl transition-colors shadow-lg shadow-blue-500/20"
                  >
                    {t("agency_register_cta")}
                  </Link>
                </div>
              </div>

              <div className="w-full mt-10 md:mt-12">
                <form
                  action="/results"
                  method="GET"
                  className="bg-white p-4 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] flex flex-col gap-4"
                >
              {apiError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
                  <div className="text-xs font-black uppercase tracking-widest text-amber-700">{t("common_backend_offline")}</div>
                  <div className="mt-1 text-sm font-bold text-amber-900">{apiError}</div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    prefetch={false}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 hover:bg-blue-600 hover:text-white transition-all duration-300 border border-gray-100 text-sm font-black text-gray-800 text-center"
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span>{cat.name}</span>
                  </Link>
                ))}
              </div>

              <div className="flex flex-col lg:flex-row gap-3 items-stretch">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="group relative px-6 py-4 rounded-3xl bg-gray-50 border border-transparent hover:border-blue-100 hover:bg-white transition-all">
                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 opacity-60">
                      {t("search_destination")}
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-xl group-hover:scale-110 transition-transform">🌍</span>
                      <input
                        type="text"
                        name="destination"
                        placeholder={t("search_where")}
                        required
                        className="w-full bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none font-bold text-lg"
                      />
                    </div>
                  </div>

                  <div className="group relative px-6 py-4 rounded-3xl bg-gray-50 border border-transparent hover:border-blue-100 hover:bg-white transition-all">
                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 opacity-60">
                      {t("search_budget")}
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-xl group-hover:scale-110 transition-transform">💰</span>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          name="budget"
                          min="0"
                          placeholder={t("search_max_budget")}
                          className="w-full bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none font-bold text-lg pr-16"
                        />
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as Currency)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 bg-transparent text-sm font-black text-gray-700 outline-none"
                          aria-label="Budget currency"
                        >
                          {["USD", "EUR", "AZN", "RUB", "TRY"].map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="group relative px-6 py-4 rounded-3xl bg-gray-50 border border-transparent hover:border-blue-100 hover:bg-white transition-all">
                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 opacity-60">
                      {t("search_people")}
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-xl group-hover:scale-110 transition-transform">👥</span>
                      <input
                        type="number"
                        name="people"
                        min="1"
                        placeholder={t("search_how_many")}
                        className="w-full bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none font-bold text-lg"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="lg:w-48 bg-blue-600 hover:bg-blue-700 text-white px-8 py-5 rounded-[2rem] font-black text-lg transition-all duration-300 shadow-xl shadow-blue-200 hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3"
                >
                  {t("search_button")}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </button>
              </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Countries Section */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <Link href="/category/countries" className="inline-block group">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">{t('section_countries')}</h2>
            <div className="h-1.5 w-24 bg-blue-600 mx-auto rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          </Link>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto mt-4">{t('section_countries_subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {topCountries.map((country, i) => (
            <Link prefetch={false} href={`/results?destination=${country.name}`} key={i} className="group relative h-80 rounded-[2rem] overflow-hidden shadow-lg">
              <Image 
                src={country.image} 
                alt={country.name} 
                fill 
                className="object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-8 left-8">
                <h3 className="text-2xl font-bold text-white mb-1">{country.name}</h3>
                <p className="text-blue-300 font-semibold text-sm">{t("common_packages_count", { count: country.packages })}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular Cities Section */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <Link href="/category/cities" className="group">
                <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">{t('section_cities')}</h2>
                <div className="h-1.5 w-20 bg-blue-600 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </Link>
              <p className="text-gray-500 text-lg mt-4">{t('section_cities_subtitle')}</p>
            </div>
            <Link prefetch={false} href="/category/cities" className="bg-white text-gray-900 font-bold px-8 py-3 rounded-full shadow-md hover:shadow-lg transition-all border border-gray-100">
              {t('home_view_all')}
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {popularCities.map((city, i) => (
              <div key={i} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="relative h-48">
                  <Image src={city.image} alt={city.name} fill className="object-cover" />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-900">
                    {city.country}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{city.name}</h3>
                  <Link href={`/results?destination=${city.name}`} className="inline-flex items-center text-blue-600 font-bold text-sm group-hover:gap-2 transition-all">
                    {t('pkg_explore_details')} <span className="text-lg">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HotNowHub mode="compact" />

      {/* Recommended Section (Trending) */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">{t('home_recommended')}</h2>
            <p className="text-gray-500 text-lg">{t('home_trending')}</p>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-[2.5rem] h-[500px] animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : trendingPackages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {trendingPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 group"
                >
                  <div className="relative h-72 overflow-hidden">
                    <Image
                      src={pkg.image_url || "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop"}
                      alt={pkg.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-700"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute top-6 right-6 bg-blue-600 text-white px-4 py-2 rounded-2xl text-lg font-black shadow-xl">
                      {formatPackageMoney(pkg)}
                    </div>
                  </div>
                  <div className="p-8">
                    <div className="flex items-center gap-3 text-blue-600 text-xs font-black uppercase tracking-[0.2em] mb-4">
                      <span className="bg-blue-50 px-3 py-1 rounded-lg">{pkg.duration_days} {t('pkg_days')}</span>
                      <span>•</span>
                      <span className="bg-blue-50 px-3 py-1 rounded-lg">{pkg.destination}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                      {pkg.title}
                    </h3>
                    <p className="text-gray-500 mb-8 line-clamp-2 leading-relaxed">
                      {pkg.description}
                    </p>
                    <Link
                      href={`/details/${pkg.id}`}
                      className="flex items-center justify-center w-full bg-gray-900 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-blue-200"
                    >
                      {t('pkg_view_offer')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500 font-medium">
              {t("home_trending_none")}
            </div>
          )}
        </div>
      </section>

      {/* Iconic Sightseeing Section */}
      <section className="bg-blue-900 py-24 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 relative">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
          
          <div className="text-center mb-16 relative z-10">
            <Link href="/category/sightseeing" className="inline-block group">
              <h2 className="text-4xl md:text-5xl font-black mb-4 group-hover:text-blue-400 transition-colors">{t('section_sightseeing')}</h2>
              <div className="h-1.5 w-24 bg-blue-400 mx-auto rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </Link>
            <p className="text-blue-200 text-lg max-w-2xl mx-auto mt-4">{t('section_sightseeing_subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {[
              { name: "Eiffel Tower", loc: "Paris, France", img: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?q=80&w=800" },
              { name: "Great Wall", loc: "Huairou, China", img: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?q=80&w=800" },
              { name: "Colosseum", loc: "Rome, Italy", img: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=800" },
            ].map((sight, i) => (
              <div key={i} className="group relative h-96 rounded-[2.5rem] overflow-hidden">
                <Image src={sight.img} alt={sight.name} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <p className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-1">{sight.loc}</p>
                  <h3 className="text-2xl font-bold">{sight.name}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Packages (All) */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div>
            <h2 className="text-4xl font-black text-gray-900 mb-4">{t('home_explore_all')}</h2>
            <p className="text-gray-500 text-lg">{t('home_hand_picked')}</p>
          </div>
          <Link
            href="/results"
            className="group flex items-center gap-3 bg-blue-50 text-blue-600 font-bold px-8 py-4 rounded-2xl hover:bg-blue-600 hover:text-white transition-all duration-300"
          >
            {t('home_view_all')}
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-3xl h-[450px] animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : featuredPackages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group"
              >
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src={pkg.image_url || "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop"}
                    alt={pkg.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-lg font-bold text-blue-600 shadow-lg">
                    {formatPackageMoney(pkg)}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-3">
                    <span className="bg-blue-50 px-2 py-0.5 rounded">{pkg.duration_days} {t('pkg_days')}</span>
                    <span className="text-gray-300">•</span>
                    <span className="bg-blue-50 px-2 py-0.5 rounded">{pkg.destination}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {pkg.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-6 line-clamp-2 leading-relaxed">
                    {pkg.description}
                  </p>
                  <Link
                    href={`/details/${pkg.id}`}
                    className="block w-full text-center bg-gray-50 hover:bg-blue-50 text-gray-900 hover:text-blue-600 font-bold py-4 rounded-2xl transition-all duration-300 border border-gray-100 hover:border-blue-100"
                  >
                    {t('pkg_explore_details')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
            <p className="text-gray-500 font-bold">{t("home_featured_empty")}</p>
          </div>
        )}
      </section>
      
      {/* Newsletter Section */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="bg-blue-600 rounded-[3rem] p-12 md:p-20 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black mb-6">{t("home_newsletter_title")}</h2>
            <p className="text-blue-100 text-lg mb-10">{t("home_newsletter_subtitle")}</p>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4">
              <input 
                type="email" 
                placeholder={t("home_newsletter_email_placeholder")}
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                required
                className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <button 
                type="submit"
                disabled={newsletterStatus !== "idle"}
                className="bg-white text-blue-600 font-bold px-10 py-4 rounded-2xl hover:bg-blue-50 transition-colors shadow-xl disabled:opacity-50"
              >
                {newsletterStatus === "loading"
                  ? t("home_newsletter_subscribing")
                  : newsletterStatus === "success"
                    ? t("home_newsletter_subscribed")
                    : t("home_newsletter_subscribe")}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Logo variant="light" className="justify-center mb-8" />
          <p className="text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">{t("home_footer_tagline")}</p>
          <div className="flex justify-center gap-6 mb-8">
            {['Twitter', 'Instagram', 'Facebook', 'LinkedIn'].map((social) => (
              <a
                key={social}
                href={socialLinks[social] ?? "https://example.com"}
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                {social}
              </a>
            ))}
          </div>
          <div className="pt-8 border-t border-gray-800 text-gray-500 text-sm">
            © {new Date().getFullYear()} TourPie. {t('footer_rights')}
          </div>
        </div>
      </footer>
    </div>
  );
}

