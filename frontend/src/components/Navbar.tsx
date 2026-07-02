"use client";

import Link from "next/link";
import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage, Currency, Language } from "@/context/LanguageContext";
import Logo from "./Logo";
import {
  Agency,
  api,
  clearSessionToken,
  getStoredToken,
  getStoredTokenPayload,
  isAuthErrorMessage,
  SESSION_ACTIVITY_KEY,
  SESSION_EXPIRED_KEY,
  SESSION_LOGOUT_KEY,
  setSessionToken,
  touchSessionActivity,
  User,
} from "@/lib/api";
import NextImage from "next/image";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LanguageFlag({ language, size = 20 }: { language: Language; size?: number }) {
  const countryCode = language === "en" ? "gb" : language;
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-[4px] overflow-hidden bg-transparent"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className={`fi fi-${countryCode} shrink-0 rounded-[4px] overflow-hidden shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]`}
        style={{ width: size, height: Math.round(size * 0.75) }}
      />
    </span>
  );
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const appReadyEmittedRef = useRef(false);
  const [me, setMe] = useState<User | null>(null);
  const [myAgency, setMyAgency] = useState<Agency | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [mobilePrefsOpen, setMobilePrefsOpen] = useState(false);
  const prefsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const { language, setLanguage, currency, setCurrency, t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const isLoggedIn = authReady && !!getStoredToken();
  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const [sessionCountdownSec, setSessionCountdownSec] = useState<number>(0);
  const sessionWarningOpenRef = useRef(false);
  const warningTimeoutRef = useRef<number | null>(null);
  const logoutTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const lastLogoutSeenRef = useRef<string | null>(null);
  const [previewBackup, setPreviewBackup] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (appReadyEmittedRef.current) return;
    appReadyEmittedRef.current = true;
    try {
      document.documentElement.dataset.tourpieReady = "1";
      window.dispatchEvent(new Event("tourpie:app-ready"));
    } catch {
      return;
    }
  }, [authReady]);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("admin_preview_backup_token");
        setPreviewBackup(raw || null);
      } catch {
        setPreviewBackup(null);
      }
    };
    read();
    window.addEventListener("tourpie:auth", read);
    return () => window.removeEventListener("tourpie:auth", read);
  }, []);

  const exitPreview = () => {
    if (!previewBackup) return;
    try {
      localStorage.removeItem("admin_preview_backup_token");
    } catch {
      return;
    }
    setSessionToken(previewBackup);
    setPreviewBackup(null);
    router.replace("/admin");
  };

  useEffect(() => {
    sessionWarningOpenRef.current = sessionWarningOpen;
  }, [sessionWarningOpen]);

  const getRoleFromToken = () => {
    const decoded = getStoredTokenPayload();
    const r = typeof decoded?.role === "string" ? decoded.role.toLowerCase() : null;
    return r === "admin" || r === "agency" || r === "user" ? r : null;
  };

  useEffect(() => {
    let cancelled = false;

    const syncFromToken = (token: string | null) => {
      if (cancelled) return;
      if (!token) {
        setMe(null);
        setMyAgency(null);
        setAvatarUrl(null);
        setAvatarBroken(false);
        setProfileOpen(false);
      }
    };

    const checkAuth = async () => {
      const token = getStoredToken();
      syncFromToken(token);
      if (!token) {
        if (!cancelled) setAuthReady(true);
        return;
      }

      if (!cancelled) setAuthReady(true);

      try {
        const nextMe = await api.auth.me();
        if (cancelled) return;
        setMe(nextMe);

        if (nextMe.role === "agency" && typeof nextMe.agency_id === "number") {
          try {
            const agency = await api.agencies.getOne(nextMe.agency_id);
            if (cancelled) return;
            setMyAgency(agency);
          } catch {
            if (cancelled) return;
            setMyAgency(null);
          }
        } else {
          setMyAgency(null);
        }
      } catch (error) {
        if (cancelled) return;
      const message = error instanceof Error ? error.message : "";
      if (isAuthErrorMessage(message)) {
          clearSessionToken();
          syncFromToken(null);
        }
      }
    };

    void checkAuth();
    const onAuthChange = () => void checkAuth();
    window.addEventListener("storage", onAuthChange);
    window.addEventListener("tourpie:auth", onAuthChange as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onAuthChange);
      window.removeEventListener("tourpie:auth", onAuthChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!prefsRef.current) return;
      if (prefsRef.current.contains(e.target as Node)) return;
      setPrefsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!profileRef.current) return;
      if (profileRef.current.contains(e.target as Node)) return;
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handleLogout = () => {
    const roleValue = getRoleFromToken();
    try {
      localStorage.setItem(SESSION_LOGOUT_KEY, JSON.stringify({ at: Date.now(), reason: "manual", role: roleValue }));
    } catch {}
    try {
      localStorage.removeItem("admin_preview_backup_token");
    } catch {}
    clearSessionToken();
    setAuthReady(true);
    setProfileOpen(false);
    setPrefsOpen(false);
    setMobilePrefsOpen(false);
    setIsOpen(false);
    router.replace(roleValue === "admin" ? "/admin/login" : "/login");
  };

  const role = me?.role === "admin" || me?.role === "agency" || me?.role === "user" ? me.role : null;
  const effectiveRole = role || "user";
  const homeHref = effectiveRole === "admin" ? "/admin" : effectiveRole === "agency" ? "/agency" : "/dashboard";
  const settingsHref =
    effectiveRole === "admin" ? "/admin/settings" : effectiveRole === "agency" ? "/agency/settings" : "/dashboard/settings";

  const roleText = t(effectiveRole === "agency" ? "role_agency" : effectiveRole === "admin" ? "role_admin" : "role_user");
  const rolePillClass =
    effectiveRole === "agency"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : effectiveRole === "admin"
        ? "bg-purple-50 text-purple-700 border-purple-100"
        : "bg-blue-50 text-blue-700 border-blue-100";

  const identityName =
    effectiveRole === "admin"
      ? me?.full_name || me?.email || roleText
      : effectiveRole === "agency"
        ? myAgency?.name || me?.full_name || me?.email || roleText
        : me?.full_name || me?.email || roleText;

  const avatarStorageKey =
    role === "agency" && typeof me?.agency_id === "number"
      ? `tourpie:avatar:agency:${me.agency_id}`
      : typeof me?.id === "number"
        ? `tourpie:avatar:user:${me.id}`
        : null;

  useEffect(() => {
    if (!avatarStorageKey) return;
    const id = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(avatarStorageKey);
        setAvatarUrl(stored ? stored : null);
        setAvatarBroken(false);
      } catch {
        setAvatarUrl(null);
        setAvatarBroken(false);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [avatarStorageKey]);

  useEffect(() => {
    if (!authReady) return;

    const parsePositiveInt = (raw: string | undefined, fallback: number) => {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return fallback;
      return Math.floor(n);
    };

    const getTimeoutMs = () => {
      const roleValue = getRoleFromToken() || "user";
      const adminMin = parsePositiveInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_ADMIN_MINUTES, 15);
      const agencyMin = parsePositiveInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_AGENCY_MINUTES, 30);
      const userMin = parsePositiveInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_USER_MINUTES, 60);
      const minutes = roleValue === "admin" ? adminMin : roleValue === "agency" ? agencyMin : userMin;
      return { roleValue, timeoutMs: minutes * 60 * 1000 };
    };

    const warningSeconds = parsePositiveInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_WARNING_SECONDS, 60);
    const warningMs = warningSeconds * 1000;

    const clearTimers = () => {
      if (warningTimeoutRef.current) window.clearTimeout(warningTimeoutRef.current);
      if (logoutTimeoutRef.current) window.clearTimeout(logoutTimeoutRef.current);
      if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
      warningTimeoutRef.current = null;
      logoutTimeoutRef.current = null;
      countdownIntervalRef.current = null;
    };

    const startCountdown = (logoutAt: number) => {
      if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((logoutAt - Date.now()) / 1000));
        setSessionCountdownSec(remaining);
        if (remaining <= 0) {
          if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
      tick();
      countdownIntervalRef.current = window.setInterval(tick, 1000);
    };

    const setExpiredNotice = () => {
      try {
        localStorage.setItem(
          SESSION_EXPIRED_KEY,
          JSON.stringify({ at: Date.now(), reason: "inactivity" })
        );
      } catch {
        return;
      }
    };

    const logoutAndRedirect = (payload: { reason: "inactivity" | "manual" | "auth"; broadcast: boolean }) => {
      const roleValue = getRoleFromToken();
      if (payload.reason !== "manual") setExpiredNotice();
      if (payload.broadcast) {
        try {
          localStorage.setItem(
            SESSION_LOGOUT_KEY,
            JSON.stringify({ at: Date.now(), reason: payload.reason, role: roleValue })
          );
        } catch {}
      }
      clearSessionToken();
      setSessionWarningOpen(false);
      clearTimers();
      const href = roleValue === "admin" ? "/admin/login" : "/login";
      router.replace(payload.reason === "manual" ? href : `${href}?reason=session_expired`);
    };

    const schedule = (lastActivityMs: number) => {
      if (!getStoredToken()) {
        setSessionWarningOpen(false);
        clearTimers();
        return;
      }
      const { timeoutMs } = getTimeoutMs();
      const now = Date.now();
      const logoutAt = lastActivityMs + timeoutMs;
      const warningAt = logoutAt - warningMs;

      clearTimers();

      if (logoutAt <= now) {
        logoutAndRedirect({ reason: "inactivity", broadcast: true });
        return;
      }

      logoutTimeoutRef.current = window.setTimeout(
        () => logoutAndRedirect({ reason: "inactivity", broadcast: true }),
        logoutAt - now
      );

      if (warningAt <= now) {
        setSessionWarningOpen(true);
        startCountdown(logoutAt);
        return;
      }

      warningTimeoutRef.current = window.setTimeout(() => {
        if (!getStoredToken()) return;
        setSessionWarningOpen(true);
        startCountdown(logoutAt);
      }, warningAt - now);
    };

    const getLastActivity = () => {
      try {
        const raw = localStorage.getItem(SESSION_ACTIVITY_KEY);
        const parsed = raw ? Number(raw) : NaN;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      } catch {
        return null;
      }
    };

    const ensureActivityBaseline = () => {
      if (!getStoredToken()) return null;
      const existing = getLastActivity();
      if (existing) return existing;
      touchSessionActivity("init");
      return getLastActivity() || Date.now();
    };

    const baseline = ensureActivityBaseline();
    if (baseline) schedule(baseline);

    const onUserActivity = () => {
      if (!getStoredToken()) return;
      touchSessionActivity("ui");
      const next = getLastActivity() || Date.now();
      setSessionWarningOpen(false);
      schedule(next);
    };

    const onActivityEvent = () => {
      const next = getLastActivity() || Date.now();
      if (!getStoredToken()) return;
      if (sessionWarningOpenRef.current) setSessionWarningOpen(false);
      schedule(next);
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === SESSION_LOGOUT_KEY) {
        const raw = e.newValue;
        if (!raw) return;
        if (lastLogoutSeenRef.current === raw) return;
        lastLogoutSeenRef.current = raw;
        let reason: "inactivity" | "manual" | "auth" = "manual";
        let role: string | null = null;
        try {
          const parsed = JSON.parse(raw) as { reason?: unknown; role?: unknown };
          const r =
            parsed?.reason === "inactivity" || parsed?.reason === "manual" || parsed?.reason === "auth" ? parsed.reason : null;
          reason = r || "manual";
          role = typeof parsed?.role === "string" ? parsed.role : null;
        } catch {
          reason = "manual";
          role = getRoleFromToken();
        }
        if (reason !== "manual") {
          try {
            localStorage.setItem(SESSION_EXPIRED_KEY, JSON.stringify({ at: Date.now(), reason }));
          } catch {}
        }
        clearSessionToken();
        setSessionWarningOpen(false);
        clearTimers();
        const href = role === "admin" ? "/admin/login" : "/login";
        router.replace(reason === "manual" ? href : `${href}?reason=session_expired`);
        return;
      }
      if (e.key === SESSION_ACTIVITY_KEY) {
        const n = e.newValue ? Number(e.newValue) : NaN;
        if (!Number.isFinite(n) || n <= 0) return;
        if (!getStoredToken()) return;
        if (sessionWarningOpenRef.current) setSessionWarningOpen(false);
        schedule(n);
      }
    };

    window.addEventListener("mousemove", onUserActivity, { passive: true });
    window.addEventListener("mousedown", onUserActivity, { passive: true });
    window.addEventListener("keydown", onUserActivity);
    window.addEventListener("scroll", onUserActivity, { passive: true });
    window.addEventListener("touchstart", onUserActivity, { passive: true });
    window.addEventListener("pointerdown", onUserActivity, { passive: true });
    window.addEventListener("tourpie:activity", onActivityEvent as EventListener);
    window.addEventListener("storage", onStorage);
    const onLogoutEvent = (e: Event) => {
      let reason: "inactivity" | "manual" | "auth" = "auth";
      let role: string | null = null;
      const ce = e as CustomEvent<{ reason?: string; role?: string }>;
      if (ce?.detail?.reason === "inactivity" || ce?.detail?.reason === "manual" || ce?.detail?.reason === "auth") {
        reason = ce.detail.reason;
      }
      if (typeof ce?.detail?.role === "string") role = ce.detail.role;
      if (reason !== "manual") {
        try {
          localStorage.setItem(SESSION_EXPIRED_KEY, JSON.stringify({ at: Date.now(), reason }));
        } catch {}
      }
      clearSessionToken();
      setSessionWarningOpen(false);
      clearTimers();
      const href = role === "admin" ? "/admin/login" : "/login";
      router.replace(reason === "manual" ? href : `${href}?reason=session_expired`);
    };
    window.addEventListener("tourpie:logout", onLogoutEvent as EventListener);

    return () => {
      clearTimers();
      window.removeEventListener("mousemove", onUserActivity as EventListener);
      window.removeEventListener("mousedown", onUserActivity as EventListener);
      window.removeEventListener("keydown", onUserActivity as EventListener);
      window.removeEventListener("scroll", onUserActivity as EventListener);
      window.removeEventListener("touchstart", onUserActivity as EventListener);
      window.removeEventListener("pointerdown", onUserActivity as EventListener);
      window.removeEventListener("tourpie:activity", onActivityEvent as EventListener);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tourpie:logout", onLogoutEvent as EventListener);
    };
  }, [authReady, router]);

  useEffect(() => {
    if (!isLoggedIn) return;
    touchSessionActivity("nav");
  }, [isLoggedIn, pathname]);

  const handleStayLoggedIn = async () => {
    try {
      const token = getStoredToken();
      if (!token) return;
      const refreshed = await api.auth.refresh();
      if (refreshed?.access_token) {
        setSessionToken(refreshed.access_token);
      }
      touchSessionActivity("refresh");
      setSessionWarningOpen(false);
    } catch {
      setSessionWarningOpen(false);
      clearSessionToken();
      router.replace(effectiveRole === "admin" ? "/admin/login?reason=session_expired" : "/login?reason=session_expired");
    }
  };

  const initials = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return "U";
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || cleaned[0] || "U";
    const second = parts.length > 1 ? parts[1]?.[0] : cleaned[1];
    return `${first}${second || ""}`.toUpperCase();
  };

  const gradientClass = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    const idx = Math.abs(hash) % 5;
    if (idx === 0) return "from-blue-600 to-purple-600";
    if (idx === 1) return "from-emerald-500 to-blue-600";
    if (idx === 2) return "from-indigo-600 to-pink-600";
    if (idx === 3) return "from-orange-500 to-rose-600";
    return "from-sky-500 to-indigo-600";
  };

  const uploadAvatar = async (file: File) => {
    if (!avatarStorageKey) return;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
    const maxSize = 2 * 1024 * 1024;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const okType = (file.type && allowedTypes.has(file.type)) || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext);
    if (!okType) return;
    if (file.size > maxSize) return;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
    if (!dataUrl.startsWith("data:image/")) return;
    try {
      localStorage.setItem(avatarStorageKey, dataUrl);
    } catch {}
    setAvatarUrl(dataUrl);
    setAvatarBroken(false);
  };

  const clearAvatar = () => {
    if (!avatarStorageKey) return;
    try {
      localStorage.removeItem(avatarStorageKey);
    } catch {}
    setAvatarUrl(null);
    setAvatarBroken(false);
  };

  const onAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    void uploadAvatar(file);
    e.currentTarget.value = "";
    setProfileOpen(false);
    setIsOpen(false);
  };

  const navItems = [
    { href: "/results", label: t("nav_explore") },
    { href: "/marketplace", label: t("nav_marketplace") },
    { href: "/hot-now", label: t("nav_hot_now"), live: true },
    { href: "/experiences", label: t("nav_experiences") },
    { href: "/support", label: t("nav_support") },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/results") {
      return (
        pathname === "/results" ||
        pathname.startsWith("/results/") ||
        pathname.startsWith("/details/") ||
        pathname.startsWith("/category/")
      );
    }
    if (href === "/marketplace") {
      return pathname === "/marketplace" || pathname.startsWith("/marketplace/");
    }
    if (href === "/hot-now") {
      return pathname === "/hot-now" || pathname.startsWith("/hot-now/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const languageOptions: Array<{ value: Language; label: string }> = [
    { value: "az", label: t("language_name_az") },
    { value: "en", label: t("language_name_en") },
    { value: "ru", label: t("language_name_ru") },
    { value: "tr", label: t("language_name_tr") },
  ];
  const currencyOptions: Currency[] = ["USD", "EUR", "AZN", "RUB", "TRY"];

  return (
    <nav className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50">
      {previewBackup && getRoleFromToken() !== "admin" ? (
        <div className="bg-amber-50 border-b border-amber-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="text-sm font-black text-amber-900">{t("preview_mode_title")}</div>
            <button
              type="button"
              onClick={exitPreview}
              className="bg-white border border-amber-200 hover:bg-amber-50 text-amber-900 font-black px-4 py-2 rounded-2xl transition"
            >
              {t("preview_mode_exit")}
            </button>
          </div>
        </div>
      ) : null}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Logo />
            <div className="hidden lg:ml-10 lg:flex lg:items-center lg:gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    isActive(item.href)
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                      : "text-gray-700 hover:text-blue-700 hover:bg-blue-50"
                  }`}
                >
                  {item.label}
                  {item.live ? (
                    <span className="tp-live-badge absolute -top-2 -right-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-[0_0_20px_rgba(255,74,74,0.35)]">
                      <span className="tp-live-dot h-1.5 w-1.5 rounded-full bg-white/95" />
                      {t("nav_hot_now_badge")}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center gap-6">
            <div className="relative" ref={prefsRef}>
              <button
                type="button"
                aria-label={t("nav_language_currency")}
                onClick={() => setPrefsOpen((v) => !v)}
                className="inline-flex items-center gap-2 h-11 rounded-2xl bg-gray-50 border border-gray-100 text-gray-700 hover:bg-white hover:border-gray-200 hover:text-gray-900 px-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <LanguageFlag language={language} />
                <span className="text-sm font-black text-gray-900">{languageOptions.find((opt) => opt.value === language)?.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {prefsOpen ? (
                <div className="absolute right-0 mt-3 w-72 bg-white rounded-[1.6rem] border border-gray-100 shadow-xl p-3">
                  <div className="grid gap-2">
                    {languageOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setLanguage(opt.value);
                          setPrefsOpen(false);
                        }}
                        className={`w-full px-3 py-3 rounded-2xl text-sm font-black text-left transition flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                          language === opt.value ? "bg-blue-600 text-white shadow-sm shadow-blue-200" : "bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:scale-[1.01]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-3">
                          <LanguageFlag language={opt.value} />
                          <span>{opt.label}</span>
                        </span>
                        {language === opt.value ? <CheckIcon /> : null}
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-gray-100 my-3" />
                  <div className="grid grid-cols-3 gap-2">
                    {currencyOptions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCurrency(c);
                          setPrefsOpen(false);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                          currency === c ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex-shrink-0 flex gap-4">
              {!authReady ? (
                <div className="h-10 w-[220px]" />
              ) : (
                <>
                  {isLoggedIn ? (
                    <div className="relative" ref={profileRef}>
                        <div className="inline-flex items-stretch rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden hover:border-blue-200 transition">
                        <Link
                          href={homeHref}
                          prefetch={false}
                          onClick={() => {
                            setProfileOpen(false);
                            setPrefsOpen(false);
                          }}
                          className="inline-flex items-center gap-3 px-3 py-2 hover:bg-blue-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          aria-label={t("nav_dashboard")}
                        >
                          <div className="relative h-9 w-9 rounded-full overflow-hidden border border-white shadow-sm flex-shrink-0">
                            {avatarUrl && !avatarBroken ? (
                              <NextImage
                                src={avatarUrl}
                                alt={identityName}
                                fill
                                sizes="36px"
                                className="object-cover"
                                onError={() => setAvatarBroken(true)}
                              />
                            ) : (
                              <div
                                className={`h-full w-full bg-gradient-to-br ${gradientClass(avatarStorageKey || identityName)} flex items-center justify-center`}
                              >
                                <div className="text-white text-xs font-black">{initials(identityName)}</div>
                              </div>
                            )}
                          </div>
                          <div className="hidden md:flex flex-col items-start leading-tight">
                            <div className="max-w-[160px] truncate text-sm font-black text-gray-900">{identityName}</div>
                            <div className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${rolePillClass}`}>
                              {roleText}
                            </div>
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen((v) => !v);
                            setPrefsOpen(false);
                          }}
                          className="px-2 text-gray-500 hover:text-gray-900 hover:bg-blue-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          aria-label="Account menu"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>

                      {profileOpen ? (
                        <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl border border-gray-100 shadow-xl p-2">
                          <Link
                            href={homeHref}
                            prefetch={false}
                            onClick={() => setProfileOpen(false)}
                            className="block px-4 py-3 rounded-xl font-black text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            {t("nav_dashboard")}
                          </Link>
                          <Link
                            href={settingsHref}
                            prefetch={false}
                            onClick={() => setProfileOpen(false)}
                            className="block px-4 py-3 rounded-xl font-black text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            {t("dash_settings")}
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileOpen(false);
                              avatarInputRef.current?.click();
                            }}
                            className="w-full text-left px-4 py-3 rounded-xl font-black text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            {effectiveRole === "agency" ? t("nav_upload_logo") : t("nav_upload_photo")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              clearAvatar();
                              setProfileOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 rounded-xl font-black text-sm text-gray-900 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            {t("common_remove")}
                          </button>
                          <div className="h-px bg-gray-100 my-2" />
                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-3 rounded-xl font-black text-sm text-gray-700 hover:bg-gray-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            {t("nav_logout")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <Link
                        href="/agency/register"
                        prefetch={false}
                        className="bg-white border border-gray-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 text-gray-900 font-bold py-2 px-5 rounded-xl transition duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {t("agency_register_cta")}
                      </Link>
                      <Link
                        href="/login"
                        prefetch={false}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition duration-200 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {t("nav_login")}
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => {
                setMobilePrefsOpen(false);
                setProfileOpen(false);
                setIsOpen(!isOpen);
              }}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="sr-only">{t("nav_open_menu")}</span>
              {isOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setIsOpen(false)}
                className={`relative block px-4 py-3 rounded-2xl font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  isActive(item.href)
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {item.label}
                {item.live ? (
                  <span className="tp-live-badge absolute top-2 right-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-[0_0_20px_rgba(255,74,74,0.35)]">
                    <span className="tp-live-dot h-1.5 w-1.5 rounded-full bg-white/95" />
                    {t("nav_hot_now_badge")}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
          <div className="px-4 pb-6 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMobilePrefsOpen((v) => !v)}
                  className="inline-flex items-center gap-2 h-11 rounded-2xl bg-gray-50 border border-gray-100 text-gray-700 hover:bg-white hover:border-gray-200 hover:text-gray-900 px-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-label={t("nav_language_currency")}
                >
                  <LanguageFlag language={language} />
                  <span className="text-sm font-black text-gray-900">{languageOptions.find((opt) => opt.value === language)?.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {mobilePrefsOpen ? (
                  <div className="absolute left-0 top-full mt-3 w-72 bg-white rounded-[1.6rem] border border-gray-100 shadow-xl p-3">
                    <div className="grid gap-2">
                      {languageOptions.map((lang) => (
                        <button
                          key={lang.value}
                          type="button"
                          onClick={() => {
                            setLanguage(lang.value);
                            setMobilePrefsOpen(false);
                          }}
                          className={`w-full px-3 py-3 rounded-2xl text-sm font-black transition flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                            language === lang.value ? "bg-blue-600 text-white shadow-sm shadow-blue-200" : "bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          <span className="inline-flex items-center gap-3">
                            <LanguageFlag language={lang.value} />
                            <span>{lang.label}</span>
                          </span>
                          {language === lang.value ? <CheckIcon /> : null}
                        </button>
                      ))}
                    </div>
                    <div className="h-px bg-gray-100 my-3" />
                    <div className="grid grid-cols-5 gap-2">
                      {currencyOptions.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCurrency(c);
                            setMobilePrefsOpen(false);
                          }}
                          className={`px-2 py-2 rounded-xl text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                            currency === c ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {isLoggedIn ? (
                <div className="relative" ref={profileRef}>
                  <div className="inline-flex items-stretch rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden hover:border-blue-200 transition">
                    <Link
                      href={homeHref}
                      prefetch={false}
                      onClick={() => {
                        setIsOpen(false);
                        setProfileOpen(false);
                        setMobilePrefsOpen(false);
                      }}
                      className="inline-flex items-center gap-3 px-3 py-2 hover:bg-blue-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      aria-label={t("nav_dashboard")}
                    >
                      <div className="relative h-10 w-10 rounded-full overflow-hidden border border-white shadow-sm flex-shrink-0">
                        {avatarUrl && !avatarBroken ? (
                          <NextImage
                            src={avatarUrl}
                            alt={identityName}
                            fill
                            sizes="40px"
                            className="object-cover"
                            onError={() => setAvatarBroken(true)}
                          />
                        ) : (
                          <div
                            className={`h-full w-full bg-gradient-to-br ${gradientClass(avatarStorageKey || identityName)} flex items-center justify-center`}
                          >
                            <div className="text-white text-xs font-black">{initials(identityName)}</div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-start leading-tight">
                        <div className="max-w-[140px] truncate text-sm font-black text-gray-900">{identityName}</div>
                        <div className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${rolePillClass}`}>
                          {roleText}
                        </div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen((v) => !v);
                        setMobilePrefsOpen(false);
                      }}
                      className="px-2 text-gray-500 hover:text-gray-900 hover:bg-blue-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      aria-label="Account menu"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>

                  {profileOpen ? (
                  <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl border border-gray-100 shadow-xl p-2">
                      <Link
                        href={homeHref}
                        prefetch={false}
                        onClick={() => {
                          setProfileOpen(false);
                          setIsOpen(false);
                        }}
                        className="block px-4 py-3 rounded-xl font-black text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {t("nav_dashboard")}
                      </Link>
                      <Link
                        href={settingsHref}
                        prefetch={false}
                        onClick={() => {
                          setProfileOpen(false);
                          setIsOpen(false);
                        }}
                        className="block px-4 py-3 rounded-xl font-black text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {t("dash_settings")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          avatarInputRef.current?.click();
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl font-black text-sm text-gray-900 hover:bg-blue-50 hover:text-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {effectiveRole === "agency" ? t("nav_upload_logo") : t("nav_upload_photo")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearAvatar();
                          setProfileOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl font-black text-sm text-gray-900 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {t("common_remove")}
                      </button>
                      <div className="h-px bg-gray-100 my-2" />
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 rounded-xl font-black text-sm text-gray-700 hover:bg-gray-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {t("nav_logout")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex gap-3">
                  <Link
                    href="/agency/register"
                    prefetch={false}
                    onClick={() => setIsOpen(false)}
                    className="bg-white border border-gray-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 text-gray-900 font-bold py-3 px-5 rounded-2xl transition duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    {t("agency_register_cta")}
                  </Link>
                  <Link
                    href="/login"
                    prefetch={false}
                    onClick={() => setIsOpen(false)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-2xl transition duration-200 text-sm shadow-sm shadow-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    {t("nav_login")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoggedIn ? (
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={onAvatarFileChange}
        />
      ) : null}

      {sessionWarningOpen ? (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-8">
            <div className="text-xl font-black text-gray-900">{t("session_timeout_warning_title")}</div>
            <div className="mt-3 text-gray-600 font-medium">
              {t("session_timeout_warning_body", { seconds: sessionCountdownSec })}
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(SESSION_LOGOUT_KEY, JSON.stringify({ at: Date.now(), reason: "manual", role: getRoleFromToken() }));
                  } catch {}
                  clearSessionToken();
                  setSessionWarningOpen(false);
                  window.location.href = effectiveRole === "admin" ? "/admin/login" : "/login";
                }}
                className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black py-3 rounded-2xl transition"
              >
                {t("session_timeout_logout")}
              </button>
              <button
                type="button"
                onClick={() => void handleStayLoggedIn()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl transition shadow-sm shadow-blue-100"
              >
                {t("session_timeout_stay")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

