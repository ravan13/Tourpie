"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, Conversation, getStoredToken, Message } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function MessagesPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setConversations([]);
        setActiveId(null);
        setMessages([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const convs = await api.messages.listConversations();
        setConversations(convs);
        const q = searchParams.get("conversation");
        const qId = q ? Number(q) : NaN;
        const initial = Number.isFinite(qId) ? qId : convs[0]?.id;
        if (initial) {
          setMessages([]);
          setActiveId(initial);
        }
      } catch {
        setConversations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    if (!activeId) return;
    const loadMessages = async () => {
      try {
        const msgs = await api.messages.listMessages(activeId);
        setMessages(msgs);
      } catch {
        setMessages([]);
      }
    };
    void loadMessages();
  }, [activeId]);

  return (
    <DashboardShell title={t("dash_messages_title")} subtitle={t("dash_messages_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : conversations.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">💬</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_messages_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_messages_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50">
              <div className="p-5 font-black text-gray-900">{t("dash_messages_inbox")}</div>
              <div className="px-3 pb-3 space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setActiveId(c.id);
                    }}
                    className={`w-full text-left rounded-2xl px-4 py-4 border transition ${
                      activeId === c.id ? "bg-white border-blue-100 shadow-sm" : "bg-white/60 border-gray-100 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-black text-gray-900">
                        {t("dash_messages_thread", { id: c.id })}
                      </div>
                      <div className="text-xs font-black text-gray-400">{new Date(c.updated_at).toLocaleDateString()}</div>
                    </div>
                    <div className="mt-2 text-sm font-bold text-gray-500">
                      {c.package_id ? t("dash_messages_related_package", { id: c.package_id }) : t("dash_messages_general")}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8">
              {!activeId ? (
                <div className="p-10 text-center text-gray-500 font-bold">{t("dash_messages_select")}</div>
              ) : (
                <div className="flex flex-col h-[70vh]">
                  <div className="flex-1 overflow-auto p-6 space-y-3 bg-white">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 font-bold py-10">{t("dash_messages_no_messages")}</div>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-2xl px-5 py-4 border ${
                            m.sender_role === "user"
                              ? "ml-auto bg-blue-600 text-white border-blue-600"
                              : "mr-auto bg-gray-50 text-gray-900 border-gray-100"
                          }`}
                        >
                          <div className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{m.content}</div>
                          <div className={`mt-2 text-[11px] font-black ${m.sender_role === "user" ? "text-blue-100" : "text-gray-400"}`}>
                            {new Date(m.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!activeId) return;
                      const content = draft.trim();
                      if (!content) return;
                      setSending(true);
                      void (async () => {
                        try {
                          const sent = await api.messages.sendMessage(activeId, content);
                          setMessages((prev) => [...prev, sent]);
                          setDraft("");
                          setConversations((prev) =>
                            prev.map((c) => (c.id === activeId ? { ...c, updated_at: new Date().toISOString() } : c))
                          );
                        } catch {
                          return;
                        } finally {
                          setSending(false);
                        }
                      })();
                    }}
                    className="border-t border-gray-100 bg-white p-4"
                  >
                    <div className="flex gap-3">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t("dash_messages_placeholder")}
                      />
                      <button
                        type="submit"
                        disabled={sending}
                        className={`px-6 py-4 rounded-2xl font-black transition ${
                          sending ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                        }`}
                      >
                        {t("dash_messages_send")}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
