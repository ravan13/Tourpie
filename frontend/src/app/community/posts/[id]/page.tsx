"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, CommunityComment, CommunityPost, getStoredToken } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function CommunityPostPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = useMemo(() => {
    const n = Number(params?.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  const { user: me } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSaving, setReportSaving] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!postId) {
        setLoading(false);
        setPost(null);
        return;
      }
      void (async () => {
        try {
          setLoading(true);
          const p = await api.community.getPost(postId);
          setPost(p);
        } catch {
          setPost(null);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(id);
  }, [postId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!postId) return;
      void (async () => {
        try {
          setCommentsLoading(true);
          const rows = await api.community.listComments(postId, { limit: 50 });
          setComments(rows);
        } catch {
          setComments([]);
        } finally {
          setCommentsLoading(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(id);
  }, [postId]);

  const requireLogin = () => {
    router.push("/login");
  };

  const canEdit = (userId: number) => {
    if (!me) return false;
    return me.role === "admin" || me.id === userId;
  };

  const getDisplayIdentity = (
    userId: number,
    user?: { id: number; full_name?: string | null; avatar_url?: string | null } | null
  ) => {
    const resolved =
      me && me.id === userId
        ? {
            id: me.id,
            full_name: me.full_name || user?.full_name || null,
            avatar_url: me.avatar_url ?? user?.avatar_url ?? null,
          }
        : user || null;
    const name = resolved?.full_name || t("community_member");
    return {
      name,
      avatarUrl: resolved?.avatar_url || null,
    };
  };

  const submitComment = async () => {
    if (!postId) return;
    if (!getStoredToken()) return requireLogin();
    const trimmed = commentText.trim();
    if (!trimmed) return;
    try {
      const created = await api.community.createComment(postId, trimmed);
      setComments((prev) => [created, ...prev]);
      setCommentText("");
      setPost((prev) => (prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev));
    } catch {}
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const postIdentity = post ? getDisplayIdentity(post.user_id, post.user) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/community" className="text-sm font-black text-gray-700 hover:text-blue-600 transition-colors">
          ← {t("community_back")}
        </Link>
        {post ? (
          <button
            type="button"
            onClick={async () => {
              try {
                await api.community.share(post.id);
              } catch {}
              try {
              if (typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function") {
                await navigator.share({ url: shareUrl });
                } else {
                  await navigator.clipboard.writeText(shareUrl);
                }
              } catch {}
              setPost((prev) => (prev ? { ...prev, shares_count: prev.shares_count + 1 } : prev));
            }}
            className="px-4 py-2 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-sm font-black text-gray-800 transition-all"
          >
            {t("community_share")}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-8 bg-white rounded-[2.5rem] border border-gray-100 py-20 text-center font-bold text-gray-500">
          {t("common_loading")}
        </div>
      ) : !post ? (
        <div className="mt-8 bg-white rounded-[2.5rem] border border-dashed border-gray-200 py-20 text-center">
          <div className="text-2xl font-black text-gray-900">{t("community_post_not_found")}</div>
          <div className="mt-2 text-gray-500 font-medium">{t("community_post_not_found_subtitle")}</div>
        </div>
      ) : (
        <>
          {banner ? (
            <div
              className={`mt-6 rounded-[2rem] border p-5 font-black ${
                banner.type === "success" ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-700"
              }`}
            >
              {banner.text}
            </div>
          ) : null}

          <div className="mt-8 bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
            {post.image_url ? (
              <div className="relative h-72">
                <Image src={post.image_url} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 900px" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute bottom-8 left-8 right-8 text-white">
                  <div className="text-3xl md:text-4xl font-black tracking-tight drop-shadow">{post.title}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/85 font-bold">
                    {postIdentity?.avatarUrl ? (
                      <Image src={postIdentity.avatarUrl} alt={postIdentity.name} width={36} height={36} className="w-9 h-9 rounded-2xl object-cover border border-white/20" />
                    ) : (
                      <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 text-white flex items-center justify-center font-black">
                        {postIdentity?.name.charAt(0)}
                      </div>
                    )}
                    <span>{postIdentity?.name || t("community_member")}</span>
                    <span className="text-white/40">•</span>
                    <span>#{post.id}</span>
                    {me && (me.role === "admin" || me.id === post.user_id) && (post.status || "approved") !== "approved" ? (
                      <>
                        <span className="text-white/40">•</span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-black">
                          {t(`moderation_status_${post.status || "pending_review"}`)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8">
                <div className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{post.title}</div>
                <div className="mt-3 text-sm text-gray-500 font-bold flex flex-wrap items-center gap-x-3 gap-y-2">
                  {postIdentity?.avatarUrl ? (
                    <Image src={postIdentity.avatarUrl} alt={postIdentity.name} width={36} height={36} className="w-9 h-9 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black">
                      {postIdentity?.name.charAt(0)}
                    </div>
                  )}
                  <span>{postIdentity?.name || t("community_member")}</span>
                  <span className="text-gray-300">•</span>
                  <span>#{post.id}</span>
                  {me && (me.role === "admin" || me.id === post.user_id) && (post.status || "approved") !== "approved" ? (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-black text-blue-700">
                        {t(`moderation_status_${post.status || "pending_review"}`)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            <div className="p-8">
              {me && (me.role === "admin" || me.id === post.user_id) && post.moderation_note ? (
                <div className="mb-5 rounded-[2rem] border border-amber-100 bg-amber-50 p-5">
                  <div className="text-xs font-black text-amber-700 uppercase tracking-widest">{t("moderation_note_label")}</div>
                  <div className="mt-2 text-amber-900 font-bold whitespace-pre-wrap">{post.moderation_note}</div>
                </div>
              ) : null}
              <div className="text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{post.body}</div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!getStoredToken()) return requireLogin();
                    try {
                      const updated = await api.community.toggleLike(post.id);
                      setPost((prev) => (prev ? { ...prev, likes_count: updated.likes_count, liked: updated.liked ?? !prev.liked } : prev));
                    } catch {}
                  }}
                  className={`px-4 py-2 rounded-2xl text-sm font-black transition-all border ${
                    post.liked ? "bg-red-50 text-red-600 border-red-100" : "bg-gray-50 text-gray-800 border-gray-100 hover:bg-gray-100"
                  }`}
                >
                  ♥ {post.likes_count}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!getStoredToken()) return requireLogin();
                    try {
                      const updated = await api.community.toggleBookmark(post.id);
                      setPost((prev) => (prev ? { ...prev, bookmarked: updated.bookmarked ?? !prev.bookmarked } : prev));
                    } catch {}
                  }}
                  className={`px-4 py-2 rounded-2xl text-sm font-black transition-all border ${
                    post.bookmarked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {post.bookmarked ? t("community_bookmarked") : t("community_bookmark")}
                </button>
                {me && me.role !== "admin" && me.id !== post.user_id ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!getStoredToken()) return requireLogin();
                      setReportReason("");
                      setReportOpen(true);
                      setBanner(null);
                    }}
                    className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-black text-gray-800 transition-all"
                  >
                    {t("community_report")}
                  </button>
                ) : null}
                {canEdit(post.user_id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditTitle(post.title);
                      setEditBody(post.body);
                      setEditOpen(true);
                      setBanner(null);
                    }}
                    className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-black text-gray-800 transition-all"
                  >
                    {t("community_edit_post")}
                  </button>
                ) : null}
                {canEdit(post.user_id) ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(t("common_confirm_delete"))) return;
                      try {
                        await api.community.deletePost(post.id);
                        router.push("/community");
                      } catch {}
                    }}
                    className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-black text-gray-800 transition-all"
                  >
                    {t("common_delete")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
            <div className="text-2xl font-black text-gray-900">{t("community_comments")}</div>
            <div className="mt-5 flex gap-3">
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

            <div className="mt-6 space-y-4">
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
                    {(() => {
                      const identity = getDisplayIdentity(c.user_id, c.user);
                      return (
                        <div className="flex items-start gap-3">
                          {identity.avatarUrl ? (
                            <Image src={identity.avatarUrl} alt={identity.name} width={44} height={44} className="w-11 h-11 rounded-2xl object-cover" />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black shrink-0">
                              {identity.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-black text-gray-900">{identity.name}</div>
                            <div className="mt-3 text-gray-700 font-medium whitespace-pre-wrap">{c.body}</div>
                          </div>
                        </div>
                      );
                    })()}
                    {canEdit(c.user_id) ? (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(t("common_confirm_delete"))) return;
                            try {
                              await api.community.deleteComment(c.id);
                              setComments((prev) => prev.filter((x) => x.id !== c.id));
                              setPost((prev) => (prev ? { ...prev, comments_count: Math.max(0, prev.comments_count - 1) } : prev));
                            } catch {}
                          }}
                          className="px-4 py-2 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 text-sm font-black text-gray-800 transition-all"
                        >
                          {t("common_delete")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          {editOpen ? (
            <div
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => (editSaving ? undefined : setEditOpen(false))}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-2xl bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-2xl font-black text-gray-900">{t("community_edit_post")}</div>
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={() => setEditOpen(false)}
                      className="px-4 py-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 font-black text-gray-800 disabled:opacity-60"
                    >
                      {t("common_close")}
                    </button>
                  </div>

                  <div className="mt-6 space-y-3">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("community_compose_title_placeholder")}
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={6}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("community_compose_body_placeholder")}
                    />
                    <button
                      type="button"
                      disabled={editSaving}
                      onClick={async () => {
                        const title = editTitle.trim();
                        const body = editBody.trim();
                        if (!title || !body) return;
                        setEditSaving(true);
                        setBanner(null);
                        try {
                          const updated = await api.community.updatePost(post.id, { title, body });
                          setPost(updated);
                          setEditOpen(false);
                          if (updated.status && updated.status !== "approved") {
                            setBanner({ type: "success", text: t("community_pending_review") });
                          } else {
                            setBanner({ type: "success", text: t("community_save_post") });
                          }
                        } catch (e) {
                          setBanner({ type: "error", text: e instanceof Error ? e.message : t("community_post_failed") });
                        } finally {
                          setEditSaving(false);
                        }
                      }}
                      className={`w-full font-black py-4 px-6 rounded-2xl transition ${
                        editSaving ? "bg-gray-100 text-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                      }`}
                    >
                      {editSaving ? t("common_please_wait") : t("community_save_post")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {reportOpen ? (
            <div
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => (reportSaving ? undefined : setReportOpen(false))}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-xl bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-2xl font-black text-gray-900">{t("community_report_title")}</div>
                    <button
                      type="button"
                      disabled={reportSaving}
                      onClick={() => setReportOpen(false)}
                      className="px-4 py-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 font-black text-gray-800 disabled:opacity-60"
                    >
                      {t("common_close")}
                    </button>
                  </div>
                  <div className="mt-2 text-gray-500 font-medium">{t("community_report_subtitle")}</div>

                  <div className="mt-6 space-y-3">
                    <textarea
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      rows={5}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("community_report_placeholder")}
                    />
                    <button
                      type="button"
                      disabled={reportSaving}
                      onClick={async () => {
                        setReportSaving(true);
                        setBanner(null);
                        try {
                          await api.community.report(post.id, reportReason.trim() || null);
                          setReportOpen(false);
                          setBanner({ type: "success", text: t("community_report_success") });
                        } catch (e) {
                          setBanner({ type: "error", text: e instanceof Error ? e.message : t("community_report_failed") });
                        } finally {
                          setReportSaving(false);
                        }
                      }}
                      className={`w-full font-black py-4 px-6 rounded-2xl transition ${
                        reportSaving ? "bg-gray-100 text-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                      }`}
                    >
                      {reportSaving ? t("common_please_wait") : t("community_report_submit")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
