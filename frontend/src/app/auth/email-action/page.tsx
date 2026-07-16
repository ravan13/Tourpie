"use client";

import { api, requestCurrentUserRefresh, setSessionToken } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function EmailActionPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const mode = searchParams.get("mode");
    const token = searchParams.get("token");
    if (!mode || !token) {
      window.setTimeout(() => {
        setState("error");
        setMessage(t("account_email_action_invalid"));
      }, 0);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        if (mode === "verify-email") {
          await api.auth.verifyEmailLink(token);
          if (!cancelled) {
            setState("success");
            setMessage(t("account_email_verified_success"));
          }
          return;
        }
        if (mode === "confirm-email-change") {
          const auth = await api.auth.confirmEmailChange(token);
          await setSessionToken(auth.access_token);
          requestCurrentUserRefresh();
          if (!cancelled) {
            setState("success");
            setMessage(t("account_email_updated_success"));
          }
          window.setTimeout(() => router.replace("/dashboard/settings"), 1200);
          return;
        }
        if (!cancelled) {
          setState("error");
          setMessage(t("account_email_action_invalid"));
        }
      } catch (e) {
        if (cancelled) return;
        setState("error");
        setMessage(e instanceof Error ? e.message : t("account_email_action_failed"));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams, t]);

  return (
    <div className="min-h-[70vh] bg-gray-50 flex items-center justify-center px-4 py-14">
      <div className="w-full max-w-lg rounded-[2.5rem] border border-gray-100 bg-white shadow-[0_28px_90px_rgba(2,42,107,0.12)] p-8 text-center">
        <div className="text-5xl">{state === "loading" ? "✉️" : state === "success" ? "✓" : "!"}</div>
        <div className="mt-5 text-2xl font-black text-gray-900">
          {state === "loading" ? t("common_loading") : state === "success" ? t("account_email_action_complete") : t("account_email_action_error")}
        </div>
        <div className="mt-3 text-sm font-medium text-gray-500">{message}</div>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 transition">
            {t("nav_login")}
          </Link>
          <Link href="/" className="rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-6 py-3 transition">
            {t("nav_explore")}
          </Link>
        </div>
      </div>
    </div>
  );
}
