import express from 'express';
import { createServer as createViteServer } from 'vite';
import puppeteer from 'puppeteer';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/crusher',
});

// Initialize Schema
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, "openingBalance" DOUBLE PRECISION);
    CREATE TABLE IF NOT EXISTS vehicles (id TEXT PRIMARY KEY, "vehicleNo" TEXT, "ownerName" TEXT, "ownerPhone" TEXT, "driverName" TEXT, "driverPhone" TEXT, "defaultMeasurementType" TEXT, measurement JSONB);
    CREATE TABLE IF NOT EXISTS slips (id TEXT PRIMARY KEY, date TEXT, "vehicleNo" TEXT, "driverName" TEXT, "driverPhone" TEXT, "materialType" TEXT, "deliveryMode" TEXT, "measurementType" TEXT, measurement JSONB, quantity DOUBLE PRECISION, "ratePerUnit" DOUBLE PRECISION, "freightAmount" DOUBLE PRECISION, "totalAmount" DOUBLE PRECISION, "amountPaid" DOUBLE PRECISION, "customerId" TEXT, status TEXT, notes TEXT, "operatorName" TEXT, "loaderName" TEXT, "invoiceId" TEXT);
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, date TEXT, type TEXT, amount DOUBLE PRECISION, category TEXT, description TEXT, "customerId" TEXT, "slipId" TEXT);
    CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, "invoiceNo" TEXT, date TEXT, "customerId" TEXT, type TEXT, items JSONB, "subTotal" DOUBLE PRECISION, cgst DOUBLE PRECISION, sgst DOUBLE PRECISION, total DOUBLE PRECISION, status TEXT);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT, completed INTEGER, "createdAt" TEXT);
    CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data JSONB);
  `);

  // Helper to seed default settings if missing
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
      expenseCategories: ["Diesel", "Maintenance", "Salaries", "Rent", "Office Supplies", "Electricity"]
    })]);
  }
}

async function startServer() {
  await initDb();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Data API
  app.get('/api/data', async (req, res) => {
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
        vehicles: vehiclesRes.rows.map(v => ({ ...v, measurement: typeof v.measurement === 'string' ? JSON.parse(v.measurement) : v.measurement })),
        slips: slipsRes.rows.map(s => ({ ...s, measurement: typeof s.measurement === 'string' ? JSON.parse(s.measurement) : s.measurement })),
        transactions: transactionsRes.rows,
        invoices: invoicesRes.rows.map(i => ({ ...i, items: typeof i.items === 'string' ? JSON.parse(i.items) : i.items })),
        tasks: tasksRes.rows.map(t => ({ ...t, completed: !!t.completed })),
        companySettings: typeof settingsRes.rows[0]?.data === 'string' ? JSON.parse(settingsRes.rows[0].data) : settingsRes.rows[0]?.data
      };
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  app.post('/api/data', async (req, res) => {
    const { customers, slips, transactions, vehicles, invoices, tasks, companySettings } = req.body;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Clear tables
      await client.query('DELETE FROM customers');
      for (const c of customers) {
        await client.query('INSERT INTO customers (id, name, phone, "openingBalance") VALUES ($1, $2, $3, $4)', [c.id, c.name, c.phone, c.openingBalance]);
      }

      await client.query('DELETE FROM vehicles');
      for (const v of vehicles) {
        await client.query('INSERT INTO vehicles (id, "vehicleNo", "ownerName", "ownerPhone", "driverName", "driverPhone", "defaultMeasurementType", measurement) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [v.id, v.vehicleNo, v.ownerName, v.ownerPhone, v.driverName, v.driverPhone, v.defaultMeasurementType, JSON.stringify(v.measurement)]);
      }

      await client.query('DELETE FROM slips');
      for (const s of slips) {
        await client.query('INSERT INTO slips (id, date, "vehicleNo", "driverName", "driverPhone", "materialType", "deliveryMode", "measurementType", measurement, quantity, "ratePerUnit", "freightAmount", "totalAmount", "amountPaid", "customerId", status, notes, "operatorName", "loaderName", "invoiceId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)', [s.id, s.date, s.vehicleNo, s.driverName, s.driverPhone, s.materialType, s.deliveryMode, s.measurementType, JSON.stringify(s.measurement), s.quantity, s.ratePerUnit, s.freightAmount, s.totalAmount, s.amountPaid, s.customerId, s.status, s.notes, s.operatorName, s.loaderName, s.invoiceId]);
      }

      await client.query('DELETE FROM transactions');
      for (const t of transactions) {
        await client.query('INSERT INTO transactions (id, date, type, amount, category, description, "customerId", "slipId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [t.id, t.date, t.type, t.amount, t.category, t.description, t.customerId, t.slipId]);
      }

      await client.query('DELETE FROM invoices');
      for (const i of invoices) {
        await client.query('INSERT INTO invoices (id, "invoiceNo", date, "customerId", type, items, "subTotal", cgst, sgst, total, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [i.id, i.invoiceNo, i.date, i.customerId, i.type, JSON.stringify(i.items), i.subTotal, i.cgst, i.sgst, i.total, i.status]);
      }

      await client.query('DELETE FROM tasks');
      for (const t of tasks) {
        await client.query('INSERT INTO tasks (id, title, completed, "createdAt") VALUES ($1, $2, $3, $4)', [t.id, t.title, t.completed ? 1 : 0, t.createdAt]);
      }

      // Update settings
      const { rows } = await client.query('SELECT id FROM settings WHERE id = $1', ['global']);
      if (rows.length > 0) {
        await client.query('UPDATE settings SET data = $1 WHERE id = $2', [JSON.stringify(companySettings), 'global']);
      } else {
        await client.query('INSERT INTO settings (id, data) VALUES ($1, $2)', ['global', JSON.stringify(companySettings)]);
      }

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Sync failed:", error);
      res.status(500).json({ error: "Sync failed" });
    } finally {
      client.release();
    }
  });

  // PDF Generation API
  app.post('/api/pdf', async (req, res) => {
    try {
      const { html, format } = req.body;
      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      let width = '210mm', height = '297mm';
      if (format === 'Thermal-80mm') width = '80mm';
      else if (format === 'Thermal-58mm') width = '58mm';

      const pdf = await page.pdf({ width, height, printBackground: true });
      await browser.close();
      res.contentType("application/pdf").send(Buffer.from(pdf));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath), (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
