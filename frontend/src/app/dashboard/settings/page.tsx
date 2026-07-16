"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, clearSessionToken, UserSession } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { Currency, Language, useLanguage } from "@/context/LanguageContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

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
    const nextDisplayName = me.full_name || "";
    const nextPhoneNumber = me.phone_number || "";
    const nextCountry = me.country || "";
    const nextTimeZone = me.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const nextLanguage = (me.preferred_language as Language) || language;
    const nextCurrency = (me.preferred_currency as Currency) || currency;
    const nextAvatarUrl = me.avatar_url || null;
    const nextEmailChange = me.pending_email || "";
    window.setTimeout(() => {
      setDisplayName(nextDisplayName);
      setPhoneNumber(nextPhoneNumber);
      setCountry(nextCountry);
      setTimeZone(nextTimeZone);
      setPreferredLanguage(nextLanguage);
      setPreferredCurrency(nextCurrency);
      setAvatarUrl(nextAvatarUrl);
      setEmailChange(nextEmailChange);
    }, 0);
  }, [currency, language, me]);

  const accountVerified = !!me?.is_email_verified && !me?.pending_email;
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

  const currentSession = sessions.find((session) => session.is_current) || null;
  const otherSessions = sessions.filter((session) => !session.is_current);
  const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "...");

  const onAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result.startsWith("data:image/")) setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    try {
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
      window.dispatchEvent(new Event("tourpie:user-updated"));
      setProfileMessage({ type: "success", text: t("account_profile_updated") });
    } catch (e) {
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
      window.dispatchEvent(new Event("tourpie:user-updated"));
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
        clearSessionToken();
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
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : !isLoggedIn || !me ? (
          <div className="py-12 text-center">
            <div className="text-6xl">⚙️</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_settings_login_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_settings_login_subtitle")}</div>
          </div>
        ) : (
          <div className="space-y-6">
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
                    className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black px-5 py-3 transition disabled:opacity-60"
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

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_profile_section")}</div>
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-6">
                <div className="rounded-[1.75rem] bg-white border border-gray-100 p-5">
                  <div className="flex flex-col items-center text-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName || me.email} className="h-24 w-24 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-sm">
                        {(displayName || me.email).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <label className="mt-4 inline-flex cursor-pointer rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-4 py-2 transition">
                      {t("account_avatar_upload")}
                      <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="mt-3 text-sm font-black text-gray-500 hover:text-gray-900"
                    >
                      {t("common_remove")}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_display_name")}</div>
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("auth_email")}</div>
                    <div className="mt-2 rounded-2xl bg-white border border-gray-200 px-4 py-3 font-black text-gray-900">{me.email}</div>
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("auth_phone")}</div>
                    <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("auth_country")}</div>
                    <input value={country} onChange={(e) => setCountry(e.target.value)} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900" />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={profileSaving}
                  onClick={() => void saveProfile()}
                  className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 transition disabled:opacity-60"
                >
                  {profileSaving ? t("common_please_wait") : t("account_save_profile")}
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_preferences_section")}</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_preferred_language")}</div>
                  <select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value as Language)} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900">
                    {(["en", "az", "ru", "tr"] as Language[]).map((item) => (
                      <option key={item} value={item}>{t(`language_name_${item}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_preferred_currency")}</div>
                  <select value={preferredCurrency} onChange={(e) => setPreferredCurrency(e.target.value as Currency)} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900">
                    {(["USD", "EUR", "AZN", "RUB", "TRY"] as Currency[]).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_time_zone")}</div>
                  <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900" />
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={profileSaving}
                  onClick={() => void saveProfile()}
                  className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 transition disabled:opacity-60"
                >
                  {profileSaving ? t("common_please_wait") : t("account_save_preferences")}
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_email_section")}</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_new_email")}</div>
                  <input value={emailChange} onChange={(e) => setEmailChange(e.target.value)} type="email" className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900" placeholder="name@example.com" />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={emailSaving}
                    onClick={() => void requestEmailUpdate()}
                    className="w-full md:w-auto rounded-2xl bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-3 transition disabled:opacity-60"
                  >
                    {emailSaving ? t("common_please_wait") : t("account_update_email")}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_security_title")}</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_current_password")}</div>
                  <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900" placeholder="••••••••" />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_new_password")}</div>
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900" placeholder="••••••••" />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_confirm_password")}</div>
                  <input value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} type="password" className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900" placeholder="••••••••" />
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
                    className={`w-full font-black py-4 px-6 rounded-2xl transition ${pwSaving ? "bg-gray-100 text-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}
                  >
                    {pwSaving ? t("common_please_wait") : t("settings_change_password")}
                  </button>
                </div>
              </div>
              {pwMessage ? <div className={`mt-4 rounded-2xl p-4 text-sm font-black ${pwMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{pwMessage.text}</div> : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_connected_accounts")}</div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-white border border-gray-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-gray-900">{t("account_connected_email")}</div>
                        <div className="mt-1 text-sm font-medium text-gray-500">{t("account_connected_password_hint")}</div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${accountVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {accountVerified ? t("account_verified") : t("account_verify_email")}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white border border-gray-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-gray-900">{providerLabel(me.auth_provider)}</div>
                        <div className="mt-1 text-sm font-medium text-gray-500">
                          {me.auth_provider && me.auth_provider !== "email" ? t("account_connected_provider_hint") : t("account_connected_accounts_hint")}
                        </div>
                      </div>
                      <div className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-blue-700">
                        {me.auth_provider && me.auth_provider !== "email" ? t("account_connected_primary") : t("account_connected_password")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("account_active_sessions")}</div>
                  {otherSessions.length > 0 ? (
                    <button
                      type="button"
                      disabled={revokeOthersSaving}
                      onClick={() => void revokeOtherSessions()}
                      className="rounded-2xl bg-white border border-gray-200 px-4 py-2 text-xs font-black text-gray-900 transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60"
                    >
                      {revokeOthersSaving ? t("common_please_wait") : t("account_other_sessions_revoke")}
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3">
                  {sessionsLoading ? (
                    <div className="rounded-2xl bg-white border border-gray-200 px-4 py-4 text-sm font-medium text-gray-500">{t("common_loading")}</div>
                  ) : sessions.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-gray-200 px-4 py-4 text-sm font-medium text-gray-500">{t("account_session_empty")}</div>
                  ) : (
                    sessions.map((session) => (
                      <div key={session.session_id} className="rounded-2xl bg-white border border-gray-200 px-4 py-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-black text-gray-900">{session.device_label || t("account_current_session")}</div>
                              <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${session.is_current ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                                {session.is_current ? t("account_session_current") : providerLabel(session.auth_provider)}
                              </div>
                            </div>
                            <div className="mt-2 text-sm font-medium text-gray-500">
                              {t("account_session_last_seen", { date: formatDateTime(session.last_seen_at || session.created_at) })}
                            </div>
                            <div className="mt-1 text-sm font-medium text-gray-500">
                              {t("account_session_started", { date: formatDateTime(session.created_at) })}
                            </div>
                            {session.ip_address ? (
                              <div className="mt-1 text-sm font-medium text-gray-500">{t("account_session_ip", { ip: session.ip_address })}</div>
                            ) : null}
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
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  clearSessionToken();
                  window.location.href = "/";
                }}
                className="bg-gray-900 hover:bg-blue-600 text-white font-black px-6 py-4 rounded-2xl transition shadow-lg"
              >
                {t("nav_logout")}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
