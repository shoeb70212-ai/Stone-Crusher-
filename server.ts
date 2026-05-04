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

type DataRecord = { id?: string; version?: number; updatedAt?: string; [key: string]: unknown };
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
  tombstones?: Record<string, TombstoneEntry[]>;
};

/** Tracks deleted record IDs with an expiry so mobile can't resurrect them. */
type TombstoneEntry = { id: string; deletedAt: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "local-data.json");
const PORT = Number(process.env.PORT || 8083);
const HOST = process.env.HOST || "0.0.0.0";
const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;   // 24 hours

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
  tombstones: {},
  companySettings: {
    name: "CrushTrack Enterprises",
    users: [],
  },
};

// ---------------------------------------------------------------------------
// In-memory idempotency cache: key → { status, body, expiresAt }
// ---------------------------------------------------------------------------
type IdempotencyEntry = { status: number; body: unknown; expiresAt: number };
const idempotencyCache = new Map<string, IdempotencyEntry>();

function pruneIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache) {
    if (entry.expiresAt <= now) idempotencyCache.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Data persistence helpers
// ---------------------------------------------------------------------------

function normalizeData(data: AppData): AppData {
  return {
    ...EMPTY_DATA,
    ...data,
    tombstones: { ...(data.tombstones ?? {}) },
    companySettings: {
      ...(EMPTY_DATA.companySettings ?? {}),
      ...(data.companySettings ?? {}),
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

// ---------------------------------------------------------------------------
// Auth middleware — JWKS-based (works with Supabase ECC P-256 signing keys)
// ---------------------------------------------------------------------------

// In-memory JWKS cache so we don't hit the endpoint on every request.
type JwkKey = { kid?: string; kty: string; crv?: string; x?: string; y?: string; n?: string; e?: string };
let jwksCache: { keys: JwkKey[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // re-fetch once per hour

async function getJwks(supabaseUrl: string): Promise<JwkKey[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const json = await res.json() as { keys: JwkKey[] };
  jwksCache = { keys: json.keys, fetchedAt: now };
  return json.keys;
}

async function verifySupabaseJwt(token: string, supabaseUrl: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [headerB64, payloadB64, sigB64] = parts;

  // Decode header to find kid
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")) as { kid?: string; alg?: string };
  const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { exp?: number };

  // Check expiry first — fast path
  if (claims.exp && claims.exp * 1000 <= Date.now()) return false;

  const keys = await getJwks(supabaseUrl);
  const jwk = keys.find((k) => !header.kid || k.kid === header.kid) ?? keys[0];
  if (!jwk) return false;

  // Import the public key (supports both EC P-256 and legacy RSA)
  const algorithm = jwk.kty === "EC"
    ? { name: "ECDSA", namedCurve: "P-256" }
    : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk as JsonWebKey,
    algorithm,
    false,
    ["verify"],
  );

  const sigBytes = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const msgBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const verifyAlg = jwk.kty === "EC"
    ? { name: "ECDSA", hash: "SHA-256" }
    : { name: "RSASSA-PKCS1-v1_5" };

  return crypto.subtle.verify(verifyAlg, cryptoKey, sigBytes, msgBytes);
}

/**
 * Accepts either a valid x-api-key header (shared secret) or a Supabase JWT
 * Bearer token verified against the project's JWKS endpoint.
 * If neither env var is configured, all requests pass (local dev default).
 */
function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const apiSecret = process.env.API_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;

  // No auth configured — open access (local dev)
  if (!apiSecret && !supabaseUrl) {
    next();
    return;
  }

  // Check shared API key (desktop / server-to-server)
  if (apiSecret && req.header("x-api-key") === apiSecret) {
    next();
    return;
  }

  // Check Supabase JWT Bearer token (mobile / web)
  if (supabaseUrl) {
    const authHeader = req.header("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      verifySupabaseJwt(token, supabaseUrl)
        .then((valid) => {
          if (valid) next();
          else res.status(401).json({ error: "Unauthorized" });
        })
        .catch(() => res.status(401).json({ error: "Unauthorized" }));
      return;
    }
  }

  res.status(401).json({ error: "Unauthorized" });
}

// ---------------------------------------------------------------------------
// Tombstone helpers
// ---------------------------------------------------------------------------

/** Add IDs to the tombstone list for a table; prune expired entries. */
function addTombstones(
  tombstones: Record<string, TombstoneEntry[]>,
  table: string,
  ids: string[],
): void {
  const now = new Date().toISOString();
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  const existing = (tombstones[table] ?? []).filter(
    (e) => new Date(e.deletedAt).getTime() > cutoff,
  );
  const newEntries: TombstoneEntry[] = ids.map((id) => ({ id, deletedAt: now }));
  tombstones[table] = [...existing, ...newEntries];
}

/** Returns the set of tombstoned IDs for a table (within TTL). */
function getTombstonedIds(
  tombstones: Record<string, TombstoneEntry[]>,
  table: string,
): Set<string> {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  return new Set(
    (tombstones[table] ?? [])
      .filter((e) => new Date(e.deletedAt).getTime() > cutoff)
      .map((e) => e.id),
  );
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Merge incoming records into the stored list.
 * - Rejects updates whose `version` is lower than the stored record's version.
 * - Skips records whose ID appears in the tombstone set.
 * - Strips the legacy `freightAmount` field.
 * - Bumps `version` and stamps `updatedAt` on every accepted write.
 */
function upsertById(
  records: DataRecord[],
  incoming: DataRecord[],
  tombstonedIds: Set<string>,
): DataRecord[] {
  const byId = new Map<string, DataRecord>();
  for (const record of records) {
    if (record.id) byId.set(String(record.id), record);
  }

  for (const item of incoming) {
    if (!item.id) continue;
    const key = String(item.id);

    // Never resurrect tombstoned records
    if (tombstonedIds.has(key)) continue;

    const stored = byId.get(key);
    const storedVersion = typeof stored?.version === "number" ? stored.version : 0;
    const incomingVersion = typeof item.version === "number" ? item.version : 0;

    // Reject stale updates silently; caller's retry loop will re-fetch
    if (stored && incomingVersion < storedVersion) continue;

    const sanitized = Object.fromEntries(
      Object.entries(item).filter(([k]) => k !== "freightAmount"),
    );

    byId.set(key, {
      ...sanitized,
      version: storedVersion + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  return Array.from(byId.values());
}

function deleteById(records: DataRecord[], ids: unknown): DataRecord[] {
  if (!Array.isArray(ids)) return records;
  const toDelete = new Set(ids.map((id) => String(id)));
  return records.filter((record) => !record.id || !toDelete.has(String(record.id)));
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

async function start() {
  const app = express();
  const httpServer = createServer(app);

  app.use(compression());
  const DEV_ORIGINS = new Set([
    'http://localhost:5173',
    'http://localhost:8081',
    'http://localhost:8083',
  ]);
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || DEV_ORIGINS.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  app.use(express.json({ limit: "25mb" }));

  /**
   * GET /api/data
   * Returns the full dataset, or an incremental delta when ?since=<ISO> is
   * provided. The `since` filter compares each record's `updatedAt` field so
   * mobile clients can fetch only what changed since their last sync.
   */
  app.get("/api/data", requireAuth, async (req, res) => {
    try {
      const data = await readData();
      const users = Array.isArray(data.companySettings?.users) ? data.companySettings.users : [];

      const sinceParam = typeof req.query.since === "string" ? req.query.since : null;

      if (sinceParam) {
        const sinceMs = new Date(sinceParam).getTime();
        if (isNaN(sinceMs)) {
          res.status(400).json({ error: "Invalid ?since value — must be an ISO-8601 timestamp" });
          return;
        }

        // Return only records updated after the given timestamp for each table
        const delta: Record<string, DataRecord[]> = {};
        for (const table of API_TABLES) {
          const rows = Array.isArray(data[table]) ? (data[table] as DataRecord[]) : [];
          delta[table] = rows.filter((r) => {
            if (!r.updatedAt) return true; // no timestamp → always include
            return new Date(r.updatedAt).getTime() > sinceMs;
          });
        }

        res.json({
          ...delta,
          companySettings: data.companySettings,
          tombstones: data.tombstones ?? {},
          bootstrapRequired: users.length === 0,
          syncedAt: new Date().toISOString(),
        });
        return;
      }

      res.json({
        ...data,
        tombstones: data.tombstones ?? {},
        bootstrapRequired: users.length === 0,
        syncedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("GET /api/data failed:", error);
      res.status(500).json({ error: "Failed to read local data" });
    }
  });

  /**
   * PATCH /api/data
   * Merges delta updates and deletions into the stored file.
   *
   * Idempotency: include an `Idempotency-Key` header. Retrying with the same
   * key within 24 hours returns the cached response without re-applying changes.
   *
   * Order: deletions are applied FIRST so that a record deleted on the desktop
   * cannot be resurrected by a mobile update arriving in the same batch.
   */
  app.patch("/api/data", requireAuth, async (req, res) => {
    // Idempotency check
    pruneIdempotencyCache();
    const idemKey = req.header("Idempotency-Key");
    if (idemKey) {
      const cached = idempotencyCache.get(idemKey);
      if (cached) {
        res.status(cached.status).json(cached.body);
        return;
      }
    }

    const sendAndCache = (status: number, body: unknown) => {
      if (idemKey) {
        idempotencyCache.set(idemKey, {
          status,
          body,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }
      res.status(status).json(body);
    };

    try {
      const data = await readData();
      const { updates = {}, deletions = {} } = req.body || {};
      const tombstones = (data.tombstones ?? {}) as Record<string, TombstoneEntry[]>;

      // ── Step 1: Apply deletions FIRST to prevent tombstone resurrection ──
      for (const [table, ids] of Object.entries(deletions as Record<string, unknown>)) {
        if (!API_TABLES.has(table)) continue;
        const current = Array.isArray(data[table]) ? (data[table] as DataRecord[]) : [];
        data[table] = deleteById(current, ids);
        if (Array.isArray(ids)) {
          addTombstones(tombstones, table, ids.map(String));
        }
      }
      data.tombstones = tombstones;

      // ── Step 2: Apply updates (versioned, tombstone-aware) ──
      for (const [table, value] of Object.entries(updates as Record<string, unknown>)) {
        if (table === "companySettings") {
          data.companySettings = {
            ...(data.companySettings ?? {}),
            ...(value as Record<string, unknown>),
          };
          continue;
        }

        if (!API_TABLES.has(table) || !Array.isArray(value)) continue;
        const current = Array.isArray(data[table]) ? (data[table] as DataRecord[]) : [];
        const deadIds = getTombstonedIds(tombstones, table);
        data[table] = upsertById(current, value as DataRecord[], deadIds);
      }

      await writeData(data);
      sendAndCache(200, { success: true, syncedAt: new Date().toISOString() });
    } catch (error) {
      console.error("PATCH /api/data failed:", error);
      // Don't cache error responses — the client should retry
      res.status(500).json({ error: "Failed to update local data" });
    }
  });

  /**
   * POST /api/data — full bulk replace (admin import only).
   */
  app.post("/api/data", requireAuth, async (req, res) => {
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
