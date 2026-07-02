"use client";

import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { api, BlogArticleSummary } from "@/lib/api";

export default function BlogPage() {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [saved, setSaved] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem("saved_posts");
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(ids.filter((x) => typeof x === "string"));
    } catch {
      return new Set<string>();
    }
  });
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
  const [newsletterError, setNewsletterError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogArticleSummary[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const placeholderCover =
    "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=2000&auto=format&fit=crop";

  const categories = useMemo(
    () => [
      { id: "all", label: t("blog_cat_all") },
      { id: "budget", label: t("blog_cat_budget") },
      { id: "luxury", label: t("blog_cat_luxury") },
      { id: "solo", label: t("blog_cat_solo") },
      { id: "food", label: t("blog_cat_food") },
      { id: "events", label: t("blog_cat_events") },
      { id: "adventure", label: t("blog_cat_adventure") },
      { id: "culture", label: t("blog_cat_culture") },
    ],
    [t]
  );

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const rows = await api.blog.list({
          q: query.trim() ? query.trim() : undefined,
          category: activeCategory !== "all" ? activeCategory : undefined,
          lang: language,
          limit: 20,
        });
        setPosts(rows);
      } catch {
        setPosts([]);
        setFetchError(t("blog_load_failed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCategory, language, query, t]);

  const featured = posts[0] || null;
  const popular = useMemo(() => posts.slice(1, 4), [posts]);
  const filtered = useMemo(() => posts.slice(featured ? 1 : 0), [featured, posts]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <PageHeader
        title={t("blog_title")}
        subtitle={t("blog_subtitle")}
        badge={t("blog_badge")}
        imageUrl="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=2000&auto=format&fit=crop"
      />

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          {loading ? (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 py-20 text-center font-bold text-gray-500">
              {t("common_loading")}
            </div>
          ) : fetchError ? (
            <div className="bg-white rounded-[2.5rem] border border-dashed border-gray-200 py-20 text-center">
              <div className="text-2xl font-black text-gray-900">{fetchError}</div>
              <div className="mt-2 text-gray-500 font-medium">{t("blog_load_failed_subtitle")}</div>
            </div>
          ) : featured ? (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)] transition-all duration-500">
              <div className="relative h-80">
                <Image
                  src={featured.cover_image_url || placeholderCover}
                  alt={featured.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 900px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white text-xs font-black uppercase tracking-widest">
                    {t("blog_featured")} • {categories.find((c) => c.id === (featured.category || ""))?.label || featured.category}
                  </div>
                  <div className="mt-3 text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow">{featured.title}</div>
                  <div className="mt-3 text-white/85 font-bold flex flex-wrap gap-x-3 gap-y-1">
                    <span>{featured.author_name || t("blog_author_unknown")}</span>
                    <span className="text-white/40">•</span>
                    <span>{`${featured.reading_minutes} ${t("blog_min_read")}`}</span>
                  </div>
                </div>
              </div>
              <div className="p-8">
                <p className="text-gray-600 font-medium leading-relaxed">{featured.excerpt}</p>
                <div className="mt-6 flex items-center gap-4">
                  <Link
                    href={`/blog/${featured.slug}`}
                    className="bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 rounded-2xl transition-all"
                  >
                    {t("blog_read_article")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSaved((prev) => {
                        const next = new Set(prev);
                        if (next.has(featured.slug)) next.delete(featured.slug);
                        else next.add(featured.slug);
                        localStorage.setItem("saved_posts", JSON.stringify(Array.from(next)));
                        return next;
                      });
                    }}
                    className="bg-gray-50 hover:bg-gray-100 text-gray-800 font-black px-6 py-3 rounded-2xl transition-all border border-gray-100"
                  >
                    {saved.has(featured.slug) ? t("blog_saved") : t("blog_save")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border border-dashed border-gray-200 py-20 text-center">
              <div className="text-6xl mb-5">📰</div>
              <div className="text-2xl font-black text-gray-900">{t("blog_empty_title")}</div>
              <div className="text-gray-500 font-medium mt-2">{t("blog_empty_subtitle")}</div>
            </div>
          )}

          <div className="mt-8 bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`px-3 py-2 rounded-2xl text-xs font-black transition-all ${
                      activeCategory === c.id ? "bg-blue-600 text-white shadow-sm shadow-blue-100" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("blog_search")}
                  className="w-full md:w-72 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 pl-11 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔎</div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)] transition-all duration-500 group">
                <div className="relative h-48">
                  <Image
                    src={p.cover_image_url || placeholderCover}
                    alt={p.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 420px"
                  />
                  <div className="absolute top-5 left-5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur text-xs font-black text-gray-900">
                    {categories.find((c) => c.id === (p.category || ""))?.label || p.category}
                  </div>
                </div>
                <div className="p-7">
                  <div className="text-xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                    {p.title}
                  </div>
                  <div className="mt-2 text-gray-600 font-medium leading-relaxed line-clamp-2">
                    {p.excerpt}
                  </div>
                  <div className="mt-5 text-sm text-gray-500 font-bold flex flex-wrap gap-x-3 gap-y-1">
                    <span>{p.author_name || t("blog_author_unknown")}</span>
                    <span className="text-gray-300">•</span>
                    <span>{`${p.reading_minutes} ${t("blog_min_read")}`}</span>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <Link
                      href={`/blog/${p.slug}`}
                      className="flex-1 text-center bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition-all"
                    >
                      {t("blog_read")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setSaved((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.slug)) next.delete(p.slug);
                          else next.add(p.slug);
                          localStorage.setItem("saved_posts", JSON.stringify(Array.from(next)));
                          return next;
                        });
                      }}
                      className="px-5 py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 font-black text-gray-800 transition-all"
                    >
                      {saved.has(p.slug) ? t("blog_saved") : t("blog_save")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 bg-blue-600 rounded-[3rem] p-10 md:p-14 text-white overflow-hidden relative">
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="text-3xl md:text-4xl font-black">{t("blog_newsletter_title")}</div>
              <div className="mt-3 text-white/85 font-medium text-lg max-w-2xl">
                {t("blog_newsletter_subtitle")}
              </div>
              <form
                className="mt-8 flex flex-col sm:flex-row gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    const fd = new FormData(e.currentTarget as HTMLFormElement);
                    const email = String(fd.get("email") || "").trim();
                    if (!email) return;
                    setNewsletterError(null);
                    try {
                      await api.blog.subscribeNewsletter(email, language);
                      setNewsletterStatus("success");
                      (e.currentTarget as HTMLFormElement).reset();
                    } catch {
                      setNewsletterStatus("error");
                      setNewsletterError(t("blog_newsletter_failed"));
                    }
                  })();
                }}
              >
                <input
                  type="email"
                  required
                  name="email"
                  placeholder={t("blog_newsletter_email")}
                  className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-5 py-4 font-bold text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
                <button className="bg-white text-blue-700 font-black px-8 py-4 rounded-2xl hover:bg-blue-50 transition-all shadow-xl">
                  {t("blog_subscribe")}
                </button>
              </form>
              {newsletterStatus === "success" && (
                <div className="mt-4 text-sm font-bold bg-white/10 border border-white/20 rounded-2xl p-4">
                  {t("blog_newsletter_success")}
                </div>
              )}
              {newsletterError ? (
                <div className="mt-4 text-sm font-bold bg-white/10 border border-white/20 rounded-2xl p-4">
                  {newsletterError}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("blog_popular")}</div>
            <div className="space-y-4">
              {popular.map((p, idx) => (
                <Link key={p.id} href={`/blog/${p.slug}`} prefetch={false} className="w-full flex gap-4 text-left">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center font-black">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-gray-900 truncate">{p.title}</div>
                    <div className="text-sm text-gray-500 font-bold">
                      {categories.find((c) => c.id === p.category)?.label || p.category} • {`${p.reading_minutes} ${t("blog_min_read")}`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("blog_topics")}</div>
            <div className="flex flex-wrap gap-2">
              {[
                t("blog_topic_city_breaks"),
                t("blog_topic_remote_work"),
                t("blog_topic_route_planning"),
                t("blog_topic_packing"),
                t("blog_topic_photography"),
                t("blog_topic_local_food"),
              ].map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setQuery(topic)}
                  className="px-3 py-2 rounded-2xl text-xs font-black bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all border border-gray-100"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("blog_about")}</div>
            <div className="text-gray-600 font-medium leading-relaxed">
              {t("blog_about_text")}
            </div>
            <button
              type="button"
              onClick={() => (window.location.href = "mailto:support@tourpie.travel")}
              className="mt-5 w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition-all"
            >
              {t("blog_write")}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

