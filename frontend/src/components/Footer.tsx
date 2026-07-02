"use client";

import Logo from "@/components/Logo";
import { useLanguage } from "@/context/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100 py-16 mt-20">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <Logo className="justify-center mb-4" showTagline />
        <p className="text-gray-400 text-sm font-medium">{t("footer_copyright", { year })}</p>
      </div>
    </footer>
  );
}

