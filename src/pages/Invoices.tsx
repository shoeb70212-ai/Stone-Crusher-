import React, { useState, useEffect, useMemo } from "react";
import { useErp } from "../context/ErpContext";
import { Invoice } from "../types";
import { Plus, Download, FileText, Printer, Filter, ChevronDown, MessageCircle, Search, X } from "lucide-react";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { MobileActionSheet, MobileChip, MobileFilterSheet } from "../components/ui/MobilePrimitives";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { DocumentActionButton, type DocumentAction } from "../components/ui/DocumentActionButton";
import { useInvoiceGenerator } from "./invoices/useInvoiceGenerator";
import { InvoiceCreateModal } from "./invoices/InvoiceCreateModal";
import { CREATE_EVENT } from "../components/Layout";
import { createInvoicePdfBlob, downloadInvoicePdf, printPdfBlob, sharePdfBlob } from "../lib/print-utils";
import { buildInvoiceWhatsAppMessage, openWhatsAppMessage } from "../lib/whatsapp-share";
import { useToast } from "../components/ui/Toast";
import { useDebounce } from "../lib/use-debounce";

type InvoiceDocumentAction = DocumentAction;

function InvoicesContent() {
  const { invoices, customers, transactions, updateInvoice, updateSlip, deleteTransaction, companySettings } = useErp();
  const { addToast } = useToast();

  const [invoiceToCancel, setInvoiceToCancel] = useState<string | null>(null);
  const [statusActionInvoice, setStatusActionInvoice] = useState<Invoice | null>(null);
  const [activeInvoiceAction, setActiveInvoiceAction] = useState<{ id: string; action: InvoiceDocumentAction } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"All" | "GST" | "Cash">("All");
  const [filterCustomerId, setFilterCustomerId] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Mobile search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const generator = useInvoiceGenerator();
  // Bottom-nav FAB fires this event to open the create modal
  useEffect(() => {
    const handler = () => generator.openCreateModal();
    window.addEventListener(CREATE_EVENT, handler);
    return () => window.removeEventListener(CREATE_EVENT, handler);
  }, [generator]);

  const handleStatusChange = (invId: string, newStatus: string) => {
    if (newStatus === "Cancelled") {
      setInvoiceToCancel(invId);
    } else {
      updateInvoice(invId, { status: newStatus as Invoice["status"] });
    }
  };

  const filteredInvoices = useMemo(() => invoices
    .filter((inv) => {
      const matchTab = activeTab === "All" || inv.type === activeTab;
      const matchCustomer = filterCustomerId === "All" || inv.customerId === filterCustomerId;
      const invDate = inv.date.slice(0, 10);
      const matchStart = !startDate || invDate >= startDate;
      const matchEnd = !endDate || invDate <= endDate;

      const q = debouncedSearch.trim().toLowerCase();
      if (q) {
        const cust = customers.find((c) => c.id === inv.customerId);
        const haystack = [
          inv.invoiceNo,
          cust?.name,
          inv.type,
          inv.status,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return matchTab && matchCustomer && matchStart && matchEnd;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [invoices, activeTab, filterCustomerId, startDate, endDate, debouncedSearch, customers]);

  const hasInvoiceFilters = filterCustomerId !== "All" || !!startDate || !!endDate;
  const clearInvoiceFilters = () => {
    setFilterCustomerId("All");
    setStartDate("");
    setEndDate("");
  };

  const handleInvoiceDocumentAction = async (invoice: Invoice, action: InvoiceDocumentAction) => {
    const customer = customers.find((c) => c.id === invoice.customerId);
    const filename = `Invoice-${invoice.invoiceNo}.pdf`;
    setActiveInvoiceAction({ id: invoice.id, action });

    try {
      if (action === "download") {
        await downloadInvoicePdf(invoice, customer, companySettings, filename);
        addToast("success", "Invoice PDF downloaded successfully.");
        return;
      }

      const blob = await createInvoicePdfBlob(invoice, customer, companySettings);

      if (action === "whatsapp") {
        const message = buildInvoiceWhatsAppMessage({ invoice, customer, companySettings });
        const result = await sharePdfBlob(blob, filename, `Invoice ${invoice.invoiceNo}`, message);

        if (result === "downloaded") {
          openWhatsAppMessage(message);
          addToast("info", "Invoice PDF downloaded. Attach it in WhatsApp.");
        } else if (result === "shared") {
          addToast("success", "Invoice PDF is ready to send. Choose WhatsApp from the share sheet.");
        }
        return;
      }

      await printPdfBlob(blob, `Invoice ${invoice.invoiceNo}`);
      addToast("success", "Invoice sent to print.");
    } catch (error) {
      console.error("Invoice document action failed:", error);
      addToast("error", "Could not prepare the invoice PDF. Please try again.");
    } finally {
      setActiveInvoiceAction(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Invoicing
          </h2>
          <p className="hidden md:block text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Generate and manage invoices.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={generator.openCreateModal}
            className="hidden md:flex items-center gap-2 px-3 py-2 md:px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm font-medium text-sm active:scale-95"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">New Invoice</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
        {/* Type tabs */}
        <div className="border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 flex flex-wrap gap-2 text-sm font-medium">
          {(["All", "GST", "Cash"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-white dark:bg-zinc-800 text-primary-700 shadow-sm border border-zinc-200 dark:border-zinc-700"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {tab} Invoices
            </button>
          ))}
        </div>

        {/* Mobile search + filter bar */}
        <div className="md:hidden border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2">
          <div className="flex items-center gap-2">
            {!searchExpanded ? (
              <button
                onClick={() => setSearchExpanded(true)}
                className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            ) : (
              <div className="animate-fade-in flex-1 relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search invoices..."
                  className="w-full h-10 pl-9 pr-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
                />
                <button onClick={() => { setSearchQuery(""); setSearchExpanded(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {!searchExpanded && (
              <button
                onClick={() => setIsFilterOpen(true)}
                className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${
                  hasInvoiceFilters
                    ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/15 dark:text-primary-300"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                }`}
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>
            )}
            {hasInvoiceFilters && !searchExpanded && (
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar">
                {filterCustomerId !== "All" && (
                  <MobileChip onRemove={() => setFilterCustomerId("All")}>
                    {filterCustomerId === "CASH" ? "Cash" : customers.find((c) => c.id === filterCustomerId)?.name || "Customer"}
                  </MobileChip>
                )}
                {(startDate || endDate) && (
                  <MobileChip onRemove={() => { setStartDate(""); setEndDate(""); }}>
                    Date
                  </MobileChip>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Desktop filter bar */}
        <div className="hidden md:flex border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 bg-white dark:bg-zinc-800 flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center text-sm">
          <div className="flex items-center gap-2 w-full sm:flex-1 sm:min-w-50">
            <span className="text-zinc-500 font-medium shrink-0">Customer:</span>
            <select
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="All">All Customers</option>
              <option value="CASH">Cash Customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 w-full sm:flex-1 sm:min-w-70">
            <span className="text-zinc-500 font-medium shrink-0">Date:</span>
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-zinc-400 shrink-0">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          {hasInvoiceFilters && (
            <button
              onClick={clearInvoiceFilters}
              className="shrink-0 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Mobile list */}
        <div className={`md:hidden divide-y divide-zinc-100 dark:divide-zinc-700/50 ${companySettings.mobileLayout === "Compact" ? "mobile-compact-list" : ""}`}>
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <FileText className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                {hasInvoiceFilters ? "No invoices match these filters" : "No invoices found"}
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                {hasInvoiceFilters ? "Reset filters to review the full invoice list." : "Generate an invoice when a customer is ready for billing."}
              </p>
              <button
                type="button"
                onClick={hasInvoiceFilters ? clearInvoiceFilters : generator.openCreateModal}
                className="mt-4 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white active:scale-[0.98]"
              >
                {hasInvoiceFilters ? "Reset Filters" : "New Invoice"}
              </button>
            </div>
          ) : (
              <div className="space-y-1 pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-0 stagger-animation">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-2.5 bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700 rounded-xl shadow-sm active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-bold text-zinc-900 dark:text-white text-xs">
                        {inv.invoiceNo}
                        <span className="ml-1.5 text-[10px] text-zinc-500 font-normal px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700/50">
                          {inv.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">{new Date(inv.date).toLocaleDateString()}</div>
                      <div className="text-[11px] text-zinc-500 truncate max-w-[140px]">
                        {customers.find((c) => c.id === inv.customerId)?.name || "Cash"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-zinc-900 dark:text-white text-sm">₹{inv.total.toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => setStatusActionInvoice(inv)}
                        aria-label={`Change status for invoice ${inv.invoiceNo}`}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          inv.status === "Paid"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : inv.status === "Cancelled"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        }`}
                      >
                        {inv.status}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => generator.openEditModal(inv)}
                      className="flex-1 py-2 text-[11px] font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 active:scale-[0.98] transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleInvoiceDocumentAction(inv, "download")}
                      className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handleInvoiceDocumentAction(inv, "print")}
                      className="p-2 text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-primary-50 active:scale-95 transition-all"
                      title="Print"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handleInvoiceDocumentAction(inv, "whatsapp")}
                      className="p-2 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 active:scale-95 transition-all"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500">
                <th className="font-semibold text-sm py-4 px-6">Invoice #</th>
                <th className="font-semibold text-sm py-4 px-6">Date</th>
                <th className="font-semibold text-sm py-4 px-6">Customer</th>
                <th className="font-semibold text-sm py-4 px-6 text-right">Amount</th>
                <th className="font-semibold text-sm py-4 px-6 text-center">Status</th>
                <th className="font-semibold text-sm py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900/50 transition-colors">
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-white">
                    {inv.invoiceNo}
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400 font-normal px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      {inv.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">
                    {new Date(inv.date).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6">
                    {customers.find((c) => c.id === inv.customerId)?.name || "Cash Customer"}
                  </td>
                  <td className="py-4 px-6 font-semibold text-zinc-900 dark:text-white text-right">
                    ₹{inv.total.toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="relative inline-flex items-center">
                      <select
                        value={inv.status}
                        onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                        aria-label={`Change status for invoice ${inv.invoiceNo}`}
                        className={`inline-flex appearance-none rounded-full border-r-4 border-transparent py-1 pl-2.5 pr-7 text-xs font-semibold outline-none cursor-pointer focus:ring-2 focus:ring-primary-500 ${
                          inv.status === "Paid"
                            ? "bg-primary-100 text-primary-700"
                            : inv.status === "Cancelled"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-current opacity-70" />
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => generator.openEditModal(inv)}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                      >
                        Edit
                      </button>
                      <DocumentActionButton entityId={inv.id} entityLabel={`invoice ${inv.invoiceNo}`} action="download" label="Download" icon={<Download className="h-3.5 w-3.5" />} className="bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700" activeAction={activeInvoiceAction} onClick={(a) => void handleInvoiceDocumentAction(inv, a)} />
                      <DocumentActionButton entityId={inv.id} entityLabel={`invoice ${inv.invoiceNo}`} action="whatsapp" label="WhatsApp" icon={<MessageCircle className="h-3.5 w-3.5" />} className="bg-emerald-600 text-white hover:bg-emerald-700" activeAction={activeInvoiceAction} onClick={(a) => void handleInvoiceDocumentAction(inv, a)} />
                      <DocumentActionButton entityId={inv.id} entityLabel={`invoice ${inv.invoiceNo}`} action="print" label="Print" icon={<Printer className="h-3.5 w-3.5" />} className="bg-primary-600 text-white hover:bg-primary-700" activeAction={activeInvoiceAction} onClick={(a) => void handleInvoiceDocumentAction(inv, a)} />
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    No invoices found. Generate one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <InvoiceCreateModal
        isOpen={generator.showGenerateModal}
        onClose={() => generator.setShowGenerateModal(false)}
        editingInvoiceId={generator.editingInvoiceId}
        newInvoice={generator.newInvoice}
        setNewInvoice={generator.setNewInvoice}
        newItem={generator.newItem}
        setNewItem={generator.setNewItem}
        selectedSlipIds={generator.selectedSlipIds}
        setSelectedSlipIds={generator.setSelectedSlipIds}
        unbilledSlips={generator.unbilledSlips}
        materials={generator.materials}
        customers={customers}
        isSubmitting={generator.isSubmitting}
        onGenerate={generator.handleGenerate}
        onAddItem={generator.handleAddItem}
        generateInvoiceNoForType={generator.generateInvoiceNoForType}
      />

      <MobileFilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Invoices"
        onClear={clearInvoiceFilters}
        clearDisabled={!hasInvoiceFilters}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">
              Customer
            </label>
            <select
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              className="w-full min-h-11 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="All">All Customers</option>
              <option value="CASH">Cash Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-h-11 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-11 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      </MobileFilterSheet>

      <MobileActionSheet
        isOpen={!!statusActionInvoice}
        onClose={() => setStatusActionInvoice(null)}
        title="Invoice Status"
        actions={["Pending", "Paid", "Cancelled"].map((status) => ({
          label: status,
          description:
            status === "Cancelled" ? "Cancel and release linked slips"
            : status === "Paid" ? "Mark payment as complete"
            : "Keep invoice pending",
          selected: statusActionInvoice?.status === status,
          tone: status === "Cancelled" ? "danger" : status === "Paid" ? "primary" : "default",
          onClick: () => {
            if (statusActionInvoice) handleStatusChange(statusActionInvoice.id, status);
          },
        }))}
      />

      <ConfirmationModal
        isOpen={!!invoiceToCancel}
        title="Cancel Invoice"
        message="Are you sure you want to cancel this invoice? This action cannot be undone."
        confirmText="Cancel Invoice"
        onConfirm={() => {
          if (invoiceToCancel) {
            const inv = invoices.find((i: Invoice) => i.id === invoiceToCancel);

            // Unlink slips — pass undefined so the server normalizes to NULL.
            inv?.slipIds?.forEach((id: string) => updateSlip(id, { invoiceId: undefined }));

            // Reverse any auto-generated Income transactions that were
            // created when a slip was dispatched with a cash payment and
            // are now orphaned by this cancellation.
            if (inv?.slipIds) {
              inv.slipIds.forEach((slipId) => {
                const linked = transactions.filter(
                  (t) => t.slipId === slipId && t.type === "Income" && t.category === "Slip Payment",
                );
                linked.forEach((t) => deleteTransaction(t.id));
              });
            }

            updateInvoice(invoiceToCancel, { status: "Cancelled" });
            setInvoiceToCancel(null);
          }
        }}
        onCancel={() => setInvoiceToCancel(null)}
      />

    </div>
  );
}

export function Invoices() { return <ErrorBoundary><InvoicesContent /></ErrorBoundary>; }
