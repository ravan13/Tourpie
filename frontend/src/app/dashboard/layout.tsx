"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { broadcastLogout, clearSessionToken, getStoredTokenPayload, markSessionExpired } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { authReady, user } = useCurrentUser();

  useEffect(() => {
    if (!authReady) return;
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
    if (!user) {
      void (async () => {
        markSessionExpired("auth");
        broadcastLogout("auth");
        await clearSessionToken();
        router.replace("/login?reason=session_expired");
      })();
      return;
    }
    if (user.onboarding_completed === false) {
      router.replace("/login");
      return;
    }
  }, [authReady, router, user]);

  const payload = getStoredTokenPayload();
  const role = typeof payload?.role === "string" ? payload.role : null;
  const ready = authReady && role === "user" && !!user && user.onboarding_completed !== false;

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-bold text-gray-500">{t("common_loading")}</div>
      </div>
    );
  }

  return children;
}
