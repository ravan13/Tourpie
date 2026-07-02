"use client";

import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function PrivacyPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <PageHeader
        title={t("privacy_title")}
        subtitle={t("privacy_subtitle")}
        badge={t("privacy_badge")}
        imageUrl="https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=2000&auto=format&fit=crop"
      />

      <div className="mt-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
          {t("privacy_last_updated_label")} <span className="text-gray-900">{t("privacy_last_updated_value")}</span>
        </div>

        <div className="mt-8 space-y-8">
          <section>
            <div className="text-lg font-black text-gray-900">{t("privacy_section_intro_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("privacy_section_intro_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("privacy_section_data_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("privacy_section_data_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("privacy_section_cookies_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("privacy_section_cookies_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("privacy_section_sharing_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("privacy_section_sharing_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("privacy_section_rights_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("privacy_section_rights_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("privacy_section_contact_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">
              {t("privacy_section_contact_body")}{" "}
              <Link href="/support" prefetch={false} className="font-black text-blue-600 hover:text-blue-700">
                {t("privacy_contact_support_link")}
              </Link>
              .
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

