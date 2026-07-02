"use client";

import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useRef, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

type Faq = {
  q: string;
  a: string;
};

export default function SupportPage() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(0);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [helpQuery, setHelpQuery] = useState("");
  const [contactStatus, setContactStatus] = useState<"idle" | "success">("idle");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "success">("idle");
  const contactRef = useRef<HTMLDivElement | null>(null);
  const SUPPORT_EMAIL = "support@tourpie.travel";

  const faqs: Faq[] = [
    {
      q: t("support_faq_q1"),
      a: t("support_faq_a1"),
    },
    {
      q: t("support_faq_q2"),
      a: t("support_faq_a2"),
    },
    {
      q: t("support_faq_q3"),
      a: t("support_faq_a3"),
    },
    {
      q: t("support_faq_q4"),
      a: t("support_faq_a4"),
    },
  ];

  const topics = [
    { id: "account", title: t("support_topic_account"), icon: "👤" },
    { id: "bookings", title: t("support_topic_bookings"), icon: "🧾" },
    { id: "payments", title: t("support_topic_payments"), icon: "💳" },
    { id: "agencies", title: t("support_topic_agencies"), icon: "🏢" },
    { id: "security", title: t("support_topic_security"), icon: "🔐" },
    { id: "troubleshooting", title: t("support_topic_troubleshooting"), icon: "🛠️" },
  ];

  const filteredFaqs = faqs.filter((f) => {
    const q = helpQuery.trim().toLowerCase();
    if (!q) return true;
    return (f.q + " " + f.a).toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <PageHeader
        title={t("support_title")}
        subtitle={t("support_subtitle")}
        badge={t("support_badge")}
        imageUrl="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2000&auto=format&fit=crop"
      />

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("support_topics")}</div>
            <div className="grid grid-cols-2 gap-3">
              {topics.map((c) => (
                <button
                  key={c.title}
                  onClick={() => {
                    setActiveTopic(c.id);
                    setHelpQuery(c.title);
                  }}
                  className={`rounded-[1.5rem] border border-gray-100 transition-all p-4 text-left ${
                    activeTopic === c.id ? "bg-blue-600 text-white" : "bg-gray-50 hover:bg-blue-600 hover:text-white"
                  }`}
                >
                  <div className="text-2xl">{c.icon}</div>
                  <div className="mt-3 font-black">{c.title}</div>
                  <div className="text-xs font-bold opacity-70 mt-1">{t("support_browse")}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("support_live_chat")}</div>
            <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
              <div className="font-black text-gray-900">{t("support_chat_title")}</div>
              <div className="text-gray-500 font-medium mt-2">{t("support_chat_subtitle")}</div>
              <button
                type="button"
                onClick={() => contactRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="mt-4 w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition-all"
              >
                {t("support_start_chat")}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("support_legal")}</div>
            <div className="flex flex-col gap-2">
              <Link href="/terms" className="text-left font-black text-gray-900 hover:text-blue-600 transition-colors">
                {t("support_terms")}
              </Link>
              <Link href="/privacy" className="text-left font-black text-gray-900 hover:text-blue-600 transition-colors">
                {t("support_privacy")}
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{t("support_search_help")}</div>
            <div className="relative">
              <input
                value={helpQuery}
                onChange={(e) => {
                  setHelpQuery(e.target.value);
                  setActiveTopic(null);
                }}
                placeholder={t("support_search_placeholder")}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 pl-12 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔎</div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <div className="text-3xl font-black text-gray-900">{t("support_faq_title")}</div>
                <div className="text-gray-500 font-medium mt-2">{t("support_faq_subtitle")}</div>
              </div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("support_faq_mode")}</div>
            </div>

            <div className="space-y-3">
              {filteredFaqs.map((item, idx) => {
                const isOpen = open === idx;
                return (
                  <button
                    key={item.q}
                    onClick={() => setOpen(isOpen ? null : idx)}
                    className="w-full text-left rounded-[1.75rem] border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-all p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-black text-gray-900">{item.q}</div>
                      <div className="text-gray-500 font-black">{isOpen ? "−" : "+"}</div>
                    </div>
                    {isOpen && (
                      <div className="mt-3 text-gray-600 font-medium leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={contactRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
              <div className="text-xl font-black text-gray-900">{t("support_contact_title")}</div>
              <div className="text-gray-500 font-medium mt-2">{t("support_contact_subtitle")}</div>
              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const email = String(data.get("email") || "").trim();
                  const subject = String(data.get("subject") || "").trim();
                  const message = String(data.get("message") || "").trim();
                  const body = `${t("support_mailto_from")} ${email}\n\n${message}`.trim();
                  const href = `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  window.location.href = href;
                  setContactStatus("success");
                  (e.currentTarget as HTMLFormElement).reset();
                }}
              >
                <input
                  required
                  name="email"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t("support_contact_email")}
                />
                <input
                  required
                  name="subject"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t("support_contact_subject")}
                />
                <textarea
                  required
                  name="message"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder={t("support_contact_message")}
                />
                <button className="w-full bg-gray-900 hover:bg-blue-600 text-white font-black py-3 rounded-2xl transition-all">
                  {t("support_submit")}
                </button>
                {contactStatus === "success" && (
                  <div className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-2xl p-4">
                    {t("support_contact_success")}
                  </div>
                )}
                <div className="text-xs font-bold text-gray-400">
                  {t("support_contact_alt")}{" "}
                  <a className="underline hover:text-blue-600" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
              <div className="text-xl font-black text-gray-900">{t("support_feedback_title")}</div>
              <div className="text-gray-500 font-medium mt-2">{t("support_feedback_subtitle")}</div>
              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const category = String(data.get("category") || "").trim();
                  const message = String(data.get("message") || "").trim();
                  const subject = `${t("support_feedback_email_subject_prefix")} ${category}`.trim();
                  const body = `${t("support_feedback_email_body_intro")}\n\n${message}`.trim();
                  const href = `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  window.location.href = href;
                  setFeedbackStatus("success");
                  (e.currentTarget as HTMLFormElement).reset();
                }}
              >
                <select
                  name="category"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Bug">{t("support_feedback_bug")}</option>
                  <option value="Feature">{t("support_feedback_feature")}</option>
                  <option value="Feedback">{t("support_feedback_feedback")}</option>
                  <option value="Security">{t("support_feedback_security")}</option>
                </select>
                <textarea
                  required
                  name="message"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={6}
                  placeholder={t("support_feedback_message")}
                />
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl transition-all shadow-lg shadow-blue-100">
                  {t("support_send")}
                </button>
                {feedbackStatus === "success" && (
                  <div className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-2xl p-4">
                    {t("support_feedback_success")}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

