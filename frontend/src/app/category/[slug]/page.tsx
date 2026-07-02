"use client";

import { useLanguage } from "@/context/LanguageContext";
import { api, Package } from "@/lib/api";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CategoryPage() {
  const params = useParams<{ slug?: string | string[] }>();
  const slugRaw = params?.slug;
  const slug = typeof slugRaw === "string" ? slugRaw : Array.isArray(slugRaw) ? slugRaw[0] : "";
  const { t, formatPackageMoney } = useLanguage();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryMap: Record<string, { title: string; subtitle: string; image: string }> = {
    countries: {
      title: t('section_countries'),
      subtitle: t('section_countries_subtitle'),
      image: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=2000"
    },
    cities: {
      title: t('section_cities'),
      subtitle: t('section_cities_subtitle'),
      image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=2000"
    },
    sightseeing: {
      title: t('section_sightseeing'),
      subtitle: t('section_sightseeing_subtitle'),
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2000"
    },
    nature: {
      title: t('cat_nature'),
      subtitle: t('section_countries_subtitle'), // Fallback subtitle
      image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2000"
    },
    adventure: {
      title: t('cat_adventure'),
      subtitle: t('section_countries_subtitle'), // Fallback subtitle
      image: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?q=80&w=2000"
    }
  };

  const currentCategory = categoryMap[slug] || {
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
    subtitle: t("category_default_subtitle"),
    image: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2000"
  };

  useEffect(() => {
    const fetchPackages = async () => {
      if (!slug) {
        setLoading(false);
        setPackages([]);
        return;
      }
      try {
        // Search by category
        const data = await api.packages.search(undefined, undefined, undefined, slug);
        setPackages(data);
      } catch (error) {
        console.error("Failed to fetch category packages:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, [slug]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Category Hero */}
      <section className="relative h-[400px] flex items-center justify-center text-white">
        <div className="absolute inset-0 bg-black/50 z-10" />
        <Image
          src={currentCategory.image}
          alt={currentCategory.title}
          fill
          className="object-cover"
          priority
        />
        <div className="relative z-20 text-center px-4">
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight drop-shadow-xl">
            {currentCategory.title}
          </h1>
          <p className="text-xl text-gray-100 max-w-2xl mx-auto drop-shadow-lg">
            {currentCategory.subtitle}
          </p>
        </div>
      </section>

      {/* Packages Grid */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">
            {loading ? t("category_loading_packages") : t("category_packages_available", { count: packages.length })}
          </h2>
          <Link href="/results" className="text-blue-600 font-bold hover:underline">
            {t("category_view_all_destinations")}
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl h-96 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : packages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {packages.map((pkg) => (
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
                <div className="p-8">
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
                    className="block w-full text-center bg-gray-900 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all duration-300"
                  >
                    {t('pkg_explore_details')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] py-20 text-center border border-dashed border-gray-200">
            <div className="text-6xl mb-6">🏝️</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{t("category_empty_title")}</h3>
            <p className="text-gray-500 mb-8">{t("category_empty_subtitle")}</p>
            <Link href="/" className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-100">
              {t("category_go_back_home")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
