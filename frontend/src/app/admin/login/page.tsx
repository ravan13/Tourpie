"use client";

import { useLanguage } from "@/context/LanguageContext";
import { api, getStoredToken, getStoredTokenPayload, SESSION_EXPIRED_KEY, setSessionToken } from "@/lib/api";
import Logo from "@/components/Logo";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function AdminLoginPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"login" | "2fa" | "forgot" | "reset">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);
  const loginPointerRef = useRef<{ at: number; trusted: boolean } | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetNewPasswordConfirm, setResetNewPasswordConfirm] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    const decoded = getStoredTokenPayload();
    const role = typeof decoded?.role === "string" ? decoded.role : null;
    if (role === "admin") {
      router.replace("/admin");
    } else if (role === "agency") {
      router.replace("/agency");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const reason = searchParams?.get("reason");
      if (reason === "session_expired") {
        setExpiredNotice(t("session_expired_message"));
      }
      try {
        const raw = localStorage.getItem(SESSION_EXPIRED_KEY);
        if (!raw) return;
        setExpiredNotice(t("session_expired_message"));
        localStorage.removeItem(SESSION_EXPIRED_KEY);
      } catch {
        return;
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [searchParams, t]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    const debug = (process.env.NEXT_PUBLIC_DEBUG_AUTH || "").trim() === "1";
    const submitter = (e as unknown as { nativeEvent?: { submitter?: unknown } }).nativeEvent?.submitter as
      | { dataset?: Record<string, string | undefined>; tagName?: string }
      | undefined;

    const submitterOk = submitter?.dataset?.adminLogin === "1";
    const now = Date.now();
    const recentPointer = loginPointerRef.current ? now - loginPointerRef.current.at < 1500 : false;
    const trustedPointer = loginPointerRef.current?.trusted === true;

    if (!submitterOk || !recentPointer || !trustedPointer) {
      const meta = {
        route: window.location.pathname,
        sourceComponent: "AdminLoginPage:start:autoSubmitBlocked",
        timestamp: now,
        submitter: submitter?.tagName || null,
        submitterOk,
        recentPointer,
        trustedPointer,
      };
      if (debug) {
        console.error(
          `ADMIN_LOGIN_START_TRIGGERED route=${meta.route} source=${meta.sourceComponent} ts=${meta.timestamp}`,
          meta
        );
      }
      setMessage({ type: "error", text: t("admin_login_click_continue") });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const meta = {
        route: window.location.pathname,
        sourceComponent: "AdminLoginPage:start",
        timestamp: now,
      };
      if (debug) {
        console.log(
          `ADMIN_LOGIN_START_TRIGGERED route=${meta.route} source=${meta.sourceComponent} ts=${meta.timestamp}`,
          meta
        );
      }
      await api.auth.adminLoginStart({ email, password, language });
      setStep("2fa");
      setMessage({ type: "success", text: t("admin_2fa_prompt") });
    } catch (error) {
      const text = error instanceof Error ? error.message : t("auth_error");
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
      loginPointerRef.current = null;
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.auth.adminVerify2fa({ email, code });
      setSessionToken(res.access_token);
      router.push("/admin");
    } catch (error) {
      const text = error instanceof Error ? error.message : t("auth_error");
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.auth.forgotPassword({ email, language });
      setStep("reset");
      setMessage({ type: "success", text: t("auth_reset_code_sent") });
    } catch (error) {
      const text = error instanceof Error ? error.message : t("auth_error");
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetNewPassword.trim() !== resetNewPasswordConfirm.trim()) {
      setMessage({ type: "error", text: t("auth_password_mismatch") });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await api.auth.resetPassword({ email, code: resetCode, new_password: resetNewPassword.trim() });
      setResetCode("");
      setResetNewPassword("");
      setResetNewPasswordConfirm("");
      setPassword("");
      setCode("");
      setStep("login");
      setMessage({ type: "success", text: t("auth_password_reset_success") });
    } catch (error) {
      const text = error instanceof Error ? error.message : t("auth_error");
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 flex flex-col items-center">
          <Logo className="mb-4" />
          <p className="text-sm text-gray-500 font-medium">{t("admin_login_subtitle")}</p>
        </div>

        <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
          <h1 className="text-2xl font-black text-gray-900 mb-6 text-center">{t("admin_login_title")}</h1>

          {expiredNotice ? (
            <div className="mb-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl px-5 py-4 font-bold text-sm">
              {expiredNotice}
            </div>
          ) : null}

          {step === "login" ? (
            <form onSubmit={start} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t("auth_email")}
                </label>
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
              </div>

              {message ? (
                <div
                  className={`p-4 rounded-xl text-sm font-bold ${
                    message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                data-admin-login="1"
                onPointerDown={(ev) => {
                  loginPointerRef.current = { at: Date.now(), trusted: ev.isTrusted };
                }}
                className={`w-full font-bold py-4 rounded-2xl transition duration-200 shadow-lg ${
                  loading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                }`}
              >
                {loading ? t("common_please_wait") : t("admin_login_continue")}
              </button>
            </form>
          ) : step === "2fa" ? (
            <form onSubmit={verify} className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="text-xs font-black uppercase tracking-widest text-blue-700">{t("admin_2fa_title")}</div>
                <div className="mt-1 text-sm font-bold text-blue-900">{t("admin_2fa_sent_hint")}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {t("admin_2fa_code")}
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  type="text"
                  inputMode="numeric"
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium text-gray-900 placeholder-gray-400"
                  placeholder={t("auth_code_placeholder")}
                />
              </div>

              {message ? (
                <div
                  className={`p-4 rounded-xl text-sm font-bold ${
                    message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={`w-full font-bold py-4 rounded-2xl transition duration-200 shadow-lg ${
                  loading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                }`}
              >
                {loading ? t("common_please_wait") : t("admin_2fa_verify")}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setMessage(null);
                  try {
                    const debug = (process.env.NEXT_PUBLIC_DEBUG_AUTH || "").trim() === "1";
                    const meta = {
                      route: window.location.pathname,
                      sourceComponent: "AdminLoginPage:resendCode",
                      timestamp: Date.now(),
                    };
                    if (debug) {
                      console.log(
                        `ADMIN_LOGIN_START_TRIGGERED route=${meta.route} source=${meta.sourceComponent} ts=${meta.timestamp}`,
                        meta
                      );
                    }
                    await api.auth.adminLoginStart({ email, password, language });
                    setMessage({ type: "success", text: t("auth_code_resent") });
                  } catch (error) {
                    const text = error instanceof Error ? error.message : t("auth_error");
                    setMessage({ type: "error", text });
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-3 rounded-2xl transition duration-200 disabled:opacity-50"
              >
                {t("auth_resend_code")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setCode("");
                  setMessage(null);
                }}
                className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-3 rounded-2xl transition duration-200"
              >
                {t("admin_2fa_back")}
              </button>
            </form>
          ) : step === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-4">
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

              {message ? (
                <div
                  className={`p-4 rounded-xl text-sm font-bold ${
                    message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={`w-full font-bold py-4 rounded-2xl transition duration-200 shadow-lg ${
                  loading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                }`}
              >
                {loading ? t("common_please_wait") : t("auth_send_reset_code")}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setStep("login");
                  setMessage(null);
                }}
                className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-3 rounded-2xl transition duration-200 disabled:opacity-50"
              >
                {t("admin_2fa_back")}
              </button>
            </form>
          ) : (
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

              {message ? (
                <div
                  className={`p-4 rounded-xl text-sm font-bold ${
                    message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={`w-full font-bold py-4 rounded-2xl transition duration-200 shadow-lg ${
                  loading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                }`}
              >
                {loading ? t("common_please_wait") : t("auth_reset_button")}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setStep("login");
                  setMessage(null);
                }}
                className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-bold py-3 rounded-2xl transition duration-200 disabled:opacity-50"
              >
                {t("admin_2fa_back")}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" prefetch={false} className="text-sm font-bold text-gray-500 hover:text-blue-600">
              {t("admin_login_user_link")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
