import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import adminUsersHandler from "./api/admin-users";

dotenv.config();

type DataRecord = { id?: string; [key: string]: unknown };
type AppData = Record<string, unknown> & {
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "local-data.json");
const PORT = Number(process.env.PORT || 8083);
const HOST = process.env.HOST || "0.0.0.0";
const API_TABLES = new Set([
  "customers",
  "employees",
  "employeeTransactions",
  "slips",
  "transactions",
  "vehicles",
  "invoices",
  "tasks",
  "auditLogs",
]);

const EMPTY_DATA: AppData = {
  customers: [],
  employees: [],
  employeeTransactions: [],
  slips: [],
  transactions: [],
  vehicles: [],
  invoices: [],
  tasks: [],
  auditLogs: [],
  companySettings: {
    name: "CrushTrack Enterprises",
    users: [],
  },
};

function normalizeData(data: AppData): AppData {
  return {
    ...EMPTY_DATA,
    ...data,
    companySettings: {
      ...(EMPTY_DATA.companySettings || {}),
      ...(data.companySettings || {}),
    },
  };
}

async function readData(): Promise<AppData> {
  if (!existsSync(DATA_FILE)) {
    await writeData(EMPTY_DATA);
  }

  const raw = await fs.readFile(DATA_FILE, "utf8");
  return normalizeData(JSON.parse(raw || "{}"));
}

async function writeData(data: AppData): Promise<void> {
  const normalized = normalizeData(data);
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const expected = process.env.API_SECRET;
  if (!expected) return next();

  const provided = req.header("x-api-key");
  if (provided !== expected) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  return next();
}

function upsertById(records: DataRecord[], incoming: DataRecord[]): DataRecord[] {
  const byId = new Map<string, DataRecord>();

  for (const record of records) {
    if (record.id) byId.set(String(record.id), record);
  }

  for (const item of incoming) {
    if (!item.id) continue;
    const sanitized =
      "freightAmount" in item
        ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== "freightAmount"))
        : item;
    byId.set(String(item.id), sanitized);
  }

  return Array.from(byId.values());
}

function deleteById(records: DataRecord[], ids: unknown): DataRecord[] {
  if (!Array.isArray(ids)) return records;
  const toDelete = new Set(ids.map((id) => String(id)));
  return records.filter((record) => !record.id || !toDelete.has(String(record.id)));
}

async function start() {
  const app = express();
  const httpServer = createServer(app);

  app.use(compression());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/data", requireApiKey, async (_req, res) => {
    try {
      const data = await readData();
      const users = Array.isArray(data.companySettings?.users) ? data.companySettings.users : [];
      res.json({ ...data, bootstrapRequired: users.length === 0 });
    } catch (error) {
      console.error("GET /api/data failed:", error);
      res.status(500).json({ error: "Failed to read local data" });
    }
  });

  app.patch("/api/data", requireApiKey, async (req, res) => {
    try {
      const data = await readData();
      const { updates = {}, deletions = {} } = req.body || {};

      for (const [table, value] of Object.entries(updates as Record<string, unknown>)) {
        if (table === "companySettings") {
          data.companySettings = {
            ...(data.companySettings || {}),
            ...(value as Record<string, unknown>),
          };
          continue;
        }

        if (!API_TABLES.has(table) || !Array.isArray(value)) continue;
        const current = Array.isArray(data[table]) ? (data[table] as DataRecord[]) : [];
        data[table] = upsertById(current, value as DataRecord[]);
      }

      for (const [table, ids] of Object.entries(deletions as Record<string, unknown>)) {
        if (!API_TABLES.has(table)) continue;
        const current = Array.isArray(data[table]) ? (data[table] as DataRecord[]) : [];
        data[table] = deleteById(current, ids);
      }

      await writeData(data);
      res.json({ success: true });
    } catch (error) {
      console.error("PATCH /api/data failed:", error);
      res.status(500).json({ error: "Failed to update local data" });
    }
  });

  app.post("/api/data", requireApiKey, async (req, res) => {
    try {
      await writeData(req.body || EMPTY_DATA);
      res.json({ success: true });
    } catch (error) {
      console.error("POST /api/data failed:", error);
      res.status(500).json({ error: "Failed to replace local data" });
    }
  });

  // Proxy admin-users to the Vercel handler (same logic, works locally too)
  app.all("/api/admin-users", (req, res) =>
    adminUsersHandler(req as never, res as never),
  );

  const vite = await createViteServer({
    appType: "spa",
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
    },
  });

  app.use(vite.middlewares);

  httpServer.listen(PORT, HOST, () => {
    console.log(`
CrushTrack ERP Development Server
---------------------------------
Frontend & API: http://localhost:${PORT}
Local Storage:  ${path.basename(DATA_FILE)}
`);
  });
}

start().catch((error) => {
  console.error("Failed to start development server:", error);
  process.exit(1);
});
