import { get, set, del, keys } from 'idb-keyval';
import { supabase } from './supabase';
import { encryptData, decryptData } from './crypto-utils';

/**
 * sync-engine.ts
 * Manages the Local-First IndexedDB cache and the End-to-End Encrypted (E2EE)
 * sync with Supabase.
 *
 * Architecture:
 *   IndexedDB  = unencrypted local cache on the user's device (trusted)
 *   Supabase   = encrypted cloud mirror (untrusted — E2EE)
 *   server.ts  = legacy fallback for first-time migration only
 */

// ---------------------------------------------------------------------------
// Master Key (held in memory only — never persisted)
// ---------------------------------------------------------------------------

let masterKey: CryptoKey | null = null;

export function setMasterKey(key: CryptoKey) {
  masterKey = key;
}

export function getMasterKey(): CryptoKey | null {
  return masterKey;
}

export function hasMasterKey(): boolean {
  return masterKey !== null;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers (local, unencrypted, instant)
// ---------------------------------------------------------------------------

/**
 * Saves a single record to IndexedDB under `collection:id`.
 */
export async function saveLocalRecord(collection: string, id: string, data: any): Promise<void> {
  const recordKey = `${collection}:${id}`;
  await set(recordKey, { ...data, id, _localUpdatedAt: new Date().toISOString() });
}

/**
 * Retrieves all non-deleted records for a given collection from IndexedDB.
 */
export async function getLocalCollection(collection: string): Promise<any[]> {
  const allKeys = await keys();
  const collectionKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(`${collection}:`)
  );

  const records: any[] = [];
  for (const key of collectionKeys) {
    const record = await get(key as string);
    if (record && !record._deleted) {
      records.push(record);
    }
  }
  return records;
}

/**
 * Retrieves records from a collection that fall within the last N days.
 * Uses common date fields (date, createdAt, timestamp) to filter.
 * Records without a recognizable date field are always included.
 */
export async function getLocalCollectionRecent(
  collection: string,
  days: number = 60,
): Promise<{ recent: any[]; older: any[] }> {
  const allKeys = await keys();
  const collectionKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(`${collection}:`)
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffTime = cutoff.getTime();

  const recent: any[] = [];
  const older: any[] = [];

  for (const key of collectionKeys) {
    const record = await get(key as string);
    if (!record || record._deleted) continue;

    // Try common date fields
    const dateStr = record.date || record.createdAt || record.timestamp || record.invoiceDate;
    if (dateStr) {
      const recordTime = new Date(dateStr).getTime();
      if (!isNaN(recordTime) && recordTime < cutoffTime) {
        older.push(record);
        continue; // Skip old records
      }
    }

    // No date field or within window — include it
    recent.push(record);
  }

  return { recent, older };
}

/**
 * Reads a singleton record (like companySettings) from IndexedDB.
 */
export async function getLocalSingleton(key: string): Promise<any | null> {
  return (await get(`singleton:${key}`)) ?? null;
}

/**
 * Saves a singleton record (like companySettings) to IndexedDB.
 */
export async function saveLocalSingleton(key: string, data: any): Promise<void> {
  await set(`singleton:${key}`, data);
}

/**
 * Marks a record as deleted locally (tombstone).
 */
export async function deleteLocalRecord(collection: string, id: string): Promise<void> {
  const recordKey = `${collection}:${id}`;
  await set(recordKey, { id, _deleted: true, _localUpdatedAt: new Date().toISOString() });
}

/**
 * Bulk-writes an entire collection to IndexedDB.
 * Used during initial migration from server.ts or first cloud pull.
 */
export async function setLocalCollection(collection: string, dataArray: any[]): Promise<void> {
  for (const item of dataArray) {
    if (item.id) {
      await set(`${collection}:${item.id}`, item);
    }
  }
}

/**
 * Checks if IndexedDB has any data at all (used to detect first boot).
 */
export async function isLocalEmpty(): Promise<boolean> {
  const allKeys = await keys();
  // Filter out system keys
  const dataKeys = allKeys.filter(
    (k) => typeof k === 'string' && !k.startsWith('singleton:') && k.includes(':')
  );
  return dataKeys.length === 0;
}

// ---------------------------------------------------------------------------
// Supabase Cloud Sync — Encrypted Push (Delta)
// ---------------------------------------------------------------------------

/**
 * Pushes only the changed records (delta) to Supabase, encrypted.
 * Called by ErpContext's flushSyncQueue with the same payload format
 * as the old PATCH /api/data.
 */
export async function pushDeltaToCloud(
  updates: Record<string, any[]> & { companySettings?: any },
  deletions: Record<string, string[]>,
): Promise<void> {
  if (!masterKey) {
    console.warn('[sync-engine] pushDeltaToCloud skipped: vault not unlocked.');
    return;
  }

  const payloads: any[] = [];

  // ── Encrypt and queue updates ──
  for (const [collection, items] of Object.entries(updates)) {
    if (collection === 'companySettings') {
      // CompanySettings is a singleton — encrypt the whole object
      const encrypted = await encryptData(items, masterKey);
      payloads.push({
        id: 'companySettings_singleton',
        collection_name: 'companySettings',
        encrypted_data: encrypted,
        is_deleted: false,
        updated_at: new Date().toISOString(),
      });
      continue;
    }

    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item.id) continue;
      const encrypted = await encryptData(item, masterKey);
      payloads.push({
        id: item.id,
        collection_name: collection,
        encrypted_data: encrypted,
        is_deleted: false,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // ── Queue deletions ──
  for (const [collection, ids] of Object.entries(deletions)) {
    for (const id of ids) {
      // We still need to store an encrypted tombstone so other devices know
      // this record was intentionally deleted.
      payloads.push({
        id,
        collection_name: collection,
        encrypted_data: '',
        is_deleted: true,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (payloads.length === 0) return;

  // Batch upsert to Supabase
  const { error } = await supabase
    .from('encrypted_records')
    .upsert(payloads, { onConflict: 'id' });

  if (error) {
    console.error('[sync-engine] pushDeltaToCloud failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Supabase Cloud Sync — Encrypted Pull (Full)
// ---------------------------------------------------------------------------

/**
 * Pulls all records from Supabase, decrypts them, and returns them grouped
 * by collection. Also saves each record to IndexedDB.
 *
 * Returns null if the vault is locked or Supabase is empty.
 */
export async function pullAllFromCloud(): Promise<
  | (Record<string, any[]> & { companySettings?: any })
  | null
> {
  if (!masterKey) {
    console.warn('[sync-engine] pullAllFromCloud skipped: vault not unlocked.');
    return null;
  }

  const { data, error } = await supabase
    .from('encrypted_records')
    .select('*')
    .eq('is_deleted', false);

  if (error) {
    console.error('[sync-engine] pullAllFromCloud failed:', error);
    throw error;
  }

  if (!data || data.length === 0) return null;

  const collections: Record<string, any[]> = {};
  let companySettings: any = null;

  for (const row of data) {
    // Skip system records (salt, verification token, etc.)
    if (row.collection_name === '__system__') continue;

    try {
      const decrypted = await decryptData(row.encrypted_data, masterKey);

      if (row.collection_name === 'companySettings') {
        companySettings = decrypted;
        // Save to IndexedDB
        await saveLocalSingleton('companySettings', decrypted);
        continue;
      }

      if (!collections[row.collection_name]) {
        collections[row.collection_name] = [];
      }
      collections[row.collection_name].push(decrypted);

      // Save each decrypted record to IndexedDB for offline use
      if (decrypted.id) {
        await set(`${row.collection_name}:${decrypted.id}`, decrypted);
      }
    } catch (e) {
      console.error(`[sync-engine] Failed to decrypt record ${row.id}. Skipping.`, e);
    }
  }

  return { ...collections, companySettings };
}

// ---------------------------------------------------------------------------
// Full push — encrypts and uploads ALL local data to Supabase
// Used for first-time migration from server.ts/local-data.json
// ---------------------------------------------------------------------------

/**
 * Pushes the entire local dataset to Supabase (encrypted).
 * Used once during migration from the legacy local-data.json system.
 */
export async function pushFullDatasetToCloud(
  data: Record<string, any[]> & { companySettings?: any }
): Promise<void> {
  if (!masterKey) throw new Error('Cannot push: vault not unlocked.');

  const payloads: any[] = [];

  for (const [collection, items] of Object.entries(data)) {
    if (collection === 'companySettings') {
      const encrypted = await encryptData(items, masterKey);
      payloads.push({
        id: 'companySettings_singleton',
        collection_name: 'companySettings',
        encrypted_data: encrypted,
        is_deleted: false,
        updated_at: new Date().toISOString(),
      });
      continue;
    }

    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item.id) continue;
      const encrypted = await encryptData(item, masterKey);
      payloads.push({
        id: item.id,
        collection_name: collection,
        encrypted_data: encrypted,
        is_deleted: false,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (payloads.length === 0) return;

  // Supabase has a limit on batch size, so chunk into groups of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
    const chunk = payloads.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('encrypted_records')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.error(`[sync-engine] pushFullDatasetToCloud chunk ${i} failed:`, error);
      throw error;
    }
  }

  console.log(`[sync-engine] Full dataset push complete: ${payloads.length} records uploaded.`);
}
