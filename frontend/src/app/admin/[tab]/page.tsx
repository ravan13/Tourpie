"use client";

import DashboardShell from "@/components/DashboardShell";
import { adminNav } from "@/lib/dashboardNav";
import { api, Agency, AgencyApplication, Booking, getStoredToken } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

function ActionIconButton({
  title,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "primary" | "danger" | "success";
  children: ReactNode;
}) {
  const base =
    "h-10 w-10 inline-flex items-center justify-center rounded-2xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
  const styles =
    tone === "primary"
      ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm shadow-blue-200"
      : tone === "danger"
      ? "bg-white hover:bg-red-50 text-red-700 border-red-200"
      : tone === "success"
      ? "bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-white hover:bg-gray-50 text-gray-800 border-gray-200";
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  );
}

function Icon({
  d,
  viewBox = "0 0 24 24",
}: {
  d: string;
  viewBox?: string;
}) {
  return (
    <svg width="18" height="18" viewBox={viewBox} fill="none" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

function NoticeBanner({
  notice,
}: {
  notice: { type: "success" | "error"; text: string } | null;
}) {
  if (!notice) return null;
  return (
    <div
      className={`rounded-2xl px-5 py-4 text-sm font-black border ${
        notice.type === "success"
          ? "bg-emerald-50 border-emerald-100 text-emerald-900"
          : "bg-red-50 border-red-100 text-red-900"
      }`}
      role="status"
    >
      {notice.text}
    </div>
  );
}

export default function AdminTabPage() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const params = useParams();
  const tabRaw = params?.tab;
  const tab = typeof tabRaw === "string" ? tabRaw : Array.isArray(tabRaw) ? tabRaw[0] : "";

  if (tab === "agencies") return <AdminAgencies />;
  if (tab === "verification") return <AdminVerification />;
  if (tab === "bookings") return <AdminBookings />;
  if (tab === "packages") return <AdminPackages />;
  if (tab === "community") return <AdminCommunity />;
  if (tab === "users") return <AdminUsers />;
  if (tab === "analytics") return <AdminReports />;
  if (tab === "reports") return <AdminReports />;
  if (tab === "moderation") return <AdminModeration />;
  if (tab === "settings") return <AdminSettings />;
  if (tab === "notifications") return <AdminNotifications />;
  if (tab === "payments") return <AdminPayments />;
  if (tab === "disputes") return <AdminDisputes />;
  if (tab === "admin-management") return <AdminAdminManagement />;

  return (
    <DashboardShell title={t("admin_nav_overview")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 text-center">
        <div className="text-6xl mb-4">🧭</div>
        <div className="text-xl font-black text-gray-900">{t("common_page_not_found_title")}</div>
        <div className="mt-2 text-gray-500 font-medium">{t("common_page_not_found_subtitle")}</div>
      </div>
    </DashboardShell>
  );
}

function AdminVerification() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<AgencyApplication[]>([]);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const pendingApps = await api.agencies.listApplications("pending_verification");
      setApplications(pendingApps);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const handleApprove = async (id: number) => {
    setActing(true);
    setNotice(null);
    try {
      await api.agencies.approveApplication(id);
      setApplications((prev) => prev.filter((a) => a.id !== id));
      setNotice({ type: "success", text: t("common_notice_approved") });
    } catch {
      setNotice({ type: "error", text: t("admin_agency_action_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt(t("admin_agency_reject_prompt"));
    if (reason === null) return;
    setActing(true);
    setNotice(null);
    try {
      await api.agencies.rejectApplication(id, reason.trim() || null);
      setApplications((prev) => prev.filter((a) => a.id !== id));
      setNotice({ type: "success", text: t("common_notice_rejected") });
    } catch {
      setNotice({ type: "error", text: t("admin_agency_action_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleDownloadDoc = async (applicationId: number, kind: string) => {
    try {
      const token = getStoredToken();
      const res = await fetch(`/api/agencies/applications/${applicationId}/documents/${kind}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}_${applicationId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({ type: "error", text: t("admin_agency_download_failed") });
    }
  };

  return (
    <DashboardShell title={t("admin_nav_verification")} subtitle={t("admin_agency_applications_title")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
          <div className="text-lg font-black text-gray-900">{t("admin_agency_applications_title")}</div>
          <button
            type="button"
            disabled={loading || acting}
            onClick={() => void load()}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
          >
            {t("admin_users_refresh")}
          </button>
        </div>
        <div className="px-10 pt-6">
          <NoticeBanner notice={notice} />
        </div>
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : applications.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">✅</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_agency_applications_none")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_agency_table_agency")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_agency_table_country")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_agency_table_docs")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_agency_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {applications.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{a.agency_name}</div>
                      <div className="text-xs text-gray-400 mt-1">{a.company_email}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{a.country}</td>
                    <td className="px-10 py-6">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(a.id, "business_license")}
                          className="text-sm font-black text-blue-600 hover:underline"
                        >
                          {t("admin_agency_doc_business_license")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(a.id, "tourism_certificate")}
                          className="text-sm font-black text-blue-600 hover:underline"
                        >
                          {t("admin_agency_doc_tourism_certificate")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(a.id, "id_verification")}
                          className="text-sm font-black text-blue-600 hover:underline"
                        >
                          {t("admin_agency_doc_id_verification")}
                        </button>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <ActionIconButton title={t("admin_agency_approve")} tone="primary" disabled={acting} onClick={() => void handleApprove(a.id)}>
                          <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                        </ActionIconButton>
                        <ActionIconButton title={t("admin_agency_reject")} tone="danger" disabled={acting} onClick={() => void handleReject(a.id)}>
                          <Icon d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3 1.42 1.42Z" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AdminAgencies() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Agency[]>([]);
  const [applications, setApplications] = useState<AgencyApplication[]>([]);
  const [packageCounts, setPackageCounts] = useState<Record<number, number>>({});
  const [acting, setActing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "pending" | "has_packages" | "no_packages">("all");
  const [sort, setSort] = useState<"az" | "za">("az");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [ags, apps, pkgs] = await Promise.all([
        api.agencies.getAll(0, 2000).catch(() => []),
        api.agencies.listApplications("pending_verification").catch(() => []),
        (async () => {
          const all: import("@/lib/api").Package[] = [];
          for (let skip = 0; skip < 2000; skip += 100) {
            const batch = await api.packages.getAll(skip, 100).catch(() => []);
            all.push(...batch);
            if (batch.length < 100) break;
          }
          return all;
        })(),
      ]);
      const counts: Record<number, number> = {};
      for (const p of pkgs) counts[p.agency_id] = (counts[p.agency_id] || 0) + 1;
      setPackageCounts(counts);
      setApplications(apps);
      setItems(ags);
    } catch {
      setPackageCounts({});
      setApplications([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, []);

  const pendingAgencyIds = useMemo(() => {
    const s = new Set<number>();
    for (const a of applications) {
      if (typeof a.agency_id === "number") s.add(a.agency_id);
    }
    return s;
  }, [applications]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((a) => {
      if (q) {
        const name = (a.name || "").toLowerCase();
        const email = (a.contact_email || "").toLowerCase();
        const country = (a.country || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !country.includes(q)) return false;
      }
      const status = (a.status || "").toLowerCase();
      const pkgCount = packageCounts[a.id] || 0;
      if (filter === "active") return status === "active";
      if (filter === "inactive") return status === "inactive";
      if (filter === "pending") return pendingAgencyIds.has(a.id);
      if (filter === "has_packages") return pkgCount > 0;
      if (filter === "no_packages") return pkgCount === 0;
      return true;
    });
    out.sort((a, b) => {
      const an = (a.name || "").toLowerCase();
      const bn = (b.name || "").toLowerCase();
      if (an < bn) return sort === "az" ? -1 : 1;
      if (an > bn) return sort === "az" ? 1 : -1;
      return 0;
    });
    return out;
  }, [filter, items, packageCounts, pendingAgencyIds, query, sort]);

  const handleSetStatus = async (agencyId: number, status: "active" | "inactive") => {
    setActing(true);
    try {
      const updated = await api.agencies.update(agencyId, { status });
      setItems((prev) => prev.map((a) => (a.id === agencyId ? updated : a)));
      setNotice({ type: "success", text: t("common_notice_updated_successfully") });
    } catch {
      setNotice({ type: "error", text: t("admin_agency_action_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleApprove = async (applicationId: number) => {
    setActing(true);
    try {
      await api.agencies.approveApplication(applicationId);
      await load();
      setNotice({ type: "success", text: t("common_notice_approved") });
    } catch {
      setNotice({ type: "error", text: t("admin_agency_action_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (applicationId: number) => {
    const reason = prompt(t("admin_agency_reject_prompt"));
    if (reason === null) return;
    setActing(true);
    try {
      await api.agencies.rejectApplication(applicationId, reason.trim() || null);
      await load();
      setNotice({ type: "success", text: t("common_notice_rejected") });
    } catch {
      setNotice({ type: "error", text: t("admin_agency_action_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleDeleteAgency = async (agencyId: number) => {
    if (!confirm(t("admin_confirm_delete_agency"))) return;
    setActing(true);
    try {
      await api.agencies.delete(agencyId);
      await load();
      setNotice({ type: "success", text: t("common_notice_deleted") });
    } catch {
      setNotice({ type: "error", text: t("admin_agency_action_failed") });
    } finally {
      setActing(false);
    }
  };

  return (
    <DashboardShell title={t("admin_nav_agencies")} subtitle={t("admin_agencies_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 bg-gray-50/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="text-lg font-black text-gray-900">{t("admin_nav_agencies")}</div>
            <button
              type="button"
              disabled={loading || acting}
              onClick={() => void load()}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition disabled:opacity-60"
            >
              {t("admin_users_refresh")}
            </button>
          </div>
          {notice ? (
            <div className={`mt-4 rounded-2xl px-5 py-4 text-sm font-black border ${notice.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-red-50 border-red-100 text-red-900"}`}>
              {notice.text}
            </div>
          ) : null}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("admin_search_agency_placeholder")}
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="lg:col-span-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t("admin_agency_filter_all")}</option>
                <option value="active">{t("admin_agency_filter_active")}</option>
                <option value="inactive">{t("admin_agency_filter_inactive")}</option>
                <option value="pending">{t("admin_agency_filter_pending")}</option>
                <option value="has_packages">{t("admin_agency_filter_has_packages")}</option>
                <option value="no_packages">{t("admin_agency_filter_no_packages")}</option>
              </select>
            </div>
            <div className="lg:col-span-3">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="az">{t("common_sort_az")}</option>
                <option value="za">{t("common_sort_za")}</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🏢</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_agency_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("admin_agency_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_agency_table_agency")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_table_status")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_table_packages")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_agency_table_country")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">{t("admin_agency_table_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((a) => {
                  const status = (a.status || "inactive").toLowerCase();
                  const statusLabel =
                    status === "active"
                      ? t("admin_agency_filter_active")
                      : status === "inactive"
                        ? t("admin_agency_filter_inactive")
                        : status;
                  const pkgCount = packageCounts[a.id] || 0;
                  const pending = pendingAgencyIds.has(a.id);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-10 py-6">
                        <div className="font-black text-gray-900">{a.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{a.contact_email || "—"}</div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {statusLabel}
                          </span>
                          {pending ? (
                            <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-50 text-amber-800">
                              {t("common_pending")}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-10 py-6 text-gray-900 font-black">{pkgCount}</td>
                      <td className="px-10 py-6 text-gray-600 font-bold">{a.country || "—"}</td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Link
                            href={`/agencies/${a.id}`}
                            prefetch={false}
                            title={t("admin_action_view_agency")}
                            aria-label={t("admin_action_view_agency")}
                            className="h-10 w-10 inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            <Icon d="M12 5c4.5 0 8.27 2.74 10 7-1.73 4.26-5.5 7-10 7S3.73 16.26 2 12c1.73-4.26 5.5-7 10-7Zm0 2c-3.3 0-6.2 1.86-7.74 5 1.54 3.14 4.44 5 7.74 5s6.2-1.86 7.74-5C18.2 8.86 15.3 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" />
                          </Link>
                          {status !== "active" ? (
                            <ActionIconButton title={t("common_activate")} tone="primary" disabled={acting} onClick={() => void handleSetStatus(a.id, "active")}>
                              <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                            </ActionIconButton>
                          ) : (
                            <ActionIconButton title={t("common_deactivate")} disabled={acting} onClick={() => void handleSetStatus(a.id, "inactive")}>
                              <Icon d="M6 6h12v12H6V6Zm2 2v8h8V8H8Z" />
                            </ActionIconButton>
                          )}
                          <ActionIconButton title={t("admin_action_delete_agency")} tone="danger" disabled={acting} onClick={() => void handleDeleteAgency(a.id)}>
                            <Icon d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9Z" />
                          </ActionIconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
          <div className="text-lg font-black text-gray-900">{t("admin_pending_applications_title")}</div>
          <div className="text-xs font-black text-gray-500">{applications.length}</div>
        </div>
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : applications.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">✅</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_agency_applications_none")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_agency_table_agency")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_agency_table_country")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">{t("admin_agency_table_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {applications.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{a.agency_name}</div>
                      <div className="text-xs text-gray-400 mt-1">{a.company_email}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{a.country}</td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <ActionIconButton title={t("common_approve")} tone="primary" disabled={acting} onClick={() => void handleApprove(a.id)}>
                          <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                        </ActionIconButton>
                        <ActionIconButton title={t("common_reject")} tone="danger" disabled={acting} onClick={() => void handleReject(a.id)}>
                          <Icon d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3 1.42 1.42Z" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AdminBookings() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [items, setItems] = useState<Booking[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const statuses = useMemo(
    () => [
      "pending",
      "accepted",
      "rejected",
      "payment_pending",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "refund_requested",
      "refunded",
      "disputed",
    ],
    []
  );

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const all = await api.bookings.getAll();
        setItems(all);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell title={t("admin_nav_bookings")} subtitle={t("admin_booking_requests")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 pt-6">
          <NoticeBanner notice={notice} />
        </div>
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🧾</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_booking_none")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_booking_table_package")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_booking_table_travel_date")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_booking_table_people")}
                  </th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("admin_booking_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{b.package?.title || t("admin_booking_unknown_package")}</div>
                      <div className="text-xs text-gray-400 mt-1">{t("admin_booking_order", { id: b.id })}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{new Date(b.travel_date).toLocaleDateString()}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{b.number_of_people}</td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-gray-900">{b.status}</span>
                        <select
                          value={b.status}
                          disabled={acting}
                          onChange={(e) => {
                            const next = e.target.value;
                            void (async () => {
                              try {
                                setActing(true);
                                setNotice(null);
                                const note = prompt(t("admin_booking_status_note_prompt")) || "";
                                const updated = await api.bookings.adminSetStatus(b.id, next, note.trim() || null);
                                setItems((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
                                setNotice({ type: "success", text: t("common_notice_updated") });
                              } catch {
                                setNotice({ type: "error", text: t("admin_booking_action_failed") });
                              } finally {
                                setActing(false);
                              }
                            })();
                          }}
                          className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white disabled:opacity-60"
                        >
                          {statuses.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AdminNotifications() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<import("@/lib/api").Notification[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const rows = await api.notifications.list();
        setItems(rows);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell title={t("admin_nav_notifications")} subtitle={t("dash_notifications_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        {loading ? (
          <div className="py-12 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-6xl">🔔</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("dash_notifications_empty_title")}</div>
            <div className="mt-2 text-gray-500 font-medium">{t("dash_notifications_empty_subtitle")}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <div
                key={n.id}
                className={`rounded-2xl border p-5 ${n.is_read ? "bg-white border-gray-100" : "bg-blue-50/50 border-blue-100"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-black text-gray-900">{n.title}</div>
                    {n.body ? <div className="mt-2 text-gray-600 font-bold">{n.body}</div> : null}
                    <div className="mt-3 text-xs font-black text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  {!n.is_read ? (
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          try {
                            await api.notifications.markRead([n.id]);
                            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
                          } catch {
                            return;
                          }
                        })();
                      }}
                      className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
                    >
                      {t("dash_notifications_mark_read")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AdminUsers() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<import("@/lib/api").User[]>([]);
  const [acting, setActing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "banned" | "verified" | "unverified">("all");
  const [regFilter, setRegFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "az" | "za">("newest");
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const all: import("@/lib/api").User[] = [];
      for (let skip = 0; skip < 2000; skip += 200) {
        const batch = await api.users.list(skip, 200).catch(() => []);
        all.push(...batch);
        if (batch.length < 200) break;
      }
      setItems(all);
      setSelected({});
      setPage(0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nowMs = new Date().getTime();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const startOfMonth = new Date(startOfToday);
    startOfMonth.setDate(1);

    const customFrom = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const customTo = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    const inRegRange = (u: import("@/lib/api").User) => {
      if (regFilter === "all") return true;
      const raw = (u as unknown as { created_at?: string }).created_at;
      if (!raw) return false;
      const created = new Date(raw);
      if (!Number.isFinite(created.getTime())) return false;
      if (regFilter === "today") return created >= startOfToday;
      if (regFilter === "week") return created >= startOfWeek;
      if (regFilter === "month") return created >= startOfMonth;
      if (regFilter === "custom") {
        if (customFrom && created < customFrom) return false;
        if (customTo && created > customTo) return false;
        return Boolean(customFrom || customTo);
      }
      return true;
    };

    const isBanned = (u: import("@/lib/api").User) => Boolean((u as unknown as { is_banned?: boolean }).is_banned);
    const bannedUntil = (u: import("@/lib/api").User) => {
      const raw = (u as unknown as { banned_until?: string | null }).banned_until;
      if (!raw) return null;
      const d = new Date(raw);
      return Number.isFinite(d.getTime()) ? d : null;
    };
    const isSuspended = (u: import("@/lib/api").User) => {
      if (!isBanned(u)) return false;
      const until = bannedUntil(u);
      return Boolean(until && until.getTime() > nowMs);
    };
    const isPermanentlyBanned = (u: import("@/lib/api").User) => isBanned(u) && !bannedUntil(u);

    const matchesStatus = (u: import("@/lib/api").User) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return !isBanned(u);
      if (statusFilter === "suspended") return isSuspended(u);
      if (statusFilter === "banned") return isPermanentlyBanned(u);
      if (statusFilter === "verified") return Boolean(u.is_verified);
      if (statusFilter === "unverified") return !u.is_verified;
      return true;
    };

    const matchesQuery = (u: import("@/lib/api").User) => {
      if (!q) return true;
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const username = email.includes("@") ? email.split("@")[0] : email;
      return name.includes(q) || email.includes(q) || username.includes(q);
    };

    const out = items.filter((u) => matchesQuery(u) && matchesStatus(u) && inRegRange(u));
    out.sort((a, b) => {
      if (sort === "az" || sort === "za") {
        const an = (a.full_name || a.email || "").toLowerCase();
        const bn = (b.full_name || b.email || "").toLowerCase();
        if (an < bn) return sort === "az" ? -1 : 1;
        if (an > bn) return sort === "az" ? 1 : -1;
        return 0;
      }
      const at = new Date((a as unknown as { created_at?: string }).created_at || 0).getTime() || 0;
      const bt = new Date((b as unknown as { created_at?: string }).created_at || 0).getTime() || 0;
      return sort === "newest" ? bt - at : at - bt;
    });
    return out;
  }, [dateFrom, dateTo, items, query, regFilter, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageItems = useMemo(() => filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize), [filtered, pageIndex]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)).filter((n) => Number.isFinite(n)),
    [selected]
  );

  const toggleAllPage = (checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const u of pageItems) next[u.id] = checked;
      return next;
    });
  };

  const isBannedUser = (u: import("@/lib/api").User) => Boolean((u as unknown as { is_banned?: boolean }).is_banned);
  const bannedUntilUser = (u: import("@/lib/api").User) => {
    const raw = (u as unknown as { banned_until?: string | null }).banned_until;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  };
  const isSuspendedUser = (u: import("@/lib/api").User) => {
    if (!isBannedUser(u)) return false;
    const until = bannedUntilUser(u);
    return Boolean(until && until.getTime() > new Date().getTime());
  };

  const handleVerify = async (ids: number[]) => {
    if (ids.length === 0) return;
    setActing(true);
    try {
      for (const id of ids) {
        const updated = await api.users.update(id, { is_verified: true });
        setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      }
      setNotice({ type: "success", text: t("common_notice_updated_successfully") });
    } catch {
      setNotice({ type: "error", text: t("admin_users_update_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleBan = async (ids: number[], durationDays?: number | null) => {
    if (ids.length === 0) return;
    setActing(true);
    try {
      for (const id of ids) {
        await api.moderation.banUser(id, { reason: durationDays ? "admin_suspend" : "admin_ban", duration_days: durationDays ?? null });
      }
      await load();
      setNotice({ type: "success", text: t("common_notice_updated_successfully") });
    } catch {
      setNotice({ type: "error", text: t("admin_users_update_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleUnban = async (ids: number[]) => {
    if (ids.length === 0) return;
    setActing(true);
    try {
      for (const id of ids) {
        await api.moderation.unbanUser(id);
      }
      await load();
      setNotice({ type: "success", text: t("common_notice_updated_successfully") });
    } catch {
      setNotice({ type: "error", text: t("admin_users_update_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async (ids: number[]) => {
    if (ids.length === 0) return;
    if (!confirm(t("admin_confirm_delete_users"))) return;
    setActing(true);
    try {
      for (const id of ids) {
        await api.users.delete(id);
      }
      await load();
      setNotice({ type: "success", text: t("common_notice_deleted") });
    } catch {
      setNotice({ type: "error", text: t("admin_users_update_failed") });
    } finally {
      setActing(false);
    }
  };

  return (
    <DashboardShell title={t("admin_nav_users")} subtitle={t("admin_users_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 bg-gray-50/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="text-lg font-black text-gray-900">{t("admin_users_title")}</div>
            <div className="flex flex-wrap gap-2 items-center">
              {selectedIds.length > 0 ? (
                <>
                  <ActionIconButton title={t("admin_users_verify_selected")} tone="primary" disabled={acting} onClick={() => void handleVerify(selectedIds)}>
                    <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                  </ActionIconButton>
                  <ActionIconButton title={t("admin_users_suspend_selected_days", { days: 7 })} disabled={acting} onClick={() => void handleBan(selectedIds, 7)}>
                    <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v10h-2V7Z" />
                  </ActionIconButton>
                  <ActionIconButton title={t("admin_users_ban_selected")} disabled={acting} onClick={() => void handleBan(selectedIds, null)}>
                    <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 10a4.96 4.96 0 0 1-1.24 3.28L8.72 7.24A4.96 4.96 0 0 1 12 6a6 6 0 0 1 5 6Zm-10 0a4.96 4.96 0 0 1 1.24-3.28l7.04 8.04A4.96 4.96 0 0 1 12 18a6 6 0 0 1-5-6Z" />
                  </ActionIconButton>
                  <ActionIconButton title={t("admin_users_unban_selected")} disabled={acting} onClick={() => void handleUnban(selectedIds)}>
                    <Icon d="M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-1 4h2v4.25l2.5 1.5-1 1.66L11 14V9Z" />
                  </ActionIconButton>
                  <ActionIconButton title={t("common_delete_selected")} tone="danger" disabled={acting} onClick={() => void handleDelete(selectedIds)}>
                    <Icon d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9Z" />
                  </ActionIconButton>
                </>
              ) : null}
              <button
                type="button"
                disabled={loading || acting}
                onClick={() => void load()}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition disabled:opacity-60"
              >
                {t("admin_users_refresh")}
              </button>
            </div>
          </div>
          {notice ? (
            <div className={`mt-4 rounded-2xl px-5 py-4 text-sm font-black border ${notice.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-red-50 border-red-100 text-red-900"}`}>
              {notice.text}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                  setSelected({});
                }}
                placeholder={t("admin_search_users_placeholder")}
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="lg:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as typeof statusFilter);
                  setPage(0);
                  setSelected({});
                }}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t("common_all")}</option>
                <option value="active">{t("admin_users_status_active")}</option>
                <option value="suspended">{t("admin_users_status_suspended")}</option>
                <option value="banned">{t("admin_users_status_banned")}</option>
                <option value="verified">{t("admin_users_verified")}</option>
                <option value="unverified">{t("admin_users_unverified")}</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <select
                value={regFilter}
                onChange={(e) => {
                  setRegFilter(e.target.value as typeof regFilter);
                  setPage(0);
                  setSelected({});
                }}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t("admin_users_reg_all_time")}</option>
                <option value="today">{t("admin_users_reg_today")}</option>
                <option value="week">{t("admin_users_reg_week")}</option>
                <option value="month">{t("admin_users_reg_month")}</option>
                <option value="custom">{t("admin_users_reg_custom")}</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as typeof sort);
                  setPage(0);
                  setSelected({});
                }}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">{t("common_sort_newest_first")}</option>
                <option value="oldest">{t("common_sort_oldest_first")}</option>
                <option value="az">{t("common_sort_az")}</option>
                <option value="za">{t("common_sort_za")}</option>
              </select>
            </div>
            <div className="lg:col-span-1 flex items-center justify-end text-xs font-black text-gray-500">
              {filtered.length}
            </div>
          </div>

          {regFilter === "custom" ? (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                  setSelected({});
                }}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                  setSelected({});
                }}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : null}
        </div>
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">👤</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_users_empty")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <input
                      type="checkbox"
                      checked={pageItems.length > 0 && pageItems.every((u) => selected[u.id])}
                      onChange={(e) => toggleAllPage(e.target.checked)}
                    />
                  </th>
                  <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_users_table_user")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_users_table_role")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_users_table_status")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_users_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageItems.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-6">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[u.id])}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [u.id]: e.target.checked }))}
                      />
                    </td>
                    <td className="px-6 py-6 text-gray-600 font-bold">{u.id}</td>
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{u.full_name || "—"}</div>
                      <div className="text-xs text-gray-400 mt-1">{u.email}</div>
                      {(u as unknown as { created_at?: string }).created_at ? (
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date((u as unknown as { created_at: string }).created_at).toLocaleDateString()}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{u.role}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {t("admin_users_agency_id", { id: u.agency_id != null ? u.agency_id : "—" })}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${u.is_verified ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                          {u.is_verified ? t("admin_users_verified") : t("admin_users_unverified")}
                        </span>
                        {isBannedUser(u) ? (
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${isSuspendedUser(u) ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
                            {isSuspendedUser(u) ? t("admin_users_status_suspended") : t("admin_users_status_banned")}
                          </span>
                        ) : (
                          <span className="text-xs font-black px-3 py-1 rounded-full bg-blue-50 text-blue-700">{t("admin_users_status_active")}</span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-gray-400 mt-1">
                        {u.onboarding_completed ? t("admin_users_onboarded") : t("admin_users_not_onboarded")}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {!u.is_verified ? (
                          <ActionIconButton title={t("common_verify")} tone="primary" disabled={acting} onClick={() => void handleVerify([u.id])}>
                            <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                          </ActionIconButton>
                        ) : null}
                        {!isBannedUser(u) ? (
                          <>
                            <ActionIconButton title={t("admin_users_suspend_days", { days: 7 })} disabled={acting} onClick={() => void handleBan([u.id], 7)}>
                              <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v10h-2V7Z" />
                            </ActionIconButton>
                            <ActionIconButton title={t("common_ban")} disabled={acting} onClick={() => void handleBan([u.id], null)}>
                              <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 10a4.96 4.96 0 0 1-1.24 3.28L8.72 7.24A4.96 4.96 0 0 1 12 6a6 6 0 0 1 5 6Zm-10 0a4.96 4.96 0 0 1 1.24-3.28l7.04 8.04A4.96 4.96 0 0 1 12 18a6 6 0 0 1-5-6Z" />
                            </ActionIconButton>
                          </>
                        ) : (
                          <ActionIconButton title={t("common_unban")} disabled={acting} onClick={() => void handleUnban([u.id])}>
                            <Icon d="M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-1 4h2v4.25l2.5 1.5-1 1.66L11 14V9Z" />
                          </ActionIconButton>
                        )}
                        <ActionIconButton title={t("common_delete")} tone="danger" disabled={acting} onClick={() => void handleDelete([u.id])}>
                          <Icon d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9Z" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 ? (
          <div className="px-10 py-6 border-t border-gray-50 flex items-center justify-between">
            <div className="text-xs font-black text-gray-500">
              {t("common_page_of", { page: pageIndex + 1, total: totalPages })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pageIndex <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition disabled:opacity-60"
              >
                {t("common_prev")}
              </button>
              <button
                type="button"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition disabled:opacity-60"
              >
                {t("common_next")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function AdminPayments() {
  const { t, formatMoney } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Booking[]>([]);
  const commissionRate = 0.1;

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        try {
          setLoading(true);
          const rows = await api.bookings.getAll();
          setItems(rows);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const totals = useMemo(() => {
    const rates: Record<string, number> = { USD: 1, EUR: 0.92, RUB: 92, TRY: 32, AZN: 1.7 };
    const toUsd = (amount: number, from?: string | null) => {
      const code = typeof from === "string" ? from.toUpperCase() : "USD";
      const rate = rates[code] || 1;
      if (rate === 0) return 0;
      return amount / rate;
    };
    const grossUsd = items.reduce((sum, b) => sum + toUsd(Number(b.offered_total_price ?? b.total_price ?? 0), b.currency), 0);
    const commissionUsd = grossUsd * commissionRate;
    return { grossUsd, commissionUsd, netUsd: grossUsd - commissionUsd };
  }, [items]);

  return (
    <DashboardShell title={t("admin_nav_payments")} subtitle={t("admin_payments_subtitle")} nav={nav}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_payments_gross")}</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{loading ? "…" : formatMoney(totals.grossUsd, "USD")}</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_payments_commission")}</div>
          <div className="mt-3 text-4xl font-black text-blue-600">
            {loading ? "…" : formatMoney(totals.commissionUsd, "USD")}
          </div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_payments_net")}</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{loading ? "…" : formatMoney(totals.netUsd, "USD")}</div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">💳</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_payments_empty")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_booking_table_package")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_payments_amount")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_payments_commission")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_payments_payment_status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((b) => {
                  const amount = Number(b.offered_total_price ?? b.total_price ?? 0);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-10 py-6 text-gray-600 font-bold">{b.id}</td>
                      <td className="px-10 py-6">
                        <div className="font-black text-gray-900">{b.package?.title || t("admin_booking_unknown_package")}</div>
                        <div className="text-xs text-gray-400 mt-1">{b.status}</div>
                      </td>
                      <td className="px-10 py-6 font-black text-gray-900">{formatMoney(amount, b.currency || "USD")}</td>
                      <td className="px-10 py-6 font-black text-blue-600">{formatMoney(amount * commissionRate, b.currency || "USD")}</td>
                      <td className="px-10 py-6 text-gray-600 font-bold">{b.payment_status || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AdminDisputes() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [items, setItems] = useState<Booking[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const rows = await api.bookings.getAll();
      const filtered = rows.filter((b) => ["refund_requested", "disputed", "refunded"].includes((b.status || "").toLowerCase()));
      setItems(filtered);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, []);

  const handleSet = async (b: Booking, statusValue: string) => {
    try {
      setActing(true);
      setNotice(null);
      const note = prompt(t("admin_booking_status_note_prompt")) || "";
      const updated = await api.bookings.adminSetStatus(b.id, statusValue, note.trim() || null);
      setItems((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
      setNotice({ type: "success", text: t("common_notice_updated") });
    } catch {
      setNotice({ type: "error", text: t("admin_booking_action_failed") });
    } finally {
      setActing(false);
    }
  };

  return (
    <DashboardShell title={t("admin_nav_disputes")} subtitle={t("admin_disputes_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
          <div className="text-lg font-black text-gray-900">{t("admin_disputes_title")}</div>
          <button
            type="button"
            disabled={loading || acting}
            onClick={() => void load()}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
          >
            {t("admin_users_refresh")}
          </button>
        </div>
        <div className="px-10 pt-6">
          <NoticeBanner notice={notice} />
        </div>
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">⚖️</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_disputes_empty")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_booking_table_package")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("bookings_status_pending")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_booking_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6 text-gray-600 font-bold">{b.id}</td>
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{b.package?.title || t("admin_booking_unknown_package")}</div>
                      <div className="text-xs text-gray-400 mt-1">{new Date(b.travel_date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-900 font-black">{b.status}</td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <ActionIconButton title={t("bookings_status_disputed")} disabled={acting} onClick={() => void handleSet(b, "disputed")}>
                          <Icon d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2Zm1 13h-2v-2h2v2Zm0-4h-2V7h2v4Z" />
                        </ActionIconButton>
                        <ActionIconButton title={t("bookings_status_refund_requested")} disabled={acting} onClick={() => void handleSet(b, "refund_requested")}>
                          <Icon d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6 6 6 0 0 1-5.65-4H4.26A8 8 0 0 0 12 21a8 8 0 0 0 0-16Z" />
                        </ActionIconButton>
                        <ActionIconButton title={t("bookings_status_refunded")} tone="success" disabled={acting} onClick={() => void handleSet(b, "refunded")}>
                          <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AdminPackages() {
  const { t, formatCurrency } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [items, setItems] = useState<import("@/lib/api").Package[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "expired" | "archived">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "low" | "high" | "az" | "za">("newest");
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const all: import("@/lib/api").Package[] = [];
      for (let skip = 0; skip < 2000; skip += 100) {
        const batch = await api.packages.getAll(skip, 100).catch(() => []);
        all.push(...batch);
        if (batch.length < 100) break;
      }
      setItems(all);
      setPage(0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((p) => {
      const status = (p.status || "active").toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      const title = (p.title || "").toLowerCase();
      const country = ((p.country as string) || "").toLowerCase();
      const city = ((p.city as string) || "").toLowerCase();
      const dest = ((p.destination as string) || "").toLowerCase();
        const agencyName = ((p.agency?.name as string) || "").toLowerCase();
      return title.includes(q) || country.includes(q) || city.includes(q) || dest.includes(q) || agencyName.includes(q);
    });

    out.sort((a, b) => {
      const an = (a.title || "").toLowerCase();
      const bn = (b.title || "").toLowerCase();
      const ap = Number(a.price || 0);
      const bp = Number(b.price || 0);
      const at = new Date((a as unknown as { created_at?: string }).created_at || 0).getTime() || 0;
      const bt = new Date((b as unknown as { created_at?: string }).created_at || 0).getTime() || 0;
      if (sort === "az" || sort === "za") {
        if (an < bn) return sort === "az" ? -1 : 1;
        if (an > bn) return sort === "az" ? 1 : -1;
        return 0;
      }
      if (sort === "low") return ap - bp;
      if (sort === "high") return bp - ap;
      return sort === "newest" ? bt - at : at - bt;
    });
    return out;
  }, [items, query, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageItems = useMemo(() => filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize), [filtered, pageIndex]);

  const handleSetStatus = async (id: number, status: "draft" | "active" | "expired" | "archived") => {
    setActing(true);
    setNotice(null);
    try {
      const updated = await api.packages.setStatus(id, { status });
      setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setNotice({ type: "success", text: t("common_notice_updated") });
    } catch {
      setNotice({ type: "error", text: t("admin_action_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    setActing(true);
    setNotice(null);
    try {
      await api.packages.duplicate(id, { status: "draft" });
      await load();
      setNotice({ type: "success", text: t("common_notice_duplicated") });
    } catch {
      setNotice({ type: "error", text: t("agency_packages_duplicate_failed") });
    } finally {
      setActing(false);
    }
  };

  return (
    <DashboardShell title={t("admin_nav_packages")} subtitle={t("admin_packages_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 bg-gray-50/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="text-lg font-black text-gray-900">{t("admin_nav_packages")}</div>
            <button
              type="button"
              disabled={loading || acting}
              onClick={() => void load()}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition disabled:opacity-60"
            >
              {t("admin_users_refresh")}
            </button>
          </div>
          <div className="mt-4">
            <NoticeBanner notice={notice} />
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("admin_search_packages_placeholder")}
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="lg:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t("common_all_statuses")}</option>
                <option value="active">{t("package_status_active")}</option>
                <option value="draft">{t("package_status_draft")}</option>
                <option value="expired">{t("package_status_expired")}</option>
                <option value="archived">{t("package_status_archived")}</option>
              </select>
            </div>
            <div className="lg:col-span-3">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">{t("common_sort_newest")}</option>
                <option value="oldest">{t("common_sort_oldest")}</option>
                <option value="low">{t("admin_packages_sort_lowest_price")}</option>
                <option value="high">{t("admin_packages_sort_highest_price")}</option>
                <option value="az">{t("common_sort_az")}</option>
                <option value="za">{t("common_sort_za")}</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🧳</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_packages_empty")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_packages_table_package")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_table_status")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_packages_table_price")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">{t("admin_users_table_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageItems.map((p) => {
                  const base = (p.base_currency as import("@/context/LanguageContext").Currency) || "USD";
                  const status = (p.status || "active").toLowerCase();
                  const statusLabel =
                    status === "draft" || status === "active" || status === "expired" || status === "archived"
                      ? t(`package_status_${status}`)
                      : status;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-10 py-6 text-gray-600 font-bold">{p.id}</td>
                      <td className="px-10 py-6">
                        <div className="font-black text-gray-900">{p.title}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {(p.city || p.country || p.destination) ? [p.city, p.country, p.destination].filter(Boolean).join(" • ") : "—"}
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="text-xs font-black px-3 py-1 rounded-full bg-gray-100 text-gray-700">{statusLabel}</span>
                      </td>
                      <td className="px-10 py-6 text-gray-900 font-black">{formatCurrency(Number(p.price || 0), base)}</td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Link
                            href={`/packages/${p.id}`}
                            prefetch={false}
                            title={t("admin_action_view_package")}
                            aria-label={t("admin_action_view_package")}
                            className="h-10 w-10 inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            <Icon d="M12 5c4.5 0 8.27 2.74 10 7-1.73 4.26-5.5 7-10 7S3.73 16.26 2 12c1.73-4.26 5.5-7 10-7Zm0 2c-3.3 0-6.2 1.86-7.74 5 1.54 3.14 4.44 5 7.74 5s6.2-1.86 7.74-5C18.2 8.86 15.3 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" />
                          </Link>
                          <ActionIconButton title={t("common_duplicate")} disabled={acting} onClick={() => void handleDuplicate(p.id)}>
                            <Icon d="M16 1H6c-1.1 0-2 .9-2 2v12h2V3h10V1Zm3 4H10c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H10V7h9v14Z" />
                          </ActionIconButton>
                          {status !== "archived" ? (
                            <ActionIconButton title={t("common_archive")} disabled={acting} onClick={() => void handleSetStatus(p.id, "archived")}>
                              <Icon d="M20.54 5.23 19.15 3.5A2 2 0 0 0 17.58 2H6.42a2 2 0 0 0-1.57.73L3.46 5.23A2 2 0 0 0 3 6.5V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5a2 2 0 0 0-.46-1.27ZM6.42 4h11.16l1.2 1.5H5.22L6.42 4ZM19 20H5V8h14v12Zm-9-9h4v2h-4v-2Z" />
                            </ActionIconButton>
                          ) : (
                            <ActionIconButton title={t("admin_action_restore_to_draft")} disabled={acting} onClick={() => void handleSetStatus(p.id, "draft")}>
                              <Icon d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6 6 6 0 0 1-5.65-4H4.26A8 8 0 0 0 12 21a8 8 0 0 0 0-16Z" />
                            </ActionIconButton>
                          )}
                          {status !== "active" ? (
                            <ActionIconButton title={t("common_activate")} tone="primary" disabled={acting} onClick={() => void handleSetStatus(p.id, "active")}>
                              <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                            </ActionIconButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 ? (
          <div className="px-10 py-6 border-t border-gray-50 flex items-center justify-between">
            <div className="text-xs font-black text-gray-500">
              {t("common_page_of", { page: pageIndex + 1, total: totalPages })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pageIndex <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition disabled:opacity-60"
              >
                {t("common_prev")}
              </button>
              <button
                type="button"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition disabled:opacity-60"
              >
                {t("common_next")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function AdminCommunity() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [posts, setPosts] = useState<import("@/lib/api").CommunityPost[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [usersById, setUsersById] = useState<Record<number, import("@/lib/api").User>>({});
  const [createKind, setCreateKind] = useState<string>("announcement");
  const [createTitle, setCreateTitle] = useState("");
  const [createBody, setCreateBody] = useState("");

  const load = async (next?: { status?: string; q?: string }) => {
    const effectiveStatus = next?.status ?? status;
    const effectiveQuery = next?.q ?? q;
    try {
      setLoading(true);
      const [rows, users] = await Promise.all([
        api.moderation
          .listCommunityPosts({
            skip: 0,
            limit: 200,
            status: effectiveStatus === "all" ? undefined : effectiveStatus,
            q: effectiveQuery.trim() || undefined,
          })
          .catch(() => []),
        api.users.list(0, 2000).catch(() => []),
      ]);
      const map: Record<number, import("@/lib/api").User> = {};
      for (const u of users) map[u.id] = u;
      setUsersById(map);
      setPosts(rows);
    } catch {
      setUsersById({});
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, []);

  const roleLabel = (userId: number) => {
    const role = usersById[userId]?.role;
    if (!role) return "unknown";
    const r = role.toLowerCase();
    if (r === "admin") return "official";
    if (r === "agency") return "agency";
    return "community";
  };

  const handleDecision = async (postId: number, action: "approve" | "reject" | "needs_revision" | "hide") => {
    setActing(true);
    setNotice(null);
    try {
      const note = action === "approve" ? null : prompt(t("admin_prompt_optional_note")) || null;
      const updated = await api.moderation.decideCommunityPost(postId, { action, note });
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      setNotice({ type: "success", text: t("common_notice_updated") });
    } catch {
      setNotice({ type: "error", text: t("admin_action_failed") });
    } finally {
      setActing(false);
    }
  };

  const handleCreateOfficial = async () => {
    const title = createTitle.trim();
    const body = createBody.trim();
    if (!title || !body) return;
    setActing(true);
    setNotice(null);
    try {
      await api.community.createPost({ title, body, kind: createKind as import("@/lib/api").CommunityPostKind, tag: "official" });
      setCreateTitle("");
      setCreateBody("");
      await load();
      setNotice({ type: "success", text: t("common_notice_published") });
    } catch {
      setNotice({ type: "error", text: t("admin_action_failed") });
    } finally {
      setActing(false);
    }
  };

  return (
    <DashboardShell title={t("admin_nav_community")} subtitle={t("admin_community_subtitle")} nav={nav}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <div className="text-lg font-black text-gray-900">{t("admin_community_create_title")}</div>
          <div className="mt-4">
            <NoticeBanner notice={notice} />
          </div>
          <div className="mt-5 space-y-3">
            <select
              value={createKind}
              onChange={(e) => setCreateKind(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="announcement">{t("admin_post_kind_announcement")}</option>
              <option value="update">{t("admin_post_kind_update")}</option>
              <option value="guidelines">{t("admin_post_kind_guidelines")}</option>
              <option value="campaign">{t("admin_post_kind_campaign")}</option>
              <option value="featured">{t("admin_post_kind_featured")}</option>
              <option value="notice">{t("admin_post_kind_notice")}</option>
            </select>
            <input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={t("admin_post_title_placeholder")}
              className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={createBody}
              onChange={(e) => setCreateBody(e.target.value)}
              placeholder={t("admin_post_body_placeholder")}
              rows={6}
              className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={acting || !createTitle.trim() || !createBody.trim()}
              onClick={() => void handleCreateOfficial()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-3 rounded-2xl transition shadow-sm shadow-blue-200 disabled:opacity-60"
            >
              {t("community_compose_publish")}
            </button>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-10 py-8 border-b border-gray-50 bg-gray-50/30">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="text-lg font-black text-gray-900">{t("admin_community_posts_title")}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading || acting}
                  onClick={() => void load()}
                  className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition disabled:opacity-60"
                >
                  {t("admin_users_refresh")}
                </button>
              </div>
            </div>
            <div className="mt-4">
              <NoticeBanner notice={notice} />
            </div>
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-7">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("admin_search_posts_placeholder")}
                  className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3 font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="lg:col-span-3">
                <select
                  value={status}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStatus(next);
                    void load({ status: next });
                  }}
                  className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">{t("common_all_statuses")}</option>
                  <option value="approved">{t("moderation_status_approved")}</option>
                  <option value="pending_review">{t("moderation_status_pending_review")}</option>
                  <option value="needs_revision">{t("moderation_status_needs_revision")}</option>
                  <option value="rejected">{t("moderation_status_rejected")}</option>
                  <option value="hidden">{t("moderation_status_hidden")}</option>
                </select>
              </div>
              <div className="lg:col-span-2">
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void load()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-3 rounded-2xl transition shadow-sm shadow-blue-200 disabled:opacity-60"
                >
                  {t("search_button")}
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
          ) : posts.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-6xl">🗣️</div>
              <div className="mt-4 text-xl font-black text-gray-900">{t("community_no_posts")}</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_community_table_post")}</th>
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_community_table_type")}</th>
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_users_table_status")}</th>
                    <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">{t("admin_users_table_actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {posts.map((p) => {
                    const type = roleLabel(p.user_id);
                    const typeLabel = t(`admin_community_author_${type}`);
                    const badge =
                      type === "official"
                        ? "bg-blue-50 text-blue-700"
                        : type === "agency"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-gray-100 text-gray-700";
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-10 py-6">
                          <div className="font-black text-gray-900">{p.title}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {usersById[p.user_id]?.full_name || p.user?.full_name || "—"} • #{p.id}
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${badge}`}>{typeLabel}</span>
                        </td>
                        <td className="px-10 py-6">
                          <span className="text-xs font-black px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                            {p.status ? t(`moderation_status_${p.status}`) : "—"}
                          </span>
                        </td>
                        <td className="px-10 py-6 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Link
                              href={`/community/posts/${p.id}`}
                              prefetch={false}
                              title={t("common_view")}
                              aria-label={t("common_view")}
                              className="h-10 w-10 inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                            >
                              <Icon d="M12 5c4.5 0 8.27 2.74 10 7-1.73 4.26-5.5 7-10 7S3.73 16.26 2 12c1.73-4.26 5.5-7 10-7Zm0 2c-3.3 0-6.2 1.86-7.74 5 1.54 3.14 4.44 5 7.74 5s6.2-1.86 7.74-5C18.2 8.86 15.3 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" />
                            </Link>
                            <ActionIconButton title={t("common_approve")} tone="primary" disabled={acting} onClick={() => void handleDecision(p.id, "approve")}>
                              <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                            </ActionIconButton>
                            <ActionIconButton title={t("common_needs_revision")} disabled={acting} onClick={() => void handleDecision(p.id, "needs_revision")}>
                              <Icon d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" />
                            </ActionIconButton>
                            <ActionIconButton title={t("common_reject")} tone="danger" disabled={acting} onClick={() => void handleDecision(p.id, "reject")}>
                              <Icon d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3 1.42 1.42Z" />
                            </ActionIconButton>
                            <ActionIconButton title={t("common_hide")} disabled={acting} onClick={() => void handleDecision(p.id, "hide")}>
                              <Icon d="M12 6c5 0 9.27 3.11 11 7.5-1.05 2.55-2.83 4.66-5.1 6.05l-1.41-1.41A9.76 9.76 0 0 0 20.74 13.5C19.2 10.36 15.8 8 12 8c-.97 0-1.9.15-2.77.42L7.6 6.79C8.96 6.28 10.45 6 12 6ZM2.1 4.93 3.5 3.5l17 17-1.41 1.41-2.02-2.02A12.05 12.05 0 0 1 12 21C7 21 2.73 17.89 1 13.5c.86-2.1 2.22-3.94 3.92-5.33L2.1 4.93Zm4.23 4.23A9.9 9.9 0 0 0 3.26 13.5C4.8 16.64 8.2 19 12 19c1.23 0 2.4-.25 3.45-.7l-1.6-1.6A3.5 3.5 0 0 1 7.3 10.85l-.97-.97ZM12 10.5c.28 0 .55.04.8.12l-2.18 2.18c.08.25.12.52.12.8 0 .28-.04.55-.12.8l2.98-2.98c.08.25.12.52.12.8A1.72 1.72 0 0 1 12 10.5Z" />
                            </ActionIconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function AdminReports() {
  const { t, formatMoney, formatCurrency } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    users: number;
    agencies: number;
    packages: number;
    packagesList: import("@/lib/api").Package[];
    bookings: number;
    gross: number;
    byStatus: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        try {
          setLoading(true);
          const fetchUsers = async () => {
            const all: import("@/lib/api").User[] = [];
            for (let skip = 0; skip < 2000; skip += 200) {
              const batch = await api.users.list(skip, 200).catch(() => []);
              all.push(...batch);
              if (batch.length < 200) break;
            }
            return all;
          };
          const fetchPackages = async () => {
            const all: import("@/lib/api").Package[] = [];
            for (let skip = 0; skip < 2000; skip += 100) {
              const batch = await api.packages.getAll(skip, 100).catch(() => []);
              all.push(...batch);
              if (batch.length < 100) break;
            }
            return all;
          };
          const [users, agencies, packages, bookings] = await Promise.all([
            fetchUsers(),
            api.agencies.getAll().catch(() => []),
            fetchPackages(),
            api.bookings.getAll().catch(() => []),
          ]);
          const rates: Record<string, number> = { USD: 1, EUR: 0.92, RUB: 92, TRY: 32, AZN: 1.7 };
          const toUsd = (amount: number, from?: string | null) => {
            const code = typeof from === "string" ? from.toUpperCase() : "USD";
            const rate = rates[code] || 1;
            if (rate === 0) return 0;
            return amount / rate;
          };
          const gross = bookings.reduce(
            (sum, b) => sum + toUsd(Number(b.offered_total_price ?? b.total_price ?? 0), b.currency),
            0
          );
          const byStatus: Record<string, number> = {};
          bookings.forEach((b) => {
            const s = (b.status || "unknown").toLowerCase();
            byStatus[s] = (byStatus[s] || 0) + 1;
          });
          setData({
            users: users.length,
            agencies: agencies.length,
            packages: packages.length,
            packagesList: packages,
            bookings: bookings.length,
            gross,
            byStatus,
          });
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <DashboardShell title={t("admin_nav_analytics")} subtitle={t("admin_reports_subtitle")} nav={nav}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_reports_users")}</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{loading ? "…" : data?.users ?? 0}</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_reports_agencies")}</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{loading ? "…" : data?.agencies ?? 0}</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_reports_packages")}</div>
          <div className="mt-3 text-4xl font-black text-gray-900">{loading ? "…" : data?.packages ?? 0}</div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-7">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_reports_gmv")}</div>
          <div className="mt-3 text-4xl font-black text-blue-600">
            {loading ? "…" : formatMoney(Number(data?.gross ?? 0), "USD")}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        <div className="text-lg font-black text-gray-900">{t("admin_reports_booking_breakdown")}</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(data?.byStatus || {})
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => (
              <div key={status} className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest">{status}</div>
                <div className="mt-2 text-3xl font-black text-gray-900">{count}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8">
          <div className="text-lg font-black text-gray-900">{t("admin_reports_pricing_title")}</div>
          <div className="mt-2 text-sm font-bold text-gray-500">{t("admin_reports_pricing_subtitle")}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_reports_pricing_th_package")}</th>
                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_reports_pricing_th_mode")}</th>
                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_reports_pricing_th_base")}</th>
                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">USD</th>
                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">EUR</th>
                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">AZN</th>
                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">RUB</th>
                <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">TRY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.packagesList || []).map((p) => {
                const mode = p.pricing_mode === "manual" ? t("admin_reports_pricing_mode_manual") : t("admin_reports_pricing_mode_auto");
                const base = (p.base_currency as import("@/context/LanguageContext").Currency) || "USD";
                const prices = p.prices && typeof p.prices === "object" ? (p.prices as Record<string, number>) : null;
                const cell = (code: import("@/context/LanguageContext").Currency) => {
                  const v = prices ? prices[code] : undefined;
                  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return "—";
                  return formatCurrency(v, code);
                };
                return (
                  <tr key={p.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="font-black text-gray-900">{p.title}</div>
                      <div className="text-xs text-gray-400 mt-1">#{p.id}</div>
                    </td>
                    <td className="px-8 py-5 text-sm font-black text-gray-700">{mode}</td>
                    <td className="px-8 py-5 text-sm font-black text-gray-900">{formatCurrency(p.price, base)}</td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-700">{cell("USD")}</td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-700">{cell("EUR")}</td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-700">{cell("AZN")}</td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-700">{cell("RUB")}</td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-700">{cell("TRY")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

function AdminModeration() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [reviews, setReviews] = useState<import("@/lib/api").Review[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logs, setLogs] = useState<import("@/lib/api").ModerationLog[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postStatus, setPostStatus] = useState<string>("pending_review");
  const [postQuery, setPostQuery] = useState("");
  const [pendingPosts, setPendingPosts] = useState<import("@/lib/api").CommunityPost[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const rows = await api.packages.listReviewsAdmin();
      setReviews(rows);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const rows = await api.moderation.listLogs(0, 200);
      setLogs(rows);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadPendingPosts = async () => {
    try {
      setPostsLoading(true);
      const rows = await api.moderation.listCommunityPosts({ skip: 0, limit: 100, status: postStatus, q: postQuery.trim() || undefined });
      setPendingPosts(rows);
    } catch {
      setPendingPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
      void loadLogs();
      void loadPendingPosts();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadPendingPosts();
    }, 0);
    return () => clearTimeout(id);
  }, [postQuery, postStatus]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin_moderation_confirm_delete_review"))) return;
    try {
      setNotice(null);
      await api.packages.deleteReviewAdmin(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setNotice({ type: "success", text: t("common_notice_deleted") });
    } catch {
      setNotice({ type: "error", text: t("admin_moderation_delete_failed") });
    }
  };

  const handleRestore = async (entity_type: string, entity_id: number) => {
    if (!confirm(t("admin_moderation_confirm_restore"))) return;
    try {
      setNotice(null);
      await api.moderation.restore(entity_type, entity_id);
      await loadLogs();
      setNotice({ type: "success", text: t("common_notice_restored") });
    } catch {
      setNotice({ type: "error", text: t("admin_moderation_restore_failed") });
    }
  };

  const decidePost = async (postId: number, action: "approve" | "reject" | "needs_revision" | "hide") => {
    let note: string | null = null;
    if (action !== "approve") {
      note = prompt(t("admin_moderation_post_note_prompt")) || "";
      note = note.trim() || null;
    }
    try {
      setNotice(null);
      await api.moderation.decideCommunityPost(postId, { action, note });
      await loadPendingPosts();
      await loadLogs();
      setNotice({ type: "success", text: t("common_notice_updated") });
    } catch {
      setNotice({ type: "error", text: t("admin_moderation_post_action_failed") });
    }
  };

  const banUserFromPost = async (userId: number) => {
    const daysRaw = prompt(t("admin_moderation_ban_days_prompt")) || "";
    const duration_days = daysRaw.trim() ? Number(daysRaw) : null;
    const safeDays = duration_days != null && Number.isFinite(duration_days) ? Math.max(0, Math.floor(duration_days)) : null;
    const reason = (prompt(t("admin_moderation_ban_reason_prompt")) || "").trim() || null;
    try {
      setNotice(null);
      await api.moderation.banUser(userId, { duration_days: safeDays, reason });
      await loadLogs();
      setNotice({ type: "success", text: t("admin_moderation_ban_success") });
    } catch {
      setNotice({ type: "error", text: t("admin_moderation_ban_failed") });
    }
  };

  return (
    <DashboardShell title={t("admin_nav_moderation_queue")} subtitle={t("admin_moderation_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50/30">
          <div className="text-lg font-black text-gray-900">{t("admin_moderation_posts_title")}</div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <select
              value={postStatus}
              onChange={(e) => setPostStatus(e.target.value)}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-2 font-black text-gray-900"
            >
              <option value="pending_review">{t("moderation_status_pending_review")}</option>
              <option value="needs_revision">{t("moderation_status_needs_revision")}</option>
              <option value="rejected">{t("moderation_status_rejected")}</option>
              <option value="hidden">{t("moderation_status_hidden")}</option>
              <option value="approved">{t("moderation_status_approved")}</option>
            </select>
            <input
              value={postQuery}
              onChange={(e) => setPostQuery(e.target.value)}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-2 font-black text-gray-900 w-full sm:w-72"
              placeholder={t("admin_moderation_posts_search")}
            />
            <button
              type="button"
              onClick={() => void loadPendingPosts()}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
            >
              {t("admin_users_refresh")}
            </button>
          </div>
        </div>
        <div className="px-10 pt-6">
          <NoticeBanner notice={notice} />
        </div>
        {postsLoading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : pendingPosts.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🧾</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_moderation_posts_empty")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_post")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_user")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_status")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_created")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_users_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingPosts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6 text-gray-600 font-bold">{p.id}</td>
                    <td className="px-10 py-6">
                      <Link href={`/community/posts/${p.id}`} prefetch={false} className="font-black text-gray-900 hover:underline">
                        {p.title}
                      </Link>
                      {p.moderation_note ? <div className="text-sm text-gray-600 font-bold mt-2">{p.moderation_note}</div> : null}
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{p.user?.full_name || `#${p.user_id}`}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{p.status ? t(`moderation_status_${p.status}`) : "—"}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <ActionIconButton title={t("admin_moderation_approve")} tone="success" onClick={() => void decidePost(p.id, "approve")}>
                          <Icon d="M9.55 16.2 4.8 11.45l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z" />
                        </ActionIconButton>
                        <ActionIconButton title={t("admin_moderation_needs_revision")} onClick={() => void decidePost(p.id, "needs_revision")}>
                          <Icon d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" />
                        </ActionIconButton>
                        <ActionIconButton title={t("admin_moderation_reject")} tone="danger" onClick={() => void decidePost(p.id, "reject")}>
                          <Icon d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3 1.42 1.42Z" />
                        </ActionIconButton>
                        <ActionIconButton title={t("admin_moderation_hide")} onClick={() => void decidePost(p.id, "hide")}>
                          <Icon d="M12 6c5 0 9.27 3.11 11 7.5-1.05 2.55-2.83 4.66-5.1 6.05l-1.41-1.41A9.76 9.76 0 0 0 20.74 13.5C19.2 10.36 15.8 8 12 8c-.97 0-1.9.15-2.77.42L7.6 6.79C8.96 6.28 10.45 6 12 6ZM2.1 4.93 3.5 3.5l17 17-1.41 1.41-2.02-2.02A12.05 12.05 0 0 1 12 21C7 21 2.73 17.89 1 13.5c.86-2.1 2.22-3.94 3.92-5.33L2.1 4.93Zm4.23 4.23A9.9 9.9 0 0 0 3.26 13.5C4.8 16.64 8.2 19 12 19c1.23 0 2.4-.25 3.45-.7l-1.6-1.6A3.5 3.5 0 0 1 7.3 10.85l-.97-.97ZM12 10.5c.28 0 .55.04.8.12l-2.18 2.18c.08.25.12.52.12.8 0 .28-.04.55-.12.8l2.98-2.98c.08.25.12.52.12.8A1.72 1.72 0 0 1 12 10.5Z" />
                        </ActionIconButton>
                        <ActionIconButton title={t("admin_moderation_ban")} tone="danger" onClick={() => void banUserFromPost(p.user_id)}>
                          <Icon d="M12 2a10 10 0 0 0-7.07 17.07A10 10 0 0 0 19.07 4.93 9.93 9.93 0 0 0 12 2Zm0 2c1.76 0 3.38.57 4.7 1.53L5.53 16.7A7.93 7.93 0 0 1 4 12a8 8 0 0 1 8-8Zm0 16a7.96 7.96 0 0 1-4.7-1.53L18.47 7.3A7.93 7.93 0 0 1 20 12a8 8 0 0 1-8 8Z" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
          <div className="text-lg font-black text-gray-900">{t("admin_moderation_reviews_title")}</div>
          <button
            type="button"
            onClick={() => void load()}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
          >
            {t("admin_users_refresh")}
          </button>
        </div>
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : reviews.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">🛡️</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_moderation_empty")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_review")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_user")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_package")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_users_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reviews.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6 text-gray-600 font-bold">{r.id}</td>
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{t("admin_moderation_rating", { rating: r.rating })}</div>
                      {r.comment ? <div className="text-sm text-gray-600 font-bold mt-2">{r.comment}</div> : null}
                      <div className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleString()}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{r.user?.full_name || "—"}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{r.package_id}</td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end">
                        <ActionIconButton title={t("admin_moderation_delete")} tone="danger" onClick={() => void handleDelete(r.id)}>
                          <Icon d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9Z" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
          <div className="text-lg font-black text-gray-900">{t("admin_moderation_logs_title")}</div>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
          >
            {t("admin_users_refresh")}
          </button>
        </div>
        {logsLoading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">✅</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_moderation_logs_empty")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_entity")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_reason")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_moderation_created")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_users_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6 text-gray-600 font-bold">{l.id}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">
                      {l.entity_type} #{l.entity_id}
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{l.reason}</td>
                    <td className="px-10 py-6 text-gray-600 font-bold">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end">
                        <ActionIconButton title={t("admin_moderation_restore")} onClick={() => void handleRestore(l.entity_type, l.entity_id)}>
                          <Icon d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6 6 6 0 0 1-5.65-4H4.26A8 8 0 0 0 12 21a8 8 0 0 0 0-16Z" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function AdminSettings() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [saved, setSaved] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return { commissionRate: 10, require2fa: true };
    const raw = localStorage.getItem("admin_settings");
    if (!raw) return { commissionRate: 10, require2fa: true };
    try {
      const parsed = JSON.parse(raw) as { commissionRate?: number; require2fa?: boolean };
      return { commissionRate: parsed.commissionRate ?? 10, require2fa: parsed.require2fa ?? true };
    } catch {
      return { commissionRate: 10, require2fa: true };
    }
  });

  const save = () => {
    try {
      localStorage.setItem("admin_settings", JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      return;
    }
  };

  return (
    <DashboardShell title={t("admin_nav_settings")} subtitle={t("admin_settings_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-[2rem] border border-gray-100 p-6">
            <div className="text-sm font-black text-gray-900">{t("admin_settings_commission")}</div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                value={settings.commissionRate}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const safe = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
                  setSettings((prev) => ({ ...prev, commissionRate: safe }));
                }}
                className="w-40 bg-white border border-gray-200 rounded-2xl px-4 py-3 font-black text-gray-900"
                min={0}
                max={100}
              />
              <div className="text-sm font-bold text-gray-500">%</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-[2rem] border border-gray-100 p-6">
            <div className="text-sm font-black text-gray-900">{t("admin_settings_security")}</div>
            <label className="mt-4 flex items-center gap-3 font-bold text-gray-700">
              <input
                type="checkbox"
                checked={settings.require2fa}
                onChange={(e) => setSettings((prev) => ({ ...prev, require2fa: e.target.checked }))}
                className="h-5 w-5"
              />
              {t("admin_settings_require_2fa")}
            </label>
          </div>
        </div>
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-2xl transition shadow-sm shadow-blue-200"
          >
            {t("admin_settings_save")}
          </button>
          {saved ? <div className="text-sm font-black text-green-700">{t("admin_settings_saved")}</div> : null}
        </div>

        <div className="mt-8 rounded-[2rem] border border-gray-100 bg-gray-50 p-6">
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
      </div>
    </DashboardShell>
  );
}

function AdminAdminManagement() {
  const { t } = useLanguage();
  const nav = useMemo(() => adminNav(t), [t]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<import("@/lib/api").User[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const rows = await api.users.list();
      setAdmins(rows.filter((u) => (u.role || "").toLowerCase() === "admin"));
    } catch {
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, []);

  const handleCreate = async () => {
    const email = prompt(t("admin_admins_prompt_email")) || "";
    if (!email.trim()) return;
    const full_name = prompt(t("admin_admins_prompt_name")) || "";
    if (!full_name.trim()) return;
    const password = prompt(t("admin_admins_prompt_password")) || "";
    if (!password.trim()) return;
    try {
      setNotice(null);
      const created = await api.users.createAdmin({ email: email.trim(), full_name: full_name.trim(), password });
      setAdmins((prev) => [created, ...prev]);
      setNotice({ type: "success", text: t("common_notice_created") });
    } catch {
      setNotice({ type: "error", text: t("admin_admins_create_failed") });
    }
  };

  const handleDemote = async (u: import("@/lib/api").User) => {
    if (!confirm(t("admin_admins_confirm_demote"))) return;
    try {
      setNotice(null);
      const updated = await api.users.update(u.id, { role: "user" });
      setAdmins((prev) => prev.filter((x) => x.id !== updated.id));
      setNotice({ type: "success", text: t("common_notice_updated") });
    } catch {
      setNotice({ type: "error", text: t("admin_users_update_failed") });
    }
  };

  return (
    <DashboardShell title={t("admin_nav_admin_management")} subtitle={t("admin_admins_subtitle")} nav={nav}>
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
          <div className="text-lg font-black text-gray-900">{t("admin_admins_title")}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 font-black px-4 py-2 rounded-2xl transition"
            >
              {t("admin_users_refresh")}
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-2xl transition shadow-sm shadow-blue-200"
            >
              {t("admin_admins_create")}
            </button>
          </div>
        </div>
        <div className="px-10 pt-6">
          <NoticeBanner notice={notice} />
        </div>
        {loading ? (
          <div className="p-10 text-center font-bold text-gray-500">{t("common_loading")}</div>
        ) : admins.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-6xl">👨‍💼</div>
            <div className="mt-4 text-xl font-black text-gray-900">{t("admin_admins_empty")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("common_id")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_users_table_user")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">{t("admin_users_table_status")}</th>
                  <th className="px-10 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">
                    {t("admin_users_table_actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {admins.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-10 py-6 text-gray-600 font-bold">{u.id}</td>
                    <td className="px-10 py-6">
                      <div className="font-black text-gray-900">{u.full_name || "—"}</div>
                      <div className="text-xs text-gray-400 mt-1">{u.email}</div>
                    </td>
                    <td className="px-10 py-6 text-gray-600 font-bold">
                      {u.is_verified ? t("admin_users_verified") : t("admin_users_unverified")}
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end">
                        <ActionIconButton title={t("admin_admins_demote")} tone="danger" onClick={() => void handleDemote(u)}>
                          <Icon d="M6 19c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z" />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
