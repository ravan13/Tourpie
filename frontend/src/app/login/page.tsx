"use client";

import AuthForms from "@/components/AuthForms";
import Logo from "@/components/Logo";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { api, clearSessionToken, getStoredTokenPayload, getStoredToken, isAuthErrorMessage, SESSION_EXPIRED_KEY } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const reason = searchParams?.get("reason");
      if (reason === "session_expired") {
        setExpiredNotice(t("session_expired_message"));
      }
      try {
        const raw = localStorage.getItem(SESSION_EXPIRED_KEY);
        if (!raw) return;
        setExpiredNotice(t("session_expired_message"));
        localStorage.removeItem(SESSION_EXPIRED_KEY);
      } catch {
        return;
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [searchParams, t]);

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setReady(true);
        return;
      }

      const decoded = getStoredTokenPayload();
      const role = typeof decoded?.role === "string" ? decoded.role : null;
      if (role === "admin") {
        router.replace("/admin");
        return;
      }
      if (role === "agency") {
        router.replace("/agency");
        return;
      }
      try {
        const me = await api.auth.me();
        if (me?.onboarding_completed === false) {
          setReady(true);
          return;
        }
        router.replace("/dashboard");
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (isAuthErrorMessage(message)) {
          clearSessionToken();
        }
        setReady(true);
      }
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-sm font-bold text-gray-500">{t("common_loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 flex flex-col items-center">
          <Logo className="mb-4" />
            <p className="text-sm text-gray-500 font-medium text-center">{t("brand_login_slogan")}</p>
        </div>
        {expiredNotice ? (
          <div className="mb-6 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl px-5 py-4 font-bold text-sm">
            {expiredNotice}
          </div>
        ) : null}
        <AuthForms />
        <div className="mt-6 text-center">
          <Link href="/agency/register" prefetch={false} className="text-sm font-bold text-blue-600 hover:underline">
            {t("agency_register_cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
