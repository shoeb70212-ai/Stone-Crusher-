/**
 * Secure key-value storage that uses @capacitor/preferences on native
 * (Android EncryptedSharedPreferences / iOS Keychain-backed NSUserDefaults)
 * and falls back to plain localStorage on web.
 *
 * Use this for security-sensitive values: session tokens, biometric flags.
 * Non-sensitive large blobs (data backup) can stay in plain localStorage.
 */

import { isNative } from './capacitor';

/**
 * Reads a value from secure storage.
 * @param key - Storage key.
 * @returns The stored string, or null if not found.
 */
export async function secureGet(key: string): Promise<string | null> {
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value;
    } catch {
      // Fall through to localStorage on unexpected error
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes a value to secure storage.
 * @param key   - Storage key.
 * @param value - Value to store.
 */
export async function secureSet(key: string, value: string): Promise<void> {
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
      return;
    } catch {
      // Fall through to localStorage on unexpected error
    }
  }
  try {
    localStorage.setItem(key, value);
  } catch { /* Non-critical */ }
}

/**
 * Removes a value from secure storage.
 * @param key - Storage key to remove.
 */
export async function secureRemove(key: string): Promise<void> {
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
      return;
    } catch {
      // Fall through to localStorage on unexpected error
    }
  }
  try {
    localStorage.removeItem(key);
  } catch { /* Non-critical */ }
}
