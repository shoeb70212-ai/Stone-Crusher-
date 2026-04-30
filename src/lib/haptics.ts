/**
 * Thin wrapper around @capacitor/haptics for tactile feedback.
 * All calls are no-ops on web — safe to call unconditionally.
 *
 * Use `hapticsSuccess()` on confirmations, `hapticsError()` on failures,
 * `hapticsLight()` for minor interactions (button taps, selections).
 */

import { isNative } from './capacitor';

/** Signals a successful action (e.g. slip saved, sync complete). */
export async function hapticsSuccess(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch { /* Non-critical */ }
}

/** Signals a failure or validation error. */
export async function hapticsError(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Error });
  } catch { /* Non-critical */ }
}

/** Signals a warning (e.g. offline banner shown). */
export async function hapticsWarning(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Warning });
  } catch { /* Non-critical */ }
}

/** Light impact for taps and minor selections. */
export async function hapticsLight(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* Non-critical */ }
}
