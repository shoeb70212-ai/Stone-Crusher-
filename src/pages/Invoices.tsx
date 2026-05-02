import React, { useState } from "react";
import { useErp } from "../context/ErpContext";
import { Invoice } from "../types";
import { Plus, Download, FileText, Upload, Printer, Filter, ChevronDown } from "lucide-react";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { PrintInvoiceModal } from "../components/forms/PrintInvoiceModal";
import { MobileActionSheet, MobileChip, MobileFilterSheet } from "../components/ui/MobilePrimitives";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useInvoiceGenerator } from "./invoices/useInvoiceGenerator";
import { InvoiceCreateModal } from "./invoices/InvoiceCreateModal";

function InvoicesContent() {
  const { invoices, customers, transactions, updateInvoice, updateSlip, deleteTransaction, companySettings } = useErp();

  const [invoiceToCancel, setInvoiceToCancel] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [statusActionInvoice, setStatusActionInvoice] = useState<Invoice | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"All" | "GST" | "Cash">("All");
  const [filterCustomerId, setFilterCustomerId] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const generator = useInvoiceGenerator();

  const handleStatusChange = (invId: string, newStatus: string) => {
    if (newStatus === "Cancelled") {
      setInvoiceToCancel(invId);
    } else {
      updateInvoice(invId, { status: newStatus as Invoice["status"] });
    }
  };

  const filteredInvoices = invoices
    .filter((inv) => {
      const matchTab = activeTab === "All" || inv.type === activeTab;
      const matchCustomer = filterCustomerId === "All" || inv.customerId === filterCustomerId;
      const invDate = inv.date.slice(0, 10);
      const matchStart = !startDate || invDate >= startDate;
      const matchEnd = !endDate || invDate <= endDate;
      return matchTab && matchCustomer && matchStart && matchEnd;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hasInvoiceFilters = filterCustomerId !== "All" || !!startDate || !!endDate;
  const clearInvoiceFilters = () => {
    setFilterCustomerId("All");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-4">
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
          <label className="hidden md:flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm font-medium cursor-pointer text-sm active:scale-95">
            <Upload className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">Import JSON</span>
            <input type="file" accept=".json" className="hidden" onChange={generator.importData} />
          </label>
          <button
            onClick={() => void generator.exportData(filteredInvoices)}
            disabled={generator.isExporting}
            className="hidden md:flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm font-medium text-sm active:scale-95 disabled:opacity-60"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">{generator.isExporting ? "Exporting..." : "Export CSV"}</span>
          </button>
          <button
            onClick={generator.openCreateModal}
            className="flex items-center gap-2 px-3 py-2 md:px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm font-medium text-sm active:scale-95"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">New Invoice</span>
          </button>
        </div>
      </div>

      <div className="md:hidden grid grid-cols-2 gap-2">
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <Upload className="h-4 w-4" />
          Import JSON
          <input type="file" accept=".json" className="hidden" onChange={generator.importData} />
        </label>
        <button
          type="button"
          onClick={() => void generator.exportData(filteredInvoices)}
          disabled={generator.isExporting}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-sm active:scale-[0.98] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <Download className="h-4 w-4" />
          {generator.isExporting ? "Exporting..." : "Export CSV"}
        </button>
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

        {/* Mobile filter bar */}
        <div className="md:hidden border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2">
          <div className="flex items-center gap-2">
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
            {hasInvoiceFilters && (
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
            <div className="space-y-1">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-2.5 bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white text-xs">
                        {inv.invoiceNo}
                        <span className="ml-1.5 text-xs text-zinc-500 font-normal px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700/50">
                          {inv.type}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">{new Date(inv.date).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-white text-xs">₹{inv.total.toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => setStatusActionInvoice(inv)}
                        aria-label={`Change status for invoice ${inv.invoiceNo}`}
                        className={`px-2 py-1.5 rounded text-xs font-semibold min-h-8 ${
                          inv.status === "Paid"
                            ? "bg-primary-100 text-primary-700"
                            : inv.status === "Cancelled"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {inv.status}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-zinc-500 truncate max-w-30">
                      {customers.find((c) => c.id === inv.customerId)?.name || "Cash"}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => generator.openEditModal(inv)}
                        className="text-indigo-600 dark:text-indigo-400 font-medium text-xs px-3 py-1.5 min-h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setPrintInvoice(inv)}
                        className="text-zinc-600 dark:text-zinc-300 font-medium text-xs px-3 py-1.5 min-h-8 bg-zinc-100 dark:bg-zinc-700/50 rounded flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" />
                        Print
                      </button>
                    </div>
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
                  <td className="py-4 px-6 text-right space-x-3">
                    <button
                      onClick={() => generator.openEditModal(inv)}
                      className="text-indigo-500 hover:text-indigo-700 transition-colors text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPrintInvoice(inv)}
                      className="text-zinc-500 hover:text-primary-600 transition-colors text-sm font-medium"
                    >
                      <Printer className="w-5 h-5 inline mr-1" />
                      <span className="hidden sm:inline">Print / Download</span>
                    </button>
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

            // Unlink slips — use null (not undefined) so JSON.stringify
            // includes the key and the server clears the field.
            inv?.slipIds?.forEach((id: string) => updateSlip(id, { invoiceId: null as unknown as undefined }));

            // Reverse any auto-generated Income transactions that were
            // created when a slip was dispatched with a cash payment and
            // are now orphaned by this cancellation.
            if (inv?.slipIds) {
              inv.slipIds.forEach((slipId) => {
                const linked = transactions.filter(
                  (t) => (t as any).slipId === slipId && t.type === "Income",
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

      {printInvoice && (
        <PrintInvoiceModal
          invoice={printInvoice}
          customer={customers.find((c) => c.id === printInvoice.customerId)}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </div>
  );
}

export function Invoices() { return <ErrorBoundary><InvoicesContent /></ErrorBoundary>; }
