/**
 * Barcode / QR scanning helper using @capacitor-mlkit/barcode-scanning.
 *
 * Uses the `scan()` method which opens a full-screen native scanner UI —
 * no camera permission boilerplate needed; the OS prompts automatically.
 *
 * On Android: uses Google ML Kit's native scanner module (fast, offline).
 * On iOS: uses AVFoundation via the plugin.
 * On web: returns undefined (no fallback — camera input is used for documents only).
 */

import { isNative } from './capacitor';

/**
 * Opens the native barcode/QR scanner and returns the decoded string value,
 * or undefined if the user cancelled or the platform is not native.
 */
export async function scanBarcode(): Promise<string | undefined> {
  if (!isNative()) return undefined;

  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

    // On Android, the Google Barcode Scanner module must be installed first.
    // Check and install silently in the background — scan() will still work
    // via camera permission fallback if the module isn't ready yet.
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable().catch(() => ({ available: false }));
    if (!available) {
      BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {});
    }

    const result = await BarcodeScanner.scan();

    const first = result.barcodes?.[0];
    if (!first) return undefined;
    return first.displayValue ?? first.rawValue;
  } catch (err: unknown) {
    // User cancelled — plugin throws with 'cancel' or 'dismissed'
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes('cancel') || msg.includes('dismiss')) return undefined;
    }
    throw err;
  }
}
