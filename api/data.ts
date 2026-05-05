/**
 * Vercel Serverless API handler for CrushTrack ERP.
 *
 * Provides GET / PATCH / POST endpoints against a PostgreSQL database
 * (Supabase). This file is only active when deployed to Vercel —
 * local development uses `server.ts` with a flat JSON file instead.
 *
 * Schema migrations run automatically on each cold start via `initDb()`.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  pool,
  initDb,
  parseJsonField,
  upsertRecord,
  dbTableName,
  ALLOWED_TABLES,
  readSettings,
  writeSettings,
  addTombstones,
  getTombstonedIds,
  getTombstonesSince,
  type DataRecord,
} from './_db.js';
import { verifyBearerToken } from './_supabase-admin.js';
import { getCorsOrigin } from './_cors.js';
import type { UserRole, UserAccount } from './_types.js';
import * as Sentry from '@sentry/node';
import { getRatelimit } from './_ratelimit.js';

function getRateLimitKey(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(fwd) ? fwd[0] : fwd) ||
    (req.headers['client-ip'] as string) ||
    'unknown';
  return `${ip.split(',')[0].trim()}`;
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'Admin' || value === 'Manager' || value === 'Partner';
}

function hasValidApiKey(req: VercelRequest): boolean {
  const expected = process.env.API_SECRET;
  if (!expected) return false;
  return req.headers['x-api-key'] === expected;
}

async function resolveCaller(
  req: VercelRequest,
): Promise<{ role: UserRole; userId: string; viaApiKey?: boolean } | null> {
  if (hasValidApiKey(req)) {
    return { role: 'Admin', userId: 'api-key', viaApiKey: true };
  }

  const caller = await verifyBearerToken(req).catch(() => null);
  if (!caller) return null;

  const settings = await readSettings();
  const users = (settings.users ?? []) as UserAccount[];
  const settingsUser = users.find(
    (u) =>
      u.id === caller.userId ||
      (u.email || '').toLowerCase() === caller.email.toLowerCase(),
  );
  if (!settingsUser && users.length > 0) return null;
  if (settingsUser && settingsUser.status !== 'Active') return null;

  const metadataRole = caller.appMetadata.role;
  const role = isUserRole(metadataRole)
    ? metadataRole
    : isUserRole(settingsUser?.role)
      ? settingsUser.role
      : null;
  if (!role) return null;

  return { role, userId: caller.userId };
}

function canWriteData(role: UserRole): boolean {
  return role === 'Admin' || role === 'Manager';
}

function payloadTouchesCompanySettings(body: unknown): boolean {
  const updates = (body as { updates?: Record<string, unknown> } | undefined)?.updates;
  return !!updates?.companySettings;
}

function publicBootstrapPayload(settings: Record<string, unknown>) {
  const users = Array.isArray(settings.users) ? settings.users : [];
  const publicSettings = {
    name: settings.name,
    theme: settings.theme,
    primaryColor: settings.primaryColor,
    mobileLayout: settings.mobileLayout,
    users: users.length === 0 ? [] : undefined,
  };
  return {
    bootstrapRequired: users.length === 0,
    companySettings: publicSettings,
  };
}

// ---------------------------------------------------------------------------
// Orphan-guard helpers — prevent deletes that would leave dangling references
// ---------------------------------------------------------------------------

/**
 * Returns an error string if deleting `ids` from `tableKey` would orphan
 * records in dependent tables. Returns null when the delete is safe.
 *
 * Only hard-delete tables (transactions, tasks, employeeTransactions) are
 * checked here; vehicles/customers/employees use soft-deletes at the app layer
 * and should not appear in the deletions payload with live dependents.
 */
async function checkOrphanSafety(
  tableKey: string,
  ids: string[],
): Promise<string | null> {
  if (ids.length === 0) return null;
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');

  if (tableKey === 'transactions') {
    // Block deleting a transaction that a slip was auto-generated from.
    const { rows } = await pool.query(
      `SELECT id FROM slips WHERE "invoiceId" IS NULL AND "customerId" != 'CASH'
         AND id IN (
           SELECT "slipId" FROM transactions WHERE "slipId" IS NOT NULL AND id IN (${placeholders})
         )`,
      ids,
    );
    if (rows.length > 0) {
      return `Cannot delete: ${rows.length} slip(s) are linked to these transactions. Cancel the slips first.`;
    }
  }

  if (tableKey === 'employeeTransactions') {
    // Block deleting an employee transaction that created a linked daybook transaction.
    const { rows } = await pool.query(
      `SELECT id FROM transactions
       WHERE id IN (
         SELECT "linkedTransactionId" FROM employee_transactions
         WHERE "linkedTransactionId" IS NOT NULL AND id IN (${placeholders})
       )`,
      ids,
    );
    if (rows.length > 0) {
      return `Cannot delete: ${rows.length} linked daybook transaction(s) exist. Delete those first.`;
    }
  }

  if (tableKey === 'customers') {
    // Customers should be soft-deleted, not hard-deleted through this path.
    // Guard anyway: block if any active slips/invoices/transactions reference them.
    const { rows } = await pool.query(
      `SELECT 1 FROM slips WHERE "customerId" = ANY($1::text[]) LIMIT 1`,
      [ids],
    );
    if (rows.length > 0) {
      return 'Cannot hard-delete customers that have dispatch slips. Use soft-delete (isActive=false) instead.';
    }
  }

  if (tableKey === 'employees') {
    const { rows } = await pool.query(
      `SELECT 1 FROM employee_transactions WHERE "employeeId" = ANY($1::text[]) LIMIT 1`,
      [ids],
    );
    if (rows.length > 0) {
      return 'Cannot hard-delete employees that have ledger entries. Use soft-delete (isActive=false) instead.';
    }
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Content-Length, X-Requested-With, X-API-Key, Authorization, X-CSRF-Token',
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const ratelimit = getRatelimit();
    if (ratelimit) {
      const key = getRateLimitKey(req);
      const { success, reset } = await ratelimit.limit(key);
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        res.setHeader('X-RateLimit-Remaining', '0');
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    // fail open
  }

  try {
    await initDb();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to initialise database', details: msg });
  }

  const caller = await resolveCaller(req);
  if (caller) {
    Sentry.setUser({ id: caller.userId });
  }

  // -------------------------------------------------------------------------
  // GET — Full dataset or incremental delta since a given timestamp
  // -------------------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      if (!caller) {
        const settings = await readSettings();
        return res.status(200).json(publicBootstrapPayload(settings));
      }

      const sinceParam = typeof req.query.since === 'string' ? req.query.since : null;
      let sinceDate: Date | null = null;

      if (sinceParam) {
        sinceDate = new Date(sinceParam);
        if (isNaN(sinceDate.getTime())) {
          return res.status(400).json({ error: 'Invalid ?since value — must be an ISO-8601 timestamp' });
        }
      }

      // Build WHERE clause for delta queries.
      const deltaWhere = sinceDate ? `WHERE "updatedAt" > $1` : '';
      const deltaParams = sinceDate ? [sinceDate.toISOString()] : [];

      const [
        customersRes,
        employeesRes,
        employeeTransactionsRes,
        vehiclesRes,
        slipsRes,
        transactionsRes,
        invoicesRes,
        tasksRes,
        auditLogsRes,
      ] = await Promise.all([
        pool.query(`SELECT * FROM customers ${deltaWhere}`, deltaParams),
        pool.query(`SELECT * FROM employees ${deltaWhere}`, deltaParams),
        pool.query(`SELECT * FROM employee_transactions ${deltaWhere}`, deltaParams),
        pool.query(`SELECT * FROM vehicles ${deltaWhere}`, deltaParams),
        pool.query(`SELECT * FROM slips ${deltaWhere}`, deltaParams),
        pool.query(`SELECT * FROM transactions ${deltaWhere}`, deltaParams),
        pool.query(`SELECT * FROM invoices ${deltaWhere}`, deltaParams),
        pool.query(`SELECT * FROM tasks ${deltaWhere}`, deltaParams),
        pool.query(
          `SELECT * FROM audit_logs ${deltaWhere ? deltaWhere + ' ORDER BY timestamp DESC' : 'ORDER BY timestamp DESC'}`,
          deltaParams,
        ),
      ]);

      const companySettings = await readSettings();

      // Include tombstones for the delta window so clients can drop deleted records.
      const tombstones = sinceDate ? await getTombstonesSince(sinceDate) : {};

      return res.status(200).json({
        bootstrapRequired: false,
        customers: customersRes.rows.map((c) => ({ ...c, isActive: c.isActive !== false })),
        employees: employeesRes.rows.map((e) => ({
          ...e,
          isActive: e.isActive !== false,
          salaryAmount: Number(e.salaryAmount || 0),
          openingBalance: Number(e.openingBalance || 0),
        })),
        employeeTransactions: employeeTransactionsRes.rows.map((tx) => ({
          ...tx,
          amount: Number(tx.amount || 0),
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
        tasks: tasksRes.rows.map((t) => ({ ...t, completed: !!t.completed })),
        auditLogs: auditLogsRes.rows.map((log) => ({
          ...log,
          metadata: log.metadata ? parseJsonField(log.metadata) : undefined,
        })),
        companySettings,
        tombstones,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      Sentry.captureException(error);
      return res.status(500).json({ error: 'Failed to fetch data', details: msg });
    }
  }

  // -------------------------------------------------------------------------
  // PATCH — Delta sync: apply updates then deletions inside one transaction
  // -------------------------------------------------------------------------
  if (req.method === 'PATCH') {
    if (!caller || !canWriteData(caller.role)) {
      return res.status(403).json({ error: 'You are not allowed to sync data.' });
    }
    if (payloadTouchesCompanySettings(req.body) && caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admins can update company settings.' });
    }

    const { updates, deletions } = req.body as {
      updates?: Record<string, unknown>;
      deletions?: Record<string, string[]>;
    };

    // ── Pre-flight orphan checks (outside the transaction — read-only) ──
    if (deletions) {
      for (const [table, ids] of Object.entries(deletions)) {
        if (!ALLOWED_TABLES.has(table) || !Array.isArray(ids) || ids.length === 0) continue;
        const orphanError = await checkOrphanSafety(table, ids as string[]);
        if (orphanError) {
          return res.status(409).json({ error: orphanError });
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ── Step 1: Apply updates — skip tombstoned records ──
      if (updates) {
        // Hoist tombstone fetch per table per request to avoid N+1 queries.
        const tombstoneCache = new Map<string, Set<string>>();
        for (const [table, items] of Object.entries(updates)) {
          if (!items || (Array.isArray(items) && (items as unknown[]).length === 0)) continue;

          if (table === 'companySettings') {
            const incoming = items as Record<string, unknown>;
            const expectedVersion = typeof incoming.version === 'number' ? incoming.version : undefined;
            const result = await writeSettings(incoming, expectedVersion);
            if (!result.ok) {
              return res.status(409).json({
                error: 'Company settings were modified by another user. Please refresh and try again.',
                currentVersion: result.currentVersion,
              });
            }
            continue;
          }

          if (!ALLOWED_TABLES.has(table)) continue;
          const dbTable = dbTableName(table);
          if (!dbTable) continue;

          let deadIds = tombstoneCache.get(table);
          if (!deadIds) {
            deadIds = await getTombstonedIds(table);
            tombstoneCache.set(table, deadIds);
          }

          for (const item of items as DataRecord[]) {
            if (item.id && deadIds.has(String(item.id))) continue; // skip tombstoned
            await upsertRecord(client, dbTable, item as Record<string, unknown>);
          }
        }
      }

      // ── Step 2: Apply deletions, record tombstones ──
      if (deletions) {
        for (const [table, ids] of Object.entries(deletions)) {
          if (!ALLOWED_TABLES.has(table)) continue;
          const dbTable = dbTableName(table);
          if (!dbTable) continue;
          const idList = (ids as string[]).filter(Boolean);
          if (idList.length === 0) continue;

          const placeholders = idList.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(`DELETE FROM ${dbTable} WHERE id IN (${placeholders})`, idList);
          await addTombstones(client, table, idList);
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true, syncedAt: new Date().toISOString() });
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const msg = error instanceof Error ? error.message : String(error);
      Sentry.captureException(error);
      return res.status(500).json({ error: 'Failed to sync data', details: msg });
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------------------------
  // POST — Full overwrite (admin backup restore only)
  // -------------------------------------------------------------------------
  if (req.method === 'POST') {
    const caller = await resolveCaller(req);
    if (!caller || caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admins can restore backups.' });
    }

    const {
      customers, employees, employeeTransactions, slips, transactions,
      vehicles, invoices, tasks, auditLogs, companySettings,
    } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM customers');
      for (const c of customers || []) {
        await client.query(
          'INSERT INTO customers (id, name, phone, address, gstin, "openingBalance", "isActive") VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [c.id, c.name, c.phone, c.address || null, c.gstin || null, c.openingBalance, c.isActive !== false],
        );
      }

      await client.query('DELETE FROM employees');
      for (const e of employees || []) {
        await client.query(
          'INSERT INTO employees (id, name, phone, role, address, "joiningDate", "salaryType", "salaryAmount", "openingBalance", notes, "isActive") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [e.id, e.name, e.phone || null, e.role || null, e.address || null, e.joiningDate || null, e.salaryType || 'Monthly', e.salaryAmount || 0, e.openingBalance || 0, e.notes || null, e.isActive !== false],
        );
      }

      await client.query('DELETE FROM employee_transactions');
      for (const tx of employeeTransactions || []) {
        await client.query(
          'INSERT INTO employee_transactions (id, "employeeId", date, type, amount, description, period, "paymentMode", "linkedTransactionId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [tx.id, tx.employeeId, tx.date, tx.type, tx.amount || 0, tx.description || '', tx.period || null, tx.paymentMode || null, tx.linkedTransactionId || null],
        );
      }

      await client.query('DELETE FROM vehicles');
      for (const v of vehicles || []) {
        await client.query(
          'INSERT INTO vehicles (id, "vehicleNo", "ownerName", "ownerPhone", "driverName", "driverPhone", "defaultMeasurementType", "defaultDeliveryMode", measurement, "isActive") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [v.id, v.vehicleNo, v.ownerName, v.ownerPhone || null, v.driverName || null, v.driverPhone || null, v.defaultMeasurementType, v.defaultDeliveryMode || null, JSON.stringify(v.measurement), v.isActive !== false],
        );
      }

      await client.query('DELETE FROM slips');
      for (const s of slips || []) {
        await client.query(
          'INSERT INTO slips (id, date, "vehicleNo", "driverName", "driverPhone", "materialType", "deliveryMode", "measurementType", measurement, quantity, "ratePerUnit", "totalAmount", "amountPaid", "customerId", status, notes, "operatorName", "loaderName", "invoiceId", "attachmentUri") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)',
          [s.id, s.date, s.vehicleNo, s.driverName || null, s.driverPhone || null, s.materialType, s.deliveryMode, s.measurementType, JSON.stringify(s.measurement), s.quantity, s.ratePerUnit, s.totalAmount, s.amountPaid || null, s.customerId, s.status, s.notes, s.operatorName || null, s.loaderName || null, s.invoiceId || null, s.attachmentUri || null],
        );
      }

      await client.query('DELETE FROM transactions');
      for (const t of transactions || []) {
        await client.query(
          'INSERT INTO transactions (id, date, type, amount, category, description, "customerId", "slipId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [t.id, t.date, t.type, t.amount, t.category, t.description, t.customerId || null, t.slipId || null],
        );
      }

      await client.query('DELETE FROM invoices');
      for (const i of invoices || []) {
        await client.query(
          'INSERT INTO invoices (id, "invoiceNo", date, "customerId", type, items, "subTotal", cgst, sgst, total, status, "slipIds") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [i.id, i.invoiceNo, i.date, i.customerId, i.type, JSON.stringify(i.items), i.subTotal, i.cgst, i.sgst, i.total, i.status, i.slipIds ? JSON.stringify(i.slipIds) : null],
        );
      }

      await client.query('DELETE FROM tasks');
      for (const t of tasks || []) {
        await client.query(
          'INSERT INTO tasks (id, title, completed, "createdAt") VALUES ($1,$2,$3,$4)',
          [t.id, t.title, !!t.completed, t.createdAt],
        );
      }

      // Audit logs are append-only — never delete during restore.
      for (const log of auditLogs || []) {
        await upsertRecord(client, 'audit_logs', log as Record<string, unknown>);
      }
      // Record a server-side restore event.
      await upsertRecord(client, 'audit_logs', {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        actorId: caller.userId,
        actorName: 'System',
        actorRole: 'Admin',
        action: 'restore',
        entityType: 'System',
        entityId: 'system',
        entityLabel: 'Full Restore',
        description: `Restored backup with ${(auditLogs || []).length} audit log entries.`,
        metadata: { before: 0, after: (auditLogs || []).length },
      } as Record<string, unknown>);

      // Clear tombstones on a full restore — all records are fresh.
      await client.query('DELETE FROM tombstones');

      if (companySettings) {
        await writeSettings(companySettings as Record<string, unknown>);
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true });
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const msg = error instanceof Error ? error.message : String(error);
      Sentry.captureException(error);
      return res.status(500).json({ error: 'Full sync failed', details: msg });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
