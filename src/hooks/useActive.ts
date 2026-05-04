import { useMemo } from 'react';

/**
 * Centralized hook for filtering out soft-deleted records.
 * Returns only items where isActive is not explicitly false.
 */
export function useActive<T extends { isActive?: boolean }>(list: T[]): T[] {
  return useMemo(() => list.filter((item) => item.isActive !== false), [list]);
}
