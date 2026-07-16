"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, broadcastLogout, clearSessionToken, getStoredTokenPayload, isAuthErrorMessage, markSessionExpired } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

export default function AgencyLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const debugRedirects = process.env.NEXT_PUBLIC_DEBUG_REDIRECTS === "1";
      const payload = getStoredTokenPayload();
      const role = typeof payload?.role === "string" ? payload.role : null;
      const agencyStatus = typeof payload?.agency_status === "string" ? payload.agency_status : null;
      const agencyIdRaw = payload?.agency_id;
      const agencyId = typeof agencyIdRaw === "number" ? agencyIdRaw : Number(agencyIdRaw);
      const sub = typeof payload?.sub === "string" ? payload.sub : null;
      if (debugRedirects) console.warn("[agency/layout] check", { pathname, role, agencyStatus, agencyId: Number.isFinite(agencyId) ? agencyId : null, sub });

      const statusValue = (agencyStatus || "").toLowerCase();
      const target =
        role === "agency"
          ? statusValue === "approved"
            ? "/agency"
            : statusValue === "rejected"
              ? "/agency/rejected"
              : "/agency/pending-review"
          : null;

      if (pathname.startsWith("/agency/register")) {
        if (!role) {
          if (debugRedirects) console.warn("[agency/layout] allow", { pathname, reason: "guest_register" });
          setReady(true);
          return;
        }
        if (role === "agency" && target) {
          if (debugRedirects) console.warn("[agency/layout] redirect", { from: pathname, to: target, reason: "agency_has_state" });
          router.replace(target);
          return;
        }
        if (role === "admin") {
          router.replace("/admin");
          return;
        }
        if (role === "user") {
          router.replace("/dashboard");
          return;
        }
        router.replace("/login");
        return;
      }

      if (pathname.startsWith("/agency/pending-review") || pathname.startsWith("/agency/rejected")) {
        if (!role) {
          router.replace("/login");
          return;
        }
        if (role === "agency" && target && target !== pathname) {
          if (debugRedirects) console.warn("[agency/layout] redirect", { from: pathname, to: target, reason: "status_route_mismatch" });
          router.replace(target);
          return;
        }
        if (role !== "agency") {
          router.replace(role === "admin" ? "/admin" : "/dashboard");
          return;
        }
        setReady(true);
        return;
      }

      if (role === "agency") {
        if (target && target !== "/agency") {
          if (debugRedirects) console.warn("[agency/layout] redirect", { from: pathname, to: target, agencyStatus });
          router.replace(target);
          return;
        }
        try {
          const me = await api.auth.me();
          if (me?.role !== "agency") {
            await clearSessionToken();
            if (debugRedirects) console.warn("[agency/layout] redirect", { from: pathname, to: "/login", reason: "role_mismatch" });
            router.replace("/login");
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (isAuthErrorMessage(message)) {
            markSessionExpired("auth");
            broadcastLogout("auth");
            await clearSessionToken();
            if (debugRedirects) console.warn("[agency/layout] redirect", { from: pathname, to: "/login?reason=session_expired", reason: "auth" });
            router.replace("/login?reason=session_expired");
            return;
          }
        }
        setReady(true);
        return;
      }
      if (role === "admin") {
        if (debugRedirects) console.warn("[agency/layout] redirect", { from: pathname, to: "/admin" });
        router.replace("/admin");
        return;
      }
      if (role === "user") {
        if (debugRedirects) console.warn("[agency/layout] redirect", { from: pathname, to: "/dashboard" });
        router.replace("/dashboard");
        return;
      }
      if (debugRedirects) console.warn("[agency/layout] redirect", { from: pathname, to: "/login" });
      router.replace("/login");
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
