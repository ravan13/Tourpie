"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Logo from "@/components/Logo";
import { clearSessionToken, getStoredTokenPayload } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

export default function AgencyRejectedPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const payload = getStoredTokenPayload();
  const role = typeof payload?.role === "string" ? payload.role : null;
  const agencyStatus = typeof payload?.agency_status === "string" ? payload.agency_status : null;
  const statusValue = (agencyStatus || "").toLowerCase();

  useEffect(() => {
    if (role !== "agency") {
      router.replace(role === "admin" ? "/admin" : role === "user" ? "/dashboard" : "/login");
      return;
    }
    if (statusValue === "approved") {
      router.replace("/agency");
      return;
    }
    if (statusValue !== "rejected") {
      router.replace("/agency/pending-review");
      return;
    }
  }, [router, role, statusValue]);

  if (role !== "agency" || statusValue === "approved" || statusValue !== "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-bold text-gray-500">{t("common_loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-10">
          <Logo />
          <Link href="/" className="text-sm font-bold text-gray-700 hover:text-blue-600">
            {t("agency_register_back_home")}
          </Link>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">{t("agency_rejected_title")}</h1>
          <p className="text-gray-500 font-medium mb-6">{t("agency_rejected_subtitle")}</p>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-rose-800 font-bold">
            {t("agency_rejected_note")}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/agency/register"
              prefetch={false}
              className="flex-1 bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-4 rounded-2xl transition duration-200 text-center"
            >
              {t("agency_rejected_retry")}
            </Link>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await clearSessionToken();
                  router.replace("/login");
                })();
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition duration-200 shadow-lg shadow-blue-100"
            >
              {t("nav_logout")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
