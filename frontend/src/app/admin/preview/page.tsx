"use client";

import { api, getStoredToken, getStoredTokenPayload, setSessionToken } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BACKUP_TOKEN_KEY = "admin_preview_backup_token";

export default function AdminPreviewPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const sp = useSearchParams();
  const roleRaw = (sp.get("role") || "").trim().toLowerCase();
  const role = roleRaw === "agency" ? "agency" : roleRaw === "user" ? "user" : null;
  const error = useMemo(() => {
    const flag = (sp.get("error") || "").trim();
    if (!flag) return null;
    return "Unable to start preview mode.";
  }, [sp]);

  useEffect(() => {
    if (!role) {
      router.replace("/admin");
      return;
    }
    if (error) return;

    const token = getStoredToken();
    const payload = getStoredTokenPayload();
    const currentRole = typeof payload?.role === "string" ? payload.role.toLowerCase() : null;
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    if (currentRole !== "admin") {
      router.replace(currentRole === "agency" ? "/agency" : "/dashboard");
      return;
    }

    try {
      const existingBackup = localStorage.getItem(BACKUP_TOKEN_KEY);
      if (!existingBackup) localStorage.setItem(BACKUP_TOKEN_KEY, token);
    } catch {
      router.replace(`/admin/preview?role=${role}&error=1`);
      return;
    }

    void (async () => {
      try {
        const res = await api.auth.adminImpersonate({ role });
        if (res?.access_token) {
          setSessionToken(res.access_token);
          router.replace(role === "agency" ? "/agency" : "/dashboard");
          return;
        }
        router.replace(`/admin/preview?role=${role}&error=1`);
      } catch {
        router.replace(`/admin/preview?role=${role}&error=1`);
      }
    })();
  }, [error, role, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 max-w-lg w-full text-center">
        <div className="text-6xl mb-4">👁️</div>
        <div className="text-2xl font-black text-gray-900">{t("common_loading")}</div>
        {error ? <div className="mt-4 text-sm font-bold text-red-700">{error}</div> : null}
        <button
          type="button"
          onClick={() => router.replace("/admin")}
          className="mt-6 bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-5 py-3 rounded-2xl transition"
        >
          Back to admin
        </button>
      </div>
    </div>
  );
}
