import { useState, useMemo } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export type QuickPeriod = "today" | "week" | "month" | null;

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
  quickPeriod: QuickPeriod;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
  applyQuickPeriod: (period: "today" | "week" | "month") => void;
  clearDates: () => void;
  /** Returns true if any date filter is active. */
  hasDateFilter: boolean;
  /** Parsed start/end as Date objects (or null if not set). */
  parsedStart: Date | null;
  parsedEnd: Date | null;
}

/**
 * Reusable date-range filter state shared across Dispatch, Daybook, and Ledger.
 * Handles quick-period shortcuts (Today / Week / Month) and arbitrary ranges.
 */
export function useDateRangeFilter(initialStart = "", initialEnd = ""): DateRangeFilter {
  const [startDate, setStartDateRaw] = useState(initialStart);
  const [endDate, setEndDateRaw] = useState(initialEnd);
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>(null);

  const applyQuickPeriod = (period: "today" | "week" | "month") => {
    const today = new Date();
    setQuickPeriod(period);
    if (period === "today") {
      setStartDateRaw(format(today, "yyyy-MM-dd"));
      setEndDateRaw(format(today, "yyyy-MM-dd"));
    } else if (period === "week") {
      setStartDateRaw(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setEndDateRaw(format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (period === "month") {
      setStartDateRaw(format(startOfMonth(today), "yyyy-MM-dd"));
      setEndDateRaw(format(endOfMonth(today), "yyyy-MM-dd"));
    }
  };

  const setStartDate = (d: string) => { setStartDateRaw(d); setQuickPeriod(null); };
  const setEndDate = (d: string) => { setEndDateRaw(d); setQuickPeriod(null); };

  const clearDates = () => {
    setStartDateRaw("");
    setEndDateRaw("");
    setQuickPeriod(null);
  };

  const hasDateFilter = !!(startDate || endDate);

  const parsedStart = useMemo(
    () => (startDate ? startOfDay(new Date(startDate)) : null),
    [startDate],
  );
  const parsedEnd = useMemo(
    () => (endDate ? endOfDay(new Date(endDate)) : null),
    [endDate],
  );

  return {
    startDate,
    endDate,
    quickPeriod,
    setStartDate,
    setEndDate,
    applyQuickPeriod,
    clearDates,
    hasDateFilter,
    parsedStart,
    parsedEnd,
  };
}
