# CrushTrack Mobile (Android) Assessment

## Executive Summary

**Scope:** Identify which CrushTrack ERP features are suitable for mobile Android deployment before bundling.

**Key Finding:** The core dispatch workflow (Slip creation) is highly mobile-friendly. ~70% of the system can be ported with existing architecture; 30% needs thoughtful adaptation.

---

## 📱 TOP 5 MOBILE-CRITICAL FEATURES (Tier 1)

### 1. **Dispatch Slip Entry** ⭐⭐⭐⭐⭐
**Criticality:** HIGHEST — Core field operation, happens 50+ times/day

**What Mobile Users Need:**
- Quick slip creation form (vehicle, material, dimensions, quantity)
- Dimension input via numeric keypad (not web browser keyboard)
- Parse `parseFeetInches()` for feet-inch-to-decimal conversion (e.g., "5.6" = 5ft 6in)
- Photo/barcode capture for invoice attachments
- Offline-first: create slip locally, sync when connectivity returns

**Current State:** React form in `Dispatch.tsx`; works on mobile browser but not optimized
**Effort:** LOW — Form reuse, add camera intent
**Blocker:** None

---

### 2. **Vehicle & Driver Lookup** ⭐⭐⭐⭐
**Criticality:** HIGH — Needed for every slip

**What Mobile Users Need:**
- Search by vehicle number or driver name
- Autocomplete pre-fills measurement defaults from `Vehicle.measurement`
- Soft-delete handling: filter `isActive !== false`
- GPS geolocation (optional: prove vehicle on-site)

**Current State:** Dropdown in Dispatch page; works on mobile
**Effort:** LOW — Already searchable list
**Blocker:** None

---

### 3. **Quick Payment Recording** ⭐⭐⭐⭐
**Criticality:** HIGH — Cash-on-delivery common at quarries

**What Mobile Users Need:**
- Record amount paid against slip (field `Slip.amountPaid`)
- Update customer balance in real-time
- Confirmation: "₹2,500 recorded for vehicle ABC-123"
- Offline: queue payment, sync later

**Current State:** Partial in Dispatch; not a dedicated mobile flow
**Effort:** MEDIUM — New mobile form, backend validation
**Blocker:** None

---

### 4. **Customer Ledger (Read-Only)** ⭐⭐⭐⭐
**Criticality:** HIGH — Drivers/operators ask "what's their balance?"

**What Mobile Users Need:**
- Show current customer balance (`getCustomerBalance()` function)
- Recent slips (last 10 unbilled)
- Invoices due and paid
- Formula: `balance = openingBalance + unbilledSlipTotal + invoiceTotal - paymentCredits`

**Current State:** Customers page, Ledger page; read-only, works on mobile
**Effort:** LOW — Reuse existing calculations
**Blocker:** None

---

### 5. **Task Checklist (Dashboard)** ⭐⭐⭐⭐
**Criticality:** MEDIUM-HIGH — Daily workflow start

**What Mobile Users Need:**
- Show 5-10 tasks for the day
- Check off completed tasks (e.g., "Load vehicle ABC-123")
- Offline sync

**Current State:** Dashboard shows tasks; works on mobile
**Effort:** LOW — Already exists
**Blocker:** None

---

## 📊 DATA SYNC STRATEGY

### What Syncs Mobile ↔ Server

**Always Mobile → Server (write):**
- New slips
- Payments recorded
- Task completion
- Attendance/timestamps

**Always Mobile ← Server (read):**
- Vehicles (master data, rarely changes)
- Materials (pricing, rarely changes)
- Open invoices
- Customer contact info

**Bidirectional (sync both ways):**
- Slips (created mobile, edited desktop)
- Tasks (created desktop, checked mobile)

### Offline Strategy

**What works offline:**
- Create/edit slips locally
- Record payments
- Mark tasks complete
- View cached customer balances

**What needs connectivity:**
- Sync to server (every 1-2 min background job)
- Fetch updated master data (vehicles, materials)
- View invoices (larger payloads, sync on demand)

**Conflict Resolution:**
- Server wins on conflict (last-write-wins, timestamp-based)
- User sees warning: "Slip edited on desktop; your changes discarded"

---

## 🔴 TIER 2 (Medium Priority, Mobile-Friendly but Not Field-Critical)

### Customer Management
- Add/edit/soft-delete customers
- Moderate priority; less frequent than dispatch
- All CRUD operations work on mobile

### Vehicle Management
- Add/edit vehicles
- Pre-fill measurement defaults
- Soft-delete inactive vehicles
- Works on mobile, not a field-critical flow

### Basic Reporting
- Daily slip count
- Total collected (cash)
- Top materials by volume
- Works mobile, offline (cached data)

---

## 🟡 TIER 3 (Low Priority, Better on Desktop)

### Advanced Reporting (Ledger, Daybook)
- Complex filtering and date ranges
- 50-100 row tables
- Better on desktop; could add mobile-lite summary

### Invoice Management
- Generate invoices from slips
- Print formatting (A4/Thermal)
- Not field-critical; keep on desktop

### Employee Payroll & Accounting
- Complex salary/advance calculations
- Not mobile use case
- Desktop only

### Settings & Audit Logs
- Company config
- User management
- Admin only; desktop

---

## ✅ QUICK WINS (Implement Before Bundling Android)

1. **Offline Slip Queue** (2 hrs)
   - Persist new slips to `localStorage` if sync fails
   - Auto-retry every 30s

2. **Biometric Auth** (3 hrs)
   - Integrate `@capacitor-community/biometric`
   - Replace password entry on mobile login

3. **Camera Intent** (2 hrs)
   - Attach invoice photo via `@capacitor/camera`
   - Store as base64 in slip `attachmentUri`

4. **Quick Pay Form** (3 hrs)
   - New component: record payment against slip
   - Update balance immediately

5. **Task Checklist Widget** (1 hr)
   - Dedicated mobile Home screen

---

## ⚠️ KNOWN COMPLEXITY (Hardest Features to Port)

### 1. **Dimension Input (`parseFeetInches`)**
   - **Why hard:** Custom format (feet-inch notation) non-standard on mobile
   - **Solution:** Dedicated numeric input component with fraction support
   - **Time:** 2-3 hrs

### 2. **Soft Deletions Filter**
   - **Why hard:** Need to remember context when filtering vehicles/materials
   - **Solution:** Add `showInactive` toggle to each list, persist to localStorage
   - **Time:** 1 hr

### 3. **Customer Balance Calculation**
   - **Why hard:** Multi-step formula, linked to unbilled slips + invoices
   - **Solution:** Pre-compute on backend, cache on mobile
   - **Time:** 2 hrs

### 4. **Print Formatting**
   - **Why hard:** A4/Thermal slip layouts use `@media print` CSS
   - **Solution:** Skip print on mobile; export PDF via `@react-pdf/renderer` or WebView
   - **Time:** 4-6 hrs (if needed)

---

## 🏗️ CRITICAL: MOBILE RUNTIME DECISION

⚠️ **IMPORTANT FINDING:** Your codebase **already has Capacitor integration**.

**Evidence:**
- `src/lib/capacitor.ts` — `isNative()` runtime detection
- `src/lib/biometrics.ts` — native biometric credential storage
- `ErpContext.tsx` imports biometrics and Capacitor network status
- App already handles badge/notifications via Capacitor

### Option A: Extend Existing Capacitor Build (RECOMMENDED)
```
Current Web App + Capacitor Plugins
    ├─ @capacitor/camera (photo attach)
    ├─ @capacitor/geolocation (GPS tracking)
    ├─ @capacitor/preferences (or @capacitor-community/sqlite for local DB)
    ├─ @capacitor/network (auto-sync when online)
    └─ @capacitor/biometric (already in code)
    ↓
Single codebase → Android APK + Web
```

**Advantages:**
- ✅ Zero business-logic duplication (ErpContext, parseFeetInches, balance formula stay in TS)
- ✅ Single source of truth for data sync
- ✅ Audit logging preserved automatically
- ✅ 3-week timeline instead of 8-10 weeks
- ✅ Bug fixes and features land on all platforms at once

**Effort:** +5 days (add camera, GPS, SQLite, improve UX for touch)

### Option B: Native Kotlin (Requires Architectural Decisions)
```
Android App (Kotlin + Jetpack Compose)
    ↓ Must reimplement:
    ├─ getCustomerBalance() logic
    ├─ parseFeetInches() formula
    ├─ Soft-delete filtering
    ├─ Sync queue (delta merge, idempotency, conflict resolution)
    ├─ Audit logging (actor resolution, timestamp handling)
    └─ Invoice generation logic (if enabled)
    ↓
Risk: Business logic drifts between platforms → financial records diverge
```

**Advantages:**
- ✅ Native UI performance
- ✅ Offline-first architecture baked in

**Disadvantages:**
- ❌ 8-10 week timeline
- ❌ Two codebases for the same business logic
- ❌ 2x bug surface area
- ❌ Must keep Kotlin and TypeScript implementations in sync forever
- ❌ Hand-porting `getCustomerBalance` and praying it stays identical

**VERDICT:** Unless you have **measured proof** that Capacitor's web UI on native runtime is too slow, choose **Option A: Extend Capacitor**. Native Kotlin is justified only for UX problems you cannot solve in the web layer, which have not been demonstrated.

If Kotlin is non-negotiable, you MUST:
1. Factor out business logic to a shared library (TypeScript-to-Kotlin codegen or server-side API)
2. Add comprehensive golden-file tests comparing mobile ↔ desktop balance calculations
3. Author an ADR justifying the divergence

---

## ✅ RECOMMENDED: CAPACITOR-BASED MOBILE STACK

```
Android App (Web + Capacitor)
    ↓
Shared React Components
    ├─ Dispatch slip form (dimension input, camera attach)
    ├─ Payment quick entry
    ├─ Customer balance lookup
    ├─ Task checklist
    └─ Enhanced touch UX (larger buttons, numeric keypad)
    ↓
ErpContext (shared business logic)
    ├─ getCustomerBalance() — unchanged
    ├─ parseFeetInches() — unchanged
    ├─ Sync queue (improvements needed, see below)
    ├─ Audit logging — unchanged
    └─ Soft-delete filtering — unchanged
    ↓
Capacitor Plugins (new)
    ├─ @capacitor/camera (slip photo attachment)
    ├─ @capacitor/geolocation (optional GPS on slip creation)
    ├─ @capacitor-community/sqlite (local DB replaces localStorage)
    ├─ @capacitor/network (detect connectivity, trigger sync)
    └─ @capawesome/capacitor-badge (pending slips count)
    ↓
Express API (improvements needed)
    ├─ Add versioning to entities for conflict detection
    ├─ Add idempotency keys for retried requests
    ├─ Add JWT auth (replace shared API_SECRET)
    ├─ Add pagination/filtering (?since=timestamp)
    └─ Add tombstone retention policy
```

**Timeline:** 3 weeks (MVP: slip creation, payment, offline sync, biometric auth)

---

## 📋 IMPLEMENTATION ROADMAP

### Phase 1: MVP (2-3 days)
- [ ] Login screen (email + biometric option)
- [ ] Slip creation (vehicle, material, dimensions, quantity)
- [ ] Payment quick entry
- [ ] Customer balance lookup
- [ ] Offline queue + background sync

### Phase 2: Polish (2 days)
- [ ] Camera intent (photo attach)
- [ ] Task checklist
- [ ] Dimension input component
- [ ] Error messages & retry logic

### Phase 3: Advanced (1 week)
- [ ] Vehicle management (CRUD)
- [ ] Customer management (CRUD)
- [ ] Basic reports (daily slip count, cash collected)
- [ ] Sync conflict resolution UI

---

## 🔗 API CONTRACTS (No Backend Changes Needed)

### GET /api/data
**Returns:** Full `local-data.json` (all entities)
```json
{
  "customers": [...],
  "slips": [...],
  "vehicles": [...],
  "invoices": [...],
  "transactions": [...],
  "tasks": [...],
  "companySettings": {...}
}
```

### PATCH /api/data
**Accepts:** Delta updates
```json
{
  "updates": {
    "slips": [{ id: "...", totalAmount: 5000, ... }],
    "tasks": [{ id: "...", completed: true }]
  },
  "deletions": {
    "slips": ["id1", "id2"]
  }
}
```

---

## 🔴 CRITICAL BLOCKERS (Must Fix Before Mobile Launch)

### 1. Sync Conflict Resolution is Unsafe (HIGH RISK)
**Issue:** Server uses last-write-wins for all entities. This causes silent financial loss:
- Two users edit same slip's `totalAmount` → lower amount wins
- Mobile records payment while desktop cancels slip → payment orphaned
- Admin updates `companySettings` while mobile saves stale settings → settings rollback

**Current Code:** `server.ts:105-122` (`upsertById`) blindly overwrites with incoming payload

**Fix Required:** Add version field to mutable entities. Server rejects stale updates if `incoming.version < stored.version`.

**Timeline:** 1 day

---

### 2. No Request Idempotency (HIGH RISK)
**Issue:** PATCH endpoint has no deduplication. Mobile retries a failed sync → records double-write.

**Fix Required:** Accept `Idempotency-Key` header, store key→result mapping for 24h.

**Timeline:** 1 day

---

### 3. API Authentication is Weak (SECURITY RISK)
**Issue:** Single shared `API_SECRET` means every mobile app exposes the key. Compromised key = full database access.

**Fix Required:** Replace `x-api-key` with JWT validation using existing Supabase tokens.

**Timeline:** 2 days

---

### 4. Tombstone Resurrection Bug (MEDIUM RISK)
**Issue:** Server applies updates before deletions in same PATCH. Mobile updates deleted record → resurrection.

**Fix Required:** Track soft-deleted IDs with 7-day expiry. Reject updates on tombstoned records.

**Timeline:** 1 day

---

### 5. No Pagination on GET /api/data (PERFORMANCE RISK)
**Issue:** Server returns entire `local-data.json` (10MB+) every load. Mobile on 3G will timeout.

**Fix Required:** Add `?since=<iso-timestamp>` param for incremental sync.

**Timeline:** 2 days

---

## ✨ VALIDATION CHECKLIST (Post-Fix)

Before bundling Android:
- [ ] **Versioning added:** Entities have `version` field, server rejects stale updates
- [ ] **Idempotency working:** Retry with same key returns cached response
- [ ] **JWT auth active:** API validates Supabase token, not shared secret
- [ ] **Tombstones respected:** Update rejected on deleted record
- [ ] **Pagination works:** GET /api/data?since=timestamp returns only delta
- [ ] **Offline works:** Create slip with no connectivity, syncs when online
- [ ] **Dimension input:** "5.6" parses as 5ft 6in → brass volume calculates correctly
- [ ] **Soft deletes:** Inactive vehicles don't show in dropdown
- [ ] **Customer balance:** Matches desktop Ledger page
- [ ] **Payment recording:** Updates balance immediately
- [ ] **Biometric auth:** Faster than password on second login
- [ ] **Camera attach:** Photo saves and syncs to server
- [ ] **Auto-sync:** Changes queue and sync without user clicking "Save"

---

## 📞 STAKEHOLDER SIGN-OFF

This assessment assumes:
1. Mobile app is **read-write** for slips/payments, **read-only** for customers/invoices
2. Desktop app remains the source of truth for complex operations (accounting, payroll)
3. API remains Express + flat-file JSON (no major backend rewrite)
4. Target platform: **Android 8.0+** (Kotlin + Jetpack Compose or React Native)

**Estimated Timeline:** 3-4 weeks (MVP to production-ready)
