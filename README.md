# CrushTrack ERP

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**CrushTrack ERP** is an open-source, production-ready Enterprise Resource Planning system built for stone crusher, quarry, and material logistics businesses. It manages the complete dispatch workflow — from vehicle entry at the gate through to final invoicing and financial reporting.

---

## Features

### Dispatch Management
- Multi-mode measurement: Weight (Tonnes) and Volume (Brass/CFT)
- Smart dimension input — workers enter `5.6` for 5 ft 6 in
- Slip status workflow: Pending → Loaded → Tallied
- Vehicle auto-fill with owner/driver details

### Billing & Invoicing
- GST and Cash billing modes (5% GST with CGST + SGST split)
- Multiple print formats: A4, Thermal-80mm, Thermal-58mm
- Invoice templates: Classic, Modern, Minimal
- Amount-to-words in Indian currency format

### Financial Tracking
- Customer ledger with running balance and full statement history
- Daybook for income/expense tracking with categories
- Dashboard analytics: daily revenue, pending tallies, active vehicles
- CSV and PDF export for all reports

### User Management
- Role-based access: Admin, Partner, Manager
- Account activation/deactivation
- SHA-256 password hashing with hash migration on login

### Mobile (Capacitor)
- Responsive layouts optimized for mobile and tablet
- Touch-friendly UI with large tap targets and bottom navigation
- Native Android build via Capacitor
- Biometric authentication, secure token storage
- Bluetooth ESC/POS thermal printing
- NFC vehicle tag scanning, barcode/QR scanning
- Haptic feedback, keep-awake for active slip forms
- Native file export (PDF/CSV) and share sheet integration

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| State | React Context + optimistic delta-sync engine |
| Backend (dev) | Express.js with Vite middleware |
| Backend (prod) | Vercel serverless functions |
| Database (prod) | PostgreSQL via Supabase |
| Database (dev) | Local flat-file JSON (`local-data.json`) |
| Mobile | Capacitor 8 (Android/iOS) |
| PDF | html2pdf.js + jsPDF |

### Data Flow

```
User action → React Context → optimistic UI update
                                    ↓
                         Delta-sync queue (1.5 s debounce)
                                    ↓
                         PATCH /api/data → server/DB
```

The sync engine queues mutations into `syncQueueRef`, batches them, and sends a `PATCH` payload with `{ updates, deletions }`. The server performs `INSERT … ON CONFLICT DO UPDATE` so concurrent users never overwrite each other's data.

### Key Modules

| Module | Purpose |
|--------|---------|
| `src/context/ErpContext.tsx` | Global state, CRUD ops, delta-sync engine |
| `src/lib/print-utils.ts` | DOM-to-PDF bridge (A4 and Thermal) |
| `src/lib/auth.ts` | Password hashing and hash migration |
| `api/data.ts` | Vercel serverless API (PostgreSQL path) |
| `server.ts` | Express dev server (JSON file path) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- (Optional) A [Supabase](https://supabase.com) project for production PostgreSQL

### Installation

```bash
git clone https://github.com/shoeb70212-ai/Stone-Crusher-.git
cd Stone-Crusher-
npm install
```

### Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

See [`.env.example`](.env.example) for full documentation of each variable. For local development you can leave most fields empty — the app falls back to a local `local-data.json` file.

### Development

```bash
npm run dev        # Express + Vite on http://localhost:5173
```

### Production build

```bash
npm run build      # Vite output → dist/
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Vite, port 5173) |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type check |

---

## Project Structure

```
Stone-Crusher-/
├── api/
│   └── data.ts              # Vercel serverless API (PostgreSQL)
├── src/
│   ├── components/
│   │   ├── forms/           # Slip and invoice form/print modals
│   │   ├── ui/              # Shared UI primitives
│   │   ├── Layout.tsx       # App shell with lazy-loaded routes
│   │   ├── Sidebar.tsx      # Navigation (desktop + mobile bottom nav)
│   │   └── Login.tsx        # Authentication screen
│   ├── context/
│   │   └── ErpContext.tsx   # Global state + delta-sync engine
│   ├── lib/
│   │   ├── utils.ts         # cn(), parseFeetInches()
│   │   ├── print-utils.ts   # PDF generation and share/download
│   │   ├── auth.ts          # Password hashing
│   │   ├── barcode.ts       # Barcode/QR scanning (Capacitor)
│   │   ├── biometrics.ts    # Biometric auth (Capacitor)
│   │   ├── camera.ts        # Document capture (Capacitor)
│   │   ├── escpos.ts        # Bluetooth ESC/POS thermal printing
│   │   ├── nfc.ts           # NFC vehicle tag reading
│   │   └── validation.ts    # Zod form validation
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Dispatch.tsx
│   │   ├── Invoices.tsx
│   │   ├── Customers.tsx
│   │   ├── Daybook.tsx
│   │   ├── Ledger.tsx
│   │   ├── Vehicles.tsx
│   │   └── Settings.tsx
│   ├── types.ts             # All TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
├── android/                 # Capacitor Android project
├── server.ts                # Express dev server
├── capacitor.config.ts      # Capacitor configuration
├── vite.config.ts
└── .env.example             # Environment variable reference
```

---

## Business Logic

### Customer Balance

```
balance = openingBalance
        + unbilledSlipTotal     (Pending / Tallied slips with no invoiceId)
        + invoiceTotal
        + expenseDebits
        - paymentCredits
```

### Brass Volume

```
Brass = (Length × Width × Height) / 100
```

Workers enter dimensions as `5.6` to mean 5 ft 6 in. Always use `parseFeetInches(val)` from `src/lib/utils.ts` — never `parseFloat` directly.

### Soft Deletes

`Vehicle` and `Material` records are soft-deleted via `isActive: false`. Always filter UI lists with `isActive !== false`. Hard-deletes apply only to `customers`, `transactions`, and `tasks`.

---

## Mobile Build (Android)

```bash
npm run build
npx cap sync android
npx cap open android       # open in Android Studio
```

Set `VITE_API_URL` in your `.env` to your deployed Vercel URL before building the APK so the bundled app can reach the API from any network.

---

## Default Credentials (First Run)

When no users are configured the app shows a first-run setup screen where you create the initial admin account. There are no hard-coded default credentials in the production flow.

---

## Deployment (Vercel)

1. Push the repository to GitHub.
2. Import it into [Vercel](https://vercel.com).
3. Add the environment variables from `.env.example` in the Vercel dashboard.
4. Deploy — Vercel uses `api/data.ts` as a serverless function automatically.

---

## Contributing

Pull requests are welcome. For major changes please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.
