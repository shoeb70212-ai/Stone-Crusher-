# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

*No unreleased changes at this time.*

---

## [1.3.0] — 2026-05-07

### Documentation
- Rewrote `CLAUDE.md` from scratch to reflect the current architecture: correct dev port (8083), ten entity collections, Supabase JWT auth, E2EE sync engine, complete pages and native capabilities, and known blockers.
- Updated `handoff.md` with current state as of May 7, 2026.

---

## [1.2.0] — 2026-05

### Added
- Direct admin user creation via Supabase Admin SDK, bypassing invitation-based flow.
- `Manager` and `Partner` roles with granular `UserPermissions` interface and enforced `hasPermission()` checks across Dashboard, Daybook, Settings, and Sidebar.
- "Trusted device" master key persistence — master key stored to `localStorage` after initial vault unlock, eliminating repeated password entry on the same device.
- `ServerSettingsScreen.tsx` — device-level Supabase URL/key override (stored in `localStorage`; reloads app on save).
- `Quotations` module fully wired: `addQuotation` and `updateQuotation` methods in sync engine, create/edit modal, convert-to-invoice flow.
- Lazy-loading pagination for dispatch slips — cold boot loads only last 60 days; historical data fetched on demand.
- `?since=<ISO>` incremental delta support on `GET /api/data` for efficient mobile sync.
- Idempotency key support on `PATCH /api/data` (24-hour cache, prevents duplicate writes on retry).
- Tombstone system in `server.ts` — deleted record IDs tracked with 7-day TTL; prevents resurrection from stale mobile sync.
- JWKS-based JWT verification in `server.ts` (supports Supabase ECC P-256 and RSA keys; 1-hour cache).
- `Employees` and `EmployeeTransactions` entity support added to sync engine and all API tables.
- `AuditLog` page — Admin-only immutable activity viewer.

### Changed
- Streamlined authentication to Supabase Auth (JWT) — removed legacy SHA-256 local hash approach.
- Standardized PDF document exports: all document actions (Invoices, Slips, Quotations, Ledger Statements) generate PDFs exclusively.
- Sync engine data-loading waterfall: IndexedDB → E2EE Cloud (`encrypted_records`) → Legacy API.
- `isVaultUnlocked` wired into `ErpProvider` so cloud pull re-triggers after vault unlock.
- Printer paper size standardized — consistent across mobile and desktop.
- Password/lock/eye-toggle icon layout standardized across all auth screens.

### Fixed
- `mustChangePassword` flag now correctly synchronised between Supabase Auth metadata and local settings, ending the password-setup loop for Managers.
- Session cleanup on logout now clears state, vault keys, and cached credentials end-to-end.
- User role and email now persist correctly between Supabase Auth and local settings.
- Blank dashboard on first production load — E2EE sync engine no longer blocks the legacy API fallback when `encrypted_records` table is empty.
- Vercel deployment failure caused by stale `pnpm-lock.yaml` conflicting with `package-lock.json`.

---

## [1.1.0] — 2026-04-29

### Added
- Sentry integration for frontend and serverless with sourcemap upload (CT-002).
- Vitest unit test harness with jsdom, mocks, and 18+ tests (CT-003).
- Feature-flag scaffolding via `companySettings.flags` and `useFeatureFlag` hook (CT-004).
- GitHub Actions CI — lint, typecheck, Vitest unit, Playwright e2e (CT-001).
- Sync queue V2: timestamp reconciliation with `clientOpId` to prevent race conditions on retry (CT-101).
- Upstash Redis sliding-window rate limiter on API endpoints (CT-103).
- Recoverable `syncStatus: 'failed'` state with user-visible retry banner and `OfflineIndicator` (CT-105).
- PII redaction from server logs and Sentry events via `api/_redact.ts` (CT-107).
- URL-based routing with `wouter`; browser back button and deep links now supported (CT-204).
- Optimistic locking on `companySettings` — server returns 409 on version conflict (CT-205).
- CSRF token protection on destructive `POST /api/data` (CT-206).
- Accessibility pass on Toast and `OfflineIndicator` (CT-301).
- Pull-to-refresh scaffolding via `src/lib/use-pull-to-refresh.ts` (CT-303).
- `useActive` hook for centralised soft-delete filtering (CT-202).
- Tombstone query caching in PATCH handler — ~80% fewer DB round-trips (CT-203).
- `parseFeetInches` enforced across all dimension inputs (CT-201).
- `AuditLog` entity and append-only audit recording; restore events are self-audited (CT-104).

### Fixed
- Default role no longer falls back to `Admin` on cold boot (CT-102).
- Auth re-fetch storm on Supabase token refresh stopped (CT-106).

---

## [1.0.0] — 2026-04-28

### Added
- Initial production-ready release of CrushTrack ERP.
- Delta-sync engine: `ErpContext` queues mutations into `syncQueueRef` and sends debounced `PATCH /api/data`.
- Local-first storage: `local-data.json` for dev; Supabase PostgreSQL for production.
- Dispatch module with slip workflow (`Pending → Loaded → Tallied → Cancelled`), volume and weight measurement modes.
- GST and Cash invoice generation from multi-slip batches; three print templates (Classic, Modern, Minimal).
- Customer ledger with opening balance, unbilled slips, invoices, payments, and expense debits.
- Daybook for income/expense tracking with category filtering.
- Vehicle master with soft-delete, dimension templates, and delivery mode.
- Employee payroll: weekly/monthly salary, advance, deduction, bonus, per-employee ledger.
- Settings tabs: General, Invoicing, Materials, Appearance, Categories, Users.
- Role-based access control: Admin, Partner, Manager.
- Capacitor 8 Android shell with NFC, barcode, biometric, BLE thermal print, camera, and haptics.
- Print formats: A4, Thermal-58mm, Thermal-76mm, Thermal-80mm, Thermal-100mm, Thermal-110mm.
- WhatsApp share and native file export for PDFs and CSVs.
- E2EE vault (`src/lib/sync-engine.ts` + `src/lib/crypto-utils.ts`) with AES-GCM encryption.

---

*Note: Update the [Unreleased] section immediately when a fix or feature is applied. Move it to a versioned entry on release.*
