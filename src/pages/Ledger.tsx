import React, { useState } from "react";
import { useErp } from "../context/ErpContext";
import { TransactionType, Transaction, Customer, Invoice } from "../types";
import {
  Plus,
  X,
  IndianRupee,
  CreditCard,
  ArrowRightLeft,
  UserCircle,
} from "lucide-react";

export function Ledger() {
  const { transactions, customers, slips, invoices, companySettings, addTransaction, addCustomer, getCustomerBalance } =
    useErp();
  const [activeTab, setActiveTab] = useState<"transactions" | "customers">(
    "transactions",
  );
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [viewCustomerLedger, setViewCustomerLedger] = useState<Customer | null>(
    null,
  );

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
    openingBalance: "0",
  });

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 11),
      date: new Date().toISOString(),
      type: txFormData.type,
      amount: Math.round(parseFloat(txFormData.amount) || 0),
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
      id: Math.random().toString(36).substring(2, 11),
      name: custFormData.name,
      phone: custFormData.phone,
      openingBalance: parseFloat(custFormData.openingBalance) || 0,
    };
    addCustomer(newCust);
    setIsCustModalOpen(false);
    setCustFormData({ name: "", phone: "", openingBalance: "0" });
  };

  const totalCashIn = transactions
    .filter((t) => t.type === "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "Expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
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
               {transactions.length === 0 && (
                 <div className="p-8 text-center text-zinc-500">No transactions recorded.</div>
               )}
               {transactions.slice().reverse().map((tx) => {
                  const cust = customers.find((c) => c.id === tx.customerId);
                  return (
                    <div key={tx.id} className="p-4 flex flex-col gap-2">
                       <div className="flex justify-between items-start">
                          <div className="font-bold text-zinc-900 dark:text-white">{tx.category}</div>
                          <span className={`font-semibold inline-flex items-center px-2 py-0.5 rounded text-xs ${tx.type === "Income" ? "bg-primary-50 text-primary-700" : "bg-rose-50 text-rose-700"}`}>
                             {tx.type === "Income" ? "+" : "-"} ₹{tx.amount.toLocaleString()}
                          </span>
                       </div>
                       <div className="text-sm text-zinc-600 dark:text-zinc-300">
                          {tx.description}
                       </div>
                       <div className="flex justify-between items-center text-xs text-zinc-500 mt-1">
                          <span>{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</span>
                          {tx.customerId && <span className="font-medium text-zinc-700 dark:text-zinc-300">Ref: {cust?.name}</span>}
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
                  {transactions
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

      {viewCustomerLedger && (
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
                onClick={() => setViewCustomerLedger(null)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-3 md:p-5 overflow-auto flex-1 w-full">
              <table className="w-full text-sm text-left ">
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
                      Opening Balance
                    </td>
                    <td className="px-4 py-3 text-right">
                      {viewCustomerLedger.openingBalance > 0
                        ? viewCustomerLedger.openingBalance.toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {viewCustomerLedger.openingBalance < 0
                        ? Math.abs(
                            viewCustomerLedger.openingBalance,
                          ).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-white">
                      {Math.abs(
                        viewCustomerLedger.openingBalance,
                      ).toLocaleString()}{" "}
                      {viewCustomerLedger.openingBalance < 0 ? "Cr" : "Dr"}
                    </td>
                  </tr>

                  {(() => {
                    // Collect entries
                    const entries: Array<{
                      date: Date;
                      desc: string;
                      debit: number;
                      credit: number;
                    }> = [];

                    // 1. Tallied slips
                    slips
                      .filter(
                        (s) =>
                          s.customerId === viewCustomerLedger.id &&
                          s.status === "Tallied",
                      )
                      .forEach((s) => {
                        entries.push({
                          date: new Date(s.date),
                          desc: s.invoiceId ? `Ref #${s.id.slice(0, 5).toUpperCase()} - ${s.materialType} Delivery (Billed)` : `Ref #${s.id.slice(0, 5).toUpperCase()} - ${s.materialType} Delivery`,
                          debit: s.invoiceId ? 0 : s.totalAmount, // Customer owes us for this material only if it isn't covered by an invoice
                          credit: 0,
                        });
                      });

                    // 2. Invoices
                    invoices
                      .filter(
                        (inv) =>
                          inv.customerId === viewCustomerLedger.id &&
                          inv.status !== "Cancelled",
                      )
                      .forEach((inv) => {
                        entries.push({
                          date: new Date(inv.date),
                          desc: `Inv #${inv.invoiceNo}`,
                          debit: inv.total, // Customer owes us for this invoice
                          credit: 0,
                        });
                      });

                    // 3. Transactions
                    transactions
                      .filter((t) => t.customerId === viewCustomerLedger.id)
                      .forEach((t) => {
                        entries.push({
                          date: new Date(t.date),
                          desc:
                            t.category +
                            (t.description ? ` (${t.description})` : ""),
                          debit: t.type === "Expense" ? t.amount : 0, // We paid/refunded them (they owe us more)
                          credit: t.type === "Income" ? t.amount : 0, // They paid us (credit against their balance)
                        });
                      });

                    // Sort chronological
                    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

                    let runningBalance = viewCustomerLedger.openingBalance;

                    return entries.map((entry, idx) => {
                      runningBalance =
                        runningBalance + entry.debit - entry.credit;

                      return (
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
                            {entry.debit > 0
                              ? entry.debit.toLocaleString()
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-primary-600 font-medium">
                            {entry.credit > 0
                              ? entry.credit.toLocaleString()
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-zinc-900 dark:text-white">
                            {Math.abs(runningBalance).toLocaleString()}{" "}
                            {runningBalance < 0
                              ? "Cr"
                              : runningBalance > 0
                                ? "Dr"
                                : ""}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 md:px-6 md:py-4 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex justify-between items-center text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">End of Statement</span>
              <div className="font-bold text-lg">
                <span className="text-zinc-500 dark:text-zinc-400 mr-2">Closing Balance:</span>
                <span
                  className={
                    getCustomerBalance(viewCustomerLedger.id) > 0
                      ? "text-rose-600"
                      : getCustomerBalance(viewCustomerLedger.id) < 0
                        ? "text-primary-600"
                        : "text-zinc-900 dark:text-white"
                  }
                >
                  ₹{" "}
                  {Math.abs(
                    getCustomerBalance(viewCustomerLedger.id),
                  ).toLocaleString()}{" "}
                  {getCustomerBalance(viewCustomerLedger.id) < 0
                    ? "(Cr)"
                    : getCustomerBalance(viewCustomerLedger.id) > 0
                      ? "(Dr)"
                      : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
