"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, getStoredToken, Notification } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function NotificationsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notification[]>([]);

  const formatNotification = (n: Notification) => {
    if (!n.title || !n.title.startsWith("i18n:")) return { title: n.title, body: n.body || null };
    const key = n.title.slice("i18n:".length);
    if (key === "moderation_post_title") {
      let bodyText: string | null = null;
      if (n.body && n.body.startsWith("i18n:moderation_post_body:")) {
        const rest = n.body.slice("i18n:moderation_post_body:".length);
        const [status, ...noteParts] = rest.split(":");
        const note = noteParts.join(":").trim();
        const statusKey = status ? `moderation_status_${status}` : "moderation_status_pending_review";
        bodyText = t("moderation_notification_body", {
          status: t(statusKey),
          note: note ? `\n${t("moderation_note_label")}: ${note}` : "",
        });
      }
      return { title: t("moderation_notification_title"), body: bodyText };
    }
    return { title: n.title, body: n.body || null };
  };

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await api.notifications.list();
        setItems(data);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const unreadIds = useMemo(() => items.filter((n) => !n.is_read).map((n) => n.id), [items]);

  return (
    <DashboardShell title={t("dash_notifications_title")} subtitle={t("dash_notifications_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="text-sm font-black text-gray-500">
            {t("dash_notifications_unread", { count: unreadIds.length })}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={unreadIds.length === 0}
              onClick={() => {
                void (async () => {
                  try {
                    await api.notifications.markAllRead();
                    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
                  } catch {
                    return;
                  }
                })();
              }}
              className={`px-5 py-3 rounded-2xl border font-black transition ${
                unreadIds.length === 0 ? "bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t("dash_notifications_mark_all")}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="tp-motion-fade-up py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="tp-motion-fade-up py-12 text-center">
            <div className="text-6xl">🔔</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_notifications_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_notifications_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n, index) => {
              const display = formatNotification(n);
              return (
                <div
                  key={n.id}
                  className={`tp-motion-notification rounded-[2rem] border p-6 transition ${
                    n.is_read ? "bg-white border-gray-100" : "bg-blue-50 border-blue-100"
                  }`}
                  style={{ animationDelay: `${Math.min(index * 50, 220)}ms` }}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="font-black text-gray-900">{display.title}</div>
                      {display.body ? <div className="mt-2 text-gray-600 font-medium whitespace-pre-wrap">{display.body}</div> : null}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {n.link_url ? (
                        <Link href={n.link_url} prefetch={false} className="text-sm font-black text-blue-600 hover:underline">
                          {t("dash_notifications_view")}
                        </Link>
                      ) : null}
                      {!n.is_read ? (
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              try {
                                await api.notifications.markRead([n.id]);
                                setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
                              } catch {
                                return;
                              }
                            })();
                          }}
                          className="text-xs font-black px-4 py-2 rounded-xl bg-white border border-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white transition"
                        >
                          {t("dash_notifications_mark_read")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
