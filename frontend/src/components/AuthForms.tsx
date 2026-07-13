"use client";

import { useEffect, useMemo, useState } from "react";
import { api, setSessionToken } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";

export default function AuthForms() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"method" | "email" | "verify" | "forgot" | "reset" | "onboarding">("method");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [phoneVerificationCode, setPhoneVerificationCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [requiresEmailVerification, setRequiresEmailVerification] = useState(true);
  const [requiresPhoneVerification, setRequiresPhoneVerification] = useState(false);
  const [emailResendSec, setEmailResendSec] = useState(0);
  const [phoneResendSec, setPhoneResendSec] = useState(0);
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetNewPasswordConfirm, setResetNewPasswordConfirm] = useState("");
  const [resetChannel, setResetChannel] = useState<"email" | "phone">("email");

  const [preferredDestinations, setPreferredDestinations] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState<string>("");
  const [travelStyle, setTravelStyle] = useState<string>("");
  const [interests, setInterests] = useState<string[]>([]);

  const destinationOptions = useMemo(
    () => [
      t("onboarding_destination_japan"),
      t("onboarding_destination_turkey"),
      t("onboarding_destination_france"),
      t("onboarding_destination_italy"),
      t("onboarding_destination_azerbaijan"),
      t("onboarding_destination_switzerland"),
      t("onboarding_destination_iceland"),
      t("onboarding_destination_usa"),
      t("onboarding_destination_thailand"),
      t("onboarding_destination_spain"),
    ],
    [t]
  );
  const budgetOptions = useMemo(
    () => [
      t("onboarding_budget_under_500"),
      t("onboarding_budget_500_1500"),
      t("onboarding_budget_1500_3000"),
      t("onboarding_budget_3000_5000"),
      t("onboarding_budget_5000_plus"),
    ],
    [t]
  );
  const travelStyleOptions = useMemo(
    () => [
      t("onboarding_style_adventure"),
      t("onboarding_style_relax"),
      t("onboarding_style_culture"),
      t("onboarding_style_food"),
      t("onboarding_style_luxury"),
      t("onboarding_style_family"),
    ],
    [t]
  );
  const interestOptions = useMemo(
    () => [
      t("onboarding_interest_nature"),
      t("onboarding_interest_museums"),
      t("onboarding_interest_beaches"),
      t("onboarding_interest_mountains"),
      t("onboarding_interest_nightlife"),
      t("onboarding_interest_photography"),
    ],
    [t]
  );

  const resetFlow = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setStep("method");
    setMessage(null);
    setLoading(false);
    setVerificationCode("");
    setPhoneVerificationCode("");
    setEmailVerified(false);
    setPhoneVerified(false);
    setRequiresEmailVerification(true);
    setRequiresPhoneVerification(false);
    setEmailResendSec(0);
    setPhoneResendSec(0);
    setResetCode("");
    setResetNewPassword("");
    setResetNewPasswordConfirm("");
    setPreferredDestinations([]);
    setBudgetRange("");
    setTravelStyle("");
    setInterests([]);
  };

  useEffect(() => {
    if (step !== "verify") return;
    if (emailResendSec <= 0 && phoneResendSec <= 0) return;
    const id = window.setInterval(() => {
      setEmailResendSec((v) => (v > 0 ? v - 1 : 0));
      setPhoneResendSec((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [emailResendSec, phoneResendSec, step]);

  const normalizeAuthError = (raw: unknown) => {
    const text = raw instanceof Error ? raw.message : t("auth_error");
    const m = text.toLowerCase();
    if (m.includes("email not verified")) return { kind: "email_not_verified" as const, text: t("auth_verify_needed") };
    if (m.includes("phone not verified")) return { kind: "phone_not_verified" as const, text: t("auth_phone_verify_needed") };
    if (m.includes("verification code expired")) return { kind: "code_expired" as const, text: t("otp_code_expired") };
    if (m.includes("invalid verification code")) return { kind: "code_invalid" as const, text: t("otp_code_invalid") };
    if (m.includes("sms service")) return { kind: "sms_unavailable" as const, text: t("otp_sms_unavailable") };
    return { kind: "generic" as const, text };
  };

  const toggleItem = (items: string[], value: string) => {
    if (items.includes(value)) return items.filter((x) => x !== value);
    return [...items, value];
  };

  const showEmailVerificationCard = requiresEmailVerification || emailVerified;
  const showPhoneVerificationCard = requiresPhoneVerification || phoneVerified;
  const verificationSubtitle =
    showEmailVerificationCard && showPhoneVerificationCard
      ? t("otp_verify_subtitle", { email })
      : showPhoneVerificationCard
        ? t("auth_phone_verify_needed")
        : t("auth_verify_subtitle", { email });

  const handleSocial = async (provider: "google" | "apple") => {
    const providerLabel = provider === "google" ? t("auth_google") : t("auth_apple");
    const entered = prompt(t("auth_social_email_prompt", { provider: providerLabel })) || "";
    const socialEmail = entered.trim();
    if (!socialEmail) return;

    setLoading(true);
    setMessage(null);
    try {
      const result = await api.auth.socialLogin({ provider, email: socialEmail });
      setSessionToken(result.access_token);

      setEmail(socialEmail);
      const me = await api.auth.me();
      if (!me.onboarding_completed) {
        setStep("onboarding");
        setMessage({ type: "success", text: t("auth_login_success") });
      } else {
        if (me.role === "admin") {
          router.push("/admin");
        } else if (me.role === "agency") {
          router.push("/agency");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : t("auth_error");
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === "login") {
        const formData = new FormData();
        formData.set("username", email);
        formData.set("password", password);
        const result = await api.auth.login(formData);
        setSessionToken(result.access_token);
        const me = await api.auth.me();
        if (!me.onboarding_completed) {
          setStep("onboarding");
          setMessage({ type: "success", text: t("auth_login_success") });
        } else {
          if (me.role === "admin") {
            router.push("/admin");
          } else if (me.role === "agency") {
            router.push("/agency");
          } else {
            router.push("/dashboard");
          }
        }
        return;
      }

      await api.auth.register({
        email,
        password,
        full_name: fullName,
        phone_number: phoneNumber,
        country,
        role: "user",
        language,
      });
      setEmailVerified(false);
      setPhoneVerified(false);
      setRequiresEmailVerification(true);
      setRequiresPhoneVerification(false);
      setStep("verify");
      setMessage({ type: "success", text: t("auth_register_success") });
    } catch (error) {
      const mapped = normalizeAuthError(error);
      if (mapped.kind === "email_not_verified") {
        await api.auth.requestVerification({ email, language }).catch(() => undefined);
        setEmailVerified(false);
        setPhoneVerified(false);
        setRequiresEmailVerification(true);
        setRequiresPhoneVerification(false);
        setEmailResendSec(60);
        setStep("verify");
        setMessage({ type: "error", text: mapped.text });
        return;
      }
      if (mapped.kind === "phone_not_verified") {
        await api.auth.requestPhoneVerification({ email, language }).catch(() => undefined);
        setEmailVerified(true);
        setPhoneVerified(false);
        setRequiresEmailVerification(false);
        setRequiresPhoneVerification(true);
        setPhoneResendSec(60);
        setStep("verify");
        setMessage({ type: "error", text: mapped.text });
        return;
      }
      setMessage({ type: "error", text: mapped.text });
    } finally {
      setLoading(false);
    }
  };

  const finalizeLogin = async () => {
    const formData = new FormData();
    formData.set("username", email);
    formData.set("password", password);
    const result = await api.auth.login(formData);
    setSessionToken(result.access_token);
    const me = await api.auth.me();
    if (!me.onboarding_completed) {
      setStep("onboarding");
      setMessage({ type: "success", text: t("auth_verified_success") });
      return;
    }
    if (me.role === "admin") {
      router.push("/admin");
    } else if (me.role === "agency") {
      router.push("/agency");
    } else {
      router.push("/dashboard");
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const u = await api.auth.verifyEmail({ email, code: verificationCode });
      const role = typeof u.role === "string" ? u.role.toLowerCase() : "";
      const nextEmailVerified = !!u.is_email_verified || !!u.is_verified;
      const nextPhoneVerified = !!u.is_phone_verified || !!u.is_verified;

      setEmailVerified(nextEmailVerified);
      setRequiresEmailVerification(false);

      if (role === "agency" && !nextPhoneVerified) {
        setPhoneVerified(false);
        setRequiresPhoneVerification(true);
        await api.auth.requestPhoneVerification({ email, language }).catch(() => undefined);
        setPhoneResendSec(60);
        setMessage({ type: "success", text: t("auth_phone_verify_needed") });
        return;
      }

      setPhoneVerified(nextPhoneVerified);
      setRequiresPhoneVerification(false);
      await finalizeLogin();
    } catch (error) {
      const mapped = normalizeAuthError(error);
      if (mapped.kind === "phone_not_verified") {
        await api.auth.requestPhoneVerification({ email, language }).catch(() => undefined);
        setEmailVerified(true);
        setRequiresEmailVerification(false);
        setRequiresPhoneVerification(true);
        setPhoneResendSec(60);
      }
      setMessage({ type: "error", text: mapped.text });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const u = await api.auth.verifyPhone({ email, code: phoneVerificationCode });
      const nextPhoneVerified = !!u.is_phone_verified || !!u.is_verified;
      const nextEmailVerified = !!u.is_email_verified || !!u.is_verified;

      setPhoneVerified(nextPhoneVerified);
      setRequiresPhoneVerification(false);

      if (nextEmailVerified) {
        setEmailVerified(true);
        setRequiresEmailVerification(false);
        await finalizeLogin();
        return;
      }

      setRequiresEmailVerification(true);
      setMessage({ type: "success", text: t("otp_phone_verified") });
    } catch (error) {
      const mapped = normalizeAuthError(error);
      if (mapped.kind === "email_not_verified") {
        await api.auth.requestVerification({ email, language }).catch(() => undefined);
        setRequiresEmailVerification(true);
        setEmailResendSec(60);
      }
      setMessage({ type: "error", text: mapped.text });
    } finally {
      setLoading(false);
    }
  };

  const resendEmail = async () => {
    if (emailResendSec > 0) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.auth.requestVerification({ email, language });
      setEmailResendSec(60);
      setMessage({ type: "success", text: t("auth_code_resent") });
    } catch (error) {
      const mapped = normalizeAuthError(error);
      setMessage({ type: "error", text: mapped.text });
    } finally {
      setLoading(false);
    }
  };

  const resendPhone = async () => {
    if (phoneResendSec > 0) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.auth.requestPhoneVerification({ email, language });
      setPhoneResendSec(60);
      setMessage({ type: "success", text: t("auth_code_resent") });
    } catch (error) {
      const mapped = normalizeAuthError(error);
      setMessage({ type: "error", text: mapped.text });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (resetChannel === "phone") {
        await api.auth.forgotPasswordByPhone({ phone_number: phoneNumber, language });
      } else {
        await api.auth.forgotPassword({ email, language });
      }
      setStep("reset");
      setMessage({ type: "success", text: t("auth_reset_code_sent") });
    } catch (error) {
      const mapped = normalizeAuthError(error);
      setMessage({ type: "error", text: mapped.text });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextPwd = resetNewPassword.trim();
    if (nextPwd !== resetNewPasswordConfirm.trim()) {
      setMessage({ type: "error", text: t("auth_password_mismatch") });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (resetChannel === "phone") {
        await api.auth.resetPasswordByPhone({ phone_number: phoneNumber, code: resetCode, new_password: nextPwd });
      } else {
        await api.auth.resetPassword({ email, code: resetCode, new_password: nextPwd });
      }
      setPassword("");
      setResetCode("");
      setResetNewPassword("");
      setResetNewPasswordConfirm("");
      setStep("email");
      setMode("login");
      setMessage({ type: "success", text: t("auth_password_reset_success") });
    } catch (error) {
      const mapped = normalizeAuthError(error);
      setMessage({ type: "error", text: mapped.text });
    } finally {
      setLoading(false);
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.auth.onboarding({
        preferred_destinations: preferredDestinations,
        budget_range: budgetRange || null,
        travel_style: travelStyle || null,
        interests,
      });
      router.push("/dashboard");
    } catch (error) {
      const text = error instanceof Error ? error.message : t("auth_error");
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
      <div className="flex rounded-2xl bg-gray-50 p-1 mb-6">
        <button
          type="button"
          onClick={() => resetFlow("login")}
          className={`flex-1 py-3 rounded-2xl font-bold text-sm ${
            mode === "login" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          {t("auth_login")}
        </button>
        <button
          type="button"
          onClick={() => resetFlow("signup")}
          className={`flex-1 py-3 rounded-2xl font-bold text-sm ${
            mode === "signup" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          {t("auth_register")}
        </button>
      </div>

      {step === "method" && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            {mode === "login" ? t("auth_title_login") : t("auth_title_register")}
          </h2>
          <p className="text-sm text-gray-500 font-medium text-center mb-6">{t("auth_method_subtitle")}</p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleSocial("google")}
              disabled={loading}
              className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-4 rounded-2xl transition duration-200 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.3 0 6.3 1.1 8.7 3.3l6.5-6.5C35.3 2.6 30 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.6 5.9C12.2 13.2 17.6 9.5 24 9.5z" />
                <path fill="#34A853" d="M46.5 24.5c0-1.6-.1-2.7-.4-3.9H24v7.6h12.9c-.3 2-1.8 5-5 7.1l7.4 5.7c4.3-4 7.2-9.9 7.2-16.5z" />
                <path fill="#4A90E2" d="M10.2 28.5c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.6-5.9C.9 16.6 0 20.2 0 23.8s.9 7.2 2.6 10.6l7.6-5.9z" />
                <path fill="#FBBC05" d="M24 48c6 0 11.1-2 14.8-5.4l-7.4-5.7c-2 1.4-4.7 2.4-7.4 2.4-6.4 0-11.8-3.7-14.5-9.1l-7.6 5.9C6.5 42.6 14.6 48 24 48z" />
              </svg>
              {t("auth_google")}
            </button>
            <button
              type="button"
              onClick={() => void handleSocial("apple")}
              disabled={loading}
              className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-4 rounded-2xl transition duration-200 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M16.6 13.3c0 2.9 2.6 3.9 2.6 3.9s-1.8 5.1-4.2 5.1c-1.1 0-1.9-.7-3-.7-1.1 0-2 .7-3.2.7-2.1 0-4.7-4.8-4.7-8.6 0-3.7 2.2-5.5 4.3-5.5 1.1 0 2 .7 3 .7 1 0 2-.7 3.4-.7.6 0 2.6.1 3.8 2-.1.1-2.3 1.3-2.3 4.1zM14.1 3.3c.8-1 1.4-2.4 1.2-3.3-1.2.1-2.6.8-3.4 1.8-.7.8-1.4 2.3-1.2 3.2 1.3.1 2.7-.7 3.4-1.7z" />
              </svg>
              {t("auth_apple")}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setMessage(null);
              }}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition duration-200 shadow-lg shadow-blue-100"
            >
              {t("auth_email_continue")}
            </button>
          </div>

          {message && (
            <div
              className={`mt-5 p-4 rounded-xl text-sm font-bold ${
                message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}
        </>
      )}

      {step === "email" && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {mode === "login" ? t("auth_title_login") : t("auth_title_register")}
          </h2>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("auth_full_name")}
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    type="text"
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                    placeholder={t("auth_full_name_placeholder")}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("auth_phone")}
                    <span className="ml-1 normal-case tracking-normal text-gray-400">({t("custom_trip_optional")})</span>
                  </label>
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    type="tel"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                    placeholder={t("auth_phone_placeholder")}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("auth_country")}
                    <span className="ml-1 normal-case tracking-normal text-gray-400">({t("custom_trip_optional")})</span>
                  </label>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    type="text"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                    placeholder={t("auth_country_placeholder")}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t("auth_email")}</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder={t("auth_email_placeholder")}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("auth_password")}
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder="••••••••"
              />
              {mode === "login" ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setStep("forgot");
                      setMessage(null);
                    }}
                    className="text-sm font-bold text-blue-600 hover:underline disabled:opacity-60"
                  >
                    {t("auth_forgot_password")}
                  </button>
                </div>
              ) : null}
            </div>

            {message && (
              <div
                className={`p-4 rounded-xl text-sm font-bold ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition duration-200 shadow-lg shadow-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {loading ? t("common_please_wait") : mode === "login" ? t("auth_login") : t("auth_register")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setStep("method");
                setMessage(null);
              }}
              className="text-sm font-bold text-gray-500 hover:text-gray-800"
            >
              {t("common_close")}
            </button>
          </div>
        </>
      )}

      {step === "verify" && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t("otp_verify_title")}</h2>
          <p className="text-sm text-gray-500 font-medium text-center mb-6">{verificationSubtitle}</p>

          <div className="space-y-4">
            {showEmailVerificationCard ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="font-black text-gray-900">{t("otp_verify_email_title")}</div>
                <div
                  className={`text-xs font-black px-3 py-1 rounded-full ${
                    emailVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {emailVerified ? t("otp_status_verified") : t("otp_status_pending")}
                </div>
              </div>

              {!emailVerified ? (
                <form onSubmit={handleVerifyEmail} className="mt-4 space-y-3">
                  <input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400 tracking-[0.3em] text-center"
                    placeholder={t("auth_code_placeholder")}
                  />
                  <div className="flex gap-3">
                    <button
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {loading ? t("common_please_wait") : t("otp_verify_email_button")}
                    </button>
                    <button
                      type="button"
                      disabled={loading || emailResendSec > 0}
                      onClick={() => void resendEmail()}
                      className="flex-1 bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-3 rounded-2xl transition disabled:opacity-50"
                    >
                      {emailResendSec > 0 ? `${t("auth_resend_code")} (${emailResendSec})` : t("auth_resend_code")}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
            ) : null}

            {showPhoneVerificationCard ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="font-black text-gray-900">{t("otp_verify_phone_title")}</div>
                <div
                  className={`text-xs font-black px-3 py-1 rounded-full ${
                    phoneVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {phoneVerified ? t("otp_status_verified") : t("otp_status_pending")}
                </div>
              </div>

              {!phoneVerified ? (
                <form onSubmit={handleVerifyPhone} className="mt-4 space-y-3">
                  <input
                    value={phoneVerificationCode}
                    onChange={(e) => setPhoneVerificationCode(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400 tracking-[0.3em] text-center"
                    placeholder={t("auth_code_placeholder")}
                  />
                  <div className="flex gap-3">
                    <button
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {loading ? t("common_please_wait") : t("otp_verify_phone_button")}
                    </button>
                    <button
                      type="button"
                      disabled={loading || phoneResendSec > 0}
                      onClick={() => void resendPhone()}
                      className="flex-1 bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-3 rounded-2xl transition disabled:opacity-50"
                    >
                      {phoneResendSec > 0 ? `${t("auth_resend_code")} (${phoneResendSec})` : t("auth_resend_code")}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
            ) : null}

            {message && (
              <div
                className={`p-4 rounded-xl text-sm font-bold ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep("email");
                setMessage(null);
              }}
              className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-4 rounded-2xl transition duration-200 disabled:opacity-50"
            >
              {t("auth_back")}
            </button>
          </div>
        </>
      )}

      {step === "forgot" && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t("auth_forgot_title")}</h2>
          <p className="text-sm text-gray-500 font-medium text-center mb-6">{t("auth_forgot_subtitle")}</p>

          <form onSubmit={handleForgot} className="space-y-4">
            <div className="flex rounded-2xl bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setResetChannel("email")}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm ${
                  resetChannel === "email" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {t("otp_channel_email")}
              </button>
              <button
                type="button"
                onClick={() => setResetChannel("phone")}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm ${
                  resetChannel === "phone" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {t("otp_channel_sms")}
              </button>
            </div>

            {resetChannel === "phone" ? (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t("auth_phone")}</label>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  type="tel"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("auth_phone_placeholder")}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t("auth_email")}</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("auth_email_placeholder")}
                />
              </div>
            )}

            {message && (
              <div
                className={`p-4 rounded-xl text-sm font-bold ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition duration-200 shadow-lg shadow-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {loading ? t("common_please_wait") : t("auth_send_reset_code")}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep("email");
                setMessage(null);
              }}
              className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-4 rounded-2xl transition duration-200 disabled:opacity-50"
            >
              {t("common_close")}
            </button>
          </form>
        </>
      )}

      {step === "reset" && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t("auth_reset_title")}</h2>
          <p className="text-sm text-gray-500 font-medium text-center mb-6">
            {resetChannel === "phone" ? t("auth_reset_subtitle_phone", { phone: phoneNumber }) : t("auth_reset_subtitle", { email })}
          </p>

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t("auth_code_label")}</label>
              <input
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                type="text"
                inputMode="numeric"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400 tracking-[0.3em] text-center"
                placeholder={t("auth_code_placeholder")}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t("auth_new_password")}</label>
              <input
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                type="password"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t("auth_confirm_password")}</label>
              <input
                value={resetNewPasswordConfirm}
                onChange={(e) => setResetNewPasswordConfirm(e.target.value)}
                type="password"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                placeholder="••••••••"
              />
            </div>

            {message && (
              <div
                className={`p-4 rounded-xl text-sm font-bold ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition duration-200 shadow-lg shadow-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {loading ? t("common_please_wait") : t("auth_reset_button")}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setMessage(null);
                try {
                  if (resetChannel === "phone") {
                    await api.auth.forgotPasswordByPhone({ phone_number: phoneNumber, language });
                  } else {
                    await api.auth.forgotPassword({ email, language });
                  }
                  setMessage({ type: "success", text: t("auth_reset_code_resent") });
                } catch (error) {
                  const mapped = normalizeAuthError(error);
                  setMessage({ type: "error", text: mapped.text });
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-4 rounded-2xl transition duration-200 disabled:opacity-50"
            >
              {t("auth_resend_code")}
            </button>
          </form>
        </>
      )}

      {step === "onboarding" && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t("onboarding_title")}</h2>
          <p className="text-sm text-gray-500 font-medium text-center mb-6">{t("onboarding_subtitle")}</p>

          <form onSubmit={handleOnboarding} className="space-y-6">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("onboarding_destinations")}
              </div>
              <div className="flex flex-wrap gap-2">
                {destinationOptions.map((d) => {
                  const active = preferredDestinations.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPreferredDestinations((prev) => toggleItem(prev, d))}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border transition ${
                        active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-900 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("onboarding_budget")}
              </label>
              <select
                value={budgetRange}
                onChange={(e) => setBudgetRange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
              >
                <option value="">{t("onboarding_select")}</option>
                {budgetOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("onboarding_style")}
              </label>
              <select
                value={travelStyle}
                onChange={(e) => setTravelStyle(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900"
              >
                <option value="">{t("onboarding_select")}</option>
                {travelStyleOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t("onboarding_interests")}
              </div>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((i) => {
                  const active = interests.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setInterests((prev) => toggleItem(prev, i))}
                      className={`px-3 py-2 rounded-xl text-sm font-bold border transition ${
                        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {i}
                    </button>
                  );
                })}
              </div>
            </div>

            {message && (
              <div
                className={`p-4 rounded-xl text-sm font-bold ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition duration-200 shadow-lg shadow-blue-100 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {loading ? t("common_please_wait") : t("onboarding_continue")}
            </button>
          </form>
        </>
      )}

      {step !== "method" && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setStep("method");
              setMessage(null);
            }}
            className="text-sm font-bold text-blue-600 hover:text-blue-700"
          >
            {t("auth_back")}
          </button>
        </div>
      )}
    </div>
  );
}
