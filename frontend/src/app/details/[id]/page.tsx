"use client";

import Image from "next/image";
import Link from "next/link";
import { api, getStoredToken, Review } from "@/lib/api";
import BookingForm from "@/components/BookingForm";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import { demoMarketplacePackageMap } from "@/lib/demoMarketplaceData";
import type { MarketplacePackage } from "@/lib/marketplace";
import { getPackageDisplayDescription, getPackageDisplayDestination, getPackageDisplayTitle } from "@/lib/marketplace";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function sanitizeImageSrc(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default function PackageDetailsPage() {
  const { t, language } = useLanguage();
  const { user: me } = useCurrentUser();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const seededPackage = id ? demoMarketplacePackageMap.get(Number(id)) : undefined;
  const resultsHref = useMemo(() => {
    if (seededPackage) return "/marketplace";
    try {
      const raw = sessionStorage.getItem("tourpie:last_results_query") || "";
      const q = raw && raw.startsWith("?") ? raw : raw ? `?${raw}` : "";
      return `/results${q}`;
    } catch {
      return "/results";
    }
  }, [seededPackage]);

  const [pkg, setPkg] = useState<MarketplacePackage | null>(seededPackage || null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [data, pkgReviews] = await Promise.all([
          api.packages.getOne(id),
          api.packages.getReviews(id),
        ]);
        setPkg(data);
        setReviews(pkgReviews);
        const token = getStoredToken();
        if (token) {
          try {
            const favs = await api.favorites.list();
            setFavorite(favs.some((f) => f.package_id === Number(id)));
          } catch {
            setFavorite(false);
          }
        } else {
          try {
            const raw = localStorage.getItem("favorites");
            const ids = raw ? (JSON.parse(raw) as number[]) : [];
            setFavorite(ids.includes(Number(id)));
          } catch {
            setFavorite(false);
          }
        }
      } catch {
        setPkg(seededPackage || null);
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchDetails();
  }, [id, seededPackage]);

  const displayPkg = useMemo(() => {
    if (!pkg) return null;
    const packageCoverImage = sanitizeImageSrc(pkg.image_url);
    const fallbackHighlights = [
      t("details_highlight_1"),
      t("details_highlight_2"),
      t("details_highlight_3"),
      t("details_highlight_4"),
      t("details_highlight_5"),
    ];
    const fallbackImages = [
      packageCoverImage || "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?q=80&w=2000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=2000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?q=80&w=2000&auto=format&fit=crop",
    ];

    const avg =
      reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length : null;
    const seededRating = typeof pkg.marketplace_rating === "number" ? pkg.marketplace_rating : null;
    const seededReviewCount = typeof pkg.marketplace_review_count === "number" ? pkg.marketplace_review_count : null;
    const seededServices = pkg.included_services?.length ? pkg.included_services : null;
    const displayTitle = getPackageDisplayTitle(pkg, language);
    const displayDescription = getPackageDisplayDescription(pkg, language);
    const displayDestination = getPackageDisplayDestination(pkg, language);
    const normalizedImages = (pkg.images || [])
      .map((image) => sanitizeImageSrc(image))
      .filter((image): image is string => Boolean(image));
    const galleryImages = Array.from(
      { length: 3 },
      (_, index) => normalizedImages[index] || fallbackImages[index] || fallbackImages[0]
    );
    const primaryImage = galleryImages[0] || fallbackImages[0];
    const secondaryImages = galleryImages.slice(1, 3).filter(Boolean);

    return {
      ...pkg,
      title: displayTitle,
      description: displayDescription,
      destination: displayDestination,
      rating: avg ? Number(avg.toFixed(1)) : seededRating || 4.8,
      reviews: reviews.length || seededReviewCount || 124,
      highlights: seededServices ? seededServices : pkg.highlights?.length ? pkg.highlights : fallbackHighlights,
      images: galleryImages,
      primaryImage,
      secondaryImages,
    };
  }, [language, pkg, reviews, t]);

  const getReviewIdentity = (review: Review) => {
    const resolved =
      me && me.id === review.user_id
        ? {
            id: me.id,
            full_name: me.full_name || review.user?.full_name || null,
            avatar_url: me.avatar_url ?? review.user?.avatar_url ?? null,
          }
        : review.user || null;
    return {
      name: resolved?.full_name || t("details_review_user"),
      avatarUrl: resolved?.avatar_url || null,
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {loading ? (
        <div className="py-20 text-center font-bold text-gray-500">{t("common_loading")}</div>
      ) : !displayPkg ? (
        <div className="py-20 text-center">
          <h1 className="text-2xl font-black mb-4 text-gray-900">{t("details_not_found_title")}</h1>
          <Link href="/" className="text-blue-600 hover:underline font-bold">
            {t("details_back_home")}
          </Link>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Content */}
        <div className="min-w-0 lg:col-span-2">
          <nav className="mb-8 flex flex-wrap text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600">{t("common_home")}</Link>
            <span className="mx-2">/</span>
            <Link href={resultsHref} className="hover:text-blue-600">{t("details_breadcrumb_packages")}</Link>
            <span className="mx-2">/</span>
            <span className="font-medium text-gray-900">{displayPkg.title}</span>
          </nav>

          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="min-w-0 break-words text-3xl font-extrabold text-gray-900 sm:text-4xl">{displayPkg.title}</h1>
            <button
              type="button"
              disabled={savingFavorite}
              onClick={() => {
                setSavingFavorite(true);
                void (async () => {
                  try {
                    const token = getStoredToken();
                    if (!token) {
                      const raw = localStorage.getItem("favorites");
                      const ids = raw ? (JSON.parse(raw) as number[]) : [];
                      const set = new Set(ids.filter((x) => typeof x === "number"));
                      if (set.has(displayPkg.id)) set.delete(displayPkg.id);
                      else set.add(displayPkg.id);
                      localStorage.setItem("favorites", JSON.stringify(Array.from(set)));
                      setFavorite(set.has(displayPkg.id));
                      return;
                    }
                    if (favorite) await api.favorites.remove(displayPkg.id);
                    else await api.favorites.add(displayPkg.id);
                    setFavorite(!favorite);
                  } finally {
                    setSavingFavorite(false);
                  }
                })();
              }}
              className={`w-full shrink-0 rounded-2xl border px-4 py-3 font-black transition-all sm:w-auto ${
                favorite ? "bg-red-50 text-red-600 border-red-100" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              } ${savingFavorite ? "opacity-60 cursor-not-allowed" : ""}`}
              aria-label={favorite ? t("results_fav_remove") : t("results_fav_add")}
            >
              <span className="inline-flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {favorite ? t("results_fav_remove") : t("results_fav_add")}
              </span>
            </button>
          </div>
          <div className="mb-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center text-yellow-400">
              {"★".repeat(5)}
              <span className="ml-2 text-gray-900 font-bold">{displayPkg.rating}</span>
            </div>
            <span className="text-gray-400">{t("details_reviews", { count: displayPkg.reviews })}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 font-medium">{displayPkg.destination}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 font-medium">{t("details_duration", { days: displayPkg.duration_days })}</span>
          </div>

          {/* Image Gallery */}
          <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 md:h-[500px]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl shadow-lg md:h-full md:aspect-auto">
              <Image
                src={displayPkg.primaryImage}
                alt={displayPkg.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="hidden h-full md:grid md:grid-rows-2 md:gap-4">
              {displayPkg.secondaryImages.map((imageSrc, index) => (
                <div key={`${imageSrc}-${index}`} className="relative h-full rounded-2xl overflow-hidden shadow-lg">
                  <Image src={imageSrc} alt={displayPkg.title} fill className="object-cover" sizes="25vw" />
                </div>
              ))}
            </div>
          </div>

          <div className="prose prose-lg max-w-none mb-12">
            <h2 className="text-2xl font-bold mb-4">{t("details_about")}</h2>
            <p className="text-gray-600 leading-relaxed">{displayPkg.description}</p>
          </div>

          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">{t("details_included")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayPkg.highlights.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {displayPkg.agency ? (
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-4">{t("details_agency")}</h2>
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <p className="text-lg font-extrabold text-gray-900">{displayPkg.agency.name}</p>
                {displayPkg.agency.description ? (
                  <p className="text-gray-600 mt-2">{displayPkg.agency.description}</p>
                ) : null}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {displayPkg.agency.website ? (
                    <a
                      href={displayPkg.agency.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 font-bold hover:underline"
                    >
                      {t("details_agency_website")}
                    </a>
                  ) : null}
                  {displayPkg.agency.contact_email ? (
                    <a
                      href={`mailto:${displayPkg.agency.contact_email}`}
                      className="text-gray-700 font-bold hover:underline"
                    >
                      {t("details_agency_contact")}
                    </a>
                  ) : null}
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    disabled={startingChat}
                    onClick={() => {
                      const token = getStoredToken();
                      if (!token) {
                        router.push("/login");
                        return;
                      }
                      setStartingChat(true);
                      void (async () => {
                        try {
                          const conv = await api.messages.createConversation(displayPkg.agency!.id, displayPkg.id);
                          router.push(`/dashboard/messages?conversation=${conv.id}`);
                        } catch {
                          return;
                        } finally {
                          setStartingChat(false);
                        }
                      })();
                    }}
                    className={`w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all duration-300 shadow-lg ${
                      startingChat ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    {t("support_live_chat")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {reviews.length > 0 ? (
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6">{t("details_reviews_section")}</h2>
              <div className="space-y-4">
                {reviews.slice(0, 3).map((r) => {
                  const identity = getReviewIdentity(r);
                  return (
                  <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {identity.avatarUrl ? (
                          <Image src={identity.avatarUrl} alt={identity.name} width={44} height={44} className="w-11 h-11 rounded-2xl object-cover" />
                        ) : (
                          <div className="w-11 h-11 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black shrink-0">
                            {identity.name.charAt(0)}
                          </div>
                        )}
                        <p className="font-bold text-gray-900">
                          {t("details_review_by", { name: identity.name })}
                        </p>
                      </div>
                      <p className="font-bold text-yellow-500">{r.rating}/5</p>
                    </div>
                    {r.comment ? <p className="text-gray-600 mt-3">{r.comment}</p> : null}
                  </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: Booking Card */}
        <div className="lg:col-span-1">
          <BookingForm pkg={displayPkg} />
        </div>
      </div>
      )}
    </div>
  );
}
