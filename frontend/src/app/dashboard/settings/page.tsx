"use client";

import Image from "next/image";
import DashboardShell from "@/components/DashboardShell";
import {
  api,
  clearSessionToken,
  getRememberMePreference,
  requestCurrentUserRefresh,
  syncCurrentUserProfile,
  UserSession,
} from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { Currency, Language, useLanguage } from "@/context/LanguageContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const AVATAR_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const AVATAR_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  en: "en-GB",
  az: "az-AZ",
  ru: "ru-RU",
  tr: "tr-TR",
};

type Tone = "neutral" | "good" | "warn" | "info";

function toneClasses(tone: Tone) {
  if (tone === "good") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (tone === "warn") return "bg-amber-50 text-amber-700 border-amber-100";
  if (tone === "info") return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest ${toneClasses(tone)}`}>
      {children}
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  helper,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-[1.75rem] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</div>
          <div className="mt-2 text-base font-black text-gray-900">{value}</div>
          {helper ? <div className="mt-2 text-sm font-medium text-gray-500">{helper}</div> : null}
        </div>
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border text-lg ${toneClasses(tone)}`}>{icon}</div>
      </div>
    </div>
  );
}

function SectionCard({
  id,
  icon,
  title,
  description,
  actions,
  children,
}: {
  id?: string;
  icon: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">{icon}</div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-gray-400">{title}</div>
              {description ? <div className="mt-1 text-sm font-medium text-gray-500">{description}</div> : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function getUsernameFallback(email?: string | null) {
  return (email || "").split("@")[0]?.trim() || "";
}

function resolveProfileDisplayName(displayName?: string | null, fullName?: string | null, email?: string | null) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const preferredCandidates = [displayName, fullName, getUsernameFallback(email)];
  const preferredName = preferredCandidates
    .find((value) => {
      const trimmedValue = typeof value === "string" ? value.trim() : "";
      return Boolean(trimmedValue) && trimmedValue.toLowerCase() !== normalizedEmail;
    })
    ?.trim();

  return preferredName || (email || "").trim();
}

export default function SettingsPage() {
  const { t, language, setLanguage, currency, setCurrency } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const router = useRouter();
  const { authReady, user: me, isLoggedIn } = useCurrentUser();
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<Language>("en");
  const [preferredCurrency, setPreferredCurrency] = useState<Currency>("USD");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [emailChange, setEmailChange] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);
  const [revokeOthersSaving, setRevokeOthersSaving] = useState(false);
  const loading = !authReady;

  useEffect(() => {
    if (!me) return;
    const nextDisplayName = resolveProfileDisplayName(me.full_name, me.full_name, me.email);
    const nextPhoneNumber = me.phone_number || "";
    const nextCountry = me.country || "";
    const nextTimeZone = me.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const nextAvatarUrl = me.avatar_url || null;
    const nextEmailChange = me.pending_email || "";
    window.setTimeout(() => {
      setDisplayName(nextDisplayName);
      setPhoneNumber(nextPhoneNumber);
      setCountry(nextCountry);
      setTimeZone(nextTimeZone);
      setAvatarUrl(nextAvatarUrl);
      setEmailChange(nextEmailChange);
    }, 0);
  }, [me]);

  useEffect(() => {
    if (!me) return;
    const nextLanguage = (me.preferred_language as Language) || language;
    const nextCurrency = (me.preferred_currency as Currency) || currency;
    window.setTimeout(() => {
      setPreferredLanguage(nextLanguage);
      setPreferredCurrency(nextCurrency);
    }, 0);
  }, [currency, language, me]);

  const accountVerified = !!me?.is_email_verified && !me?.pending_email;
  const locale = LOCALE_BY_LANGUAGE[language] || "en-GB";
  const rememberMeEnabled = getRememberMePreference();
  const resolvedDisplayName = resolveProfileDisplayName(displayName, me?.full_name, me?.email);
  const resolvedAvatarAlt = resolvedDisplayName || me?.email || "Profile";
  const resolvedAvatarInitial = resolvedDisplayName.slice(0, 1).toUpperCase();

  const providerLabel = (provider?: string | null) => {
    if (provider === "google") return "Google";
    if (provider === "apple") return "Apple";
    return t("account_connected_email");
  };

  useEffect(() => {
    let cancelled = false;
    if (!isLoggedIn || !me) {
      window.setTimeout(() => {
        if (!cancelled) setSessions([]);
      }, 0);
      return;
    }

    window.setTimeout(() => {
      if (cancelled) return;
      setSessionsLoading(true);
      api.auth
        .listSessions()
        .then((items) => {
          if (!cancelled) setSessions(items);
        })
        .catch(() => {
          if (!cancelled) setSessions([]);
        })
        .finally(() => {
          if (!cancelled) setSessionsLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, me]);

  const otherSessions = sessions.filter((session) => !session.is_current);
  const formatDateTime = (value?: string | null) =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : t("account_not_available");
  const formatDate = (value?: string | null) =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(value)) : t("account_not_available");

  const profileCompletionChecks = useMemo(
    () => [
      {
        key: "display_name",
        label: t("account_display_name"),
        done: Boolean(displayName.trim()),
        helper: t("account_completion_display_name"),
      },
      {
        key: "avatar",
        label: t("account_avatar_upload"),
        done: Boolean(avatarUrl),
        helper: t("account_completion_avatar"),
      },
      {
        key: "verified_email",
        label: t("account_verify_email"),
        done: accountVerified,
        helper: t("account_completion_verified_email"),
      },
      {
        key: "preferred_language",
        label: t("account_preferred_language"),
        done: Boolean(me?.preferred_language),
        helper: t("account_completion_language"),
      },
    ],
    [accountVerified, avatarUrl, displayName, me?.preferred_language, t]
  );
  const profileCompletionPercent = Math.round(
    (profileCompletionChecks.filter((item) => item.done).length / profileCompletionChecks.length) * 100
  );
  const missingCompletionChecks = profileCompletionChecks.filter((item) => !item.done);
  const verificationBadge = accountVerified ? t("account_verified") : t("account_pending_verification");
  const verificationTone: Tone = accountVerified ? "good" : "warn";
  const activeSessionCountLabel = t("account_active_session_count_value", { count: sessions.length });
  const passwordStatusLabel =
    me?.auth_provider && me.auth_provider !== "email"
      ? t("account_password_managed_by_provider", { provider: providerLabel(me.auth_provider) })
      : t("account_connected_password");
  const connectedAccounts: Array<{ label: string; description: string; badge: string; tone: Tone }> = [];
  if (me) {
    if (me.auth_provider && me.auth_provider !== "email") {
      connectedAccounts.push({
        label: providerLabel(me.auth_provider),
        description: t("account_connected_provider_hint"),
        badge: t("account_connected"),
        tone: "info",
      });
      connectedAccounts.push({
        label: t("account_connected_email_identity"),
        description: accountVerified ? t("account_connected_email_identity_verified") : t("account_connected_email_identity_pending"),
        badge: accountVerified ? t("account_verified") : t("account_pending_verification"),
        tone: accountVerified ? "good" : "warn",
      });
    } else {
      connectedAccounts.push({
        label: t("account_connected_email"),
        description: t("account_connected_password_hint"),
        badge: t("account_connected"),
        tone: accountVerified ? "good" : "warn",
      });
    }
  }

  const jumpTo = (id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.currentTarget.value = "";
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const validType = (file.type && AVATAR_ALLOWED_TYPES.has(file.type)) || AVATAR_ALLOWED_EXTENSIONS.has(ext);
    if (!validType) {
      setProfileMessage({ type: "error", text: t("account_avatar_invalid_type") });
      return;
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setProfileMessage({ type: "error", text: t("account_avatar_too_large") });
      return;
    }
    setProfileMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setProfileMessage({ type: "error", text: t("account_avatar_invalid_type") });
        return;
      }
      setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    const previousUser = me;
    const previousLanguage = language;
    const previousCurrency = currency;
    const optimisticUser = previousUser
      ? {
          ...previousUser,
          full_name: displayName.trim() || null,
          phone_number: phoneNumber.trim() || null,
          country: country.trim() || null,
          preferred_language: preferredLanguage,
          preferred_currency: preferredCurrency,
          time_zone: timeZone.trim() || null,
          avatar_url: avatarUrl,
        }
      : null;
    try {
      setLanguage(preferredLanguage);
      setCurrency(preferredCurrency);
      if (optimisticUser) {
        // Ensure full_name is always a string to match User type requirements
        const safeOptimisticUser = {
          ...optimisticUser,
          full_name: optimisticUser.full_name || "",
        };
        syncCurrentUserProfile(safeOptimisticUser);
      }
      const updated = await api.auth.updateProfile({
        full_name: displayName.trim() || null,
        phone_number: phoneNumber.trim() || null,
        country: country.trim() || null,
        preferred_language: preferredLanguage,
        preferred_currency: preferredCurrency,
        time_zone: timeZone.trim() || null,
        avatar_url: avatarUrl,
      });
      setLanguage((updated.preferred_language as Language) || preferredLanguage);
      setCurrency((updated.preferred_currency as Currency) || preferredCurrency);
      syncCurrentUserProfile(updated);
      setProfileMessage({ type: "success", text: t("account_profile_updated") });
    } catch (e) {
      setLanguage((previousUser?.preferred_language as Language) || previousLanguage);
      setCurrency((previousUser?.preferred_currency as Currency) || previousCurrency);
      if (previousUser) {
        syncCurrentUserProfile(previousUser);
      } else {
        requestCurrentUserRefresh();
      }
      setProfileMessage({ type: "error", text: e instanceof Error ? e.message : t("account_profile_update_failed") });
    } finally {
      setProfileSaving(false);
    }
  };

  const sendVerification = async () => {
    if (!me) return;
    setVerificationSending(true);
    setProfileMessage(null);
    try {
      if (me.pending_email || emailChange.trim()) {
        await api.auth.requestEmailChange({ new_email: (me.pending_email || emailChange).trim(), language: preferredLanguage });
        requestCurrentUserRefresh();
      } else {
        await api.auth.requestVerification({ email: me.email, language: preferredLanguage });
      }
      setProfileMessage({ type: "success", text: t("account_verification_sent") });
    } catch (e) {
      setProfileMessage({ type: "error", text: e instanceof Error ? e.message : t("account_verification_send_failed") });
    } finally {
      setVerificationSending(false);
    }
  };

  const requestEmailUpdate = async () => {
    if (!emailChange.trim()) {
      setProfileMessage({ type: "error", text: t("account_email_required") });
      return;
    }
    setEmailSaving(true);
    setProfileMessage(null);
    try {
      await api.auth.requestEmailChange({ new_email: emailChange.trim(), language: preferredLanguage });
      requestCurrentUserRefresh();
      setProfileMessage({ type: "success", text: t("account_email_update_requested") });
    } catch (e) {
      setProfileMessage({ type: "error", text: e instanceof Error ? e.message : t("account_email_update_failed") });
    } finally {
      setEmailSaving(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setSessionBusyId(sessionId);
    setProfileMessage(null);
    try {
      const result = await api.auth.revokeSession(sessionId);
      if (result.revoked_current) {
        await clearSessionToken();
        router.replace("/login");
        return;
      }
      setSessions((current) => current.filter((session) => session.session_id !== sessionId));
      setProfileMessage({ type: "success", text: t("account_session_revoked") });
    } catch (e) {
      setProfileMessage({ type: "error", text: e instanceof Error ? e.message : t("account_session_revoke_failed") });
    } finally {
      setSessionBusyId(null);
    }
  };

  const revokeOtherSessions = async () => {
    setRevokeOthersSaving(true);
    setProfileMessage(null);
    try {
      await api.auth.revokeOtherSessions();
      setSessions((current) => current.filter((session) => session.is_current));
      setProfileMessage({ type: "success", text: t("account_other_sessions_revoked") });
    } catch (e) {
      setProfileMessage({ type: "error", text: e instanceof Error ? e.message : t("account_session_revoke_failed") });
    } finally {
      setRevokeOthersSaving(false);
    }
  };

  return (
    <DashboardShell title={t("dash_settings_title")} subtitle={t("dash_settings_subtitle")} nav={nav}>
      <div className="space-y-6">
        {loading ? (
          <div className="rounded-[2.5rem] border border-gray-100 bg-white p-12 text-center font-bold text-gray-500 shadow-sm">{t("common_loading")}</div>
        ) : !isLoggedIn || !me ? (
          <div className="rounded-[2.5rem] border border-gray-100 bg-white p-12 text-center shadow-sm">
            <div className="text-6xl">⚙️</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_settings_login_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_settings_login_subtitle")}</div>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[2.5rem] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-indigo-50 shadow-sm">
              <div className="grid gap-6 p-6 lg:grid-cols-[1.45fr,0.95fr] lg:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={resolvedAvatarAlt} width={112} height={112} className="h-28 w-28 rounded-[2rem] object-cover shadow-sm" />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-600 text-3xl font-black text-white shadow-sm">
                        {resolvedAvatarInitial}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="truncate text-3xl font-black tracking-tight text-gray-900">{resolvedDisplayName}</h2>
                        <StatusPill tone={verificationTone}>{verificationBadge}</StatusPill>
                      </div>
                      <div className="mt-2 text-sm font-bold text-gray-500">{me.email}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <StatusPill tone="info">{providerLabel(me.auth_provider)}</StatusPill>
                        <StatusPill tone={rememberMeEnabled ? "good" : "neutral"}>
                          {rememberMeEnabled ? t("account_remember_me_enabled") : t("account_remember_me_disabled")}
                        </StatusPill>
                        <StatusPill tone={me.pending_email ? "warn" : "good"}>
                          {me.pending_email ? t("account_email_change_pending") : t("account_email_current")}
                        </StatusPill>
                      </div>
                      <div className="mt-4 text-sm font-medium text-gray-600">
                        {t("account_activity_summary", {
                          lastLogin: formatDateTime(me.last_login_at),
                          createdAt: formatDate(me.created_at),
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoTile icon="✅" label={t("account_verification_badge")} value={verificationBadge} helper={accountVerified ? t("account_verified_hint") : t("account_pending_verification_hint")} tone={verificationTone} />
                    <InfoTile icon="📊" label={t("account_profile_completion")} value={`${profileCompletionPercent}%`} helper={t("account_profile_completion_hint")} tone={profileCompletionPercent === 100 ? "good" : "info"} />
                    <InfoTile icon="🕒" label={t("account_last_login_label")} value={formatDateTime(me.last_login_at)} helper={t("account_last_login_at", { date: formatDateTime(me.last_login_at) })} tone="neutral" />
                    <InfoTile icon="🗓️" label={t("account_creation_date_label")} value={formatDate(me.created_at)} helper={t("account_creation_date_hint")} tone="neutral" />
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("account_profile_completion")}</div>
                      <div className="mt-2 text-4xl font-black tracking-tight text-gray-900">{profileCompletionPercent}%</div>
                    </div>
                    <StatusPill tone={profileCompletionPercent === 100 ? "good" : "info"}>
                      {profileCompletionPercent === 100 ? t("account_completion_done") : t("account_completion_in_progress")}
                    </StatusPill>
                  </div>
                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300" style={{ width: `${profileCompletionPercent}%` }} />
                  </div>
                  <div className="mt-5 space-y-3">
                    {missingCompletionChecks.length > 0 ? (
                      missingCompletionChecks.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="text-sm font-black text-gray-900">{item.label}</div>
                          <div className="mt-1 text-sm font-medium text-gray-500">{item.helper}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
                        {t("account_completion_done_hint")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {!accountVerified ? (
              <div className="rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-amber-700">{t("account_verify_email")}</div>
                    <div className="mt-2 text-sm font-bold text-amber-900">
                      {me.pending_email
                        ? t("account_pending_email_notice", { email: me.pending_email })
                        : t("account_unverified_email_notice", { email: me.email })}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={verificationSending}
                    onClick={() => void sendVerification()}
                    className="rounded-2xl bg-amber-600 px-5 py-3 font-black text-white transition hover:bg-amber-700 disabled:opacity-60"
                  >
                    {verificationSending ? t("common_please_wait") : t("account_resend_verification")}
                  </button>
                </div>
              </div>
            ) : null}

            {profileMessage ? (
              <div className={`rounded-2xl p-4 text-sm font-black ${profileMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {profileMessage.text}
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.45fr,0.95fr]">
              <div className="space-y-6">
                <SectionCard icon="👤" title={t("account_profile_section")} description={t("account_profile_overview_desc")}>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px,1fr]">
                    <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5">
                      <div className="flex flex-col items-center text-center">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt={resolvedAvatarAlt} width={96} height={96} className="h-24 w-24 rounded-full object-cover shadow-sm" />
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl font-black text-white shadow-sm">
                            {resolvedAvatarInitial}
                          </div>
                        )}
                        <label className="mt-4 inline-flex cursor-pointer rounded-2xl bg-gray-900 px-4 py-2 font-black text-white transition hover:bg-blue-600">
                          {t("account_avatar_upload")}
                          <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                        </label>
                        <button type="button" onClick={() => setAvatarUrl(null)} className="mt-3 text-sm font-black text-gray-500 hover:text-gray-900">
                          {t("common_remove")}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("account_display_name")}</div>
                        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("auth_email")}</div>
                        <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-black text-gray-900">{me.email}</div>
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("auth_phone")}</div>
                        <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("auth_country")}</div>
                        <input value={country} onChange={(e) => setCountry(e.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      disabled={profileSaving}
                      onClick={() => void saveProfile()}
                      className="rounded-2xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {profileSaving ? t("common_please_wait") : t("account_save_profile")}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard icon="🌐" title={t("account_preferences_section")} description={t("account_preferences_overview_desc")}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("account_preferred_language")}</div>
                      <select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value as Language)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900">
                        {(["en", "az", "ru", "tr"] as Language[]).map((item) => (
                          <option key={item} value={item}>
                            {t(`language_name_${item}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("account_preferred_currency")}</div>
                      <select value={preferredCurrency} onChange={(e) => setPreferredCurrency(e.target.value as Currency)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900">
                        {(["USD", "EUR", "AZN", "RUB", "TRY"] as Currency[]).map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("account_time_zone")}</div>
                      <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900" />
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      disabled={profileSaving}
                      onClick={() => void saveProfile()}
                      className="rounded-2xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {profileSaving ? t("common_please_wait") : t("account_save_preferences")}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard
                  id="email-section"
                  icon="✉️"
                  title={t("account_email_section")}
                  description={t("account_email_status_desc")}
                  actions={
                    !accountVerified ? (
                      <button
                        type="button"
                        disabled={verificationSending}
                        onClick={() => void sendVerification()}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-900 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60"
                      >
                        {verificationSending ? t("common_please_wait") : t("account_resend_verification")}
                      </button>
                    ) : null
                  }
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <InfoTile icon="📧" label={t("account_current_email_label")} value={me.email} helper={t("account_email_current")} tone="neutral" />
                    <InfoTile
                      icon="⏳"
                      label={t("account_pending_email_label")}
                      value={me.pending_email || t("account_none")}
                      helper={me.pending_email ? t("account_pending_email_notice", { email: me.pending_email }) : t("account_pending_email_none")}
                      tone={me.pending_email ? "warn" : "neutral"}
                    />
                    <InfoTile
                      icon="✅"
                      label={t("account_verification_status_label")}
                      value={accountVerified ? t("account_verified") : t("account_pending_verification")}
                      helper={accountVerified ? t("account_verified_hint") : t("account_pending_verification_hint")}
                      tone={verificationTone}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("account_new_email")}</div>
                      <input
                        value={emailChange}
                        onChange={(e) => setEmailChange(e.target.value)}
                        type="email"
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900"
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={emailSaving}
                        onClick={() => void requestEmailUpdate()}
                        className="w-full rounded-2xl bg-gray-900 px-6 py-3 font-black text-white transition hover:bg-blue-600 disabled:opacity-60 md:w-auto"
                      >
                        {emailSaving ? t("common_please_wait") : t("account_update_email")}
                      </button>
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-6">
                <SectionCard icon="📈" title={t("account_profile_completion")} description={t("account_profile_completion_desc")}>
                  <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="text-4xl font-black tracking-tight text-gray-900">{profileCompletionPercent}%</div>
                        <div className="mt-1 text-sm font-medium text-gray-500">{t("account_profile_completion_hint")}</div>
                      </div>
                      <StatusPill tone={profileCompletionPercent === 100 ? "good" : "info"}>
                        {profileCompletionPercent === 100 ? t("account_completion_done") : t("account_completion_in_progress")}
                      </StatusPill>
                    </div>
                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300" style={{ width: `${profileCompletionPercent}%` }} />
                    </div>
                    <div className="mt-5 space-y-3">
                      {profileCompletionChecks.map((item) => (
                        <div key={item.key} className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <div>
                            <div className="text-sm font-black text-gray-900">{item.label}</div>
                            {!item.done ? <div className="mt-1 text-sm font-medium text-gray-500">{item.helper}</div> : null}
                          </div>
                          <StatusPill tone={item.done ? "good" : "warn"}>{item.done ? t("account_completed") : t("common_pending")}</StatusPill>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard icon="🔗" title={t("account_connected_accounts")} description={t("account_connected_accounts_hint")}>
                  <div className="space-y-3">
                    {connectedAccounts.map((item) => (
                      <div key={`${item.label}-${item.badge}`} className="rounded-[1.75rem] border border-gray-100 bg-white px-4 py-4 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-black text-gray-900">{item.label}</div>
                            <div className="mt-1 text-sm font-medium text-gray-500">{item.description}</div>
                          </div>
                          <StatusPill tone={item.tone}>{item.badge}</StatusPill>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  icon="🛡️"
                  title={t("settings_security_title")}
                  description={t("account_security_overview_desc")}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => jumpTo("password-section")}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-900 transition hover:border-blue-200 hover:text-blue-700"
                      >
                        {t("settings_change_password")}
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpTo("sessions-section")}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-900 transition hover:border-blue-200 hover:text-blue-700"
                      >
                        {t("account_manage_sessions")}
                      </button>
                    </>
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoTile icon="✅" label={t("account_verification_status_label")} value={accountVerified ? t("account_verified") : t("account_pending_verification")} tone={verificationTone} />
                    <InfoTile icon="💻" label={t("account_active_sessions")} value={activeSessionCountLabel} helper={sessions.length > 0 ? t("account_session_active_now") : t("account_session_empty")} tone="info" />
                    <InfoTile icon="💾" label={t("account_remember_me_status")} value={rememberMeEnabled ? t("account_remember_me_enabled") : t("account_remember_me_disabled")} helper={t("account_remember_me_hint")} tone={rememberMeEnabled ? "good" : "neutral"} />
                    <InfoTile icon="🔐" label={t("account_password_status")} value={passwordStatusLabel} helper={me.auth_provider && me.auth_provider !== "email" ? t("account_password_status_hint_provider", { provider: providerLabel(me.auth_provider) }) : t("account_password_status_hint_local")} tone={me.auth_provider && me.auth_provider !== "email" ? "info" : "good"} />
                    <InfoTile icon="🗂️" label={t("account_last_password_change")} value={t("account_not_available")} helper={t("account_last_password_change_hint")} tone="neutral" />
                  </div>
                </SectionCard>

                <SectionCard icon="🕒" title={t("account_activity_section")} description={t("account_activity_overview_desc")}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoTile icon="⏰" label={t("account_last_login_label")} value={formatDateTime(me.last_login_at)} helper={t("account_last_login_at", { date: formatDateTime(me.last_login_at) })} tone="neutral" />
                    <InfoTile icon="🗓️" label={t("account_creation_date_label")} value={formatDate(me.created_at)} helper={t("account_creation_date_hint")} tone="neutral" />
                  </div>
                </SectionCard>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard id="password-section" icon="🔐" title={t("account_password_section")} description={t("account_password_section_desc")}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("settings_current_password")}</div>
                    <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900" placeholder="••••••••" />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("settings_new_password")}</div>
                    <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900" placeholder="••••••••" />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-gray-400">{t("settings_confirm_password")}</div>
                    <input value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} type="password" className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900" placeholder="••••••••" />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={pwSaving}
                      onClick={async () => {
                        if (newPassword.trim() !== newPasswordConfirm.trim()) {
                          setPwMessage({ type: "error", text: t("auth_password_mismatch") });
                          return;
                        }
                        setPwSaving(true);
                        setPwMessage(null);
                        try {
                          await api.auth.changePassword({ current_password: currentPassword, new_password: newPassword.trim() });
                          setCurrentPassword("");
                          setNewPassword("");
                          setNewPasswordConfirm("");
                          setPwMessage({ type: "success", text: t("settings_password_changed") });
                        } catch (e) {
                          setPwMessage({ type: "error", text: e instanceof Error ? e.message : t("settings_password_change_failed") });
                        } finally {
                          setPwSaving(false);
                        }
                      }}
                      className={`w-full rounded-2xl px-6 py-4 font-black transition ${pwSaving ? "bg-gray-100 text-gray-400" : "bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700"}`}
                    >
                      {pwSaving ? t("common_please_wait") : t("settings_change_password")}
                    </button>
                  </div>
                </div>
                {pwMessage ? (
                  <div className={`mt-4 rounded-2xl p-4 text-sm font-black ${pwMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {pwMessage.text}
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard
                id="sessions-section"
                icon="🖥️"
                title={t("account_active_sessions")}
                description={t("account_manage_sessions_desc")}
                actions={
                  otherSessions.length > 0 ? (
                    <button
                      type="button"
                      disabled={revokeOthersSaving}
                      onClick={() => void revokeOtherSessions()}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-900 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60"
                    >
                      {revokeOthersSaving ? t("common_please_wait") : t("account_other_sessions_revoke")}
                    </button>
                  ) : null
                }
              >
                <div className="space-y-3">
                  {sessionsLoading ? (
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-medium text-gray-500">{t("common_loading")}</div>
                  ) : sessions.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-medium text-gray-500">{t("account_session_empty")}</div>
                  ) : (
                    sessions.map((session) => (
                      <div key={session.session_id} className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-black text-gray-900">{session.device_label || t("account_current_session")}</div>
                              <StatusPill tone={session.is_current ? "info" : "neutral"}>
                                {session.is_current ? t("account_session_current") : providerLabel(session.auth_provider)}
                              </StatusPill>
                            </div>
                            <div className="mt-2 text-sm font-medium text-gray-500">{t("account_session_last_seen", { date: formatDateTime(session.last_seen_at || session.created_at) })}</div>
                            <div className="mt-1 text-sm font-medium text-gray-500">{t("account_session_started", { date: formatDateTime(session.created_at) })}</div>
                            {session.ip_address ? <div className="mt-1 text-sm font-medium text-gray-500">{t("account_session_ip", { ip: session.ip_address })}</div> : null}
                          </div>
                          <button
                            type="button"
                            disabled={sessionBusyId === session.session_id}
                            onClick={() => void revokeSession(session.session_id)}
                            className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-600 disabled:opacity-60"
                          >
                            {sessionBusyId === session.session_id ? t("common_please_wait") : t(session.is_current ? "account_session_sign_out_current" : "account_session_sign_out")}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    await clearSessionToken();
                    window.location.href = "/";
                  })();
                }}
                className="rounded-2xl bg-gray-900 px-6 py-4 font-black text-white shadow-lg transition hover:bg-blue-600"
              >
                {t("nav_logout")}
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
