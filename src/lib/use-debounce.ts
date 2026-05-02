import { useState, useEffect } from "react";

/**
 * Delays propagating a value until it has stopped changing for `delay` ms.
 * Use for search/filter inputs to avoid re-running expensive filters on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
