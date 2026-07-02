"use client";

import DashboardShell from "@/components/DashboardShell";
import { api, clearSessionToken, getStoredToken, User } from "@/lib/api";
import { userNav } from "@/lib/dashboardNav";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo, useState } from "react";

export default function SettingsPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => userNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<User | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  useEffect(() => {
    void (async () => {
      const token = getStoredToken();
      if (!token) {
        setMe(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const user = await api.auth.me();
        setMe(user);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell title={t("dash_settings_title")} subtitle={t("dash_settings_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : !me ? (
          <div className="py-12 text-center">
            <div className="text-6xl">⚙️</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_settings_login_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_settings_login_subtitle")}</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("dash_settings_profile")}</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("auth_full_name")}</div>
                  <div className="mt-2 font-black text-gray-900">{me.full_name}</div>
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("auth_email")}</div>
                  <div className="mt-2 font-black text-gray-900">{me.email}</div>
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("dash_settings_role")}</div>
                  <div className="mt-2 font-black text-gray-900">{me.role}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_security_title")}</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_current_password")}</div>
                  <input
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    type="password"
                    className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_new_password")}</div>
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("settings_confirm_password")}</div>
                  <input
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    type="password"
                    className="mt-2 w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-bold text-gray-900"
                    placeholder="••••••••"
                  />
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
                    className={`w-full font-black py-4 px-6 rounded-2xl transition ${
                      pwSaving ? "bg-gray-100 text-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                    }`}
                  >
                    {pwSaving ? t("common_please_wait") : t("settings_change_password")}
                  </button>
                </div>
              </div>
              {pwMessage ? (
                <div
                  className={`mt-4 rounded-2xl p-4 text-sm font-black ${
                    pwMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {pwMessage.text}
                </div>
              ) : null}
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
