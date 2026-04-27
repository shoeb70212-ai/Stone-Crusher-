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

## 4. Current Status of Features

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Auth Layer** | ✅ Done | Secured with role-based routing. |
| **Delta Sync** | ✅ Done | PATCH based, collision-safe. |
| **Vehicle Master** | ✅ Done | Dynamic selection in Dispatch. |
| **Material Master** | ✅ Done | Dynamic pricing and activation. |
| **PDF Billing** | ✅ Done | Supports Thermal & A4 formats. |
| **Mobile App** | 🚧 Pending | Capacitor wrapping required. |

## 5. Next Steps for Development
1. **Admin User Management**: Add a screen under Settings to allow the Admin to manage the `companySettings.users` array (Add/Delete/Deactivate).
2. **Production Deployment Check**: After deploying to Vercel, monitor the PostgreSQL logs to ensure the dynamic `PATCH` queries are performing efficiently under load.
3. **Ledger Filters**: Add date-range filtering to the Ledger and Customer Statement views to handle high-volume accounts.

---
*End of Handoff - Documented by Antigravity AI*
