/**
 * Device identification helper using @capacitor/device.
 *
 * Provides the device UUID for licensing and audit trails.
 * On web, Capacitor generates a random ID stored in localStorage.
 *
 * NOTE on iOS: the identifier resets on app reinstall (vendor UUID).
 * NOTE on Android: stable across reinstalls but tied to signing key + user.
 */

import { isNative } from './capacitor';

export interface DeviceSummary {
  /** Unique device identifier (ANDROID_ID on Android, vendor UUID on iOS, random on web). */
  id: string;
  /** Human-readable OS name: "android", "ios", or "web". */
  platform: string;
  /** OS version string e.g. "14.2" or "13". */
  osVersion: string;
  /** Device manufacturer e.g. "Samsung", "Apple". */
  manufacturer: string;
  /** Device model e.g. "Pixel 7", "iPhone 14". */
  model: string;
}

/**
 * Returns a summary of the current device.
 * Safe to call on web — returns placeholder values.
 */
export async function getDeviceSummary(): Promise<DeviceSummary> {
  try {
    const { Device } = await import('@capacitor/device');
    const [idResult, infoResult] = await Promise.all([
      Device.getId(),
      Device.getInfo(),
    ]);

    return {
      id: idResult.identifier,
      platform: infoResult.platform,
      osVersion: infoResult.osVersion,
      manufacturer: infoResult.manufacturer,
      model: infoResult.model,
    };
  } catch {
    return {
      id: 'web',
      platform: 'web',
      osVersion: navigator.userAgent,
      manufacturer: 'unknown',
      model: 'unknown',
    };
  }
}

/**
 * Stores the current device ID in companySettings-adjacent localStorage for
 * an admin to review which devices have accessed the app.
 * This is the lightweight "capture" step; enforcement logic is left to the caller.
 */
export async function recordDeviceAccess(): Promise<void> {
  try {
    const summary = await getDeviceSummary();
    const key = 'crushtrack_device_access';
    const existing: DeviceSummary[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    const alreadyRecorded = existing.some((d) => d.id === summary.id);
    if (!alreadyRecorded) {
      existing.push(summary);
      localStorage.setItem(key, JSON.stringify(existing));
    }
  } catch { /* Non-critical */ }
}
