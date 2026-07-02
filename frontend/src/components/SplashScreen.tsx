"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

type SplashScreenProps = {
  progress?: number;
  exiting?: boolean;
  slogan?: string;
};

function Wordmark({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const tourColor = variant === "light" ? "text-white" : "text-[#022A6B]";
  return (
    <div
      className="text-[2.1rem] sm:text-[2.35rem] font-bold tracking-[-0.04em] leading-none"
      style={{ fontFamily: "Poppins, Arial, sans-serif" }}
    >
      <span className={tourColor}>Tour</span>
      <span className="text-[#FF6A1A]">Pie</span>
    </div>
  );
}

function TravelLoader({ progress }: { progress: number }) {
  const { t } = useLanguage();
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <div className="mt-8 w-full max-w-[420px]">
      <div className="mx-auto w-[320px] max-w-full">
        <div className="relative h-[86px]">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 320 86"
            aria-hidden="true"
            fill="none"
          >
            <defs>
              <linearGradient id="tpRoute" x1="0" y1="0" x2="320" y2="86" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#A8D8FF" stopOpacity="0.65" />
                <stop offset="0.55" stopColor="#FF6A1A" stopOpacity="0.55" />
                <stop offset="1" stopColor="#022A6B" stopOpacity="0.55" />
              </linearGradient>
              <radialGradient id="tpPinGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(42 58) rotate(90) scale(16 16)">
                <stop stopColor="white" stopOpacity="0.28" />
                <stop offset="1" stopColor="white" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="tpPinGlow2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(280 40) rotate(90) scale(18 18)">
                <stop stopColor="white" stopOpacity="0.22" />
                <stop offset="1" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>

            <path
              d="M20 60 C 84 10, 210 12, 300 40"
              stroke="url(#tpRoute)"
              strokeWidth="2.4"
              strokeLinecap="round"
              className="tp-route-dash"
              opacity="0.95"
            />

            <circle cx="42" cy="58" r="16" fill="url(#tpPinGlow)" />
            <circle cx="42" cy="58" r="5.5" fill="white" opacity="0.3" />
            <circle cx="42" cy="58" r="3.5" fill="#FF6A1A" opacity="0.9" />

            <circle cx="280" cy="40" r="18" fill="url(#tpPinGlow2)" />
            <circle cx="280" cy="40" r="5.5" fill="white" opacity="0.25" />
            <circle cx="280" cy="40" r="3.5" fill="#A8D8FF" opacity="0.9" />
          </svg>

          <div className="tp-plane absolute left-0 top-0 h-full w-full pointer-events-none">
            <div className="tp-plane-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21.9 11.1 3.8 3.3c-.9-.38-1.76.48-1.38 1.38l2.92 6.82 7.2 1.2-7.2 1.2-2.92 6.82c-.38.9.48 1.76 1.38 1.38l18.1-7.8a1.2 1.2 0 0 0 0-2.2Z"
                  fill="white"
                  opacity="0.92"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="h-2.5 rounded-full bg-white/15 border border-white/15 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#A8D8FF] via-white/70 to-[#FF6A1A] tp-progress-glow"
            style={{ width: `${pct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[0.82rem] font-bold text-white/80">
          <span className="sr-only" role="status" aria-live="polite">
            {t("common_loading")}
          </span>
          <span className="tabular-nums">{pct}%</span>
          <span className="text-white/70">{t("common_loading")}</span>
        </div>
      </div>
    </div>
  );
}

export function SplashScreen({ progress = 0.12, exiting = false, slogan }: SplashScreenProps) {
  const { t } = useLanguage();
  const line = slogan || t("splash_slogan");

  return (
    <div
      className={[
        "fixed inset-0 z-[1000] flex items-center justify-center",
        "tp-splash-gradient text-white",
        "transition-[opacity,transform] duration-500 ease-out will-change-transform",
        exiting ? "opacity-0 scale-[0.985]" : "opacity-100 scale-100",
      ].join(" ")}
      role="status"
      aria-label={t("common_loading")}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="absolute inset-0 opacity-100">
        <div className="tp-float tp-float-1 absolute -top-10 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="tp-float tp-float-2 absolute top-[18%] -right-14 h-56 w-56 rounded-full bg-[#FF6A1A]/20 blur-3xl" />
        <div className="tp-float tp-float-3 absolute bottom-[-10%] left-[18%] h-64 w-64 rounded-full bg-[#A8D8FF]/18 blur-3xl" />
        <div className="tp-route-float absolute top-[28%] left-[10%] h-[260px] w-[260px] rounded-[56px] border border-white/10 opacity-20 rotate-12" />
        <div className="tp-route-float absolute bottom-[18%] right-[12%] h-[220px] w-[220px] rounded-[54px] border border-white/10 opacity-20 -rotate-6" />
      </div>

      <div className="relative w-full px-6">
        <div className="mx-auto max-w-[560px] rounded-[28px] sm:rounded-[34px] bg-white/8 border border-white/12 shadow-[0_20px_60px_rgba(2,42,107,0.35)] backdrop-blur-xl px-7 sm:px-10 py-10 sm:py-12">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-[76px] w-[76px] sm:h-[92px] sm:w-[92px] rounded-[22px] sm:rounded-[26px] bg-white/10 border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
              <Image src="/tourpie_icon.svg" alt="" fill priority sizes="92px" className="object-contain p-3" />
            </div>

            <div className="mt-5">
              <Wordmark variant="light" />
              <div className="mt-3 text-sm sm:text-[0.96rem] font-semibold tracking-[-0.01em] text-white/78">
                {line}
              </div>
            </div>

            <TravelLoader progress={progress} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SplashGate({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState(0.14);
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const readyRef = useRef(false);

  const readyNow = useMemo(() => {
    if (hidden) return true;
    return false;
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;

    const tick = window.setInterval(() => {
      setProgress((p) => {
        if (readyRef.current) return 1;
        const next = Math.min(0.92, p + (p < 0.35 ? 0.04 : p < 0.7 ? 0.022 : 0.012));
        return next;
      });
    }, 90);

    return () => window.clearInterval(tick);
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;

    const complete = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      setProgress(1);
      setExiting(true);
      window.setTimeout(() => setHidden(true), 520);
    };

    const already = document.documentElement.dataset.tourpieReady === "1";
    if (already) {
      complete();
      return;
    }

    const onReady = () => complete();
    window.addEventListener("tourpie:app-ready", onReady);

    const fallback = window.setTimeout(() => complete(), 1400);
    return () => {
      window.removeEventListener("tourpie:app-ready", onReady);
      window.clearTimeout(fallback);
    };
  }, [hidden]);

  return (
    <>
      {children}
      {readyNow ? null : <SplashScreen progress={progress} exiting={exiting} />}
    </>
  );
}
