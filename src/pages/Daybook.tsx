import React, { useState, useMemo } from "react";
import { useErp } from "../context/ErpContext";
import { TransactionType, Transaction } from "../types";
import {
  Calendar as CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  Plus,
  X,
  FileText,
  Printer,
  Edit2,
  ListFilter,
  IndianRupee,
} from "lucide-react";
import { format, parseISO, isSameDay } from "date-fns";
import { CreateSlipForm } from "../components/forms/CreateSlipForm";
import { EditSlipForm } from "../components/forms/EditSlipForm";
import { PrintSlipModal } from "../components/forms/PrintSlipModal";
import { Slip } from "../types";

export function Daybook() {
  const { transactions, slips, customers, companySettings, addTransaction, addCustomer } =
    useErp();
  const [startDate, setStartDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );

  const [activeTab, setActiveTab] = useState<"slip" | "income" | "expense">("slip");
  
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState<Slip | null>(null);
  const [printSlip, setPrintSlip] = useState<Slip | null>(null);

  const [txFormData, setTxFormData] = useState({
    amount: "",
    category: "",
    description: "",
    customerId: "",
  });

  const [custFormData, setCustFormData] = useState({
    name: "",
    phone: "",
    openingBalance: "0",
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const newCust = {
      id: Math.random().toString(36).substring(2, 11),
      name: custFormData.name,
      phone: custFormData.phone,
      openingBalance: parseFloat(custFormData.openingBalance) || 0,
    };
    addCustomer(newCust);
    setIsCustModalOpen(false);
    setCustFormData({ name: "", phone: "", openingBalance: "0" });
  };

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 11),
      date: new Date().toISOString(),
      type: activeTab === "income" ? "Income" : "Expense",
      amount: Math.round(parseFloat(txFormData.amount) || 0),
      category: txFormData.category,
      description: txFormData.description,
      customerId: txFormData.customerId || undefined,
    };
    addTransaction(newTx);
    setTxFormData({
      amount: "",
      category: "",
      description: "",
      customerId: "",
    });
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      {/* Left Column: Data & Activity Log */}
      <div className="xl:col-span-2 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
              Daybook Portal
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
              Overview & operations for the selected date.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 bg-white dark:bg-zinc-800 p-2 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 px-2">
              <CalendarIcon className="w-5 h-5 text-indigo-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent font-medium text-sm text-zinc-900 dark:text-white outline-none"
              />
            </div>
            <span className="text-zinc-400 hidden sm:inline">-</span>
            <div className="flex items-center gap-2 px-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent font-medium text-sm text-zinc-900 dark:text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
               <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Trips</p>
               <Truck className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">
              {dailyData.totalTrips}
            </span>
            <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mt-1 truncate bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded inline-block w-fit">
               ₹{dailyData.totalDispatchValue.toLocaleString()} value
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
               <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Cash In</p>
               <ArrowDownRight className="w-4 h-4 text-primary-500" />
            </div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">
              ₹{dailyData.incoming.toLocaleString()}
            </span>
            <p className="text-[11px] font-medium text-primary-600 dark:text-primary-400 mt-1 bg-primary-50 dark:bg-primary-500/10 px-2 py-0.5 rounded inline-block w-fit">
               Receipts today
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
               <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Cash Out</p>
               <ArrowUpRight className="w-4 h-4 text-rose-500" />
            </div>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">
              ₹{dailyData.outgoing.toLocaleString()}
            </span>
            <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded inline-block w-fit">
               Expenses today
            </p>
          </div>

          <div className="bg-zinc-900 p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
               <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Net Cashflow</p>
               <IndianRupee className="w-4 h-4 text-zinc-300" />
            </div>
            <span className={`text-2xl font-bold ${dailyData.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {dailyData.netCashFlow >= 0 ? "+" : "-"}₹{Math.abs(dailyData.netCashFlow).toLocaleString()}
            </span>
            <p className="text-[11px] font-medium text-zinc-400 mt-1 truncate">
               Net daily position
            </p>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 flex flex-col h-[600px]">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/20">
             <div className="flex items-center gap-2">
               <ListFilter className="w-4 h-4 text-zinc-500" />
               <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Combined Activity Feed</h3>
             </div>
             <span className="text-xs font-semibold bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full">
               {dailyData.combinedFeed.length} entries
             </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {dailyData.combinedFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 space-y-2">
                <FileText className="w-8 h-8 opacity-50" />
                <p className="text-sm">No activity recorded for this day.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dailyData.combinedFeed.map((item: any) => {
                  if (item.feedType === "slip") {
                     return (
                       <div key={`slip-${item.id}`} className="bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700 hover:border-blue-200 transition-colors shadow-sm relative group">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl"></div>
                          <div className="pl-3">
                             <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-900 dark:text-white text-sm uppercase">{item.vehicleNo}</span>
                                  <span className="text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">DISPATCH</span>
                                </div>
                                <span className="font-bold text-zinc-900 dark:text-white text-sm tracking-tight">₹{item.totalAmount.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                                <span>{format(parseISO(item.date), "hh:mm a")} • {item.materialType} • {item.quantity.toFixed(1)} {item.measurementType === "Volume (Brass)" ? "Brass" : "Tons"}</span>
                                <div className="flex items-center gap-1 opacity-100 transition-opacity">
                                  <button onClick={() => setEditingSlip(item)} className="p-1 hover:text-blue-600 bg-zinc-50 dark:bg-zinc-700 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => setPrintSlip(item)} className="p-1 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-zinc-700 rounded"><Printer className="w-3.5 h-3.5" /></button>
                                </div>
                             </div>
                          </div>
                       </div>
                     )
                  } else {
                     const isIncome = item.type === "Income";
                     return (
                       <div key={`tx-${item.id}`} className="bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700 hover:border-zinc-300 transition-colors shadow-sm relative">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${isIncome ? "bg-primary-500" : "bg-rose-500"}`}></div>
                          <div className="pl-3">
                             <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-900 dark:text-white text-sm">{item.category}</span>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isIncome ? "bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                                     {item.type.toUpperCase()}
                                  </span>
                                </div>
                                <span className={`font-bold text-sm tracking-tight ${isIncome ? "text-primary-600 dark:text-primary-400" : "text-rose-600 dark:text-rose-400"}`}>
                                   {isIncome ? "+" : "-"}₹{item.amount.toLocaleString()}
                                </span>
                             </div>
                             <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                                <span>{format(parseISO(item.date), "hh:mm a")} • {item.description || "No remarks"}</span>
                             </div>
                          </div>
                       </div>
                     )
                  }
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Embedded Actions Hub */}
      <div className="bg-white dark:bg-zinc-900 flex flex-col h-[760px] xl:h-auto xl:min-h-[600px] rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden sticky xl:top-6 z-10 hidden-scrollbar">
         <div className="p-4 bg-zinc-900 text-white flex justify-between items-center shrink-0">
            <h3 className="font-bold text-sm flex items-center gap-2">
               Operations Hub
            </h3>
            <button onClick={() => setIsCustModalOpen(true)} className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors flex items-center">
               <Plus className="w-3 h-3 mr-1" /> Customer
            </button>
         </div>
         
         <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0 text-xs sm:text-sm font-medium bg-zinc-50 dark:bg-zinc-800/50 overflow-x-auto hide-scrollbar">
            <button onClick={() => setActiveTab('slip')} className={`flex-none py-3 px-3 text-center border-b-2 transition-colors ${activeTab === 'slip' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-white dark:bg-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Dispatch Slip</button>
            <button onClick={() => setActiveTab('income')} className={`flex-none py-3 px-3 text-center border-b-2 transition-colors ${activeTab === 'income' ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Receive</button>
            <button onClick={() => setActiveTab('expense')} className={`flex-none py-3 px-3 text-center border-b-2 transition-colors ${activeTab === 'expense' ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-white dark:bg-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Expense</button>
         </div>

         <div className="flex-1 overflow-y-auto w-full">
            {activeTab === 'slip' && (
              <div className="pb-8">
                 <CreateSlipForm onSuccess={(slip) => slip && setPrintSlip(slip)} />
              </div>
            )}

            {(activeTab === 'income' || activeTab === 'expense') && (
              <form onSubmit={handleCreateTx} className="p-5 space-y-5">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700">
                   <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Amount (₹)</label>
                        <input
                          required
                          type="number"
                          step="0.01"
                          min="1"
                          value={txFormData.amount}
                          onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
                          placeholder="e.g., 5000"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Category</label>
                        {activeTab === "expense" ? (
                           <select
                              value={txFormData.category}
                              onChange={(e) => setTxFormData({ ...txFormData, category: e.target.value })}
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                              required
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
                                list="income-options"
                                type="text"
                                value={txFormData.category}
                                onChange={(e) => setTxFormData({ ...txFormData, category: e.target.value })}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder="e.g., Payment, Advance"
                             />
                             <datalist id="income-options">
                               <option value="Payments Received" />
                               <option value="Advance Received" />
                               <option value="Scrap Sale" />
                               <option value="Other Income" />
                             </datalist>
                           </>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Link Customer (Optional)</label>
                        <select
                          value={txFormData.customerId}
                          onChange={(e) => {
                             const cid = e.target.value;
                             let suggestedCategory = txFormData.category;
                             if (cid) {
                                const pastTxs = transactions.filter(t => t.customerId === cid && t.type === (activeTab === "income" ? "Income" : "Expense"));
                                if (pastTxs.length > 0) {
                                   suggestedCategory = pastTxs[0].category;
                                } else {
                                   if (activeTab === "income") {
                                      suggestedCategory = "Payments Received";
                                   } else if (companySettings.expenseCategories && companySettings.expenseCategories.length > 0) {
                                      suggestedCategory = companySettings.expenseCategories[0];
                                   }
                                }
                             }
                             setTxFormData({ ...txFormData, customerId: cid, category: suggestedCategory });
                          }}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="">None (General Entry)</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">Remarks</label>
                        <textarea
                          required
                          value={txFormData.description}
                          onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none h-20"
                          placeholder="Details..."
                        ></textarea>
                      </div>
                   </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-4 text-white font-bold rounded-xl transition-all shadow-sm hover:shadow-md ${activeTab === 'income' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                >
                  Save {activeTab === "income" ? "Receipt" : "Payment"}
                </button>
              </form>
            )}
         </div>
      </div>

      {isCustModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Add Customer</h3>
              <button onClick={() => setIsCustModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Customer Name</label>
                <input required type="text" value={custFormData.name} onChange={(e) => setCustFormData({ ...custFormData, name: e.target.value })} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Phone</label>
                <input required type="text" value={custFormData.phone} onChange={(e) => setCustFormData({ ...custFormData, phone: e.target.value })} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Opening Balance</label>
                <input required type="number" step="0.01" value={custFormData.openingBalance} onChange={(e) => setCustFormData({ ...custFormData, openingBalance: e.target.value })} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none" />
                <p className="text-xs text-zinc-500">Positive = They owe you. Negative = Advance.</p>
              </div>
              <button type="submit" className="w-full py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg">Add Customer</button>
            </form>
          </div>
        </div>
      )}

      {editingSlip && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Edit Dispatch Slip</h3>
              <button onClick={() => setEditingSlip(null)} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
            </div>
            <EditSlipForm slip={editingSlip} onSuccess={() => setEditingSlip(null)} onCancel={() => setEditingSlip(null)} />
          </div>
        </div>
      )}

      {printSlip && <PrintSlipModal slip={printSlip} onClose={() => setPrintSlip(null)} />}
    </div>
  );
}
