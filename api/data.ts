import { Pool } from 'pg';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize Schema (runs once per cold start)
let dbInitialized = false;

async function initDb() {
  if (dbInitialized) return;
  console.log("Initializing database schema...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, "openingBalance" DOUBLE PRECISION);
      CREATE TABLE IF NOT EXISTS vehicles (id TEXT PRIMARY KEY, "vehicleNo" TEXT, "ownerName" TEXT, "ownerPhone" TEXT, "driverName" TEXT, "driverPhone" TEXT, "defaultMeasurementType" TEXT, measurement JSONB, "isActive" BOOLEAN DEFAULT TRUE);
      CREATE TABLE IF NOT EXISTS slips (id TEXT PRIMARY KEY, date TEXT, "vehicleNo" TEXT, "driverName" TEXT, "driverPhone" TEXT, "materialType" TEXT, "deliveryMode" TEXT, "measurementType" TEXT, measurement JSONB, quantity DOUBLE PRECISION, "ratePerUnit" DOUBLE PRECISION, "freightAmount" DOUBLE PRECISION, "totalAmount" DOUBLE PRECISION, "amountPaid" DOUBLE PRECISION, "customerId" TEXT, status TEXT, notes TEXT, "operatorName" TEXT, "loaderName" TEXT, "invoiceId" TEXT);
      CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, date TEXT, type TEXT, amount DOUBLE PRECISION, category TEXT, description TEXT, "customerId" TEXT, "slipId" TEXT);
      CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, "invoiceNo" TEXT, date TEXT, "customerId" TEXT, type TEXT, items JSONB, "subTotal" DOUBLE PRECISION, cgst DOUBLE PRECISION, sgst DOUBLE PRECISION, total DOUBLE PRECISION, status TEXT);
      CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT, completed INTEGER, "createdAt" TEXT);
      CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data JSONB);
    `);

    // Migration: Add isActive to vehicles if it doesn't exist
    try {
      await pool.query('ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE');
    } catch (e) {
      // Column might already exist
    }

    const { rows } = await pool.query('SELECT * FROM settings WHERE id = $1', ['global']);
    if (rows.length === 0) {
      await pool.query('INSERT INTO settings (id, data) VALUES ($1, $2)', ['global', JSON.stringify({
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
          { id: "4", name: "Dust", defaultPrice: 350, unit: "Ton", hsnCode: "25171010", gstRate: 5, isActive: true }
        ]
      })]);
    }
    dbInitialized = true;
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await initDb();
  } catch (error: any) {
    return res.status(500).json({ 
      error: "Failed to initialize database", 
      details: error.message,
      code: error.code 
    });
  }

  if (req.method === 'GET') {
    try {
      const [
        customersRes,
        vehiclesRes,
        slipsRes,
        transactionsRes,
        invoicesRes,
        tasksRes,
        settingsRes
      ] = await Promise.all([
        pool.query('SELECT * FROM customers'),
        pool.query('SELECT * FROM vehicles'),
        pool.query('SELECT * FROM slips'),
        pool.query('SELECT * FROM transactions'),
        pool.query('SELECT * FROM invoices'),
        pool.query('SELECT * FROM tasks'),
        pool.query('SELECT data FROM settings WHERE id = $1', ['global'])
      ]);

      const data = {
        customers: customersRes.rows,
        vehicles: vehiclesRes.rows.map(v => ({ 
          ...v, 
          isActive: v.isActive !== false,
          measurement: typeof v.measurement === 'string' ? JSON.parse(v.measurement) : v.measurement 
        })),
        slips: slipsRes.rows.map(s => ({ ...s, measurement: typeof s.measurement === 'string' ? JSON.parse(s.measurement) : s.measurement })),
        transactions: transactionsRes.rows,
        invoices: invoicesRes.rows.map(i => ({ ...i, items: typeof i.items === 'string' ? JSON.parse(i.items) : i.items })),
        tasks: tasksRes.rows.map(t => ({ ...t, completed: !!t.completed })),
        companySettings: typeof settingsRes.rows[0]?.data === 'string' ? JSON.parse(settingsRes.rows[0].data) : settingsRes.rows[0]?.data
      };
      return res.status(200).json(data);
    } catch (error: any) {
      console.error("Fetch data failed:", error);
      return res.status(500).json({ error: "Failed to fetch data", details: error.message });
    }
  }

  if (req.method === 'PATCH') {
    const { updates, deletions } = req.body;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (updates) {
         for (const [table, items] of Object.entries(updates)) {
            if (!items || (Array.isArray(items) && items.length === 0)) continue;
            
            if (table === 'companySettings') {
               await client.query('INSERT INTO settings (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', ['global', JSON.stringify(items)]);
               continue;
            }
            
            const arr = items as any[];
            for (const item of arr) {
               const keys = Object.keys(item);
               const columns = keys.map(k => `"${k}"`).join(', ');
               const values = keys.map(k => typeof item[k] === 'object' && item[k] !== null ? JSON.stringify(item[k]) : item[k]);
               const placeholders = keys.map((_, i) => `$${i+1}`).join(', ');
               const updatesStr = keys.filter(k => k !== 'id').map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');
               
               let query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
               if (updatesStr.length > 0) {
                  query += ` ON CONFLICT (id) DO UPDATE SET ${updatesStr}`;
               } else {
                  query += ` ON CONFLICT (id) DO NOTHING`;
               }
               
               await client.query(query, values);
            }
         }
      }
      
      if (deletions) {
         for (const [table, ids] of Object.entries(deletions)) {
            if (!ids || (ids as string[]).length === 0) continue;
            const placeholders = (ids as string[]).map((_, i) => `$${i+1}`).join(', ');
            await client.query(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids as string[]);
         }
      }
      
      await client.query('COMMIT');
      client.release();
      return res.status(200).json({ success: true });
    } catch (error: any) {
      await client.query('ROLLBACK');
      client.release();
      console.error("Delta Sync failed:", error);
      return res.status(500).json({ error: "Failed to sync data", details: error.message });
    }
  }

  if (req.method === 'POST') {
    const { customers, slips, transactions, vehicles, invoices, tasks, companySettings } = req.body;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      await client.query('DELETE FROM customers');
      for (const c of customers || []) {
        await client.query('INSERT INTO customers (id, name, phone, "openingBalance") VALUES ($1, $2, $3, $4)', [c.id, c.name, c.phone, c.openingBalance]);
      }

      await client.query('DELETE FROM vehicles');
      for (const v of vehicles || []) {
        await client.query('INSERT INTO vehicles (id, "vehicleNo", "ownerName", "ownerPhone", "driverName", "driverPhone", "defaultMeasurementType", measurement, "isActive") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [v.id, v.vehicleNo, v.ownerName, v.ownerPhone, v.driverName, v.driverPhone, v.defaultMeasurementType, JSON.stringify(v.measurement), v.isActive !== false]);
      }

      await client.query('DELETE FROM slips');
      for (const s of slips || []) {
        await client.query('INSERT INTO slips (id, date, "vehicleNo", "driverName", "driverPhone", "materialType", "deliveryMode", "measurementType", measurement, quantity, "ratePerUnit", "freightAmount", "totalAmount", "amountPaid", "customerId", status, notes, "operatorName", "loaderName", "invoiceId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)', [s.id, s.date, s.vehicleNo, s.driverName, s.driverPhone, s.materialType, s.deliveryMode, s.measurementType, JSON.stringify(s.measurement), s.quantity, s.ratePerUnit, s.freightAmount, s.totalAmount, s.amountPaid, s.customerId, s.status, s.notes, s.operatorName, s.loaderName, s.invoiceId]);
      }

      await client.query('DELETE FROM transactions');
      for (const t of transactions || []) {
        await client.query('INSERT INTO transactions (id, date, type, amount, category, description, "customerId", "slipId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [t.id, t.date, t.type, t.amount, t.category, t.description, t.customerId, t.slipId]);
      }

      await client.query('DELETE FROM invoices');
      for (const i of invoices || []) {
        await client.query('INSERT INTO invoices (id, "invoiceNo", date, "customerId", type, items, "subTotal", cgst, sgst, total, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [i.id, i.invoiceNo, i.date, i.customerId, i.type, JSON.stringify(i.items), i.subTotal, i.cgst, i.sgst, i.total, i.status]);
      }

      await client.query('DELETE FROM tasks');
      for (const t of tasks || []) {
        await client.query('INSERT INTO tasks (id, title, completed, "createdAt") VALUES ($1, $2, $3, $4)', [t.id, t.title, t.completed ? 1 : 0, t.createdAt]);
      }

      if (companySettings) {
        const { rows } = await client.query('SELECT id FROM settings WHERE id = $1', ['global']);
        if (rows.length > 0) {
          await client.query('UPDATE settings SET data = $1 WHERE id = $2', [JSON.stringify(companySettings), 'global']);
        } else {
          await client.query('INSERT INTO settings (id, data) VALUES ($1, $2)', ['global', JSON.stringify(companySettings)]);
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error("Sync failed:", error);
      return res.status(500).json({ error: "Sync failed", details: error.message });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
