import { useEffect } from "react";

/** Shared counter so multiple concurrent modals don't fight over body scroll. */
let openModalCount = 0;

/**
 * Locks `document.body` scroll while the component is mounted (or while `active`
 * is true). Uses a reference-count so nested/concurrent callers don't
 * prematurely re-enable scrolling when only one of them closes.
 */
export function useBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    openModalCount++;
    document.body.style.overflow = "hidden";
    return () => {
      openModalCount--;
      if (openModalCount <= 0) {
        openModalCount = 0;
        document.body.style.overflow = "";
      }
    };
  }, [active]);
}
