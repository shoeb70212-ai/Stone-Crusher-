/**
 * Password hashing using PBKDF2 via the browser's SubtleCrypto API.
 *
 * Hash format stored in UserAccount.passwordHash:
 *   "<hex-salt>:<hex-derived-key>"   (PBKDF2, 200 000 iterations, SHA-256)
 *
 * Legacy format (bare SHA-256, no colon) is still recognised by verifyPassword
 * so existing accounts continue to work. The caller (Login) should re-hash and
 * save on a successful legacy-format login to complete the migration silently.
 */

const PBKDF2_ITERATIONS = 200_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function pbkdf2Derive(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
}

/**
 * Hashes a plaintext password with a random salt using PBKDF2-SHA256.
 * Returns a string in the form "<hex-salt>:<hex-key>" safe to store in DB.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await pbkdf2Derive(password, salt);
  return `${bufToHex(salt)}:${bufToHex(derived)}`;
}

/**
 * Verifies a plaintext password against a stored hash.
 *
 * Supports two formats:
 *   - PBKDF2: "<hex-salt>:<hex-key>"  (current format)
 *   - Legacy:  "<hex-sha256>"          (no colon — migrated silently by Login)
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.includes(':')) {
    // PBKDF2 format
    const [saltHex, keyHex] = storedHash.split(':');
    const salt = hexToBuf(saltHex);
    const derived = await pbkdf2Derive(password, salt);
    const candidate = bufToHex(derived);
    // Constant-time comparison via XOR to prevent timing attacks
    if (candidate.length !== keyHex.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
      diff |= candidate.charCodeAt(i) ^ keyHex.charCodeAt(i);
    }
    return diff === 0;
  }

  // Legacy SHA-256 path — kept for backward compatibility during migration
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const candidate = bufToHex(hashBuffer);
  if (candidate.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns true if the stored hash is in the legacy SHA-256 format.
 * Used by Login to trigger a silent re-hash after successful authentication.
 */
export function isLegacyHash(storedHash: string): boolean {
  return !storedHash.includes(':');
}

/**
 * Sentinel value stored as the fallback admin credential when no users have
 * been configured yet.  The Login page treats this as "setup mode" — it
 * prompts the user to create a real admin account rather than accepting a
 * hard-coded password that could be guessed offline from the bundle.
 */
export const DEFAULT_ADMIN_PASSWORD_HASH = 'SETUP_REQUIRED';
