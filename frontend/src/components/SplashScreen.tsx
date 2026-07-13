"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

type SplashScreenProps = {
  progress?: number;
  exiting?: boolean;
  entered?: boolean;
  message?: string;
  messageKey?: string;
};

function TravelLoader({ progress }: { progress: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <div className="mt-8 w-full max-w-[420px]">
      <div className="tp-loader-progress-track">
        <div className="tp-loader-progress-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

function WorldMapBackdrop() {
  return (
    <div className="absolute inset-0 opacity-[0.08]">
      <svg className="tp-loader-map absolute inset-0 h-full w-full" viewBox="0 0 1200 700" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="tpMapStroke" x1="0" y1="0" x2="1200" y2="700" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#A8D8FF" stopOpacity="0.65" />
            <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="1" stopColor="#FF6A1A" stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id="tpDotGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0) rotate(90) scale(16 16)">
            <stop stopColor="white" stopOpacity="0.42" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g opacity="0.95">
          <path
            d="M120 380 C 220 250, 370 240, 480 310 S 700 410, 840 320 S 1040 240, 1120 310"
            stroke="url(#tpMapStroke)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="2 14"
            className="tp-loader-route"
          />
          <path
            d="M140 440 C 260 520, 420 520, 540 450 S 780 310, 980 390 S 1090 480, 1140 520"
            stroke="url(#tpMapStroke)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="2 16"
            opacity="0.8"
            className="tp-loader-route"
          />
        </g>

        <g opacity="0.9">
          {[
            [210, 340],
            [280, 300],
            [360, 320],
            [450, 360],
            [560, 330],
            [680, 360],
            [760, 300],
            [850, 340],
            [940, 320],
            [1040, 360],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`} className="tp-loader-pin">
              <circle cx="0" cy="0" r="14" fill="url(#tpDotGlow)" />
              <circle cx="0" cy="0" r="2.6" fill="white" opacity="0.65" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function OrbitProgress({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = 56;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped);
  return (
    <svg
      className="tp-loader-orbit-ring pointer-events-none"
      width="140"
      height="140"
      viewBox="0 0 140 140"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tpOrbitGrad" x1="0" y1="0" x2="140" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A8D8FF" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FF6A1A" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="url(#tpOrbitGrad)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        className="tp-loader-orbit-progress"
      />
    </svg>
  );
}

function OrbitPlane() {
  return (
    <div className="tp-loader-orbit">
      <div className="tp-loader-orbit-rot">
        <div className="tp-loader-orbit-plane">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21.9 11.1 3.8 3.3c-.9-.38-1.76.48-1.38 1.38l2.92 6.82 7.2 1.2-7.2 1.2-2.92 6.82c-.38.9.48 1.76 1.38 1.38l18.1-7.8a1.2 1.2 0 0 0 0-2.2Z"
              fill="white"
              opacity="0.92"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Sparkles() {
  const items = [
    { left: "12%", top: "18%", size: 6, delay: "0s" },
    { left: "22%", top: "72%", size: 5, delay: "0.8s" },
    { left: "34%", top: "40%", size: 4, delay: "1.4s" },
    { left: "58%", top: "22%", size: 6, delay: "1.1s" },
    { left: "72%", top: "56%", size: 5, delay: "0.4s" },
    { left: "86%", top: "30%", size: 4, delay: "1.8s" },
    { left: "78%", top: "78%", size: 6, delay: "2.1s" },
    { left: "16%", top: "44%", size: 4, delay: "2.4s" },
  ];
  return (
    <div className="absolute inset-0 opacity-[0.1] pointer-events-none">
      {items.map((s) => (
        <span
          key={`${s.left}-${s.top}`}
          className="tp-loader-sparkle"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}
    </div>
  );
}

export function SplashScreen({ progress = 0.12, exiting = false, entered = true, message, messageKey }: SplashScreenProps) {
  const { t } = useLanguage();

  return (
    <div
      className={[
        "fixed inset-0 z-[1000] flex items-center justify-center",
        "tp-splash-gradient text-white",
        "transition-[opacity,transform] duration-700 ease-out will-change-transform",
        entered ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]",
        exiting ? "opacity-0 scale-[0.985]" : "",
      ].join(" ")}
      role="status"
      aria-label={t("common_loading")}
      aria-live="polite"
      aria-busy="true"
    >
      <WorldMapBackdrop />
      <div className="tp-loader-scan" aria-hidden="true" />
      <Sparkles />
      <div className="absolute inset-0 opacity-100">
        <div className="tp-float tp-float-1 absolute -top-10 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="tp-float tp-float-2 absolute top-[18%] -right-14 h-56 w-56 rounded-full bg-[#FF6A1A]/16 blur-3xl" />
        <div className="tp-float tp-float-3 absolute bottom-[-10%] left-[18%] h-64 w-64 rounded-full bg-[#A8D8FF]/16 blur-3xl" />
      </div>

      <div className="relative w-full px-6">
        <div className="mx-auto max-w-[560px] rounded-[28px] sm:rounded-[34px] bg-white/8 border border-white/12 shadow-[0_22px_70px_rgba(2,42,107,0.34)] backdrop-blur-xl px-7 sm:px-10 py-10 sm:py-12">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <OrbitProgress progress={progress} />
              <OrbitPlane />
              <div className="tp-loader-logo relative h-[92px] w-[92px] sm:h-[108px] sm:w-[108px] rounded-[26px] sm:rounded-[30px] bg-white/10 border border-white/15 shadow-[0_14px_42px_rgba(0,0,0,0.18)] mx-auto">
                <Image src="/tourpie_icon.svg" alt="TourPie" fill priority sizes="108px" className="object-contain p-4" />
              </div>
            </div>

            <TravelLoader progress={progress} />

            <div className="tp-loader-text mt-6 text-sm sm:text-[0.96rem] font-semibold tracking-[-0.01em] text-white/80">
              <span key={messageKey || "default"} className="tp-loader-text-swap">
                {message || t("global_loader_message")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SplashGate({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(0.14);
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [entered, setEntered] = useState(false);
  const readyRef = useRef(false);
  const startRef = useRef<number>(typeof window === "undefined" ? 0 : Date.now());
  const [messageIndex, setMessageIndex] = useState(0);

  const readyNow = useMemo(() => {
    if (hidden) return true;
    return false;
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;

    const enter = window.setTimeout(() => setEntered(true), 40);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(enter);
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
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return;
    const interval = window.setInterval(() => setMessageIndex((i) => (i + 1) % 6), 2400);
    return () => window.clearInterval(interval);
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;

    const complete = () => {
      if (readyRef.current) return;
      const MIN_DURATION_MS = 2400;
      const elapsed = Date.now() - startRef.current;
      const delay = Math.max(0, MIN_DURATION_MS - elapsed);
      window.setTimeout(() => {
        if (readyRef.current) return;
        readyRef.current = true;
        setProgress(1);
        setExiting(true);
        window.setTimeout(() => setHidden(true), 720);
      }, delay);
    };

    const already = document.documentElement.dataset.tourpieReady === "1";
    if (already) {
      complete();
      return;
    }

    const onReady = () => complete();
    window.addEventListener("tourpie:app-ready", onReady);

    const fallback = window.setTimeout(() => complete(), 10000);
    return () => {
      window.removeEventListener("tourpie:app-ready", onReady);
      window.clearTimeout(fallback);
    };
  }, [hidden]);

  return (
    <>
      {children}
      {readyNow ? null : (
        <SplashScreen
          progress={progress}
          exiting={exiting}
          entered={entered}
          message={[
            t("global_loader_msg_1"),
            t("global_loader_msg_2"),
            t("global_loader_msg_3"),
            t("global_loader_msg_4"),
            t("global_loader_msg_5"),
            t("global_loader_msg_6"),
          ][messageIndex]}
          messageKey={`msg-${messageIndex}`}
        />
      )}
    </>
  );
}
