# Project Handoff: CrushTrack ERP

## 1. Current State
The project is a production-stabilized ERP for stone crushers. It has transitioned from a local-first SQLite architecture to a cloud-ready PostgreSQL/Vercel architecture, but now includes a **local developer simulator** to allow offline work.

## 2. Development Workflow

### Local Development (Simulated)
- **Command**: `npm run dev`
- **Mechanism**: Runs `server.ts` which uses a local `local-data.json` file as the database.
- **Benefits**: Fast, offline-capable, and preserves all your data without needing PostgreSQL.

### Production Deployment
- **Backend**: Hosted on Vercel (`api/data.ts`).
- **Database**: PostgreSQL (Supabase/Neon).
- **Environment Variable**: Requires `DATABASE_URL` in Vercel settings.
- **Sync Strategy**: The frontend sends the entire application state in a single payload to `/api/data`, which then overwrites the corresponding tables in a single SQL transaction.

## 3. Key Technical Decisions

### Dimension Parsing (`Feet.Inches`)
In the stone crusher industry, `5.6` means **5 feet 6 inches** (5.5 feet). 
- **Utility**: `parseFeetInches` in `src/lib/utils.ts`.
- **Usage**: Always use this when calculating Volume (Brass). Never use `parseFloat`.

### Invoice Numbering
- The system prevents numbering collisions by scanning the existing database for the highest numeric suffix for a given invoice type (GST/CASH) and incrementing it. 
- Deleted invoices no longer cause the system to reuse old numbers if a higher one exists.

### PDF Generation
- **Library**: `html2pdf.js`.
- **Method**: Client-side rendering.
- **Reason**: Bypasses Vercel's 50MB execution limit and provides instant previews without server round-trips.

## 4. Pending Features / Roadmap

- [ ] **Vehicle CRUD**: Full integration of the vehicle master data into the dispatch forms.
- [ ] **Auth Layer**: Secure the app with verified email/password login.
- [ ] **Optimistic Sync**: Refactor the sync logic to handle partial updates (delta-sync) to improve performance for large datasets.
- [ ] **Soft Deletions**: Ensure historical data integrity by marking master data as "Inactive" instead of deleting it.
- [ ] **Capacitor Mobile App**: Finalize the Android wrapper.

## 5. Troubleshooting
- **Port Conflict**: If port 5173 is busy, the server will error. Close any existing Vite processes.
- **Data Reset**: To reset the local database, simply delete `local-data.json` and restart the server.
