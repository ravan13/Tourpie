"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { api, BlogArticle, BlogArticleSummary } from "@/lib/api";
import { Button, Card, CardHeader, CardTitle } from "@/components/ui";

export default function BlogArticlePage() {
  const { t, language } = useLanguage();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ? String(params.slug) : "";

  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [related, setRelated] = useState<BlogArticleSummary[]>([]);
  const placeholderCover =
    "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=2000&auto=format&fit=crop";

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      try {
        setLoading(true);
        const a = await api.blog.getOne(slug, language);
        setArticle(a);
      } catch {
        setArticle(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [language, slug]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const category = article?.category ?? undefined;
      if (!category) {
        setRelated([]);
        return;
      }
      void (async () => {
        try {
          const rows = await api.blog.list({ category, lang: language, limit: 8 });
          setRelated(rows.filter((x) => x.slug !== slug).slice(0, 3));
        } catch {
          setRelated([]);
        }
      })();
    }, 0);
    return () => window.clearTimeout(id);
  }, [article?.category, language, slug]);

  const readingTime = useMemo(() => {
    if (!article) return "";
    return `${article.reading_minutes} ${t("blog_min_read")}`;
  }, [article, t]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="tp-page-shell">
      <div className="relative z-[1] mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/blog" className="text-sm font-black text-gray-700 hover:text-blue-600 transition-colors">
          ← {t("blog_back")}
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              if (typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function") {
                await navigator.share({ url: shareUrl, title: article?.title || undefined });
              } else {
                await navigator.clipboard.writeText(shareUrl);
              }
            } catch {}
          }}
        >
          {t("common_copy_link")}
        </Button>
      </div>

      {loading ? (
        <Card className="mt-8 py-20 text-center">
          {t("common_loading")}
        </Card>
      ) : !article ? (
        <Card className="mt-8 border-dashed py-20 text-center">
          <div className="text-2xl font-black text-gray-900">{t("blog_article_not_found")}</div>
          <div className="mt-2 text-gray-500 font-medium">{t("blog_article_not_found_subtitle")}</div>
        </Card>
      ) : (
        <>
          <Card className="mt-8 overflow-hidden p-0">
            <div className="relative h-80">
              <Image
                src={article.cover_image_url || placeholderCover}
                alt={article.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 900px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 text-white">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white text-xs font-black uppercase tracking-widest">
                  {article.category || t("blog_cat_all")}
                </div>
                <div className="mt-3 text-3xl md:text-5xl font-black tracking-tight drop-shadow">{article.title}</div>
                <div className="mt-4 text-white/85 font-bold flex flex-wrap gap-x-3 gap-y-1">
                  <span>{article.author_name || t("blog_author_unknown")}</span>
                  <span className="text-white/40">•</span>
                  <span>{readingTime}</span>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-12">
              <div className="prose prose-lg max-w-none">
                <div className="text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{article.content}</div>
              </div>
            </div>
          </Card>

          {related.length ? (
            <div className="mt-10">
              <div className="text-2xl font-black text-gray-900">{t("blog_related")}</div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {related.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group block"
                  >
                    <Card className="overflow-hidden p-0 hover:-translate-y-1 hover:shadow-[0_30px_72px_rgba(15,23,42,0.14)]">
                      <div className="relative h-44">
                        <Image
                          src={p.cover_image_url || placeholderCover}
                          alt={p.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-700"
                          sizes="(max-width: 768px) 100vw, 320px"
                        />
                      </div>
                      <CardHeader className="p-6">
                        <CardTitle className="line-clamp-2 text-lg group-hover:text-blue-600 transition-colors">{p.title}</CardTitle>
                        <p className="mt-2 line-clamp-2 text-sm font-medium leading-relaxed text-gray-600">{p.excerpt}</p>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
      </div>
    </div>
  );
}
