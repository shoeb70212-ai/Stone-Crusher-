import React, { useState, useMemo, useRef } from "react";
import { useErp } from "../context/ErpContext";
import { TransactionType, Transaction, Customer } from "../types";
import {
  Plus,
  X,
  IndianRupee,
  CreditCard,
  UserCircle,
  Download,
  Calendar,
  FileText,
  Loader2,
  Printer,
  MessageCircle,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { downloadCSV, downloadLedgerStatementPdf } from "../lib/export-utils";
import { printHtml } from "../lib/print-utils";
import { buildLedgerWhatsAppMessage, openWhatsAppMessage } from "../lib/whatsapp-share";
import { useToast } from "../components/ui/Toast";
import { generateId } from "../lib/utils";

export function Ledger() {
  const { transactions, customers, slips, invoices, companySettings, addTransaction, addCustomer, getCustomerBalance } =
    useErp();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"transactions" | "customers">(
    "transactions",
  );
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [viewCustomerLedger, setViewCustomerLedger] = useState<Customer | null>(
    null,
  );

  // Date-range filter state for the Transactions tab
  const [txStartDate, setTxStartDate] = useState(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [txEndDate, setTxEndDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );

  // Date-range filter state for the Customer Ledger Statement modal
  const [stmtStartDate, setStmtStartDate] = useState("");
  const [stmtEndDate, setStmtEndDate] = useState("");

  // Reference to statement table for PDF export
  const statementRef = useRef<HTMLDivElement>(null);

  const [txFormData, setTxFormData] = useState({
    type: "Expense" as TransactionType,
    amount: "",
    category: "",
    description: "",
    customerId: "",
  });

  const [custFormData, setCustFormData] = useState({
    name: "",
    phone: "",
    address: "",
    gstin: "",
    openingBalance: "0",
  });

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txFormData.amount) || 0;
    if (amount <= 0) {
      return; // silently ignore — form validation should prevent this
    }
    const newTx: Transaction = {
      id: "tx_" + generateId(),
      date: new Date().toISOString(),
      type: txFormData.type,
      amount: Math.round(amount),
      category: txFormData.category,
      description: txFormData.description,
      customerId: txFormData.customerId || undefined,
    };
    addTransaction(newTx);
    setIsTxModalOpen(false);
    setTxFormData({
      type: "Expense",
      amount: "",
      category: "",
      description: "",
      customerId: "",
    });
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const newCust: Customer = {
      id: generateId(),
      name: custFormData.name,
      phone: custFormData.phone,
      address: custFormData.address || undefined,
      gstin: custFormData.gstin || undefined,
      openingBalance: parseFloat(custFormData.openingBalance) || 0,
    };
    addCustomer(newCust);
    setIsCustModalOpen(false);
    setCustFormData({ name: "", phone: "", address: "", gstin: "", openingBalance: "0" });
  };

  /** Transactions filtered by the selected date range */
  const filteredTransactions = useMemo(() => {
    const start = new Date(txStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(txEndDate);
    end.setHours(23, 59, 59, 999);
    return transactions.filter((t) => {
      const d = parseISO(t.date);
      return d >= start && d <= end;
    });
  }, [transactions, txStartDate, txEndDate]);

  const totalCashIn = filteredTransactions
    .filter((t) => t.type === "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "Expense")
    .reduce((sum, t) => sum + t.amount, 0);

  /** Export the filtered transactions as a CSV file */
  const handleExportTransactions = async () => {
    try {
      await downloadCSV(
        filteredTransactions.map((tx) => {
          const cust = customers.find((c) => c.id === tx.customerId);
          return {
            date: new Date(tx.date).toLocaleDateString(),
            time: new Date(tx.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            type: tx.type,
            category: tx.category,
            description: tx.description,
            customer: cust?.name || "-",
            amount: tx.amount,
          };
        }),
        {
          date: "Date",
          time: "Time",
          type: "Type",
          category: "Category",
          description: "Description",
          customer: "Customer",
          amount: "Amount (₹)",
        },
        `Transactions_${txStartDate}_to_${txEndDate}`,
      );
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Export failed.");
    }
  };

  /** Export the customer ledger statement as a CSV file */
  const handleExportCustomerCSV = async (cust: Customer, entries: Array<{ date: Date; desc: string; debit: number; credit: number }>) => {
    let running = cust.openingBalance;
    const rows = [
      { date: "-", particulars: "Opening Balance", debit: cust.openingBalance > 0 ? cust.openingBalance : "", credit: cust.openingBalance < 0 ? Math.abs(cust.openingBalance) : "", balance: `${Math.abs(cust.openingBalance)} ${cust.openingBalance < 0 ? "Cr" : "Dr"}` },
      ...entries.map((e) => {
        running = running + e.debit - e.credit;
        return {
          date: e.date.toLocaleDateString(),
          particulars: e.desc,
          debit: e.debit > 0 ? e.debit : "",
          credit: e.credit > 0 ? e.credit : "",
          balance: `${Math.abs(running)} ${running < 0 ? "Cr" : running > 0 ? "Dr" : ""}`,
        };
      }),
    ];
    try {
      await downloadCSV(rows, { date: "Date", particulars: "Particulars", debit: "Debit (₹)", credit: "Credit (₹)", balance: "Balance (₹)" }, `Ledger_${cust.name.replace(/\s+/g, "_")}`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Export failed.");
    }
  };

  /** Download the customer ledger statement as a PDF */
  const handleExportCustomerPDF = async (custName: string) => {
    if (!statementRef.current) return;
    setIsExportingPdf(true);
    try {
      await downloadLedgerStatementPdf(custName, statementRef.current.innerHTML);
    } catch {
      addToast('error', 'PDF export failed. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Ledger & Finance
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Track expenses, cash flow, and customer outstanding balances.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <button
            onClick={() => setIsCustModalOpen(true)}
            className="flex-1 md:flex-none justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
          >
            <UserCircle className="w-4 h-4 md:w-5 md:h-5 mr-2 shrink-0" />
            <span className="whitespace-nowrap text-sm md:text-base">Add Customer</span>
          </button>
          <button
            onClick={() => setIsTxModalOpen(true)}
            className="flex-1 md:flex-none justify-center bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-2 shrink-0" />
            <span className="whitespace-nowrap text-sm md:text-base">New Transaction</span>
          </button>
        </div>
      </div>

      {/* Date-range filter for Transactions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 shrink-0">
          <Calendar className="w-4 h-4 text-primary-500" />
          <span>Period:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-1 w-full sm:w-auto">
          <input
            type="date"
            value={txStartDate}
            onChange={(e) => setTxStartDate(e.target.value)}
            className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="text-zinc-400 shrink-0">to</span>
          <input
            type="date"
            value={txEndDate}
            onChange={(e) => setTxEndDate(e.target.value)}
            className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          onClick={handleExportTransactions}
          className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
        <div className="bg-primary-50 border border-primary-100 p-3 md:p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-primary-800 font-medium">
              Total Cash/Income (Recorded)
            </p>
            <p className="text-3xl font-bold text-primary-600 mt-1">
              ₹{totalCashIn.toLocaleString()}
            </p>
          </div>
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-3 md:p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-rose-800 font-medium">Total Expenses</p>
            <p className="text-3xl font-bold text-rose-600 mt-1">
              ₹{totalExpense.toLocaleString()}
            </p>
          </div>
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
        <div className="border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 flex flex-wrap gap-4 text-sm md:text-base">
          <button
            className={`font-medium pb-3 border-b-2 transition-colors ${activeTab === "transactions" ? "border-primary-600 text-primary-600" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200"}`}
            onClick={() => setActiveTab("transactions")}
          >
            Day Book (Transactions)
          </button>
          <button
            className={`font-medium pb-3 border-b-2 transition-colors ${activeTab === "customers" ? "border-primary-600 text-primary-600" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200"}`}
            onClick={() => setActiveTab("customers")}
          >
            Customer Ledger
          </button>
        </div>

        <div className="p-0 md:p-5">
          {activeTab === "transactions" && (
            <>
            {/* Mobile list view */}
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
               {filteredTransactions.length === 0 && (
                 <div className="p-8 text-center text-zinc-500">No transactions in this period.</div>
               )}
               {filteredTransactions.slice().reverse().map((tx) => {
                  const cust = customers.find((c) => c.id === tx.customerId);
                  return (
                     <div key={tx.id} className={`p-3 flex items-center gap-3 border-l-4 ${tx.type === "Income" ? "border-l-primary-500 bg-primary-50/30 dark:bg-primary-500/5" : "border-l-rose-500 bg-rose-50/30 dark:bg-rose-500/5"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === "Income" ? "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400" : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"}`}>
                           {tx.type === "Income" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">{tx.category}</span>
                              <span className={`text-xs font-bold ${tx.type === "Income" ? "text-primary-600 dark:text-primary-400" : "text-rose-600 dark:text-rose-400"}`}>
                                 {tx.type === "Income" ? "+" : "-"} ₹{tx.amount.toLocaleString()}
                              </span>
                           </div>
                           <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{tx.description}</div>
                           <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-0.5">
                              <span>{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</span>
                              {tx.customerId && <span className="font-medium text-zinc-600 dark:text-zinc-300">Ref: {cust?.name}</span>}
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left ">
                <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase rounded-lg">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Date & Time</th>
                    <th className="px-4 py-3">Category/Desc</th>
                    <th className="px-4 py-3">Related To</th>
                    <th className="px-4 py-3 rounded-r-lg text-right">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions
                    .slice()
                    .reverse()
                    .map((tx) => {
                      const cust = customers.find(
                        (c) => c.id === tx.customerId,
                      );
                      return (
                        <tr
                          key={tx.id}
                          className="border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          <td className="px-4 py-4">
                            <p className="font-medium text-zinc-900 dark:text-white">
                              {new Date(tx.date).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {new Date(tx.date).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-zinc-900 dark:text-white">
                              {tx.category}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {tx.description}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-zinc-700 dark:text-zinc-200">
                            {tx.customerId ? cust?.name : "-"}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span
                              className={`font-semibold inline-flex items-center px-2.5 py-1 rounded-full text-xs
                            ${tx.type === "Income" ? "bg-primary-50 text-primary-700" : "bg-rose-50 text-rose-700"}`}
                            >
                              {tx.type === "Income" ? "+" : "-"} ₹
                              {tx.amount.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            </>
          )}

          {activeTab === "customers" && (
            <>
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
               {customers.length === 0 && <div className="p-8 text-center text-zinc-500">No customers found.</div>}
               {customers.map((cust) => {
                  const currentBalance = getCustomerBalance(cust.id);
                  return (
                     <div key={cust.id} className="p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                           <div>
                              <div className="font-bold text-zinc-900 dark:text-white text-lg">{cust.name}</div>
                              <div className="text-zinc-500 text-sm mt-0.5">{cust.phone}</div>
                           </div>
                           <div className="text-right">
                              <div className={`font-bold text-lg ${currentBalance > 0 ? "text-rose-600" : currentBalance < 0 ? "text-primary-600" : "text-zinc-900 dark:text-white"}`}>
                                 ₹{Math.abs(currentBalance).toLocaleString()} {currentBalance < 0 ? "(Cr)" : currentBalance > 0 ? "(Dr)" : ""}
                              </div>
                              <div className="mt-1">
                                 {currentBalance > 0 ? (
                                    <span className="text-rose-600 font-medium text-xs bg-rose-50 px-2 py-0.5 rounded">Owes Us</span>
                                 ) : currentBalance < 0 ? (
                                    <span className="text-primary-600 font-medium text-xs bg-primary-50 px-2 py-0.5 rounded">Advance</span>
                                 ) : (
                                    <span className="text-zinc-500 font-medium text-xs bg-zinc-100 px-2 py-0.5 rounded">Settled</span>
                                 )}
                              </div>
                           </div>
                        </div>
                        <button
                           onClick={() => setViewCustomerLedger(cust)}
                           className="w-full text-indigo-600 hover:text-indigo-900 font-medium text-sm bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg transition-colors"
                        >
                           View Ledger Statement
                        </button>
                     </div>
                  );
               })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left ">
                <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase rounded-lg">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Customer Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3 text-right">Status</th>
                    <th className="px-4 py-3 text-right">Balance Due</th>
                    <th className="px-4 py-3 rounded-r-lg text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cust) => {
                    const currentBalance = getCustomerBalance(cust.id);
                    return (
                      <tr
                        key={cust.id}
                        className="border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <td className="px-4 py-4 font-medium text-zinc-900 dark:text-white">
                          {cust.name}
                        </td>
                        <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                          {cust.phone}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {currentBalance > 0 ? (
                            <span className="text-rose-600 font-medium text-xs bg-rose-50 px-2 py-1 rounded">
                              Owes Us
                            </span>
                          ) : currentBalance < 0 ? (
                            <span className="text-primary-600 font-medium text-xs bg-primary-50 px-2 py-1 rounded">
                              Advance Given
                            </span>
                          ) : (
                            <span className="text-zinc-500 dark:text-zinc-400 font-medium text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                              Settled
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-4 text-right font-bold ${currentBalance > 0 ? "text-rose-600" : currentBalance < 0 ? "text-primary-600" : "text-zinc-900 dark:text-white"}`}
                        >
                          ₹{Math.abs(currentBalance).toLocaleString()}{" "}
                          {currentBalance < 0
                            ? "(Cr)"
                            : currentBalance > 0
                              ? "(Dr)"
                              : ""}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => setViewCustomerLedger(cust)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors"
                          >
                            View Ledger
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>

      {isTxModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Record Transaction
              </h3>
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTx} className="p-3 md:p-5 space-y-4">
              <div className="flex space-x-4 mb-2">
                <label
                  className={`flex-1 flex items-center justify-center py-2 px-4 rounded-lg border-2 cursor-pointer transition-colors ${txFormData.type === "Income" ? "border-primary-500 bg-primary-50 text-primary-700 font-semibold" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"}`}
                >
                  <input
                    type="radio"
                    className="hidden"
                    checked={txFormData.type === "Income"}
                    onChange={() =>
                      setTxFormData({ ...txFormData, type: "Income" })
                    }
                  />
                  Cash In (Income)
                </label>
                <label
                  className={`flex-1 flex items-center justify-center py-2 px-4 rounded-lg border-2 cursor-pointer transition-colors ${txFormData.type === "Expense" ? "border-rose-500 bg-rose-50 text-rose-700 font-semibold" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"}`}
                >
                  <input
                    type="radio"
                    className="hidden"
                    checked={txFormData.type === "Expense"}
                    onChange={() =>
                      setTxFormData({ ...txFormData, type: "Expense" })
                    }
                  />
                  Cash Out (Expense)
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Amount (₹)
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="1"
                  value={txFormData.amount}
                  onChange={(e) =>
                    setTxFormData({ ...txFormData, amount: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="1000"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Category
                </label>
                {txFormData.type === "Expense" ? (
                   <select
                     required
                     value={txFormData.category}
                     onChange={(e) =>
                       setTxFormData({ ...txFormData, category: e.target.value })
                     }
                     className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                   >
                     <option value="" disabled>Select Category</option>
                     {companySettings.expenseCategories?.map((cat, i) => (
                        <option key={i} value={cat}>{cat}</option>
                     ))}
                   </select>
                ) : (
                   <>
                     <input
                       required
                       list="category-options"
                       type="text"
                       value={txFormData.category}
                       onChange={(e) =>
                         setTxFormData({ ...txFormData, category: e.target.value })
                       }
                       className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                       placeholder="Payment Received, Advance, etc."
                     />
                     <datalist id="category-options">
                        <option value="Payments Received" />
                        <option value="Advance Received" />
                        <option value="Scrap Sale" />
                        <option value="Other Income" />
                     </datalist>
                   </>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Customer (Optional)
                </label>
                <select
                  value={txFormData.customerId}
                  onChange={(e) => {
                     const cid = e.target.value;
                     let suggestedCategory = txFormData.category;
                     if (cid) {
                        const pastTxs = transactions.filter(t => t.customerId === cid && t.type === txFormData.type);
                        if (pastTxs.length > 0) {
                           suggestedCategory = pastTxs[0].category;
                        } else {
                           if (txFormData.type === "Income") {
                              suggestedCategory = "Payments Received";
                           } else if (companySettings.expenseCategories && companySettings.expenseCategories.length > 0) {
                              suggestedCategory = companySettings.expenseCategories[0];
                           }
                        }
                     }
                     setTxFormData({ ...txFormData, customerId: cid, category: suggestedCategory });
                  }}
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">None (General {txFormData.type})</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  If selected, this will update the customer's ledger balance.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Description
                </label>
                <textarea
                  required
                  value={txFormData.description}
                  onChange={(e) =>
                    setTxFormData({
                      ...txFormData,
                      description: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none resize-none h-20"
                  placeholder="Enter details..."
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-zinc-900 text-white font-medium hover:bg-black rounded-lg transition-colors mt-2"
              >
                Save Transaction
              </button>
            </form>
          </div>
        </div>
      )}

      {isCustModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Add Customer</h3>
              <button
                onClick={() => setIsCustModalOpen(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-3 md:p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Customer Name
                </label>
                <input
                  required
                  type="text"
                  value={custFormData.name}
                  onChange={(e) =>
                    setCustFormData({ ...custFormData, name: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Phone
                </label>
                <input
                  required
                  type="text"
                  value={custFormData.phone}
                  onChange={(e) =>
                    setCustFormData({ ...custFormData, phone: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Address
                </label>
                <input
                  type="text"
                  value={custFormData.address}
                  onChange={(e) =>
                    setCustFormData({ ...custFormData, address: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={custFormData.gstin}
                  onChange={(e) =>
                    setCustFormData({ ...custFormData, gstin: e.target.value.toUpperCase() })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none uppercase"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Opening Balance
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={custFormData.openingBalance}
                  onChange={(e) =>
                    setCustFormData({
                      ...custFormData,
                      openingBalance: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Positive = They owe you. Negative = Advance given.
                </p>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg transition-colors mt-2"
              >
                Add Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {viewCustomerLedger && (() => {
        // Collect all entries for this customer
        const allEntries: Array<{ date: Date; desc: string; debit: number; credit: number }> = [];

        // Include Tallied, Pending, and Loaded slips to match getCustomerBalance,
        // so the running total at the bottom equals the Closing Balance footer.
        slips
          .filter((s) => s.customerId === viewCustomerLedger.id && (s.status === "Tallied" || s.status === "Pending" || s.status === "Loaded"))
          .forEach((s) => {
            allEntries.push({
              date: new Date(s.date),
              desc: s.invoiceId
                ? `Ref #${s.id.slice(0, 5).toUpperCase()} - ${s.materialType} Delivery (Billed)`
                : `Ref #${s.id.slice(0, 5).toUpperCase()} - ${s.materialType} Delivery`,
              debit: s.invoiceId ? 0 : s.totalAmount,
              credit: 0,
            });
          });

        invoices
          .filter((inv) => inv.customerId === viewCustomerLedger.id && inv.status !== "Cancelled")
          .forEach((inv) => {
            allEntries.push({
              date: new Date(inv.date),
              desc: `Inv #${inv.invoiceNo}`,
              debit: inv.total,
              credit: 0,
            });
          });

        transactions
          .filter((t) => t.customerId === viewCustomerLedger.id)
          .forEach((t) => {
            allEntries.push({
              date: new Date(t.date),
              desc: t.category + (t.description ? ` (${t.description})` : ""),
              debit: t.type === "Expense" ? t.amount : 0,
              credit: t.type === "Income" ? t.amount : 0,
            });
          });

        allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Apply optional date filter for the statement.
        // When a date range is active, the opening balance for the period is
        // computed from all entries BEFORE the range start so that the running
        // balance column shows the correct point-in-time value for each row.
        let periodOpeningBalance = viewCustomerLedger.openingBalance;
        let filteredEntries = allEntries;

        if (stmtStartDate || stmtEndDate) {
          const start = stmtStartDate ? new Date(stmtStartDate + 'T00:00:00') : null;
          const end   = stmtEndDate   ? new Date(stmtEndDate   + 'T23:59:59.999') : null;

          allEntries.forEach((e) => {
            if (start && e.date < start) {
              periodOpeningBalance += e.debit - e.credit;
            }
          });

          filteredEntries = allEntries.filter((e) => {
            if (start && e.date < start) return false;
            if (end   && e.date > end)   return false;
            return true;
          });
        }

        // Pre-compute running balance outside JSX so render is idempotent
        // (React may call render multiple times in Concurrent/Strict Mode).
        let bal = periodOpeningBalance;
        const entriesWithBalance = filteredEntries.map((e) => {
          bal = bal + e.debit - e.credit;
          return { ...e, runningBalance: bal };
        });
        const statementClosingBalance =
          entriesWithBalance.length > 0
            ? entriesWithBalance[entriesWithBalance.length - 1].runningBalance
            : periodOpeningBalance;

        return (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-4xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Ledger Statement: {viewCustomerLedger.name}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Phone: {viewCustomerLedger.phone}
                </p>
              </div>
              <button
                onClick={() => { setViewCustomerLedger(null); setStmtStartDate(""); setStmtEndDate(""); }}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Date filter + export bar */}
            <div className="px-4 py-2 md:px-6 border-b border-zinc-100 dark:border-zinc-700 flex flex-wrap items-center gap-2 bg-white dark:bg-zinc-800">
              <Calendar className="w-4 h-4 text-primary-500 shrink-0" />
              <input
                type="date"
                value={stmtStartDate}
                onChange={(e) => setStmtStartDate(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-medium text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-zinc-400 text-xs">to</span>
              <input
                type="date"
                value={stmtEndDate}
                onChange={(e) => setStmtEndDate(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-medium text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
              />
              {(stmtStartDate || stmtEndDate) && (
                <button onClick={() => { setStmtStartDate(""); setStmtEndDate(""); }} className="text-xs text-rose-500 hover:text-rose-700 font-medium">Clear</button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => {
                    const html = `
                      <div style="padding:24px;font-family:Inter,sans-serif;">
                        <h2 style="margin:0 0 4px;">${viewCustomerLedger.name}</h2>
                        <p style="margin:0 0 12px;color:#666;">Phone: ${viewCustomerLedger.phone || 'N/A'}${viewCustomerLedger.address ? ` | ${viewCustomerLedger.address}` : ''}${viewCustomerLedger.gstin ? ` | GSTIN: ${viewCustomerLedger.gstin}` : ''}</p>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;">
                          <thead><tr style="background:#f4f4f5;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Particulars</th><th style="padding:8px;text-align:right;">Debit</th><th style="padding:8px;text-align:right;">Credit</th><th style="padding:8px;text-align:right;">Balance</th></tr></thead>
                          <tbody>
                            <tr style="background:#fafafa;"><td style="padding:8px;border-bottom:1px solid #eee;">-</td><td style="padding:8px;border-bottom:1px solid #eee;">Opening Balance</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${periodOpeningBalance > 0 ? periodOpeningBalance.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance).toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${Math.abs(periodOpeningBalance).toLocaleString()} ${periodOpeningBalance < 0 ? 'Cr' : 'Dr'}</td></tr>
                            ${entriesWithBalance.map(e => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${e.date.toLocaleDateString()}</td><td style="padding:8px;border-bottom:1px solid #eee;">${e.desc}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#e11d48;">${e.debit > 0 ? e.debit.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#059669;">${e.credit > 0 ? e.credit.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${Math.abs(e.runningBalance).toLocaleString()} ${e.runningBalance < 0 ? 'Cr' : e.runningBalance > 0 ? 'Dr' : ''}</td></tr>`).join('')}
                          </tbody>
                        </table>
                        <p style="margin-top:12px;text-align:right;font-weight:bold;">Closing Balance: ₹${Math.abs(statementClosingBalance).toLocaleString()} ${statementClosingBalance < 0 ? 'Cr' : statementClosingBalance > 0 ? 'Dr' : ''}</p>
                      </div>
                    `;
                    printHtml(html);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => {
                    const message = buildLedgerWhatsAppMessage({ customer: viewCustomerLedger, entries: entriesWithBalance, closingBalance: statementClosingBalance });
                    openWhatsAppMessage(message);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  onClick={() => handleExportCustomerCSV(viewCustomerLedger, filteredEntries)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={() => handleExportCustomerPDF(viewCustomerLedger.name)}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  {isExportingPdf ? 'Generating…' : 'PDF'}
                </button>
              </div>
            </div>

            {/* Mobile customer header */}
            <div className="md:hidden px-4 py-3 border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800">
              <div className="text-base font-bold text-zinc-900 dark:text-white">{viewCustomerLedger.name}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{viewCustomerLedger.phone}{viewCustomerLedger.address ? ` · ${viewCustomerLedger.address}` : ''}{viewCustomerLedger.gstin ? ` · GSTIN: ${viewCustomerLedger.gstin}` : ''}</div>
              <div className="flex gap-3 mt-2">
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2 text-center border border-zinc-100 dark:border-zinc-700">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Opening</div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white">₹{Math.abs(periodOpeningBalance).toLocaleString()} {periodOpeningBalance < 0 ? 'Cr' : 'Dr'}</div>
                </div>
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2 text-center border border-zinc-100 dark:border-zinc-700">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Closing</div>
                  <div className={`text-xs font-bold ${statementClosingBalance > 0 ? 'text-rose-600' : statementClosingBalance < 0 ? 'text-primary-600' : 'text-zinc-900 dark:text-white'}`}>₹{Math.abs(statementClosingBalance).toLocaleString()} {statementClosingBalance < 0 ? 'Cr' : statementClosingBalance > 0 ? 'Dr' : ''}</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto flex-1 w-full p-3 md:p-5 hidden md:block" ref={statementRef}>
              <table className="w-full min-w-[560px] text-sm text-left">
                <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase rounded-lg">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Date</th>
                    <th className="px-4 py-3">Particulars</th>
                    <th className="px-4 py-3 text-right">
                      Debit (₹)
                      <br />
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 normal-case">
                        Charge/Expense
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      Credit (₹)
                      <br />
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 normal-case">
                        Payment/Income
                      </span>
                    </th>
                    <th className="px-4 py-3 rounded-r-lg text-right">
                      Balance (₹)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-50 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-900/50">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">-</td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                      {(stmtStartDate || stmtEndDate) ? "Opening Balance (Period)" : "Opening Balance"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {periodOpeningBalance > 0
                        ? periodOpeningBalance.toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {periodOpeningBalance < 0
                        ? Math.abs(periodOpeningBalance).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-white">
                      {Math.abs(periodOpeningBalance).toLocaleString()}{" "}
                      {periodOpeningBalance < 0 ? "Cr" : "Dr"}
                    </td>
                  </tr>

                  {entriesWithBalance.map((entry, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-zinc-50 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {entry.date.toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-900 dark:text-white">
                        {entry.desc}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600 font-medium">
                        {entry.debit > 0 ? entry.debit.toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-primary-600 font-medium">
                        {entry.credit > 0 ? entry.credit.toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-white">
                        {Math.abs(entry.runningBalance).toLocaleString()}{" "}
                        {entry.runningBalance < 0 ? "Cr" : entry.runningBalance > 0 ? "Dr" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list for statement */}
            <div className="md:hidden flex-1 w-full overflow-y-auto p-3">
              <div className="space-y-2">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-700 rounded-xl p-3">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Opening Balance</div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">₹{Math.abs(periodOpeningBalance).toLocaleString()} {periodOpeningBalance < 0 ? 'Cr' : 'Dr'}</div>
                </div>
                {entriesWithBalance.map((entry, idx) => (
                  <div key={idx} className={`bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl p-3 ${entry.debit > 0 ? 'border-l-4 border-l-rose-500' : entry.credit > 0 ? 'border-l-4 border-l-primary-500' : ''}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{entry.date.toLocaleDateString()}</span>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        ₹{Math.abs(entry.runningBalance).toLocaleString()} {entry.runningBalance < 0 ? 'Cr' : entry.runningBalance > 0 ? 'Dr' : ''}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{entry.desc}</div>
                    <div className="flex gap-3 mt-1">
                      {entry.debit > 0 && <span className="text-[11px] font-semibold text-rose-600">Dr: ₹{entry.debit.toLocaleString()}</span>}
                      {entry.credit > 0 && <span className="text-[11px] font-semibold text-primary-600">Cr: ₹{entry.credit.toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 md:px-6 md:py-4 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex justify-between items-center text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">End of Statement</span>
              <div className="font-bold text-lg">
                <span className="text-zinc-500 dark:text-zinc-400 mr-2">Closing Balance:</span>
                <span
                  className={
                    statementClosingBalance > 0
                      ? "text-rose-600"
                      : statementClosingBalance < 0
                        ? "text-primary-600"
                        : "text-zinc-900 dark:text-white"
                  }
                >
                  ₹{" "}
                  {Math.abs(statementClosingBalance).toLocaleString()}{" "}
                  {statementClosingBalance < 0
                    ? "(Cr)"
                    : statementClosingBalance > 0
                      ? "(Dr)"
                      : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
