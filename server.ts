import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const DATA_FILE = path.join(process.cwd(), 'local-data.json');

// Simple in-memory rate limiter (resets every minute)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // Max requests per minute
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  let record = requestCounts.get(ip);
  
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + RATE_WINDOW_MS };
    requestCounts.set(ip, record);
    return next();
  }
  
  record.count++;
  
  if (record.count > RATE_LIMIT) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }
  
  next();
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(rateLimitMiddleware);

  // Load initial data if file doesn't exist
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      customers: [],
      slips: [],
      transactions: [],
      vehicles: [],
      invoices: [],
      tasks: [],
      companySettings: {
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
          { id: "1", name: "10mm", defaultPrice: 450, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
          { id: "2", name: "20mm", defaultPrice: 480, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
          { id: "3", name: "40mm", defaultPrice: 400, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
          { id: "4", name: "Dust", defaultPrice: 350, unit: "Ton", hsnCode: "25171010", gstRate: 5 }
        ]
      }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }

  // Tables that may be written via the API — prevents prototype pollution
  // and arbitrary key injection from crafted payloads.
  const ALLOWED_TABLES = new Set([
    'customers', 'slips', 'transactions', 'vehicles', 'invoices', 'tasks', 'companySettings',
  ]);

  // Required top-level keys for a valid full-backup restore payload.
  const REQUIRED_BACKUP_KEYS = ['customers', 'slips', 'transactions', 'vehicles', 'invoices', 'tasks', 'companySettings'];

  // API Endpoints
  app.get('/api/data', (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to read data' });
    }
  });

  app.post('/api/data', (req, res) => {
    try {
      const body = req.body;
      // Validate the backup structure before overwriting to prevent wiping data
      // with an empty or malformed payload (e.g. from a corrupted file restore).
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'Invalid backup: payload must be a JSON object.' });
      }
      const missingKeys = REQUIRED_BACKUP_KEYS.filter((k) => !(k in body));
      if (missingKeys.length > 0) {
        return res.status(400).json({
          error: `Invalid backup: missing required keys: ${missingKeys.join(', ')}.`,
        });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save data' });
    }
  });

  app.patch('/api/data', (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      const { updates, deletions } = req.body;

      if (updates) {
        for (const [table, items] of Object.entries(updates)) {
          // Reject unknown table names to prevent prototype pollution.
          if (!ALLOWED_TABLES.has(table)) continue;

          if (table === 'companySettings') {
            data.companySettings = items;
          } else {
            if (!data[table]) data[table] = [];
            for (const item of (items as any[])) {
              const idx = data[table].findIndex((i: any) => i.id === item.id);
              if (idx >= 0) data[table][idx] = item;
              else data[table].push(item);
            }
          }
        }
      }

      if (deletions) {
        for (const [table, ids] of Object.entries(deletions)) {
          if (!ALLOWED_TABLES.has(table)) continue;
          if (data[table]) {
            data[table] = data[table].filter((i: any) => !(ids as string[]).includes(i.id));
          }
        }
      }

      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to patch data' });
    }
  });

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  // Serve index.html for all other routes
  app.use(async (req, res, next) => {
    const url = req.originalUrl;
    // Skip API routes that might have fallen through
    if (url.startsWith('/api/')) return next();
    
    try {
      let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  const port = process.env.PORT ? parseInt(process.env.PORT) : 8081;
  app.listen(port, () => {
    console.log(`
🚀 CrushTrack ERP Development Server
------------------------------------
Frontend & API: http://localhost:${port}
Local Storage:  local-data.json
    `);
  });
}

startServer();
