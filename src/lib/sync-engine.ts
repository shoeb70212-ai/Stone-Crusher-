import { get, set, keys } from 'idb-keyval';
import { supabase } from './supabase';
import { encryptData, decryptData } from './crypto-utils';

/**
 * sync-engine.ts
 *
 * Architecture (single source of truth):
 *   IndexedDB          = unencrypted local cache on the user's device (offline-first)
 *   Supabase encrypted_records = E2EE cloud mirror — the ONLY remote store
 *
 * Data never flows to any plain-text table. The legacy server.ts / local-data.json
 * path has been removed. Every remote write goes through this module encrypted.
 */

// ---------------------------------------------------------------------------
// Structured logger — always namespaced, dev-only verbose mode
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[sync-engine]';
const isDev = import.meta.env.DEV;

const log = {
  info:  (...args: unknown[]) => isDev && console.info(LOG_PREFIX, ...args),
  warn:  (...args: unknown[]) => console.warn(LOG_PREFIX, ...args),
  error: (...args: unknown[]) => console.error(LOG_PREFIX, ...args),
  debug: (...args: unknown[]) => isDev && console.debug(LOG_PREFIX, ...args),
};

// ---------------------------------------------------------------------------
// Master Key (held in memory only — never persisted to disk or cloud)
// ---------------------------------------------------------------------------

let masterKey: CryptoKey | null = null;

export function setMasterKey(key: CryptoKey): void {
  masterKey = key;
  log.info('Vault unlocked.');
}

export function clearMasterKey(): void {
  masterKey = null;
  log.info('Vault locked.');
}

export function getMasterKey(): CryptoKey | null {
  return masterKey;
}

export function hasMasterKey(): boolean {
  return masterKey !== null;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers — local unencrypted cache, instant reads
// ---------------------------------------------------------------------------

/** Saves a single record to IndexedDB under `collection:id`. */
export async function saveLocalRecord(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await set(`${collection}:${id}`, { ...data, id, _localUpdatedAt: new Date().toISOString() });
}

/** Returns all non-deleted records for a given collection. */
export async function getLocalCollection(collection: string): Promise<Record<string, unknown>[]> {
  const allKeys = await keys();
  const prefix = `${collection}:`;
  const collectionKeys = allKeys.filter(
    (k): k is string => typeof k === 'string' && k.startsWith(prefix),
  );

  const records = await Promise.all(collectionKeys.map((key) => get(key)));
  return records.filter((r): r is Record<string, unknown> => r != null && !r._deleted);
}

/**
 * Returns records split into recent (within `days`) and older buckets.
 * Used for paginated loading — recent data loads immediately, older on demand.
 * Records without a recognizable date field are always treated as recent.
 */
export async function getLocalCollectionRecent(
  collection: string,
  days = 60,
): Promise<{ recent: Record<string, unknown>[]; older: Record<string, unknown>[] }> {
  const allKeys = await keys();
  const prefix = `${collection}:`;
  const collectionKeys = allKeys.filter(
    (k): k is string => typeof k === 'string' && k.startsWith(prefix),
  );

  const cutoff = Date.now() - days * 86_400_000;
  const recent: Record<string, unknown>[] = [];
  const older: Record<string, unknown>[] = [];

  const allRecords = await Promise.all(collectionKeys.map((key) => get(key)));
  for (const record of allRecords) {
    if (!record || record._deleted) continue;

    const dateStr =
      (record.date as string | undefined) ||
      (record.createdAt as string | undefined) ||
      (record.timestamp as string | undefined) ||
      (record.invoiceDate as string | undefined);

    if (dateStr) {
      const t = new Date(dateStr).getTime();
      if (!isNaN(t) && t < cutoff) {
        older.push(record);
        continue;
      }
    }
    recent.push(record);
  }

  return { recent, older };
}

/** Reads a singleton (e.g. companySettings) from IndexedDB. */
export async function getLocalSingleton(key: string): Promise<Record<string, unknown> | null> {
  return (await get(`singleton:${key}`)) ?? null;
}

/** Saves a singleton to IndexedDB. */
export async function saveLocalSingleton(key: string, data: unknown): Promise<void> {
  await set(`singleton:${key}`, data);
}

/** Marks a record as locally deleted (soft tombstone). */
export async function deleteLocalRecord(collection: string, id: string): Promise<void> {
  await set(`${collection}:${id}`, { id, _deleted: true, _localUpdatedAt: new Date().toISOString() });
}

/** Bulk-writes an entire collection to IndexedDB (used on first cloud pull). */
export async function setLocalCollection(
  collection: string,
  dataArray: Record<string, unknown>[],
): Promise<void> {
  await Promise.all(
    dataArray
      .filter((item) => item.id)
      .map((item) => set(`${collection}:${item.id}`, item)),
  );
}

/**
 * Loads all named collections in a single pass over IndexedDB keys.
 * Splits timed collections into recent/older buckets.
 * Much faster than calling getLocalCollection/getLocalCollectionRecent individually
 * because keys() is called only once.
 */
export async function loadAllCollections(
  simpleCollections: string[],
  timedCollections: { name: string; days: number }[],
): Promise<{
  simple: Record<string, Record<string, unknown>[]>;
  timed: Record<string, { recent: Record<string, unknown>[]; older: Record<string, unknown>[] }>;
}> {
  const allKeys = await keys();
  const stringKeys = allKeys.filter((k): k is string => typeof k === 'string');

  const now = Date.now();

  // Group keys by collection prefix
  const keysByCollection: Record<string, string[]> = {};
  for (const key of stringKeys) {
    const colon = key.indexOf(':');
    if (colon === -1) continue;
    const col = key.slice(0, colon);
    if (!keysByCollection[col]) keysByCollection[col] = [];
    keysByCollection[col].push(key);
  }

  // Fetch all relevant keys in one parallel burst
  const allCollectionNames = [
    ...simpleCollections,
    ...timedCollections.map((c) => c.name),
  ];
  const keysToFetch: string[] = [];
  for (const col of allCollectionNames) {
    for (const key of keysByCollection[col] ?? []) {
      keysToFetch.push(key);
    }
  }

  const fetched = await Promise.all(keysToFetch.map((key) => get(key)));
  const fetchMap: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < keysToFetch.length; i++) {
    if (fetched[i] != null) fetchMap[keysToFetch[i]] = fetched[i];
  }

  // Assemble simple collections
  const simple: Record<string, Record<string, unknown>[]> = {};
  for (const col of simpleCollections) {
    simple[col] = (keysByCollection[col] ?? [])
      .map((k) => fetchMap[k])
      .filter((r): r is Record<string, unknown> => r != null && !r._deleted);
  }

  // Assemble timed collections
  const timed: Record<string, { recent: Record<string, unknown>[]; older: Record<string, unknown>[] }> = {};
  for (const { name, days } of timedCollections) {
    const cutoff = now - days * 86_400_000;
    const recent: Record<string, unknown>[] = [];
    const older: Record<string, unknown>[] = [];
    for (const key of keysByCollection[name] ?? []) {
      const record = fetchMap[key];
      if (!record || record._deleted) continue;
      const dateStr =
        (record.date as string | undefined) ||
        (record.createdAt as string | undefined) ||
        (record.timestamp as string | undefined) ||
        (record.invoiceDate as string | undefined);
      if (dateStr) {
        const t = new Date(dateStr).getTime();
        if (!isNaN(t) && t < cutoff) { older.push(record); continue; }
      }
      recent.push(record);
    }
    timed[name] = { recent, older };
  }

  return { simple, timed };
}

/** Returns true when IndexedDB has no business data (first-boot detection). */
export async function isLocalEmpty(): Promise<boolean> {
  const allKeys = await keys();
  return !allKeys.some(
    (k): k is string => typeof k === 'string' && !k.startsWith('singleton:') && k.includes(':'),
  );
}

// ---------------------------------------------------------------------------
// Supabase Cloud Sync — Delta Push (encrypted)
// ---------------------------------------------------------------------------

/**
 * Encrypts and upserts only the changed records to Supabase.
 * Deletions are written as tombstone rows (is_deleted = true, empty payload).
 * Throws if the Supabase upsert fails so the caller can requeue.
 */
export async function pushDeltaToCloud(
  updates: Record<string, unknown[]> & { companySettings?: unknown },
  deletions: Record<string, string[]>,
): Promise<void> {
  if (!masterKey) {
    log.warn('pushDeltaToCloud skipped — vault is locked.');
    return;
  }

  const payloads: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  for (const [collection, items] of Object.entries(updates)) {
    if (collection === 'companySettings') {
      payloads.push({
        id: 'companySettings_singleton',
        collection_name: 'companySettings',
        encrypted_data: await encryptData(items, masterKey),
        is_deleted: false,
        updated_at: now,
      });
      continue;
    }

    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const rec = item as Record<string, unknown>;
      if (!rec.id) continue;
      payloads.push({
        id: rec.id,
        collection_name: collection,
        encrypted_data: await encryptData(rec, masterKey),
        is_deleted: false,
        updated_at: now,
      });
    }
  }

  for (const [collection, ids] of Object.entries(deletions)) {
    for (const id of ids) {
      payloads.push({
        id,
        collection_name: collection,
        encrypted_data: '',
        is_deleted: true,
        updated_at: now,
      });
    }
  }

  if (payloads.length === 0) return;

  log.debug(`Pushing ${payloads.length} record(s) to cloud...`);

  const { error } = await supabase
    .from('encrypted_records')
    .upsert(payloads, { onConflict: 'id' });

  if (error) {
    log.error('pushDeltaToCloud failed:', error.message);
    throw error;
  }

  log.debug(`Delta push complete (${payloads.length} records).`);
}

// ---------------------------------------------------------------------------
// Supabase Cloud Sync — Full Pull (encrypted)
// ---------------------------------------------------------------------------

/**
 * Fetches all non-deleted records from Supabase, decrypts them, saves each
 * to IndexedDB, and returns the full dataset grouped by collection.
 *
 * Returns null when the vault is locked or the cloud is empty.
 */
type CloudPullResult = { [collection: string]: unknown; companySettings?: unknown };

export async function pullAllFromCloud(): Promise<CloudPullResult | null> {
  if (!masterKey) {
    log.warn('pullAllFromCloud skipped — vault is locked.');
    return null;
  }

  const { data, error } = await supabase
    .from('encrypted_records')
    .select('id, collection_name, encrypted_data')
    .eq('is_deleted', false);

  if (error) {
    log.error('pullAllFromCloud failed:', error.message);
    throw error;
  }

  if (!data || data.length === 0) {
    log.info('Cloud pull: no records found.');
    return null;
  }

  log.info(`Cloud pull: decrypting ${data.length} records...`);

  const collections: Record<string, unknown[]> = {};
  let companySettings: unknown = null;
  let skipped = 0;

  // Decrypt all records in parallel (AES-GCM is CPU-bound, parallelism helps)
  const decryptResults = await Promise.all(
    data
      .filter((row) => row.collection_name !== '__system__')
      .map(async (row) => {
        try {
          const decrypted = await decryptData(row.encrypted_data as string, masterKey!);
          return { ok: true as const, row, decrypted };
        } catch {
          return { ok: false as const, row };
        }
      }),
  );

  const idbWrites: Promise<void>[] = [];

  for (const result of decryptResults) {
    if (!result.ok) {
      skipped++;
      log.warn(`Failed to decrypt record ${result.row.id} (collection: ${result.row.collection_name}) — skipped.`);
      continue;
    }

    const { row, decrypted } = result;

    if (row.collection_name === 'companySettings') {
      companySettings = decrypted;
      idbWrites.push(saveLocalSingleton('companySettings', decrypted));
      continue;
    }

    if (!collections[row.collection_name]) collections[row.collection_name] = [];
    collections[row.collection_name].push(decrypted as Record<string, unknown>);

    const rec = decrypted as Record<string, unknown>;
    if (rec.id) idbWrites.push(set(`${row.collection_name}:${rec.id}`, rec));
  }

  // Flush all IDB writes in parallel
  await Promise.all(idbWrites);

  if (skipped > 0) log.warn(`${skipped} record(s) could not be decrypted and were skipped.`);

  const total = Object.values(collections).reduce((s, a) => s + a.length, 0);
  log.info(`Cloud pull complete: ${total} records across ${Object.keys(collections).length} collections.`);

  return { ...collections, companySettings };
}

// ---------------------------------------------------------------------------
// Full Push — encrypts and uploads entire dataset (one-time migration / re-sync)
// ---------------------------------------------------------------------------

/**
 * Encrypts and uploads every record in the provided dataset to Supabase.
 * Chunks into batches of 500 to stay within Supabase request limits.
 * Throws on any chunk failure so the caller can surface the error.
 */
export async function pushFullDatasetToCloud(
  data: Record<string, unknown[]> & { companySettings?: unknown },
): Promise<void> {
  if (!masterKey) throw new Error('Cannot push: vault is locked.');

  const payloads: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  for (const [collection, items] of Object.entries(data)) {
    if (collection === 'companySettings') {
      payloads.push({
        id: 'companySettings_singleton',
        collection_name: 'companySettings',
        encrypted_data: await encryptData(items, masterKey),
        is_deleted: false,
        updated_at: now,
      });
      continue;
    }

    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const rec = item as Record<string, unknown>;
      if (!rec.id) continue;
      payloads.push({
        id: rec.id,
        collection_name: collection,
        encrypted_data: await encryptData(rec, masterKey),
        is_deleted: false,
        updated_at: now,
      });
    }
  }

  if (payloads.length === 0) {
    log.info('pushFullDatasetToCloud: nothing to push.');
    return;
  }

  const CHUNK = 500;
  log.info(`Full push: uploading ${payloads.length} records in chunks of ${CHUNK}...`);

  for (let i = 0; i < payloads.length; i += CHUNK) {
    const chunk = payloads.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('encrypted_records')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      log.error(`Full push failed at chunk starting index ${i}:`, error.message);
      throw error;
    }
  }

  log.info(`Full push complete: ${payloads.length} records uploaded.`);
}
