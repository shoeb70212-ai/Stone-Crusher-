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
  const { transactions, customers, slips, invoices, companySettings, addTransaction, addCustomer, getCustomerBalance, hasPermission, loadHistoricalData } =
    useErp();
  const { addToast } = useToast();
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
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



  const [custFormData, setCustFormData] = useState({
    name: "",
    phone: "",
    address: "",
    gstin: "",
    openingBalance: "0",
  });



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

  const canViewLedger = hasPermission("viewCustomerLedger");
  const canViewPending = hasPermission("viewPendingAmounts");
  const canManageCustomers = hasPermission("viewAllCustomers");
  const canViewStatement = hasPermission("viewCustomerStatement");

  if (!canViewLedger) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
        <UserCircle className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg">You do not have permission to view the customer ledger.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 h-full flex flex-col">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4 shrink-0">
        <h2 className="hidden md:block text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight mr-2">
          Customer Ledger
        </h2>
        <div className="flex flex-1 md:flex-none justify-end gap-2 w-full md:w-auto">
          <button
            onClick={async () => {
              setIsLoadingHistory(true);
              await loadHistoricalData();
              setIsLoadingHistory(false);
              addToast("success", "Historical records loaded successfully");
            }}
            disabled={isLoadingHistory}
            className="flex-1 md:flex-none justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm disabled:opacity-50"
          >
            {isLoadingHistory ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Load History
          </button>
          <button
            onClick={() => setIsPeriodModalOpen(true)}
            className="flex-1 md:flex-none justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Period Filter
          </button>
          {canManageCustomers && (
            <button
              onClick={() => setIsCustModalOpen(true)}
              className="flex-1 md:flex-none justify-center bg-primary-600 hover:bg-primary-700 text-white border border-transparent px-3 py-2 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm"
            >
              <UserCircle className="w-4 h-4 mr-2 shrink-0" />
              Add Customer
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-0 md:p-5 flex-1 overflow-y-auto">
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
               {customers.length === 0 && <div className="p-8 text-center text-zinc-500">No customers found.</div>}
               {customers.map((cust) => {
                  const currentBalance = getCustomerBalance(cust.id);
                  return (
                     <div key={cust.id} className={`p-3 flex items-center justify-between gap-3 ${canViewStatement ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors" : ""}`} onClick={() => canViewStatement && setViewCustomerLedger(cust)}>
                        <div className="flex-1 min-w-0">
                           <div className="font-bold text-zinc-900 dark:text-white truncate">{cust.name}</div>
                           <div className="text-xs text-zinc-500 truncate mt-0.5">{cust.phone}</div>
                        </div>
                        {canViewPending && (
                          <div className="text-right flex flex-col items-end shrink-0">
                             <span className={`font-bold text-sm ${currentBalance > 0 ? "text-rose-600" : currentBalance < 0 ? "text-primary-600" : "text-zinc-900 dark:text-white"}`}>
                                ₹{Math.abs(currentBalance).toLocaleString()} {currentBalance < 0 ? "(Cr)" : currentBalance > 0 ? "(Dr)" : ""}
                             </span>
                             <div className="mt-1">
                                {currentBalance > 0 ? (
                                   <span className="text-rose-600 font-bold text-[10px] bg-rose-50 px-1.5 py-0.5 rounded">OWES</span>
                                ) : currentBalance < 0 ? (
                                   <span className="text-primary-600 font-bold text-[10px] bg-primary-50 px-1.5 py-0.5 rounded">ADV</span>
                                ) : (
                                   <span className="text-zinc-500 font-bold text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded">CLEAR</span>
                                )}
                             </div>
                          </div>
                        )}
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
                        {canViewPending ? (
                          <td className="px-4 py-4 text-right font-bold text-zinc-900 dark:text-white">
                            ₹{Math.abs(currentBalance).toLocaleString()}{" "}
                            {currentBalance < 0 ? "(Cr)" : currentBalance > 0 ? "(Dr)" : ""}
                          </td>
                        ) : (
                          <td className="px-4 py-4 text-right text-zinc-400">Hidden</td>
                        )}
                        <td className="px-4 py-4 text-right">
                          {canViewStatement && (
                            <button
                              onClick={() => setViewCustomerLedger(cust)}
                              className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors"
                            >
                              View Ledger
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </div>
      </div>

      {isPeriodModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Period Filter</h3>
              <button
                onClick={() => setIsPeriodModalOpen(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Start Date</label>
                  <input
                    type="date"
                    value={txStartDate}
                    onChange={(e) => setTxStartDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">End Date</label>
                  <input
                    type="date"
                    value={txEndDate}
                    onChange={(e) => setTxEndDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  handleExportTransactions();
                  setIsPeriodModalOpen(false);
                }}
                className="w-full py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors shadow-sm mt-2 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
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
