/**
 * Biometric authentication helpers using capacitor-native-biometric.
 *
 * Flow:
 *   1. After a successful password login, call `saveBiometricCredentials(token)`
 *      to store the session token in the device Keychain/Keystore.
 *   2. On app start, call `authenticateWithBiometrics()` — if it resolves, the
 *      stored token is returned and the user can skip the password form.
 *   3. Call `clearBiometricCredentials()` on logout.
 *
 * All functions are no-ops on web (returns undefined / false).
 */

import { isNative } from './capacitor';

const BIOMETRIC_SERVER_KEY = 'crushtrack_auth';
const BIOMETRIC_ENABLED_KEY = 'crushtrack_biometric_enabled';

/** Returns true if biometrics are available and the user has enabled them. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

/** Returns true if the user has previously opted in to biometric login. */
export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Prompts the user with the native biometric dialog and returns the stored
 * session token on success. Returns undefined if biometrics fail or are
 * not set up.
 */
export async function authenticateWithBiometrics(): Promise<string | undefined> {
  if (!isNative() || !isBiometricEnabled()) return undefined;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    // Time-box the biometric prompt so a hung dialog cannot freeze the app.
    const verifyPromise = NativeBiometric.verifyIdentity({
      reason: 'Sign in to CrushTrack',
      title: 'Biometric Login',
      subtitle: 'Use your fingerprint or face to unlock',
      negativeButtonText: 'Use Password',
    });
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Biometric prompt timed out')), 10000),
    );
    await Promise.race([verifyPromise, timeoutPromise]);

    const credentials = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER_KEY });
    return credentials.password; // We store the session token as the "password"
  } catch {
    return undefined;
  }
}

/**
 * Saves the session token to the device Keychain/Keystore and marks biometrics
 * as enabled. Call this after a successful password login when the user opts in.
 */
export async function saveBiometricCredentials(sessionToken: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.setCredentials({
      username: 'crushtrack_user',
      password: sessionToken,
      server: BIOMETRIC_SERVER_KEY,
    });
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

/** Removes stored biometric credentials and disables biometric login. */
export async function clearBiometricCredentials(): Promise<void> {
  try {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    if (!isNative()) return;
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER_KEY });
  } catch { /* Non-critical */ }
}
