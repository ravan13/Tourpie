import { ReactNode } from "react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

export function userNav(t: (key: string, vars?: Record<string, string | number>) => string): DashboardNavItem[] {
  return [
    { href: "/dashboard", label: t("dash_home"), icon: "🏠" },
    { href: "/dashboard/explore", label: t("dash_explore"), icon: "🧭" },
    { href: "/dashboard/bookings", label: t("dash_bookings"), icon: "📦" },
    { href: "/dashboard/saved", label: t("dash_saved"), icon: "❤️" },
    { href: "/dashboard/messages", label: t("dash_messages"), icon: "💬" },
    { href: "/dashboard/notifications", label: t("dash_notifications"), icon: "🔔" },
    { href: "/dashboard/payments", label: t("dash_payments"), icon: "💳" },
    { href: "/dashboard/reviews", label: t("dash_reviews"), icon: "⭐" },
    { href: "/dashboard/settings", label: t("dash_settings"), icon: "⚙️" },
  ];
}

export function agencyNav(t: (key: string, vars?: Record<string, string | number>) => string): DashboardNavItem[] {
  return [
    { href: "/agency", label: t("agency_nav_overview"), icon: "📊" },
    { href: "/agency/bookings", label: t("agency_nav_bookings"), icon: "📥" },
    { href: "/agency/packages", label: t("agency_nav_packages"), icon: "🧳" },
    { href: "/agency/calendar", label: t("agency_nav_calendar"), icon: "📅" },
    { href: "/agency/customers", label: t("agency_nav_customers"), icon: "👥" },
    { href: "/agency/messages", label: t("agency_nav_messages"), icon: "💬" },
    { href: "/agency/analytics", label: t("agency_nav_analytics"), icon: "📈" },
    { href: "/agency/reviews", label: t("agency_nav_reviews"), icon: "⭐" },
    { href: "/agency/team", label: t("agency_nav_team"), icon: "🧑‍🤝‍🧑" },
    { href: "/agency/settings", label: t("agency_nav_settings"), icon: "⚙️" },
  ];
}

export function adminNav(t: (key: string, vars?: Record<string, string | number>) => string): DashboardNavItem[] {
  return [
    { href: "/admin", label: t("admin_nav_overview"), icon: "📊" },
    { href: "/admin/users", label: t("admin_nav_users"), icon: "👤" },
    { href: "/admin/agencies", label: t("admin_nav_agencies"), icon: "🏢" },
    { href: "/admin/packages", label: t("admin_nav_packages"), icon: "🧳" },
    { href: "/admin/bookings", label: t("admin_nav_bookings"), icon: "🧾" },
    { href: "/admin/community", label: t("admin_nav_community"), icon: "🗣️" },
    { href: "/admin/moderation", label: t("admin_nav_moderation_queue"), icon: "🛡️" },
    { href: "/admin/analytics", label: t("admin_nav_analytics"), icon: "📈" },
    { href: "/admin/settings", label: t("admin_nav_settings"), icon: "⚙️" },
    { href: "/", label: t("admin_nav_view_public"), icon: "🌐" },
    { href: "/admin/preview?role=user", label: t("admin_nav_view_as_user"), icon: "👁️" },
    { href: "/admin/preview?role=agency", label: t("admin_nav_view_as_agency"), icon: "👁️‍🗨️" },
  ];
}
