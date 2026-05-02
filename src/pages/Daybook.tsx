import React, { useState, useMemo } from "react";
import { useErp } from "../context/ErpContext";
import { Slip, Transaction } from "../types";
import { transactionSchema } from "../lib/validation";
import { useToast } from "../components/ui/Toast";
import {
  Calendar as CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  Plus,
  X,
  Printer,
  IndianRupee,
  Download,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { CreateSlipForm } from "../components/forms/CreateSlipForm";
import { EditSlipForm } from "../components/forms/EditSlipForm";
import { PrintSlipModal } from "../components/forms/PrintSlipModal";
import { downloadCSV } from "../lib/export-utils";
import { MobileModal } from "../components/ui/MobileModal";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";

const REMARKS_MAX_LENGTH = 180;

export function Daybook() {
  const { transactions, slips, customers, companySettings, addTransaction, deleteTransaction } =
    useErp();
  const { addToast } = useToast();
  const [startDate, setStartDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );

  const [activeTab, setActiveTab] = useState<"slip" | "income" | "expense">("slip");
  
  const [isOpsModalOpen, setIsOpsModalOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState<Slip | null>(null);
  const [printSlip, setPrintSlip] = useState<Slip | null>(null);
  const [lastAddedTransaction, setLastAddedTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [txFormData, setTxFormData] = useState({
    amount: "",
    category: "",
    description: "",
    customerId: "",
  });

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    const txType = activeTab === "income" ? "Income" : "Expense";
    const validation = transactionSchema.safeParse({
      type: txType,
      amount: parseFloat(txFormData.amount) || 0,
      category: txFormData.category,
      description: txFormData.description,
      customerId: txFormData.customerId || undefined,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message ?? "Invalid transaction data";
      addToast("error", firstError);
      return false;
    }

    // Use the selected day's date so backdated transactions appear correctly
    // in the Daybook view rather than defaulting to today.
    const txDate = new Date(startDate);
    txDate.setHours(new Date().getHours(), new Date().getMinutes(), new Date().getSeconds());

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      date: txDate.toISOString(),
      type: txType,
      amount: Math.round(validation.data.amount),
      category: validation.data.category,
      description: validation.data.description ?? "",
      customerId: txFormData.customerId || undefined,
    };
    addTransaction(newTx);
    setLastAddedTransaction(newTx);
    setTxFormData({
      amount: "",
      category: "",
      description: "",
      customerId: "",
    });
    addToast("success", `${txType === "Income" ? "Receipt" : "Payment"} saved.`);
    return true;
  };

  const dailyData = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Slips for the period
    const daySlips = slips.filter((s) => {
      const d = parseISO(s.date);
      return d >= start && d <= end;
    });

    // Transactions for the period
    const dayTransactions = transactions.filter((t) => {
      const d = parseISO(t.date);
      return d >= start && d <= end;
    });

    const incoming = dayTransactions
      .filter((t) => t.type === "Income")
      .reduce((acc, t) => acc + t.amount, 0);
    const outgoing = dayTransactions
      .filter((t) => t.type === "Expense")
      .reduce((acc, t) => acc + t.amount, 0);

    const totalDispatchValue = daySlips.reduce(
      (acc, s) => acc + s.totalAmount,
      0,
    );
    const totalTrips = daySlips.length;

    // Combine daySlips and dayTransactions for a unified activity feed
    const combinedFeed = [
      ...daySlips.map(s => ({ ...s, feedType: "slip" as const })),
      ...dayTransactions.map(t => ({ ...t, feedType: "transaction" as const })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      daySlips,
      dayTransactions,
      incoming,
      outgoing,
      totalDispatchValue,
      totalTrips,
      netCashFlow: incoming - outgoing,
      combinedFeed,
    };
  }, [startDate, endDate, transactions, slips]);

  /** Export the combined daybook feed as CSV */
  const handleExportDaybook = async () => {
    if (isExporting) return;
    const rows = dailyData.combinedFeed.map((item) => {
      if (item.feedType === "slip") {
        const cust = customers.find((c) => c.id === item.customerId);
        return {
          date: new Date(item.date).toLocaleDateString(),
          time: new Date(item.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "Dispatch",
          description: `${item.materialType} - ${item.vehicleNo}`,
          customer: cust?.name || "Cash",
          amount: item.totalAmount,
        };
      } else {
        const cust = customers.find((c) => c.id === item.customerId);
        return {
          date: new Date(item.date).toLocaleDateString(),
          time: new Date(item.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: item.type,
          description: `${item.category}${item.description ? " - " + item.description : ""}`,
          customer: cust?.name || "-",
          amount: item.amount,
        };
      }
    });
    if (rows.length === 0) {
      addToast("warning", "No daybook entries found for this date range.");
      return;
    }

    setIsExporting(true);
    try {
      await downloadCSV(
        rows,
        { date: "Date", time: "Time", type: "Type", description: "Description", customer: "Customer", amount: "Amount (₹)" },
        `Daybook_${startDate}_to_${endDate}`.replace(/-/g, '')
      );
      addToast("success", `Exported ${rows.length} daybook entr${rows.length === 1 ? "y" : "ies"}.`);
    } catch {
      addToast("error", "Daybook export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 h-full">
      {/* Header — single compact row on mobile, no title (bottom nav provides context) */}
      <div className="flex items-center gap-1.5 md:gap-2 pb-2 md:pb-3 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
        {/* Desktop-only title */}
        <h2 className="hidden md:block text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight shrink-0 mr-2">
          Daybook
        </h2>

        {/* Date picker pill */}
        <button
          onClick={() => document.getElementById('daybook-date')?.click()}
          className="flex items-center gap-1.5 h-9 md:h-10 px-2.5 md:px-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shrink-0"
        >
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs md:text-sm font-semibold text-zinc-900 dark:text-white">
            {format(new Date(startDate), "dd MMM")}
          </span>
        </button>
        <input
          id="daybook-date"
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setEndDate(e.target.value);
          }}
          className="hidden"
        />

        {/* Quick action buttons */}
        <button
          onClick={() => { setActiveTab('slip'); setIsOpsModalOpen(true); }}
          className="flex items-center justify-center gap-1.5 h-9 md:h-10 px-2.5 md:px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl transition-all shadow-sm shrink-0"
          title="New Dispatch Slip"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Slip</span>
        </button>
        <button
          onClick={() => { setActiveTab('income'); setIsOpsModalOpen(true); }}
          className="flex items-center justify-center gap-1.5 h-9 md:h-10 px-2.5 md:px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl transition-all shadow-sm shrink-0"
          title="Cash Received"
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>In</span>
        </button>
        <button
          onClick={() => { setActiveTab('expense'); setIsOpsModalOpen(true); }}
          className="flex items-center justify-center gap-1.5 h-9 md:h-10 px-2.5 md:px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs md:text-sm font-semibold rounded-xl transition-all shadow-sm shrink-0"
          title="Expense"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Out</span>
        </button>

        {/* Export — icon-only pill on mobile */}
        <button
          onClick={() => void handleExportDaybook()}
          disabled={isExporting}
          className="flex items-center justify-center h-9 w-9 md:h-10 md:w-10 bg-zinc-800 dark:bg-white text-white dark:text-zinc-800 rounded-xl hover:bg-zinc-700 dark:hover:bg-zinc-200 active:scale-95 transition-all shadow-sm shrink-0 ml-auto disabled:opacity-60"
          title={isExporting ? "Exporting CSV" : "Export CSV"}
          aria-label={isExporting ? "Exporting daybook CSV" : "Export daybook CSV"}
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {lastAddedTransaction && transactions.some((t) => t.id === lastAddedTransaction.id) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-800 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
          <span className="min-w-0 truncate">
            Last entry: {lastAddedTransaction.category} · {lastAddedTransaction.type} · {lastAddedTransaction.amount.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => {
              deleteTransaction(lastAddedTransaction.id);
              setLastAddedTransaction(null);
              addToast("success", "Last transaction undone.");
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 font-semibold text-primary-700 shadow-sm dark:bg-zinc-900 dark:text-primary-300"
          >
            <RotateCcw className="h-3 w-3" />
            Undo
          </button>
        </div>
      )}

        {/* Hero Metrics - Dense grid for mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-100 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
               <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Trips</p>
               <Truck className="w-3.5 h-3.5 sm:w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
              {dailyData.totalTrips}
            </span>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1 truncate bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded w-fit">
               ₹{dailyData.totalDispatchValue.toLocaleString()}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-100 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
               <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Cash In</p>
               <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 h-4 text-primary-500" />
            </div>
            <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
              ₹{dailyData.incoming.toLocaleString()}
            </span>
            <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mt-1 bg-primary-50 dark:bg-primary-500/10 px-1.5 py-0.5 rounded w-fit">
               +receipts
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-100 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
               <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Cash Out</p>
               <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 h-4 text-rose-500" />
            </div>
            <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
              ₹{dailyData.outgoing.toLocaleString()}
            </span>
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mt-1 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded w-fit">
               -expenses
            </p>
          </div>

<div className="bg-zinc-900 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm text-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
               <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Net</p>
               <IndianRupee className="w-3 h-3 sm:w-4 sm:h-4 text-zinc-300" />
            </div>
            <span className={`text-base sm:text-2xl font-bold ${dailyData.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {dailyData.netCashFlow >= 0 ? "+" : "-"}₹{Math.abs(dailyData.netCashFlow).toLocaleString()}
            </span>
            <p className="text-xs font-medium text-zinc-400 mt-1 truncate">
               net position
            </p>
          </div>
        </div>

      {/* Live Activity Feed - Stacked on mobile, side by side on desktop */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Cash In Section */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl sm:rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 flex flex-col max-h-[200px] md:max-h-[300px] overflow-hidden">
          <div className="px-2.5 py-2 sm:px-4 sm:py-3 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">Cash In</h3>
            </div>
            <span className="text-xs font-semibold bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
              {dailyData.dayTransactions.filter(t => t.type === "Income").length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-1.5 sm:p-2">
            {dailyData.dayTransactions.filter(t => t.type === "Income").length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 space-y-2">
                <p className="text-xs">No cash in today</p>
              </div>
            ) : (
              <div className="space-y-1">
                {dailyData.dayTransactions.filter((t: Transaction) => t.type === "Income").map((item: Transaction) => (
                  <div key={`tx-${item.id}`} className="bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-100 dark:border-zinc-700 shadow-sm relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-lg"></div>
                    <div className="pl-2 sm:pl-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-zinc-900 dark:text-white text-[11px]">{item.category}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                            +₹{item.amount.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTransactionToDelete(item)}
                            className="rounded-md p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                            aria-label={`Delete ${item.category} receipt`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {format(parseISO(item.date), "HH:mm")} • {item.description || "-"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cash Out Section */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl sm:rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 flex flex-col max-h-[200px] md:max-h-[300px] overflow-hidden">
          <div className="px-2.5 py-2 sm:px-4 sm:py-3 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-rose-50 dark:bg-rose-900/20">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-rose-600 dark:text-rose-400" />
              <h3 className="font-bold text-rose-700 dark:text-rose-400 text-xs sm:text-sm">Cash Out</h3>
            </div>
            <span className="text-xs font-semibold bg-rose-100 dark:bg-rose-800 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded-full">
              {dailyData.dayTransactions.filter(t => t.type === "Expense").length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-1.5 sm:p-2">
              {dailyData.dayTransactions.filter(t => t.type === "Expense").length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 space-y-2">
                  <p className="text-xs sm:text-sm">No cash out today</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {dailyData.dayTransactions.filter((t: Transaction) => t.type === "Expense").map((item: Transaction) => (
                    <div key={`tx-${item.id}`} className="bg-white dark:bg-zinc-800 p-2 sm:p-3 rounded-lg border border-zinc-100 dark:border-zinc-700 hover:border-rose-200 transition-colors shadow-sm relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 rounded-l-lg"></div>
                      <div className="pl-2 sm:pl-3">
                        <div className="flex justify-between items-center mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-900 dark:text-white text-xs">{item.category}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-rose-600 dark:text-rose-400 text-xs">
                              -₹{item.amount.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => setTransactionToDelete(item)}
                              className="rounded-md p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                              aria-label={`Delete ${item.category} payment`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {format(parseISO(item.date), "HH:mm")} • {item.description || "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      </div>


      <MobileModal
        isOpen={isOpsModalOpen}
        onClose={() => setIsOpsModalOpen(false)}
        title="New Entry"
        mobileMode="taskSheet"
        maxWidth="max-w-lg"
      >
            
            {/* Tab Switcher */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0 text-sm font-medium bg-zinc-50 dark:bg-zinc-800/50">
              <button onClick={() => setActiveTab('slip')} className={`flex-1 py-3 text-center border-b-2 transition-colors ${activeTab === 'slip' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-zinc-500'}`}>New Slip</button>
              <button onClick={() => setActiveTab('income')} className={`flex-1 py-3 text-center border-b-2 transition-colors ${activeTab === 'income' ? 'border-primary-600 text-primary-600 dark:text-primary-400' : 'border-transparent text-zinc-500'}`}>Income</button>
              <button onClick={() => setActiveTab('expense')} className={`flex-1 py-3 text-center border-b-2 transition-colors ${activeTab === 'expense' ? 'border-rose-600 text-rose-600 dark:text-rose-400' : 'border-transparent text-zinc-500'}`}>Expense</button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeTab === 'slip' && (
                <CreateSlipForm onSuccess={(slip) => {
                  if (slip) setPrintSlip(slip);
                  setIsOpsModalOpen(false);
                }} />
              )}

              {(activeTab === 'income' || activeTab === 'expense') && (
                <form onSubmit={(e) => {
                  if (handleCreateTx(e)) {
                    setIsOpsModalOpen(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Amount (₹)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="1"
                      value={txFormData.amount}
                      onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="e.g., 5000"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Category</label>
                    <input
                      required
                      list={activeTab === "expense" ? "expense-options" : "income-options"}
                      type="text"
                      value={txFormData.category}
                      onChange={(e) => setTxFormData({ ...txFormData, category: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm"
                      placeholder={activeTab === "expense" ? "Search or type expense category" : "e.g., Payment, Advance"}
                    />
                    <datalist id="expense-options">
                      {companySettings.expenseCategories?.map((cat, i) => (
                        <option key={i} value={cat} />
                      ))}
                    </datalist>
                    <datalist id="income-options">
                      {["Payment", "Advance", "Balance Collection", "Other Income"].map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Link Customer (Optional)</label>
                    <select
                      value={txFormData.customerId}
                      onChange={(e) => setTxFormData({ ...txFormData, customerId: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">None</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Remarks</label>
                      <span className="text-[11px] font-medium text-zinc-400">
                        {txFormData.description.length}/{REMARKS_MAX_LENGTH}
                      </span>
                    </div>
                    <textarea
                      maxLength={REMARKS_MAX_LENGTH}
                      value={txFormData.description}
                      onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm resize-none h-20"
                      placeholder="Details (optional)..."
                    />
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-4 text-white font-bold rounded-xl transition-all shadow-sm hover:shadow-md ${activeTab === 'income' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                  >
                    Save {activeTab === "income" ? "Income" : "Expense"}
                  </button>
                </form>
)}
            </div>
      </MobileModal>

      {editingSlip && (
        <div className="fixed inset-0 bg-zinc-900/50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4 z-60">
          <div className="bg-white dark:bg-zinc-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto shadow-xl flex flex-col">
            {/* Drag handle — mobile only */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
            </div>
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">Edit Dispatch Slip</h3>
              <button onClick={() => setEditingSlip(null)} className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <EditSlipForm slip={editingSlip} onSuccess={() => setEditingSlip(null)} onCancel={() => setEditingSlip(null)} />
          </div>
        </div>
      )}

      {printSlip && <PrintSlipModal slip={printSlip} onClose={() => setPrintSlip(null)} />}

      <ConfirmationModal
        isOpen={!!transactionToDelete}
        title="Delete Transaction"
        message="This will remove the selected Daybook transaction from customer balances and exports."
        confirmText="Delete"
        onConfirm={() => {
          if (transactionToDelete) {
            deleteTransaction(transactionToDelete.id);
            if (lastAddedTransaction?.id === transactionToDelete.id) {
              setLastAddedTransaction(null);
            }
            setTransactionToDelete(null);
            addToast("success", "Transaction deleted.");
          }
        }}
        onCancel={() => setTransactionToDelete(null)}
      />
    </div>
  );
}
