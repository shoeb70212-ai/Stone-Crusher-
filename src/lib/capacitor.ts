/**
 * Thin wrapper around Capacitor's platform detection.
 * All native feature imports are lazy so the web build never pulls in
 * native-only code paths that would break in the browser.
 *
 * Usage: guard every native call with `isNative()` before invoking it.
 */

/** Returns true when running inside a Capacitor native shell (Android / iOS). */
export function isNative(): boolean {
  return typeof (window as any).Capacitor !== 'undefined'
    && (window as any).Capacitor.isNativePlatform?.() === true;
}

/** Returns 'android' | 'ios' | 'web'. */
export function getPlatform(): 'android' | 'ios' | 'web' {
  if (typeof (window as any).Capacitor === 'undefined') return 'web';
  return (window as any).Capacitor.getPlatform?.() ?? 'web';
}
