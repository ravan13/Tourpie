"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, broadcastLogout, clearSessionToken, getStoredTokenPayload, isAuthErrorMessage, markSessionExpired } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      if (pathname.startsWith("/admin/login")) {
        setReady(true);
        return;
      }
      const payload = getStoredTokenPayload();
      const role = typeof payload?.role === "string" ? payload.role : null;
      if (role === "admin") {
        try {
          const me = await api.auth.me();
          if (me?.role !== "admin") {
            await clearSessionToken();
            router.replace("/admin/login");
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (isAuthErrorMessage(message)) {
            console.error("SESSION_EXPIRED_REDIRECT", {
              route: window.location.pathname,
              endpoint: "/users/me",
              status: "unknown",
              response: message,
            });
            markSessionExpired("auth");
            broadcastLogout("auth");
            await clearSessionToken();
            router.replace("/admin/login?reason=session_expired");
            return;
          }
        }
        setReady(true);
        return;
      }
      if (role === "agency") {
        router.replace("/agency");
        return;
      }
      if (role === "user") {
        router.replace("/dashboard");
        return;
      }
      router.replace("/admin/login");
    })();
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-bold text-gray-500">{t("common_loading")}</div>
      </div>
    );
  }

  return children;
}
