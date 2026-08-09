import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    "",
    "/marketplace",
    "/results",
    "/custom-trip",
    "/offers",
    "/insights",
    "/community",
    "/blog",
    "/login",
    "/register",
    "/support",
    "/agency/register",
    "/agency/pending-review",
    "/agency/rejected",
    "/dashboard",
    "/dashboard/explore",
    "/dashboard/favorites",
    "/dashboard/offers",
    "/dashboard/trip-bookings",
    "/dashboard/messages",
    "/dashboard/notifications",
    "/dashboard/settings",
    "/admin/login",
    "/agency",
    "/admin",
  ];

  return staticRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.startsWith("/marketplace") || route.startsWith("/dashboard") ? 0.8 : 0.6,
  }));
}
