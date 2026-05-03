/**
 * Shared PostgreSQL pool and helpers for Vercel serverless functions.
 *
 * The file starts with `_` so Vercel does not expose it as a public route.
 *
 * IMPORTANT: Use the Supabase Transaction Pooler connection string (port 6543,
 * host *.pooler.supabase.com).  Direct connections use IPv6 which Vercel does
 * not support.
 */

import { Pool, PoolClient } from 'pg';

export type DataRecord = { id?: string; [key: string]: unknown };
export type AppData = Record<string, unknown> & {
  customers?: DataRecord[];
  employees?: DataRecord[];
  employeeTransactions?: DataRecord[];
  slips?: DataRecord[];
  transactions?: DataRecord[];
  vehicles?: DataRecord[];
  invoices?: DataRecord[];
  tasks?: DataRecord[];
  auditLogs?: DataRecord[];
  companySettings?: Record<string, unknown>;
};

/** Allowed camelCase table keys that map to snake_case Postgres table names. */
export const TABLE_NAMES: Record<string, string> = {
  customers: 'customers',
  employees: 'employees',
  employeeTransactions: 'employee_transactions',
  vehicles: 'vehicles',
  slips: 'slips',
  transactions: 'transactions',
  invoices: 'invoices',
  tasks: 'tasks',
  auditLogs: 'audit_logs',
};

export const ALLOWED_TABLES = new Set(Object.keys(TABLE_NAMES));

export function dbTableName(table: string): string | null {
  return TABLE_NAMES[table] ?? null;
}

/**
 * Pool configured for Supabase Supavisor in Transaction mode.
 * `max: 5` keeps the pool small for serverless; Supavisor multiplexes.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 20_000,
});

/** Ensures a value that might be a raw JSON string is parsed into an object. */
export function parseJsonField<T>(value: T | string): T {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

/**
 * Builds and executes a dynamic UPSERT for a single record.
 * Object/array values are auto-serialised to JSON for JSONB columns.
 * Table name is validated against ALLOWED_TABLES before this is called.
 */
export async function upsertRecord(
  client: PoolClient,
  table: string,
  item: Record<string, unknown>,
): Promise<void> {
  const sanitizedItem =
    table === 'slips'
      ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'freightAmount'))
      : item;
  const keys = Object.keys(sanitizedItem);
  const columns = keys.map((k) => `"${k}"`).join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map((k) =>
    typeof sanitizedItem[k] === 'object' && sanitizedItem[k] !== null
      ? JSON.stringify(sanitizedItem[k])
      : sanitizedItem[k],
  );

  const updateCols = keys.filter((k) => k !== 'id');
  const updateClause =
    updateCols.length > 0
      ? `ON CONFLICT (id) DO UPDATE SET ${updateCols.map((k) => `"${k}" = EXCLUDED."${k}"`).join(', ')}`
      : 'ON CONFLICT (id) DO NOTHING';

  await client.query(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ${updateClause}`,
    values,
  );
}

const EMPTY_SETTINGS = {
  name: 'CrushTrack Enterprises',
  address: '123 Industrial Area, Phase 1\nCity, State 123456',
  phone: '+91 98765 43210',
  gstin: '22AAAAA0000A1Z5',
  receiptFooter: 'Thank you for your business!',
  bankName: 'HDFC Bank',
  accountNumber: '50200001234567',
  ifscCode: 'HDFC0001234',
  branchName: 'Industrial Area Branch',
  slipFormat: 'Thermal-80mm',
  expenseCategories: ['Diesel', 'Maintenance', 'Salaries', 'Rent', 'Office Supplies', 'Electricity'],
  materials: [
    { id: '1', name: '10mm', defaultPrice: 450, unit: 'Ton', hsnCode: '25171010', gstRate: 5, isActive: true },
    { id: '2', name: '20mm', defaultPrice: 480, unit: 'Ton', hsnCode: '25171010', gstRate: 5, isActive: true },
    { id: '3', name: '40mm', defaultPrice: 400, unit: 'Ton', hsnCode: '25171010', gstRate: 5, isActive: true },
    { id: '4', name: 'Dust', defaultPrice: 350, unit: 'Ton', hsnCode: '25171010', gstRate: 5, isActive: true },
    { id: '5', name: 'GSB', defaultPrice: 300, unit: 'Ton', hsnCode: '25171020', gstRate: 5, isActive: true },
    { id: '6', name: 'Boulders', defaultPrice: 250, unit: 'Ton', hsnCode: '25169090', gstRate: 5, isActive: true },
  ],
  users: [],
};

let dbInitialized = false;

/** Creates all tables and runs additive migrations. Safe to call on every cold start. */
export async function initDb(): Promise<void> {
  if (dbInitialized) return;

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

    CREATE TABLE IF NOT EXISTS employees (
      id                TEXT PRIMARY KEY,
      name              TEXT,
      phone             TEXT,
      role              TEXT,
      address           TEXT,
      "joiningDate"     TEXT,
      "salaryType"      TEXT,
      "salaryAmount"    DOUBLE PRECISION DEFAULT 0,
      "openingBalance"  DOUBLE PRECISION DEFAULT 0,
      notes             TEXT,
      "isActive"        BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS employee_transactions (
      id                    TEXT PRIMARY KEY,
      "employeeId"          TEXT,
      date                  TEXT,
      type                  TEXT,
      amount                DOUBLE PRECISION,
      description           TEXT,
      period                TEXT,
      "paymentMode"         TEXT,
      "linkedTransactionId" TEXT
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id                        TEXT PRIMARY KEY,
      "vehicleNo"               TEXT,
      "ownerName"               TEXT,
      "ownerPhone"              TEXT,
      "driverName"              TEXT,
      "driverPhone"             TEXT,
      "defaultMeasurementType"  TEXT,
      "defaultDeliveryMode"     TEXT,
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

  const migrations = [
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS gstin TEXT',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS role TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "joiningDate" TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "salaryType" TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "salaryAmount" DOUBLE PRECISION DEFAULT 0',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "openingBalance" DOUBLE PRECISION DEFAULT 0',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE',
    'ALTER TABLE employee_transactions ADD COLUMN IF NOT EXISTS "paymentMode" TEXT',
    'ALTER TABLE employee_transactions ADD COLUMN IF NOT EXISTS "linkedTransactionId" TEXT',
    'ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE',
    'ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "defaultDeliveryMode" TEXT',
    'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "slipIds" JSONB',
    'ALTER TABLE slips ADD COLUMN IF NOT EXISTS "attachmentUri" TEXT',
    'ALTER TABLE slips DROP COLUMN IF EXISTS "freightAmount"',
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Seed default settings if empty — never overwrite an existing row.
  const { rows } = await pool.query('SELECT id FROM settings WHERE id = $1', ['global']);
  if (rows.length === 0) {
    await pool.query('INSERT INTO settings (id, data) VALUES ($1, $2)', [
      'global',
      JSON.stringify(EMPTY_SETTINGS),
    ]);
  }

  dbInitialized = true;
}

/**
 * Reads the current companySettings JSONB from the settings table.
 * Returns an empty object if the row does not exist yet.
 */
export async function readSettings(): Promise<Record<string, unknown>> {
  const { rows } = await pool.query('SELECT data FROM settings WHERE id = $1', ['global']);
  if (!rows[0]?.data) return {};
  return parseJsonField<Record<string, unknown>>(rows[0].data);
}

/**
 * Writes companySettings back to the settings table.
 * Strips any passwordHash fields from users before persisting.
 */
export async function writeSettings(data: Record<string, unknown>): Promise<void> {
  // Strip passwordHash from every user entry — passwords live in Supabase Auth only.
  const cleaned = {
    ...data,
    users: Array.isArray(data.users)
      ? (data.users as Record<string, unknown>[]).map(({ passwordHash: _ph, ...u }) => u)
      : data.users,
  };
  await pool.query(
    'INSERT INTO settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
    ['global', JSON.stringify(cleaned)],
  );
}
