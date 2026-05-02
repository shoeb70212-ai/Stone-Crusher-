import { useCallback } from "react";
import { hapticsLight, hapticsSuccess, hapticsError, hapticsWarning } from "./haptics";

/**
 * Returns memoized haptic wrappers safe to attach to onClick handlers.
 * All calls are no-ops on web — safe to use unconditionally.
 */
export function useHapticFeedback() {
  const tap = useCallback(() => { hapticsLight(); }, []);
  const success = useCallback(() => { hapticsSuccess(); }, []);
  const error = useCallback(() => { hapticsError(); }, []);
  const warning = useCallback(() => { hapticsWarning(); }, []);

  return { tap, success, error, warning };
}
