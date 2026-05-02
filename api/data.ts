/**
 * Vercel Serverless API handler for CrushTrack ERP.
 *
 * Provides GET / PATCH / POST endpoints against a PostgreSQL database
 * (e.g. Supabase). This file is only active when deployed to Vercel —
 * local development uses `server.ts` with a flat JSON file instead.
 *
 * Schema migrations run automatically on each cold start via `initDb()`.
 */

import { Pool, PoolClient } from "pg";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const RATE_LIMIT = 100; // Conservative limit for serverless

// Allowed origins — Vercel deployment + local dev
const ALLOWED_ORIGINS = new Set([
  'https://stone-crusher.vercel.app',
  'http://localhost:5173',
  'http://localhost:8081',
]);

// Allowed table names — prevents SQL injection via dynamic table routing
const TABLE_NAMES: Record<string, string> = {
  customers: 'customers',
  vehicles: 'vehicles',
  slips: 'slips',
  transactions: 'transactions',
  invoices: 'invoices',
  tasks: 'tasks',
  auditLogs: 'audit_logs',
};

const ALLOWED_TABLES = new Set(Object.keys(TABLE_NAMES));

function dbTableName(table: string): string | null {
  return TABLE_NAMES[table] ?? null;
}

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers['origin'] as string | undefined;
  // Capacitor apps have no Origin header — allow them through.
  if (!origin) return '*';
  return ALLOWED_ORIGINS.has(origin) ? origin : 'null';
}

function getRateLimitKey(req: VercelRequest): string {
  return `rate_${(req.headers['x-forwarded-for'] as string || req.headers['client-ip'] || 'unknown').split(',')[0].trim()}`;
}

// In-memory store (note: resets on cold starts in serverless)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(req: VercelRequest): boolean {
  const key = getRateLimitKey(req);
  const now = Date.now();
  
  let record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

/**
 * Pool configured for Supabase Supavisor in **Transaction mode**.
 *
 * Key settings for serverless (Vercel) compatibility:
 * - `ssl.rejectUnauthorized: false` — Supabase uses a self-signed cert.
 * - `statement_timeout` — prevents runaway queries from holding connections.
 * - `max: 5` — serverless functions should keep pool small; Supavisor
 *   handles the heavy lifting of connection multiplexing.
 *
 * IMPORTANT: The DATABASE_URL must be the **Transaction Pooler** string
 * from Supabase (port 6543, host *.pooler.supabase.com), NOT the direct
 * connection (port 5432, host db.*.supabase.co). Direct connections
 * require IPv6 which Vercel's serverless runtime does not support.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

// ---------------------------------------------------------------------------
// Schema initialisation & migrations
// ---------------------------------------------------------------------------

let dbInitialized = false;

/**
 * Creates all tables if they don't exist and runs additive migrations.
 * Safe to call multiple times — guarded by `dbInitialized` flag and
 * `IF NOT EXISTS` / `IF NOT EXISTS` clauses.
 */
async function initDb() {
  if (dbInitialized) return;
  console.log("Initialising database schema…");

  try {
    // ---- Core tables -------------------------------------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id                TEXT PRIMARY KEY,
        name              TEXT,
        phone             TEXT,
        address           TEXT,
        gstin             TEXT,
        "openingBalance"  DOUBLE PRECISION DEFAULT 0,
        "isActive"        BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id                        TEXT PRIMARY KEY,
        "vehicleNo"               TEXT,
        "ownerName"               TEXT,
        "ownerPhone"              TEXT,
        "driverName"              TEXT,
        "driverPhone"             TEXT,
        "defaultMeasurementType"  TEXT,
        measurement               JSONB,
        "isActive"                BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS slips (
        id                TEXT PRIMARY KEY,
        date              TEXT,
        "vehicleNo"       TEXT,
        "driverName"      TEXT,
        "driverPhone"     TEXT,
        "materialType"    TEXT,
        "deliveryMode"    TEXT,
        "measurementType" TEXT,
        measurement       JSONB,
        quantity          DOUBLE PRECISION,
        "ratePerUnit"     DOUBLE PRECISION,
        "freightAmount"   DOUBLE PRECISION,
        "totalAmount"     DOUBLE PRECISION,
        "amountPaid"      DOUBLE PRECISION,
        "customerId"      TEXT,
        status            TEXT,
        notes             TEXT,
        "operatorName"    TEXT,
        "loaderName"      TEXT,
        "invoiceId"       TEXT
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id            TEXT PRIMARY KEY,
        date          TEXT,
        type          TEXT,
        amount        DOUBLE PRECISION,
        category      TEXT,
        description   TEXT,
        "customerId"  TEXT,
        "slipId"      TEXT
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id            TEXT PRIMARY KEY,
        "invoiceNo"   TEXT,
        date          TEXT,
        "customerId"  TEXT,
        type          TEXT,
        items         JSONB,
        "subTotal"    DOUBLE PRECISION,
        cgst          DOUBLE PRECISION,
        sgst          DOUBLE PRECISION,
        total         DOUBLE PRECISION,
        status        TEXT,
        "slipIds"     JSONB
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id          TEXT PRIMARY KEY,
        title       TEXT,
        completed   BOOLEAN DEFAULT FALSE,
        "createdAt" TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id            TEXT PRIMARY KEY,
        timestamp     TEXT,
        "actorId"     TEXT,
        "actorName"   TEXT,
        "actorRole"   TEXT,
        action        TEXT,
        "entityType"  TEXT,
        "entityId"    TEXT,
        "entityLabel" TEXT,
        description   TEXT,
        metadata      JSONB
      );

      CREATE TABLE IF NOT EXISTS settings (
        id    TEXT PRIMARY KEY,
        data  JSONB
      );
    `);

    // ---- Additive migrations -----------------------------------------------
    // Each migration is idempotent — safe to re-run on every cold start.
    // We wrap individual ALTERs in try/catch so one failure doesn't block others.

    const migrations: string[] = [
      // v2: customers gained address, gstin, isActive for soft-delete
      'ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT',
      'ALTER TABLE customers ADD COLUMN IF NOT EXISTS gstin TEXT',
      'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE',
      // v2: vehicles gained isActive for soft-delete
      'ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE',
      // v3: invoices gained slipIds to link source dispatch slips
      'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "slipIds" JSONB',
      // v4: slips gained attachmentUri for scanned document photos
      'ALTER TABLE slips ADD COLUMN IF NOT EXISTS "attachmentUri" TEXT',
    ];

    for (const sql of migrations) {
      try {
        await pool.query(sql);
      } catch {
        // Column/constraint already exists — safe to ignore
      }
    }

    // ---- Seed default settings if empty ------------------------------------
    const { rows } = await pool.query("SELECT * FROM settings WHERE id = $1", ["global"]);
    if (rows.length === 0) {
      await pool.query("INSERT INTO settings (id, data) VALUES ($1, $2)", [
        "global",
        JSON.stringify({
          name: "CrushTrack Enterprises",
          address: "123 Industrial Area, Phase 1\nCity, State 123456",
          phone: "+91 98765 43210",
          gstin: "22AAAAA0000A1Z5",
          receiptFooter: "Thank you for your business!",
          bankName: "HDFC Bank",
          accountNumber: "50200001234567",
          ifscCode: "HDFC0001234",
          branchName: "Industrial Area Branch",
          slipFormat: "Thermal-80mm",
          expenseCategories: ["Diesel", "Maintenance", "Salaries", "Rent", "Office Supplies", "Electricity"],
          materials: [
            { id: "1", name: "10mm", defaultPrice: 450, unit: "Ton", hsnCode: "25171010", gstRate: 5, isActive: true },
            { id: "2", name: "20mm", defaultPrice: 480, unit: "Ton", hsnCode: "25171010", gstRate: 5, isActive: true },
            { id: "3", name: "40mm", defaultPrice: 400, unit: "Ton", hsnCode: "25171010", gstRate: 5, isActive: true },
            { id: "4", name: "Dust", defaultPrice: 350, unit: "Ton", hsnCode: "25171010", gstRate: 5, isActive: true },
            { id: "5", name: "GSB", defaultPrice: 300, unit: "Ton", hsnCode: "25171020", gstRate: 5, isActive: true },
            { id: "6", name: "Boulders", defaultPrice: 250, unit: "Ton", hsnCode: "25169090", gstRate: 5, isActive: true },
          ],
        }),
      ]);
    }

    dbInitialized = true;
    console.log("Database initialised successfully.");
  } catch (error) {
    console.error("Database initialisation failed:", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensures a value that might be a raw JSON string is parsed into an object. */
function parseJsonField<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) : value;
}

/**
 * Builds and executes a dynamic UPSERT for a single record.
 * All non-`id` columns are updated on conflict.
 * Object/array values are auto-serialised to JSON for JSONB columns.
 */
async function upsertRecord(client: PoolClient, table: string, item: Record<string, any>) {
  // table is validated against ALLOWED_TABLES before this function is called
  const keys = Object.keys(item);
  const columns = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map((k) =>
    typeof item[k] === "object" && item[k] !== null ? JSON.stringify(item[k]) : item[k],
  );

  const updateCols = keys.filter((k) => k !== "id");
  const updateClause =
    updateCols.length > 0
      ? `ON CONFLICT (id) DO UPDATE SET ${updateCols.map((k) => `"${k}" = EXCLUDED."${k}"`).join(", ")}`
      : "ON CONFLICT (id) DO NOTHING";

  // Safe: table name is allowlisted before reaching here
  await client.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ${updateClause}`, values);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — locked to known origins; Capacitor native (no Origin) gets wildcard
  const corsOrigin = getCorsOrigin(req);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Accept, Content-Type, Content-Length, X-Requested-With",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Rate limiting check
  if (!checkRateLimit(req)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Ensure schema is ready before any operation
  try {
    await initDb();
  } catch (error: any) {
    return res.status(500).json({
      error: "Failed to initialise database",
      details: error.message,
      code: error.code,
    });
  }

  // -----------------------------------------------------------------------
  // GET — Return the full dataset (used on app boot)
  // -----------------------------------------------------------------------
  if (req.method === "GET") {
    try {
      const [customersRes, vehiclesRes, slipsRes, transactionsRes, invoicesRes, tasksRes, auditLogsRes, settingsRes] =
        await Promise.all([
          pool.query("SELECT * FROM customers"),
          pool.query("SELECT * FROM vehicles"),
          pool.query("SELECT * FROM slips"),
          pool.query("SELECT * FROM transactions"),
          pool.query("SELECT * FROM invoices"),
          pool.query("SELECT * FROM tasks"),
          pool.query("SELECT * FROM audit_logs ORDER BY timestamp DESC"),
          pool.query("SELECT data FROM settings WHERE id = $1", ["global"]),
        ]);

      const data = {
        customers: customersRes.rows.map((c) => ({
          ...c,
          isActive: c.isActive !== false,
        })),
        vehicles: vehiclesRes.rows.map((v) => ({
          ...v,
          isActive: v.isActive !== false,
          measurement: parseJsonField(v.measurement),
        })),
        slips: slipsRes.rows.map((s) => ({
          ...s,
          measurement: parseJsonField(s.measurement),
        })),
        transactions: transactionsRes.rows,
        invoices: invoicesRes.rows.map((i) => ({
          ...i,
          items: parseJsonField(i.items),
          slipIds: i.slipIds ? parseJsonField(i.slipIds) : undefined,
        })),
        tasks: tasksRes.rows.map((t) => ({
          ...t,
          completed: !!t.completed,
        })),
        auditLogs: auditLogsRes.rows.map((log) => ({
          ...log,
          metadata: log.metadata ? parseJsonField(log.metadata) : undefined,
        })),
        companySettings: settingsRes.rows[0]?.data
          ? parseJsonField(settingsRes.rows[0].data)
          : undefined,
      };

      return res.status(200).json(data);
    } catch (error: any) {
      console.error("GET /api/data failed:", error);
      return res.status(500).json({ error: "Failed to fetch data", details: error.message });
    }
  }

  // -----------------------------------------------------------------------
  // PATCH — Delta sync (used by the debounced sync queue in ErpContext)
  // -----------------------------------------------------------------------
  if (req.method === "PATCH") {
    const { updates, deletions } = req.body;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Upserts
      if (updates) {
        for (const [table, items] of Object.entries(updates)) {
          if (!items || (Array.isArray(items) && items.length === 0)) continue;

          if (table === "companySettings") {
            // Settings is a singleton JSONB row, not a normal table
            await client.query(
              'INSERT INTO settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
              ["global", JSON.stringify(items)],
            );
            continue;
          }

          // Reject unknown table names — prevents prototype pollution + SQL injection
          if (!ALLOWED_TABLES.has(table)) continue;
          const dbTable = dbTableName(table);
          if (!dbTable) continue;

          for (const item of items as any[]) {
            await upsertRecord(client, dbTable, item);
          }
        }
      }

      // Hard deletes
      if (deletions) {
        for (const [table, ids] of Object.entries(deletions)) {
          // Allowlist check — table name is used directly in SQL string
          if (!ALLOWED_TABLES.has(table)) continue;
          const dbTable = dbTableName(table);
          if (!dbTable) continue;
          const idList = ids as string[];
          if (!idList || idList.length === 0) continue;
          const placeholders = idList.map((_, i) => `$${i + 1}`).join(", ");
          await client.query(`DELETE FROM ${dbTable} WHERE id IN (${placeholders})`, idList);
        }
      }

      await client.query("COMMIT");
      return res.status(200).json({ success: true });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("PATCH /api/data failed:", error);
      return res.status(500).json({ error: "Failed to sync data", details: error.message });
    } finally {
      client.release();
    }
  }

  // -----------------------------------------------------------------------
  // POST — Full overwrite (used by the Backup-Restore feature)
  // -----------------------------------------------------------------------
  if (req.method === "POST") {
    const { customers, slips, transactions, vehicles, invoices, tasks, auditLogs, companySettings } = req.body;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Truncate & re-insert each table
      // Order doesn't matter — no foreign keys enforced at DB level.

      await client.query("DELETE FROM customers");
      for (const c of customers || []) {
        await client.query(
          'INSERT INTO customers (id, name, phone, address, gstin, "openingBalance", "isActive") VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [c.id, c.name, c.phone, c.address || null, c.gstin || null, c.openingBalance, c.isActive !== false],
        );
      }

      await client.query("DELETE FROM vehicles");
      for (const v of vehicles || []) {
        await client.query(
          'INSERT INTO vehicles (id, "vehicleNo", "ownerName", "ownerPhone", "driverName", "driverPhone", "defaultMeasurementType", measurement, "isActive") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [v.id, v.vehicleNo, v.ownerName, v.ownerPhone || null, v.driverName || null, v.driverPhone || null, v.defaultMeasurementType, JSON.stringify(v.measurement), v.isActive !== false],
        );
      }

      await client.query("DELETE FROM slips");
      for (const s of slips || []) {
        await client.query(
          'INSERT INTO slips (id, date, "vehicleNo", "driverName", "driverPhone", "materialType", "deliveryMode", "measurementType", measurement, quantity, "ratePerUnit", "freightAmount", "totalAmount", "amountPaid", "customerId", status, notes, "operatorName", "loaderName", "invoiceId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)',
          [s.id, s.date, s.vehicleNo, s.driverName || null, s.driverPhone || null, s.materialType, s.deliveryMode, s.measurementType, JSON.stringify(s.measurement), s.quantity, s.ratePerUnit, s.freightAmount, s.totalAmount, s.amountPaid || null, s.customerId, s.status, s.notes, s.operatorName || null, s.loaderName || null, s.invoiceId || null],
        );
      }

      await client.query("DELETE FROM transactions");
      for (const t of transactions || []) {
        await client.query(
          'INSERT INTO transactions (id, date, type, amount, category, description, "customerId", "slipId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [t.id, t.date, t.type, t.amount, t.category, t.description, t.customerId || null, t.slipId || null],
        );
      }

      await client.query("DELETE FROM invoices");
      for (const i of invoices || []) {
        await client.query(
          'INSERT INTO invoices (id, "invoiceNo", date, "customerId", type, items, "subTotal", cgst, sgst, total, status, "slipIds") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [i.id, i.invoiceNo, i.date, i.customerId, i.type, JSON.stringify(i.items), i.subTotal, i.cgst, i.sgst, i.total, i.status, i.slipIds ? JSON.stringify(i.slipIds) : null],
        );
      }

      await client.query("DELETE FROM tasks");
      for (const t of tasks || []) {
        await client.query(
          'INSERT INTO tasks (id, title, completed, "createdAt") VALUES ($1, $2, $3, $4)',
          [t.id, t.title, !!t.completed, t.createdAt],
        );
      }

      await client.query("DELETE FROM audit_logs");
      for (const log of auditLogs || []) {
        await upsertRecord(client, "audit_logs", log);
      }

      if (companySettings) {
        await client.query(
          "INSERT INTO settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
          ["global", JSON.stringify(companySettings)],
        );
      }

      await client.query("COMMIT");
      return res.status(200).json({ success: true });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("POST /api/data failed:", error);
      return res.status(500).json({ error: "Full sync failed", details: error.message });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
