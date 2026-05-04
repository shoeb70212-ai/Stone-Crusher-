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

/**
 * Per-table allowlist of columns accepted in dynamic upserts.
 * Keys must exactly match the camelCase field names sent by the client.
 * Any key not in this set is silently stripped before the INSERT, preventing
 * SQL injection via attacker-controlled column names.
 */
export const TABLE_COLUMNS: Record<string, Set<string>> = {
  customers: new Set(['id', 'name', 'phone', 'address', 'gstin', 'openingBalance', 'isActive', 'updatedAt']),
  employees: new Set(['id', 'name', 'phone', 'role', 'address', 'joiningDate', 'salaryType', 'salaryAmount', 'openingBalance', 'notes', 'isActive', 'updatedAt']),
  employee_transactions: new Set(['id', 'employeeId', 'date', 'type', 'amount', 'description', 'period', 'paymentMode', 'linkedTransactionId', 'updatedAt']),
  vehicles: new Set(['id', 'vehicleNo', 'ownerName', 'ownerPhone', 'driverName', 'driverPhone', 'defaultMeasurementType', 'defaultDeliveryMode', 'measurement', 'isActive', 'updatedAt']),
  slips: new Set(['id', 'date', 'vehicleNo', 'driverName', 'driverPhone', 'materialType', 'deliveryMode', 'measurementType', 'measurement', 'quantity', 'ratePerUnit', 'totalAmount', 'amountPaid', 'customerId', 'status', 'notes', 'operatorName', 'loaderName', 'invoiceId', 'attachmentUri', 'updatedAt']),
  transactions: new Set(['id', 'date', 'type', 'amount', 'category', 'description', 'customerId', 'slipId', 'updatedAt']),
  invoices: new Set(['id', 'invoiceNo', 'date', 'customerId', 'type', 'items', 'subTotal', 'cgst', 'sgst', 'total', 'status', 'slipIds', 'updatedAt']),
  tasks: new Set(['id', 'title', 'completed', 'createdAt', 'updatedAt']),
  audit_logs: new Set(['id', 'timestamp', 'actorId', 'actorName', 'actorRole', 'action', 'entityType', 'entityId', 'entityLabel', 'description', 'metadata', 'updatedAt']),
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
 *
 * Security: only columns present in TABLE_COLUMNS[table] are written.
 * Any key not in the allowlist is silently dropped — this prevents
 * SQL injection via attacker-controlled field names.
 *
 * Object/array values are auto-serialised to JSON for JSONB columns.
 * `updatedAt` is always stamped server-side so callers cannot forge it.
 * Table name is validated against ALLOWED_TABLES before this is called.
 */
export async function upsertRecord(
  client: PoolClient,
  table: string,
  item: Record<string, unknown>,
): Promise<void> {
  const allowed = TABLE_COLUMNS[table];

  // Strip disallowed keys (including legacy freightAmount) and stamp updatedAt.
  const safeItem: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(item)) {
    if (k === 'freightAmount') continue;
    if (allowed && !allowed.has(k)) continue;
    safeItem[k] = v;
  }

  const keys = Object.keys(safeItem);
  if (keys.length === 0) return;

  // Column names come exclusively from our allowlist — safe to quote and interpolate.
  const columns = keys.map((k) => `"${k}"`).join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map((k) =>
    typeof safeItem[k] === 'object' && safeItem[k] !== null
      ? JSON.stringify(safeItem[k])
      : safeItem[k],
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
      "isActive"        BOOLEAN DEFAULT TRUE,
      "updatedAt"       TIMESTAMPTZ DEFAULT now()
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
      "isActive"        BOOLEAN DEFAULT TRUE,
      "updatedAt"       TIMESTAMPTZ DEFAULT now()
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
      "linkedTransactionId" TEXT,
      "updatedAt"           TIMESTAMPTZ DEFAULT now()
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
      "isActive"                BOOLEAN DEFAULT TRUE,
      "updatedAt"               TIMESTAMPTZ DEFAULT now()
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
      "invoiceId"       TEXT,
      "attachmentUri"   TEXT,
      "updatedAt"       TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id            TEXT PRIMARY KEY,
      date          TEXT,
      type          TEXT,
      amount        DOUBLE PRECISION,
      category      TEXT,
      description   TEXT,
      "customerId"  TEXT,
      "slipId"      TEXT,
      "updatedAt"   TIMESTAMPTZ DEFAULT now()
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
      "slipIds"     JSONB,
      "updatedAt"   TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY,
      title       TEXT,
      completed   BOOLEAN DEFAULT FALSE,
      "createdAt" TEXT,
      "updatedAt" TIMESTAMPTZ DEFAULT now()
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
      metadata      JSONB,
      "updatedAt"   TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS settings (
      id    TEXT PRIMARY KEY,
      data  JSONB
    );

    -- Tombstone table: records deleted IDs so mobile cannot resurrect them.
    -- Rows expire after 7 days; a scheduled job or the pruning query can clean them up.
    CREATE TABLE IF NOT EXISTS tombstones (
      id           BIGSERIAL PRIMARY KEY,
      "tableKey"   TEXT NOT NULL,
      "recordId"   TEXT NOT NULL,
      "deletedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE ("tableKey", "recordId")
    );
  `);

  const migrations = [
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS gstin TEXT',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE',
    'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS role TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "joiningDate" TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "salaryType" TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "salaryAmount" DOUBLE PRECISION DEFAULT 0',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "openingBalance" DOUBLE PRECISION DEFAULT 0',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE',
    'ALTER TABLE employees ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    'ALTER TABLE employee_transactions ADD COLUMN IF NOT EXISTS "paymentMode" TEXT',
    'ALTER TABLE employee_transactions ADD COLUMN IF NOT EXISTS "linkedTransactionId" TEXT',
    'ALTER TABLE employee_transactions ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    'ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE',
    'ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "defaultDeliveryMode" TEXT',
    'ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    'ALTER TABLE slips ADD COLUMN IF NOT EXISTS "attachmentUri" TEXT',
    'ALTER TABLE slips ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    'ALTER TABLE slips DROP COLUMN IF EXISTS "freightAmount"',
    'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "slipIds" JSONB',
    'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now()',
    // Indexes for delta-sync queries and common lookups
    'CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_employees_updated_at ON employees ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_employee_transactions_updated_at ON employee_transactions ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_employee_transactions_employee_id ON employee_transactions ("employeeId")',
    'CREATE INDEX IF NOT EXISTS idx_vehicles_updated_at ON vehicles ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_slips_updated_at ON slips ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_slips_customer_id ON slips ("customerId")',
    'CREATE INDEX IF NOT EXISTS idx_slips_invoice_id ON slips ("invoiceId")',
    'CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions ("customerId")',
    'CREATE INDEX IF NOT EXISTS idx_invoices_updated_at ON invoices ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices ("customerId")',
    'CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_updated_at ON audit_logs ("updatedAt")',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_tombstones_table_deleted ON tombstones ("tableKey", "deletedAt")',
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch {
      // Column/index already exists — safe to ignore
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

// ---------------------------------------------------------------------------
// Tombstone helpers
// ---------------------------------------------------------------------------

const TOMBSTONE_TTL_DAYS = 7;

/**
 * Records deleted IDs in the tombstones table so mobile clients cannot
 * resurrect them on the next sync. Uses UPSERT to refresh deletedAt if the
 * same record is deleted twice within the TTL window.
 */
export async function addTombstones(
  client: PoolClient,
  tableKey: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    await client.query(
      `INSERT INTO tombstones ("tableKey", "recordId", "deletedAt")
       VALUES ($1, $2, now())
       ON CONFLICT ("tableKey", "recordId") DO UPDATE SET "deletedAt" = now()`,
      [tableKey, id],
    );
  }
}

/**
 * Returns the set of tombstoned record IDs for a given table that are still
 * within the TTL window. Used by upsert to reject resurrection attempts.
 */
export async function getTombstonedIds(tableKey: string): Promise<Set<string>> {
  const { rows } = await pool.query<{ recordId: string }>(
    `SELECT "recordId" FROM tombstones
     WHERE "tableKey" = $1
       AND "deletedAt" > now() - INTERVAL '${TOMBSTONE_TTL_DAYS} days'`,
    [tableKey],
  );
  return new Set(rows.map((r) => r.recordId));
}

/**
 * Returns tombstone entries grouped by tableKey for all tables, filtered to
 * those deleted after the given timestamp. Used by the delta-sync GET handler.
 */
export async function getTombstonesSince(
  since: Date,
): Promise<Record<string, string[]>> {
  const { rows } = await pool.query<{ tableKey: string; recordId: string }>(
    `SELECT "tableKey", "recordId" FROM tombstones
     WHERE "deletedAt" > $1
       AND "deletedAt" > now() - INTERVAL '${TOMBSTONE_TTL_DAYS} days'`,
    [since.toISOString()],
  );
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    if (!result[row.tableKey]) result[row.tableKey] = [];
    result[row.tableKey].push(row.recordId);
  }
  return result;
}

/**
 * Removes tombstone entries older than the TTL. Call periodically to keep
 * the table small (e.g. from a scheduled Vercel cron).
 */
export async function pruneTombstones(): Promise<void> {
  await pool.query(
    `DELETE FROM tombstones WHERE "deletedAt" < now() - INTERVAL '${TOMBSTONE_TTL_DAYS} days'`,
  );
}
