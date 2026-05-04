# CrushTrack ERP — Comprehensive Codebase Audit Report

**Audit Date:** 2026-05-04
**Auditor:** Kilo (AI Code Review Agent)
**Scope:** Full codebase (`src/`, `api/`, `server.ts`, build config, docs) with mobile-first priority
**Deliverable:** Read-only analysis — no file modifications performed

---

## Summary Statistics

| Severity | Count |
|----------|-------|
| Critical | 7 |
| High | 12 |
| Medium | 15 |
| Low | 11 |
| **Total** | **45** |

---

## Critical Findings

### CRIT-1: Invoice Cancellation Uses Unsafe Type Cast for Slip Unlinking
- **File:** `src/pages/Invoices.tsx`
- **Line:** 500
- **Description:** During invoice cancellation, slip unlinking uses `invoiceId: null as unknown as undefined`. This is type-unsafe and may cause sync issues because the server-side PATCH handler treats `null` differently from `undefined` in JSON payloads. The `api/data.ts` and `server.ts` PATCH handlers merge updates with spread operators; passing `null` explicitly sets the column to NULL in Postgres, but the intent is to clear the field. The type cast suppresses TypeScript protection.
- **Recommended Fix:** Change the update to use `invoiceId: undefined` and ensure the server normalizes `undefined` to NULL in the upsert logic, or use a sentinel value that the server recognizes as "clear this field."

### CRIT-2: Customer Balance Formula Ignores `amountPaid` on Slips
- **File:** `src/context/ErpContext.tsx`
- **Line:** 1100–1124
- **Description:** `getCustomerBalance` computes balance from `openingBalance + unbilledSlipTotal + invoiceTotal + expenseTotal - incomeTotal`. It does **not** subtract `amountPaid` from slips that have partial or full cash payments. This means a customer who pays cash-on-delivery will still show the full slip amount as owing, leading to incorrect receivables and potential double-billing.
- **Recommended Fix:** Include `slip.amountPaid` in the balance calculation: subtract `amountPaid` from the unbilled slip total, or add a separate payment-credits term that aggregates slip payments.

### CRIT-3: Employee Soft-Delete Does Not Check for Active Salary Transactions
- **File:** `src/context/ErpContext.tsx`
- **Line:** 833–848
- **Description:** `deleteEmployee` sets `isActive: false` but does not verify whether the employee has active salary transactions (`employeeTransactions`). Soft-deleting an employee with active ledger entries makes the ledger history inaccessible from the UI (which filters `isActive !== false`) while the financial records still exist, creating orphaned data and reconciliation nightmares.
- **Recommended Fix:** Add a pre-delete check: if `employeeTransactions.some(tx => tx.employeeId === id)`, block the deletion and show a warning: "Cannot deactivate employee with active ledger entries."

### CRIT-4: CORS `origin: true` in Dev Server is Insecure if Deployed
- **File:** `server.ts`
- **Line:** 315
- **Description:** The Express dev server uses `cors({ origin: true, credentials: true })`, which reflects any `Origin` header back to the client. This is acceptable for local development but dangerous if the dev server is ever exposed to a network (e.g., `0.0.0.0` binding) or if the file is copied into a production container. It allows any website to make authenticated cross-origin requests.
- **Recommended Fix:** Restrict dev CORS to `['http://localhost:5173', 'http://localhost:8083']` or read from an env var. Never use `origin: true` in production.

### CRIT-5: API CORS Whitelist Missing Capacitor Origins (Inconsistency)
- **File:** `api/data.ts` (lines 31–39) and `api/admin-users.ts` (lines 19–24)
- **Description:** The Vercel API allows `capacitor://localhost` and `https://localhost` for the Capacitor WebView, but `api/admin-users.ts` does **not** include these origins. This means admin user management calls from the Android app will be rejected with CORS errors. Additionally, the `http://localhost:8081` origin is present in both but there is no documented reason for it, increasing attack surface.
- **Recommended Fix:** Extract `ALLOWED_ORIGINS` into a shared `api/_cors.ts` module and import it in both handlers. Add `capacitor://localhost` and `https://localhost` to `api/admin-users.ts`.

### CRIT-6: Native PDF Share Loads Entire Blob into Memory as Base64
- **File:** `src/lib/print-utils.ts`
- **Line:** 1318
- **Description:** `sharePdfBlob` converts the PDF Blob to base64 via `blobToBase64` before writing to the Capacitor Filesystem. On large invoices (A4, many items) or bulk share operations, this can exceed the Android WebView memory limit (~192–256 MB), causing an OOM crash with no recovery path.
- **Recommended Fix:** Stream the blob to the filesystem using the Capacitor Filesystem `writeFile` API with binary data if supported, or chunk the base64 conversion. For large PDFs, fall back to download instead of share.

### CRIT-7: localStorage Backup Debounce Creates Data Loss Window
- **File:** `src/context/ErpContext.tsx`
- **Line:** 407–413
- **Description:** The localStorage backup is debounced by 5 seconds. If the app crashes, is killed by the OS, or the device battery dies within that 5-second window, all mutations made since the last backup are lost permanently. On mobile, where apps are frequently background-killed, this is a significant data-loss risk.
- **Recommended Fix:** Use a shorter debounce (e.g., 1s) for critical mutations (slips, invoices). Alternatively, write to `IndexedDB` immediately and debounce the `localStorage` mirror only.

---

## High Findings

### HIGH-1: Sync Retry Lacks Exponential Backoff — Race Condition Risk
- **File:** `src/context/ErpContext.tsx`
- **Line:** 365–377
- **Description:** `triggerSync` retries with a fixed 400ms delay (`MAX_RETRIES = 5`). Under poor network conditions, this hammers the server and provides no backoff. Additionally, `flushSyncQueue` resets the queue before the async fetch, but `triggerSync` can fire concurrently via network reconnect or manual calls, causing race conditions where mutations are dropped or duplicated.
- **Recommended Fix:** Implement exponential backoff (e.g., 400ms, 800ms, 1.6s, 3.2s, 6.4s). Add a `syncInProgress` flag (ref) to prevent concurrent flushes.

### HIGH-2: Vehicle Auto-Save in CreateSlipForm Creates Duplicates on Rapid Entry
- **File:** `src/components/forms/CreateSlipForm.tsx`
- **Line:** 148–171
- **Description:** When a user enters a new vehicle number and submits the form rapidly (e.g., double-tap on mobile), the `addVehicle` call is not debounced or deduplicated. Because `vehicles` state updates asynchronously, a second submit may not see the newly created vehicle and will create another one with a different UUID.
- **Recommended Fix:** Add a `creatingVehicle` ref or state flag to block duplicate creation. Alternatively, deduplicate by `vehicleNo` in the `addVehicle` implementation.

### HIGH-3: Invoice Cancellation Deletes Income Transactions Using Unsafe `any` Cast
- **File:** `src/pages/Invoices.tsx`
- **Line:** 505–511
- **Description:** The cancellation logic filters transactions by `(t as any).slipId === slipId && t.type === "Income"`. The `Transaction` type does not include `slipId` in its interface (it is present at runtime but not guaranteed by TypeScript). This type assertion bypasses safety and could delete unrelated Income transactions if the runtime shape changes. Additionally, it deletes **all** Income transactions linked to the slip, not just the auto-generated one.
- **Recommended Fix:** Add `slipId?: string` to the `Transaction` interface. Filter transactions by a more specific category (e.g., `category === "Slip Payment"`) to avoid deleting manually recorded Income entries.

### HIGH-4: Biometric Auth Stores Refresh Token Without Expiry Check
- **File:** `src/lib/biometrics.ts`
- **Line:** 45–59
- **Description:** `authenticateWithBiometrics` returns the stored refresh token without validating its expiry. If the token is expired (Supabase refresh tokens expire after a configurable period, default 30 days), the biometric login will fail and fall back to password, which is acceptable — but the biometric prompt itself has no timeout. A hung biometric dialog can leave the app unresponsive.
- **Recommended Fix:** Add a timeout (e.g., 10s) around `NativeBiometric.verifyIdentity`. After retrieving the token, verify it is not expired before returning.

### HIGH-5: Camera Photo EXIF Location Data Not Stripped
- **File:** `src/lib/camera.ts`
- **Line:** 33–49
- **Description:** `captureNative` uses `allowEditing: true` but does not strip EXIF metadata (including GPS location) from captured photos. In a quarry environment, photos of dispatch slips may inadvertently record precise location coordinates, creating a privacy and security risk.
- **Recommended Fix:** After capturing, read the photo file and strip EXIF metadata using a library like `piexifjs` before storing the `attachmentUri`. Alternatively, set `saveToGallery: false` and process the file through a canvas to strip metadata.

### HIGH-6: Bluetooth Printer Connection State Does Not Survive App Backgrounding
- **File:** `src/lib/escpos.ts`
- **Line:** 120–121
- **Description:** `connectedDeviceId` and `connectedProfile` are stored in module-level variables. When the Android app is backgrounded and the OS kills the JavaScript context, these variables are reset. The user must re-scan and re-connect the printer, which is disruptive in a fast-paced dispatch environment.
- **Recommended Fix:** Persist the last connected `deviceId` to `@capacitor/preferences` and attempt auto-reconnect on app foreground.

### HIGH-7: Password Reset Flow Does Not Invalidate Existing Sessions
- **File:** `src/components/Login.tsx` and `src/App.tsx`
- **Line:** `Login.tsx:125`, `App.tsx:86–98`
- **Description:** When a user resets their password via email, `App.tsx` handles the `PASSWORD_RECOVERY` event by showing `ResetPasswordScreen`. However, there is no explicit call to `supabase.auth.signOut()` or session invalidation for other active sessions on other devices. The old refresh token remains valid until expiry.
- **Recommended Fix:** After a successful password reset, call `supabase.auth.signOut({ scope: 'global' })` if supported by the Supabase client version, or document that admins should manually revoke sessions from the Supabase dashboard.

### HIGH-8: CORS Origin Lists Duplicated and Divergent
- **File:** `api/data.ts`, `api/admin-users.ts`
- **Line:** `data.ts:31–39`, `admin-users.ts:19–24`
- **Description:** The allowed CORS origins are hardcoded in two places with slight differences. This is a maintenance risk: future origin additions (e.g., iOS Capacitor `capacitor://localhost`) may be added to one file and forgotten in the other.
- **Recommended Fix:** Extract `ALLOWED_ORIGINS` and `getCorsOrigin` into `api/_cors.ts` and import everywhere.

### HIGH-9: Role Fallback Defaults to Admin on Invalid localStorage Value
- **File:** `src/context/ErpContext.tsx`
- **Line:** 192–194
- **Description:** `localStorage.getItem('erp_user_role')` is parsed with a fallback to `'Admin'`. If an attacker manipulates localStorage to an invalid value (e.g., `'Admin'`), the user gets Admin privileges before the Supabase session resolves. Although the role is later re-derived from `app_metadata`, there is a brief window where the UI renders Admin-only routes and components.
- **Recommended Fix:** Default to `'Partner'` (lowest privilege) instead of `'Admin'`. Gate all Admin UI behind `isLoading === false && resolvedRole === 'Admin'`.

### HIGH-10: Sync Queue Retry Exhaustion Leaves Data Unsynced Without User Warning
- **File:** `src/context/ErpContext.tsx`
- **Line:** 369–376
- **Description:** When `MAX_RETRIES` is exhausted, `syncStatus` remains `'error'`, but there is no persistent toast, notification, or badge indicating unsynced data. Users may close the app unaware that critical financial data has not reached the server.
- **Recommended Fix:** Add a persistent banner or badge count showing the number of unsynced items. On app close (if native), prompt the user if the queue is non-empty.

### HIGH-11: JWT Verification Lacks Algorithm Confusion Protection
- **File:** `server.ts`
- **Line:** 136–174
- **Description:** `verifySupabaseJwt` derives the verification algorithm from `jwk.kty` (EC vs RSA). While Supabase currently uses EC P-256, the code does not explicitly restrict allowed algorithms. A malicious JWT with `alg: 'none'` or a forged RSA key could potentially bypass verification if the JWKS endpoint is compromised.
- **Recommended Fix:** Explicitly whitelist allowed algorithms: `const ALLOWED_ALGS = ['ES256', 'RS256'];` and reject anything else.

### HIGH-12: Rate Limiting is Memory-Only and Not Distributed
- **File:** `api/data.ts`
- **Line:** 56–69
- **Description:** `rateLimitStore` is a `Map` in the Vercel serverless function memory. On Vercel, functions are stateless and may run on multiple instances; the rate limit does not aggregate across instances. A determined attacker can bypass it by rotating IPs or simply hitting different Vercel edge nodes.
- **Recommended Fix:** Use Redis or a similar distributed store for rate limiting. If Redis is unavailable, reduce `RATE_LIMIT` to a conservative value (e.g., 30) and add per-user limits in addition to per-IP.

---

## Medium Findings

### MED-1: Mobile Combobox Focus Trapping Issues on iOS Safari
- **File:** `src/components/ui/Combobox.tsx`
- **Line:** 66–71, 180–244
- **Description:** The mobile compact picker sets `document.body.style.overflow = "hidden"` when open, but it does not trap focus within the sheet. On iOS Safari, tapping outside the sheet or using the hardware "Done" button on the virtual keyboard can leave focus on a hidden element, causing the sheet to remain open or the body scroll to stay locked.
- **Recommended Fix:** Use a focus-trap library or manually manage `tabindex` within the mobile sheet. Ensure `document.body.style.overflow` is restored in a `finally` block or via `useEffect` cleanup.

### MED-2: MobileModal Focus Trap Does Not Handle Shadow DOM or Iframes
- **File:** `src/components/ui/MobileModal.tsx`
- **Line:** 79–115
- **Description:** The focus trap query selector (`FOCUSABLE`) does not penetrate Shadow DOM or iframes. If the modal ever contains an iframe (e.g., for embedded content), focus can escape the trap.
- **Recommended Fix:** Document this limitation. If iframes are needed in modals in the future, use a library like `focus-trap` which handles Shadow DOM and nested focusables.

### MED-3: Dashboard Lists Not Virtualized — Performance Bottleneck on Large Data
- **File:** `src/pages/Dashboard.tsx`
- **Line:** 358–389, 411–441
- **Description:** `recentSlips` and `recentTransactions` are sliced to 5 items, but `slips` and `transactions` arrays may contain thousands of records. The `useMemo` filters iterate the entire array on every render. On mobile with large datasets, this causes frame drops.
- **Recommended Fix:** For the Dashboard, consider maintaining a separate "recent" index or limiting the source arrays in `ErpContext` before they reach the Dashboard. If full arrays are needed elsewhere, use `react-window` or virtualization for long lists.

### MED-4: `parseFeetInches` Allows Negative Values and Empty Strings
- **File:** `src/lib/utils.ts`
- **Line:** 34–50
- **Description:** `parseFeetInches` returns `0` for empty strings and accepts negative feet values (e.g., `"-5.6"` parses to `-5.5`). Negative dimensions are physically impossible and could corrupt billing calculations.
- **Recommended Fix:** Add validation: `if (feet < 0) return NaN;` and propagate the error to the form validator. Update `slipSchema` in `validation.ts` to reject negative dimensions.

### MED-5: Error Boundary Only Logs to Console — No Remote Reporting
- **File:** `src/components/ErrorBoundary.tsx`
- **Line:** 18–20
- **Description:** `componentDidCatch` logs to `console.error` but does not send errors to a monitoring service (e.g., Sentry, LogRocket). In production, especially on mobile, these errors are invisible to developers.
- **Recommended Fix:** Integrate a crash reporter for native builds (e.g., Firebase Crashlytics via Capacitor plugin) and a web error tracker for the PWA.

### MED-6: WhatsApp Share Fallback May Fail Silently on Native
- **File:** `src/lib/whatsapp-share.ts`
- **Line:** 55–71
- **Description:** `openWhatsAppMessage` uses `whatsapp://send` on native, but if WhatsApp is not installed, the timeout fallback to `https://wa.me` may not work inside the WebView context (some Android WebViews block custom URL schemes silently).
- **Recommended Fix:** Use `@capacitor/share` or `@capacitor/browser` for the fallback. Check if WhatsApp is installed before attempting the deep link.

### MED-7: localStorage Backup Does Not Handle `QuotaExceededError`
- **File:** `src/context/ErpContext.tsx`
- **Line:** 407–443
- **Description:** The 5-second debounced backup writes the full dataset to `localStorage`. As the dataset grows (photos as base64, thousands of slips), it may exceed the ~5MB WebView limit, throwing `QuotaExceededError`. The current code silently swallows this in a `try/catch` with no fallback.
- **Recommended Fix:** Catch `QuotaExceededError` explicitly, fall back to `IndexedDB` or `@capacitor/preferences`, and warn the user that offline backup is unavailable.

### MED-8: Body Scroll Lock Reference Counter Not Concurrent-Render Safe
- **File:** `src/lib/use-body-scroll-lock.ts`
- **Line:** 4–23
- **Description:** `openModalCount` is a module-level variable. In React 18+ concurrent rendering, multiple components may increment/decrement this counter in overlapping renders, causing the count to drift and leaving scroll permanently locked or unlocked.
- **Recommended Fix:** Use a ref inside a shared context or a state manager instead of a module-level variable. Alternatively, use a robust library like `body-scroll-lock`.

### MED-9: Sidebar "More" Drawer Scroll Lock Conflicts with Modal Scroll Lock
- **File:** `src/components/Sidebar.tsx`
- **Line:** 62–71
- **Description:** The "More" drawer sets `document.body.style.overflow = "hidden"` directly, while `MobileModal` and `Combobox` use `useBodyScrollLock`. These two mechanisms do not coordinate, so opening a modal from inside the "More" drawer and then closing it may re-enable body scroll while the drawer is still open.
- **Recommended Fix:** Make `Sidebar` use `useBodyScrollLock(isMoreOpen)` instead of manual `document.body.style.overflow` manipulation.

### MED-10: CreateSlipForm Driver Phone Missing Input Pattern Validation
- **File:** `src/components/forms/CreateSlipForm.tsx`
- **Line:** 327
- **Description:** The driver phone input uses `type="tel"` but has no `pattern` or `maxLength` attribute. On mobile, this allows arbitrary text entry and may show the wrong virtual keyboard on some devices.
- **Recommended Fix:** Add `pattern="[0-9+\-\s]{10,15}"` and `maxLength={15}` to match the `customerSchema` validation.

### MED-11: PostgreSQL Pool Disables SSL Certificate Verification
- **File:** `api/_db.ts`
- **Line:** 68–74
- **Description:** `ssl: { rejectUnauthorized: false }` disables TLS certificate verification. This makes the connection vulnerable to MITM attacks, especially on public Wi-Fi networks used by mobile devices.
- **Recommended Fix:** Use the Supabase Transaction Pooler with `sslmode=require` and provide the CA certificate. If `rejectUnauthorized: false` is necessary for local dev, gate it behind `process.env.NODE_ENV === 'development'`.

### MED-12: Barcode Scanner Module Install is Fire-and-Forget
- **File:** `src/lib/barcode.ts`
- **Line:** 27–30
- **Description:** `BarcodeScanner.installGoogleBarcodeScannerModule()` is called without awaiting or checking success. If the module fails to install (e.g., Google Play Services unavailable), the subsequent `scan()` call may throw an unhandled error.
- **Recommended Fix:** Await the install and verify `isGoogleBarcodeScannerModuleAvailable()` again before calling `scan()`. If still unavailable, show a user-friendly message.

### MED-13: Slip Status Workflow Lacks Transition Validation
- **File:** `src/context/ErpContext.tsx`
- **Line:** 922–937
- **Description:** `updateSlipStatus` allows any status change (e.g., `Cancelled → Pending`) without validating the workflow. This could allow accidental or malicious reactivation of cancelled slips, bypassing audit controls.
- **Recommended Fix:** Implement a state machine:
  ```ts
  const ALLOWED_TRANSITIONS: Record<SlipStatus, SlipStatus[]> = {
    Pending: ['Loaded', 'Cancelled'],
    Loaded: ['Tallied', 'Cancelled'],
    Tallied: ['Cancelled'],
    Cancelled: [],
  };
  ```

### MED-14: Invoice Status Workflow Lacks Transition Validation
- **File:** `src/pages/Invoices.tsx`
- **Line:** 39–45
- **Description:** `handleStatusChange` allows `Pending → Cancelled` and `Paid → Cancelled`, but also allows `Cancelled → Paid` or `Cancelled → Pending` via the desktop `<select>` dropdown. Cancelling an invoice releases slips, but reactivating it does not re-link them, causing orphaned slips.
- **Recommended Fix:** Implement the same state machine pattern for invoices:
  ```ts
  const ALLOWED: Record<InvoiceStatus, InvoiceStatus[]> = {
    Pending: ['Paid', 'Cancelled'],
    Paid: [],
    Cancelled: [],
  };
  ```

### MED-15: Zod Schema Coverage Gaps — Missing `Vehicle` and `CompanySettings` Validation
- **File:** `src/lib/validation.ts`
- **Line:** 1–111
- **Description:** `validation.ts` defines schemas for `customer`, `slip`, `transaction`, `invoice`, `employee`, `employeeTransaction`, and `login`, but there is no schema for `Vehicle` or `CompanySettings`. This means vehicle creation and settings updates are not validated at the form boundary.
- **Recommended Fix:** Add `vehicleSchema` and `companySettingsSchema` to `validation.ts` and use them in `CreateSlipForm` and `Settings` pages.

---

## Low Findings

### LOW-1: TypeScript Strictness Gaps
- **File:** `tsconfig.json`
- **Line:** 33–37
- **Description:** `noUnusedLocals: false`, `noUnusedParameters: false`, `noUncheckedIndexedAccess: false`, and `exactOptionalPropertyTypes: false` reduce type safety. The codebase contains several `any` usages and type assertions that stricter settings would catch.
- **Recommended Fix:** Enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` incrementally. Fix existing violations before enforcing.

### LOW-2: ESLint `no-explicit-any` is Only a Warning
- **File:** `eslint.config.js`
- **Line:** 32
- **Description:** `@typescript-eslint/no-explicit-any` is set to `'warn'`, not `'error'`. This allows `any` to slip into PRs without blocking CI.
- **Recommended Fix:** Change to `'error'`. Add explicit `eslint-disable` comments with justifications for any remaining `any` usages.

### LOW-3: README Sync Debounce Value is Outdated
- **File:** `README.md`
- **Line:** 147
- **Description:** The README states "debounced 1.5 s" but the actual debounce in `ErpContext.tsx` is 400ms. This inconsistency confuses developers reading the docs.
- **Recommended Fix:** Update README to reflect the current 400ms debounce.

### LOW-4: MOBILE_ASSESSMENT.md Action Items Incomplete
- **File:** `MOBILE_ASSESSMENT.md`
- **Line:** 324–344
- **Description:** The implementation roadmap checkboxes are all unchecked. Several items marked "LOW" effort (camera intent, biometric auth) are actually implemented in the codebase, indicating the document has not been updated since implementation.
- **Recommended Fix:** Mark completed items as done, remove obsolete items, and add new blockers discovered during this audit.

### LOW-5: Missing `AGENTS.md` File
- **File:** N/A
- **Description:** The project does not have an `AGENTS.md` file at the root or in `.kilo/`. This file is recommended for agent-specific guidance (build steps, conventions, preferences) separate from the human-facing README.
- **Recommended Fix:** Create `AGENTS.md` with build instructions, test commands, and coding conventions.

### LOW-6: Package Version is `0.0.0`
- **File:** `package.json`
- **Line:** 4
- **Description:** The version field is `0.0.0`, which provides no semantic information for releases or dependency tracking.
- **Recommended Fix:** Set to a meaningful version (e.g., `1.0.0`) and use `npm version` for releases.

### LOW-7: Vite Build Lacks Preload/Prefetch Hints for Mobile Chunks
- **File:** `vite.config.ts`
- **Line:** 24–42
- **Description:** The manual chunks (`pdf-libs`, `pages-finance`, `pages-ops`) are defined but there are no `preload` or `prefetch` link hints in `index.html`. On mobile with slow networks, navigating to Invoices or Ledger causes a visible delay while the chunk downloads.
- **Recommended Fix:** Add `<link rel="prefetch">` tags for critical chunks in `index.html`, or use Vite's `modulepreload` polyfill.

### LOW-8: PDF Generation Uses Scale 1 (Potentially Blurry on Thermal Printers)
- **File:** `src/lib/print-utils.ts`
- **Line:** 122
- **Description:** `html2canvas: { scale: 1 }` keeps memory usage low but produces lower-resolution output. Thermal printers at 203 DPI may render text as blurry or pixelated.
- **Recommended Fix:** For thermal slip generation, use `scale: 2` with a smaller canvas dimension, or switch to the jsPDF-only path (`createSlipPdfBlob`) which already avoids html2canvas.

### LOW-9: Login Email Normalization May Conflict with Supabase Case Sensitivity
- **File:** `src/components/Login.tsx`
- **Line:** 74
- **Description:** `email.trim().toLowerCase()` is used for login, but Supabase Auth preserves the original email case in some configurations. If a user was created with mixed case and the admin later edits the email to lowercase in `companySettings`, the `resolveOperatorName` lookup in `CreateSlipForm` may fail to match.
- **Recommended Fix:** Normalize emails consistently at creation time and store only lowercase in `companySettings.users`.

### LOW-10: NFC Scan Timeout Cleanup Does Not Handle `stopScanning` Rejection
- **File:** `src/lib/nfc.ts`
- **Line:** 46
- **Description:** `CapacitorNfc.stopScanning().catch(() => {})` silently ignores errors. If the NFC adapter is in a bad state, subsequent scans may fail until the app is restarted.
- **Recommended Fix:** Log the error (even at `console.warn` level) so debugging is possible. Consider adding a retry with exponential backoff for `startScanning`.

### LOW-11: `server.ts` PATCH Deletion Uses Dynamic Table Names Without Strict Validation
- **File:** `server.ts`
- **Line:** 409–416
- **Description:** While `API_TABLES` is used, the `table` variable from `Object.entries(deletions)` is implicitly trusted after the `Set` check. If `API_TABLES` is ever mutated at runtime (e.g., via prototype pollution), the check is bypassed.
- **Recommended Fix:** Use a `Map` or frozen `Set` for `API_TABLES`, and additionally validate the table name against a regex like `/^[a-zA-Z]+$/`.

---

## Appendix A: Severity Classification

| Severity | Definition |
|----------|------------|
| **Critical** | Data loss, security breach, crash, or financial calculation error |
| **High** | Major UX blocker, sync failure, or auth bypass |
| **Medium** | Performance issue, minor bug, or missing validation |
| **Low** | Polish, code smell, or documentation gap |

## Appendix B: Files Audited

- `src/lib/capacitor.ts`
- `src/lib/biometrics.ts`
- `src/lib/nfc.ts`
- `src/lib/barcode.ts`
- `src/lib/camera.ts`
- `src/lib/escpos.ts`
- `src/lib/print-utils.ts`
- `src/lib/whatsapp-share.ts`
- `src/lib/export-utils.ts`
- `src/lib/utils.ts`
- `src/lib/validation.ts`
- `src/lib/employee-ledger.ts`
- `src/lib/secure-storage.ts`
- `src/lib/session.ts`
- `src/lib/supabase.ts`
- `src/lib/use-body-scroll-lock.ts`
- `src/lib/device-info.ts`
- `src/context/ErpContext.tsx`
- `src/components/Layout.tsx`
- `src/components/Sidebar.tsx`
- `src/components/Login.tsx`
- `src/components/SetupAdminScreen.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/ui/MobileModal.tsx`
- `src/components/ui/MobilePrimitives.tsx`
- `src/components/ui/Combobox.tsx`
- `src/components/ui/OfflineIndicator.tsx`
- `src/components/forms/CreateSlipForm.tsx`
- `src/components/forms/EditSlipForm.tsx`
- `src/components/forms/PrintInvoiceModal.tsx`
- `src/components/forms/PrintSlipModal.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Dispatch.tsx`
- `src/pages/Invoices.tsx`
- `src/pages/Customers.tsx`
- `src/pages/Employees.tsx`
- `src/pages/Ledger.tsx`
- `src/pages/Daybook.tsx`
- `src/pages/Settings.tsx`
- `src/pages/AuditLog.tsx`
- `src/pages/Vehicles.tsx`
- `src/App.tsx`
- `src/types.ts`
- `src/main.tsx`
- `server.ts`
- `api/data.ts`
- `api/admin-users.ts`
- `api/_db.ts`
- `api/_supabase-admin.ts`
- `api/_types.ts`
- `capacitor.config.ts`
- `vite.config.ts`
- `tsconfig.json`
- `eslint.config.js`
- `package.json`
- `README.md`
- `MOBILE_ASSESSMENT.md`
- `CLAUDE.md`
- `AGENTS.md` (noted as missing)
