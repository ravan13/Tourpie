const API_BASE_URL = "/api"; 
/*const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";*/

const SESSION_TOKEN_STORAGE_KEY = "token";
const SESSION_REMEMBER_KEY = "tourpie:remember_me";
export const SESSION_ACTIVITY_KEY = "tourpie:last_activity";
export const SESSION_LOGOUT_KEY = "tourpie:logout_at";
export const SESSION_EXPIRED_KEY = "tourpie:session_expired";

let currentUserRequest: Promise<User | null> | null = null;
let currentUserCache: User | null | undefined;
let refreshRequest: Promise<string | null> | null = null;

type CurrentUserUpdateDetail = {
  force?: boolean;
};

export function touchSessionActivity(source?: string) {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const w = window as unknown as { __tourpieLastTouch?: number };
    const last = typeof w.__tourpieLastTouch === "number" ? w.__tourpieLastTouch : 0;
    if (now - last < 3000) return;
    w.__tourpieLastTouch = now;
    localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
    if (source) localStorage.setItem(`${SESSION_ACTIVITY_KEY}:source`, source);
    window.dispatchEvent(new Event("tourpie:activity"));
  } catch {
    return;
  }
}

export function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const part of cookies) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) continue;
    if (rawKey === name) return decodeURIComponent(rest.join("=") || "");
  }
  return null;
}

export function setCookieValue(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const safe = encodeURIComponent(value);
  const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${safe}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function clearCookieValue(name: string) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromSession = window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  if (fromSession) return fromSession;
  const fromStorage = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  return fromStorage || null;
}

export function getRememberMePreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY)) return false;
    if (localStorage.getItem(SESSION_REMEMBER_KEY) === "0") return false;
  } catch {}
  return true;
}

function invalidateCurrentUserCache() {
  currentUserRequest = null;
  currentUserCache = undefined;
}

export function syncCurrentUserProfile(user: User | null, options?: { emitEvent?: boolean }) {
  currentUserRequest = null;
  currentUserCache = user;
  if (typeof window !== "undefined" && options?.emitEvent !== false) {
    window.dispatchEvent(new CustomEvent<CurrentUserUpdateDetail>("tourpie:user-updated", { detail: { force: false } }));
  }
}

export function requestCurrentUserRefresh(options?: { emitEvent?: boolean }) {
  invalidateCurrentUserCache();
  if (typeof window !== "undefined" && options?.emitEvent !== false) {
    window.dispatchEvent(new CustomEvent<CurrentUserUpdateDetail>("tourpie:user-updated", { detail: { force: true } }));
  }
}

async function syncSessionCookie(token: string, rememberMe: boolean) {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  const maxAgeSeconds =
    rememberMe && typeof exp === "number"
      ? Math.max(60, Math.floor(exp - Date.now() / 1000))
      : null;

  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, maxAgeSeconds, sessionOnly: !rememberMe }),
  }).catch(() => undefined);
}

export async function setSessionToken(
  token: string,
  options?: { rememberMe?: boolean; emitEvent?: boolean }
) {
  if (typeof window === "undefined") return;
  const rememberMe = options?.rememberMe ?? getRememberMePreference();
  try {
    if (rememberMe) {
      localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
      localStorage.setItem(SESSION_REMEMBER_KEY, "1");
      window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
      localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      localStorage.setItem(SESSION_REMEMBER_KEY, "0");
    }
  } catch {
    localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(SESSION_REMEMBER_KEY, rememberMe ? "1" : "0");
  }
  invalidateCurrentUserCache();
  touchSessionActivity("set-token");
  await syncSessionCookie(token, rememberMe);
  if (options?.emitEvent !== false) {
    window.dispatchEvent(new Event("tourpie:auth"));
  }
}

export async function clearSessionToken(options?: { emitEvent?: boolean }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  } catch {}
  syncCurrentUserProfile(null, { emitEvent: false });
  await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
  if (options?.emitEvent !== false) {
    window.dispatchEvent(new Event("tourpie:auth"));
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const jsonPayload = decodeURIComponent(
      Array.from(atob(padded))
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    const parsed = JSON.parse(jsonPayload) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredTokenPayload(): Record<string, unknown> | null {
  const token = getStoredToken();
  if (!token) return null;
  return decodeJwtPayload(token);
}

export async function ensureFreshSession(minValiditySeconds = 120): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  if (!exp || exp * 1000 - Date.now() > minValiditySeconds * 1000) {
    return token;
  }

  if (!refreshRequest) {
    refreshRequest = fetchApi(`/users/refresh`, {
      method: "POST",
      body: JSON.stringify({}),
    })
      .then(async (result: { access_token?: string | null }) => {
        const nextToken = typeof result?.access_token === "string" ? result.access_token : null;
        if (!nextToken) return null;
        await setSessionToken(nextToken, { rememberMe: getRememberMePreference(), emitEvent: false });
        return nextToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

export async function loadCurrentUser(force = false): Promise<User | null> {
  const token = getStoredToken();
  if (!token) {
    currentUserCache = null;
    currentUserRequest = null;
    return null;
  }

  await ensureFreshSession();
  if (!getStoredToken()) {
    currentUserCache = null;
    currentUserRequest = null;
    return null;
  }

  if (!force && currentUserCache !== undefined) return currentUserCache;
  if (!force && currentUserRequest) return currentUserRequest;

  currentUserRequest = fetchApi(`/users/me`)
    .then((user) => {
      currentUserCache = user as User;
      return currentUserCache;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "";
      if (isAuthErrorMessage(message) || message === "Not authenticated") {
        currentUserCache = null;
        return null;
      }
      throw error;
    })
    .finally(() => {
      currentUserRequest = null;
    });

  return currentUserRequest;
}

export type TourPieLogoutReason = "inactivity" | "manual" | "auth";

export function isAuthErrorMessage(message: string): boolean {
  const m = (message || "").toLowerCase();
  if (!m) return false;
  if (m.includes("invalid token")) return true;
  if (m.includes("could not validate credentials")) return true;
  if (m.includes("not authenticated")) return true;
  if (m.includes("signature verification failed")) return true;
  if (m.includes("token is invalid")) return true;
  if (m.includes("token has expired")) return true;
  if (m.includes("jwt")) return true;
  if (m.includes("401")) return true;
  if (m.includes("403") && m.includes("token")) return true;
  return false;
}

export function markSessionExpired(reason: Exclude<TourPieLogoutReason, "manual"> = "auth") {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_EXPIRED_KEY, JSON.stringify({ at: Date.now(), reason }));
  } catch {}
}

export function broadcastLogout(reason: TourPieLogoutReason) {
  if (typeof window === "undefined") return;
  try {
    const payload = getStoredTokenPayload();
    const role = typeof payload?.role === "string" ? payload.role.toLowerCase() : null;
    localStorage.setItem(SESSION_LOGOUT_KEY, JSON.stringify({ at: Date.now(), reason, role }));
    try {
      window.dispatchEvent(new CustomEvent("tourpie:logout", { detail: { reason, role } }));
    } catch {
      window.dispatchEvent(new Event("tourpie:logout"));
    }
  } catch {}
}

export async function clearAuthAndRedirect(reason: TourPieLogoutReason) {
  if (typeof window === "undefined") return;
  if (reason !== "manual") markSessionExpired(reason);
  broadcastLogout(reason);
  await clearSessionToken();
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  let attachedToken: string | null = null;

  const body = options.body;
  const isFormBody =
    typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams;
  const isMultipartBody = typeof FormData !== "undefined" && body instanceof FormData;

  if (body && !isMultipartBody && !isFormBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (typeof window !== "undefined" && endpoint !== "/users/refresh") {
    await ensureFreshSession().catch(() => null);
  }

  // Add Auth token if available in session storage/cookie
  if (typeof window !== "undefined") {
    const token = getStoredToken();
    if (token) {
      attachedToken = token;
      headers["Authorization"] = `Bearer ${token}`;
      touchSessionActivity("api");
    }
  }

  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type") || "";
      let detail: string | undefined;

      if (contentType.includes("application/json")) {
        const errorData = await res.json().catch(() => ({}));
        detail = typeof errorData?.detail === "string" ? errorData.detail : undefined;
      } else {
        const text = await res.text().catch(() => "");
        detail = text ? text.slice(0, 300) : undefined;
      }

      const hasAuthHeader = typeof headers["Authorization"] === "string" && headers["Authorization"].length > 0;
      const lowerDetail = (detail || "").toLowerCase();
      const invalidTokenHint =
        lowerDetail.includes("invalid token") ||
        lowerDetail.includes("could not validate credentials") ||
        lowerDetail.includes("token has expired") ||
        lowerDetail.includes("signature verification failed") ||
        lowerDetail.includes("signature");

      let tokenExpired = false;
      if (hasAuthHeader && typeof window !== "undefined") {
        const storedToken = getStoredToken();
        const payload = storedToken ? decodeJwtPayload(storedToken) : null;
        const exp = typeof payload?.exp === "number" ? payload.exp : null;
        tokenExpired = typeof exp === "number" && Date.now() >= exp * 1000;
      }

      const isAuthFailure =
        (res.status === 401 && (invalidTokenHint || tokenExpired)) ||
        (res.status === 403 && invalidTokenHint);

      if (hasAuthHeader && isAuthFailure) {
        if (typeof window !== "undefined") {
          console.error("SESSION_EXPIRED_REDIRECT", {
            route: window.location.pathname,
            endpoint,
            status: res.status,
            response: detail,
          });
        }
        await clearAuthAndRedirect("auth");
        throw new Error("Not authenticated");
      }

      if (res.status === 401 && detail?.toLowerCase().includes("not authenticated")) {
        const token = typeof window !== "undefined" ? getStoredToken() : null;
        if (!hasAuthHeader && token) {
          const retryHeaders: Record<string, string> = { ...headers, Authorization: `Bearer ${token}` };
          const retryRes = await fetch(url, { ...options, headers: retryHeaders });
          if (retryRes.ok) return retryRes.json();
        }
      }

      if (res.status === 503 && endpoint.startsWith("/") && detail?.toLowerCase().includes("backend is unavailable")) {
        throw new Error("Backend is unavailable. Start the API server at http://127.0.0.1:8080");
      }

      throw new Error(detail || `API error: ${res.statusText} (${res.status})`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to the server. Please ensure the backend is running at http://127.0.0.1:8080");
    }
    throw error;
  }
}

export interface Package {
  id: number;
  title: string;
  description: string;
  price: number;
  status?: "draft" | "active" | "expired" | "archived";
  pricing_mode?: "auto" | "manual";
  base_currency?: import("@/context/LanguageContext").Currency;
  prices?: Partial<Record<import("@/context/LanguageContext").Currency, number>> | null;
  destination: string;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  package_type?: string | null;
  hotel_rating?: number | null;
  transportation_type?: string | null;
  duration_days: number;
  capacity: number;
  start_date?: string | null;
  end_date?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  image_url: string;
  images?: string[];
  highlights?: string[];
  category?: string;
  agency_id: number;
  agency?: {
    id: number;
    name: string;
    description?: string;
    website?: string;
    contact_email?: string;
  };
}

export interface Booking {
  id: number;
  package_id: number;
  user_id: number;
  number_of_people: number;
  additional_requests?: string | null;
  currency?: import("@/context/LanguageContext").Currency | null;
  more_info_message?: string | null;
  offer_message?: string | null;
  offer_sent_at?: string | null;
  booking_date: string;
  travel_date: string;
  total_price: number;
  offered_total_price?: number | null;
  status: string;
  payment_status?: string | null;
  payment_reference?: string | null;
  accepted_at?: string | null;
  confirmed_at?: string | null;
  rejected_at?: string | null;
  package?: Package;
}

export interface Review {
  id: number;
  package_id: number;
  user_id: number;
  rating: number;
  comment?: string | null;
  created_at: string;
  is_hidden?: boolean;
  user?: {
    id: number;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export type CommunityPostKind =
  | "story"
  | "tips"
  | "qa"
  | "partners"
  | "announcement"
  | "update"
  | "guidelines"
  | "campaign"
  | "featured"
  | "notice";

export interface CommunityPost {
  id: number;
  user_id: number;
  title: string;
  body: string;
  tag?: string | null;
  kind: CommunityPostKind;
  image_url?: string | null;
  images?: string[] | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_hidden?: boolean;
  status?: string | null;
  moderation_note?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
  user?: { id: number; full_name?: string | null; avatar_url?: string | null } | null;
  liked?: boolean | null;
  bookmarked?: boolean | null;
}

export interface CommunityComment {
  id: number;
  post_id: number;
  user_id: number;
  body: string;
  is_hidden?: boolean;
  status?: string | null;
  moderation_note?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
  user?: { id: number; full_name?: string | null; avatar_url?: string | null } | null;
}

export interface BlogArticleSummary {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category?: string | null;
  author_name?: string | null;
  cover_image_url?: string | null;
  reading_minutes: number;
  published_at: string;
}

export interface BlogArticle extends BlogArticleSummary {
  content: string;
}

export interface ModerationLog {
  id: number;
  entity_type: string;
  entity_id: number;
  user_id?: number | null;
  reporter_user_id?: number | null;
  reason: string;
  note?: string | null;
  action: string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by_user_id?: number | null;
}

export type AgencyAvailabilityEntry = {
  id: number;
  agency_id: number;
  date: string;
  is_blocked: boolean;
  capacity_override: number | null;
  created_at: string;
  updated_at: string;
};

export type AgencyCustomerSummary = {
  user_id: number;
  full_name?: string | null;
  email: string;
  bookings_count: number;
  total_spent: number;
};

export type AgencyAnalytics = {
  total_packages: number;
  bookings_total: number;
  bookings_pending: number;
  bookings_payment_pending: number;
  bookings_confirmed: number;
  bookings_in_progress: number;
  bookings_completed: number;
  revenue_total: number;
};

export type AgencyReviewItem = {
  id: number;
  package_id: number;
  package_title: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  user?: { id: number; full_name?: string | null; avatar_url?: string | null } | null;
};

export type AgencyTeamMember = {
  id: number;
  agency_id: number;
  email: string;
  full_name?: string | null;
  role: string;
  created_at: string;
};

export interface Favorite {
  id: number;
  package_id: number;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  agency_id: number;
  package_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_role: string;
  sender_user_id?: number | null;
  content: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  phone_number?: string | null;
  country?: string | null;
  preferred_language?: import("@/context/LanguageContext").Language | null;
  preferred_currency?: import("@/context/LanguageContext").Currency | null;
  time_zone?: string | null;
  avatar_url?: string | null;
  auth_provider?: string | null;
  pending_email?: string | null;
  last_login_at?: string | null;
  created_at?: string;
  is_verified?: boolean;
  is_email_verified?: boolean;
  is_phone_verified?: boolean;
  onboarding_completed?: boolean;
  is_banned?: boolean;
  banned_until?: string | null;
  banned_reason?: string | null;
  preferred_destinations?: string[] | null;
  budget_range?: string | null;
  travel_style?: string | null;
  interests?: string[] | null;
  agency_id?: number | null;
}

export interface UserSession {
  session_id: string;
  auth_provider?: string | null;
  device_label?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
  last_seen_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  is_current: boolean;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface VerifyPhoneRequest {
  email: string;
  code: string;
}

export interface RequestVerificationRequest {
  email: string;
  language?: import("@/context/LanguageContext").Language;
}

export interface UpdateProfileRequest {
  full_name?: string | null;
  phone_number?: string | null;
  country?: string | null;
  preferred_language?: import("@/context/LanguageContext").Language | null;
  preferred_currency?: import("@/context/LanguageContext").Currency | null;
  time_zone?: string | null;
  avatar_url?: string | null;
}

export interface RequestEmailChangeRequest {
  new_email: string;
  language?: import("@/context/LanguageContext").Language;
}

export interface RequestPhoneVerificationRequest {
  email: string;
  language?: import("@/context/LanguageContext").Language;
}

export interface ForgotPasswordRequest {
  email: string;
  language?: import("@/context/LanguageContext").Language;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  new_password: string;
}

export interface ForgotPasswordByPhoneRequest {
  phone_number: string;
  language?: import("@/context/LanguageContext").Language;
}

export interface ResetPasswordByPhoneRequest {
  phone_number: string;
  code: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface SocialLoginRequest {
  provider: "google" | "apple";
  email: string;
  full_name?: string;
  remember_me?: boolean;
}

export interface OnboardingRequest {
  preferred_destinations: string[];
  budget_range?: string | null;
  travel_style?: string | null;
  interests: string[];
}

export interface PackageCreate {
  title: string;
  description: string;
  price: number;
  status?: "draft" | "active" | "expired" | "archived";
  pricing_mode?: "auto" | "manual";
  base_currency?: import("@/context/LanguageContext").Currency;
  prices?: Partial<Record<import("@/context/LanguageContext").Currency, number>> | null;
  destination: string;
  country?: string | null;
  city?: string | null;
  duration_days: number;
  capacity: number;
  category?: string;
  start_date?: string | null;
  end_date?: string | null;
  image_url: string;
  highlights?: string[];
  images?: string[];
  agency_id: number;
}

export interface Agency {
  id: number;
  name: string;
  description?: string;
  website?: string;
  contact_email?: string;
  phone_number?: string;
  country?: string;
  office_address?: string;
  tax_vat_info?: string;
  status?: string;
  created_at?: string;
}

export interface AgencyApplication {
  id: number;
  user_id: number;
  agency_id?: number | null;
  agency_name: string;
  company_email: string;
  phone_number: string;
  country: string;
  office_address: string;
  website?: string | null;
  tax_vat_info: string;
  business_license_path?: string | null;
  tourism_certificate_path?: string | null;
  id_verification_path?: string | null;
  status: string;
  rejection_reason?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
}

export type TripDestinationType = "any" | "country" | "city";
export type TripBudgetFlexibility = "fixed" | "flexible_10" | "flexible_20" | "no_budget_limit";
export type TripRequestStatus =
  | "draft"
  | "submitted"
  | "searching_agencies"
  | "receiving_offers"
  | "comparing_offers"
  | "accepted"
  | "expired"
  | "cancelled";

export interface TripRequest {
  id: number;
  request_code: string;
  user_id: number;
  destination: string;
  destination_type: TripDestinationType;
  start_date?: string | null;
  end_date?: string | null;
  flexible_dates: boolean;
  adults: number;
  children: number;
  ideal_budget: number;
  max_budget?: number | null;
  budget_currency: string;
  budget_flexibility: TripBudgetFlexibility;
  hotel_stars?: number | null;
  meal_type?: string | null;
  flight_included: boolean;
  transfer_included: boolean;
  visa_assistance: boolean;
  travel_insurance: boolean;
  preferred_airline?: string | null;
  accommodation_preferences?: string | null;
  activities_interests?: string | null;
  special_notes?: string | null;
  offer_expiration_hours: number;
  expires_at: string;
  status: TripRequestStatus;
  created_at: string;
  updated_at: string;
}

export type TripOfferStatus = "submitted" | "accepted" | "declined" | "expired" | "cancelled";

export interface TripOffer {
  id: number;
  trip_request_id: number;
  agency_id: number;
  created_by_user_id: number;
  total_price: number;
  currency: string;
  hotel?: string | null;
  room_type?: string | null;
  meal_plan?: string | null;
  flight?: string | null;
  transfer?: string | null;
  visa?: string | null;
  insurance?: string | null;
  activities?: string | null;
  offer_description?: string | null;
  additional_benefits?: string | null;
  price_difference_reason?: string | null;
  price_difference_notes?: string | null;
  expires_at: string;
  status: TripOfferStatus;
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
}

export interface TripBooking {
  id: number;
  trip_request_id: number;
  trip_offer_id: number;
  user_id: number;
  agency_id: number;
  status: string;
  created_at: string;
}

export interface TripOfferMessage {
  id: number;
  trip_request_id: number;
  trip_offer_id?: number | null;
  user_id: number;
  agency_id: number;
  sender_role: string;
  sender_user_id?: number | null;
  content: string;
  created_at: string;
}

export interface TripOfferNotification {
  id: number;
  recipient_user_id: number;
  trip_request_id?: number | null;
  trip_offer_id?: number | null;
  type: string;
  title: string;
  body?: string | null;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export const api = {
  packages: {
    count: (): Promise<{ total: number }> => fetchApi(`/packages/count`),
    getAll: (skip = 0, limit = 100): Promise<Package[]> => 
      fetchApi(`/packages/?skip=${skip}&limit=${limit}`),
    listMyAgency: (params: {
      skip?: number;
      limit?: number;
      country?: string;
      city?: string;
      minPrice?: number;
      maxPrice?: number;
      status?: "draft" | "active" | "expired" | "archived";
      q?: string;
      sortBy?: "date" | "price" | "alpha";
      sortOrder?: "asc" | "desc";
    }): Promise<Package[]> => {
      const sp = new URLSearchParams();
      sp.set("skip", String(params.skip ?? 0));
      sp.set("limit", String(params.limit ?? 100));
      if (params.country) sp.set("country", params.country);
      if (params.city) sp.set("city", params.city);
      if (typeof params.minPrice === "number") sp.set("minPrice", String(params.minPrice));
      if (typeof params.maxPrice === "number") sp.set("maxPrice", String(params.maxPrice));
      if (params.status) sp.set("status", params.status);
      if (params.q) sp.set("q", params.q);
      if (params.sortBy) sp.set("sortBy", params.sortBy);
      if (params.sortOrder) sp.set("sortOrder", params.sortOrder);
      return fetchApi(`/packages/agency/me?${sp.toString()}`);
    },
    setStatus: (id: number, data: { status: "draft" | "active" | "expired" | "archived"; reason?: string | null }): Promise<Package> =>
      fetchApi(`/packages/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: data.status, reason: data.reason ?? null }) }),
    duplicate: (id: number, data?: { start_date?: string | null; end_date?: string | null; status?: "draft" | "active" | "expired" | "archived" }): Promise<Package> =>
      fetchApi(`/packages/${id}/duplicate`, { method: "POST", body: JSON.stringify({ start_date: data?.start_date ?? null, end_date: data?.end_date ?? null, status: data?.status ?? "draft" }) }),
    search: (
      budget?: number,
      people?: number,
      destination?: string,
      category?: string,
      currency?: import("@/context/LanguageContext").Currency
    ): Promise<Package[]> => {
      const params = new URLSearchParams();
      if (typeof budget === "number") params.set("budget", String(budget));
      if (typeof people === "number") params.set("people", String(people));
      if (destination) params.set("destination", destination);
      if (category) params.set("category", category);
      if (currency) params.set("currency", currency);
      const query = params.toString();
      return fetchApi(`/packages/search${query ? `?${query}` : ""}`);
    },
    searchAdvanced: (opts?: {
      min_budget?: number;
      max_budget?: number;
      people?: number;
      adults?: number;
      children?: number;
      teenagers?: number;
      infants?: number;
      destination?: string;
      country?: string;
      city?: string;
      region?: string;
      category?: string;
      package_type?: string;
      hotel_rating_min?: number;
      hotel_rating_max?: number;
      transportation_type?: string;
      currency?: import("@/context/LanguageContext").Currency;
      depart_date?: string;
      return_date?: string;
      flexible_days?: number;
      duration_min?: number;
      duration_max?: number;
      sort_by?: "cheapest" | "best_value" | "popular";
    }): Promise<Package[]> => {
      const params = new URLSearchParams();
      if (typeof opts?.min_budget === "number") params.set("min_budget", String(opts.min_budget));
      if (typeof opts?.max_budget === "number") params.set("max_budget", String(opts.max_budget));
      if (typeof opts?.people === "number") params.set("people", String(opts.people));
      if (typeof opts?.adults === "number") params.set("adults", String(opts.adults));
      if (typeof opts?.children === "number") params.set("children", String(opts.children));
      if (typeof opts?.teenagers === "number") params.set("teenagers", String(opts.teenagers));
      if (typeof opts?.infants === "number") params.set("infants", String(opts.infants));
      if (opts?.destination) params.set("destination", opts.destination);
      if (opts?.country) params.set("country", opts.country);
      if (opts?.city) params.set("city", opts.city);
      if (opts?.region) params.set("region", opts.region);
      if (opts?.category) params.set("category", opts.category);
      if (opts?.package_type) params.set("package_type", opts.package_type);
      if (typeof opts?.hotel_rating_min === "number") params.set("hotel_rating_min", String(opts.hotel_rating_min));
      if (typeof opts?.hotel_rating_max === "number") params.set("hotel_rating_max", String(opts.hotel_rating_max));
      if (opts?.transportation_type) params.set("transportation_type", opts.transportation_type);
      if (opts?.currency) params.set("currency", opts.currency);
      if (opts?.depart_date) params.set("depart_date", opts.depart_date);
      if (opts?.return_date) params.set("return_date", opts.return_date);
      if (typeof opts?.flexible_days === "number") params.set("flexible_days", String(opts.flexible_days));
      if (typeof opts?.duration_min === "number") params.set("duration_min", String(opts.duration_min));
      if (typeof opts?.duration_max === "number") params.set("duration_max", String(opts.duration_max));
      if (opts?.sort_by) params.set("sort_by", opts.sort_by);
      const q = params.toString();
      return fetchApi(`/packages/search${q ? `?${q}` : ""}`);
    },
    getOne: (id: string | number): Promise<Package> => 
      fetchApi(`/packages/${id}`),
    getReviews: (id: string | number): Promise<Review[]> =>
      fetchApi(`/packages/${id}/reviews`),
    createReview: (packageId: number, rating: number, comment?: string | null): Promise<Review> =>
      fetchApi(`/packages/${packageId}/reviews`, { method: "POST", body: JSON.stringify({ package_id: packageId, rating, comment: comment ?? null }) }),
    deleteMyReview: (packageId: number): Promise<{ message: string }> =>
      fetchApi(`/packages/${packageId}/reviews/me`, { method: "DELETE" }),
    listMyReviews: (skip = 0, limit = 200): Promise<Review[]> => fetchApi(`/packages/reviews/me?skip=${skip}&limit=${limit}`),
    listReviewsAdmin: (skip = 0, limit = 200): Promise<Review[]> =>
      fetchApi(`/packages/reviews?skip=${skip}&limit=${limit}`),
    deleteReviewAdmin: (id: number): Promise<{ message: string }> =>
      fetchApi(`/packages/reviews/${id}`, { method: "DELETE" }),
    create: (data: PackageCreate): Promise<Package> =>
      fetchApi(`/packages`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: PackageCreate): Promise<Package> =>
      fetchApi(`/packages/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number): Promise<{ message: string }> =>
      fetchApi(`/packages/${id}`, { method: "DELETE" }),
  },
  recommendations: {
    getTrending: (limit = 5): Promise<Package[]> => 
      fetchApi(`/recommendations/trending?limit=${limit}`),
    getTop_rated: (limit = 5): Promise<Package[]> => 
      fetchApi(`/recommendations/top-rated?limit=${limit}`),
    getPersonalized: (userId: number, limit = 5): Promise<Package[]> => 
      fetchApi(`/recommendations/personalized?user_id=${userId}&limit=${limit}`),
  },
  bookings: {
    count: (): Promise<{ total: number }> => fetchApi(`/bookings/count`),
    create: (data: {
      package_id: number;
      number_of_people: number;
      travel_date: string;
      additional_requests?: string | null;
      currency?: import("@/context/LanguageContext").Currency;
    }): Promise<Booking> =>
      fetchApi(`/bookings`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    initiatePayment: (data: {
      package_id: number;
      number_of_people: number;
      travel_date: string;
      additional_requests?: string | null;
      currency?: import("@/context/LanguageContext").Currency;
    }): Promise<{ booking: Booking; payment_url: string }> =>
      fetchApi(`/bookings/initiate-payment`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getAll: (): Promise<Booking[]> => fetchApi(`/bookings`),
    getMine: (): Promise<Booking[]> => fetchApi(`/bookings/me`),
    getForAgency: (agencyId: number, status?: string): Promise<Booking[]> =>
      fetchApi(`/bookings/agency/${agencyId}${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    accept: (bookingId: number, agencyId: number): Promise<Booking> =>
      fetchApi(`/bookings/${bookingId}/accept?agency_id=${agencyId}`, { method: "POST" }),
    reject: (bookingId: number, agencyId: number): Promise<Booking> =>
      fetchApi(`/bookings/${bookingId}/reject?agency_id=${agencyId}`, { method: "POST" }),
    requestMoreInfo: (bookingId: number, agencyId: number, message: string): Promise<Booking> =>
      fetchApi(`/bookings/${bookingId}/request-more-info?agency_id=${agencyId}`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    changePrice: (bookingId: number, agencyId: number, offered_total_price: number, message?: string | null): Promise<Booking> =>
      fetchApi(`/bookings/${bookingId}/change-price?agency_id=${agencyId}`, {
        method: "POST",
        body: JSON.stringify({ offered_total_price, message: message ?? null }),
      }),
    sendOffer: (bookingId: number, agencyId: number, offered_total_price?: number | null, message?: string | null): Promise<Booking> =>
      fetchApi(`/bookings/${bookingId}/send-offer?agency_id=${agencyId}`, {
        method: "POST",
        body: JSON.stringify({ offered_total_price: offered_total_price ?? null, message: message ?? null }),
      }),
    cancel: (id: number): Promise<Booking> => fetchApi(`/bookings/${id}/cancel`, { method: "POST" }),
    confirmPayment: (id: number): Promise<Booking> => fetchApi(`/bookings/${id}/confirm-payment`, { method: "POST" }),
    requestRefund: (id: number): Promise<Booking> => fetchApi(`/bookings/${id}/request-refund`, { method: "POST" }),
    dispute: (id: number): Promise<Booking> => fetchApi(`/bookings/${id}/dispute`, { method: "POST" }),
    adminSetStatus: (bookingId: number, status: string, note?: string | null): Promise<Booking> =>
      fetchApi(`/bookings/${bookingId}/admin/status`, { method: "POST", body: JSON.stringify({ status, note: note ?? null }) }),
    delete: (id: number): Promise<{ message: string }> => fetchApi(`/bookings/${id}`, { method: "DELETE" }),
  },
  agencies: {
    count: (): Promise<{ total: number }> => fetchApi(`/agencies/count`),
    getAll: (skip = 0, limit = 100): Promise<Agency[]> => fetchApi(`/agencies/?skip=${skip}&limit=${limit}`),
    getOne: (id: number): Promise<Agency> => fetchApi(`/agencies/${id}`),
    update: (id: number, data: Partial<Agency>): Promise<Agency> =>
      fetchApi(`/agencies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number): Promise<{ message: string }> => fetchApi(`/agencies/${id}`, { method: "DELETE" }),
    getStats: (id: number): Promise<{ total_packages: number; active_bookings: number; total_revenue: number }> =>
      fetchApi(`/agencies/${id}/stats`),
    getAvailability: (id: number, start?: string, end?: string): Promise<AgencyAvailabilityEntry[]> => {
      const params = new URLSearchParams();
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      const q = params.toString();
      return fetchApi(`/agencies/${id}/availability${q ? `?${q}` : ""}`);
    },
    upsertAvailability: (
      id: number,
      date: string,
      is_blocked?: boolean | null,
      capacity_override?: number | null
    ): Promise<AgencyAvailabilityEntry> =>
      fetchApi(`/agencies/${id}/availability`, {
        method: "POST",
        body: JSON.stringify({ date, is_blocked: is_blocked ?? null, capacity_override: capacity_override ?? null }),
      }),
    deleteAvailability: (id: number, date: string): Promise<{ message: string }> =>
      fetchApi(`/agencies/${id}/availability/${encodeURIComponent(date)}`, { method: "DELETE" }),
    getCustomers: (id: number): Promise<AgencyCustomerSummary[]> => fetchApi(`/agencies/${id}/customers`),
    getAnalytics: (id: number): Promise<AgencyAnalytics> => fetchApi(`/agencies/${id}/analytics`),
    getReviews: (id: number): Promise<AgencyReviewItem[]> => fetchApi(`/agencies/${id}/reviews`),
    getTeam: (id: number): Promise<AgencyTeamMember[]> => fetchApi(`/agencies/${id}/team`),
    addTeam: (id: number, data: { email: string; full_name?: string | null; role?: string | null }): Promise<AgencyTeamMember> =>
      fetchApi(`/agencies/${id}/team`, { method: "POST", body: JSON.stringify(data) }),
    removeTeam: (id: number, memberId: number): Promise<{ message: string }> =>
      fetchApi(`/agencies/${id}/team/${memberId}`, { method: "DELETE" }),
    apply: (data: FormData): Promise<AgencyApplication> =>
      fetchApi(`/agencies/apply`, {
        method: "POST",
        body: data,
        headers: {},
      }),
    listApplications: (status?: string): Promise<AgencyApplication[]> =>
      fetchApi(`/agencies/applications${status ? `?status_filter=${encodeURIComponent(status)}` : ""}`),
    approveApplication: (id: number): Promise<AgencyApplication> =>
      fetchApi(`/agencies/applications/${id}/approve`, { method: "POST" }),
    rejectApplication: (id: number, reason?: string | null): Promise<AgencyApplication> => {
      const body = new FormData();
      if (reason) body.set("reason", reason);
      return fetchApi(`/agencies/applications/${id}/reject`, {
        method: "POST",
        body,
        headers: {},
      });
    },
  },
  auth: {
    login: (formData: FormData): Promise<AuthResponse> => {
      const params = new URLSearchParams();
      formData.forEach((value, key) => {
        params.append(key, value as string);
      });
      return fetchApi(`/users/login`, {
        method: "POST",
        body: params, // URLSearchParams will set correct Content-Type automatically
        headers: {},
      });
    },
    register: (data: Record<string, string | number | null | undefined>): Promise<User> =>
      fetchApi(`/users/register`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    verifyEmail: (data: VerifyEmailRequest): Promise<User> =>
      fetchApi(`/users/verify-email`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    verifyPhone: (data: VerifyPhoneRequest): Promise<User> =>
      fetchApi(`/users/verify-phone`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    requestVerification: (data: RequestVerificationRequest): Promise<{ message: string }> =>
      fetchApi(`/users/request-verification`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateProfile: (data: UpdateProfileRequest): Promise<User> =>
      fetchApi(`/users/me/profile`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    listSessions: (): Promise<UserSession[]> => fetchApi(`/users/me/sessions`),
    revokeSession: (sessionId: string): Promise<{ message: string; revoked_current: boolean }> =>
      fetchApi(`/users/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
    revokeOtherSessions: (): Promise<{ message: string; revoked: number }> =>
      fetchApi(`/users/me/sessions/revoke-others`, { method: "POST", body: JSON.stringify({}) }),
    requestEmailChange: (data: RequestEmailChangeRequest): Promise<{ message: string }> =>
      fetchApi(`/users/me/request-email-change`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    verifyEmailLink: (token: string): Promise<User> =>
      fetchApi(`/users/verify-email-link?token=${encodeURIComponent(token)}`),
    confirmEmailChange: (token: string): Promise<AuthResponse> =>
      fetchApi(`/users/confirm-email-change?token=${encodeURIComponent(token)}`),
    requestPhoneVerification: (data: RequestPhoneVerificationRequest): Promise<{ message: string }> =>
      fetchApi(`/users/request-phone-verification`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    forgotPassword: (data: ForgotPasswordRequest): Promise<{ message: string }> =>
      fetchApi(`/users/forgot-password`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    forgotPasswordByPhone: (data: ForgotPasswordByPhoneRequest): Promise<{ message: string }> =>
      fetchApi(`/users/forgot-password-phone`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    resetPassword: (data: ResetPasswordRequest): Promise<{ message: string }> =>
      fetchApi(`/users/reset-password`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    resetPasswordByPhone: (data: ResetPasswordByPhoneRequest): Promise<{ message: string }> =>
      fetchApi(`/users/reset-password-phone`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    changePassword: (data: ChangePasswordRequest): Promise<{ message: string }> =>
      fetchApi(`/users/change-password`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: (): Promise<User> => fetchApi(`/users/me`),
    onboarding: (data: OnboardingRequest): Promise<User> =>
      fetchApi(`/users/onboarding`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    socialLogin: (data: SocialLoginRequest): Promise<AuthResponse> =>
      fetchApi(`/users/social-login`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    adminLoginStart: (data: { email: string; password: string; language?: import("@/context/LanguageContext").Language; remember_me?: boolean }): Promise<{ two_factor_required: boolean }> =>
      fetchApi(`/users/admin/login-start`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    adminVerify2fa: (data: { email: string; code: string; remember_me?: boolean }): Promise<AuthResponse> =>
      fetchApi(`/users/admin/verify-2fa`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    adminImpersonate: (data: { role: "user" | "agency" }): Promise<AuthResponse> =>
      fetchApi(`/users/admin/impersonate`, { method: "POST", body: JSON.stringify(data) }),
    refresh: (): Promise<AuthResponse> =>
      fetchApi(`/users/refresh`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
  }
  ,
  community: {
    listPosts: (opts?: { skip?: number; limit?: number; q?: string; tag?: string; kind?: string; tab?: string }): Promise<CommunityPost[]> => {
      const params = new URLSearchParams();
      if (opts?.skip != null) params.set("skip", String(opts.skip));
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      if (opts?.q) params.set("q", opts.q);
      if (opts?.tag) params.set("tag", opts.tag);
      if (opts?.kind) params.set("kind", opts.kind);
      if (opts?.tab) params.set("tab", opts.tab);
      const q = params.toString();
      return fetchApi(`/community/posts${q ? `?${q}` : ""}`);
    },
    getPost: (id: number): Promise<CommunityPost> => fetchApi(`/community/posts/${id}`),
    createPost: (data: { title: string; body: string; tag?: string | null; kind?: CommunityPostKind; image_url?: string | null; images?: string[] | null }): Promise<CommunityPost> =>
      fetchApi(`/community/posts`, { method: "POST", body: JSON.stringify(data) }),
    updatePost: (
      id: number,
      data: Partial<{ title: string; body: string; tag: string | null; kind: CommunityPostKind; image_url: string | null; images: string[] | null }>
    ): Promise<CommunityPost> => fetchApi(`/community/posts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deletePost: (id: number): Promise<{ message: string }> => fetchApi(`/community/posts/${id}`, { method: "DELETE" }),
    toggleLike: (id: number): Promise<CommunityPost> => fetchApi(`/community/posts/${id}/like`, { method: "POST" }),
    toggleBookmark: (id: number): Promise<CommunityPost> => fetchApi(`/community/posts/${id}/bookmark`, { method: "POST" }),
    share: (id: number): Promise<{ message: string }> => fetchApi(`/community/posts/${id}/share`, { method: "POST" }),
    report: (postId: number, reason?: string | null): Promise<{ message: string }> =>
      fetchApi(`/community/posts/${postId}/report`, { method: "POST", body: JSON.stringify({ reason: reason ?? null }) }),
    listComments: (postId: number, opts?: { skip?: number; limit?: number }): Promise<CommunityComment[]> => {
      const params = new URLSearchParams();
      if (opts?.skip != null) params.set("skip", String(opts.skip));
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      const q = params.toString();
      return fetchApi(`/community/posts/${postId}/comments${q ? `?${q}` : ""}`);
    },
    createComment: (postId: number, body: string): Promise<CommunityComment> =>
      fetchApi(`/community/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    updateComment: (commentId: number, body: string): Promise<CommunityComment> =>
      fetchApi(`/community/comments/${commentId}`, { method: "PUT", body: JSON.stringify({ body }) }),
    deleteComment: (commentId: number): Promise<{ message: string }> => fetchApi(`/community/comments/${commentId}`, { method: "DELETE" }),
  },
  blog: {
    list: (opts?: { skip?: number; limit?: number; q?: string; category?: string; lang?: import("@/context/LanguageContext").Language }): Promise<BlogArticleSummary[]> => {
      const params = new URLSearchParams();
      if (opts?.skip != null) params.set("skip", String(opts.skip));
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      if (opts?.q) params.set("q", opts.q);
      if (opts?.category) params.set("category", opts.category);
      if (opts?.lang) params.set("lang", opts.lang);
      const q = params.toString();
      return fetchApi(`/blog/articles${q ? `?${q}` : ""}`);
    },
    getOne: (slug: string, lang?: import("@/context/LanguageContext").Language): Promise<BlogArticle> => {
      const params = new URLSearchParams();
      if (lang) params.set("lang", lang);
      const q = params.toString();
      return fetchApi(`/blog/articles/${encodeURIComponent(slug)}${q ? `?${q}` : ""}`);
    },
    subscribeNewsletter: (email: string, language?: import("@/context/LanguageContext").Language): Promise<{ id: number; email: string; language?: string | null; created_at: string }> =>
      fetchApi(`/blog/newsletter/subscribe`, { method: "POST", body: JSON.stringify({ email, language: language ?? null }) }),
  },
  moderation: {
    listLogs: (skip = 0, limit = 200, entity_type?: string): Promise<ModerationLog[]> => {
      const params = new URLSearchParams();
      params.set("skip", String(skip));
      params.set("limit", String(limit));
      if (entity_type) params.set("entity_type", entity_type);
      return fetchApi(`/moderation/logs?${params.toString()}`);
    },
    restore: (entity_type: string, entity_id: number): Promise<{ message: string }> =>
      fetchApi(`/moderation/restore?entity_type=${encodeURIComponent(entity_type)}&entity_id=${encodeURIComponent(String(entity_id))}`, { method: "POST" }),
    listCommunityPosts: (opts?: { skip?: number; limit?: number; status?: string; q?: string }): Promise<CommunityPost[]> => {
      const params = new URLSearchParams();
      params.set("skip", String(opts?.skip ?? 0));
      params.set("limit", String(opts?.limit ?? 50));
      if (opts?.status) params.set("status_filter", opts.status);
      if (opts?.q) params.set("q", opts.q);
      return fetchApi(`/moderation/community/posts?${params.toString()}`);
    },
    decideCommunityPost: (
      postId: number,
      body: { action: "approve" | "reject" | "needs_revision" | "hide"; note?: string | null }
    ): Promise<CommunityPost> => fetchApi(`/moderation/community/posts/${postId}/decision`, { method: "POST", body: JSON.stringify(body) }),
    banUser: (userId: number, body: { reason?: string | null; duration_days?: number | null }): Promise<{ message: string }> =>
      fetchApi(`/moderation/users/${userId}/ban`, { method: "POST", body: JSON.stringify(body) }),
    unbanUser: (userId: number): Promise<{ message: string }> => fetchApi(`/moderation/users/${userId}/unban`, { method: "POST" }),
  },
  users: {
    list: (skip = 0, limit = 200): Promise<User[]> => fetchApi(`/users?skip=${skip}&limit=${limit}`),
    count: (): Promise<{ total: number }> => fetchApi(`/users/count`),
    adminOverview: (): Promise<{ total_users: number; verified_users: number; new_registrations_7d: number; recent_users: User[] }> =>
      fetchApi(`/users/admin/overview`),
    update: (
      id: number,
      data: Partial<Pick<User, "full_name" | "role" | "is_verified" | "onboarding_completed" | "agency_id">>
    ): Promise<User> => fetchApi(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number): Promise<{ message: string }> => fetchApi(`/users/${id}`, { method: "DELETE" }),
    createAdmin: (data: { email: string; full_name: string; password: string }): Promise<User> =>
      fetchApi(`/users/admin/create`, { method: "POST", body: JSON.stringify(data) }),
  },
  favorites: {
    list: (): Promise<Favorite[]> => fetchApi(`/favorites`),
    listPackages: (): Promise<Package[]> => fetchApi(`/favorites/packages`),
    add: (packageId: number): Promise<Favorite> =>
      fetchApi(`/favorites`, { method: "POST", body: JSON.stringify({ package_id: packageId }) }),
    remove: (packageId: number): Promise<void> => fetchApi(`/favorites/${packageId}`, { method: "DELETE" }),
  },
  notifications: {
    list: (): Promise<Notification[]> => fetchApi(`/notifications`),
    markRead: (ids: number[]): Promise<{ updated: number }> =>
      fetchApi(`/notifications/mark-read`, { method: "POST", body: JSON.stringify({ notification_ids: ids }) }),
    markAllRead: (): Promise<{ updated: number }> => fetchApi(`/notifications/mark-all-read`, { method: "POST" }),
  },
  tripMarketplace: {
    createRequest: (data: {
      destination: string;
      destination_type: TripDestinationType;
      start_date?: string | null;
      end_date?: string | null;
      flexible_dates: boolean;
      adults: number;
      children: number;
      ideal_budget: number;
      max_budget?: number | null;
      budget_currency: string;
      budget_flexibility: TripBudgetFlexibility;
      hotel_stars?: number | null;
      meal_type?: string | null;
      flight_included: boolean;
      transfer_included: boolean;
      visa_assistance: boolean;
      travel_insurance: boolean;
      preferred_airline?: string | null;
      accommodation_preferences?: string | null;
      activities_interests?: string | null;
      special_notes?: string | null;
      offer_expiration_hours: 24 | 48 | 72;
    }): Promise<TripRequest> =>
      fetchApi(`/trip-requests`, { method: "POST", body: JSON.stringify(data) }),
    listMyRequests: (): Promise<TripRequest[]> => fetchApi(`/trip-requests/me`),
    getRequest: (id: number): Promise<TripRequest> => fetchApi(`/trip-requests/${id}`),
    cancelRequest: (id: number): Promise<TripRequest> => fetchApi(`/trip-requests/${id}/cancel`, { method: "POST" }),
    listRequestOffers: (id: number): Promise<TripOffer[]> => fetchApi(`/trip-requests/${id}/offers`),
    listMyOffers: (): Promise<TripOffer[]> => fetchApi(`/trip-offers/me`),
    getOffer: (id: number): Promise<TripOffer> => fetchApi(`/trip-offers/${id}`),
    acceptOffer: (id: number): Promise<TripBooking> => fetchApi(`/trip-offers/${id}/accept`, { method: "POST" }),
    agencyListIncoming: (): Promise<TripRequest[]> => fetchApi(`/agency/trip-requests`),
    agencyDeclineRequest: (tripRequestId: number, reason?: string | null): Promise<{ id: number; trip_request_id: number; agency_id: number; status: string; declined_reason?: string | null; created_at: string }> =>
      fetchApi(`/agency/trip-requests/${tripRequestId}/decline${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`, { method: "POST" }),
    agencyCreateOffer: (
      tripRequestId: number,
      data: {
        total_price: number;
        currency: string;
        hotel?: string | null;
        room_type?: string | null;
        meal_plan?: string | null;
        flight?: string | null;
        transfer?: string | null;
        visa?: string | null;
        insurance?: string | null;
        activities?: string | null;
        offer_description?: string | null;
        additional_benefits?: string | null;
        offer_expiration_hours?: number | null;
        price_difference_reason?: string | null;
        price_difference_notes?: string | null;
      }
    ): Promise<TripOffer> => fetchApi(`/agency/trip-requests/${tripRequestId}/offers`, { method: "POST", body: JSON.stringify(data) }),
    listNotifications: (): Promise<TripOfferNotification[]> => fetchApi(`/trip-notifications`),
    markNotificationRead: (id: number): Promise<TripOfferNotification> => fetchApi(`/trip-notifications/${id}/read`, { method: "POST" }),
    listOfferMessages: (offerId: number): Promise<TripOfferMessage[]> => fetchApi(`/trip-offers/${offerId}/messages`),
    sendOfferMessage: (offerId: number, content: string): Promise<TripOfferMessage> =>
      fetchApi(`/trip-offers/${offerId}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
    adminListRequests: (): Promise<TripRequest[]> => fetchApi(`/admin/trip-requests`),
    adminListOffers: (): Promise<TripOffer[]> => fetchApi(`/admin/trip-offers`),
  },
  messages: {
    listConversations: (): Promise<Conversation[]> => fetchApi(`/messages/conversations`),
    createConversation: (agencyId: number, packageId?: number): Promise<Conversation> =>
      fetchApi(`/messages/conversations`, {
        method: "POST",
        body: JSON.stringify({ agency_id: agencyId, package_id: packageId ?? null }),
      }),
    listMessages: (conversationId: number): Promise<Message[]> =>
      fetchApi(`/messages/conversations/${conversationId}/messages`),
    sendMessage: (conversationId: number, content: string): Promise<Message> =>
      fetchApi(`/messages/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
  },
};
