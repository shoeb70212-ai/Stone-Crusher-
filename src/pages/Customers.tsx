import React, { useState, useMemo } from "react";
import { useErp } from "../context/ErpContext";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Phone,
  User as UserIcon,
  FileText,
  ArrowDownRight,
  ArrowUpRight,
  Edit2,
  Trash2,
  Loader2,
  Printer,
  MessageCircle,
  Download,
} from "lucide-react";
import { Customer } from "../types";
import { format, parseISO } from "date-fns";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { customerSchema } from "../lib/validation";
import { useToast } from "../components/ui/Toast";
import { generateId, formatVehicleNo } from "../lib/utils";
import { createLedgerPdfBlob } from "../lib/export-utils";
import { printHtml, downloadPdfBlob, sharePdfBlob } from "../lib/print-utils";
import { openWhatsAppMessage } from "../lib/whatsapp-share";

export function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, slips, transactions, getCustomerBalance, invoices, hasPermission } = useErp();
  const { addToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDataId, setEditingDataId] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const canViewPending = hasPermission("viewPendingAmounts");
  const canViewLedger = hasPermission("viewCustomerLedger");
  const canManageCustomers = hasPermission("viewAllCustomers"); // For adding/editing

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedCustomerId(prev => prev === id ? null : id);
  };

  const filteredCustomers = useMemo(() => {
    let filtered = customers;
    if (searchTerm) {
      const term = searchTerm.toLowerCase().replace(/\s+/g, '');
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().replace(/\s+/g, '').includes(term) ||
          (c.phone && c.phone.replace(/\s+/g, '').includes(term)) ||
          (c.gstin && c.gstin.toLowerCase().replace(/\s+/g, '').includes(term))
      );
    }
    // Show active first, then inactive
    return filtered.sort((a, b) => {
      const aActive = a.isActive !== false ? 0 : 1;
      const bActive = b.isActive !== false ? 0 : 1;
      return aActive - bActive;
    });
  }, [customers, searchTerm]);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    gstin: "",
    openingBalance: "0",
  });

  const handleCreateOrUpdate = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validation = customerSchema.safeParse({
      name: formData.name,
      phone: formData.phone,
      address: formData.address,
      gstin: formData.gstin,
      openingBalance: parseFloat(formData.openingBalance) || 0,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message ?? "Invalid customer data";
      addToast("error", firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingDataId) {
        updateCustomer({
          id: editingDataId,
          name: validation.data.name,
          phone: validation.data.phone ?? "",
          address: validation.data.address,
          gstin: validation.data.gstin,
          openingBalance: validation.data.openingBalance,
        });
      } else {
        addCustomer({
          id: generateId(),
          name: validation.data.name,
          phone: validation.data.phone ?? "",
          address: validation.data.address,
          gstin: validation.data.gstin,
          openingBalance: validation.data.openingBalance,
        });
      }

      setIsModalOpen(false);
      setFormData({ name: "", phone: "", address: "", gstin: "", openingBalance: "0" });
      setEditingDataId(null);
    } finally {
      setIsSubmitting(false);
    }
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

    // Add Slips (Purchases/Charges) — include Loaded so material that left the
    // yard is reflected in the ledger before it is tallied or invoiced.
    slips
      .filter((s) => s.customerId === selectedCustomer.id && (s.status === "Tallied" || s.status === "Pending" || s.status === "Loaded"))
      .forEach((s) => {
        historyItems.push({
          id: s.id,
          date: s.date,
          type: "Dispatch",
          category: "Slip",
          description: `Trip ${formatVehicleNo(s.vehicleNo)} - ${s.materialType} • ${s.quantity.toFixed(2)} ${s.measurementType === 'Volume (Brass)' ? 'Brass' : 'Tons'} @ ₹${s.ratePerUnit}${s.invoiceId ? ' (Billed)' : ''}`,
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

    // Sort ascending so we can compute the true point-in-time running balance.
    historyItems.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Compute running balance in ascending order (oldest → newest).
    // Each row's runningBalance is the balance AFTER that transaction —
    // which is what the customer "stood at" after that event occurred.
    let runningBalance = 0;
    const computedHistory = historyItems.map((item) => {
      if (item.affectsBalance !== false) {
        runningBalance += item.isCharge ? item.amount : -item.amount;
      }
      return { ...item, runningBalance };
    });

    // Apply filters before reversing so date/type filters work correctly.
    let results = computedHistory.filter((item) => {
      // Opening balance entry always passes through.
      if (item.id === "opening" || item.category === "Opening") return true;

      if (ledgerTxType !== "All") {
        if (ledgerTxType === "Charge" && !item.isCharge) return false;
        if (ledgerTxType === "Payment" && item.isCharge) return false;
      }

      if (ledgerTxCategory !== "All") {
        if (item.category !== ledgerTxCategory) return false;
      }

      const itemDate = new Date(item.date);
      if (ledgerStartDate) {
        const start = new Date(ledgerStartDate + 'T00:00:00');
        if (itemDate < start) return false;
      }
      if (ledgerEndDate) {
        const end = new Date(ledgerEndDate + 'T23:59:59.999');
        if (itemDate > end) return false;
      }

      return true;
    });

    // Default display is newest-first; flip only for explicit asc request.
    if (ledgerSortDirection !== "asc") {
      results = results.reverse();
    }

    return results;
  }, [selectedCustomer, slips, transactions, invoices, ledgerStartDate, ledgerEndDate, ledgerTxType, ledgerTxCategory, ledgerSortDirection]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-foreground tracking-tight">
            Customers Directory
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage customer profiles and view their balances.
          </p>
        </div>

        {/* Search & Actions Row */}
        <div className="flex items-center gap-2 bg-surface p-2 sm:p-3 rounded-2xl shadow-sm border border-border">
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Search customers by name, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2 border-none bg-transparent rounded-lg focus:ring-0 outline-none text-foreground text-sm sm:text-base"
            />
          </div>
          {canManageCustomers && (
            <button
              onClick={openCreateModal}
              className="bg-primary-600 hover:bg-primary-700 text-white px-3 sm:px-4 py-2 rounded-lg font-medium flex items-center justify-center transition-colors shadow-sm shrink-0 text-sm"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2 mr-1" />
              <span className="hidden sm:inline">Add Customer</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-xl sm:rounded-2xl shadow-sm border border-border overflow-hidden divide-y divide-border">
        {filteredCustomers.length === 0 ? (
          <div className="py-8 sm:py-12 text-center text-muted-foreground text-sm">
             No customers found.
          </div>
        ) : (
          <div className="stagger-animation">
            {filteredCustomers.map((c) => {
              const bal = getCustomerBalance(c.id);
              const isExpanded = expandedCustomerId === c.id;

              return (
                <div key={c.id} className="flex flex-col transition-colors hover:bg-surface-2/50">
                  {/* Header (Always Visible) - Compact for mobile */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    aria-expanded={isExpanded}
                    className="w-full p-3 sm:p-4 cursor-pointer flex items-center justify-between text-left active:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-500/20 dark:to-primary-500/10 flex items-center justify-center text-primary-600 shrink-0">
                        <UserIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-sm truncate">{c.name}</div>
                        <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                          <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 shrink-0" />
                          <span className="break-all">{c.phone || 'No phone'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      {canViewPending && (
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Bal</div>
                          <span className={`font-bold tracking-tight text-xs sm:text-base ${
                              bal > 0 ? "text-danger" : bal < 0 ? "text-primary-600" : "text-foreground"
                          }`}>
                            ₹{Math.abs(bal).toLocaleString()} {bal > 0 ? "Dr" : bal < 0 ? "Cr" : ""}
                          </span>
                        </div>
                      )}
                      <span className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${c.isActive !== false ? "bg-success-muted text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                        {c.isActive !== false ? "Active" : "Inactive"}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded Details - Compact for mobile */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-2 border-t border-border bg-surface-2/40">
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4">
                         {canViewPending && (
                           <div>
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block">Opening</span>
                              <span className="text-xs sm:text-sm font-medium text-foreground">₹{c.openingBalance.toLocaleString()} {c.openingBalance > 0 ? "Dr" : c.openingBalance < 0 ? "Cr" : ""}</span>
                           </div>
                         )}
                         <div>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block">GSTIN</span>
                            <span className="block text-xs sm:text-sm font-medium text-foreground uppercase wrap-break-word">{c.gstin || 'N/A'}</span>
                         </div>
                         <div className="col-span-2 sm:col-span-2">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block">Address</span>
                            <span className="block text-xs sm:text-sm font-medium text-foreground wrap-break-word">{c.address || 'N/A'}</span>
                         </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-end">
                        {canViewLedger && (
                          <button onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); }} className="text-xs sm:text-sm bg-primary-50 hover:bg-primary-100 dark:bg-primary-500/10 dark:hover:bg-primary-500/20 text-primary-700 dark:text-primary-400 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium flex items-center active:scale-[0.98] transition-transform">
                            <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> <span className="hidden sm:inline">Statement</span>
                          </button>
                        )}
                        {canManageCustomers && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); openEditModal(c); }} className="text-xs sm:text-sm bg-surface hover:bg-surface-2 text-foreground px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium flex items-center border border-border active:scale-[0.98] transition-transform">
                              <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); removeCustomer(c.id); }} className={`text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium flex items-center border active:scale-[0.98] transition-transform ${c.isActive !== false ? "bg-danger-muted hover:bg-danger-muted/80 text-danger border-danger/20" : "bg-success-muted hover:bg-success-muted/80 text-success-foreground border-success/20"}`}>
                              {c.isActive !== false ? (<><Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /><span className="hidden sm:inline">Deactivate</span></>) : (<><Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /><span className="hidden sm:inline">Reactivate</span></>)}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center md:p-4 z-50 overflow-hidden">
          <div className="bg-surface md:rounded-2xl w-full h-full md:h-auto max-w-lg md:max-h-[90vh] overflow-y-auto shadow-xl flex flex-col border border-border">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-border flex justify-between items-center bg-surface-2/60 sticky top-0">
              <h3 className="text-lg font-bold text-foreground">
                {editingDataId ? "Edit Customer" : "Add New Customer"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="p-3 md:p-5 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Customer Name
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    type="text"
                    className="w-full border border-border rounded-lg px-4 py-2 bg-surface-2 text-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="e.g. Acme Constructions"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Phone / Contact
                  </label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    type="text"
                    className="w-full border border-border rounded-lg px-4 py-2 bg-surface-2 text-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="9876543210"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border border-border rounded-lg px-4 py-2 bg-surface-2 text-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Customer Address"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    GSTIN
                  </label>
                  <input
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    type="text"
                    className="w-full border border-border rounded-lg px-4 py-2 bg-surface-2 text-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none uppercase"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Opening Balance (₹)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    className="w-full border border-border rounded-lg px-4 py-2 bg-surface-2 text-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Positive if they owe money, negative if they paid an advance.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-muted-foreground font-medium hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "Saving…" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center md:p-4 z-50 overflow-hidden">
          <div className="bg-surface md:rounded-2xl w-full h-full md:h-auto max-w-4xl md:max-h-[90vh] overflow-hidden shadow-xl flex flex-col relative border border-border">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-border bg-surface flex flex-wrap justify-between items-center gap-3 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {selectedCustomer.name} - Statement
                </h3>
                <p className="text-sm text-muted-foreground">
                  Current Balance:{" "}
                  <strong className="text-foreground">
                    ₹{getCustomerBalance(selectedCustomer.id).toLocaleString()}
                  </strong>
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const html = `
                      <div style="padding:24px;font-family:Inter,sans-serif;">
                        <h2 style="margin:0 0 4px;">${selectedCustomer.name}</h2>
                        <p style="margin:0 0 12px;color:#666;">Phone: ${selectedCustomer.phone || 'N/A'}${selectedCustomer.address ? ` | ${selectedCustomer.address}` : ''}${selectedCustomer.gstin ? ` | GSTIN: ${selectedCustomer.gstin}` : ''}</p>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;">
                          <thead><tr style="background:#f4f4f5;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Particulars</th><th style="padding:8px;text-align:right;">Debit</th><th style="padding:8px;text-align:right;">Credit</th><th style="padding:8px;text-align:right;">Balance</th></tr></thead>
                          <tbody>
                            ${customerHistory.map(e => {
                              const dateStr = e.date === new Date(0).toISOString() ? "-" : new Date(e.date).toLocaleDateString();
                              const debit = e.isCharge ? e.amount : 0;
                              const credit = !e.isCharge ? e.amount : 0;
                              return `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${dateStr}</td><td style="padding:8px;border-bottom:1px solid #eee;">${e.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#e11d48;">${debit > 0 ? debit.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#059669;">${credit > 0 ? credit.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${Math.abs(e.runningBalance).toLocaleString()} ${e.runningBalance < 0 ? 'Cr' : e.runningBalance > 0 ? 'Dr' : ''}</td></tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                        <p style="margin-top:12px;text-align:right;font-weight:bold;">Closing Balance: ₹${Math.abs(getCustomerBalance(selectedCustomer.id)).toLocaleString()} ${getCustomerBalance(selectedCustomer.id) < 0 ? 'Cr' : getCustomerBalance(selectedCustomer.id) > 0 ? 'Dr' : ''}</p>
                      </div>
                    `;
                    printHtml(html);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-2 hover:bg-muted text-foreground text-xs sm:text-sm font-semibold rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  onClick={async () => {
                    setIsSharingWhatsApp(true);
                    try {
                      const html = `
                       <div style="padding:24px;font-family:Inter,sans-serif;">
                         <h2 style="margin:0 0 4px;">${selectedCustomer.name}</h2>
                         <p style="margin:0 0 12px;color:#666;">Phone: ${selectedCustomer.phone || 'N/A'}${selectedCustomer.address ? ` | ${selectedCustomer.address}` : ''}${selectedCustomer.gstin ? ` | GSTIN: ${selectedCustomer.gstin}` : ''}</p>
                         <table style="width:100%;border-collapse:collapse;font-size:13px;">
                           <thead><tr style="background:#f4f4f5;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Particulars</th><th style="padding:8px;text-align:right;">Debit</th><th style="padding:8px;text-align:right;">Credit</th><th style="padding:8px;text-align:right;">Balance</th></tr></thead>
                           <tbody>
                             ${customerHistory.map(e => {
                               const dateStr = e.date === new Date(0).toISOString() ? "-" : new Date(e.date).toLocaleDateString();
                               const debit = e.isCharge ? e.amount : 0;
                               const credit = !e.isCharge ? e.amount : 0;
                               return `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${dateStr}</td><td style="padding:8px;border-bottom:1px solid #eee;">${e.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#e11d48;">${debit > 0 ? debit.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#059669;">${credit > 0 ? credit.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${Math.abs(e.runningBalance).toLocaleString()} ${e.runningBalance < 0 ? 'Cr' : e.runningBalance > 0 ? 'Dr' : ''}</td></tr>`;
                             }).join('')}
                           </tbody>
                         </table>
                         <p style="margin-top:12px;text-align:right;font-weight:bold;">Closing Balance: \u20b9${Math.abs(getCustomerBalance(selectedCustomer.id)).toLocaleString()} ${getCustomerBalance(selectedCustomer.id) < 0 ? 'Cr' : getCustomerBalance(selectedCustomer.id) > 0 ? 'Dr' : ''}</p>
                       </div>
                     `;
                      const blob = await createLedgerPdfBlob(selectedCustomer.name, html);
                      const filename = `Ledger_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`;
                      const closingBal = getCustomerBalance(selectedCustomer.id);
                      const summaryText = `Ledger Statement: ${selectedCustomer.name}\nClosing Balance: \u20b9${Math.abs(closingBal).toLocaleString()} ${closingBal < 0 ? 'Cr' : 'Dr'}`;
                      const result = await sharePdfBlob(blob, filename, `Ledger - ${selectedCustomer.name}`, summaryText);

                      if (result === 'downloaded') {
                        openWhatsAppMessage(summaryText);
                        addToast('info', 'Ledger PDF downloaded. Attach it in WhatsApp.');
                      } else if (result === 'shared') {
                        addToast('success', 'Ledger PDF shared. Choose WhatsApp from the share sheet.');
                      }
                    } catch {
                      addToast('error', 'Failed to share ledger PDF.');
                    } finally {
                      setIsSharingWhatsApp(false);
                    }
                  }}
                  disabled={isSharingWhatsApp}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isSharingWhatsApp ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} <span className="hidden sm:inline">{isSharingWhatsApp ? 'Sharing...' : 'WhatsApp'}</span>
                </button>
                <button
                  onClick={async () => {
                     const html = `
                       <div style="padding:24px;font-family:Inter,sans-serif;">
                         <h2 style="margin:0 0 4px;">${selectedCustomer.name}</h2>
                         <p style="margin:0 0 12px;color:#666;">Phone: ${selectedCustomer.phone || 'N/A'}${selectedCustomer.address ? ` | ${selectedCustomer.address}` : ''}${selectedCustomer.gstin ? ` | GSTIN: ${selectedCustomer.gstin}` : ''}</p>
                         <table style="width:100%;border-collapse:collapse;font-size:13px;">
                           <thead><tr style="background:#f4f4f5;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Particulars</th><th style="padding:8px;text-align:right;">Debit</th><th style="padding:8px;text-align:right;">Credit</th><th style="padding:8px;text-align:right;">Balance</th></tr></thead>
                           <tbody>
                             ${customerHistory.map(e => {
                               const dateStr = e.date === new Date(0).toISOString() ? "-" : new Date(e.date).toLocaleDateString();
                               const debit = e.isCharge ? e.amount : 0;
                               const credit = !e.isCharge ? e.amount : 0;
                               return `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${dateStr}</td><td style="padding:8px;border-bottom:1px solid #eee;">${e.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#e11d48;">${debit > 0 ? debit.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:#059669;">${credit > 0 ? credit.toLocaleString() : '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${Math.abs(e.runningBalance).toLocaleString()} ${e.runningBalance < 0 ? 'Cr' : e.runningBalance > 0 ? 'Dr' : ''}</td></tr>`;
                             }).join('')}
                           </tbody>
                         </table>
                         <p style="margin-top:12px;text-align:right;font-weight:bold;">Closing Balance: \u20b9${Math.abs(getCustomerBalance(selectedCustomer.id)).toLocaleString()} ${getCustomerBalance(selectedCustomer.id) < 0 ? 'Cr' : getCustomerBalance(selectedCustomer.id) > 0 ? 'Dr' : ''}</p>
                       </div>
                     `;
                     setIsExportingPdf(true);
                     try {
                       const blob = await createLedgerPdfBlob(selectedCustomer.name, html);
                       const filename = `Ledger_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`;
                       downloadPdfBlob(blob, filename);
                       addToast('success', 'Ledger PDF downloaded.');
                     } catch {
                       addToast('error', 'PDF export failed.');
                     } finally {
                       setIsExportingPdf(false);
                     }
                  }}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-2 hover:bg-muted text-foreground text-xs sm:text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} <span className="hidden sm:inline">{isExportingPdf ? 'Generating...' : 'PDF'}</span>
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-muted-foreground hover:text-foreground p-1 ml-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-surface">
               <div className="p-3 md:p-4 border-b border-border bg-surface-2/50 flex flex-wrap gap-3 items-end shrink-0">
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">From</label>
                     <input type="date" value={ledgerStartDate} onChange={e => setLedgerStartDate(e.target.value)} className="w-full text-sm border border-border bg-surface text-foreground rounded-lg px-3 py-2 outline-none focus:border-primary-500" />
                  </div>
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">To</label>
                     <input type="date" value={ledgerEndDate} onChange={e => setLedgerEndDate(e.target.value)} className="w-full text-sm border border-border bg-surface text-foreground rounded-lg px-3 py-2 outline-none focus:border-primary-500" />
                  </div>
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Type</label>
                     <select value={ledgerTxType} onChange={e => setLedgerTxType(e.target.value)} className="w-full text-sm border border-border bg-surface text-foreground rounded-lg px-3 py-2 outline-none focus:border-primary-500">
                        <option value="All">All Impact</option>
                        <option value="Charge">Charges (Dr)</option>
                        <option value="Payment">Payments (Cr)</option>
                     </select>
                  </div>
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Category</label>
                     <select value={ledgerTxCategory} onChange={e => setLedgerTxCategory(e.target.value)} className="w-full text-sm border border-border bg-surface text-foreground rounded-lg px-3 py-2 outline-none focus:border-primary-500">
                        <option value="All">All Types</option>
                        <option value="Slip">Slips (Dispatch)</option>
                        <option value="Invoice">Invoices</option>
                        <option value="Transaction">Transactions</option>
                     </select>
                  </div>
                  <div className="flex-1 min-w-[130px]">
                     <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Sort By</label>
                     <select value={ledgerSortDirection} onChange={e => setLedgerSortDirection(e.target.value)} className="w-full text-sm border border-border bg-surface text-foreground rounded-lg px-3 py-2 outline-none focus:border-primary-500">
                        <option value="desc">Date (Newest First)</option>
                        <option value="asc">Date (Oldest First)</option>
                     </select>
                  </div>
               </div>

              <div className="flex-1 overflow-y-auto p-3 md:p-5">
                <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-px bg-border hidden md:block"></div>
                <div className="space-y-6 relative">
                  {customerHistory.map((item, idx) => (
                    <div
                      key={item.id + idx}
                      className="relative flex flex-col md:flex-row md:items-start group"
                    >
                      <div className="hidden md:flex items-center justify-center w-16 h-8 absolute -left-0">
                        <div
                          className={`w-3 h-3 rounded-full border-2 border-surface ring-4 ring-surface ${item.isCharge ? "bg-danger" : "bg-primary-500"} z-10`}
                        ></div>
                      </div>
                      <div className="md:ml-16 bg-surface p-4 rounded-xl border border-border shadow-sm w-full hover:border-border-strong transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center">
                            {item.isCharge ? (
                              <ArrowUpRight className="w-4 h-4 text-danger mr-2 md:hidden" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-primary-500 mr-2 md:hidden" />
                            )}
                            <span className="font-semibold text-foreground">
                              {item.type}
                            </span>
                          </div>
                          <span
                            className={`font-bold tracking-tight ${item.isCharge ? "text-danger" : "text-primary-600"}`}
                          >
                            {item.isCharge ? "+" : "-"} ₹{" "}
                            {item.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mb-3">
                          {item.description}
                        </p>
                        <div className="flex justify-between items-center pt-3 border-t border-border text-xs text-muted-foreground">
                          <span>
                            {item.date === new Date(0).toISOString()
                              ? "Opening"
                              : format(parseISO(item.date), "dd MMM yyyy, hh:mm a")}
                          </span>
                          <span className="font-medium bg-surface-2 px-2 py-1 rounded">
                            Run Bal: ₹ {item.runningBalance.toLocaleString()}{" "}
                            {item.runningBalance > 0 ? "Dr" : "Cr"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {customerHistory.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                      No history found for this customer.
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>

            <div className="px-4 py-3 md:px-6 md:py-4 bg-surface-2/60 border-t border-border shrink-0 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 bg-surface border border-border text-foreground font-medium hover:bg-surface-2 rounded-lg transition-colors shadow-sm"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!customerToDelete}
        title={customers.find(c => c.id === customerToDelete)?.isActive !== false ? "Deactivate Customer" : "Reactivate Customer"}
        message={customers.find(c => c.id === customerToDelete)?.isActive !== false
          ? "This customer will be hidden from dropdowns but all their financial history (slips, invoices, transactions) will be preserved."
          : "This customer will be made active again and appear in dropdowns."}
        confirmText={customers.find(c => c.id === customerToDelete)?.isActive !== false ? "Deactivate" : "Reactivate"}
        onConfirm={() => {
          if (customerToDelete) {
            const cust = customers.find(c => c.id === customerToDelete);
            if (cust) {
              if (cust.isActive !== false) {
                deleteCustomer(customerToDelete);
              } else {
                updateCustomer({ ...cust, isActive: true });
              }
            }
          }
        }}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
}
