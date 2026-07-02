"use client";

import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function TermsPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <PageHeader
        title={t("terms_title")}
        subtitle={t("terms_subtitle")}
        badge={t("terms_badge")}
        imageUrl="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2000&auto=format&fit=crop"
      />

      <div className="mt-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
          {t("terms_last_updated_label")} <span className="text-gray-900">{t("terms_last_updated_value")}</span>
        </div>

        <div className="mt-8 space-y-8">
          <section>
            <div className="text-lg font-black text-gray-900">{t("terms_section_intro_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("terms_section_intro_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("terms_section_accounts_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("terms_section_accounts_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("terms_section_marketplace_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("terms_section_marketplace_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("terms_section_payments_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("terms_section_payments_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("terms_section_content_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">{t("terms_section_content_body")}</div>
          </section>

          <section>
            <div className="text-lg font-black text-gray-900">{t("terms_section_contact_title")}</div>
            <div className="mt-2 text-gray-600 font-medium leading-relaxed">
              {t("terms_section_contact_body")}{" "}
              <Link href="/support" prefetch={false} className="font-black text-blue-600 hover:text-blue-700">
                {t("terms_contact_support_link")}
              </Link>
              .
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

