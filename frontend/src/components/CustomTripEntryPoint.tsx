"use client";

import CustomTripRequestForm from "@/components/customTrip/CustomTripRequestForm";
import { useLanguage } from "@/context/LanguageContext";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PROMO_STORAGE_KEY = "tp_customTripPromo";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const IDLE_HINT_KEY = "tp_customTripIdleHintShown";

type PromoState = {
  lastShownAt?: number;
};

function readPromoState(): PromoState {
  try {
    const raw = localStorage.getItem(PROMO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      lastShownAt: typeof parsed.lastShownAt === "number" ? parsed.lastShownAt : undefined,
    };
  } catch {
    return {};
  }
}

function writePromoState(next: PromoState) {
  try {
    localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(next));
  } catch {
  }
}

function shouldShowPromo(now: number) {
  const state = readPromoState();
  if (!state.lastShownAt) return true;
  return now - state.lastShownAt > THIRTY_DAYS_MS;
}

export default function CustomTripEntryPoint() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetEntered, setSheetEntered] = useState(false);
  const [widgetReady, setWidgetReady] = useState(true);
  const [assistantExpanded, setAssistantExpanded] = useState(false);
  const [assistantHintActive, setAssistantHintActive] = useState(false);
  const [assistantDrawerOpen, setAssistantDrawerOpen] = useState(false);
  const [assistantDrawerEntered, setAssistantDrawerEntered] = useState(false);
  const [requestFlowOpen, setRequestFlowOpen] = useState(false);
  const [requestFlowEntered, setRequestFlowEntered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const assistantDrawerRef = useRef<HTMLDivElement | null>(null);
  const requestFlowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        setAssistantExpanded(false);
        setAssistantHintActive(false);
      }
    };
    syncPreference();
    media.addEventListener?.("change", syncPreference);
    return () => media.removeEventListener?.("change", syncPreference);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const eligible = pathname === "/" && shouldShowPromo(Date.now());
    window.setTimeout(() => setWidgetReady(!eligible), 0);

    if (!eligible) return;

    const scheduleSheet = () => {
      const timer = window.setTimeout(() => {
        setSheetOpen(true);
        window.setTimeout(() => setSheetEntered(true), 30);
      }, 2000);
      return () => window.clearTimeout(timer);
    };

    const alreadyReady = document.documentElement.dataset.tourpieReady === "1";
    if (alreadyReady) return scheduleSheet();

    const onReady = () => {
      const cleanup = scheduleSheet();
      window.setTimeout(cleanup, 4300);
    };

    window.addEventListener("tourpie:app-ready", onReady);
    return () => window.removeEventListener("tourpie:app-ready", onReady);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!widgetReady || sheetOpen || assistantDrawerOpen || requestFlowOpen || reducedMotion) return;
    if (sessionStorage.getItem(IDLE_HINT_KEY) === "1") return;

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };

    window.addEventListener("scroll", cancel, { passive: true });
    window.addEventListener("mousemove", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      sessionStorage.setItem(IDLE_HINT_KEY, "1");
      setAssistantHintActive(true);
      setAssistantExpanded(true);
      window.setTimeout(() => {
        setAssistantExpanded(false);
        window.setTimeout(() => setAssistantHintActive(false), 220);
      }, 5000);
    }, 20000);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", cancel);
      window.removeEventListener("mousemove", cancel);
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("touchstart", cancel);
    };
  }, [widgetReady, sheetOpen, assistantDrawerOpen, requestFlowOpen, reducedMotion]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sheetOpen && !assistantDrawerOpen && !requestFlowOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (requestFlowOpen) {
        closeRequestFlow();
        return;
      }
      if (assistantDrawerOpen) {
        closeAssistantDrawer();
        return;
      }
      if (sheetOpen) {
        dismissSheet();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, assistantDrawerOpen, requestFlowOpen]);

  function markPromoSeen() {
    writePromoState({ lastShownAt: Date.now() });
  }

  function dismissSheet() {
    markPromoSeen();
    setWidgetReady(true);
    setSheetEntered(false);
    window.setTimeout(() => setSheetOpen(false), reducedMotion ? 0 : 320);
  }

  const openAssistantDrawer = () => {
    setAssistantHintActive(false);
    setAssistantExpanded(false);
    setAssistantDrawerOpen(true);
    window.setTimeout(() => setAssistantDrawerEntered(true), 24);
    window.setTimeout(() => assistantDrawerRef.current?.focus(), 120);
  };

  function closeAssistantDrawer() {
    setAssistantDrawerEntered(false);
    window.setTimeout(() => setAssistantDrawerOpen(false), reducedMotion ? 0 : 340);
  }

  const openRequestFlow = () => {
    setAssistantHintActive(false);
    setAssistantExpanded(false);
    setRequestFlowOpen(true);
    window.setTimeout(() => setRequestFlowEntered(true), 24);
    window.setTimeout(() => requestFlowRef.current?.focus(), 140);
  };

  function closeRequestFlow() {
    setRequestFlowEntered(false);
    window.setTimeout(() => setRequestFlowOpen(false), reducedMotion ? 0 : 360);
  }

  const startTripFromSheet = () => {
    dismissSheet();
    window.setTimeout(() => openRequestFlow(), reducedMotion ? 0 : 180);
  };

  const navigateFromDrawer = (href: string) => {
    closeAssistantDrawer();
    window.setTimeout(() => router.push(href), reducedMotion ? 0 : 220);
  };

  const assistantActions = [
    {
      key: "create",
      icon: "✈️",
      title: t("custom_trip_assistant_card_create_title"),
      description: t("custom_trip_assistant_card_create_desc"),
      badge: t("custom_trip_assistant_card_recommended"),
      highlighted: true,
      onClick: openRequestFlow,
    },
    {
      key: "browse",
      icon: "🌍",
      title: t("custom_trip_assistant_card_browse_title"),
      description: t("custom_trip_assistant_card_browse_desc"),
      highlighted: false,
      onClick: () => navigateFromDrawer("/marketplace"),
    },
    {
      key: "requests",
      icon: "📩",
      title: t("custom_trip_assistant_card_requests_title"),
      description: t("custom_trip_assistant_card_requests_desc"),
      highlighted: false,
      onClick: () => navigateFromDrawer("/dashboard/requests"),
    },
    {
      key: "offers",
      icon: "💬",
      title: t("custom_trip_assistant_card_offers_title"),
      description: t("custom_trip_assistant_card_offers_desc"),
      highlighted: false,
      onClick: () => navigateFromDrawer("/dashboard/offers"),
    },
  ];

  const assistantIsExpanded = assistantExpanded || assistantHintActive;
  const assistantTitle = assistantHintActive ? t("custom_trip_assistant_hint_title") : t("custom_trip_assistant_label");
  const assistantSubtitle = assistantHintActive
    ? t("custom_trip_assistant_hint_subtitle")
    : t("custom_trip_assistant_subtitle");

  return (
    <>
      {sheetOpen ? (
        <div className="fixed inset-0 z-[1100] flex items-end justify-center px-3 pb-3 sm:px-6 sm:pb-6">
          <button
            type="button"
            aria-label={t("custom_trip_entry_close")}
            onClick={dismissSheet}
            className={[
              "absolute inset-0 bg-[#021a46]/28 backdrop-blur-sm",
              "transition-opacity duration-300 ease-out motion-reduce:transition-none",
              sheetEntered ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("custom_trip_entry_headline")}
            className={[
              "tp-trip-sheet relative w-full max-w-[1180px] overflow-hidden",
              "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              sheetEntered ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={dismissSheet}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-gray-700 shadow-[0_12px_30px_rgba(2,42,107,0.12)] transition hover:bg-white motion-reduce:transition-none"
              aria-label={t("custom_trip_entry_close")}
            >
              <span className="text-xl leading-none">×</span>
            </button>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
              <div className="tp-trip-sheet-hero">
                <div className="tp-trip-sheet-hero-inner">
                  <div className="tp-trip-sheet-badge">
                    <span className="tp-trip-sheet-badge-dot" />
                    {t("custom_trip_entry_badge")}
                  </div>
                  <h2 className="tp-trip-sheet-title">{t("custom_trip_entry_headline")}</h2>
                  <p className="tp-trip-sheet-subtitle">{t("custom_trip_entry_subtitle")}</p>
                </div>
                <div className="tp-trip-sheet-graphic" aria-hidden="true">
                  <svg className="h-full w-full" viewBox="0 0 680 280" fill="none">
                    <defs>
                      <linearGradient id="tpTripSheetRoute" x1="54" y1="160" x2="598" y2="94" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#A8D8FF" stopOpacity="0.72" />
                        <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.34" />
                        <stop offset="1" stopColor="#FF6A1A" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M54 176 C 140 110, 248 102, 318 142 S 470 220, 598 94"
                      stroke="url(#tpTripSheetRoute)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="4 14"
                      className="tp-trip-sheet-route"
                    />
                    {[
                      [96, 152],
                      [206, 112],
                      [320, 142],
                      [444, 178],
                      [580, 102],
                    ].map(([x, y]) => (
                      <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                        <circle cx="0" cy="0" r="20" fill="rgba(255,255,255,0.18)" />
                        <circle cx="0" cy="0" r="5" fill="#FF6A1A" />
                        <circle cx="0" cy="0" r="9" fill="rgba(255,255,255,0.2)" />
                      </g>
                    ))}
                    <g className="tp-trip-sheet-plane">
                      <circle cx="0" cy="0" r="18" fill="rgba(255,255,255,0.14)" />
                      <path
                        d="M21.9 11.1 3.8 3.3c-.9-.38-1.76.48-1.38 1.38l2.92 6.82 7.2 1.2-7.2 1.2-2.92 6.82c-.38.9.48 1.76 1.38 1.38l18.1-7.8a1.2 1.2 0 0 0 0-2.2Z"
                        transform="translate(-12 -12)"
                        fill="white"
                        opacity="0.94"
                      />
                    </g>
                  </svg>
                </div>
              </div>

              <div className="p-5 sm:p-6 lg:pr-8 lg:pl-0">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { title: t("custom_trip_entry_card_1_title"), desc: t("custom_trip_entry_card_1_desc") },
                    { title: t("custom_trip_entry_card_2_title"), desc: t("custom_trip_entry_card_2_desc") },
                    { title: t("custom_trip_entry_card_3_title"), desc: t("custom_trip_entry_card_3_desc") },
                    { title: t("custom_trip_entry_card_4_title"), desc: t("custom_trip_entry_card_4_desc") },
                  ].map((card) => (
                    <div key={card.title} className="tp-trip-sheet-feature">
                      <div className="tp-trip-sheet-feature-check">✓</div>
                      <div>
                        <div className="tp-trip-sheet-feature-title">{card.title}</div>
                        <div className="tp-trip-sheet-feature-desc">{card.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={startTripFromSheet} className="tp-trip-sheet-primary">
                    {t("custom_trip_entry_primary")}
                  </button>
                  <button type="button" onClick={dismissSheet} className="tp-trip-sheet-secondary">
                    {t("custom_trip_entry_secondary")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {widgetReady && !sheetOpen && !assistantDrawerOpen && !requestFlowOpen ? (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-4 z-[1060] sm:right-6">
          <div
            onMouseEnter={() => setAssistantExpanded(true)}
            onMouseLeave={() => {
              if (!assistantHintActive) setAssistantExpanded(false);
            }}
          >
            <button
              type="button"
              onFocus={() => setAssistantExpanded(true)}
              onBlur={() => {
                if (!assistantHintActive) setAssistantExpanded(false);
              }}
              onClick={openAssistantDrawer}
              aria-label={t("custom_trip_assistant_label")}
              className={[
                "tp-travel-assistant",
                assistantIsExpanded ? "tp-travel-assistant--open" : "",
              ].join(" ")}
            >
              <span className="tp-travel-assistant-halo" aria-hidden="true" />
              <span className="tp-travel-assistant-icon-shell" aria-hidden="true">
                <span className="tp-travel-assistant-icon-mark">✈️</span>
                <span className="relative h-7 w-7">
                  <Image src="/tourpie_icon.svg" alt="" fill sizes="28px" className="object-contain" />
                </span>
              </span>
              <span className="tp-travel-assistant-body">
                <span className="tp-travel-assistant-title">{assistantTitle}</span>
                <span className="tp-travel-assistant-subtitle">{assistantSubtitle}</span>
              </span>
              <span className="tp-travel-assistant-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {assistantDrawerOpen ? (
        <div className="fixed inset-0 z-[1120]">
          <div
            className={[
              "absolute inset-0 bg-[#021a46]/28 backdrop-blur-md transition-opacity duration-300 ease-out motion-reduce:transition-none",
              assistantDrawerEntered ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={closeAssistantDrawer}
            aria-hidden="true"
          />

          <div
            ref={assistantDrawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("custom_trip_assistant_drawer_title")}
            className={[
              "tp-assistant-drawer absolute bottom-0 right-0 top-auto flex h-[92dvh] w-full flex-col overflow-hidden",
              "sm:top-0 sm:h-full sm:w-[380px] lg:w-[420px]",
              "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              assistantDrawerEntered ? "translate-y-0 sm:translate-x-0 opacity-100" : "translate-y-6 sm:translate-x-8 opacity-0",
            ].join(" ")}
          >
            <div className="border-b border-white/60 px-5 pb-5 pt-6 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 rounded-[18px] border border-white/65 bg-white/72 shadow-[0_14px_40px_rgba(2,42,107,0.14)]">
                    <Image src="/tourpie_icon.svg" alt="TourPie" fill sizes="48px" className="object-contain p-2.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#022A6B]/48">
                      TourPie
                    </div>
                    <div className="mt-1 text-[1.05rem] font-black tracking-[-0.02em] text-slate-900">
                      {t("custom_trip_assistant_drawer_title")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-500">
                      {t("custom_trip_assistant_drawer_subtitle")}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeAssistantDrawer}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/74 text-slate-700 shadow-[0_12px_26px_rgba(2,42,107,0.08)] transition hover:bg-white motion-reduce:transition-none"
                  aria-label={t("custom_trip_close")}
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="space-y-3">
                {assistantActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className={[
                      "tp-assistant-action w-full text-left",
                      action.highlighted ? "tp-assistant-action--primary" : "",
                    ].join(" ")}
                  >
                    <span className="tp-assistant-action-icon" aria-hidden="true">
                      {action.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="tp-assistant-action-title">{action.title}</span>
                        {action.highlighted ? (
                          <span className="tp-assistant-action-badge">{action.badge}</span>
                        ) : null}
                      </span>
                      <span className="tp-assistant-action-desc">{action.description}</span>
                    </span>
                    <span className="tp-assistant-action-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {requestFlowOpen ? (
        <div className="fixed inset-0 z-[1140]">
          <div
            className={[
              "absolute inset-0 bg-[#021a46]/50 backdrop-blur-md transition-opacity duration-300 ease-out motion-reduce:transition-none",
              requestFlowEntered ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={closeRequestFlow}
            aria-hidden="true"
          />

          <div
            ref={requestFlowRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("custom_trip_entry_primary")}
            className={[
              "absolute inset-0 overflow-hidden bg-[#f7f8fb] shadow-[0_40px_160px_rgba(2,42,107,0.34)]",
              "transition-[opacity,transform] duration-[560ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              requestFlowEntered ? "translate-y-0 sm:translate-x-0 opacity-100" : "translate-y-4 sm:translate-x-6 opacity-0",
            ].join(" ")}
          >
            <div className="flex items-center justify-between border-b border-white/55 bg-white/72 px-5 py-5 backdrop-blur-2xl sm:px-8">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 rounded-[18px] border border-white/65 bg-white/76 shadow-[0_14px_30px_rgba(2,42,107,0.1)]">
                  <Image src="/tourpie_icon.svg" alt="TourPie" fill sizes="44px" className="object-contain p-2.5" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#022A6B]/42">
                    {t("custom_trip_assistant_drawer_title")}
                  </div>
                  <div className="mt-1 text-lg font-black tracking-[-0.02em] text-slate-900">
                    {t("custom_trip_entry_primary")}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeRequestFlow}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/78 text-slate-800 shadow-[0_12px_28px_rgba(2,42,107,0.08)] transition hover:bg-white motion-reduce:transition-none"
                aria-label={t("custom_trip_close")}
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <div className="h-[calc(100%-84px)] overflow-y-auto">
              <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
                <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_28px_90px_rgba(2,42,107,0.12)] backdrop-blur-2xl sm:rounded-[2.5rem] sm:p-8">
                  <CustomTripRequestForm variant="drawer" onClose={closeRequestFlow} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
