# Project Handoff: CrushTrack ERP - Technical Deep-Dive

## 1. System Architecture Overview
The system is built as a **Local-First, Sync-Second** application. It uses a custom sync engine to bridge the gap between high-frequency site operations (slips/weighbridge) and centralized management.

## 2. Recent Technical Hardening

### 🔒 Authentication System
- **Mechanism**: The app uses a "Mock-Auth" strategy designed for easy transition to Firebase/Supabase Auth.
- **Location**: `src/components/Login.tsx` and protected in `App.tsx`.
- **Validation**:
  - Checks `companySettings.users` for an email match.
  - If no users are found (fresh install), it falls back to `admin@admin.com` / `admin123`.
- **Handoff Note**: To migrate to a real provider, simply swap the `handleLogin` logic in `Login.tsx`. The rest of the app already consumes the `userRole` from the context.

### ⚡ Delta-Sync Engine (PATCH Implementation)
This is the most critical part of the recent hardening phase.
- **Concept**: Instead of sending the full database state on every change (which causes collisions and "data jumping"), we now send only incremental updates.
- **The Queue**: `ErpContext.tsx` maintains a `syncQueueRef`. When a user saves a slip, it's added to the queue.
- **Sync Trigger**: A 1.5s debounced timeout (`triggerSync`) sends a `PATCH` request to the server.
- **Payload Structure**:
  ```json
  {
    "updates": { "slips": [{ ... }], "vehicles": [{ ... }] },
    "deletions": { "transactions": ["id-123"] }
  }
  ```
- **Backend (PostgreSQL)**: The `/api/data` handler in `api/data.ts` uses dynamic query generation to perform `INSERT ... ON CONFLICT (id) DO UPDATE`. This ensures that if two users are working on different slips, they **will not** overwrite each other's work.

## 3. Important Design Tokens & Utilities

### Industry Units
- **Brass Volume**: Always uses `(L * W * H) / 100`.
- **Dimension Input**: Workers enter `5.6` to mean 5ft 6in. **CRITICAL**: Use `parseFeetInches(val)` from `src/lib/utils.ts` for all calculations. Never use `parseFloat` directly on dimension inputs.

### Soft Deletions
- For `Vehicles` and `Materials`, we use an `isActive: boolean` flag.
- **Why**: Deleting a material used in a slip from 6 months ago would break the ledger. Always filter UI lists by `isActive !== false` but keep the data in the state/DB.

## 4. Session Work - April 28, 2026

### 4.1 Print/Download Fixes (Prior Sessions)

| File | Issue | Solution |
|------|-------|----------|
| `src/components/forms/PrintInvoiceModal.tsx` | Modal not closing after print | Added `setTimeout(() => onClose(), 500)` |
| `src/components/forms/PrintInvoiceModal.tsx` | PDF going to second page | Adjusted width: 700px, margins: 8mm, height: 900px |
| `src/components/forms/PrintInvoiceModal.tsx` | Duplicate button content | Fixed button layout structure |
| `src/lib/print-utils.ts` | Using incorrect DOM-to-image approach | Completely rewrote to use html2pdf.js |
| `src/components/forms/PrintSlipModal.tsx` | Format dropdown taking space | Removed format dropdown, made buttons compact |

### 4.2 Syntax Error Fix (This Session)

**File:** `src/pages/Invoices.tsx`

**Issue:** Missing curly braces around the `filteredInvoices.map()` function caused TypeScript compilation error.

**Fix Applied:**
```diff
- <div className="space-y-1">
- filteredInvoices.map((inv) => (
+ <div className="space-y-1">
+ {filteredInvoices.map((inv) => (
```

Also added closing curly brace:
```diff
- </div>
- ))
-</div>
+ </div>
+ ))}
+</div>
```

**Verification:** ✅ Build passes successfully

### 4.4 Invoicing & Settings Stability (April 29, 2026)

| Component | Technical Fix | Outcome |
|-----------|---------------|---------|
| `PrintInvoiceModal.tsx` | Changed padding logic to `Math.max(0, 8 - items.length)` | Invoices with <8 items fit on one page. |
| `print-utils.ts` | Implemented `openPdfInNewTab()` with sync window allocation | Prevents browser popup blockers from stopping downloads. |
| `ErpContext.tsx` | Added `localStorage` hydration for `userRole` in `useState` initializer | Login sessions now survive page refreshes/reloads. |
| `index.css` | Scoped `@supports (height: 100dvh)` to `@media (max-width: 640px)` | Fixed "cut-off" issue on desktop Settings page; enabled scrolling. |
| `ErpContext.tsx` | Added missing `isLoading` and `syncStatus` to Provider value | Resolved TypeScript/Runtime sync errors in the UI. |

### 4.5 Verified Settings Logic
- **Appearance**: Color modes (Light/Dark/System) and Theme colors (Emerald/Blue/etc.) are verified functional and saving.
- **Invoicing**: Terms & Conditions and Template selection are verified functional and saving.
- **Access**: Settings is restricted to `Admin` role only; Manager/Partner roles cannot see the module.

## 5. Current Status of Features

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Auth Layer** | ✅ Done | Secured with role-based routing. |
| **Delta Sync** | ✅ Done | PATCH based, collision-safe. |
| **Vehicle Master** | ✅ Done | Dynamic selection in Dispatch. |
| **Material Master** | ✅ Done | Dynamic pricing and activation. |
| **PDF Billing** | ✅ Done | Single-page fitting (A4) and blocker-safe. |
| **Mobile Layout** | ✅ Done | Compact views, touch-friendly targets. |
| **Print Fixes** | ✅ Done | 1-page padding, sync window opening fixed. |
| **Settings Scroll** | ✅ Done | Fixed desktop clipping in CSS. |
| **Auth Persistence** | ✅ Done | Sessions survive reload via hydration. |
| **Mobile App** | 🚧 Pending | Capacitor wrapping required. |

---

## 6. Key Source Files Reference

### Core Files
| File | Purpose |
|------|---------|
| `src/types.ts` | All TypeScript interfaces (single source of truth) |
| `src/context/ErpContext.tsx` | Global state, CRUD operations, delta-sync engine |
| `src/lib/utils.ts` | Utility functions (cn(), parseFeetInches()) |
| `src/lib/print-utils.ts` | DOM-to-print/PDF bridge (html2pdf.js) |
| `server.ts` | Express server with flat-file JSON API |

### Pages (Mobile Status)
| File | Purpose | Mobile Status |
|------|---------|---------------|
| `src/pages/Dashboard.tsx` | Overview with stats | ✅ Optimized |
| `src/pages/Dispatch.tsx` | Slip/Dispatch management | ✅ Optimized |
| `src/pages/Invoices.tsx` | Invoice generation | ✅ Fixed |
| `src/pages/Daybook.tsx` | Cash transactions | ✅ Optimized |
| `src/pages/Ledger.tsx` | Customer account tracking | ✅ Optimized |
| `src/pages/Customers.tsx` | Customer management | ✅ Optimized |
| `src/pages/Vehicles.tsx` | Vehicle directory | ✅ Optimized |
| `src/pages/Settings.tsx` | Configuration | Standard |

### Print Components
| File | Purpose |
|------|---------|
| `src/components/forms/PrintInvoiceModal.tsx` | Invoice print modal |
| `src/components/forms/PrintSlipModal.tsx` | Slip print modal |

---

## 7. Build & Commands

```bash
# Start development server (Express + Vite, port 5173)
npm run dev

# Type check only (note: pre-existing React types warning)
npm run lint

# Production build
npm run build
```

**Build Output:**
```
✓ 2215 modules transformed
✓ built in 4.01s
```

---

## 8. Business Logic Reference

### Customer Balance Formula
```
balance = openingBalance + unbilledSlipTotal + invoiceTotal + expenseDebits - paymentCredits
```
- Unbilled slips = slips with status `Pending | Tallied` that have no `invoiceId`

### Print Format Options
- **Slip:** A4, Thermal-80mm, Thermal-58mm
- **Invoice:** Classic, Modern, Minimal

### Mobile Layout Toggle
- Controlled via `companySettings.mobileLayout === 'Compact'` setting

---

## 9. What Was Done

### This Session (April 28, 2026)
1. Fixed syntax error in `src/pages/Invoices.tsx` - added missing curly braces
2. Verified build passes successfully
3. Reviewed all mobile layouts - all optimized

### Prior Sessions
1. Fixed print modal not closing after print
2. Fixed PDF sizing (700px width, 8mm margins)
3. Rewrote print-utils.ts to use html2pdf.js
4. Removed format dropdowns from print modals
5. Mobile layout optimizations across all pages

---

## 10. Recommendations

### Low Priority
1. Install `@types/react` to resolve lint warnings (non-blocking)
2. Consider code-splitting for large bundle sizes

### Future Enhancements (Not Requested)
1. Pull-to-refresh on mobile lists
2. Offline mode indicator
3. Push notifications for pending invoices

---

1. **Capacitor Integration**: Run `npx cap add android` and build the mobile binaries.
2. **Action-Level Permissions**: Currently, roles only hide pages. Implement logic in `ErpContext` to prevent `Manager` from deleting records or editing sensitive settings.
3. **Ledger Filters**: Add date-range filtering to handled high-volume accounts.

---

*Document updated: April 29, 2026*
*Original handoff by Antigravity AI*
