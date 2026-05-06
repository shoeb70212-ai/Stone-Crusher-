import React, { useState, useEffect, useMemo } from "react";
import { useErp } from "../context/ErpContext";
import { Quotation } from "../types";
import { Plus, FileText, Filter, ChevronDown, Search, X, Download, Printer, MessageCircle, ArrowRightCircle } from "lucide-react";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { MobileActionSheet, MobileChip, MobileFilterSheet } from "../components/ui/MobilePrimitives";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useQuotationGenerator } from "./quotations/useQuotationGenerator";
import { QuotationCreateModal } from "./quotations/QuotationCreateModal";
import { CREATE_EVENT } from "../components/Layout";
import { useToast } from "../components/ui/Toast";
import { useDebounce } from "../lib/use-debounce";

const statusColors: Record<string, string> = {
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300",
  Sent: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  Accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  Expired: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
};

function QuotationsContent() {
  const { quotations, customers, updateQuotation, companySettings } = useErp();
  const { addToast } = useToast();
  const generator = useQuotationGenerator();

  const [statusActionQuotation, setStatusActionQuotation] = useState<Quotation | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"All" | "GST" | "Cash">("All");
  const [filterCustomerId, setFilterCustomerId] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [convertConfirm, setConvertConfirm] = useState<Quotation | null>(null);

  useEffect(() => {
    const handler = () => generator.openCreateModal();
    window.addEventListener(CREATE_EVENT, handler);
    return () => window.removeEventListener(CREATE_EVENT, handler);
  }, [generator]);

  const filtered = useMemo(() => quotations
    .filter((q) => {
      const matchTab = activeTab === "All" || q.type === activeTab;
      const matchCustomer = filterCustomerId === "All" || q.customerId === filterCustomerId;
      const qDate = q.date.slice(0, 10);
      const matchStart = !startDate || qDate >= startDate;
      const matchEnd = !endDate || qDate <= endDate;
      const search = debouncedSearch.trim().toLowerCase();
      if (search) {
        const custName = q.customerName || customers.find((c) => c.id === q.customerId)?.name || "Cash Customer";
        const haystack = [q.quotationNo, custName, q.type, q.status].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return matchTab && matchCustomer && matchStart && matchEnd;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [quotations, activeTab, filterCustomerId, startDate, endDate, debouncedSearch, customers]);

  const hasFilters = filterCustomerId !== "All" || !!startDate || !!endDate;
  const clearFilters = () => { setFilterCustomerId("All"); setStartDate(""); setEndDate(""); };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">Quotations</h2>
          <p className="hidden md:block text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Create and manage estimates for customers.</p>
        </div>
        <button onClick={generator.openCreateModal} className="hidden md:flex items-center gap-2 px-3 py-2 md:px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm font-medium text-sm active:scale-95">
          <Plus className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">New Quotation</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
        {/* Desktop tabs */}
        <div className="hidden md:flex border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 overflow-x-auto no-scrollbar gap-2 text-sm font-medium whitespace-nowrap">
          {(["All", "GST", "Cash"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-lg transition-colors shrink-0 ${activeTab === tab ? "bg-white dark:bg-zinc-800 text-primary-700 dark:text-primary-400 shadow-sm border border-zinc-200 dark:border-zinc-700" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}>
              {tab} Quotations
            </button>
          ))}
        </div>

        {/* Mobile search + filter bar */}
        <div className="md:hidden border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2">
          <div className="flex items-center gap-2">
            {!searchExpanded ? (
              <button onClick={() => setSearchExpanded(true)} className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300" aria-label="Search"><Search className="h-4 w-4" /></button>
            ) : (
              <div className="animate-fade-in flex-1 relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input type="text" autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search quotations..." className="w-full h-10 pl-9 pr-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors" />
                <button onClick={() => { setSearchQuery(""); setSearchExpanded(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
              </div>
            )}
            {!searchExpanded && (
              <button onClick={() => setIsFilterOpen(true)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${hasFilters ? "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/15 dark:text-primary-300" : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"}`}>
                <Filter className="h-4 w-4" />Filter
              </button>
            )}
            {!searchExpanded && (
              <div className="flex-1 flex overflow-x-auto no-scrollbar gap-2 items-center pl-1">
                {(["All", "GST", "Cash"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${activeTab === tab ? "bg-zinc-100 dark:bg-zinc-800 text-primary-700 dark:text-primary-400 border border-zinc-200 dark:border-zinc-700 shadow-sm" : "text-zinc-500 dark:text-zinc-400"}`}>{tab}</button>
                ))}
              </div>
            )}
          </div>
          {hasFilters && !searchExpanded && (
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar mt-2">
              {filterCustomerId !== "All" && <MobileChip onRemove={() => setFilterCustomerId("All")}>{customers.find((c) => c.id === filterCustomerId)?.name || "Customer"}</MobileChip>}
              {(startDate || endDate) && <MobileChip onRemove={() => { setStartDate(""); setEndDate(""); }}>Date</MobileChip>}
            </div>
          )}
        </div>

        {/* Desktop filters */}
        <div className="hidden md:flex border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 bg-white dark:bg-zinc-800 flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center text-sm">
          <div className="flex items-center gap-2 w-full sm:flex-1 sm:min-w-50">
            <span className="text-zinc-500 font-medium shrink-0">Customer:</span>
            <select value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500">
              <option value="All">All Customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 w-full sm:flex-1 sm:min-w-70">
            <span className="text-zinc-500 font-medium shrink-0">Date:</span>
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500" />
              <span className="text-zinc-400 shrink-0">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          {hasFilters && <button onClick={clearFilters} className="shrink-0 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">Reset Filters</button>}
        </div>

        {/* Mobile list */}
        <div className={`md:hidden divide-y divide-zinc-100 dark:divide-zinc-700/50 ${companySettings.mobileLayout === "Compact" ? "mobile-compact-list" : ""}`}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <FileText className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{hasFilters ? "No quotations match these filters" : "No quotations found"}</p>
              <button type="button" onClick={hasFilters ? clearFilters : generator.openCreateModal} className="mt-4 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white active:scale-[0.98]">{hasFilters ? "Reset Filters" : "New Quotation"}</button>
            </div>
          ) : (
            <div className="space-y-1 pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-0 stagger-animation">
              {filtered.map((q) => (
                <div key={q.id} className="p-2.5 bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700 rounded-xl shadow-sm active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-bold text-zinc-900 dark:text-white text-xs">
                        {q.quotationNo}
                        <span className="ml-1.5 text-[10px] text-zinc-500 font-normal px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700/50">{q.type}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">{new Date(q.date).toLocaleDateString()}</div>
                      <div className="text-[11px] text-zinc-500 truncate max-w-[140px]">{q.customerName || customers.find((c) => c.id === q.customerId)?.name || "Cash Customer"}</div>
                      {q.validUntil && <div className="text-[10px] text-zinc-400 mt-0.5">Valid until: {new Date(q.validUntil).toLocaleDateString()}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-zinc-900 dark:text-white text-sm">₹{q.total.toLocaleString()}</span>
                      <button type="button" onClick={() => setStatusActionQuotation(q)} className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${statusColors[q.status] || statusColors.Draft}`}>{q.status}</button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button onClick={() => generator.openEditModal(q)} className="flex-1 py-2 text-[11px] font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 active:scale-[0.98] transition-all">Edit</button>
                    {q.status !== "Accepted" && !q.convertedInvoiceId && (
                      <button onClick={() => setConvertConfirm(q)} className="p-2.5 text-primary-600 hover:text-primary-700 rounded-lg hover:bg-primary-50 active:scale-95 transition-all" title="Convert to Invoice"><ArrowRightCircle className="w-4 h-4" /></button>
                    )}
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
                <th className="font-semibold text-sm py-4 px-6">Quotation #</th>
                <th className="font-semibold text-sm py-4 px-6">Date</th>
                <th className="font-semibold text-sm py-4 px-6">Customer</th>
                <th className="font-semibold text-sm py-4 px-6">Valid Until</th>
                <th className="font-semibold text-sm py-4 px-6 text-right">Amount</th>
                <th className="font-semibold text-sm py-4 px-6 text-center">Status</th>
                <th className="font-semibold text-sm py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filtered.map((q) => (
                <tr key={q.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900/50 transition-colors">
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-white">
                    {q.quotationNo}
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400 font-normal px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">{q.type}</span>
                  </td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">{new Date(q.date).toLocaleDateString()}</td>
                  <td className="py-4 px-6">{q.customerName || customers.find((c) => c.id === q.customerId)?.name || "Cash Customer"}</td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}</td>
                  <td className="py-4 px-6 font-semibold text-zinc-900 dark:text-white text-right">₹{q.total.toLocaleString()}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="relative inline-flex items-center">
                      <select value={q.status} onChange={(e) => updateQuotation(q.id, { status: e.target.value as Quotation["status"] })} className={`inline-flex appearance-none rounded-full border-r-4 border-transparent py-1 pl-2.5 pr-7 text-xs font-semibold outline-none cursor-pointer focus:ring-2 focus:ring-primary-500 ${statusColors[q.status] || statusColors.Draft}`}>
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Expired">Expired</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-current opacity-70" />
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button onClick={() => generator.openEditModal(q)} className="inline-flex min-h-9 items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors dark:text-indigo-400 dark:hover:bg-indigo-900/30">Edit</button>
                      {q.status !== "Accepted" && !q.convertedInvoiceId && (
                        <button onClick={() => setConvertConfirm(q)} className="inline-flex min-h-9 items-center gap-1.5 justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors">
                          <ArrowRightCircle className="h-3.5 w-3.5" />Convert
                        </button>
                      )}
                      {q.convertedInvoiceId && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Invoiced ✓</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-zinc-500 dark:text-zinc-400"><FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />No quotations found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <QuotationCreateModal
        isOpen={generator.showModal}
        onClose={() => generator.setShowModal(false)}
        editingId={generator.editingId}
        newQuotation={generator.newQuotation}
        setNewQuotation={generator.setNewQuotation}
        newItem={generator.newItem}
        setNewItem={generator.setNewItem}
        materials={generator.materials}
        customers={customers}
        isSubmitting={generator.isSubmitting}
        onSave={generator.handleSave}
        onAddItem={generator.handleAddItem}
        generateQuotationNo={generator.generateQuotationNo}
      />

      <MobileFilterSheet isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="Filter Quotations" onClear={clearFilters} clearDisabled={!hasFilters}>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">Customer</label>
            <select value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)} className="w-full min-h-11 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500">
              <option value="All">All Customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full min-h-11 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5">To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full min-h-11 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        </div>
      </MobileFilterSheet>

      <MobileActionSheet
        isOpen={!!statusActionQuotation}
        onClose={() => setStatusActionQuotation(null)}
        title="Quotation Status"
        actions={["Draft", "Sent", "Accepted", "Expired", "Rejected"].map((status) => ({
          label: status,
          description: status === "Accepted" ? "Customer approved the estimate" : status === "Sent" ? "Quotation sent to customer" : status === "Expired" ? "Past validity date" : status === "Rejected" ? "Customer declined" : "Not yet sent",
          selected: statusActionQuotation?.status === status,
          tone: status === "Rejected" ? "danger" : status === "Accepted" ? "primary" : "default",
          onClick: () => { if (statusActionQuotation) updateQuotation(statusActionQuotation.id, { status: status as Quotation["status"] }); },
        }))}
      />

      <ConfirmationModal
        isOpen={!!convertConfirm}
        title="Convert to Invoice"
        message={`Create a new invoice from quotation ${convertConfirm?.quotationNo}? The quotation will be marked as Accepted.`}
        confirmText="Convert"
        onConfirm={() => { if (convertConfirm) { generator.handleConvertToInvoice(convertConfirm); setConvertConfirm(null); } }}
        onCancel={() => setConvertConfirm(null)}
      />
    </div>
  );
}

export function Quotations() { return <ErrorBoundary><QuotationsContent /></ErrorBoundary>; }
