"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
  iconOnly?: boolean;
  showTagline?: boolean;
}

function BrandIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} aria-hidden="true">
      <Image
        src="/tourpie_icon.svg"
        alt=""
        fill
        sizes="40px"
        className="bg-transparent object-contain object-center"
        priority
      />
    </span>
  );
}

export default function Logo({
  className = "",
  variant = "dark",
  iconOnly = false,
  showTagline = false,
}: LogoProps) {
  const { t } = useLanguage();
  const tourColor = variant === "light" ? "text-white" : "text-[#022A6B]";
  const taglineColor = variant === "light" ? "text-white/75" : "text-slate-500";

  const wordmark = (
    <span
      className="text-[1.75rem] font-bold tracking-[-0.04em] leading-none"
      style={{ fontFamily: "Poppins, Arial, sans-serif" }}
    >
      <span className={tourColor}>Tour</span>
      <span className="text-[#FF6A1A]">Pie</span>
    </span>
  );

  return (
    <Link
      href="/"
      className={
        showTagline
          ? `inline-flex flex-col items-center ${className}`
          : `inline-flex items-center gap-[10px] ${className}`
      }
      aria-label="TourPie home"
    >
      {showTagline ? (
        <>
          <span className="inline-flex items-center gap-[10px]">
            <BrandIcon className="h-10 w-10 shrink-0 translate-y-[1px]" />
            {iconOnly ? null : wordmark}
          </span>
          {iconOnly ? null : (
            <span className={`mt-1 block w-full text-[0.72rem] font-semibold tracking-[-0.01em] text-center ${taglineColor}`}>
              {t("brand_tagline")}
            </span>
          )}
        </>
      ) : (
        <>
          <BrandIcon className="h-10 w-10 shrink-0 translate-y-[1px]" />
          {iconOnly ? null : wordmark}
        </>
      )}
    </Link>
  );
}
