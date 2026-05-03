# CrushTrack ERP

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?logo=supabase)](https://supabase.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor)](https://capacitorjs.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**CrushTrack ERP** is a production-ready Enterprise Resource Planning system for stone crusher, quarry, and material logistics businesses. It covers the full dispatch-to-billing cycle — vehicle entry, slip creation, GST invoicing, customer ledger, employee payroll, and financial reporting — with native mobile support via Capacitor 8 and cloud sync via Supabase.

---

## Features

### Dispatch
- Multi-mode measurement: **Weight (Tonnes)** and **Volume (Brass/CFT)**
- Smart dimension input — workers enter `5.6` to mean 5 ft 6 in (handled by `parseFeetInches`)
- Slip status workflow: `Pending → Loaded → Tallied → Cancelled`
- Vehicle auto-fill (owner, driver, saved dimensions)
- Photo attachment via device camera
- NFC vehicle tag scan & QR/barcode scan

### Billing & Invoicing
- **GST** and **Cash** invoice modes with CGST + SGST breakdown
- Three invoice templates: **Classic**, **Modern**, **Minimal**
- Three print formats: **A4**, **Thermal-80mm**, **Thermal-58mm**
- Amount-to-words in Indian currency format
- WhatsApp share directly from the print modal
- Invoice watermark options (Company Name, Status, Custom text)

### Financial Tracking
- **Customer Ledger** — running balance with opening balance, unbilled slips, invoices, payments, and expense debits
- **Daybook** — income/expense log with category filtering
- **Dashboard** — KPI cards (Today / Week / Month / Year / Custom) with midnight auto-refresh
- CSV and PDF export for all reports

### Employee Payroll
- Weekly and monthly salary types
- Transaction types: Salary Earned, Salary Paid, Advance Given/Returned, Deduction, Bonus, Reimbursement, Adjustments
- Per-employee ledger with opening balance carry-forward
- Automatic Daybook entries for cash movements (salary paid, advance given)

### Audit Log
- Immutable, timestamped activity records for all important operations
- Tracks entity type, actor, action, and optional metadata

### User Management
- First-run admin setup wizard (no hard-coded credentials)
- Role-based access: **Admin**, **Partner**, **Manager**
- Supabase Auth (JWT) with `onAuthStateChange` listener
- Biometric authentication on supported mobile devices

### Mobile (Capacitor 8)
- Touch-friendly UI: large tap targets, bottom navigation, comfortable/compact layout modes
- Native Android build via Capacitor
- Biometric unlock, secure preferences storage
- Bluetooth ESC/POS thermal printing (`escpos.ts`)
- NFC tag read, barcode/QR scan
- Haptic feedback, keep-awake during active slip entry
- Native file export and system share sheet

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4 |
| State | `ErpContext` — React Context with optimistic delta-sync |
| Backend (dev) | Express 5 with Vite middleware |
| Backend (prod) | Vercel Serverless Functions (`api/`) |
| Database (dev) | Flat-file `local-data.json` |
| Database (prod) | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT) |
| Mobile | Capacitor 8 (Android / iOS) |
| PDF | `html2pdf.js` + `@media print` CSS |
| Validation | Zod schemas at API and form boundaries |

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
| `POST` | `/api/data` | Bulk-replace dataset (import) |
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

---

## Project Structure

```
Stone-Crusher-/
├── api/
│   ├── _db.ts                  # Supabase Postgres helper (production)
│   ├── _supabase-admin.ts      # Supabase Admin SDK helper
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
│   │   ├── Layout.tsx          # App shell + event-driven navigation
│   │   ├── Sidebar.tsx
│   │   ├── Login.tsx
│   │   ├── SetupAdminScreen.tsx
│   │   └── WelcomeScreen.tsx
│   ├── context/
│   │   └── ErpContext.tsx      # Global state + delta-sync engine
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
│   │   ├── Invoices.tsx        (+ invoices/useInvoiceGenerator.ts)
│   │   ├── Customers.tsx
│   │   ├── Daybook.tsx
│   │   ├── Ledger.tsx
│   │   ├── Vehicles.tsx
│   │   ├── Employees.tsx
│   │   ├── AuditLog.tsx
│   │   └── Settings.tsx        (+ settings/ sub-panels)
│   ├── types.ts                # All TypeScript interfaces (source of truth)
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   └── e2e/                    # Playwright end-to-end tests
├── server.ts                   # Express dev server (Vite middleware + JSON API)
├── vercel.json                 # Vercel deploy config (bom1, 30 s functions)
├── vite.config.ts
└── playwright.config.ts
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

Navigation is event-driven: `window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: view }))` — no client-side router.

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

Add the Supabase environment variables in the Vercel dashboard before deploying.

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
