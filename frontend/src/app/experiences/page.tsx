"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { api, CommunityPost, CommunityPostKind, getStoredToken } from "@/lib/api";

function sanitizeImageSrc(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildImageUrl(prompt: string, imageSize: "landscape_16_9" | "portrait_4_3" = "landscape_16_9") {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${imageSize}`;
}

const EXPERIENCE_IMAGE_BLUR =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 10'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23dbeafe'/%3E%3Cstop offset='1' stop-color='%23e2e8f0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='16' height='10' rx='1.6' fill='url(%23g)'/%3E%3C/svg%3E";

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

type CategoryMeta = {
  id: string;
  label: string;
  hint: string;
  accentClass: string;
  panelClass: string;
  basePrice: number;
  minDays: number;
  maxDays: number;
  destinations: Array<{ city: string; country: string }>;
};

type ExperienceCard = {
  id: number;
  post: CommunityPost;
  title: string;
  summary: string;
  cover: string;
  categoryId: string;
  categoryLabel: string;
  city: string;
  country: string;
  price: number;
  durationDays: number;
  rating: number;
  reviews: number;
  score: number;
  createdAt: number;
  author: string;
  tags: string[];
};

function CategoryGlyph({ id }: { id: string }) {
  const common = "h-5 w-5";
  switch (id) {
    case "adventure":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 18L10.3 6.7a1 1 0 0 1 1.76.05L20 18H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 10.5 13.9 14h-3.8l1.9-3.5Z" fill="currentColor" />
        </svg>
      );
    case "nature":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M12 20c4.4 0 8-3.5 8-7.8C20 8.4 17.1 5 12 4c-5.1 1-8 4.4-8 8.2C4 16.5 7.6 20 12 20Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v8M12 12c-1.6-.2-2.7-1-3.6-2.3M12 13c1.6-.2 2.7-1 3.6-2.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "culture":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M5 18h14M6.5 18V9.5M10.5 18V9.5M14.5 18V9.5M18 18V9.5M4 9.5 12 5l8 4.5H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "food":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M8 4v7M6 4v7M10 4v7M8 11v9M16 4c1.7 1.8 2.4 4 2.1 6.4-.2 1.5-.8 2.6-2.1 3.1V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "luxury":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.5L12 16.8 7.2 19l.9-5.5-3.9-3.8 5.4-.8L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "family":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4.5 19c.5-3 2.4-4.5 5.5-4.5S15 16 15.5 19M13.5 19c.3-2.2 1.7-3.4 4-3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "photography":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <rect x="4" y="7" width="16" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 7 10.2 5h3.6L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "beach":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M4 17c2.5 0 2.5-1 5-1s2.5 1 5 1 2.5-1 5-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 16V8M12 8c-2.2 0-3.8 1.2-4.7 3.2M12 8c2.2 0 3.8 1.2 4.7 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden="true">
          <path d="M5 18c2.7-4 6.4-6 11-6h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="m14 7 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-[150px] flex-1 flex-col gap-2">
      <span className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[1.35rem] border border-white/80 bg-white/88 px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.06)] outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ExperiencesPage() {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [budgetFilter, setBudgetFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sortBy, setSortBy] = useState("trending");
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const skipRef = useRef(0);
  const limit = 12;
  const kind: CommunityPostKind = "story";

  const [showComposer, setShowComposer] = useState(false);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [composerImages, setComposerImages] = useState<string[]>([]);
  const [composerCategory, setComposerCategory] = useState<string>("adventure");
  const [composerCategoryQuery, setComposerCategoryQuery] = useState("");
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const isLoggedIn = useMemo(() => Boolean(getStoredToken()), []);

  const placeholderCover = useMemo(
    () =>
      buildImageUrl(
        "premium luxury travel experience, cinematic golden hour coastal viewpoint, elegant travelers, refined composition, realistic photography, soft blue and warm sunset palette",
        "landscape_16_9"
      ),
    []
  );

  const heroVisuals = useMemo(
    () => [
      buildImageUrl(
        "premium travel inspiration, cliffside infinity view over mediterranean sea, cinematic light, refined luxury atmosphere, realistic editorial photography",
        "portrait_4_3"
      ),
      buildImageUrl(
        "luxury cultural city escape, elegant traveler in historic old town street with warm lanterns, cinematic realism, premium tourism editorial",
        "portrait_4_3"
      ),
      buildImageUrl(
        "mountain adventure travel experience, alpine lake, golden sunrise, premium tourism campaign photography, realistic details",
        "portrait_4_3"
      ),
    ],
    []
  );

  const categories = useMemo<CategoryMeta[]>(
    () => [
      {
        id: "all",
        label: t("exp_cat_all"),
        hint: t("exp_categories_subtitle"),
        accentClass: "from-slate-600/15 via-white to-slate-100",
        panelClass: "text-slate-700",
        basePrice: 180,
        minDays: 2,
        maxDays: 6,
        destinations: [{ city: "Baku", country: "Azerbaijan" }],
      },
      {
        id: "adventure",
        label: t("exp_cat_adventure"),
        hint: t("exp_category_hint_adventure"),
        accentClass: "from-orange-500/15 via-white to-amber-100",
        panelClass: "text-orange-700",
        basePrice: 220,
        minDays: 2,
        maxDays: 6,
        destinations: [
          { city: "Interlaken", country: "Switzerland" },
          { city: "Queenstown", country: "New Zealand" },
          { city: "Cappadocia", country: "Turkey" },
        ],
      },
      {
        id: "nature",
        label: t("exp_cat_nature"),
        hint: t("exp_category_hint_nature"),
        accentClass: "from-emerald-500/15 via-white to-emerald-100",
        panelClass: "text-emerald-700",
        basePrice: 170,
        minDays: 2,
        maxDays: 5,
        destinations: [
          { city: "Hallstatt", country: "Austria" },
          { city: "Banff", country: "Canada" },
          { city: "Gudauri", country: "Georgia" },
        ],
      },
      {
        id: "culture",
        label: t("exp_cat_culture"),
        hint: t("exp_category_hint_culture"),
        accentClass: "from-violet-500/15 via-white to-fuchsia-100",
        panelClass: "text-violet-700",
        basePrice: 190,
        minDays: 2,
        maxDays: 4,
        destinations: [
          { city: "Istanbul", country: "Turkey" },
          { city: "Florence", country: "Italy" },
          { city: "Kyoto", country: "Japan" },
        ],
      },
      {
        id: "food",
        label: t("exp_cat_food"),
        hint: t("exp_category_hint_food"),
        accentClass: "from-rose-500/15 via-white to-orange-100",
        panelClass: "text-rose-700",
        basePrice: 160,
        minDays: 1,
        maxDays: 3,
        destinations: [
          { city: "Bologna", country: "Italy" },
          { city: "Gaziantep", country: "Turkey" },
          { city: "Tbilisi", country: "Georgia" },
        ],
      },
      {
        id: "luxury",
        label: t("exp_cat_luxury"),
        hint: t("exp_category_hint_luxury"),
        accentClass: "from-sky-500/15 via-white to-indigo-100",
        panelClass: "text-sky-700",
        basePrice: 420,
        minDays: 3,
        maxDays: 6,
        destinations: [
          { city: "Lake Como", country: "Italy" },
          { city: "Dubai", country: "UAE" },
          { city: "Bodrum", country: "Turkey" },
        ],
      },
      {
        id: "family",
        label: t("exp_cat_family"),
        hint: t("exp_category_hint_family"),
        accentClass: "from-cyan-500/15 via-white to-blue-100",
        panelClass: "text-cyan-700",
        basePrice: 210,
        minDays: 2,
        maxDays: 5,
        destinations: [
          { city: "Antalya", country: "Turkey" },
          { city: "Barcelona", country: "Spain" },
          { city: "Baku", country: "Azerbaijan" },
        ],
      },
      {
        id: "photography",
        label: t("exp_cat_photography"),
        hint: t("exp_category_hint_photography"),
        accentClass: "from-indigo-500/15 via-white to-sky-100",
        panelClass: "text-indigo-700",
        basePrice: 230,
        minDays: 2,
        maxDays: 4,
        destinations: [
          { city: "Santorini", country: "Greece" },
          { city: "Zermatt", country: "Switzerland" },
          { city: "Kotor", country: "Montenegro" },
        ],
      },
      {
        id: "beach",
        label: t("exp_cat_beach"),
        hint: t("exp_category_hint_beach"),
        accentClass: "from-blue-500/15 via-white to-cyan-100",
        panelClass: "text-blue-700",
        basePrice: 240,
        minDays: 2,
        maxDays: 5,
        destinations: [
          { city: "Kas", country: "Turkey" },
          { city: "Maldives", country: "Maldives" },
          { city: "Budva", country: "Montenegro" },
        ],
      },
      {
        id: "wellness",
        label: t("exp_cat_wellness"),
        hint: t("exp_category_hint_wellness"),
        accentClass: "from-teal-500/15 via-white to-emerald-100",
        panelClass: "text-teal-700",
        basePrice: 260,
        minDays: 2,
        maxDays: 4,
        destinations: [
          { city: "Bali", country: "Indonesia" },
          { city: "Sapanca", country: "Turkey" },
          { city: "Abu Dhabi", country: "UAE" },
        ],
      },
    ],
    [t]
  );

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const catLabel = useMemo(() => (id: string) => categoriesById.get(id)?.label || id, [categoriesById]);

  const demoPosts = useMemo<CommunityPost[]>(
    () =>
      categories
        .filter((category) => category.id !== "all")
        .slice(0, 8)
        .map((category, index) => {
          const destination = category.destinations[index % category.destinations.length];
          const title = `${category.label} · ${destination.city}`;
          return {
            id: -(index + 1),
            user_id: 0,
            title,
            body: `${category.hint} ${t("exp_hero_subtitle")}`,
            tag: category.id,
            kind,
            image_url: buildImageUrl(
              `premium ${category.label} travel experience in ${destination.city}, ${destination.country}, cinematic editorial tourism photography, refined composition, realistic lighting`,
              "landscape_16_9"
            ),
            images: null,
            likes_count: 32 + index * 7,
            comments_count: 6 + index * 3,
            shares_count: 4 + index * 2,
            created_at: new Date(Date.now() - index * 86400000).toISOString(),
            updated_at: new Date(Date.now() - index * 86400000).toISOString(),
            user: { id: 0, full_name: "TourPie" },
            liked: false,
            bookmarked: false,
          };
        }),
    [categories, kind, t]
  );

  const tag = activeCategory === "all" ? undefined : activeCategory;
  const tab = savedOnly ? "saved" : "latest";

  const load = useCallback(
    async (mode: "reset" | "more") => {
      if (tab === "saved" && !getStoredToken()) {
        setLoading(false);
        setLoadingMore(false);
        setError(null);
        setItems([]);
        setHasMore(false);
        return;
      }

      try {
        setError(null);
        if (mode === "reset") {
          setLoading(true);
          skipRef.current = 0;
        } else {
          setLoadingMore(true);
        }

        const nextSkip = mode === "reset" ? 0 : skipRef.current;
        const rows = await api.community.listPosts({ skip: nextSkip, limit, tag, kind, tab });
        setItems((prev) => (mode === "reset" ? rows : [...prev, ...rows]));
        setUsingFallbackData(false);
        setHasMore(rows.length === limit);
        skipRef.current = nextSkip + rows.length;
      } catch {
        if (mode === "reset") {
          setItems(demoPosts);
          setUsingFallbackData(true);
          skipRef.current = demoPosts.length;
        }
        setError(null);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [demoPosts, kind, limit, tab, tag]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load("reset");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const toggleLike = async (postId: number) => {
    if (usingFallbackData || postId < 0) {
      setItems((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, liked: !post.liked, likes_count: Math.max(0, post.likes_count + (post.liked ? -1 : 1)) }
            : post
        )
      );
      return;
    }
    try {
      const updated = await api.community.toggleLike(postId);
      setItems((prev) => prev.map((post) => (post.id === postId ? { ...post, likes_count: updated.likes_count, liked: updated.liked } : post)));
    } catch {
      alert(t("community_post_failed"));
    }
  };

  const toggleBookmark = async (postId: number) => {
    if (usingFallbackData || postId < 0) {
      setItems((prev) => prev.map((post) => (post.id === postId ? { ...post, bookmarked: !post.bookmarked } : post)));
      return;
    }
    try {
      const updated = await api.community.toggleBookmark(postId);
      setItems((prev) => prev.map((post) => (post.id === postId ? { ...post, bookmarked: updated.bookmarked } : post)));
    } catch {
      alert(t("community_post_failed"));
    }
  };

  const share = async (postId: number) => {
    const url = `${window.location.origin}${postId > 0 ? `/community/posts/${postId}` : "/experiences"}`;
    const title = t("exp_share_experience");
    try {
      if (typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function") {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert(t("common_copy_link"));
      }
      if (!usingFallbackData && postId > 0) {
        await api.community.share(postId).catch(() => null);
      }
    } catch {
      alert(t("common_copy_link"));
    }
  };

  const addImagesFromFiles = async (files: FileList | null) => {
    if (!files) return;
    const maxFiles = 6;
    const room = Math.max(0, maxFiles - composerImages.length);
    const slice = Array.from(files).slice(0, room);
    const reads = await Promise.all(
      slice.map(
        (file) =>
          new Promise<string | null>((resolve) => {
            if (file.size > 5 * 1024 * 1024) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          })
      )
    );
    setComposerImages((prev) => [...prev, ...reads.filter((value): value is string => Boolean(value))]);
  };

  const submitExperience = async () => {
    const title = composerTitle.trim();
    const body = composerBody.trim();
    const category = composerCategory.trim();
    if (!title || !body || !category) return;
    try {
      setComposerSaving(true);
      setComposerError(null);
      const created = await api.community.createPost({
        title,
        body,
        kind,
        tag: category,
        images: composerImages.length ? composerImages : null,
      });
      setItems((prev) => [created, ...prev]);
      setShowComposer(false);
      setComposerTitle("");
      setComposerBody("");
      setComposerImages([]);
      setComposerCategoryQuery("");
    } catch {
      setComposerError(t("community_post_failed"));
    } finally {
      setComposerSaving(false);
    }
  };

  const allExperiences = useMemo<ExperienceCard[]>(() => {
    return items.map((post, index) => {
      const categoryId = post.tag && categoriesById.has(post.tag) ? post.tag : "adventure";
      const category = categoriesById.get(categoryId) || categories[1];
      const seed = hashSeed(`${post.id}-${post.title}-${categoryId}`);
      const destination = category.destinations[seed % category.destinations.length];
      const cover =
        sanitizeImageSrc(post.image_url) ||
        (Array.isArray(post.images) ? post.images.map((image) => sanitizeImageSrc(image)).find(Boolean) : null) ||
        placeholderCover;
      const durationDays = category.minDays + (seed % Math.max(1, category.maxDays - category.minDays + 1));
      const rating = Number((4.2 + ((seed % 7) * 0.1)).toFixed(1));
      const reviews = Math.max(24, post.likes_count * 4 + post.comments_count * 3 + 18);
      const price = category.basePrice + (seed % 7) * 35;
      const score = post.likes_count * 5 + post.comments_count * 7 + post.shares_count * 9 + (post.bookmarked ? 30 : 0) + Math.round(rating * 10);
      const summary = post.body.replace(/\s+/g, " ").trim();
      return {
        id: post.id,
        post,
        title: post.title,
        summary,
        cover,
        categoryId,
        categoryLabel: catLabel(categoryId),
        city: destination.city,
        country: destination.country,
        price,
        durationDays,
        rating,
        reviews,
        score,
        createdAt: Number(new Date(post.created_at)) || index,
        author: post.user?.full_name || t("common_anonymous"),
        tags: [catLabel(categoryId), destination.country, destination.city],
      };
    });
  }, [catLabel, categories, categoriesById, items, placeholderCover, t]);

  const countryOptions = useMemo(
    () => ["all", ...Array.from(new Set(allExperiences.map((item) => item.country))).sort((left, right) => left.localeCompare(right))],
    [allExperiences]
  );

  const cityOptions = useMemo(() => {
    const source = countryFilter === "all" ? allExperiences : allExperiences.filter((item) => item.country === countryFilter);
    return ["all", ...Array.from(new Set(source.map((item) => item.city))).sort((left, right) => left.localeCompare(right))];
  }, [allExperiences, countryFilter]);

  const filteredExperiences = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const next = allExperiences.filter((item) => {
      if (activeCategory !== "all" && item.categoryId !== activeCategory) return false;
      if (countryFilter !== "all" && item.country !== countryFilter) return false;
      if (cityFilter !== "all" && item.city !== cityFilter) return false;
      if (budgetFilter === "under150" && item.price >= 150) return false;
      if (budgetFilter === "150to300" && (item.price < 150 || item.price > 300)) return false;
      if (budgetFilter === "300to500" && (item.price < 300 || item.price > 500)) return false;
      if (budgetFilter === "500plus" && item.price < 500) return false;
      if (durationFilter === "quick" && item.durationDays > 2) return false;
      if (durationFilter === "medium" && (item.durationDays < 3 || item.durationDays > 4)) return false;
      if (durationFilter === "long" && item.durationDays < 5) return false;
      if (ratingFilter === "4.3" && item.rating < 4.3) return false;
      if (ratingFilter === "4.5" && item.rating < 4.5) return false;
      if (ratingFilter === "4.7" && item.rating < 4.7) return false;
      if (!query) return true;

      const haystack = `${item.title} ${item.summary} ${item.city} ${item.country} ${item.categoryLabel} ${item.author}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...next];
    if (sortBy === "latest") {
      sorted.sort((left, right) => right.createdAt - left.createdAt);
    } else if (sortBy === "price_low") {
      sorted.sort((left, right) => left.price - right.price);
    } else if (sortBy === "price_high") {
      sorted.sort((left, right) => right.price - left.price);
    } else if (sortBy === "rating") {
      sorted.sort((left, right) => right.rating - left.rating || right.reviews - left.reviews);
    } else {
      sorted.sort((left, right) => right.score - left.score);
    }
    return sorted;
  }, [activeCategory, allExperiences, budgetFilter, cityFilter, countryFilter, durationFilter, ratingFilter, searchQuery, sortBy]);

  const featuredExperiences = filteredExperiences.slice(0, 3);
  const trendingExperiences = filteredExperiences.slice(3, 9);
  const recommendedExperiences = (filteredExperiences.slice(0, 6).length ? filteredExperiences.slice(0, 6) : allExperiences.slice(0, 6)).slice(0, 3);
  const storyExperiences = filteredExperiences.slice(0, 6);
  const heroCards = (featuredExperiences.length ? featuredExperiences : allExperiences.slice(0, 3)).slice(0, 3);

  const popularCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allExperiences) {
      counts.set(item.categoryId, (counts.get(item.categoryId) || 0) + 1);
    }

    return categories
      .filter((category) => category.id !== "all")
      .map((category) => ({
        ...category,
        count: counts.get(category.id) || 0,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8);
  }, [allExperiences, categories]);

  const resetFilters = () => {
    setSearchQuery("");
    setCountryFilter("all");
    setCityFilter("all");
    setBudgetFilter("all");
    setDurationFilter("all");
    setRatingFilter("all");
    setSortBy("trending");
    setActiveCategory("all");
  };

  const spotlightExperience = featuredExperiences[0] || filteredExperiences[0] || allExperiences[0];
  const supportingFeatured = (featuredExperiences.slice(1, 3).length ? featuredExperiences.slice(1, 3) : filteredExperiences.slice(1, 3)).slice(0, 2);
  const trendingShowcase = (trendingExperiences.length ? trendingExperiences : filteredExperiences.slice(0, 6)).slice(0, 6);
  const totalCountries = Math.max(0, countryOptions.length - 1);
  const surfaceClass =
    "overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/76 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl";
  const elevatedCardClass =
    "group overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_18px_46px_rgba(15,23,42,0.08)] motion-safe:transition-all motion-safe:duration-500 motion-safe:hover:-translate-y-1.5 motion-safe:hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]";
  const hoverImageClass = "object-cover bg-slate-200 motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.04]";

  return (
    <div className="tp-page-shell">
      <div className="relative z-[1] mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
        <section className="relative overflow-hidden rounded-[2.9rem] border border-white/70 bg-white/78 px-6 py-6 shadow-[0_32px_90px_rgba(15,23,42,0.10)] backdrop-blur-xl md:px-8 md:py-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,216,255,0.28),_transparent_26%),radial-gradient(circle_at_88%_18%,_rgba(255,106,26,0.18),_transparent_20%),linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(243,247,255,0.88))]" />
          <div className="absolute -left-14 top-6 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-orange-200/30 blur-3xl" />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.04fr)_minmax(340px,0.96fr)] xl:items-start">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/76 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-blue-900 shadow-[0_12px_32px_rgba(59,130,246,0.12)]">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {t("exp_badge")}
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[0.92] tracking-[-0.055em] text-slate-950 md:text-5xl xl:text-6xl">
                {t("exp_hero_title")}
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-600 md:text-lg">
                {t("exp_hero_subtitle")}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.75rem] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{t("exp_trending_title")}</div>
                  <div className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{trendingShowcase.length}</div>
                </div>
                <div className="rounded-[1.75rem] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{t("exp_recommended_title")}</div>
                  <div className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{recommendedExperiences.length}</div>
                </div>
                <div className="rounded-[1.75rem] border border-white/80 bg-white/72 px-4 py-4 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{t("exp_filter_country")}</div>
                  <div className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{totalCountries}</div>
                </div>
              </div>

              <div className="mt-8 rounded-[2rem] border border-white/80 bg-white/86 p-4 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-3 lg:flex-row">
                  <div className="flex min-h-14 flex-1 items-center gap-3 rounded-[1.5rem] border border-slate-100 bg-slate-50/85 px-4 py-3">
                    <span className="text-lg text-slate-400">⌕</span>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={t("exp_search_placeholder")}
                      className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerError(null);
                      setComposerCategory(activeCategory === "all" ? "adventure" : activeCategory);
                      setComposerCategoryQuery("");
                      setShowComposer(true);
                    }}
                    className="min-h-14 rounded-[1.5rem] bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)] transition hover:bg-blue-600"
                  >
                    {t("exp_share_experience")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSavedOnly((value) => !value)}
                    className={`min-h-14 rounded-[1.5rem] px-5 py-3 text-sm font-black transition ${
                      savedOnly
                        ? "bg-blue-600 text-white shadow-[0_16px_36px_rgba(59,130,246,0.26)]"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {savedOnly ? t("exp_showing_saved") : t("exp_saved_only")}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <Link
                href={spotlightExperience && spotlightExperience.id > 0 ? `/community/posts/${spotlightExperience.id}` : "/experiences"}
                prefetch={false}
                className="group relative min-h-[420px] overflow-hidden rounded-[2.35rem] border border-white/80 bg-slate-200 shadow-[0_28px_70px_rgba(15,23,42,0.14)] motion-safe:transition-all motion-safe:duration-500 motion-safe:hover:-translate-y-1.5 motion-safe:hover:shadow-[0_34px_82px_rgba(15,23,42,0.16)]"
              >
                <Image
                  src={spotlightExperience?.cover || heroVisuals[0]}
                  alt={spotlightExperience?.title || t("exp_hero_title")}
                  fill
                  className={hoverImageClass}
                  sizes="(max-width: 1279px) 100vw, 560px"
                  placeholder="blur"
                  blurDataURL={EXPERIENCE_IMAGE_BLUR}
                  priority
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.1),rgba(15,23,42,0.7))]" />
                <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 p-5 text-white">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] backdrop-blur-md">
                    <span>{spotlightExperience?.country || "TourPie"}</span>
                    <span className="text-white/40">•</span>
                    <span>{spotlightExperience?.city || t("exp_badge")}</span>
                  </div>
                  <div className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-black backdrop-blur-md">
                    {t("exp_card_from")} ${spotlightExperience?.price || 0}
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <div className="max-w-xl text-3xl font-black tracking-[-0.04em] md:text-4xl">
                    {spotlightExperience?.title || t("exp_featured_title")}
                  </div>
                  <p className="mt-3 max-w-lg text-sm font-medium leading-6 text-white/82">
                    {spotlightExperience?.summary || t("exp_featured_subtitle")}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-black backdrop-blur-md">
                      ★ {spotlightExperience?.rating || "4.8"}
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-black backdrop-blur-md">
                      {t("exp_card_days", { count: spotlightExperience?.durationDays || 3 })}
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-black backdrop-blur-md">
                      {t("exp_card_reviews", { count: spotlightExperience?.reviews || 0 })}
                    </span>
                  </div>
                </div>
              </Link>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {supportingFeatured.map((item, index) => (
                  <Link
                    key={item.id}
                    href={item.id > 0 ? `/community/posts/${item.id}` : "/experiences"}
                    prefetch={false}
                    className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-slate-200 shadow-[0_22px_52px_rgba(15,23,42,0.12)] motion-safe:transition-all motion-safe:duration-500 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_28px_60px_rgba(15,23,42,0.14)]"
                  >
                    <div className="relative aspect-[16/10] sm:aspect-[4/5]">
                      <Image
                        src={item.cover || heroVisuals[index + 1]}
                        alt={item.title}
                        fill
                        className={hoverImageClass}
                        sizes="(max-width: 1024px) 50vw, 280px"
                        placeholder="blur"
                        blurDataURL={EXPERIENCE_IMAGE_BLUR}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.62))]" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <div className="text-xs font-black uppercase tracking-[0.24em] text-white/74">{item.categoryLabel}</div>
                        <div className="mt-2 text-xl font-black leading-tight">{item.title}</div>
                        <div className="mt-3 flex items-center gap-3 text-sm font-semibold text-white/84">
                          <span>{item.city}</span>
                          <span className="text-white/35">•</span>
                          <span>★ {item.rating}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="z-20 rounded-[2.15rem] border border-white/70 bg-white/78 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl xl:sticky xl:top-20">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t("exp_categories_title")}</div>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 md:text-3xl">{t("exp_categories_title")}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{t("exp_categories_subtitle")}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-sm font-black text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {filteredExperiences.length}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                    activeCategory === category.id
                      ? "bg-blue-600 text-white shadow-[0_16px_36px_rgba(59,130,246,0.24)]"
                      : "border border-white/90 bg-white/88 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {category.id !== "all" ? <CategoryGlyph id={category.id} /> : <span className="text-lg leading-none">•</span>}
                  {category.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <FilterSelect
                label={t("exp_filter_country")}
                value={countryFilter}
                onChange={(value) => {
                  setCountryFilter(value);
                  setCityFilter("all");
                }}
                options={countryOptions.map((option) => ({
                  value: option,
                  label: option === "all" ? t("exp_filter_all") : option,
                }))}
              />
              <FilterSelect
                label={t("exp_filter_city")}
                value={cityFilter}
                onChange={setCityFilter}
                options={cityOptions.map((option) => ({
                  value: option,
                  label: option === "all" ? t("exp_filter_all") : option,
                }))}
              />
              <FilterSelect
                label={t("exp_filter_budget")}
                value={budgetFilter}
                onChange={setBudgetFilter}
                options={[
                  { value: "all", label: t("exp_filter_all") },
                  { value: "under150", label: "< $150" },
                  { value: "150to300", label: "$150 - $300" },
                  { value: "300to500", label: "$300 - $500" },
                  { value: "500plus", label: "$500+" },
                ]}
              />
              <FilterSelect
                label={t("exp_filter_duration")}
                value={durationFilter}
                onChange={setDurationFilter}
                options={[
                  { value: "all", label: t("exp_filter_all") },
                  { value: "quick", label: "1 - 2 days" },
                  { value: "medium", label: "3 - 4 days" },
                  { value: "long", label: "5+ days" },
                ]}
              />
              <FilterSelect
                label={t("exp_filter_rating")}
                value={ratingFilter}
                onChange={setRatingFilter}
                options={[
                  { value: "all", label: t("exp_filter_all") },
                  { value: "4.3", label: "4.3+" },
                  { value: "4.5", label: "4.5+" },
                  { value: "4.7", label: "4.7+" },
                ]}
              />
              <FilterSelect
                label={t("exp_filter_sort")}
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "trending", label: t("exp_sort_trending") },
                  { value: "latest", label: t("exp_sort_latest") },
                  { value: "price_low", label: t("exp_sort_price_low") },
                  { value: "price_high", label: t("exp_sort_price_high") },
                  { value: "rating", label: t("exp_sort_rating") },
                ]}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                {t("exp_reset_filters")}
              </button>
            </div>
          </div>
        </section>

        {loading && items.length === 0 ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-[360px] animate-pulse rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_18px_46px_rgba(15,23,42,0.06)]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[2.25rem] border border-white/70 bg-white/80 p-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="text-2xl font-black text-slate-900">{error}</div>
            <button
              type="button"
              onClick={() => void load("reset")}
              className="mt-6 rounded-[1.25rem] bg-slate-950 px-6 py-3 font-black text-white transition hover:bg-blue-600"
            >
              {t("common_try_again")}
            </button>
          </div>
        ) : filteredExperiences.length === 0 ? (
          <div className="rounded-[2.5rem] border border-white/70 bg-white/80 p-12 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[radial-gradient(circle,_rgba(168,216,255,0.45),_rgba(255,255,255,0.9))] text-3xl text-slate-700 shadow-[0_18px_40px_rgba(59,130,246,0.12)]">
              ✦
            </div>
            <div className="mt-6 text-3xl font-black tracking-[-0.03em] text-slate-950">{t("exp_empty_title")}</div>
            <p className="mx-auto mt-3 max-w-xl text-base font-medium leading-7 text-slate-600">{t("exp_empty_subtitle")}</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 rounded-[1.25rem] border border-slate-200 bg-white px-6 py-3 font-black text-slate-700 transition hover:bg-slate-50"
            >
              {t("exp_reset_filters")}
            </button>
          </div>
        ) : (
          <>
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
              <div className={`${surfaceClass} p-6`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t("exp_featured_title")}</div>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{t("exp_featured_title")}</h2>
                    <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-600">{t("exp_featured_subtitle")}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {featuredExperiences.map((item, index) => (
                    <article key={item.id} className={`${elevatedCardClass} ${index === 0 ? "lg:col-span-2" : ""}`}>
                      <div className={`relative overflow-hidden ${index === 0 ? "aspect-[16/9]" : "aspect-[16/10] sm:aspect-[4/5]"}`}>
                        <Image
                          src={item.cover}
                          alt={item.title}
                          fill
                          className={hoverImageClass}
                          sizes={index === 0 ? "(max-width: 1024px) 100vw, 900px" : "(max-width: 1024px) 50vw, 420px"}
                          placeholder="blur"
                          blurDataURL={EXPERIENCE_IMAGE_BLUR}
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.68))]" />
                        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-5">
                          <div className="rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white backdrop-blur-md">
                            {t("exp_card_from")} ${item.price}
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleBookmark(item.id)}
                            className={`rounded-full border px-3 py-2 text-sm font-black backdrop-blur-md transition ${
                              item.post.bookmarked
                                ? "border-blue-500 bg-blue-600 text-white"
                                : "border-white/25 bg-slate-950/40 text-white hover:bg-slate-950/55"
                            }`}
                          >
                            {item.post.bookmarked ? t("community_saved") : t("community_save")}
                          </button>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/78">
                            <span>{item.country}</span>
                            <span className="text-white/40">•</span>
                            <span>{item.city}</span>
                          </div>
                          <div className="mt-2 text-2xl font-black tracking-[-0.03em]">{item.title}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black backdrop-blur-md">★ {item.rating}</span>
                            <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-black backdrop-blur-md">
                              {t("exp_card_days", { count: item.durationDays })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 p-6">
                        <div className="flex flex-wrap gap-2">
                          {item.tags.map((tagValue) => (
                            <span key={tagValue} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                              {tagValue}
                            </span>
                          ))}
                        </div>
                        <p className="line-clamp-3 text-sm font-medium leading-6 text-slate-600">{item.summary}</p>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-500">
                            {item.rating} · {t("exp_card_reviews", { count: item.reviews })}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void share(item.id)}
                              className="rounded-[1rem] border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                            >
                              {t("exp_share")}
                            </button>
                            <Link
                              href={item.id > 0 ? `/community/posts/${item.id}` : "/experiences"}
                              prefetch={false}
                              className="rounded-[1rem] bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600"
                            >
                              {t("exp_read_full")}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className={`${surfaceClass} p-6`}>
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t("exp_categories_title")}</div>
                  <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-950">{t("exp_categories_title")}</h2>
                  <p className="text-sm font-medium leading-6 text-slate-600">{t("exp_categories_subtitle")}</p>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {popularCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`rounded-[1.75rem] border border-white/80 bg-gradient-to-br ${category.accentClass} p-4 text-left shadow-[0_18px_46px_rgba(15,23,42,0.08)] motion-safe:transition-all motion-safe:duration-500 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_28px_66px_rgba(15,23,42,0.12)]`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ${category.panelClass}`}>
                            <CategoryGlyph id={category.id} />
                          </div>
                          <div className="mt-4 text-base font-black text-slate-900">{category.label}</div>
                        </div>
                        <div className="rounded-full bg-white/75 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-600">
                          {category.count}
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{category.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className={`${surfaceClass} p-6`}>
              <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t("exp_trending_title")}</div>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{t("exp_trending_title")}</h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{t("exp_trending_subtitle")}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {trendingShowcase.map((item) => (
                    <article key={item.id} className={elevatedCardClass}>
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <Image
                          src={item.cover}
                          alt={item.title}
                          fill
                          className={hoverImageClass}
                          sizes="(max-width: 1024px) 50vw, 360px"
                          placeholder="blur"
                          blurDataURL={EXPERIENCE_IMAGE_BLUR}
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.58))]" />
                        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                          <div className="text-xs font-black uppercase tracking-[0.22em] text-white/72">{item.categoryLabel}</div>
                          <div className="mt-2 text-xl font-black leading-tight">{item.title}</div>
                          <div className="mt-3 flex items-center gap-3 text-sm font-semibold text-white/86">
                            <span>★ {item.rating}</span>
                            <span className="text-white/35">•</span>
                            <span>{t("exp_card_days", { count: item.durationDays })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">{item.city}</div>
                            <div className="text-sm font-medium text-slate-500">{item.country}</div>
                          </div>
                          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                            {t("exp_card_from")} ${item.price}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className={surfaceClass}>
              <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                      {isLoggedIn ? t("exp_recommended_title") : t("exp_recommended_title_guest")}
                    </div>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">
                      {isLoggedIn ? t("exp_recommended_title") : t("exp_recommended_title_guest")}
                    </h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{t("exp_recommended_subtitle")}</p>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {recommendedExperiences.map((item) => (
                    <article key={item.id} className={elevatedCardClass}>
                      <div className="relative aspect-[16/11] overflow-hidden">
                        <Image
                          src={item.cover}
                          alt={item.title}
                          fill
                          className={hoverImageClass}
                          sizes="(max-width: 1024px) 100vw, 420px"
                          placeholder="blur"
                          blurDataURL={EXPERIENCE_IMAGE_BLUR}
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.50))]" />
                        <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-slate-950/40 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white backdrop-blur-md">
                          {item.categoryLabel}
                        </div>
                      </div>
                      <div className="space-y-4 p-5">
                        <div>
                          <div className="text-sm font-semibold text-slate-500">
                            {item.city}, {item.country}
                          </div>
                          <div className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">{item.title}</div>
                        </div>
                        <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-600">{item.summary}</p>
                        <div className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-500">
                          <span>★ {item.rating}</span>
                          <span>
                            {t("exp_card_from")} ${item.price}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className={`${surfaceClass} p-6`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t("exp_stories_title")}</div>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{t("exp_stories_title")}</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{t("exp_stories_subtitle")}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {storyExperiences.map((item) => (
                  <article key={item.id} className={elevatedCardClass}>
                    <div className="relative aspect-[16/11] overflow-hidden">
                      <Image
                        src={item.cover}
                        alt={item.title}
                        fill
                        className={hoverImageClass}
                        sizes="(max-width: 1024px) 100vw, 420px"
                        placeholder="blur"
                        blurDataURL={EXPERIENCE_IMAGE_BLUR}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.52))]" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <div className="text-xs font-black uppercase tracking-[0.22em] text-white/75">{item.author}</div>
                        <div className="mt-2 text-xl font-black leading-tight">{item.title}</div>
                      </div>
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tagValue) => (
                          <span key={tagValue} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                            {tagValue}
                          </span>
                        ))}
                      </div>
                      <p className="line-clamp-3 text-sm font-medium leading-6 text-slate-600">{item.summary}</p>
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-500">
                        <span>{item.city}, {item.country}</span>
                        <span>{item.rating} ★</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleLike(item.id)}
                          className={`rounded-[1rem] px-4 py-2 text-sm font-black transition ${
                            item.post.liked ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          ♥ {item.post.likes_count}
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleBookmark(item.id)}
                          className={`rounded-[1rem] px-4 py-2 text-sm font-black transition ${
                            item.post.bookmarked ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {item.post.bookmarked ? t("community_saved") : t("community_save")}
                        </button>
                        <Link
                          href={item.id > 0 ? `/community/posts/${item.id}` : "/experiences"}
                          prefetch={false}
                          className="rounded-[1rem] bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600"
                        >
                          {t("community_open")}
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {hasMore ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void load("more")}
                  className={`mt-6 w-full rounded-[1.5rem] py-4 font-black transition ${
                    loadingMore
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {loadingMore ? t("common_loading") : t("common_load_more")}
                </button>
              ) : null}
            </section>
          </>
        )}

        {showComposer ? (
          <div className="tp-motion-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
            <div className="tp-motion-modal-panel w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/70 bg-white shadow-[0_36px_90px_rgba(15,23,42,0.18)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-8 py-6">
                <div>
                  <div className="text-xl font-black text-slate-950">{t("exp_share_experience")}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-500">{t("community_images_optional")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowComposer(false);
                    setComposerError(null);
                  }}
                  className="rounded-[1rem] border border-slate-200 bg-white px-4 py-2 font-black text-slate-900 transition hover:bg-slate-50"
                >
                  {t("common_close")}
                </button>
              </div>
              <div className="space-y-4 p-8">
                <input
                  value={composerTitle}
                  onChange={(event) => setComposerTitle(event.target.value)}
                  className="w-full rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
                  placeholder={t("community_compose_title_placeholder")}
                />
                <textarea
                  value={composerBody}
                  onChange={(event) => setComposerBody(event.target.value)}
                  rows={6}
                  className="w-full rounded-[1.5rem] border border-slate-100 bg-slate-50 px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
                  placeholder={t("community_compose_body_placeholder")}
                />
                <div>
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t("exp_category_label")}</div>
                  <input
                    value={composerCategoryQuery}
                    onChange={(event) => setComposerCategoryQuery(event.target.value)}
                    className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
                    placeholder={t("exp_category_search")}
                  />
                  <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-auto">
                    {categories
                      .filter((category) => category.id !== "all")
                      .filter((category) => {
                        const query = composerCategoryQuery.trim().toLowerCase();
                        return !query || category.label.toLowerCase().includes(query);
                      })
                      .map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setComposerCategory(category.id)}
                          className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                            composerCategory === category.id
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {category.label}
                        </button>
                      ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm font-semibold text-slate-600">
                    {t("exp_selected_category")}: {catLabel(composerCategory)}
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-[1rem] border border-slate-200 bg-white px-5 py-3 font-black text-slate-900 transition hover:bg-slate-50">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void addImagesFromFiles(event.target.files)} />
                    {t("community_upload_images")}
                  </label>
                </div>
                {composerImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {composerImages.map((src) => (
                      <button
                        type="button"
                        key={src}
                        onClick={() => setComposerImages((prev) => prev.filter((value) => value !== src))}
                        className="relative h-24 overflow-hidden rounded-[1.25rem] border border-slate-100"
                        title={t("common_delete")}
                      >
                        <Image src={src} alt="" fill className="object-cover" sizes="200px" />
                      </button>
                    ))}
                  </div>
                ) : null}
                {composerError ? <div className="rounded-[1.25rem] border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{composerError}</div> : null}
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-8 py-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowComposer(false);
                    setComposerError(null);
                  }}
                  className="rounded-[1rem] border border-slate-200 bg-white px-6 py-3 font-black text-slate-900 transition hover:bg-slate-50"
                >
                  {t("common_cancel")}
                </button>
                <button
                  type="button"
                  disabled={composerSaving || !composerTitle.trim() || !composerBody.trim() || !composerCategory.trim()}
                  onClick={() => void submitExperience()}
                  className={`rounded-[1rem] px-6 py-3 font-black transition ${
                    composerSaving || !composerTitle.trim() || !composerBody.trim() || !composerCategory.trim()
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-blue-600 text-white shadow-[0_16px_36px_rgba(59,130,246,0.22)] hover:bg-blue-700"
                  }`}
                >
                  {composerSaving ? t("common_please_wait") : t("community_compose_publish")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
