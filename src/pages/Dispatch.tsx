import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useErp } from "../context/ErpContext";
import { CREATE_EVENT } from "../components/Layout";
import { Slip } from "../types";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Truck,
  Printer,
  Download,
  Edit2,
  Ban,
  Filter,
  X,
  MessageCircle,
  Search,
} from "lucide-react";
import { CreateSlipForm } from "../components/forms/CreateSlipForm";
import { EditSlipForm } from "../components/forms/EditSlipForm";
import { MobileModal } from "../components/ui/MobileModal";
import { MobileChip, MobileFilterSheet } from "../components/ui/MobilePrimitives";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { DocumentActionButton, type DocumentAction } from "../components/ui/DocumentActionButton";
import { cn } from "../lib/utils";
import { useHapticFeedback } from "../lib/use-haptic-feedback";
import { getStatusColor } from "../lib/status-styles";
import { useDebounce } from "../lib/use-debounce";
import { createSlipPdfBlob, downloadPdfBlob, printPdfBlob, sharePdfBlob } from "../lib/print-utils";
import { buildSlipWhatsAppMessage, openWhatsAppMessage } from "../lib/whatsapp-share";
import { isNative } from "../lib/capacitor";
import { useToast } from "../components/ui/Toast";

type SlipDocumentAction = DocumentAction;

export function Dispatch() {
  const { slips, customers, vehicles, updateSlipStatus, companySettings } =
    useErp();
  const { tap, success } = useHapticFeedback();
  const { addToast } = useToast();
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState<Slip | null>(null);
  const [slipToCancel, setSlipToCancel] = useState<string | null>(null);
  const [activeSlipAction, setActiveSlipAction] = useState<{ id: string; action: SlipDocumentAction } | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<"today" | "week" | "month" | null>(null);

  // Mobile search bar
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("All");
  const [filterDeliveryMode, setFilterDeliveryMode] = useState("All");
  const [filterCustomer, setFilterCustomer] = useState("All");
  const [filterVehicle, setFilterVehicle] = useState("");
  // Debounce the text search so the filtered list only recomputes after typing pauses
  const debouncedFilterVehicle = useDebounce(filterVehicle, 300);

  const filteredSlips = useMemo(() => slips
    .filter((s) => {
      if (activeTab === "pending" && s.status !== "Pending") return false;

      // Vehicle search uses the debounced value to avoid filtering on every keystroke.
      if (debouncedFilterVehicle.trim() && !s.vehicleNo.toLowerCase().includes(debouncedFilterVehicle.trim().toLowerCase())) {
        return false;
      }

      // Global search query (mobile persistent search bar)
      const q = debouncedSearch.trim().toLowerCase();
      if (q) {
        const cust = customers.find((c) => c.id === s.customerId);
        const haystack = [
          s.vehicleNo,
          s.materialType,
          s.driverName,
          cust?.name,
          s.status,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (filterMaterial !== "All" && s.materialType !== filterMaterial)
        return false;
      if (
        filterDeliveryMode !== "All" &&
        s.deliveryMode !== filterDeliveryMode
      )
        return false;
      if (filterCustomer !== "All" && s.customerId !== filterCustomer)
        return false;

      if (filterDate) {
        const slipDate = format(parseISO(s.date), 'yyyy-MM-dd');
        if (slipDate !== filterDate) return false;
      } else {
        if (filterStartDate && new Date(s.date) < new Date(filterStartDate + 'T00:00:00'))
          return false;
        if (filterEndDate && new Date(s.date) > new Date(filterEndDate + 'T23:59:59.999'))
          return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [slips, activeTab, debouncedFilterVehicle, debouncedSearch, filterMaterial, filterDeliveryMode, filterCustomer, filterDate, filterStartDate, filterEndDate]);

  // Reset to first page whenever filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filteredSlips.length]);

  // Bottom-nav FAB fires this event to open the create modal
  useEffect(() => {
    const handler = () => setIsCreateOpen(true);
    window.addEventListener(CREATE_EVENT, handler);
    return () => window.removeEventListener(CREATE_EVENT, handler);
  }, []);

  // Infinite scroll sentinel — loads next page when bottom of list comes into view
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((n) => n + PAGE_SIZE); },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const quickDateFilter = (period: "today" | "week" | "month") => {
    const today = new Date();
    setActiveQuickFilter(period);
    if (period === "today") {
      setFilterDate(format(today, 'yyyy-MM-dd'));
      setFilterStartDate("");
      setFilterEndDate("");
    } else if (period === "week") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      setFilterStartDate(format(startOfWeek, 'yyyy-MM-dd'));
      setFilterEndDate("");
      setFilterDate("");
    } else if (period === "month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilterStartDate(format(startOfMonth, 'yyyy-MM-dd'));
      setFilterEndDate("");
      setFilterDate("");
    }
  };

  const hasActiveFilters =
    filterDate ||
    filterStartDate ||
    filterEndDate ||
    filterMaterial !== "All" ||
    filterCustomer !== "All" ||
    filterDeliveryMode !== "All" ||
    filterVehicle.trim() !== "";

  const clearFilters = () => {
    setFilterDate("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterMaterial("All");
    setFilterCustomer("All");
    setFilterDeliveryMode("All");
    setFilterVehicle("");
    setActiveQuickFilter(null);
  };

  const getSlipCustomerName = (slip: Slip) => {
    if (slip.customerId === "CASH" || !slip.customerId) return "Counter Sale";
    return customers.find((c) => c.id === slip.customerId)?.name ?? slip.customerId;
  };

  const handleSlipDocumentAction = async (slip: Slip, action: SlipDocumentAction) => {
    const customerName = getSlipCustomerName(slip);
    const filename = `Slip-${slip.id.slice(0, 8).toUpperCase()}.pdf`;
    setActiveSlipAction({ id: slip.id, action });

    try {
      const blob = await createSlipPdfBlob(slip, customerName, companySettings);

      if (action === "download") {
        downloadPdfBlob(blob, filename);
        addToast("success", "Slip PDF downloaded successfully.");
        return;
      }

      if (action === "whatsapp") {
        const message = buildSlipWhatsAppMessage({ slip, customerName, companySettings });
        const result = await sharePdfBlob(blob, filename, "Loading Slip", message);

        if (result === "downloaded") {
          openWhatsAppMessage(message);
          addToast("info", "Slip PDF downloaded. Attach it in WhatsApp.");
        } else if (result === "shared") {
          addToast("success", "Slip PDF is ready to send. Choose WhatsApp from the share sheet.");
        }
        return;
      }

      if (isNative()) {
        await sharePdfBlob(blob, filename, "Share Loading Token");
      } else {
        await printPdfBlob(blob, `Slip ${slip.id.slice(0, 8).toUpperCase()}`);
      }
      addToast("success", "Slip sent to print.");
    } catch (error) {
      console.error("Slip document action failed:", error);
      addToast("error", "Could not prepare the slip PDF. Please try again.");
    } finally {
      setActiveSlipAction(null);
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filterDate || filterStartDate || filterEndDate) count++;
    if (filterMaterial !== "All") count++;
    if (filterCustomer !== "All") count++;
    if (filterDeliveryMode !== "All") count++;
    if (filterVehicle.trim() !== "") count++;
    return count;
  };

  const filterPanel = (
    <div className="p-3 md:p-4 space-y-3">
      {/* Quick Date Filters */}
      <div>
        <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5 block">
          Quick Dates
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => quickDateFilter("today")}
            aria-pressed={activeQuickFilter === "today"}
            className={`px-4 py-2.5 min-h-[44px] text-xs font-medium rounded-xl transition-colors active:scale-95 ${
              activeQuickFilter === "today"
                ? "bg-primary-500 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => quickDateFilter("week")}
            aria-pressed={activeQuickFilter === "week"}
            className={`px-4 py-2.5 min-h-[44px] text-xs font-medium rounded-xl transition-colors active:scale-95 ${
              activeQuickFilter === "week"
                ? "bg-primary-500 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => quickDateFilter("month")}
            aria-pressed={activeQuickFilter === "month"}
            className={`px-4 py-2.5 min-h-[44px] text-xs font-medium rounded-xl transition-colors active:scale-95 ${
              activeQuickFilter === "month"
                ? "bg-primary-500 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => { clearFilters(); }}
            aria-pressed={!hasActiveFilters}
            className={`px-4 py-2.5 min-h-[44px] text-xs font-medium rounded-xl transition-colors active:scale-95 ${
              !hasActiveFilters
                ? "bg-primary-500 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="filter-from-date" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
            From Date
          </label>
          <input
            id="filter-from-date"
            type="date"
            value={filterStartDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFilterStartDate(e.target.value); setFilterDate(""); setActiveQuickFilter(null); }}
            className="w-full text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:border-primary-500"
          />
        </div>
        <div>
          <label htmlFor="filter-to-date" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
            To Date
          </label>
          <input
            id="filter-to-date"
            type="date"
            value={filterEndDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterEndDate(e.target.value)}
            className="w-full text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Vehicle Search */}
      <div>
        <label htmlFor="filter-vehicle" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
          Vehicle Number
        </label>
        <input
          id="filter-vehicle"
          type="text"
          value={filterVehicle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterVehicle(e.target.value)}
          placeholder="Search vehicle no..."
          className="w-full text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:border-primary-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="filter-material" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
            Material
          </label>
          <select
            id="filter-material"
            value={filterMaterial}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterMaterial(e.target.value)}
            className="w-full text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:border-primary-500"
          >
            <option value="All">All</option>
            {(companySettings.materials || []).map((m: { id?: string; name: string }) => (
              <option key={m.id || m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-customer" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
            Customer
          </label>
          <select
            id="filter-customer"
            value={filterCustomer}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCustomer(e.target.value)}
            className="w-full text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:border-primary-500"
          >
            <option value="All">All</option>
            <option value="CASH">Cash</option>
            {customers.map((c: { id: string; name: string }) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="filter-delivery" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
          Delivery Mode
        </label>
        <select
          id="filter-delivery"
          value={filterDeliveryMode}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterDeliveryMode(e.target.value)}
          className="w-full text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-2 py-1.5 outline-none focus:border-primary-500"
        >
          <option value="All">All</option>
          <option value="Company Vehicle">Own</option>
          <option value="Third-Party Vehicle">Third-Party</option>
        </select>
      </div>
      
      {hasActiveFilters && (
        <button
          onClick={() => { clearFilters(); }}
          className="w-full py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
        >
          Clear Filter{getActiveFilterCount() > 1 ? 's' : ''} ({getActiveFilterCount()})
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Page header — title hidden on mobile (bottom nav provides context) */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="hidden md:block text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Dispatch
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 md:mt-0.5">
            {filteredSlips.length} slip{filteredSlips.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Desktop create button */}
        <button
          onClick={() => { tap(); setIsCreateOpen(true); }}
          className="hidden md:flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl font-medium transition-colors active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Create Slip
        </button>
      </div>

      {/* Mobile expandable search */}


      {/* Tab bar + filter button - Compact */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl md:rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-zinc-100 dark:border-zinc-700 px-3 md:px-4 min-h-[56px]">
          {!searchOpen ? (
            <>
              {(["all", "pending"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "py-2.5 md:py-3 px-2 mr-3 md:mr-5 text-sm font-medium border-b-2 transition-colors shrink-0",
                    activeTab === tab
                      ? "border-primary-600 text-primary-600 dark:text-primary-400"
                      : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                  )}
                >
                  {tab === "all" ? "All" : "Pending"}
                  <span className="ml-1.5 text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                    {tab === "all" ? filteredSlips.length : filteredSlips.filter(s => s.status === "Pending").length}
                  </span>
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-rose-500 font-medium flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => setSearchOpen(true)}
                  className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-2 rounded-lg transition-colors md:hidden text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Search"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsFilterOpen(true)}
                  aria-label="Filter slips"
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium px-2.5 py-2 rounded-lg transition-colors relative",
                    hasActiveFilters
                      ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
                      : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  )}
                >
                  <Filter className="w-4 h-4" />
                  {getActiveFilterCount() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                      {getActiveFilterCount()}
                    </span>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center animate-fade-in relative py-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search slips..."
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
              />
              <button
                onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="md:hidden flex gap-2 overflow-x-auto border-b border-zinc-100 dark:border-zinc-700 px-3 py-2 no-scrollbar">
            {(filterDate || filterStartDate || filterEndDate) && (
              <MobileChip
                onRemove={() => {
                  setFilterDate("");
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setActiveQuickFilter(null);
                }}
              >
                Date
              </MobileChip>
            )}
            {filterMaterial !== "All" && (
              <MobileChip onRemove={() => setFilterMaterial("All")}>{filterMaterial}</MobileChip>
            )}
            {filterCustomer !== "All" && (
              <MobileChip onRemove={() => setFilterCustomer("All")}>
                {filterCustomer === "CASH" ? "Cash" : customers.find((c) => c.id === filterCustomer)?.name || "Customer"}
              </MobileChip>
            )}
            {filterDeliveryMode !== "All" && (
              <MobileChip onRemove={() => setFilterDeliveryMode("All")}>
                {filterDeliveryMode === "Company Vehicle" ? "Own" : "Third"}
              </MobileChip>
            )}
            {filterVehicle.trim() && (
              <MobileChip onRemove={() => setFilterVehicle("")}>{filterVehicle.trim()}</MobileChip>
            )}
          </div>
        )}

        {/* Desktop inline filters */}
        <div className="hidden md:flex flex-wrap gap-2 items-end px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-700">
          {/* Quick Dates */}
          <div className="flex gap-1">
            <button
              onClick={() => quickDateFilter("today")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                filterDate === format(new Date(), 'yyyy-MM-dd')
                  ? "bg-primary-500 text-white"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => quickDateFilter("week")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                filterStartDate && !filterDate
                  ? "bg-primary-500 text-white"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => quickDateFilter("month")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                filterStartDate && new Date(filterStartDate).getDate() === 1 && !filterDate
                  ? "bg-primary-500 text-white"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600"
              }`}
            >
              Month
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600 mx-1"></div>

          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-0.5 block">
              Vehicle
            </label>
            <input
              type="text"
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              placeholder="Search vehicle no..."
              className="text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded px-2 py-1.5 outline-none focus:border-primary-500 w-40"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-0.5 block">
              Material
            </label>
            <select
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded px-2 py-1.5 outline-none focus:border-primary-500"
            >
              <option value="All">All</option>
              {(companySettings.materials || []).map((m) => (
                <option key={m.id || m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-0.5 block">
              Customer
            </label>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded px-2 py-1.5 outline-none focus:border-primary-500 max-w-35"
            >
              <option value="All">All</option>
              <option value="CASH">Cash</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-0.5 block">
              Delivery
            </label>
            <select
              value={filterDeliveryMode}
              onChange={(e) => setFilterDeliveryMode(e.target.value)}
              className="text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded px-2 py-1.5 outline-none focus:border-primary-500"
            >
              <option value="All">All</option>
              <option value="Company Vehicle">Own</option>
              <option value="Third-Party Vehicle">Third</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-rose-500 hover:text-rose-600 px-2 py-1.5"
            >
              Clear
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="p-2 md:p-5">
          {/* ── Mobile card list ── */}
          <div
            className={cn(
              "md:hidden",
              companySettings.mobileLayout === "Compact" ? "mobile-compact-list" : "",
            )}
          >
            {filteredSlips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-600 text-center">
                <Truck className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {hasActiveFilters ? "No slips match the selected filters" : "No dispatch slips found"}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">
                  {hasActiveFilters ? "Clear filters to return to the full dispatch board." : "Create your first slip to get started."}
                </p>
                <button
                  type="button"
                  onClick={hasActiveFilters ? clearFilters : () => setIsCreateOpen(true)}
                  className="mt-4 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white active:scale-[0.98]"
                >
                  {hasActiveFilters ? "Clear Filters" : "Create Slip"}
                </button>
              </div>
            ) : (
              <div className="space-y-2 pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-0 stagger-animation">
                {filteredSlips.slice(0, visibleCount).map((slip) => {
                  const cust = customers.find((c) => c.id === slip.customerId);
                  return (
                    <div
                      key={slip.id}
                      className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden active:scale-[0.98] transition-all shadow-sm"
                    >
                      {/* Compact 2-row layout */}
                      <div className="px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 min-w-0"
                          >
                            <span className="font-bold text-zinc-900 dark:text-white uppercase tracking-wide text-xs truncate"
                            >
                              {slip.vehicleNo}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase shrink-0 ${getStatusColor(slip.status)}`}
                            >
                              {slip.status}
                            </span>
                          </div>
                          <span className="font-bold text-primary-600 dark:text-primary-400 text-sm"
                          >
                            ₹{slip.totalAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400"
                        >
                          <span className="truncate"
                          >{slip.materialType}</span>
                          <span>·</span>
                          <span>{slip.quantity.toFixed(1)} {slip.measurementType === "Volume (Brass)" ? "Br" : "T"}</span>
                          <span>·</span>
                          <span className="truncate"
                          >{slip.customerId === "CASH" ? "Cash" : cust?.name?.slice(0, 14) ?? "—"}</span>
                        </div>
                      </div>

                      {/* Swipe-like action row */}
                      <div className="px-2 py-2 border-t border-zinc-100 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50"
                      >
                        <div className="flex items-center gap-1.5"
                        >
                          {slip.status === "Pending" && (
                            <>
                              <button
                                onClick={() => { success(); updateSlipStatus(slip.id, "Loaded"); }}
                                className="flex-1 py-2 text-[11px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-lg hover:bg-blue-100 active:scale-[0.98] transition-all"
                                aria-label={`Mark slip ${slip.id} as loaded`}
                              >
                                Load
                              </button>
                              <button
                                onClick={() => { tap(); setSlipToCancel(slip.id); }}
                                className="p-2.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 active:scale-95 transition-all"
                                title="Cancel"
                                aria-label={`Cancel slip ${slip.id}`}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {slip.status === "Loaded" && (
                            <button
                              onClick={() => { success(); updateSlipStatus(slip.id, "Tallied"); }}
                              className="flex-1 py-2 text-[11px] font-semibold bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 rounded-lg hover:bg-primary-100 active:scale-[0.98] transition-all"
                              aria-label={`Mark slip ${slip.id} as tallied`}
                            >
                              Tally
                            </button>
                          )}
                          <button
                            onClick={() => setEditingSlip(slip)}
                            className="p-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
                            title="Edit"
                            aria-label={`Edit slip ${slip.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleSlipDocumentAction(slip, "download")}
                            className="p-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-95 transition-all"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleSlipDocumentAction(slip, "print")}
                            className="p-2.5 text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-primary-50 active:scale-95 transition-all"
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {visibleCount < filteredSlips.length && (
                  <div ref={loadMoreRef} className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500"
                  >
                    Showing {visibleCount} of {filteredSlips.length} slips…
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Desktop table ── */}
          <div
            className={cn(
              "hidden md:block",
              "overflow-x-auto",
            )}
          >
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">ID / Time</th>
                  <th className="px-4 py-3">Vehicle / Material</th>
                  <th className="px-4 py-3">Measurement</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-lg text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSlips.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-zinc-500"
                    >
                      No dispatch slips found.
                    </td>
                  </tr>
                )}
                {filteredSlips.slice(0, visibleCount).map((slip) => {
                  const cust = customers.find((c) => c.id === slip.customerId);
                  return (
                    <tr
                      key={slip.id}
                      className="border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          #{slip.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(slip.date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {slip.vehicleNo}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {slip.materialType}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-zinc-700 dark:text-zinc-200 font-medium">
                          {slip.quantity.toFixed(2)}{" "}
                          {slip.measurementType === "Volume (Brass)"
                            ? "Brass"
                            : "Tons"}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {slip.measurementType === "Volume (Brass)"
                            ? `${slip.measurement.lengthFeet}' × ${slip.measurement.widthFeet}' × ${slip.measurement.heightFeet}'`
                            : `G: ${slip.measurement.grossWeight}t | T: ${slip.measurement.tareWeight}t`}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-zinc-700 dark:text-zinc-200">
                        {slip.customerId === "CASH" ? "Cash Sale" : cust?.name}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-zinc-900 dark:text-white">
                          ₹{slip.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          @ ₹{slip.ratePerUnit}/
                          {slip.measurementType === "Volume (Brass)"
                            ? "br"
                            : "t"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold",
                            getStatusColor(slip.status),
                          )}
                        >
                          {slip.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {slip.status === "Pending" && (
                            <>
                              <button
                                onClick={() => { success(); updateSlipStatus(slip.id, "Loaded"); }}
                                className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                                aria-label={`Mark slip ${slip.id} as loaded`}
                              >
                                Loaded
                              </button>
                              <button
                                onClick={() => { tap(); setSlipToCancel(slip.id); }}
                                className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                title="Cancel"
                                aria-label={`Cancel slip ${slip.id}`}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {slip.status === "Loaded" && (
                            <button
                              onClick={() => { success(); updateSlipStatus(slip.id, "Tallied"); }}
                              className="text-xs bg-primary-50 text-primary-600 px-3 py-1.5 rounded-lg font-medium hover:bg-primary-100 transition-colors"
                              aria-label={`Mark slip ${slip.id} as tallied`}
                            >
                              Tally
                            </button>
                          )}
                          <button
                            onClick={() => setEditingSlip(slip)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            title="Edit"
                            aria-label={`Edit slip ${slip.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <DocumentActionButton entityId={slip.id} entityLabel={`slip ${slip.id}`} action="download" label="Download" icon={<Download className="h-3.5 w-3.5" />} className="bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700" activeAction={activeSlipAction} onClick={(a) => void handleSlipDocumentAction(slip, a)} />
                          <DocumentActionButton entityId={slip.id} entityLabel={`slip ${slip.id}`} action="whatsapp" label="WhatsApp" icon={<MessageCircle className="h-3.5 w-3.5" />} className="bg-emerald-600 text-white hover:bg-emerald-700" activeAction={activeSlipAction} onClick={(a) => void handleSlipDocumentAction(slip, a)} />
                          <DocumentActionButton entityId={slip.id} entityLabel={`slip ${slip.id}`} action="print" label="Print" icon={<Printer className="h-3.5 w-3.5" />} className="bg-primary-600 text-white hover:bg-primary-700" activeAction={activeSlipAction} onClick={(a) => void handleSlipDocumentAction(slip, a)} />
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

      {/* ── Filter bottom sheet (mobile) ── */}
      <MobileFilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Slips"
        onClear={clearFilters}
        clearDisabled={!hasActiveFilters}
      >
        {filterPanel}
      </MobileFilterSheet>

      {/* ── Create Slip modal ── */}
      <MobileModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Slip"
        maxWidth="max-w-xs"
        mobileMode="taskSheet"
      >
        <CreateSlipForm onSuccess={() => setIsCreateOpen(false)} />
      </MobileModal>

      {/* ── Edit Slip modal ── */}
      <MobileModal
        isOpen={!!editingSlip}
        onClose={() => setEditingSlip(null)}
        title="Edit Dispatch Slip"
        mobileMode="taskSheet"
        subtitle={editingSlip ? `#${editingSlip.id.slice(0, 8)} · ${editingSlip.vehicleNo}` : undefined}
      >
        {editingSlip && (
          <EditSlipForm
            slip={editingSlip}
            onSuccess={() => setEditingSlip(null)}
            onCancel={() => setEditingSlip(null)}
          />
        )}
      </MobileModal>

      {/* ── Cancel Slip Confirmation ── */}
      <ConfirmationModal
        isOpen={!!slipToCancel}
        title="Cancel Slip"
        message="Are you sure you want to cancel this slip? This action cannot be undone."
        confirmText="Cancel Slip"
        onConfirm={() => {
          if (slipToCancel) {
            updateSlipStatus(slipToCancel, "Cancelled");
            setSlipToCancel(null);
          }
        }}
        onCancel={() => setSlipToCancel(null)}
      />
    </div>
  );
}
