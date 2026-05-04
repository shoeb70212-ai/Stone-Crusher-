# CrushTrack ERP 🪨

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?logo=supabase)](https://supabase.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor)](https://capacitorjs.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**CrushTrack ERP** is a production-ready Enterprise Resource Planning system purpose-built for **stone crusher, quarry, and material logistics businesses**. It digitizes the entire dispatch-to-billing cycle — from vehicle entry and weighbridge slip creation to GST invoicing, customer ledger tracking, employee payroll, and financial reporting — with full offline support, native mobile apps via Capacitor 8, and secure cloud sync via Supabase.

> **Live Demo:** [https://stone-crusher.vercel.app](https://stone-crusher.vercel.app) *(replace with your actual URL)*
>
> **Built for:** Crusher owners, quarry managers, logistics operators, and material suppliers in India.

---

## Features

### 🚛 Dispatch & Weighbridge
- **Multi-mode measurement:** Weight (Tonnes) and Volume (Brass/CFT)
- **Smart dimension input** — workers enter `5.6` to mean **5 ft 6 in** (handled by `parseFeetInches`)
- **Slip status workflow:** `Pending → Loaded → Tallied → Cancelled`
- **Vehicle auto-fill** — owner, driver, and saved dimensions pre-populated
- **Photo attachment** via device camera for challan/document capture
- **NFC vehicle tag scan** & **QR/barcode scan** for rapid vehicle identification
- **Offline-first** — slips are saved locally and sync when connectivity returns

### 🧾 Billing & GST Invoicing
- **GST** and **Cash** invoice modes with auto CGST + SGST breakdown
- **Three invoice templates:** Classic, Modern, Minimal
- **Three print formats:** A4, Thermal-80mm, Thermal-58mm
- **Amount-to-words** in Indian currency format
- **WhatsApp share** — send PDF invoices directly from the print modal
- **Invoice watermarks** — Company Name, Status, or Custom text
- **Multi-slip invoicing** — generate one invoice from multiple dispatch slips

### 📊 Financial Tracking
- **Customer Ledger** — running balance with opening balance, unbilled slips, invoices, payments, and expense debits
- **Daybook** — daily income/expense log with category filtering
- **Dashboard** — KPI cards (Today / Week / Month / Year / Custom) with midnight auto-refresh
- **CSV and PDF export** for all reports and ledgers

### 👷 Employee Payroll
- **Weekly and monthly** salary types
- **Transaction types:** Salary Earned, Salary Paid, Advance Given/Returned, Deduction, Bonus, Reimbursement, Adjustments
- **Per-employee ledger** with opening balance carry-forward
- **Automatic Daybook entries** for cash movements (salary paid, advance given)

### 🔒 Security & Audit
- **Immutable audit logs** — timestamped, append-only activity records
- **Role-based access control** — Admin, Partner, Manager
- **Supabase Auth (JWT)** with session persistence and biometric unlock
- **First-run admin setup wizard** — no hard-coded credentials
- **PII redaction** in server logs and Sentry observability
- **Optimistic locking** on company settings to prevent concurrent overwrites
- **CSRF protection** on destructive endpoints

### 📱 Mobile-Native (Capacitor 8)
- **Touch-friendly UI** — large tap targets, bottom navigation, comfortable/compact layout modes
- **Native Android build** via Capacitor with splash screen and app shortcuts
- **Biometric unlock** (fingerprint/face) with secure token storage
- **Bluetooth ESC/POS thermal printing** for on-site slip/invoice printing
- **NFC tag read** and **barcode/QR scan** for vehicle identification
- **Haptic feedback** and **keep-awake** during active slip entry
- **Native file export** and **system share sheet** for PDFs/CSVs
- **Pull-to-refresh** scaffolding and offline reconnect flush

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4 |
| Routing | `wouter` — lightweight URL-based routing (3 KB) |
| State | `ErpContext` — React Context with optimistic delta-sync |
| Backend (dev) | Express 5 with Vite middleware |
| Backend (prod) | Vercel Serverless Functions (`api/`) |
| Database (dev) | Flat-file `local-data.json` |
| Database (prod) | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT) + biometric unlock |
| Mobile | Capacitor 8 (Android / iOS) |
| PDF | `html2pdf.js` + `@media print` CSS |
| Validation | Zod schemas at API and form boundaries |
| Observability | Sentry (frontend + serverless) |
| Rate Limiting | Upstash Redis (sliding window) |
| Testing | Vitest (unit), Playwright (e2e) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- A [Supabase](https://supabase.com) project (for auth; required in production)

### 1. Clone & Install

```bash
git clone https://github.com/shoeb70212-ai/Stone-Crusher-.git
cd Stone-Crusher-
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# Supabase (required for authentication)
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Optional — protects /api/data endpoints
VITE_API_KEY=<secret-key>

# Dev server port (default: 8083)
PORT=8083
```

### 3. Run

```bash
npm run dev        # Express + Vite middleware → http://localhost:8083
```

On first launch you will see the **Admin Setup** screen to create the initial account — there are no hard-coded credentials.

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 8083) |
| `npm run build` | Production build → `dist/` |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run test:e2e:ui` | Playwright tests with UI |

---

## Architecture

### Request Flow

```
Browser → React (ErpContext)
        → optimistic UI update
        → queueUpdate / queueDelete  (debounced 1.5 s)
        → PATCH /api/data
        → local-data.json  (dev)  |  Supabase Postgres  (prod)
```

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/data` | Return full dataset |
| `POST` | `/api/data` | Bulk-replace dataset (import / restore) |
| `PATCH` | `/api/data` | Merge `{ updates, deletions }` delta |
| `*` | `/api/admin-users` | Supabase admin user management (invite, deactivate) |

### State Management

All state lives in [src/context/ErpContext.tsx](src/context/ErpContext.tsx). The context holds ten entity collections:

`customers` · `employees` · `employeeTransactions` · `slips` · `transactions` · `vehicles` · `invoices` · `tasks` · `auditLogs` · `companySettings`

Every mutation:
1. Updates React state immutably (spread operator — never mutated in place)
2. Calls `queueUpdate(table, item)` or `queueDelete(table, id)` → batched into `syncQueueRef`
3. `triggerSync()` fires a debounced PATCH after 1.5 s of inactivity

`localStorage` (`erp_data_backup`) stores a full snapshot on every state change as an offline fallback.

### Sync Queue V2 (CT-101)

The sync queue now uses **timestamp reconciliation** to prevent race conditions during retries:
- Each queued record is stamped with `_updatedAt` and `clientOpId`
- Failed payloads are requeued with per-record conflict resolution (keep newer)
- Controlled by the `syncQueueV2` feature flag in `companySettings.flags`

### Authentication Flow

```
App.tsx
  ├── supabase.auth.getSession()          ← restores live session on page reload
  ├── supabase.auth.onAuthStateChange()   ← keeps isAuthenticated in sync
  ├── bootstrapRequired === true          → SetupAdminScreen  (first run, no users)
  ├── isAuthenticated === false           → Login
  ├── crushtrack_welcome_seen === 'pending' → WelcomeScreen  (post-setup)
  └── otherwise                          → Layout (full app)
```

### URL-Based Routing (CT-204)

The app uses `wouter` for lightweight URL routing:
- `Layout.tsx` derives `currentView` from the URL path
- Browser back button and deep links are now supported
- Legacy `NAVIGATE_EVENT` dispatch is preserved as a fallback during migration

---

## Project Structure

```
Stone-Crusher-/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions — lint, typecheck, unit, e2e
├── api/
│   ├── _db.ts                  # Supabase Postgres helper (production)
│   ├── _supabase-admin.ts      # Supabase Admin SDK helper
│   ├── _ratelimit.ts           # Upstash Redis rate limiter
│   ├── _redact.ts              # PII redaction utilities
│   ├── _types.ts               # Shared API types
│   ├── admin-users.ts          # Vercel function — user management
│   └── data.ts                 # Vercel function — CRUD data API
├── scripts/
│   └── migrate-users.ts        # One-time migration: local users → Supabase Auth
├── src/
│   ├── components/
│   │   ├── forms/              # Slip / invoice create-edit-print modals
│   │   ├── ui/                 # Shared primitives (Toast, Combobox, Modal, etc.)
│   │   ├── App.tsx
│   │   ├── Layout.tsx          # App shell + URL-based navigation
│   │   ├── Sidebar.tsx
│   │   ├── Login.tsx
│   │   ├── SetupAdminScreen.tsx
│   │   └── WelcomeScreen.tsx
│   ├── context/
│   │   └── ErpContext.tsx      # Global state + delta-sync engine
│   ├── hooks/
│   │   ├── useFeatureFlag.ts   # Feature flag reader
│   │   └── useActive.ts        # Soft-delete filter hook
│   ├── lib/
│   │   ├── utils.ts            # cn(), parseFeetInches()
│   │   ├── print-utils.ts      # PDF generation (A4 + Thermal)
│   │   ├── employee-ledger.ts  # Employee balance calculation
│   │   ├── supabase.ts         # Supabase client singleton
│   │   ├── capacitor.ts        # Native-platform detection
│   │   ├── barcode.ts          # Barcode / QR scan (Capacitor)
│   │   ├── biometrics.ts       # Biometric auth (Capacitor)
│   │   ├── camera.ts           # Document capture (Capacitor)
│   │   ├── escpos.ts           # Bluetooth ESC/POS thermal printing
│   │   ├── nfc.ts              # NFC vehicle tag reading
│   │   ├── validation.ts       # Zod form schemas
│   │   ├── whatsapp-share.ts   # WhatsApp share helper
│   │   ├── export-utils.ts     # CSV / PDF export
│   │   ├── session.ts          # Session helpers
│   │   └── status-styles.ts    # Slip/invoice status colour mapping
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Dispatch.tsx
│   │   ├── Invoices.tsx        (+ invoices/ sub-components)
│   │   ├── Customers.tsx
│   │   ├── Daybook.tsx
│   │   ├── Ledger.tsx
│   │   ├── Vehicles.tsx
│   │   ├── Employees.tsx
│   │   ├── AuditLog.tsx
│   │   └── Settings.tsx        (+ settings/ sub-panels)
│   ├── __tests__/              # Vitest unit tests
│   ├── types.ts                # All TypeScript interfaces (source of truth)
│   ├── featureFlags.ts         # Central feature flag registry
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   └── e2e/                    # Playwright end-to-end tests
├── server.ts                   # Express dev server (Vite middleware + JSON API)
├── vercel.json                 # Vercel deploy config (bom1, 30 s functions)
├── vite.config.ts
├── playwright.config.ts
└── capacitor.config.ts         # Capacitor native app config
```

---

## Pages

| Page | Route key | Description |
|------|-----------|-------------|
| Dashboard | `dashboard` | KPI cards; recent slips; date-range filter with midnight auto-refresh |
| Dispatch | `dispatch` | Slip list; create/edit/print; NFC/barcode scan |
| Invoices | `invoices` | Invoice list; generate from slips; multi-template print |
| Customers | `customers` | Customer master; balance summary |
| Daybook | `daybook` | Income/expense log |
| Ledger | `ledger` | Per-customer full transaction history |
| Vehicles | `vehicles` | Vehicle master; soft-delete |
| Employees | `employees` | Payroll; per-employee ledger |
| Audit Log | `audit` | Admin-only immutable activity log |
| Settings | `settings` | Company, invoicing, materials, users, appearance tabs |

Navigation is URL-based via `wouter` with `useLocation`. Legacy `NAVIGATE_EVENT` dispatch is preserved as a fallback during migration.

---

## Critical Business Logic

### Brass Volume

```
Brass = (Length_ft × Width_ft × Height_ft) / 100
```

Workers enter `5.6` to mean **5 ft 6 in**, not a decimal. Always use `parseFeetInches(val)` from `src/lib/utils.ts` — never `parseFloat` directly on dimension inputs.

### Customer Balance

```
balance = openingBalance
        + unbilledSlipTotal   (slips: status Pending|Tallied AND no invoiceId)
        + invoiceTotal
        + expenseDebits
        − paymentCredits
```

Implemented as `getCustomerBalance()` inside `ErpContext`.

### Employee Balance

```
balance = openingBalance
        + Salary Earned
        + Bonus / Allowance
        + Reimbursement
        + Advance Returned
        + Adjustment Credit
        − Salary Paid
        − Advance Given
        − Deduction
        − Adjustment Debit
```

Positive = salary/amount owed to employee. Negative = advance recoverable by company.

### Soft Deletes

`Vehicle` and `Material` records receive `isActive: false` instead of being removed. Filter UI lists with `isActive !== false`. Hard-deletes apply only to `customers`, `transactions`, `tasks`, and `employees`.

---

## Deployment (Vercel)

```bash
vercel deploy
```

- **Build command**: `vite build`
- **Output directory**: `dist`
- **Region**: `bom1` (Mumbai)
- **Functions**: `api/data.ts`, `api/admin-users.ts` (30 s max duration)

### Required Environment Variables

| Variable | Required By | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Auth + DB | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Auth + DB | Supabase anon/public key |
| `VITE_SENTRY_DSN` | Observability | Frontend Sentry DSN |
| `SENTRY_DSN` | Observability | Serverless Sentry DSN |
| `UPSTASH_REDIS_REST_URL` | Rate Limiting | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Rate Limiting | Upstash Redis REST token |
| `CSRF_SECRET` | Security | Shared secret for POST CSRF validation |

Add these in the Vercel dashboard before deploying.

---

## Mobile Build (Android)

```bash
npm run build
npx cap sync android
npx cap open android      # opens Android Studio
```

Set `VITE_API_URL` in `.env` to your deployed Vercel URL so the bundled APK can reach the API from any network.

---

## Scripts

```bash
# Migrate existing users from local-data.json to Supabase Auth (one-time)
npx tsx scripts/migrate-users.ts
```

---

## Recent Updates (May 2026)

### Bugfix & Hardening Sprint (20/20 tickets completed)

A comprehensive hardening sprint addressed P0–P3 issues across security, correctness, observability, and mobile readiness:

| Ticket | Fix |
|--------|-----|
| **CT-001** | GitHub Actions CI — lint, typecheck, Vitest unit tests, Playwright e2e |
| **CT-002** | Sentry integration (frontend + serverless) with sourcemap upload |
| **CT-003** | Vitest test harness with jsdom, mocks, and 18+ unit tests |
| **CT-004** | Feature-flag scaffolding for gradual rollouts |
| **CT-101** | Sync queue race condition fix with timestamp reconciliation |
| **CT-102** | Default role no longer falls back to `Admin` on cold boot |
| **CT-103** | Upstash Redis rate limiter (sliding window, fails open) |
| **CT-104** | Audit logs are append-only; restore events are self-auditing |
| **CT-105** | Recoverable `syncStatus: 'failed'` with user-visible retry banner |
| **CT-106** | Stopped auth re-fetch storm on Supabase token refresh |
| **CT-107** | PII stripped from server logs and Sentry events |
| **CT-201** | `parseFeetInches` enforced across all dimension inputs |
| **CT-202** | Centralized soft-delete filtering via `useActive` hook |
| **CT-203** | Tombstone query caching in PATCH handler (~80% fewer DB round-trips) |
| **CT-204** | Migrated to URL-based routing with `wouter` |
| **CT-205** | Optimistic locking on `companySettings` (409 on conflict) |
| **CT-206** | CSRF token protection on destructive `POST /api/data` |
| **CT-301** | Accessibility pass on toasts and offline indicator |
| **CT-302** | Image compression scaffolding (deferred) |
| **CT-303** | Pull-to-refresh scaffolding (deferred) |

Full details: [BUGFIX_IMPLEMENTATION_LOG.md](BUGFIX_IMPLEMENTATION_LOG.md)

---

## Contributing

Pull requests are welcome. For major changes please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.
