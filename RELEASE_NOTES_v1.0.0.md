# TourPie v1.0.0

## Release Summary

TourPie v1.0.0 is the initial production release of the TourPie travel marketplace platform. It delivers a full two-sided marketplace where travelers can browse curated package tours from vetted global agencies, request custom trips, receive competitive agency offers, and manage the entire booking lifecycle — including agreements, documents, payments, messaging, reviews and post-trip community sharing. The release also includes production-grade administrative dashboards, agency operations console, moderation, audit logs, transactional email delivery, and the foundational SEO + monitoring primitives required for a stable public launch.

## Sprints Delivered

- Sprint 0 — Project setup, monorepo scaffold
- Sprint 1 — Authentication
- Sprint 2 — Marketplace & Packages
- Sprint 3 — Custom Trip, Offers, Booking
- Sprint 4 — Community, Blog, Travel Insights
- Sprint 5 — Notifications, Documents, Messages
- Sprint 6 — Agency Dashboard
- Sprint 7 — Admin Ecosystem
- Sprint 8 — Production Hardening
- Sprint 9 — Launch QA + Release

## New Features

- **Authentication**: Full email/password flow (register, OTP email & phone verification, login, refresh token, password reset, change password, session management, admin 2FA, admin impersonation, Google & Apple social login, device sessions, per-session revocation, ban/suspension enforcement).
- **Marketplace**: Public package marketplace, featured packages, categories, destinations, country/region pages, company pages, deep package details gallery (images, highlights, inclusions, pricing, offers, reviews), search, filters, favorites.
- **Packages**: Draft → Active → Expired → Archived lifecycle, multi-currency pricing (USD/EUR/AZN/RUB/TRY), package moderation, bulk status actions, approval queue, featured, reported, hidden, expired, expiration auto-transition.
- **Custom Trips**: Rich trip request form (country, city, duration, dates, people, budget, transport, hotels, visa, travel style, attachments), automated agency matching, incoming request inbox for agencies.
- **Offers**: Agencies submit structured offers (price, dates, hotels, flights, transfers, meals, visa support, travel program, attachments), offer revisions, bookmarks, customer accept/reject, response time SLO reporting.
- **Bookings**: Full package + custom-trip booking flows (agreement snapshot, terms snapshot, offer snapshot, document uploads gallery with approval/view, timeline events, status workflow, payments ledger with agency + customer confirmation, dispute, refund, checklist, trip start, completion, post-trip reviews).
- **Agency Console**: Applications (pending/rejected/approved), profile, documents, customer CRM, requests/offers/bookings tabs, settings, analytics, admin notes, status transitions.
- **Admin Ecosystem**: Dashboard KPIs, user management (search, filter, bulk verify/suspend/ban/unban/delete), agency management (approve/reject/suspend, docs), package moderation (bulk actions), booking monitoring, community moderation queue, audit logs, analytics (sparkbars, CSV export), notification center, admin management (create/demote), admin 2FA login flow.
- **Community**: User posts, comments, likes, image uploads, moderation queue, report handling, official posts, reviews platform.
- **Travel Insights / Blog**: Insights listing, country-based insights pages, blog listing + per-article page (Slug router), metadata + OG/Twitter cards.
- **Notifications**: In-app per-user notifications, mark read/unread, category filters, mark-all-read, per-notification navigation to linked entity, admin-scope notification filtering.
- **Transactional Emails**: Resend-backed + SMTP fallback + debug-console branches. Welcome, email verification (OTP + magic-link style token), password reset (email + phone OTP), offer received, booking creation, booking confirmed, document uploaded, admin 2fa, review reminders.
- **Documents / Uploads**: Upload validation, per-bucket URLs, document approval/view status, timeline integration.
- **Search / Filters**: Package search + filters (destination, dates, price, duration, category, stars), user search, agency search, admin audit/booking/package filters.
- **Dashboards**: User dashboard (saved, messages, offers, bookings, payments, reviews, settings, notifications, requests); Agency 15-tab shell with full operational view; Admin 15-tab shell with full operator view.

## Improvements

- Unified multi-tab route pattern (`/agency/[tab]`, `/admin/[tab]`) for consistent reusable navigation shell.
- Reusable `DashboardShell(title, subtitle, nav)` with `adminNav(t)` / `agencyNav(t)` i18n-aware navigations.
- Shared UI primitives `Card` / `Button` / `Input` / `ActionIconButton` / `Icon` reusable across dashboards.
- Responsive desktop-table + mobile-card twin layouts (bookings, packages, audit logs, users) for horizontal-overflow-free small screens.
- Role-based dashboard routing with per-route protected layout guards + deps server-side hardened auth.
- `api.ts` current-user bootstrap sharing in-flight promise (`currentUserRequest`) + warm cache (`currentUserCache`) to eliminate duplicate `/users/me`.
- `api.notifications.markAllRead()` backend + transparent visible-ids fallback if endpoint missing.
- 80+ backend `require_admin` / `role_value != "admin"` guards covering all admin endpoints.
- Backend `/health` + `/ready` monitoring primitives for load balancers / PaaS.
- Sitemap (`/sitemap.xml`, 40 routes) + robots.txt, canonical alternates per-language, GoogleBot directives.

## Performance

- Next.js 15 App Router with per-route code splitting + static generation where possible.
- Batch Promise.allSettled for dashboard/analytics KPI loads (13+ parallel settled calls, no single-failure cascade).
- In-flight `/users/me` request dedup via `currentUserRequest` promise sharing.
- Debounce-friendly patterns on dashboard loads (`useEffect` + `setTimeout(load,0)` defer-first-load).
- Pagination for large tables (users, agencies, bookings) with 25–500 row server-paging windows.
- Lightweight sparkline charts (pure HTML flex bars) — no heavy chart dependencies.
- Lightweight CSV export utility (RFC 4180 escape + UTF-8 BOM + Blob URL) — no heavy xlsx deps.
- Production build total first-load shared JS: **102 kB** gzipped-equivalent per Next.js report average.

## Security

- JWT access/refresh with `sub`/`sid`/`role` claims; UserSession store per-device with session_id validation + `revoked_at` enforcement (Sprint 8 hardened agencies router no longer bypasses this).
- Password storage: bcrypt via `passlib.context.CryptContext`; strong-password validator.
- Email verification tokens and password-reset tokens stored as hashed values only; raw token never persisted.
- `deps.get_current_user()` now used consistently across **all** routers — session validation, expiration, ban status all enforced.
- 31 admin-only server-side role checks; front-end routing role gates are UI only, never the single guard.
- Cross-agency access blocked (`require_agency_or_admin(agency_id)` in endpoints).
- Upload MIME + size guards in avatar validator (`SUPPORTED_AVATAR_MIME_TYPES` + `MAX_AVATAR_UPLOAD_BYTES`).
- CORS origin parse: explicit allow-list; credentials forced off if `*` in list.
- Secrets audit: no raw passwords/tokens/hashes logged in backend/frontend; NEXT_PUBLIC prefix does NOT expose API URL (API proxy uses server-side `BACKEND_BASE_URL`, not browser-visible `NEXT_PUBLIC_API_URL`).

## UI/UX

- Premium consistent gradient UI across Home, Marketplace, Custom Trip, Dashboards.
- TourPie brand token: `"Discover your slice of the world"`; metadata/template metadata title `%s | TourPie`.
- Noto Sans + Poppins + Geist Mono font stack with language-aware variable CSS fallbacks.
- 4-language i18n (en/ru/az/tr) via LanguageContext with 400+ keys.
- Loading/empty/error/retry NoticeBanners on all modules.
- StatusBadge tone-coded gradient pills (green/blue/amber/red/gray) for statuses.
- Icon (Material Path) + ActionIconButton primitives min-h-[44px] (WCAG touch target).
- Full focus states; semantic table layouts; form labels; accessible dialog buttons; role/aria on sparkbar charts.
- Responsive: desktop/laptop/tablet/mobile; no horizontal overflow on Admin Users/Booking/Audit/Packages; stacked card fallback for tables.

## Booking

- Dedicated booking lifecycle: Draft → Waiting Payment → Paid → Confirmed → Started → Completed (plus Cancel / Dispute / Refund paths).
- Booking timeline events (`trip_booking_timeline_events`) customer/agency/actor-role annotated.
- Booking documents + payments + checklist + messages/reviews tables directly related by `booking_id`.
- Booking agreement/terms/offer snapshots frozen at accept-time; immutable post-confirm for audit.
- Admin booking monitoring can `adminSetStatus` for operation override; drop-down with confirm prompt.

## Agency

- Agency application flow: register → submit docs → pending-review → approve/reject (with reasons).
- Agency rejection flow: `/agency/rejected` with friendly messaging.
- Per-agency subscription, custom trip toggles, countries/cities served.
- Agency incoming requests smart match; offers creation form with auto-fill template.
- Agency documents gallery + customer CRM (bookings/payments/reviews).
- Admin notes on agency; approval history viewable in detail.

## Admin

- 14-KPI Dashboard (Total Users, Active Users, Total Agencies, Pending Approvals, Active Packages, Custom Trip Requests, Active Offers, Active Bookings, Completed Trips, Revenue USD, Pending Reviews, Community Reports, Blog Stats, Notifications) plus 6-card quick-link row below.
- User management: search/filter/sort/pagination/bulk verify/suspend-7d/ban/unban/delete; onboarding/agency_id/role/ban-time visibility.
- Agency management: approve/reject/suspend; documents view; profile; packages/bookings/offers/revenue/reviews/activity/notes.
- Package moderation: bulk status with confirmation; search/filter/sort/featured/reported/expired/hidden; checkbox per-row + page-all.
- Booking monitoring: merged package bookings + custom trip bookings; status dropdown operator control; CSV export; mobile cards.
- Community moderation: moderation queue, review queue, audit logs (restore); admin-created official posts.
- Analytics: 8 KPI cards + 3 rate progress cards + 3 monthly sparkbar (bookings/revenue/requests); status breakdown; CSV export.
- Notifications: category auto-detect filters; read/unread/all; search; mark-all-read; navigate-on-click for link-bearing notifications.
- Audit logs: search/entity filter; action tone dots; CSV export; desktop + mobile tables; restore moderation.
- Admin Management: create admins, demote admins, preview-as-role.

## Travel Insights

- `/experiences` per-country insight pages.
- Insights shell with featured destinations.

## Community

- `/community` listing with image/title/author chips; detail (`/community/posts/[id]`).
- Comments; likes; image attachments; reported-content queue.

## Notifications

- Cross-scope notifications (booking/offer/agency/report/system/community).
- Unread indicator badges; per-row read/unread state; notification link navigation.
- 12-category limit cap on filter dropdown for UX stability.

## Known Limitations

- No production environment configuration committed — deployment must configure `BACKEND_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `CORS_ORIGINS`, production `DATABASE_*`, and production email provider keys explicitly. Current `.env` is localhost-only — **NO-GO without these being set**.
- Social login OAuth secrets (Google/Apple) are unconfigured; `social_login` handler exists but redirect URIs/client IDs need setup at providers.
- No automated database migrations framework; schema patching uses `_ensure_columns()` `ALTER ... IF NOT EXISTS` live DDL only. DB deployments must run against a backup snapshot first and diff for missing `CREATE INDEX IF NOT EXISTS` candidates listed in Sprint 8 DB report.
- Document upload uses local/storage-directory URL patterns; actual blob store provider (S3/GCS) credentials/endpoint needed for production.
- SMS provider is debug-console fallback; no production Twilio/MessageBird configured for phone OTPs.
- Package reviews count/rating snapshot not auto-updated on every new review in all endpoints (derived on display).
- Agency bookings analytics lacks multi-currency revenue rollup precision beyond USD-normalized rates (Sprint 7: 7 static currency rates).
- Admin Agencies mobile table still desktop-only horizontal scroll; Users table now has card layout (S8 applied). Low-priority unless launch explicitly needs it.
- `joinClasses` 3-way duplication in Button/Card/Input for className composition — cosmetic.
- No APM (Sentry/OpenTelemetry/LogRocket) wired yet; code has health/readiness stubs and structured logging only.
- No canary/blue-green deployment pipeline documented for CI/CD.

## Future Roadmap

- Post-launch v1.1: Real APM integration (Sentry + OTel), rate-limiting Redis layer, push notifications (FCM/APNS).
- v1.2: Multi-tenant SaaS agency subscription billing, invoice PDF generation, VAT support.
- v1.3: Flight + hotel API supplier integrations, dynamic live pricing feeds.
- v1.4: Mobile PWA shell + offline favorites/forms + install manifest.
- v1.5: Machine-learning package/recommendations ranking + personalized insight feed.
- v2: Cross-platform mini program (WeChat/WhatsApp/Telegram) + embedded widgets for agency websites.
