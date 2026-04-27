# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (Express + Vite middleware, port 5173)
npm run dev        # tsx server.ts

# Type check only (no emit)
npm run lint       # tsc --noEmit

# Production build (Vite only)
npm run build

# No test suite is configured
```

## Architecture

**CrushTrack ERP** is a local-first dispatch and billing management system for stone crushers/quarries. All data flows through a single global context and is persisted to a flat-file JSON store (`local-data.json`) via a debounced delta-sync engine.

### Request Flow

```
Browser → React (ErpContext) → optimistic UI update
                             → queueUpdate/queueDelete (debounced 1.5s)
                             → PATCH /api/data → local-data.json
```

The dev server (`server.ts`) is an Express app with Vite in middleware mode. It exposes three API endpoints:
- `GET /api/data` — returns full `local-data.json`
- `POST /api/data` — replaces entire file (bulk import)
- `PATCH /api/data` — merges `{ updates, deletions }` delta payload using upsert-by-id logic

### State Management

All state lives in `src/context/ErpContext.tsx` (`ErpProvider` / `useErp`). The context manages six entities: `customers`, `slips`, `transactions`, `vehicles`, `invoices`, `tasks`, plus `companySettings`.

Every mutation:
1. Updates React state immutably (spread operator)
2. Calls `queueUpdate(table, item)` or `queueDelete(table, id)` which batches into `syncQueueRef`
3. `triggerSync()` fires a debounced PATCH after 1.5s of inactivity

`localStorage` holds a `erp_data_backup` snapshot (written on every state change) used as an offline fallback.

### Authentication

- `App.tsx` checks `localStorage.erp_auth_token` on mount
- `Login.tsx` validates against `companySettings.users` array; falls back to `admin@admin.com` / `admin123` if no users exist
- `userRole` (`Admin | Partner | Manager`) drives UI-level access control in each page

### Critical Business Logic

**Brass Volume** (cubic volume unit): `(L × W × H) / 100` — always use `parseFeetInches(val)` from `src/lib/utils.ts` for dimension inputs (workers enter `5.6` to mean 5ft 6in, not a decimal).

**Soft Deletions**: `Vehicle` and `Material` records are never hard-deleted — they get `isActive: false`. Filter UI lists with `isActive !== false`. Hard deletes only apply to `customers`, `transactions`, and `tasks`.

**Customer Balance** (`getCustomerBalance` in ErpContext):
```
balance = openingBalance + unbilledSlipTotal + invoiceTotal + expenseDebits - paymentCredits
```
Unbilled slips = slips with status `Pending | Tallied` that have no `invoiceId`.

### Key Files

| File | Purpose |
|------|---------|
| `src/types.ts` | All TypeScript interfaces (single source of truth for data shapes) |
| `src/context/ErpContext.tsx` | Global state, CRUD ops, delta-sync engine |
| `src/lib/utils.ts` | `cn()` for Tailwind, `parseFeetInches()` for dimension input |
| `src/lib/print-utils.ts` | DOM-to-print/PDF bridge (A4 and Thermal formats) |
| `server.ts` | Express server with Vite middleware and flat-file JSON API |
| `local-data.json` | Runtime data file (gitignored; auto-created on first start) |

### Pages

`Dashboard`, `Dispatch` (slips), `Invoices`, `Customers`, `Daybook` (transactions), `Ledger`, `Vehicles`, `Settings` — all route through `src/components/Layout.tsx` with sidebar navigation.

### Print / PDF

`PrintSlipModal.tsx` and `PrintInvoiceModal.tsx` contain `@media print` CSS. Slip format options: `A4`, `Thermal-80mm`, `Thermal-58mm`. Invoice templates: `Classic`, `Modern`, `Minimal`.

## Engineering Standards

### Style & Structure

- Write code as the most senior developer on the team would — clean, structured, and immediately understandable.
- Follow established patterns and conventions already present in the codebase.
- Use clear, descriptive names for variables, functions, and classes — names should reveal intent without needing a comment.

### Comments & Documentation

- Add comments that explain WHY, not just WHAT. The code shows what happens; comments explain the reasoning behind decisions.
- Every function/method must have a concise doc comment covering: purpose, parameters, return value, and any side effects.
- Mark any non-obvious logic, edge cases, or workarounds with an explanatory comment.

### Cleanliness

- Remove ALL dead code, unused imports, redundant variables, and commented-out code blocks.
- No unnecessary abstractions. Don't over-engineer.
- No duplicate logic — consolidate where it makes sense.

### Safety

- Do NOT change behavior, logic, or functionality when refactoring.
- Only improve readability, structure, naming, and documentation.
- If a refactor would risk changing behavior, add a comment noting the concern instead of making the change.
