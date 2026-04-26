import React, { useState, useMemo } from "react";
import { useErp } from "../context/ErpContext";
import {
  Users,
  Plus,
  X,
  Phone,
  User as UserIcon,
  FileText,
  ArrowDownRight,
  ArrowUpRight,
  Edit2,
  Trash2,
} from "lucide-react";
import { Customer } from "../types";
import { format, parseISO } from "date-fns";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";

export function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, slips, transactions, getCustomerBalance, invoices } = useErp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDataId, setEditingDataId] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    gstin: "",
    openingBalance: "0",
  });

  const handleCreateOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDataId) {
      updateCustomer({
        id: editingDataId,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        gstin: formData.gstin,
        openingBalance: Math.round(parseFloat(formData.openingBalance) || 0),
      });
    } else {
      const newCustomer: Customer = {
        id: Math.random().toString(36).substr(2, 9),
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        gstin: formData.gstin,
        openingBalance: Math.round(parseFloat(formData.openingBalance) || 0),
      };
      addCustomer(newCustomer);
    }
    
    setIsModalOpen(false);
    setFormData({ name: "", phone: "", address: "", gstin: "", openingBalance: "0" });
    setEditingDataId(null);
  };

  const openCreateModal = () => {
    setEditingDataId(null);
    setFormData({ name: "", phone: "", address: "", gstin: "", openingBalance: "0" });
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingDataId(customer.id);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      address: customer.address || "",
      gstin: customer.gstin || "",
      openingBalance: customer.openingBalance.toString(),
    });
    setIsModalOpen(true);
  };

  const removeCustomer = (id: string) => {
    const hasSlips = slips.some(s => s.customerId === id);
    const hasInvoices = invoices.some(i => i.customerId === id);
    const hasTxs = transactions.some(t => t.customerId === id);
    
    if (hasSlips || hasInvoices || hasTxs) {
        alert("Cannot delete customer: They have existing slips, invoices, or transactions. Please settle accounts and use 'Mark Inactive' (not currently supported) instead of deletion.");
        return;
    }
    setCustomerToDelete(id);
  };

  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");
  const [ledgerTxType, setLedgerTxType] = useState("All");
  const [ledgerTxCategory, setLedgerTxCategory] = useState("All");
  const [ledgerSortDirection, setLedgerSortDirection] = useState("desc");

  const customerHistory = useMemo(() => {
    if (!selectedCustomer) return [];

    const historyItems: {
      id: string;
      date: string;
      type: string;
      category: "Opening" | "Slip" | "Invoice" | "Transaction";
      description: string;
      amount: number;
      isCharge: boolean;
      affectsBalance?: boolean;
    }[] = [];

    // Add opening balance
    if (selectedCustomer.openingBalance !== 0) {
      historyItems.push({
        id: "opening",
        date: new Date(0).toISOString(), // Beginning of time for sorting
        type: "Opening Balance",
        category: "Opening",
        description: "Initial balance",
        amount: selectedCustomer.openingBalance,
        isCharge: selectedCustomer.openingBalance > 0, // Positive balance means they owe us
        affectsBalance: true,
      });
    }

    // Add Slips (Purchases/Charges)
    slips
      .filter((s) => s.customerId === selectedCustomer.id && s.status === "Tallied")
      .forEach((s) => {
        historyItems.push({
          id: s.id,
          date: s.date,
          type: "Dispatch",
          category: "Slip",
          description: `Trip ${s.vehicleNo} - ${s.materialType} • ${s.quantity.toFixed(2)} ${s.measurementType === 'Volume (Brass)' ? 'Brass' : 'Tons'} @ ₹${s.ratePerUnit}${s.invoiceId ? ' (Billed)' : ''}`,
          amount: s.totalAmount,
          isCharge: true,
          affectsBalance: !s.invoiceId, // Billed slips don't increase balance since the Invoice handles it
        });
      });

    // Add Invoices
    invoices
      .filter(
        (inv) =>
          inv.customerId === selectedCustomer.id &&
          inv.status !== "Cancelled",
      )
      .forEach((inv) => {
        historyItems.push({
          id: inv.id,
          date: inv.date,
          type: "Invoice",
          category: "Invoice",
          description: `Inv #${inv.invoiceNo}`,
          amount: inv.total,
          isCharge: true,
          affectsBalance: true,
        });
      });

    // Add Transactions
    transactions
      .filter((t) => t.customerId === selectedCustomer.id)
      .forEach((t) => {
        historyItems.push({
          id: t.id,
          date: t.date,
          type:
            t.type === "Income" ? "Payment Received" : "Refund/Charge Given",
          category: "Transaction",
          description:
            t.category + (t.description ? ` - ${t.description}` : ""),
          amount: t.amount,
          isCharge: t.type === "Expense",
          affectsBalance: true,
        });
      });

    // Sort by date ascending
    historyItems.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let runningBalance = 0;
    const computedHistory = historyItems
      .map((item) => {
        if (item.affectsBalance !== false) {
           runningBalance += item.isCharge ? item.amount : -item.amount;
        }
        return { ...item, runningBalance };
      })
      .reverse();

    let results = computedHistory.filter(item => {
       if (item.id === "opening") return true; 

       if (ledgerTxType !== "All") {
          if (ledgerTxType === "Charge" && !item.isCharge) return false;
          if (ledgerTxType === "Payment" && item.isCharge) return false;
       }

       if (ledgerTxCategory !== "All") {
          if (item.category !== ledgerTxCategory) return false;
       }

       if (ledgerStartDate && new Date(item.date) < new Date(ledgerStartDate)) return false;
       if (ledgerEndDate) {
          const end = new Date(ledgerEndDate);
          end.setHours(23, 59, 59, 999);
          if (new Date(item.date) > end) return false;
       }
       return true;
    });

    if (ledgerSortDirection === "asc") {
       results = results.reverse();
    }

    return results;
  }, [selectedCustomer, slips, transactions, invoices, ledgerStartDate, ledgerEndDate, ledgerTxType, ledgerTxCategory, ledgerSortDirection]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Customers Directory
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Manage customer profiles and view their balances.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Customer
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-700/50">
          {customers.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
               No customers found.
            </div>
          ) : (
            customers.map((c) => {
              const bal = getCustomerBalance(c.id);
              return (
                <div key={c.id} className="p-4 bg-white dark:bg-zinc-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 shrink-0">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-white">{c.name}</div>
                        <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          <Phone className="w-3 h-3 mr-1" /> {c.phone}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                    <div>
                      <span className="text-zinc-500 text-xs block">Opening</span>
                      <span className="font-medium dark:text-zinc-200">₹{c.openingBalance.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-xs block">Balance</span>
                      <span
                        className={`font-bold tracking-tight ${
                          bal > 0
                            ? "text-red-600 dark:text-red-400"
                            : bal < 0
                              ? "text-primary-600 dark:text-primary-400"
                              : "text-zinc-700 dark:text-zinc-200"
                        }`}
                      >
                        ₹{Math.abs(bal).toLocaleString()} {bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-1 gap-2">
                    <button onClick={() => setSelectedCustomer(c)} className="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-2 rounded-lg font-medium flex items-center flex-1 justify-center">
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> Statement
                    </button>
                    <button onClick={() => openEditModal(c)} className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg font-medium flex items-center justify-center border border-indigo-100">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block p-0 sm:p-4 md:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left ">
              <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase rounded-lg">
                <tr>
                  <th className="px-4 py-4 md:py-3 rounded-tl-lg md:rounded-l-lg">
                    Name
                  </th>
                  <th className="px-4 py-4 md:py-3">Contact</th>
                  <th className="px-4 py-4 md:py-3">Opening Bal.</th>
                  <th className="px-4 py-4 md:py-3 text-right">
                    Current Balance
                  </th>
                  <th className="px-4 py-4 md:py-3 text-right rounded-tr-lg md:rounded-r-lg">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const bal = getCustomerBalance(c.id);
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <td className="px-4 py-4 font-bold text-zinc-900 dark:text-white flex items-center">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 mr-3 shrink-0">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        {c.name}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        <div className="flex items-center">
                          <Phone className="w-3 h-3 mr-1 text-zinc-400 dark:text-zinc-500" />
                          {c.phone}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-500 dark:text-zinc-400 font-medium tracking-tight">
                        ₹ {c.openingBalance.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className={`font-bold tracking-tight px-2.5 py-1 rounded-full text-xs ${
                            bal > 0
                              ? "bg-red-50 text-red-700"
                              : bal < 0
                                ? "bg-primary-50 text-primary-700"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                          }`}
                        >
                          ₹ {Math.abs(bal).toLocaleString()}{" "}
                          {bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedCustomer(c)}
                            title="Statement"
                            className="text-primary-600 hover:text-primary-700 font-semibold bg-primary-50 hover:bg-primary-100 p-2 rounded-lg transition-colors flex items-center"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(c)}
                            title="Edit Customer"
                            className="text-indigo-600 hover:text-indigo-700 font-semibold bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors flex items-center"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeCustomer(c.id)}
                            title="Delete Customer"
                            className="text-rose-600 hover:text-rose-700 font-semibold bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors flex items-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingDataId ? "Edit Customer" : "Add New Customer"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="p-3 md:p-5 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Customer Name
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    type="text"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="e.g. Acme Constructions"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Phone / Contact
                  </label>
                  <input
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    type="text"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="9876543210"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Customer Address"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    GSTIN
                  </label>
                  <input
                    value={formData.gstin}
                    onChange={(e) =>
                      setFormData({ ...formData, gstin: e.target.value })
                    }
                    type="text"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none uppercase"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Opening Balance (₹)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        openingBalance: e.target.value,
                      })
                    }
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Positive if they owe money, negative if they paid an
                    advance.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-zinc-100 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#f8fafc] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col relative">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {selectedCustomer.name} - Statement
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Current Balance:{" "}
                  <strong className="text-zinc-900 dark:text-white">
                    ₹{getCustomerBalance(selectedCustomer.id).toLocaleString()}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-800">
               <div className="p-3 md:p-4 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex flex-wrap gap-3 items-end shrink-0">
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">From</label>
                     <input type="date" value={ledgerStartDate} onChange={e => setLedgerStartDate(e.target.value)} className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500" />
                  </div>
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">To</label>
                     <input type="date" value={ledgerEndDate} onChange={e => setLedgerEndDate(e.target.value)} className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500" />
                  </div>
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Type</label>
                     <select value={ledgerTxType} onChange={e => setLedgerTxType(e.target.value)} className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500">
                        <option value="All">All Impact</option>
                        <option value="Charge">Charges (Dr)</option>
                        <option value="Payment">Payments (Cr)</option>
                     </select>
                  </div>
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Category</label>
                     <select value={ledgerTxCategory} onChange={e => setLedgerTxCategory(e.target.value)} className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500">
                        <option value="All">All Types</option>
                        <option value="Slip">Slips (Dispatch)</option>
                        <option value="Invoice">Invoices</option>
                        <option value="Transaction">Transactions</option>
                     </select>
                  </div>
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Sort By</label>
                     <select value={ledgerSortDirection} onChange={e => setLedgerSortDirection(e.target.value)} className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500">
                        <option value="desc">Date (Newest First)</option>
                        <option value="asc">Date (Oldest First)</option>
                     </select>
                  </div>
               </div>

              <div className="flex-1 overflow-y-auto p-3 md:p-5">
                <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-px bg-zinc-200 hidden md:block"></div>
                <div className="space-y-6 relative">
                  {customerHistory.map((item, idx) => (
                    <div
                      key={item.id + idx}
                      className="relative flex flex-col md:flex-row md:items-start group"
                    >
                      <div className="hidden md:flex items-center justify-center w-16 h-8 absolute -left-0">
                        <div
                          className={`w-3 h-3 rounded-full border-2 border-white ring-4 ring-white ${item.isCharge ? "bg-rose-500" : "bg-primary-500"} z-10`}
                        ></div>
                      </div>
                      <div className="md:ml-16 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm w-full group-hover:border-zinc-200 dark:border-zinc-700 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center">
                            {item.isCharge ? (
                              <ArrowUpRight className="w-4 h-4 text-rose-500 mr-2 md:hidden" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-primary-500 mr-2 md:hidden" />
                            )}
                            <span className="font-semibold text-zinc-900 dark:text-white">
                              {item.type}
                            </span>
                          </div>
                          <span
                            className={`font-bold tracking-tight ${item.isCharge ? "text-rose-600" : "text-primary-600"}`}
                          >
                            {item.isCharge ? "+" : "-"} ₹{" "}
                            {item.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-3">
                          {item.description}
                        </p>
                        <div className="flex justify-between items-center pt-3 border-t border-zinc-50 dark:border-zinc-700/50 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>
                            {item.date === new Date(0).toISOString()
                              ? "Opening"
                              : format(
                                  parseISO(item.date),
                                  "dd MMM yyyy, hh:mm a",
                                )}
                          </span>
                          <span className="font-medium bg-zinc-50 dark:bg-zinc-900/50 px-2 py-1 rounded">
                            Run Bal: ₹ {item.runningBalance.toLocaleString()}{" "}
                            {item.runningBalance > 0 ? "Dr" : "Cr"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {customerHistory.length === 0 && (
                    <div className="text-center text-zinc-500 dark:text-zinc-400 py-12">
                      No history found for this customer.
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>

            <div className="px-4 py-3 md:px-6 md:py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-700 shrink-0 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors shadow-sm"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!customerToDelete}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmText="Delete"
        onConfirm={() => {
          if (customerToDelete) {
            deleteCustomer(customerToDelete);
          }
        }}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
}
