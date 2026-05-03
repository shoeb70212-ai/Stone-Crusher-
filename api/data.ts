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
  type DataRecord,
} from './_db.js';
import { verifyBearerToken } from './_supabase-admin.js';
import type { UserRole, UserAccount } from './_types.js';

const RATE_LIMIT = 100;

const ALLOWED_ORIGINS = new Set([
  'https://stone-crusher.vercel.app',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:8083',
]);

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers['origin'] as string | undefined;
  if (!origin) return '*';
  return ALLOWED_ORIGINS.has(origin) ? origin : 'null';
}

function getRateLimitKey(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(fwd) ? fwd[0] : fwd) ||
    (req.headers['client-ip'] as string) ||
    'unknown';
  return `rate_${ip.split(',')[0].trim()}`;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(req: VercelRequest): boolean {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + 60_000 });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
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
): Promise<{ role: UserRole; userId: string; email: string; viaApiKey?: boolean } | null> {
  if (hasValidApiKey(req)) {
    return { role: 'Admin', userId: 'api-key', email: '', viaApiKey: true };
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

  return { role, userId: caller.userId, email: caller.email };
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Content-Length, X-Requested-With, X-API-Key, Authorization',
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!checkRateLimit(req)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  try {
    await initDb();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to initialise database', details: msg });
  }

  // -----------------------------------------------------------------------
  // GET — Return the full dataset (used on app boot)
  // -----------------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const caller = await resolveCaller(req);
      if (!caller) {
        const settings = await readSettings();
        return res.status(200).json(publicBootstrapPayload(settings));
      }

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
        pool.query('SELECT * FROM customers'),
        pool.query('SELECT * FROM employees'),
        pool.query('SELECT * FROM employee_transactions'),
        pool.query('SELECT * FROM vehicles'),
        pool.query('SELECT * FROM slips'),
        pool.query('SELECT * FROM transactions'),
        pool.query('SELECT * FROM invoices'),
        pool.query('SELECT * FROM tasks'),
        pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC'),
      ]);

      const companySettings = await readSettings();

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
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('GET /api/data failed:', msg);
      return res.status(500).json({ error: 'Failed to fetch data', details: msg });
    }
  }

  // -----------------------------------------------------------------------
  // PATCH — Delta sync (used by the debounced sync queue in ErpContext)
  // -----------------------------------------------------------------------
  if (req.method === 'PATCH') {
    const caller = await resolveCaller(req);
    if (!caller || !canWriteData(caller.role)) {
      return res.status(403).json({ error: 'You are not allowed to sync data.' });
    }
    if (payloadTouchesCompanySettings(req.body) && caller.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admins can update company settings.' });
    }

    const { updates, deletions } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (updates) {
        for (const [table, items] of Object.entries(updates)) {
          if (!items || (Array.isArray(items) && (items as unknown[]).length === 0)) continue;

          if (table === 'companySettings') {
            await writeSettings(items as Record<string, unknown>);
            continue;
          }

          if (!ALLOWED_TABLES.has(table)) continue;
          const dbTable = dbTableName(table);
          if (!dbTable) continue;

          for (const item of items as DataRecord[]) {
            await upsertRecord(client, dbTable, item as Record<string, unknown>);
          }
        }
      }

      if (deletions) {
        for (const [table, ids] of Object.entries(deletions)) {
          if (!ALLOWED_TABLES.has(table)) continue;
          const dbTable = dbTableName(table);
          if (!dbTable) continue;
          const idList = ids as string[];
          if (!idList?.length) continue;
          const placeholders = idList.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(`DELETE FROM ${dbTable} WHERE id IN (${placeholders})`, idList);
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true });
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const msg = error instanceof Error ? error.message : String(error);
      console.error('PATCH /api/data failed:', msg);
      return res.status(500).json({ error: 'Failed to sync data', details: msg });
    } finally {
      client.release();
    }
  }

  // -----------------------------------------------------------------------
  // POST — Full overwrite (used by the Backup-Restore feature)
  // -----------------------------------------------------------------------
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

      await client.query('DELETE FROM audit_logs');
      for (const log of auditLogs || []) {
        await upsertRecord(client, 'audit_logs', log as Record<string, unknown>);
      }

      if (companySettings) {
        await writeSettings(companySettings as Record<string, unknown>);
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true });
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const msg = error instanceof Error ? error.message : String(error);
      console.error('POST /api/data failed:', msg);
      return res.status(500).json({ error: 'Full sync failed', details: msg });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
