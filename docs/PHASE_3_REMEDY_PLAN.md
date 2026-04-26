# Phase 3 - Actionable Remedy Plan

This document outlines the proposed architectural, security, and feature transformations required to turn the current React+LocalStorage prototype into a production-grade, full-stack Enterprise Resource Planning (ERP) platform.

## 1. Storage & Persistence Migration (Critical)
**Issue:** The app currently relies on the browser's `localStorage` via the `useErp` context hooks. `localStorage` is completely insecure, not synced across devices, easily cleared by users by mistake, and has a strict 5MB quota which will break the app once a few hundred slips/invoices are generated. 
**Remedy:**
- Migrate data layer to a structured database like **PostgreSQL** or a robust NoSQL like **Firebase Firestore**.
- Implement server-side pagination and infinite scroll for the `Ledger` and `Daybook` pages to prevent pulling thousands of transactions to the client at once.

## 2. Real Authentication & Authorization (Critical)
**Issue:** User roles (`Admin`, `Manager`, `Partner`) are stored in plaintext inside `localStorage`. Any employee can open Developer Tools, change `erp_userRole` to `Admin`, and gain full access to Settings and financial Ledgers.
**Remedy:**
- Implement real authentication (e.g., using Firebase Auth, Supabase Auth, or standard JWTs).
- Protect sensitive API routes and GraphQL resolvers via Server-Side Authorization Checks.
- Bind operations to user UUIDs (e.g., who actually signed off on a Dispatch Slip).

## 3. The "Slip-to-Invoice" Pipeline (Workflow Upgrade)
**Issue:** During Phase 1, it was discovered that `Slips` and `Invoices` are entirely disconnected. Users manually re-type items into Invoices, risking double-counting in the Ledger if the business doesn't strictly adhere to a manual process of ignoring one or the other.
**Remedy:**
- Introduce a relational link inside the Invoice schema: `SlipId[]`.
- In the "Customers" or "Dispatch" UI, allow users to "Select Un-invoiced Slips" -> "Generate Invoice".
- Once invoiced, Slips should be marked as `Billed` to prevent them from being billed twice.
- Update `getCustomerBalance` to ensure `Billed` slips are safely ignored to let the newly generated `Invoice` take over the monetary debt representation.

## 4. Double-Entry Accounting
**Issue:** The current Ledger is a single-entry cashbook. An "Expense" transaction deducts cash but doesn't debit an expense category formally. 
**Remedy:**
- Establish a proper "Chart of Accounts" with Assets (Cash, Bank), Liabilities, Equity, Revenue, and Expenses.
- An invoice should debit Accounts Receivable and credit Revenue.
- A Payment from a customer should debit Cash/Bank and credit Accounts Receivable.

## 5. Robust PDF Generation & Printing
**Issue:** Client-side HTML5 canvas to `jsPDF` works for simple layouts, but struggles significantly with varied screen resolutions, font embeddings, and multi-page tables.
**Remedy:**
- Shift to server-side PDF generation using Puppeteer/Playwright or a specialized library like `pdfmake` / `React-PDF`.
- Ensure accurate scaling for standard Desktop Printers (A4) and Thermal POS Printers (58mm/80mm) without relying on DOM manipulation.

## Next Steps
This plan represents the architectural shift necessary for production. Implementation involves setting up a Backend (Node.js/Express) and migrating the core domain interfaces from `src/types.ts` into database schemas (Prisma / Drizzle ORM).
