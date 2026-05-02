import type { SlipStatus } from "../types";

/**
 * Returns Tailwind class string for a slip status badge.
 * Single source of truth — replaces duplicated inline switch/map in Dispatch and Dashboard.
 */
export function getStatusColor(status: SlipStatus | string): string {
  switch (status) {
    case "Tallied":
      return "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300";
    case "Loaded":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    case "Cancelled":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
    default: // Pending
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
  }
}
