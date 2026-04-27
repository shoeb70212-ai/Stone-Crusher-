import React, { useMemo, useState } from "react";
import { useErp } from "../context/ErpContext";
import {
  Truck,
  IndianRupee,
  TrendingUp,
  Wallet,
  Printer,
} from "lucide-react";
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

  const [now] = useState(() => new Date());

  // Default to today since owner wants to see what's happening today
  const [dateRangeType, setDateRangeType] = useState<
    "today" | "week" | "month" | "year" | "custom"
  >("today"); 

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

  // Volume
  const currentVolume = dateSlips.reduce((acc, s) => acc + s.quantity, 0);
  const prevVolume = prevDateSlips.reduce((acc, s) => acc + s.quantity, 0);

  // Trips by Company Vehicles in period
  const companyVehicleTrips = dateSlips
    .filter(
      (s) => s.deliveryMode === "Company Vehicle" && s.status !== "Pending",
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
    return customers.reduce((sum, c) => {
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
      label: "Dispatches & Volume",
      value: `${dateSlips.length} Trips`,
      subValue: `${currentVolume.toFixed(2)} units (${volumePercent}% vs prev)`,
      isPositive: currentVolume >= prevVolume,
      icon: Truck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-500/20",
    },
    {
      label: "Cash In (Income)",
      value: `₹${income.toLocaleString()}`,
      subValue: `${incomePercent}% vs prev period`,
      isPositive: income >= prevIncome,
      icon: IndianRupee,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
    },
    {
      label: "Cash Out (Expenses)",
      value: `₹${expense.toLocaleString()}`,
      subValue: `${expensePercent}% vs prev period`,
      isPositive: expense <= prevExpense, // expenses going down is positive
      icon: TrendingUp,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-500/20",
    },
    {
      label: "Market Receivables",
      value: `₹${totalReceivables.toLocaleString()}`,
      subValue: `Pending collection`,
      isPositive: true, // Neutral metric
      icon: Wallet,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20",
    },
  ];

  const getRangeLabel = () => {
    if (dateRangeType === "today") return "Today";
    if (dateRangeType === "week") return "This Week";
    if (dateRangeType === "month") return "This Month";
    if (dateRangeType === "year") return "This Year";
    return "Custom Range";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Dashboard
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Performance overview for {getRangeLabel().toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="flex overflow-x-auto bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl w-full sm:w-auto hide-scrollbar">
            {(["today", "week", "month", "year", "custom"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDateRangeType(type as any)}
                className={`flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  dateRangeType === type
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white"
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          {dateRangeType === "custom" && (
            <div className="flex items-center space-x-2 bg-white dark:bg-zinc-800 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-sm text-zinc-700 dark:text-zinc-200 outline-none bg-transparent w-28 md:w-auto"
              />
              <span className="text-zinc-400 dark:text-zinc-500 font-semibold text-xs">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-sm text-zinc-700 dark:text-zinc-200 outline-none bg-transparent w-28 md:w-auto"
              />
            </div>
          )}
        </div>
      </div>

      {/* TOP 4 KEY METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:p-2 pb-2">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900/40 p-5 rounded-2xl shadow-sm border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-3 relative overflow-hidden group hover:shadow-md transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-center z-10 w-full">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {stat.label}
                </p>
                <div className={`p-2 rounded-xl ${stat.bg} shrink-0`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <div className="z-10 w-full flex items-end justify-between">
                <p className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
              <div className="z-10 w-full group-hover:translate-x-1 transition-transform">
                <p className="text-xs font-medium flex items-center gap-1.5">
                   {stat.label !== "Market Receivables" ? (
                       <>
                       <span className={`px-1.5 py-0.5 rounded-md flex items-center ${stat.isPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"}`}>
                         {stat.isPositive ? "↗" : "↘"} {stat.subValue}
                       </span>
                       </>
                   ) : (
                       <span className="text-zinc-500 dark:text-zinc-400">
                         {stat.subValue}
                       </span>
                   )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* MIDDLE ROW: LIVE DISPATCHES & RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-2">
        {/* Live Dispatches */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-4 md:p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Live Feed: Dispatches
            </h3>
            <span className="text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-md">
              Last 6 Slips
            </span>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {slips.slice().reverse().slice(0, 6).map((slip) => (
              <div key={slip.id} className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl flex flex-col gap-2 border border-zinc-100 dark:border-zinc-700/50 hover:border-primary-200 dark:hover:border-primary-900/30 transition-colors group">
                 <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-900 dark:text-white uppercase tracking-wide text-sm">{slip.vehicleNo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${slip.status === "Tallied" ? "bg-primary-100 text-primary-700" : slip.status === "Loaded" ? "bg-blue-100 text-blue-700" : slip.status === "Cancelled" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                      {slip.status}
                    </span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <div className="text-zinc-600 dark:text-zinc-400 font-medium text-xs">
                       {slip.materialType} • {slip.quantity.toFixed(1)} {slip.measurementType === "Volume (Brass)" ? "Brass" : "Tons"}
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="font-bold text-zinc-900 dark:text-white">
                          ₹{slip.totalAmount.toLocaleString()}
                       </span>
                       <button onClick={() => setPrintSlip(slip)} className="text-zinc-400 p-1.5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 hover:text-primary-600 dark:hover:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Printer className="w-3.5 h-3.5" />
                       </button>
                    </div>
                 </div>
              </div>
            ))}
            {slips.length === 0 && (
              <div className="text-center text-sm text-zinc-500 py-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl">No dispatches yet.</div>
            )}
          </div>
        </div>

        {/* Live Transactions */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-4 md:p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Live Feed: Transactions
            </h3>
            <span className="text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-md">
              Last 6 Entries
            </span>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {transactions
              .slice()
              .reverse()
              .slice(0, 6)
              .map((t) => (
                <div
                  key={t.id}
                  className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl flex items-center justify-between border border-zinc-100 dark:border-zinc-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-2 h-2 rounded-full shadow-sm ${t.type === "Income" ? "bg-emerald-500" : "bg-rose-500"}`}
                    />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {t.category}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate max-w-[150px] sm:max-w-[200px]">{t.description}</p>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold flex items-center ${t.type === "Income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                  >
                    {t.type === "Income" ? "+" : "-"}₹
                    {t.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            {transactions.length === 0 && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl">
                No transactions recorded.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: COMPANY VEHICLES */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-4 md:p-5">
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-zinc-400" />
          Company Vehicles Tracking ({getRangeLabel()})
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(
            Object.entries(companyVehicleTrips) as [
              string,
              { trips: number; quantity: number },
            ][]
          ).map(([vehicleNo, data]) => (
            <div
              key={vehicleNo}
              className="flex justify-between items-center p-3 bg-zinc-50 border border-zinc-100 dark:border-zinc-700/50 dark:bg-zinc-900/50 rounded-xl"
            >
              <span className="font-bold text-zinc-900 dark:text-white text-sm">{vehicleNo}</span>
              <div className="text-right">
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400 block">
                  {data.trips} Trips
                </span>
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  {data.quantity.toFixed(1)} units
                </span>
              </div>
            </div>
          ))}
          {Object.keys(companyVehicleTrips).length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-3 col-span-full">
              No company vehicle trips recorded in this period.
            </p>
          )}
        </div>
      </div>

      {printSlip && (
        <PrintSlipModal slip={printSlip} onClose={() => setPrintSlip(null)} />
      )}
    </div>
  );
}
