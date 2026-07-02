import type { Agency, Package } from "@/lib/api";
import type { Language } from "@/context/LanguageContext";

export const MARKETPLACE_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop";

export type MarketplaceSocialLinks = {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  website?: string;
};

export type LocalizedText = Partial<Record<Language, string>>;

export type MarketplaceAgency = Agency & {
  name_i18n?: LocalizedText;
  description_i18n?: LocalizedText;
  logo_url?: string;
  cover_image_url?: string;
  marketplace_rating?: number;
  marketplace_review_count?: number;
  years_on_tourpie?: number;
  is_marketplace_verified?: boolean;
  social_links?: MarketplaceSocialLinks;
};

export type MarketplaceDateRange = {
  start: string;
  end: string;
  label: string;
};

export type MarketplacePackage = Package & {
  title_i18n?: LocalizedText;
  description_i18n?: LocalizedText;
  destination_i18n?: LocalizedText;
  country_i18n?: LocalizedText;
  city_i18n?: LocalizedText;
  marketplace_rating?: number;
  marketplace_review_count?: number;
  discount_price?: number | null;
  included_services?: string[];
  available_date_ranges?: MarketplaceDateRange[];
};

export type RankingMaps = {
  trendingRanks: Map<number, number>;
  topRatedRanks: Map<number, number>;
};

export type CompanySummary = {
  agency: MarketplaceAgency;
  packageCount: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  coverImage: string;
  logoUrl?: string;
  yearsOnTourPie?: number;
  socialLinks?: MarketplaceSocialLinks;
};

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getLocalizedText(i18n: LocalizedText | undefined, language: Language, fallback: string) {
  const candidate = i18n?.[language];
  return typeof candidate === "string" && candidate.trim() ? candidate : fallback;
}

export function getAgencyDisplayName(agency: MarketplaceAgency, language: Language) {
  return getLocalizedText(agency.name_i18n, language, agency.name);
}

export function getAgencyDisplayDescription(agency: MarketplaceAgency, language: Language) {
  return getLocalizedText(agency.description_i18n, language, agency.description || "");
}

export function getPackageDisplayTitle(pkg: MarketplacePackage, language: Language) {
  return getLocalizedText(pkg.title_i18n, language, pkg.title);
}

export function getPackageDisplayDescription(pkg: MarketplacePackage, language: Language) {
  return getLocalizedText(pkg.description_i18n, language, pkg.description);
}

export function getPackageDisplayDestination(pkg: MarketplacePackage, language: Language) {
  return getLocalizedText(pkg.destination_i18n, language, pkg.destination);
}

export function getPackageDisplayCountry(pkg: MarketplacePackage, language: Language) {
  return getLocalizedText(pkg.country_i18n, language, pkg.country || "");
}

export function getPackageDisplayCity(pkg: MarketplacePackage, language: Language) {
  return getLocalizedText(pkg.city_i18n, language, pkg.city || "");
}

export function buildRankingMap(packages: Package[]) {
  return new Map<number, number>(packages.map((pkg, index) => [pkg.id, index]));
}

export function buildAgencyMap(agencies: MarketplaceAgency[], packages: MarketplacePackage[]) {
  const map = new Map<number, MarketplaceAgency>();

  for (const agency of agencies) {
    map.set(agency.id, agency);
  }

  for (const pkg of packages) {
    const existing = map.get(pkg.agency_id);
    const packageAgency = pkg.agency;

    if (!existing) {
      map.set(pkg.agency_id, {
        id: pkg.agency_id,
        name: packageAgency?.name || `Company ${pkg.agency_id}`,
        description: packageAgency?.description,
        website: packageAgency?.website,
        contact_email: packageAgency?.contact_email,
      });
      continue;
    }

    if (packageAgency) {
      map.set(pkg.agency_id, {
        ...existing,
        name: existing.name || packageAgency.name,
        description: existing.description || packageAgency.description,
        website: existing.website || packageAgency.website,
        contact_email: existing.contact_email || packageAgency.contact_email,
      });
    }
  }

  return map;
}

export function getAgencyInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "TP";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

export function getAgencyVerified(agency?: Agency | null) {
  if (agency && "is_marketplace_verified" in agency && typeof agency.is_marketplace_verified === "boolean") {
    return agency.is_marketplace_verified;
  }
  const status = normalizeText(agency?.status);
  return status === "approved" || status === "active" || status === "verified";
}

export function getAgencyLogoUrl(agency?: MarketplaceAgency | null) {
  return agency?.logo_url || "";
}

export function getAgencyCoverImage(agency?: MarketplaceAgency | null, fallback?: string) {
  return agency?.cover_image_url || fallback || MARKETPLACE_FALLBACK_IMAGE;
}

export function getAgencyYearsOnTourPie(agency?: MarketplaceAgency | null) {
  return agency?.years_on_tourpie || 0;
}

export function getAgencySocialLinks(agency?: MarketplaceAgency | null) {
  return agency?.social_links || {};
}

export function getAgencyRating(agency: MarketplaceAgency | undefined, companyPackages: MarketplacePackage[], rankings: RankingMaps) {
  if (agency?.marketplace_rating) return agency.marketplace_rating;
  const totalRating = companyPackages.reduce((sum, pkg) => sum + getPackageRating(pkg, rankings.topRatedRanks), 0);
  return Number((totalRating / Math.max(1, companyPackages.length)).toFixed(1));
}

export function getAgencyReviewCount(agency: MarketplaceAgency | undefined, companyPackages: MarketplacePackage[], rankings: RankingMaps) {
  if (agency?.marketplace_review_count) return agency.marketplace_review_count;
  return companyPackages.reduce((sum, pkg) => sum + getPackageReviewCount(pkg, rankings), 0);
}

export function getPackagePrimaryImage(pkg: MarketplacePackage) {
  return pkg.images?.[0] || pkg.image_url || MARKETPLACE_FALLBACK_IMAGE;
}

export function getPackageRating(pkg: MarketplacePackage, topRatedRanks: Map<number, number>) {
  if (typeof pkg.marketplace_rating === "number" && Number.isFinite(pkg.marketplace_rating)) {
    return clamp(Number(pkg.marketplace_rating.toFixed(1)), 1, 5);
  }
  const ranked = topRatedRanks.get(pkg.id);
  if (typeof ranked === "number") {
    return clamp(Number((4.95 - ranked * 0.06).toFixed(1)), 4.1, 5);
  }
  if (typeof pkg.hotel_rating === "number" && Number.isFinite(pkg.hotel_rating)) {
    return clamp(Number(pkg.hotel_rating.toFixed(1)), 1, 5);
  }
  return Number((4.3 + (pkg.id % 6) * 0.1).toFixed(1));
}

export function getPackageReviewCount(pkg: MarketplacePackage, rankings: RankingMaps) {
  if (typeof pkg.marketplace_review_count === "number" && Number.isFinite(pkg.marketplace_review_count)) {
    return Math.round(pkg.marketplace_review_count);
  }
  const trendingBoost = rankings.trendingRanks.has(pkg.id) ? 120 - rankings.trendingRanks.get(pkg.id)! * 5 : 0;
  const topRatedBoost = rankings.topRatedRanks.has(pkg.id) ? 90 - rankings.topRatedRanks.get(pkg.id)! * 4 : 0;
  const base = 18 + (pkg.capacity || 0) * 3 + (pkg.id % 17);
  return Math.max(12, Math.round(base + trendingBoost + topRatedBoost));
}

export function getDiscountedPackagePrice(pkg: MarketplacePackage) {
  if (typeof pkg.discount_price === "number" && Number.isFinite(pkg.discount_price) && pkg.discount_price > 0) {
    return pkg.discount_price;
  }
  return null;
}

export function getPackageIncludedServices(pkg: MarketplacePackage) {
  return pkg.included_services || [];
}

export function getPackageAvailableDateRanges(pkg: MarketplacePackage) {
  return pkg.available_date_ranges || [];
}

export function getPackagePopularityScore(pkg: MarketplacePackage, rankings: RankingMaps) {
  const trendingRank = rankings.trendingRanks.get(pkg.id);
  const rating = getPackageRating(pkg, rankings.topRatedRanks);
  const reviews = getPackageReviewCount(pkg, rankings);
  const trendingScore = typeof trendingRank === "number" ? 150 - trendingRank * 8 : 0;
  return rating * 30 + reviews + trendingScore + (pkg.capacity || 0);
}

export function matchesDateAvailability(pkg: MarketplacePackage, selectedDate: string) {
  if (!selectedDate) return true;

  const selected = selectedDate.slice(0, 10);
  const explicitRanges = getPackageAvailableDateRanges(pkg);
  if (explicitRanges.length > 0) {
    return explicitRanges.some((range) => selected >= range.start.slice(0, 10) && selected <= range.end.slice(0, 10));
  }
  const start = pkg.start_date?.slice(0, 10) || "";
  const end = pkg.end_date?.slice(0, 10) || "";

  if (start && end) return selected >= start && selected <= end;
  if (start) return selected >= start;
  if (end) return selected <= end;
  return false;
}

export function matchesDestination(pkg: MarketplacePackage, query: string) {
  if (!query.trim()) return true;
  const haystack = [pkg.destination, pkg.country, pkg.city, pkg.region].map(normalizeText).join(" ");
  return haystack.includes(normalizeText(query));
}

export function buildCompanySummaries(
  agencyMap: Map<number, MarketplaceAgency>,
  packages: MarketplacePackage[],
  rankings: RankingMaps,
  language: Language
) {
  const grouped = new Map<number, MarketplacePackage[]>();

  for (const pkg of packages) {
    const list = grouped.get(pkg.agency_id) || [];
    list.push(pkg);
    grouped.set(pkg.agency_id, list);
  }

  const companies: CompanySummary[] = [];

  for (const [agencyId, companyPackages] of grouped.entries()) {
    const agency = agencyMap.get(agencyId) || {
      id: agencyId,
      name: `Company ${agencyId}`,
    };
    const rating = getAgencyRating(agency, companyPackages, rankings);
    const reviewCount = getAgencyReviewCount(agency, companyPackages, rankings);

    companies.push({
      agency,
      packageCount: companyPackages.length,
      rating,
      reviewCount,
      verified: getAgencyVerified(agency),
      coverImage: getAgencyCoverImage(agency, getPackagePrimaryImage(companyPackages[0])),
      logoUrl: getAgencyLogoUrl(agency) || undefined,
      yearsOnTourPie: getAgencyYearsOnTourPie(agency) || undefined,
      socialLinks: getAgencySocialLinks(agency),
    });
  }

  return companies.sort(
    (a, b) =>
      b.packageCount - a.packageCount ||
      b.rating - a.rating ||
      getAgencyDisplayName(a.agency, language).localeCompare(getAgencyDisplayName(b.agency, language))
  );
}
