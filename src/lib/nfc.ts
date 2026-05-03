/**
 * NFC tag reading helper using @capgo/capacitor-nfc.
 *
 * Designed for the quarry weigh-bridge use case: tap an NFC sticker on a truck
 * to auto-fill the vehicle number field in CreateSlipForm.
 *
 * Expected tag format: NDEF Text record containing the vehicle number string
 * (e.g. "MH12AB1234"). Tags can be written with any standard NFC tag writer app.
 *
 * Platform notes:
 *   Android — works in foreground; NFC intent dispatched while app is open.
 *   iOS     — Core NFC; requires NFCReaderUsageDescription in Info.plist;
 *             session must be explicitly started and stops after first read.
 *   Web     — returns undefined (Web NFC is Chrome-Android experimental only).
 */

import { isNative } from './capacitor';

/**
 * Opens an NFC scanning session and returns the first NDEF text payload found.
 * The session automatically closes after the first successful read or after
 * `timeoutMs` milliseconds (default 15 s).
 *
 * Returns undefined if NFC is unavailable, not supported, or the user times out.
 */
export async function scanNfcVehicleTag(timeoutMs = 15_000): Promise<string | undefined> {
  if (!isNative()) return undefined;

  try {
    const { CapacitorNfc } = await import('@capgo/capacitor-nfc');

    // Verify NFC is supported and enabled
    const { supported } = await CapacitorNfc.isSupported();
    if (!supported) return undefined;

    const { status } = await CapacitorNfc.getStatus();
    if (status !== 'NFC_OK') return undefined;

    return new Promise<string | undefined>((resolve) => {
      let handle: { remove: () => void } | undefined;
      const timer = setTimeout(() => finish(undefined), timeoutMs);

      const finish = (value: string | undefined) => {
        clearTimeout(timer);
        handle?.remove();
        CapacitorNfc.stopScanning().catch(() => {});
        resolve(value);
      };

      // Time-box the scan so the form doesn't hang indefinitely

      CapacitorNfc.addListener('ndefDiscovered', (event) => {
        const record = event.tag.ndefMessage?.[0];
        if (!record) { finish(undefined); return; }

        // NDEF Text record payload: first byte = status byte (lang length),
        // followed by lang code, then the actual UTF-8 text.
        const payload = record.payload;
        if (!payload || payload.length < 1) { finish(undefined); return; }

        const statusByte = payload[0];
        const langLength = statusByte & 0x3f;
        const textBytes = payload.slice(1 + langLength);
        const text = new TextDecoder('utf-8').decode(new Uint8Array(textBytes));

        finish(text.trim().toUpperCase() || undefined);
      }).then((h) => {
        handle = h;
      });

      CapacitorNfc.startScanning().catch(() => finish(undefined));
    });
  } catch {
    return undefined;
  }
}

/**
 * Returns true when NFC is available and enabled on this device.
 * Safe to call on web — returns false.
 */
export async function isNfcAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { CapacitorNfc } = await import('@capgo/capacitor-nfc');
    const { supported } = await CapacitorNfc.isSupported();
    if (!supported) return false;
    const { status } = await CapacitorNfc.getStatus();
    return status === 'NFC_OK';
  } catch {
    return false;
  }
}
