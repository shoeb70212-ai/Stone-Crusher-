import React, { useMemo, useState } from "react";
import { useErp } from "../context/ErpContext";
import {
  Truck,
  IndianRupee,
  TrendingUp,
  Users,
  CalendarDays,
  Wallet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Printer
} from "lucide-react";
import {
  endOfDay,
  startOfDay,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  parseISO,
  format,
  subDays,
  subWeeks,
  subMonths,
  subYears,
} from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { PrintSlipModal } from "../components/forms/PrintSlipModal";
import { Slip } from "../types";

export function Dashboard() {
  const { slips, transactions, customers, invoices, getCustomerBalance } = useErp();
  const [printSlip, setPrintSlip] = useState<Slip | null>(null);

  const now = new Date();

  const [dateRangeType, setDateRangeType] = useState<
    "today" | "week" | "month" | "year" | "custom"
  >("month");
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
          dateStart: startOfMonth(now), dateEnd: endOfMonth(now),
          prevDateStart: startOfMonth(subMonths(now, 1)), prevDateEnd: endOfMonth(subMonths(now, 1))
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
  const { income, expense, netProfit, prevIncome, prevExpense, prevNetProfit } = useMemo(() => {
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
      income: inc, expense: exp, netProfit: inc - exp,
      prevIncome: pInc, prevExpense: pExp, prevNetProfit: pInc - pExp
    };
  }, [transactions, dateStart, dateEnd, prevDateStart, prevDateEnd]);

  // Material Stats for the period
  const materialByOwnVehicle = dateSlips
    .filter(
      (s) => s.deliveryMode === "Company Vehicle" && s.status !== "Pending",
    )
    .reduce((acc, curr) => acc + curr.quantity, 0);

  const materialByThirdParty = dateSlips
    .filter(
      (s) => s.deliveryMode === "Third-Party Vehicle" && s.status !== "Pending",
    )
    .reduce((acc, curr) => acc + curr.quantity, 0);

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

  // Profit/Loss statements breakdown (by category)
  const incomeByCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    transactions
      .filter(
        (t) =>
          t.type === "Income" &&
          isWithinInterval(new Date(t.date), {
            start: dateStart,
            end: dateEnd,
          }),
      )
      .forEach((t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
      });
    return acc;
  }, [transactions, dateStart, dateEnd]);

  const expenseByCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    transactions
      .filter(
        (t) =>
          t.type === "Expense" &&
          isWithinInterval(new Date(t.date), {
            start: dateStart,
            end: dateEnd,
          }),
      )
      .forEach((t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
      });
    return acc;
  }, [transactions, dateStart, dateEnd]);

  // Chart Data: Financials over time (group by day)
  const financialsChartData = useMemo(() => {
    const dataMap: Record<string, { date: string, Income: number, Expense: number }> = {};
    const curr = new Date(dateStart);
    
    // Determine grouping format based on duration
    const durationDays = (dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24);
    
    while (curr <= dateEnd) {
       let key = format(curr, "MMM dd"); // Default grouping
       if (durationDays > 60) {
          key = format(curr, "MMM yyyy"); // Group by month
       }
       if (!dataMap[key]) {
          dataMap[key] = { date: key, Income: 0, Expense: 0 };
       }
       curr.setDate(curr.getDate() + 1);
    }
    
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (isWithinInterval(d, { start: dateStart, end: dateEnd })) {
         let key = format(d, "MMM dd");
         if (durationDays > 60) {
            key = format(d, "MMM yyyy");
         }
         if (dataMap[key]) {
            dataMap[key][t.type] += t.amount;
         }
      }
    });
    return Object.values(dataMap);
  }, [transactions, dateStart, dateEnd]);

  // Chart Data: Material by Delivery Mode
  const materialPieData = [
    { name: "Company Vehicles", value: materialByOwnVehicle },
    { name: "Third-Party", value: materialByThirdParty },
  ].filter(d => d.value > 0);
  const COLORS = ['#3b82f6', '#f59e0b']; // blue-500, amber-500
  // Chart Data: Financial Category Breakdown
  const financialPieData = useMemo(() => {
    const data = [
      ...Object.entries(incomeByCategory).map(([name, value]) => ({ name, value: Number(value), type: 'Income' })),
      ...Object.entries(expenseByCategory).map(([name, value]) => ({ name, value: Number(value), type: 'Expense' }))
    ];
    return data.sort((a, b) => Number(b.value) - Number(a.value));
  }, [incomeByCategory, expenseByCategory]);
  
  const FIN_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#06b6d4'];

  const totalReceivables = useMemo(() => {
    return customers.reduce((sum, c) => {
      const bal = getCustomerBalance(c.id);
      return sum + (bal > 0 ? bal : 0);
    }, 0);
  }, [customers, getCustomerBalance]);

  const dateInvoices = invoices.filter((inv) =>
    isWithinInterval(new Date(inv.date), { start: dateStart, end: dateEnd })
  );
  
  const pendingInvoicesCount = dateInvoices.filter(i => i.status === 'Pending').length;
  const paidInvoicesCount = dateInvoices.filter(i => i.status === 'Paid').length;
  const cancelledInvoicesCount = dateInvoices.filter(i => i.status === 'Cancelled').length;

  const percentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "100" : "0";
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return change.toFixed(1);
  };

  const netProfitPercent = percentChange(netProfit, prevNetProfit);
  const incomePercent = percentChange(income, prevIncome);
  const expensePercent = percentChange(expense, prevExpense);
  const tripsPercent = percentChange(dateSlips.length, prevDateSlips.length);

  const stats = [
    {
      label: "Dispatches & Trips",
      value: dateSlips.length.toString(),
      subValue: `${tripsPercent}% vs prev period`,
      isPositive: dateSlips.length >= prevDateSlips.length,
      icon: Truck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-500/20",
    },
    {
      label: "Total Income",
      value: `₹${income.toLocaleString()}`,
      subValue: `${incomePercent}% vs prev period`,
      isPositive: income >= prevIncome,
      icon: IndianRupee,
      color: "text-primary-600 dark:text-primary-400",
      bg: "bg-primary-100 dark:bg-primary-500/20",
    },
    {
      label: "Total Expenses",
      value: `₹${expense.toLocaleString()}`,
      subValue: `${expensePercent}% vs prev period`,
      isPositive: expense <= prevExpense, // expenses going down is positive
      icon: TrendingUp,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-500/20",
    },
    {
      label: "Net Profit",
      value: `₹${netProfit.toLocaleString()}`,
      subValue: `${netProfitPercent}% vs prev period`,
      isPositive: netProfit >= prevNetProfit,
      icon: Wallet,
      color: netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      bg: netProfit >= 0 ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-amber-100 dark:bg-amber-500/20",
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
          <h2 className="text-xl md:text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:p-2 border-b border-zinc-100 dark:border-zinc-800 pb-6">
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
                   <span className={`px-1.5 py-0.5 rounded-md flex items-center ${stat.isPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"}`}>
                     {stat.isPositive ? "↗" : "↘"} {stat.subValue.split('%')[0]}%
                   </span>
                   <span className="text-zinc-400 dark:text-zinc-500">
                     from prev period
                   </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial Report Section (P&L Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 pb-6">
        <div className="lg:col-span-3 bg-[#1e293b] rounded-2xl shadow-sm p-3 md:p-5 text-white grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-700">
          <div className="flex items-center space-x-4 p-4 md:p-2 md:pr-6 cursor-default">
            <div className="p-3 rounded-full bg-primary-500/20 text-primary-400">
              <IndianRupee className="w-6 h-6" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">
                Total Income
              </p>
              <p className="text-xl md:text-2xl font-bold">₹{income.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 p-4 md:p-2 md:px-6 cursor-default">
            <div className="p-3 rounded-full bg-rose-500/20 text-rose-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">
                Total Expenses
              </p>
              <p className="text-xl md:text-2xl font-bold">₹{expense.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 p-4 md:p-2 md:pl-6 cursor-default">
            <div
              className={`p-3 rounded-full ${netProfit >= 0 ? "bg-indigo-500/20 text-indigo-400" : "bg-orange-500/20 text-orange-400"}`}
            >
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm font-medium mb-1">
                Net Profit / Loss
              </p>
              <p className="text-xl md:text-2xl font-bold">
                ₹{netProfit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Invoice & Receivables Overview */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-4 lg:col-span-1 flex flex-col justify-center">
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">Market Receivables</h3>
            <div className="text-2xl md:text-3xl tracking-tight font-bold text-red-600 dark:text-red-400 mb-4">
              ₹{totalReceivables.toLocaleString()}
            </div>
            <div className="space-y-2">
               <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center text-zinc-600 dark:text-zinc-300"><span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>Pending Invoices</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{pendingInvoicesCount}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center text-zinc-600 dark:text-zinc-300"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Paid Invoices</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{paidInvoicesCount}</span>
               </div>
            </div>
        </div>
      </div>

      {/* Deep Dive: Statement of Profit & Loss */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-0">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-3 md:p-5">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-6">Financial Overview</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-3 md:p-5 flex flex-col justify-center">
          <h3 className="font-bold text-zinc-900 dark:text-white mb-4">Cashflow Breakdown</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financialPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {financialPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={FIN_COLORS[index % FIN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Amount']}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {financialPieData.length === 0 && (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-2">No transactions recorded.</p>
          )}
        </div>
      </div>

      {/* Delivery & Material Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-3 md:p-5 flex flex-col justify-center">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
            Total Material Sold ({getRangeLabel()})
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={materialPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {materialPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value.toFixed(2)} units`, 'Volume']}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {materialPieData.length === 0 && (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-2">No material sold in this period.</p>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-3 md:p-5">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
            Company Vehicles Performance
          </h3>
          <div className="space-y-3 max-h-[160px] overflow-y-auto">
            {(
              Object.entries(companyVehicleTrips) as [
                string,
                { trips: number; quantity: number },
              ][]
            ).map(([vehicleNo, data]) => (
              <div
                key={vehicleNo}
                className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg"
              >
                <span className="font-medium text-zinc-900 dark:text-white">{vehicleNo}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-primary-600 block">
                    {data.trips} Trips
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {data.quantity.toFixed(2)} units total
                  </span>
                </div>
              </div>
            ))}
            {Object.keys(companyVehicleTrips).length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                No company vehicle trips recorded in period.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:p-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-3 md:p-5">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
            Recent Dispatches
          </h3>
          <div className="md:hidden space-y-3 mt-4">
            {slips.slice().reverse().slice(0, 5).map((slip) => (
              <div key={slip.id} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl flex flex-col gap-2 border border-zinc-100 dark:border-zinc-700">
                 <div className="flex justify-between items-center">
                    <span className="font-bold text-zinc-900 dark:text-white uppercase">{slip.vehicleNo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${slip.status === "Tallied" ? "bg-primary-100 text-primary-700" : slip.status === "Loaded" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {slip.status}
                    </span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <div className="text-zinc-600 dark:text-zinc-400">
                       {slip.materialType} • {slip.quantity.toFixed(1)} {slip.measurementType === "Volume (Brass)" ? "Brass" : "Tons"}
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="font-bold text-zinc-900 dark:text-white">
                          ₹{slip.totalAmount.toLocaleString()}
                       </span>
                       <button onClick={() => setPrintSlip(slip)} className="text-zinc-400 p-1 rounded-full bg-zinc-200/50 dark:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white">
                         <Printer className="w-3.5 h-3.5" />
                       </button>
                    </div>
                 </div>
              </div>
            ))}
            {slips.length === 0 && (
              <div className="text-center text-sm text-zinc-500 py-6">No dispatches yet.</div>
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left ">
              <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase rounded-lg">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Vehicle no.</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-lg text-right">Amount</th>
                  <th className="px-4 py-3 rounded-r-lg"></th>
                </tr>
              </thead>
              <tbody>
                {slips
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((slip) => (
                    <tr
                      key={slip.id}
                      className="border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <td className="px-4 py-4 font-medium text-zinc-900 dark:text-white">
                        {slip.vehicleNo}
                        <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                          {slip.deliveryMode}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {slip.materialType}{" "}
                        <span className="text-zinc-500 dark:text-zinc-400 px-1">
                          {slip.quantity.toFixed(1)}{" "}
                          {slip.measurementType === "Volume (Brass)"
                            ? "Brass"
                            : "Tons"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium
                        ${
                          slip.status === "Tallied"
                            ? "bg-primary-100 text-primary-700"
                            : slip.status === "Loaded"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                        >
                          {slip.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-medium">
                        ₹{slip.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => setPrintSlip(slip)}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-2"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                {slips.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      No dispatches yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-3 md:p-5">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
            Recent Transactions
          </h3>
          <div className="space-y-4">
            {transactions
              .slice()
              .reverse()
              .slice(0, 5)
              .map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between pb-4 border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 last:pb-0"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-2 h-2 rounded-full ${t.type === "Income" ? "bg-primary-500" : "bg-rose-500"}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {t.category}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.description}</p>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-semibold flex items-center ${t.type === "Income" ? "text-primary-600" : "text-rose-600"}`}
                  >
                    {t.type === "Income" ? "+" : "-"}₹
                    {t.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            {transactions.length === 0 && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-4">
                No transactions recorded.
              </p>
            )}
          </div>
        </div>
      </div>

      {printSlip && (
        <PrintSlipModal slip={printSlip} onClose={() => setPrintSlip(null)} />
      )}
    </div>
  );
}
