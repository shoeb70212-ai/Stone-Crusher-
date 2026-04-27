/**
 * Hashes a plaintext password using SHA-256 via the browser's SubtleCrypto API.
 * Returns a hex string that is safe to store in companySettings.users[].passwordHash.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compares a plaintext password against a stored SHA-256 hex hash.
 * Returns true only if they match.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === storedHash;
}

/**
 * Pre-computed SHA-256 hash of the default admin password "admin123".
 * Used as the fallback when no users are configured in companySettings.
 */
export const DEFAULT_ADMIN_PASSWORD_HASH =
  "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";
