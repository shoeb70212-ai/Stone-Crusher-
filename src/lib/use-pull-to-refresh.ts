import { useRef, useState, useCallback, useEffect } from "react";

const TRIGGER_DISTANCE = 72; // px pulled before release triggers refresh
const MAX_PULL = 100;        // px — rubber-band ceiling

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  /** Disable the gesture (e.g. when a modal is open). */
  disabled?: boolean;
}

interface PullToRefreshState {
  /** Current pull distance in px (0 when idle). */
  pullDistance: number;
  /** True while the async refresh callback is running. */
  isRefreshing: boolean;
}

/**
 * Attaches a native-feeling pull-to-refresh gesture to a scrollable element.
 * Returns the ref to attach to the scrollable container and the current state
 * for rendering the pull indicator.
 */
export function usePullToRefresh({ onRefresh, disabled = false }: UsePullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [state, setState] = useState<PullToRefreshState>({ pullDistance: 0, isRefreshing: false });

  const handleRefresh = useCallback(async () => {
    setState({ pullDistance: 0, isRefreshing: true });
    try {
      await onRefresh();
    } finally {
      setState({ pullDistance: 0, isRefreshing: false });
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      // Only start the gesture when the container is scrolled to the top.
      if (el.scrollTop > 0) return;
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === 0) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta <= 0) {
        setState((s) => ({ ...s, pullDistance: 0 }));
        return;
      }
      // Rubber-band: apply logarithmic resistance so it feels elastic.
      const capped = Math.min(MAX_PULL, delta * 0.5);
      setState((s) => ({ ...s, pullDistance: capped }));
      // Prevent the browser from natively scrolling up past the top.
      if (delta > 0 && el.scrollTop === 0) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (touchStartY.current === 0) return;
      touchStartY.current = 0;
      setState((s) => {
        if (s.pullDistance >= TRIGGER_DISTANCE * 0.5 && !s.isRefreshing) {
          void handleRefresh();
        } else {
          return { ...s, pullDistance: 0 };
        }
        return s;
      });
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled, handleRefresh]);

  return { containerRef, ...state };
}
