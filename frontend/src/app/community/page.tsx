"use client";

import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { api, CommunityPost, CommunityPostKind, CommunityComment, getStoredToken, User } from "@/lib/api";

type CommunityTab = "trending" | "latest" | "qa" | "partners";

export default function CommunityPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CommunityTab>("trending");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStatus, setComposerStatus] = useState<"idle" | "success" | "pending" | "error">("idle");
  const [composerImages, setComposerImages] = useState<string[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const composerFileRef = useRef<HTMLInputElement | null>(null);
  const [reportingPost, setReportingPost] = useState<CommunityPost | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const skipRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentText, setCommentText] = useState("");

  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editingComment, setEditingComment] = useState<CommunityComment | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      return;
    }
    void (async () => {
      try {
        const next = await api.auth.me();
        setMe(next);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const tags = useMemo(
    () => [
      { id: "all", label: t("community_tag_all") },
      { id: "hidden_gems", label: t("community_tag_hidden_gems") },
      { id: "city_guides", label: t("community_tag_city_guides") },
      { id: "qa", label: t("community_tag_qa") },
      { id: "travel_tips", label: t("community_tag_travel_tips") },
      { id: "beaches", label: t("community_tag_beaches") },
      { id: "adventure", label: t("community_tag_adventure") },
      { id: "travel_partners", label: t("community_tag_travel_partners") },
    ],
    [t]
  );
  const tagLabel = useMemo(() => {
    const map = new Map(tags.map((x) => [x.id, x.label] as const));
    return (id: string) => map.get(id) || id;
  }, [tags]);

  const fetchPosts = useCallback(async (opts: { reset: boolean }) => {
    const resolvedKind = activeTab === "qa" ? "qa" : activeTab === "partners" ? "partners" : undefined;
    const resolvedTab = activeTab === "latest" ? "latest" : "trending";
    try {
      setFetchError(null);
      if (opts.reset) {
        setLoading(true);
        skipRef.current = 0;
        setHasMore(true);
      }
      const currentSkip = opts.reset ? 0 : skipRef.current;
      const next = await api.community.listPosts({
        skip: currentSkip,
        limit: 10,
        q: query.trim() ? query.trim() : undefined,
        tag: activeTag !== "all" ? activeTag : undefined,
        kind: resolvedKind,
        tab: resolvedTab,
      });
      setPosts((prev) => (opts.reset ? next : [...prev, ...next]));
      const nextSkip = currentSkip + next.length;
      skipRef.current = nextSkip;
      setHasMore(next.length === 10);
    } catch {
      setFetchError(t("community_load_failed"));
      if (opts.reset) setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeTag, query, t]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchPosts({ reset: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchPosts]);

  const requireLogin = () => {
    router.push("/login");
  };

  const onToggleLike = async (postId: number) => {
    if (!getStoredToken()) return requireLogin();
    try {
      const updated = await api.community.toggleLike(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes_count: updated.likes_count, liked: updated.liked ?? !p.liked } : p
        )
      );
    } catch {}
  };

  const onToggleBookmark = async (postId: number) => {
    if (!getStoredToken()) return requireLogin();
    try {
      const updated = await api.community.toggleBookmark(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, bookmarked: updated.bookmarked ?? !p.bookmarked } : p)));
    } catch {}
  };

  const onShare = async (postId: number) => {
    const url = `${window.location.origin}/community/posts/${postId}`;
    try {
      await api.community.share(postId);
    } catch {}
    try {
      if (typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function") {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, shares_count: p.shares_count + 1 } : p)));
  };

  const openComments = async (p: CommunityPost) => {
    setCommentsPost(p);
    setComments([]);
    setCommentText("");
    setEditingComment(null);
    setCommentsLoading(true);
    try {
      const rows = await api.community.listComments(p.id, { limit: 50 });
      setComments(rows);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentsPost) return;
    if (!getStoredToken()) return requireLogin();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    try {
      const created = await api.community.createComment(commentsPost.id, trimmed);
      setComments((prev) => [created, ...prev]);
      setCommentText("");
      setPosts((prev) => prev.map((p) => (p.id === commentsPost.id ? { ...p, comments_count: p.comments_count + 1 } : p)));
    } catch {
      setComposerError(t("community_comment_failed"));
    }
  };

  const canEditPost = (p: CommunityPost) => {
    if (!me) return false;
    return me.role === "admin" || me.id === p.user_id;
  };

  const canEditComment = (c: CommunityComment) => {
    if (!me) return false;
    return me.role === "admin" || me.id === c.user_id;
  };

  return (
    <div className="tp-page-shell">
      <div className="relative z-[1] max-w-7xl mx-auto px-4 py-10">
      <PageHeader
        title={t("community_title")}
        subtitle={t("community_subtitle")}
        badge={t("community_badge")}
        imageUrl="https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=2000&auto=format&fit=crop"
      />

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("community_categories")}</div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setActiveTag(tag.id)}
                  className={`px-3 py-2 rounded-2xl text-xs font-black transition-all ${
                    activeTag === tag.id
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-100"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{t("community_profile_preview")}</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black">A</div>
                <div>
                  <div className="font-black text-gray-900 leading-tight">{t("community_member")}</div>
                  <div className="text-sm text-gray-500 font-medium">{t("community_identity")}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposerStatus("idle");
                  setComposerError(null);
                  setComposerImages([]);
                  setEditingPost(null);
                  setComposerOpen(true);
                }}
                className="mt-4 w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition-all"
              >
                {t("community_create_post")}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:flex-wrap gap-3 md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2 min-w-0">
                {(
                  [
                    { id: "trending", label: t("community_tab_trending") },
                    { id: "latest", label: t("community_tab_latest") },
                    { id: "qa", label: t("community_tab_qa") },
                    { id: "partners", label: t("community_tab_partners") },
                  ] as const satisfies ReadonlyArray<{ id: CommunityTab; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-2xl text-sm font-black transition-all ${
                      activeTab === tab.id ? "bg-blue-600 text-white shadow-sm shadow-blue-100" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-80">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("community_search")}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 pl-11 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔎</div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {loading ? (
              <div className="bg-white rounded-[2.5rem] border border-gray-100 py-20 text-center font-bold text-gray-500">
                {t("common_loading")}
              </div>
            ) : fetchError ? (
              <div className="bg-white rounded-[2.5rem] border border-dashed border-gray-200 py-16 text-center">
                <div className="text-2xl font-black text-gray-900">{fetchError}</div>
                <button
                  type="button"
                  onClick={() => void fetchPosts({ reset: true })}
                  className="mt-6 bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 rounded-2xl transition-all"
                >
                  {t("common_try_again")}
                </button>
              </div>
            ) : posts.map((post) => (
              <div key={post.id} className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)] transition-all duration-500">
                {post.image_url ? (
                  <div className="relative h-64">
                    <Image src={post.image_url} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 700px" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white text-xs font-black uppercase tracking-widest">
                          {tagLabel(post.tag || "")}
                        </div>
                        {me?.id === post.user_id && post.status && post.status !== "approved" ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur border border-amber-200/30 text-amber-50 text-xs font-black uppercase tracking-widest">
                            {t(`moderation_status_${post.status}`)}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 text-2xl font-black text-white drop-shadow">{post.title}</div>
                    </div>
                  </div>
                ) : null}

                <div className="p-8">
                  {!post.image_url && (
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-black uppercase tracking-widest">
                            {tagLabel(post.tag || "")}
                          </div>
                          {me?.id === post.user_id && post.status && post.status !== "approved" ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-black uppercase tracking-widest">
                              {t(`moderation_status_${post.status}`)}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-3 text-2xl font-black text-gray-900">{post.title}</div>
                      </div>
                      <button
                        onClick={() => void onToggleBookmark(post.id)}
                        className={`px-4 py-2 rounded-2xl border text-sm font-black transition-all ${
                          post.bookmarked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {post.bookmarked ? t("community_saved") : t("community_save")}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                    <div className="w-9 h-9 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black">
                      {(post.user?.full_name || t("community_member")).charAt(0)}
                    </div>
                    <div>
                      <div className="font-black text-gray-900 leading-tight">{post.user?.full_name || t("community_member")}</div>
                      <div className="text-gray-400 font-bold">#{post.id}</div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Link
                        href={`/community/posts/${post.id}`}
                        className="px-4 py-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-sm font-black text-gray-800 transition-all"
                      >
                        {t("community_open")}
                      </Link>
                      {me && me.role !== "admin" && me.id !== post.user_id ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReportStatus("idle");
                            setReportReason("");
                            setReportingPost(post);
                          }}
                          className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-black text-gray-800 transition-all"
                        >
                          {t("community_report")}
                        </button>
                      ) : null}
                      {canEditPost(post) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPost(post);
                            setComposerImages(post.images || []);
                            setComposerError(null);
                            setComposerStatus("idle");
                            setComposerOpen(true);
                          }}
                          className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-black text-gray-800 transition-all"
                        >
                          {t("common_edit")}
                        </button>
                      ) : null}
                      {canEditPost(post) ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(t("common_confirm_delete"))) return;
                            try {
                              await api.community.deletePost(post.id);
                              setPosts((prev) => prev.filter((p) => p.id !== post.id));
                            } catch {}
                          }}
                          className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-black text-gray-800 transition-all"
                        >
                          {t("common_delete")}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-5 text-gray-600 font-medium leading-relaxed">
                    {post.body}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void onToggleLike(post.id)}
                        className={`px-4 py-2 rounded-2xl text-sm font-black transition-all border ${
                          post.liked ? "bg-red-50 text-red-600 border-red-100" : "bg-gray-50 text-gray-800 border-gray-100 hover:bg-gray-100"
                        }`}
                      >
                        ♥ {post.likes_count}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openComments(post)}
                        className="px-4 py-2 rounded-2xl text-sm font-black bg-gray-50 text-gray-800 border border-gray-100 hover:bg-gray-100 transition-all"
                      >
                        💬 {post.comments_count}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onShare(post.id)}
                        className="px-4 py-2 rounded-2xl text-sm font-black bg-gray-50 text-gray-800 border border-gray-100 hover:bg-gray-100 transition-all"
                      >
                        ↗ {post.shares_count}
                      </button>
                    </div>
                    <button
                      onClick={() => void onToggleBookmark(post.id)}
                      className={`px-4 py-2 rounded-2xl text-sm font-black transition-all border ${
                        post.bookmarked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {post.bookmarked ? t("community_bookmarked") : t("community_bookmark")}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!loading && !fetchError && posts.length === 0 && (
              <div className="bg-white rounded-[2.5rem] border border-dashed border-gray-200 py-20 text-center">
                <div className="text-6xl mb-5">🧭</div>
                <div className="text-2xl font-black text-gray-900">{t("community_no_posts")}</div>
                <div className="text-gray-500 font-medium mt-2">{t("community_no_posts_subtitle")}</div>
              </div>
            )}

            {!loading && !fetchError && posts.length > 0 && hasMore ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => void fetchPosts({ reset: false })}
                  className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black py-3 rounded-2xl transition-all"
                >
                  {t("common_load_more")}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("community_trending")}</div>
            <div className="space-y-4">
              {posts.slice(0, 5).map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setQuery(p.title)}
                  className="w-full flex gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center font-black">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-gray-900 truncate">{p.title}</div>
                    <div className="text-sm text-gray-500 font-bold">
                      {tagLabel(p.tag || "")} • {t("community_likes", { count: p.likes_count })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {composerOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setComposerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="text-2xl font-black text-gray-900">{editingPost ? t("community_edit_post") : t("community_compose_title")}</div>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 font-black text-gray-800"
                >
                  {t("common_close")}
                </button>
              </div>

              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    if (!getStoredToken()) return requireLogin();
                    setComposerError(null);
                    const fd = new FormData(e.currentTarget as HTMLFormElement);
                    const title = String(fd.get("title") || "").trim();
                    const body = String(fd.get("body") || "").trim();
                    const tag = String(fd.get("tag") || "travel_tips");
                    const kind = String(fd.get("kind") || "story") as CommunityPostKind;
                    const imageUrl = String(fd.get("imageUrl") || "").trim();
                    if (!title || !body) return;

                    try {
                      const payload = {
                        title,
                        body,
                        tag,
                        kind,
                        image_url: imageUrl || null,
                        images: composerImages.length ? composerImages : null,
                      };
                      const saved = editingPost
                        ? await api.community.updatePost(editingPost.id, payload)
                        : await api.community.createPost(payload);

                      if (saved.status && saved.status !== "approved") {
                        setComposerStatus("pending");
                      } else {
                        setComposerStatus("success");
                      }
                      setPosts((prev) => (editingPost ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]));
                      setEditingPost(null);
                      setComposerImages([]);
                      (e.currentTarget as HTMLFormElement).reset();
                    } catch {
                      setComposerStatus("error");
                      setComposerError(t("community_post_failed"));
                    }
                  })();
                }}
              >
                <input
                  name="title"
                  required
                  placeholder={t("community_compose_title_placeholder")}
                  defaultValue={editingPost?.title || ""}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  name="body"
                  required
                  rows={5}
                  placeholder={t("community_compose_body_placeholder")}
                  defaultValue={editingPost?.body || ""}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    name="kind"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingPost?.kind || "story"}
                  >
                    <option value="story">{t("community_kind_story")}</option>
                    <option value="tips">{t("community_kind_tips")}</option>
                    <option value="qa">{t("community_kind_qa")}</option>
                    <option value="partners">{t("community_kind_partners")}</option>
                  </select>
                  <select
                    name="tag"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingPost?.tag || "travel_tips"}
                  >
                    {tags.filter((x) => x.id !== "all").map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  name="imageUrl"
                  placeholder={t("community_compose_image_placeholder")}
                  defaultValue={editingPost?.image_url || ""}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => composerFileRef.current?.click()}
                    className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 rounded-2xl transition-all"
                  >
                    {t("community_upload_images")}
                  </button>
                  <div className="text-sm font-bold text-gray-500 flex items-center">
                    {composerImages.length ? t("community_images_count", { count: composerImages.length }) : t("community_images_optional")}
                  </div>
                </div>
                <input
                  ref={composerFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.currentTarget.files || []);
                    if (!files.length) return;
                    void (async () => {
                      const next: string[] = [];
                      for (const f of files.slice(0, 6)) {
                        if (!f.type.startsWith("image/")) continue;
                        if (f.size > 5 * 1024 * 1024) continue;
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result || ""));
                          reader.onerror = () => reject(new Error("read_failed"));
                          reader.readAsDataURL(f);
                        }).catch(() => "");
                        if (dataUrl.startsWith("data:image/")) next.push(dataUrl);
                      }
                      setComposerImages((prev) => [...next, ...prev].slice(0, 6));
                    })();
                    e.currentTarget.value = "";
                  }}
                />
                {composerImages.length ? (
                  <div className="grid grid-cols-3 gap-3">
                    {composerImages.map((src) => (
                      <div key={src} className="relative rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                        <div className="relative h-24">
                          <Image src={src} alt="" fill className="object-cover" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setComposerImages((prev) => prev.filter((x) => x !== src))}
                          className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-900 font-black px-3 py-1 rounded-xl border border-white/40"
                        >
                          {t("common_remove")}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl transition-all shadow-lg shadow-blue-100">
                  {editingPost ? t("community_save_post") : t("community_compose_publish")}
                </button>
                {composerStatus === "success" && (
                  <div className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-2xl p-4">
                    {t("community_compose_success")}
                  </div>
                )}
                {composerStatus === "pending" && (
                  <div className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                    {t("community_pending_review")}
                  </div>
                )}
                {composerError ? (
                  <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-2xl p-4">
                    {composerError}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      )}

      {commentsPost ? (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setCommentsPost(null);
            setEditingComment(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-3xl bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-2xl font-black text-gray-900 truncate">{t("community_comments")}</div>
                  <div className="mt-1 text-sm text-gray-500 font-bold truncate">{commentsPost.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCommentsPost(null);
                    setEditingComment(null);
                  }}
                  className="px-4 py-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 font-black text-gray-800"
                >
                  {t("common_close")}
                </button>
              </div>

              <div className="mt-6 flex gap-3">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t("community_comment_placeholder")}
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => void submitComment()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-2xl transition-all"
                >
                  {t("community_comment_send")}
                </button>
              </div>

              <div className="mt-6 space-y-4 max-h-[60vh] overflow-auto pr-2">
                {commentsLoading ? (
                  <div className="py-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
                ) : comments.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-5xl">💬</div>
                    <div className="mt-3 text-xl font-black text-gray-900">{t("community_no_comments")}</div>
                    <div className="mt-1 text-gray-500 font-medium">{t("community_no_comments_subtitle")}</div>
                  </div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-black text-gray-900">{c.user?.full_name || t("community_member")}</div>
                          {editingComment?.id === c.id ? (
                            <input
                              value={editingComment.body}
                              onChange={(e) => setEditingComment({ ...editingComment, body: e.target.value })}
                              className="mt-3 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div className="mt-3 text-gray-700 font-medium whitespace-pre-wrap">{c.body}</div>
                          )}
                        </div>
                        {canEditComment(c) ? (
                          <div className="flex gap-2">
                            {editingComment?.id === c.id ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const updated = await api.community.updateComment(c.id, editingComment.body);
                                    setComments((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
                                    setEditingComment(null);
                                  } catch {}
                                }}
                                className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-all"
                              >
                                {t("common_save")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingComment(c)}
                                className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 font-black text-gray-800 transition-all"
                              >
                                {t("common_edit")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm(t("common_confirm_delete"))) return;
                                try {
                                  await api.community.deleteComment(c.id);
                                  setComments((prev) => prev.filter((x) => x.id !== c.id));
                                  setPosts((prev) =>
                                    prev.map((p) => (p.id === commentsPost.id ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
                                  );
                                } catch {}
                              }}
                              className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 font-black text-gray-800 transition-all"
                            >
                              {t("common_delete")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reportingPost ? (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-black text-gray-900">{t("community_report_title")}</div>
                <div className="mt-1 text-sm font-bold text-gray-500">{t("community_report_subtitle")}</div>
              </div>
              <button
                type="button"
                onClick={() => setReportingPost(null)}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
              >
                {t("common_close")}
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="font-black text-gray-900">{reportingPost.title}</div>
                <div className="mt-1 text-sm font-bold text-gray-500">#{reportingPost.id}</div>
              </div>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={5}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t("community_report_placeholder")}
              />
              {reportStatus === "success" ? (
                <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-bold text-green-700">
                  {t("community_report_success")}
                </div>
              ) : reportStatus === "error" ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {t("community_report_failed")}
                </div>
              ) : null}
            </div>
            <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setReportingPost(null)}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 rounded-2xl transition"
              >
                {t("common_cancel")}
              </button>
              <button
                type="button"
                disabled={reportStatus === "saving"}
                onClick={() => {
                  void (async () => {
                    setReportStatus("saving");
                    try {
                      await api.community.report(reportingPost.id, reportReason.trim() || null);
                      setReportStatus("success");
                      window.setTimeout(() => setReportingPost(null), 700);
                    } catch {
                      setReportStatus("error");
                    }
                  })();
                }}
                className={`font-black px-6 py-3 rounded-2xl transition ${
                  reportStatus === "saving" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {reportStatus === "saving" ? t("common_please_wait") : t("community_report_submit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
