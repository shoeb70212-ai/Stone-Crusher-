import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useErp } from "../context/ErpContext";
import {
  Truck,
  IndianRupee,
  Wallet,
  Printer,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { NAVIGATE_EVENT } from "../components/Layout";
import { getStatusColor } from "../lib/status-styles";
import {
  endOfDay,
  startOfDay,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  format,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";
import { PrintSlipModal } from "../components/forms/PrintSlipModal";
import { Slip } from "../types";

export function Dashboard() {
  const { slips, transactions, customers, invoices, getCustomerBalance } = useErp();
  const [printSlip, setPrintSlip] = useState<Slip | null>(null);

  const navigateTo = useCallback((view: string) => {
    window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: view }));
  }, []);

  // Default to today since owner wants to see what's happening today
  const [dateRangeType, setDateRangeType] = useState<
    "today" | "week" | "month" | "year" | "custom"
  >("today");

  // Tick counter forces "now" to refresh at midnight when on the Today view,
  // so a tab left open overnight doesn't keep showing yesterday's data.
  const [midnightTick, setMidnightTick] = useState(0);
  const midnightTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (dateRangeType !== "today") return;
    const msUntilMidnight = () => {
      const n = new Date();
      return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - n.getTime();
    };
    const schedule = () => {
      midnightTimerRef.current = setTimeout(() => {
        setMidnightTick((t) => t + 1);
        schedule();
      }, msUntilMidnight());
    };
    schedule();
    return () => clearTimeout(midnightTimerRef.current);
  }, [dateRangeType]);

  const now = useMemo(() => new Date(), [dateRangeType, midnightTick]);

  const [customStartDate, setCustomStartDate] = useState(
    startOfMonth(now).toISOString().split("T")[0],
  );
  const [customEndDate, setCustomEndDate] = useState(
    endOfMonth(now).toISOString().split("T")[0],
  );

  // Derived Date Range
  const { dateStart, dateEnd, prevDateStart, prevDateEnd } = useMemo(() => {
    switch (dateRangeType) {
      case "today":
        return { 
          dateStart: startOfDay(now), dateEnd: endOfDay(now),
          prevDateStart: startOfDay(subDays(now, 1)), prevDateEnd: endOfDay(subDays(now, 1))
        };
      case "week":
        return {
          dateStart: startOfWeek(now, { weekStartsOn: 1 }),
          dateEnd: endOfWeek(now, { weekStartsOn: 1 }),
          prevDateStart: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
          prevDateEnd: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
        };
      case "month":
        return { 
          dateStart: startOfMonth(now), dateEnd: endOfMonth(now),
          prevDateStart: startOfMonth(subMonths(now, 1)), prevDateEnd: endOfMonth(subMonths(now, 1))
        };
      case "year":
        return {
          dateStart: new Date(now.getFullYear(), 0, 1),
          dateEnd: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
          prevDateStart: new Date(now.getFullYear() - 1, 0, 1),
          prevDateEnd: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
        };
      case "custom": {
        const dStart = customStartDate ? startOfDay(new Date(customStartDate)) : startOfDay(now);
        const dEnd = customEndDate ? endOfDay(new Date(customEndDate)) : endOfDay(now);
        const diff = dEnd.getTime() - dStart.getTime();
        return {
          dateStart: dStart,
          dateEnd: dEnd,
          prevDateStart: new Date(dStart.getTime() - diff),
          prevDateEnd: new Date(dEnd.getTime() - diff),
        };
      }
      default:
        return { 
          dateStart: startOfDay(now), dateEnd: endOfDay(now),
          prevDateStart: startOfDay(subDays(now, 1)), prevDateEnd: endOfDay(subDays(now, 1))
        };
    }
  }, [dateRangeType, customStartDate, customEndDate, now]);

  // Date-filtered Dispatches
  const { dateSlips, prevDateSlips } = useMemo(() => {
    return {
      dateSlips: slips.filter((s) => isWithinInterval(new Date(s.date), { start: dateStart, end: dateEnd })),
      prevDateSlips: slips.filter((s) => isWithinInterval(new Date(s.date), { start: prevDateStart, end: prevDateEnd })),
    };
  }, [slips, dateStart, dateEnd, prevDateStart, prevDateEnd]);

  // Date-filtered Financials
  const { income, expense, prevIncome, prevExpense } = useMemo(() => {
    let inc = 0; let exp = 0;
    let pInc = 0; let pExp = 0;

    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (isWithinInterval(d, { start: dateStart, end: dateEnd })) {
        if (t.type === "Income") inc += t.amount;
        else if (t.type === "Expense") exp += t.amount;
      } else if (isWithinInterval(d, { start: prevDateStart, end: prevDateEnd })) {
        if (t.type === "Income") pInc += t.amount;
        else if (t.type === "Expense") pExp += t.amount;
      }
    });

    return { 
      income: inc, expense: exp,
      prevIncome: pInc, prevExpense: pExp
    };
  }, [transactions, dateStart, dateEnd, prevDateStart, prevDateEnd]);

  // Volume — exclude Cancelled slips (material was never dispatched)
  const currentVolume = dateSlips
    .filter((s) => s.status !== "Cancelled")
    .reduce((acc, s) => acc + s.quantity, 0);
  const prevVolume = prevDateSlips
    .filter((s) => s.status !== "Cancelled")
    .reduce((acc, s) => acc + s.quantity, 0);

  // Trips by Company Vehicles in period — only Loaded/Tallied (not Pending or Cancelled)
  const companyVehicleTrips = dateSlips
    .filter(
      (s) => s.deliveryMode === "Company Vehicle" && (s.status === "Loaded" || s.status === "Tallied"),
    )
    .reduce(
      (acc, curr) => {
        if (!acc[curr.vehicleNo])
          acc[curr.vehicleNo] = { trips: 0, quantity: 0 };
        acc[curr.vehicleNo].trips += 1;
        acc[curr.vehicleNo].quantity += curr.quantity;
        return acc;
      },
      {} as Record<string, { trips: number; quantity: number }>,
    );

  const totalReceivables = useMemo(() => {
    return customers
      .filter((c) => c.isActive !== false)
      .reduce((sum, c) => {
        const bal = getCustomerBalance(c.id);
        return sum + (bal > 0 ? bal : 0);
      }, 0);
  }, [customers, getCustomerBalance]);

  const percentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "100" : "0";
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return change.toFixed(1);
  };

  const volumePercent = percentChange(currentVolume, prevVolume);
  const incomePercent = percentChange(income, prevIncome);
  const expensePercent = percentChange(expense, prevExpense);

  const stats = [
    {
      label: "Dispatches",
      value: `${dateSlips.filter(s => s.status !== "Cancelled").length} Trips`,
      subValue: `${volumePercent}% vs prev period`,
      isPositive: currentVolume >= prevVolume,
      icon: Truck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-500/20",
      navTarget: "dispatch",
    },
    {
      label: "Income",
      value: `₹${income.toLocaleString()}`,
      subValue: `${incomePercent}% vs prev period`,
      isPositive: income >= prevIncome,
      icon: ArrowDownCircle,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
      navTarget: "daybook",
    },
    {
      label: "Expenses",
      value: `₹${expense.toLocaleString()}`,
      subValue: `${expensePercent}% vs prev period`,
      isPositive: expense <= prevExpense,
      icon: ArrowUpCircle,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-500/20",
      navTarget: "daybook",
    },
    {
      label: "Receivables",
      value: `₹${totalReceivables.toLocaleString()}`,
      subValue: `Pending collection`,
      isPositive: true,
      icon: Wallet,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20",
      navTarget: "customers",
    },
  ];

  const getRangeLabel = () => {
    if (dateRangeType === "today") return "Today";
    if (dateRangeType === "week") return "This Week";
    if (dateRangeType === "month") return "This Month";
    if (dateRangeType === "year") return "This Year";
    return "Custom Range";
  };

  const previousPeriodLabel = `Compared with the previous ${getRangeLabel().toLowerCase()} period`;
  const recentSlips = useMemo(
    () => [...slips].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [slips],
  );
  const recentTransactions = useMemo(
    () => transactions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [transactions],
  );

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Date range pills — no page title on mobile (bottom nav shows context) */}
      <div className="flex flex-col gap-2">
        {/* Desktop-only heading */}
        <h2 className="hidden md:block text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
          Dashboard
        </h2>

        {/* Date range pills - Horizontally scrollable on mobile with edge fade hint */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-zinc-50 dark:from-zinc-900 to-transparent z-10 md:hidden" />
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {(["today", "week", "month", "year", "custom"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDateRangeType(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                  dateRangeType === type
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {type === "today" ? "Today" : type === "week" ? "Week" : type === "month" ? "Month" : type === "year" ? "Year" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {dateRangeType === "custom" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 bg-white dark:bg-zinc-800 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm w-full sm:w-auto">
            <input
              type="date"
              value={customStartDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomStartDate(e.target.value)}
              className="text-xs text-zinc-700 dark:text-zinc-200 outline-none bg-transparent w-full sm:w-auto"
            />
            <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500 font-semibold text-xs shrink-0">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomEndDate(e.target.value)}
              className="text-xs text-zinc-700 dark:text-zinc-200 outline-none bg-transparent w-full sm:w-auto"
            />
          </div>
        )}
      </div>

      {/* TOP 4 KEY METRICS - Dense 2x2 grid with touch feedback */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <button
              key={i}
              onClick={() => navigateTo(stat.navTarget)}
              aria-label={`${stat.label}: ${stat.value}. ${stat.subValue}. Open ${stat.navTarget}.`}
              className="bg-white dark:bg-zinc-900/40 p-2.5 md:p-5 rounded-xl md:rounded-2xl shadow-sm border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-1 relative overflow-hidden active:scale-[0.98] active:shadow-inner transition-all cursor-pointer text-left hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
            >
              <div className="flex justify-between items-start">
                <p className="text-xs md:text-sm font-semibold text-zinc-500 dark:text-zinc-400 leading-tight line-clamp-2 uppercase tracking-wide">
                  {stat.label}
                </p>
                <div className={`p-1 rounded-lg md:rounded-xl ${stat.bg} shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 md:w-5 md:h-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-base md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">
                {stat.value}
              </p>
              <p className="text-xs font-medium leading-tight">
                {stat.label === "Receivables" ? (
                  <span className="text-zinc-500 dark:text-zinc-400">{stat.subValue}</span>
                ) : (
                  <span
                    title={previousPeriodLabel}
                    className={`px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 ${stat.isPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"}`}
                  >
                    {stat.isPositive ? "↑" : "↓"} {stat.subValue.split(" vs")[0]}
                  </span>
                )}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5">
      {/* Recent Dispatches - Full width on mobile */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl md:rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-2.5 md:p-5">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-zinc-900 dark:text-white text-xs md:text-sm">
            Recent Dispatches
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo("dispatch")}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              View all
            </button>
            <span className="text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-lg">
              {slips.length > 6 ? "6+" : slips.length}
            </span>
          </div>
        </div>
        <div className="space-y-1 max-h-45 md:max-h-55 overflow-y-auto">
          {recentSlips.map((slip) => (
            // Single-row layout: vehicle+status left | amount+print right, date below
            <div key={slip.id} className="bg-zinc-50 dark:bg-zinc-900/50 px-2.5 py-2 rounded-lg border border-zinc-100 dark:border-zinc-700/50 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Truck className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span className="font-bold text-zinc-900 dark:text-white uppercase tracking-wide text-[11px] truncate">{slip.vehicleNo}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase shrink-0 ${getStatusColor(slip.status)}`}>
                    {slip.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-zinc-900 dark:text-white text-[11px]">₹{slip.totalAmount.toLocaleString()}</span>
                  <button
                    onClick={() => setPrintSlip(slip)}
                    className="text-zinc-400 p-1 rounded bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    aria-label={`Print slip ${slip.id}`}
                  >
                    <Printer className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 pl-4.5">
                {slip.materialType} · {slip.quantity.toFixed(1)} · {new Date(slip.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </p>
            </div>
          ))}
          {slips.length === 0 && (
            <div className="text-center text-xs text-zinc-500 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">No dispatches yet</div>
          )}
        </div>
      </div>

      {/* Recent Transactions - Full width on mobile */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl md:rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-2.5 md:p-5">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-zinc-900 dark:text-white text-xs md:text-sm">
            Recent Transactions
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo("daybook")}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              View all
            </button>
            <span className="text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-lg">
              {transactions.length > 6 ? "6+" : transactions.length}
            </span>
          </div>
        </div>
        <div className="space-y-1.5 max-h-45 md:max-h-55 overflow-y-auto">
          {recentTransactions.map((t) => (
              <div
                key={t.id}
                className="bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-lg flex items-center justify-between border border-zinc-100 dark:border-zinc-700/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.type === "Income" ? "bg-emerald-500" : "bg-rose-500"}`}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-900 dark:text-white truncate">
                      {t.category}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.type}</p>
                  </div>
                </div>
                <div
                  className={`text-xs font-bold flex items-center shrink-0 ${t.type === "Income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                >
                  {t.type === "Income" ? "+" : "-"}₹
                  {t.amount.toLocaleString()}
                </div>
              </div>
            ))}
          {transactions.length === 0 && (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              No transactions yet
            </p>
          )}
        </div>
      </div>

      </div>

      {/* COMPANY VEHICLES - Compact grid */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl md:rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-2.5 md:p-5">
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-2 flex items-center gap-2 text-xs md:text-base">
          <Truck className="w-3 h-3 md:w-4 md:h-4 text-zinc-400" />
          Company Vehicles
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {(
            Object.entries(companyVehicleTrips) as [
              string,
              { trips: number; quantity: number },
            ][]
          ).map(([vehicleNo, data]) => (
            <div
              key={vehicleNo}
              className="flex justify-between items-center p-2 bg-zinc-50 border border-zinc-100 dark:border-zinc-700/50 dark:bg-zinc-900/50 rounded-lg"
            >
              <span className="font-bold text-zinc-900 dark:text-white text-[11px] md:text-sm">{vehicleNo}</span>
              <div className="text-right">
                <span className="text-[11px] md:text-xs font-bold text-primary-600 dark:text-primary-400 block">
                  {data.trips}
                </span>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                  trips
                </span>
              </div>
            </div>
          ))}
          {Object.keys(companyVehicleTrips).length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-4 text-center">
              <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">No vehicle trips in this range</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Company vehicle activity will appear after slips are loaded or tallied.</p>
            </div>
          )}
        </div>
      </div>

      {printSlip && (
        <PrintSlipModal slip={printSlip} onClose={() => setPrintSlip(null)} />
      )}
    </div>
  );
}
