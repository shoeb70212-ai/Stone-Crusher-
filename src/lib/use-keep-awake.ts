/**
 * Keeps the device screen on while the hook is mounted (e.g. while a form is open).
 * No-op on web; only activates inside the Capacitor native shell.
 *
 * Usage: call `useKeepAwake()` at the top of any component that should prevent
 * screen sleep. The lock is automatically released when the component unmounts.
 */
import { useEffect } from 'react';
import { isNative } from './capacitor';

export function useKeepAwake(): void {
  useEffect(() => {
    if (!isNative()) return;

    let released = false;

    import('@capacitor-community/keep-awake').then(({ KeepAwake }) => {
      KeepAwake.keepAwake().catch(() => {
        // Non-critical — continue silently if permission is denied
      });

      released = false;
    });

    return () => {
      if (released) return;
      released = true;

      import('@capacitor-community/keep-awake').then(({ KeepAwake }) => {
        KeepAwake.allowSleep().catch(() => {});
      });
    };
  }, []);
}
