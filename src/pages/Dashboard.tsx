import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useErp } from "../context/ErpContext";
import {
  Truck,
  IndianRupee,
  Wallet,
  Printer,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Receipt,
  Plus,
  CalendarDays,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { NAVIGATE_EVENT, CREATE_EVENT } from "../components/Layout";
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
    if (previous === 0 && current === 0) return "0";
    if (previous === 0) return "100";
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return change.toFixed(1);
  };

  const volumePercent = percentChange(currentVolume, prevVolume);
  const incomePercent = percentChange(income, prevIncome);
  const expensePercent = percentChange(expense, prevExpense);

  const stats = [
    {
      label: "Trips",
      value: `${dateSlips.filter(s => s.status !== "Cancelled").length}`,
      valueSuffix: "trips",
      subValue: `${volumePercent}% vs prev period`,
      isPositive: currentVolume >= prevVolume,
      showNeutral: currentVolume === 0 && prevVolume === 0,
      icon: Truck,
      iconClass: "text-info bg-info-muted",
      navTarget: "dispatch",
    },
    {
      label: "Income",
      value: `₹${income.toLocaleString()}`,
      valueSuffix: undefined as string | undefined,
      subValue: `${incomePercent}% vs prev period`,
      isPositive: income >= prevIncome,
      showNeutral: income === 0 && prevIncome === 0,
      icon: ArrowDownCircle,
      iconClass: "text-success bg-success-muted",
      navTarget: "daybook",
    },
    {
      label: "Expenses",
      value: `₹${expense.toLocaleString()}`,
      valueSuffix: undefined as string | undefined,
      subValue: `${expensePercent}% vs prev period`,
      isPositive: expense <= prevExpense,
      showNeutral: expense === 0 && prevExpense === 0,
      icon: ArrowUpCircle,
      iconClass: "text-warning bg-warning-muted",
      navTarget: "daybook",
    },
    {
      label: "Receivables",
      value: `₹${totalReceivables.toLocaleString()}`,
      valueSuffix: undefined as string | undefined,
      subValue: `Pending collection`,
      isPositive: true,
      showNeutral: false,
      icon: Wallet,
      iconClass: "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/15",
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
    <div className="space-y-5 md:space-y-6">
      {/* ── Page header: title + date pills, semantic tokens ── */}
      <div className="flex flex-col gap-3">
        {/* Desktop heading with subtle subtitle */}
        <div className="hidden md:flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">
              Dashboard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Overview of operations, finances, and recent activity.
            </p>
          </div>
        </div>

        {/* Date range pills — horizontal scroll on mobile with edge fade */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent z-10 md:hidden" />
          <div
            role="tablist"
            aria-label="Date range"
            className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1"
          >
            {(["today", "week", "month", "year", "custom"] as const).map((type) => (
              <button
                key={type}
                role="tab"
                onClick={() => setDateRangeType(type)}
                aria-label={`Filter by ${type === "today" ? "today" : type === "week" ? "this week" : type === "month" ? "this month" : type === "year" ? "this year" : "custom date range"}`}
                aria-selected={dateRangeType === type}
                className={`px-4 py-2.5 min-h-[40px] rounded-full text-xs font-medium whitespace-nowrap transition-colors active:scale-95 ${
                  dateRangeType === type
                    ? "bg-foreground text-background shadow-elev-xs"
                    : "bg-surface text-muted-foreground border border-border hover:text-foreground hover:border-border-strong"
                }`}
              >
                {type === "today" ? "Today" : type === "week" ? "Week" : type === "month" ? "Month" : type === "year" ? "Year" : "Custom"}
              </button>
            ))}
          </div>
        </div>

        {dateRangeType === "custom" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-surface px-3 py-2 border border-border rounded-xl w-full sm:w-auto">
            <input
              type="date"
              value={customStartDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomStartDate(e.target.value)}
              className="text-xs text-foreground outline-none bg-transparent w-full sm:w-auto"
            />
            <span className="hidden sm:inline text-muted-foreground font-semibold text-xs shrink-0">→</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomEndDate(e.target.value)}
              className="text-xs text-foreground outline-none bg-transparent w-full sm:w-auto"
            />
          </div>
        )}
      </div>

      {/* ── Quick Actions Row (mobile) ── */}
      <div className="md:hidden -mx-1">
        <p className="px-1 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
          Quick actions
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pb-1">
          {[
            { label: "New Slip", icon: FileText, target: "dispatch", iconClass: "text-info bg-info-muted" },
            { label: "New Invoice", icon: Receipt, target: "invoices", iconClass: "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/15" },
            { label: "Income", icon: TrendingUp, target: "daybook", iconClass: "text-success bg-success-muted" },
            { label: "Expense", icon: TrendingDown, target: "daybook", iconClass: "text-danger bg-danger-muted" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => {
                if (action.label === "New Slip" || action.label === "New Invoice") {
                  window.dispatchEvent(new CustomEvent(CREATE_EVENT));
                }
                navigateTo(action.target);
              }}
              aria-label={`Create ${action.label.toLowerCase()}`}
              className="flex items-center gap-2.5 pl-2.5 pr-4 py-2 min-h-[44px] rounded-full whitespace-nowrap text-xs font-semibold bg-surface border border-border hover:border-border-strong text-foreground active:scale-95 transition-colors"
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center ${action.iconClass}`}>
                <action.icon className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KEY METRICS - clean 2x2 mobile / 4-col desktop grid ──
          Refined: solid surface, subtle border, accent dot for icon,
          generous numerals, dignified delta chip. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4 stagger-animation">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <button
              key={i}
              onClick={() => navigateTo(stat.navTarget)}
              aria-label={`${stat.label}: ${stat.value}. ${stat.subValue}. Open ${stat.navTarget}.`}
              className="card-surface p-3 md:p-5 flex flex-col gap-2 md:gap-3 relative overflow-hidden active:scale-[0.99] transition-[transform,border-color,box-shadow] cursor-pointer text-left hover:border-border-strong hover:shadow-elev-md animate-stat"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] md:text-[11px] font-semibold text-muted-foreground leading-none uppercase tracking-[0.12em]">
                  {stat.label}
                </p>
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center ${stat.iconClass}`}>
                  <Icon className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.25} />
                </div>
              </div>
              <p className="text-xl md:text-3xl font-display font-bold tracking-tight text-foreground tabular-nums truncate leading-none">
                {stat.value}
                {stat.valueSuffix && (
                  <span className="text-xs md:text-sm font-medium text-muted-foreground ml-1.5 align-middle">
                    {stat.valueSuffix}
                  </span>
                )}
              </p>
              <p className="text-xs font-medium leading-tight">
                {stat.label === "Receivables" ? (
                  <span className="text-muted-foreground">{stat.subValue}</span>
                ) : stat.showNeutral ? (
                  <span
                    title={previousPeriodLabel}
                    className="px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-muted text-muted-foreground text-[11px]"
                  >
                    — Flat
                  </span>
                ) : (
                  <span
                    title={previousPeriodLabel}
                    className={`px-2 py-0.5 rounded-full inline-flex items-center gap-1 text-[11px] font-semibold ${
                      stat.isPositive
                        ? "bg-success-muted text-success-foreground"
                        : "bg-danger-muted text-danger-foreground"
                    }`}
                  >
                    {stat.isPositive ? "↑" : "↓"} {stat.subValue.split(" vs")[0]}%
                  </span>
                )}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Unified Activity Feed ── */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 border-b border-border">
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm md:text-base tracking-tight">
              Activity Feed
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 hidden md:block">
              Recent slips and daybook transactions
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo("dispatch")}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
          >
            View all →
          </button>
        </div>
        <div className="divide-y divide-border max-h-80 md:max-h-96 overflow-y-auto">
          {/* Merge and sort recent slips + transactions by date */}
          {useMemo(() => {
            const activityItems = [
              ...recentSlips.map((s) => ({
                id: s.id,
                type: "slip" as const,
                date: s.date,
                title: s.vehicleNo,
                subtitle: `${s.materialType} · ${s.quantity.toFixed(1)} ${s.measurementType === "Volume (Brass)" ? "Brass" : "Tons"}`,
                amount: s.totalAmount,
                status: s.status,
                accentClass: "bg-info-muted text-info",
                icon: Truck,
              })),
              ...recentTransactions.map((t) => ({
                id: t.id,
                type: "transaction" as const,
                date: t.date,
                title: t.category,
                subtitle: t.type,
                amount: t.amount,
                status: t.type,
                accentClass: t.type === "Income" ? "bg-success-muted text-success" : "bg-danger-muted text-danger",
                icon: t.type === "Income" ? ArrowDownCircle : ArrowUpCircle,
              })),
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
            return activityItems;
          }, [recentSlips, recentTransactions]).map((item) => (
            <div
              key={item.id + item.type}
              className="flex items-center gap-3 px-4 py-3 md:px-5 hover:bg-muted/60 transition-colors"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.accentClass}`}>
                <item.icon className="w-[18px] h-[18px]" strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                  {item.type === "slip" ? (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase shrink-0 ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  ) : (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase shrink-0 ${item.status === "Income" ? "bg-success-muted text-success-foreground" : "bg-danger-muted text-danger-foreground"}`}>
                      {item.status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-semibold tabular-nums ${item.type === "transaction" && item.status === "Expense" ? "text-danger" : "text-foreground"}`}>
                  {item.type === "transaction" && item.status === "Expense" ? "-" : ""}₹{item.amount.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </p>
              </div>
            </div>
          ))}
          {recentSlips.length === 0 && recentTransactions.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              No recent activity yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Company Vehicles — refined card grid ── */}
      <div className="card-surface p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-foreground flex items-center gap-2 text-sm md:text-base tracking-tight">
            <Truck className="w-4 h-4 text-muted-foreground" />
            Company Vehicles
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 stagger-animation">
          {(
            Object.entries(companyVehicleTrips) as [
              string,
              { trips: number; quantity: number },
            ][]
          ).map(([vehicleNo, data]) => (
            <div
              key={vehicleNo}
              className="flex justify-between items-center px-3 py-2.5 bg-surface-2 border border-border rounded-lg hover:border-border-strong transition-colors"
            >
              <span className="font-semibold text-foreground text-xs md:text-sm tabular-nums">{vehicleNo}</span>
              <div className="text-right leading-none">
                <span className="text-sm md:text-base font-bold text-primary-600 dark:text-primary-400 block tabular-nums">
                  {data.trips}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  trips
                </span>
              </div>
            </div>
          ))}
          {Object.keys(companyVehicleTrips).length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-foreground">No vehicle trips in this range</p>
              <p className="mt-1 text-xs text-muted-foreground">Company vehicle activity will appear after slips are loaded or tallied.</p>
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
