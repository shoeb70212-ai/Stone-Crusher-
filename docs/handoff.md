# Stone Crusher ERP - Project Handoff Documentation

## 1. Project Overview
**CrushTrack (Stone Crusher ERP)** is a comprehensive, cloud-native enterprise resource planning application designed specifically for stone crushing and mineral businesses. It handles dispatch operations (slips/tokens), invoicing (Cash and GST), customer ledgers, vehicle tracking, and financial reporting.

## 2. Technical Architecture

### Frontend (Client-Side)
*   **Framework**: React 18 + Vite.
*   **Styling**: Tailwind CSS (with responsive mobile-first utilities).
*   **Icons**: Lucide React.
*   **State Management**: React Context (`ErpContext.tsx`) acting as the global state and source-of-truth.
*   **PDF Generation**: `html2pdf.js` (executed entirely on the client-side browser to reduce server payload).

### Backend (Server-Side) & Database Handling
*   **Hosting**: Vercel Serverless Functions (`api/data.ts`).
*   **Database Engine**: Supabase PostgreSQL.
*   **Connection Driver**: `pg` (Node Postgres) utilizing a connection pool.
*   **How Data is Stored**: 
    - The PostgreSQL database acts as the single source of truth.
    - Data is stored in relational tables: `slips`, `invoices`, `customers`, `vehicles`, `transactions`.
    - Every table relies on standard foreign key constraints (e.g., `slips.customer_id` references `customers.id`) to maintain referential integrity.
*   **How Data is Handled (The Flow)**: 
    1.  **Frontend State**: The React application maintains its own in-memory state (`ErpContext.tsx`) for instant UI feedback (Optimistic UI).
    2.  **Serverless API**: When a record is added or modified, the frontend executes an asynchronous HTTP POST request to `/api/data`.
    3.  **SQL Execution**: The Vercel function parses the request, connects to the Supabase PostgreSQL database using the `DATABASE_URL` pool, and executes raw SQL queries.
    4.  **Transactions**: Modifications use SQL `BEGIN` and `COMMIT` blocks to guarantee that either all changes succeed (e.g., creating an invoice and updating slip statuses) or none do.
*   **Legacy Note**: The project was originally built on `better-sqlite3` and `express` (`server.ts`). This was completely deprecated in favor of the Vercel serverless + Postgres architecture to allow for scalable cloud deployment.

## 3. Core Design Decisions & Problem Solving

### A. Vercel Serverless Migration
**Problem**: Vercel does not support continuous running background servers (like standard Express.js apps). It requires stateless, short-lived functions.
**Solution**: We abandoned the continuous `server.ts` file and migrated the entire API into a single Vercel Serverless Function at `api/data.ts`. The frontend sends queries to `/api/data` which the function interprets, executes against Postgres, and returns.

### B. Client-Side PDF Generation
**Problem**: Generating PDFs on the server using Puppeteer requires a headless Chromium binary. This binary far exceeds Vercel's strict 50MB limit for serverless functions, causing deployments to crash.
**Solution**: We shifted all PDF rendering to the user's browser. We use `html2pdf.js` in `src/lib/print-utils.ts` to capture the hidden DOM elements of invoices and slips and convert them to PDFs instantly.

### C. Native Mobile UX & Print Scaling
**Problem**: The application felt like a squished desktop website on mobile phones, and PDF generation from mobile browsers resulted in improperly scaled (squished) documents because `html2pdf.js` captures the viewport dimensions.
**Solution**: 
*   Implemented a **Bottom Navigation Tab Bar** in `Sidebar.tsx` for primary mobile navigation, abandoning the top hamburger menu.
*   Added `user-scalable=no` and `viewport-fit=cover` to `index.html` to prevent accidental zooming.
*   Added CSS rules to disable the bouncy "pull-to-refresh" effect on mobile browsers.
*   Updated all Form Modals (Add Customer, Generate Invoice) to expand to 100% full-screen width/height on mobile devices, preventing padding constraints.
*   **PDF Layout Fix**: Wrapped the invoice and slip print areas in a horizontal scroll container (`overflow-auto`) and forced them to use fixed pixel widths (e.g., `794px` for A4). This ensures that `html2pdf.js` generates documents identically to the desktop experience, regardless of the physical screen size of the mobile device.
*   Tables on mobile are hidden and replaced with responsive "Card Lists".

### D. Synchronization Logic
*   The application operates on an **"Optimistic UI"** model.
*   When a user creates a slip, it updates the React Context (UI) immediately, and asynchronously fires a background `fetch` to `/api/data` to sync with PostgreSQL.

## 4. Application Modules & Screens

### 1. Dashboard (`Dashboard.tsx`)
*   **Purpose**: High-level overview.
*   **Features**: Displays today's dispatch volume, pending tallies, recent transactions, and revenue metrics.

### 2. Dispatch / Slips (`Dispatch.tsx`)
*   **Purpose**: Core operational area for generating loading tokens.
*   **Features**:
    *   Tracks Vehicle, Driver, Customer, Material, and Measurements (Volume/Brass or Weight/Tons).
    *   Statuses: Pending (created) -> Loaded (truck filled) -> Tallied (weight/volume confirmed).
    *   Printable thermal tokens (80mm and 58mm).

### 3. Invoices (`Invoices.tsx`)
*   **Purpose**: Converting slips into formal billing documents.
*   **Features**:
    *   Supports two modes: **Cash Invoice** (informal) and **GST Invoice** (formal, with SGST/CGST calculations).
    *   Highly professional, GST-compliant printable A4 templates containing Bank Details, Terms & Conditions, and Authorized Signatory sections.

### 4. Customers & Ledger (`Customers.tsx` & `Ledger.tsx`)
*   **Purpose**: Financial tracking.
*   **Features**:
    *   **Customer Statement**: Dynamically calculates running balances by reading all associated invoices, slips, and payments.
    *   **Global Ledger**: Tracks all business Income and Expenses outside of just customer billing (e.g., fuel costs, salaries).

### 5. Settings (`Settings.tsx`)
*   **Purpose**: System configuration.
*   **Features**:
    *   Manage Company Profile (Name, Address, Bank Details, Logo).
    *   Set Master Material Pricing (e.g., 10mm, 20mm, Dust).
    *   Manage customizable Terms & Conditions for invoices.

## 5. Deployment Instructions

1.  **Environment Variables**:
    *   Set `DATABASE_URL` in Vercel. Example: `postgresql://postgres:password@db.supabase.co:5432/postgres`
2.  **Deployment**:
    *   Pushing to the `main` branch of the GitHub repository automatically triggers a Vercel production build.
3.  **Local Development**:
    *   Because the app uses Vercel Serverless Functions, standard `npm run dev` (Vite) will not serve the API correctly.
    *   You must use the Vercel CLI: Run `npx vercel dev` to spin up a local emulator that serves both the Vite frontend and the `api/data.ts` backend.
