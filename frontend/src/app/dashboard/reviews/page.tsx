"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, Booking, getStoredToken, Review } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo, useState } from "react";

export default function ReviewsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ package_id: number; package_title: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        const token = getStoredToken();
        if (!token) {
          setBookings([]);
          setReviews([]);
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const [mine, myReviews] = await Promise.all([api.bookings.getMine(), api.packages.listMyReviews()]);
          setBookings(mine);
          setReviews(myReviews);
        } catch {
          setBookings([]);
          setReviews([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const reviewedPackageIds = useMemo(() => new Set(reviews.map((r) => r.package_id)), [reviews]);
  const eligibleBookings = useMemo(
    () =>
      bookings
        .filter((b) => ["completed", "confirmed"].includes((b.status || "").toLowerCase()))
        .filter((b) => !reviewedPackageIds.has(b.package_id)),
    [bookings, reviewedPackageIds]
  );

  const openCreate = (b: Booking) => {
    const title = b.package?.title || t("dash_reviews_package_fallback", { id: b.package_id });
    setReviewTarget({ package_id: b.package_id, package_title: title });
    setRating(5);
    setComment("");
    setReviewModalOpen(true);
  };

  const openEdit = (r: Review) => {
    const title = bookings.find((b) => b.package_id === r.package_id)?.package?.title || t("dash_reviews_package_fallback", { id: r.package_id });
    setReviewTarget({ package_id: r.package_id, package_title: title });
    setRating(Math.min(5, Math.max(1, Number(r.rating) || 5)));
    setComment(r.comment || "");
    setReviewModalOpen(true);
  };

  const submit = async () => {
    if (!reviewTarget) return;
    if (!getStoredToken()) {
      window.location.href = "/login";
      return;
    }
    const safeRating = Math.min(5, Math.max(1, Number(rating) || 5));
    setSaving(true);
    try {
      const created = await api.packages.createReview(reviewTarget.package_id, safeRating, comment.trim() || null);
      setReviews((prev) => {
        const next = prev.filter((x) => x.package_id !== created.package_id);
        return [created, ...next];
      });
      setReviewModalOpen(false);
    } catch {
      alert(t("dash_reviews_submit_failed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteMy = async (packageId: number) => {
    if (!confirm(t("dash_reviews_delete_confirm"))) return;
    try {
      await api.packages.deleteMyReview(packageId);
      setReviews((prev) => prev.filter((r) => r.package_id !== packageId));
    } catch {
      alert(t("dash_reviews_delete_failed"));
    }
  };

  return (
    <DashboardShell title={t("dash_reviews_title")} subtitle={t("dash_reviews_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : (
          <div className="space-y-8">
            <div className="bg-gray-50 rounded-[2rem] border border-gray-100 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-gray-900">{t("dash_reviews_pending_title")}</div>
                  <div className="text-sm font-bold text-gray-500 mt-1">{t("dash_reviews_pending_subtitle")}</div>
                </div>
                <div className="text-sm font-black text-gray-900">{eligibleBookings.length}</div>
              </div>
              {eligibleBookings.length === 0 ? (
                <div className="mt-4 text-sm font-bold text-gray-500">{t("dash_reviews_pending_empty")}</div>
              ) : (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {eligibleBookings.map((b) => (
                    <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                      <div className="font-black text-gray-900">{b.package?.title || `Package #${b.package_id}`}</div>
                      <div className="text-xs font-bold text-gray-400 mt-1">
                        {t("dash_reviews_travel_date", { date: new Date(b.travel_date).toLocaleDateString() })}
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreate(b)}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-2xl transition"
                      >
                        {t("dash_reviews_write")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-gray-900">{t("dash_reviews_your_title")}</div>
                  <div className="text-sm font-bold text-gray-500 mt-1">{t("dash_reviews_your_subtitle")}</div>
                </div>
                <div className="text-sm font-black text-gray-900">{reviews.length}</div>
              </div>
              {reviews.length === 0 ? (
                <div className="mt-4 text-sm font-bold text-gray-500">{t("dash_reviews_placeholder_subtitle")}</div>
              ) : (
                <div className="mt-5 space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-black text-gray-900">
                            {bookings.find((b) => b.package_id === r.package_id)?.package?.title || `Package #${r.package_id}`}
                          </div>
                          <div className="text-xs font-black text-gray-400 mt-1">{new Date(r.created_at).toLocaleString()}</div>
                        </div>
                        <div className="text-lg font-black text-blue-600">{r.rating}/5</div>
                      </div>
                      {r.comment ? <div className="mt-3 text-sm font-bold text-gray-600">{r.comment}</div> : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
                        >
                          {t("common_edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteMy(r.package_id)}
                          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
                        >
                          {t("common_delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {reviewModalOpen && reviewTarget ? (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setReviewModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-2xl font-black text-gray-900">{t("dash_reviews_modal_title")}</div>
                  <div className="mt-1 text-sm text-gray-500 font-bold truncate">{reviewTarget.package_title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 font-black text-gray-800"
                >
                  {t("common_close")}
                </button>
              </div>

              <div className="mt-6">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("dash_reviews_rating_label")}</div>
                <div className="mt-3 flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRating(v)}
                      className={`h-11 w-11 rounded-2xl border font-black transition ${
                        rating >= v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                      }`}
                      aria-label={`${v}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("dash_reviews_comment_placeholder")}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void submit()}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-black py-3 rounded-2xl transition-all shadow-lg shadow-blue-100"
              >
                {saving ? t("common_please_wait") : t("dash_reviews_submit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
