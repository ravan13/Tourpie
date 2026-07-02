"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, broadcastLogout, clearSessionToken, getStoredTokenPayload, isAuthErrorMessage, markSessionExpired } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const payload = getStoredTokenPayload();
      const role = typeof payload?.role === "string" ? payload.role : null;
      if (!role) {
        router.replace("/login");
        return;
      }
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
          router.replace("/login");
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (isAuthErrorMessage(message)) {
          markSessionExpired("auth");
          broadcastLogout("auth");
          clearSessionToken();
          router.replace("/login?reason=session_expired");
          return;
        }
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-bold text-gray-500">{t("common_loading")}</div>
      </div>
    );
  }

  return children;
}
