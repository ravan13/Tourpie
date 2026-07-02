"use client";

import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { api, CommunityPost, CommunityPostKind } from "@/lib/api";

export default function ExperiencesPage() {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const skipRef = useRef(0);
  const limit = 10;
  const kind: CommunityPostKind = "story";

  const [showComposer, setShowComposer] = useState(false);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [composerImages, setComposerImages] = useState<string[]>([]);
  const [composerCategory, setComposerCategory] = useState<string>("adventure");
  const [composerCategoryQuery, setComposerCategoryQuery] = useState("");
  const [composerSaving, setComposerSaving] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const categories = useMemo(
    () => [
      { id: "all", label: t("exp_cat_all") },
      { id: "solo", label: t("exp_cat_solo_travel") },
      { id: "adventure", label: t("exp_cat_adventure") },
      { id: "nature", label: t("exp_cat_nature") },
      { id: "luxury", label: t("exp_cat_luxury") },
      { id: "budget", label: t("exp_cat_budget_travel") },
      { id: "family", label: t("exp_cat_family") },
      { id: "culture", label: t("exp_cat_culture") },
      { id: "food", label: t("exp_cat_food") },
      { id: "road_trip", label: t("exp_cat_road_trip") },
      { id: "beach", label: t("exp_cat_beach") },
      { id: "hiking", label: t("exp_cat_hiking") },
      { id: "city_break", label: t("exp_cat_city_break") },
      { id: "photography", label: t("exp_cat_photography") },
      { id: "backpacking", label: t("exp_cat_backpacking") },
      { id: "wellness", label: t("exp_cat_wellness") },
    ],
    [t]
  );
  const catLabel = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.label] as const));
    return (id: string) => map.get(id) || id;
  }, [categories]);

  const tag = activeCategory === "all" ? undefined : activeCategory;
  const tab = savedOnly ? "saved" : "latest";
  const placeholderCover =
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2200&auto=format&fit=crop";

  const load = useCallback(
    async (mode: "reset" | "more") => {
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
        setHasMore(rows.length === limit);
        const nextValue = nextSkip + rows.length;
        skipRef.current = nextValue;
      } catch {
        setError(t("community_load_failed"));
        setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind, limit, t, tab, tag]
  );

  useEffect(() => {
    const id = setTimeout(() => void load("reset"), 0);
    return () => clearTimeout(id);
  }, [load]);

  const toggleLike = async (postId: number) => {
    try {
      const updated = await api.community.toggleLike(postId);
      setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: updated.likes_count, liked: updated.liked } : p)));
    } catch {
      alert(t("community_post_failed"));
    }
  };

  const toggleBookmark = async (postId: number) => {
    try {
      const updated = await api.community.toggleBookmark(postId);
      setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, bookmarked: updated.bookmarked } : p)));
    } catch {
      alert(t("community_post_failed"));
    }
  };

  const share = async (postId: number) => {
    const url = `${window.location.origin}/community/posts/${postId}`;
    const title = t("exp_share_experience");
    try {
      if (typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function") {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert(t("common_copy_link"));
      }
      await api.community.share(postId).catch(() => null);
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
        (f) =>
          new Promise<string | null>((resolve) => {
            if (f.size > 5 * 1024 * 1024) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(f);
          })
      )
    );
    setComposerImages((prev) => [...prev, ...reads.filter((x): x is string => !!x)]);
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <PageHeader
        title={t("exp_title")}
        subtitle={t("exp_subtitle")}
        badge={t("exp_badge")}
        imageUrl="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2200&auto=format&fit=crop"
      />

      <div className="mt-10 flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-4 py-2 rounded-2xl text-sm font-black transition-all ${
                activeCategory === c.id
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-100"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-100"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSavedOnly((v) => !v)}
            className={`px-5 py-3 rounded-2xl font-black transition-all border ${
              savedOnly ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {savedOnly ? t("exp_showing_saved") : t("exp_saved_only")}
          </button>
          <button
            type="button"
            onClick={() => {
              setComposerError(null);
              setComposerCategory(activeCategory === "all" ? "adventure" : activeCategory);
              setComposerCategoryQuery("");
              setShowComposer(true);
            }}
            className="bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 rounded-2xl transition-all shadow-lg shadow-blue-100"
          >
            {t("exp_share_experience")}
          </button>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {loading ? (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center font-bold text-gray-500">
              {t("common_loading")}
            </div>
          ) : error ? (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center">
              <div className="text-2xl font-black text-gray-900">{error}</div>
              <button
                type="button"
                onClick={() => void load("reset")}
                className="mt-6 bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 rounded-2xl transition"
              >
                {t("common_try_again")}
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] border border-dashed border-gray-200 py-20 text-center">
              <div className="text-6xl mb-5">🗺️</div>
              <div className="text-2xl font-black text-gray-900">{t("exp_none_title")}</div>
              <div className="text-gray-500 font-medium mt-2">{t("exp_none_subtitle")}</div>
            </div>
          ) : (
            <>
              {items.map((post) => {
                const cover = post.image_url || (Array.isArray(post.images) ? post.images[0] : null) || placeholderCover;
                const label = post.tag ? catLabel(post.tag) : catLabel("all");
                const author = post.user?.full_name || t("common_anonymous");
                return (
                  <div
                    key={post.id}
                    className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)] transition-all duration-500"
                  >
                    <div className="relative h-72">
                      <Image src={cover} alt={post.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 900px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                      <div className="absolute bottom-7 left-7 right-7">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white text-xs font-black uppercase tracking-widest">
                            {label}
                          </div>
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white text-xs font-black uppercase tracking-widest">
                            👤 {author}
                          </div>
                        </div>
                        <div className="mt-3 text-3xl font-black text-white tracking-tight drop-shadow">{post.title}</div>
                        <div className="mt-3 flex flex-wrap gap-3 text-white/85 font-bold">
                          <span>⭐ {Number(post.likes_count || 0)}</span>
                          <span className="text-white/40">•</span>
                          <span>💬 {Number(post.comments_count || 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-8">
                      <p className="text-gray-600 font-medium leading-relaxed line-clamp-3">{post.body}</p>

                      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/community/posts/${post.id}`}
                            prefetch={false}
                            className="px-5 py-3 rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black transition-all"
                          >
                            {t("community_open")}
                          </Link>
                          <button
                            type="button"
                            onClick={() => void share(post.id)}
                            className="px-5 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 font-black text-gray-800 transition-all"
                          >
                            {t("community_share")}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleLike(post.id)}
                            className={`px-5 py-3 rounded-2xl font-black transition-all border ${
                              post.liked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            ♥
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleBookmark(post.id)}
                            className={`px-5 py-3 rounded-2xl font-black transition-all border ${
                              post.bookmarked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {post.bookmarked ? t("community_saved") : t("community_save")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void load("more")}
                  className={`w-full py-4 rounded-2xl font-black transition ${
                    loadingMore ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-900"
                  }`}
                >
                  {loadingMore ? t("common_loading") : t("common_load_more")}
                </button>
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("exp_top_categories")}</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "solo", label: t("exp_cat_solo") },
                { id: "adventure", label: t("exp_cat_adventure") },
                { id: "luxury", label: t("exp_cat_luxury") },
                { id: "budget", label: t("exp_cat_budget") },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className="px-4 py-4 rounded-[1.5rem] bg-gray-50 hover:bg-blue-600 hover:text-white border border-gray-100 font-black text-gray-800 transition-all"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showComposer && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-black text-gray-900">{t("exp_share_experience")}</div>
                <div className="mt-1 text-sm font-bold text-gray-500">{t("community_images_optional")}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowComposer(false);
                  setComposerError(null);
                }}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
              >
                {t("common_close")}
              </button>
            </div>
            <div className="p-8 space-y-4">
              <input
                value={composerTitle}
                onChange={(e) => setComposerTitle(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t("community_compose_title_placeholder")}
              />
              <textarea
                value={composerBody}
                onChange={(e) => setComposerBody(e.target.value)}
                rows={6}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t("community_compose_body_placeholder")}
              />
              <div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t("exp_category_label")}</div>
                <input
                  value={composerCategoryQuery}
                  onChange={(e) => setComposerCategoryQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t("exp_category_search")}
                />
                <div className="mt-3 flex flex-wrap gap-2 max-h-32 overflow-auto">
                  {categories
                    .filter((c) => c.id !== "all")
                    .filter((c) => {
                      const q = composerCategoryQuery.trim().toLowerCase();
                      if (!q) return true;
                      return c.label.toLowerCase().includes(q);
                    })
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setComposerCategory(c.id)}
                        className={`px-4 py-2 rounded-2xl text-sm font-black transition-all border ${
                          composerCategory === c.id
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="text-sm font-bold text-gray-600">
                  {t("exp_selected_category")}: {catLabel(composerCategory)}
                </div>
                <label className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 font-black text-gray-900 transition cursor-pointer">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addImagesFromFiles(e.target.files)} />
                  {t("community_upload_images")}
                </label>
              </div>
              {composerImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {composerImages.map((src) => (
                    <button
                      type="button"
                      key={src}
                      onClick={() => setComposerImages((prev) => prev.filter((x) => x !== src))}
                      className="relative h-24 rounded-2xl overflow-hidden border border-gray-100"
                      title={t("common_delete")}
                    >
                      <Image src={src} alt="" fill className="object-cover" sizes="200px" />
                    </button>
                  ))}
                </div>
              )}
              {composerError ? (
                <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-2xl p-4">{composerError}</div>
              ) : null}
            </div>
            <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowComposer(false);
                  setComposerError(null);
                }}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 rounded-2xl transition"
              >
                {t("common_cancel")}
              </button>
              <button
                type="button"
                disabled={composerSaving || !composerTitle.trim() || !composerBody.trim() || !composerCategory.trim()}
                onClick={() => void submitExperience()}
                className={`font-black px-6 py-3 rounded-2xl transition ${
                  composerSaving || !composerTitle.trim() || !composerBody.trim()
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {composerSaving ? t("common_please_wait") : t("community_compose_publish")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
