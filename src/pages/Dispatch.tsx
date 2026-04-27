import React, { useState } from "react";
import { useErp } from "../context/ErpContext";
import { Slip } from "../types";
import {
  Plus,
  Truck,
  Printer,
  Edit2,
  Ban,
  Filter,
  X,
} from "lucide-react";
import { CreateSlipForm } from "../components/forms/CreateSlipForm";
import { EditSlipForm } from "../components/forms/EditSlipForm";
import { PrintSlipModal } from "../components/forms/PrintSlipModal";
import { MobileModal } from "../components/ui/MobileModal";
import { cn } from "../lib/utils";

function statusStyle(status: string) {
  switch (status) {
    case "Tallied":
      return "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300";
    case "Loaded":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    case "Cancelled":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
  }
}

export function Dispatch() {
  const { slips, customers, vehicles, updateSlipStatus, companySettings } =
    useErp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState<Slip | null>(null);
  const [printSlip, setPrintSlip] = useState<Slip | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("All");
  const [filterDeliveryMode, setFilterDeliveryMode] = useState("All");
  const [filterCustomer, setFilterCustomer] = useState("All");

  const hasActiveFilters =
    filterStartDate ||
    filterEndDate ||
    filterMaterial !== "All" ||
    filterCustomer !== "All" ||
    filterDeliveryMode !== "All";

  const clearFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterMaterial("All");
    setFilterCustomer("All");
    setFilterDeliveryMode("All");
  };

  const filteredSlips = slips
    .filter((s) => {
      if (activeTab === "pending" && s.status !== "Pending") return false;
      if (filterMaterial !== "All" && s.materialType !== filterMaterial)
        return false;
      if (
        filterDeliveryMode !== "All" &&
        s.deliveryMode !== filterDeliveryMode
      )
        return false;
      if (filterCustomer !== "All" && s.customerId !== filterCustomer)
        return false;
      if (filterStartDate && new Date(s.date) < new Date(filterStartDate))
        return false;
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(s.date) > end) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filterPanel = (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5 block">
            From Date
          </label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterStartDate(e.target.value)}
            className="w-full text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5 block">
            To Date
          </label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterEndDate(e.target.value)}
            className="w-full text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5 block">
          Material
        </label>
        <select
          value={filterMaterial}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterMaterial(e.target.value)}
          className="w-full text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="All">All Materials</option>
          {(companySettings.materials || []).map((m: { id?: string; name: string }) => (
            <option key={m.id || m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5 block">
          Customer
        </label>
        <select
          value={filterCustomer}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCustomer(e.target.value)}
          className="w-full text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="All">All Customers</option>
          <option value="CASH">Cash Sale</option>
          {customers.map((c: { id: string; name: string }) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5 block">
          Delivery Mode
        </label>
        <select
          value={filterDeliveryMode}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterDeliveryMode(e.target.value)}
          className="w-full text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-3 py-2.5 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option value="All">All Modes</option>
          <option value="Company Vehicle">Own Vehicle</option>
          <option value="Third-Party Vehicle">Third-Party</option>
        </select>
      </div>
      {hasActiveFilters && (
        <button
          onClick={() => { clearFilters(); setIsFilterOpen(false); }}
          className="w-full py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Dispatch & Slips
          </h2>
          <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage vehicle dispatches and measurements.
          </p>
        </div>
        {/* Desktop create button */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="hidden md:flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl font-medium transition-colors active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Create Slip
        </button>
      </div>

      {/* Tab bar + filter button */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-zinc-100 dark:border-zinc-700 px-4">
          {(["all", "pending"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-primary-600 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
              )}
            >
              {tab === "all" ? "All Slips" : "Pending"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-rose-500 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
            <button
              onClick={() => setIsFilterOpen(true)}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-colors",
                hasActiveFilters
                  ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
              )}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              {hasActiveFilters && (
                <span className="w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] flex items-center justify-center font-bold">
                  !
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop inline filters */}
        <div className="hidden md:flex flex-wrap gap-3 items-end px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-700">
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
              From
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-3 py-2 outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
              To
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-3 py-2 outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
              Material
            </label>
            <select
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-3 py-2 outline-none focus:border-primary-500"
            >
              <option value="All">All Materials</option>
              {(companySettings.materials || []).map((m) => (
                <option key={m.id || m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
              Customer
            </label>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-3 py-2 outline-none focus:border-primary-500 max-w-[180px]"
            >
              <option value="All">All Customers</option>
              <option value="CASH">Cash Sale</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
              Delivery
            </label>
            <select
              value={filterDeliveryMode}
              onChange={(e) => setFilterDeliveryMode(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg px-3 py-2 outline-none focus:border-primary-500"
            >
              <option value="All">All Modes</option>
              <option value="Company Vehicle">Own Vehicle</option>
              <option value="Third-Party Vehicle">Third-Party</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 px-3 py-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="p-3 md:p-5">
          {/* ── Mobile card list ── */}
          <div
            className={cn(
              companySettings.mobileLayout === "Compact"
                ? "hidden"
                : "md:hidden",
            )}
          >
            {filteredSlips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-600">
                <Truck className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No slips found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSlips.map((slip) => {
                  const cust = customers.find((c) => c.id === slip.customerId);
                  return (
                    <div
                      key={slip.id}
                      className="bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700/50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Truck className="w-4 h-4 text-zinc-400 shrink-0" />
                          <span className="font-bold text-zinc-900 dark:text-white uppercase tracking-wide text-sm truncate">
                            {slip.vehicleNo}
                          </span>
                          <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                            #{slip.id}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold shrink-0",
                            statusStyle(slip.status),
                          )}
                        >
                          {slip.status}
                        </span>
                      </div>

                      {/* Card body */}
                      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                            Customer
                          </p>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                            {slip.customerId === "CASH"
                              ? "Cash Sale"
                              : cust?.name ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                            Material
                          </p>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">
                            {slip.materialType}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                            Qty
                          </p>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">
                            {slip.quantity.toFixed(2)}{" "}
                            {slip.measurementType === "Volume (Brass)"
                              ? "Brass"
                              : "Tons"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                            Amount
                          </p>
                          <p className="text-sm font-bold text-zinc-900 dark:text-white">
                            ₹{slip.totalAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Card footer – actions */}
                      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-700/50 bg-white dark:bg-zinc-800">
                        {slip.status === "Pending" && (
                          <>
                            <button
                              onClick={() =>
                                updateSlipStatus(slip.id, "Loaded")
                              }
                              className="flex-1 py-2 text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors active:scale-95"
                            >
                              Mark Loaded
                            </button>
                            <button
                              onClick={() =>
                                window.confirm(
                                  "Cancel this slip?",
                                ) && updateSlipStatus(slip.id, "Cancelled")
                              }
                              className="p-2 text-zinc-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors active:scale-95"
                              title="Cancel"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {slip.status === "Loaded" && (
                          <button
                            onClick={() =>
                              updateSlipStatus(slip.id, "Tallied")
                            }
                            className="flex-1 py-2 text-xs font-semibold bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 rounded-xl hover:bg-primary-100 transition-colors active:scale-95"
                          >
                            Tally
                          </button>
                        )}
                        <button
                          onClick={() => setEditingSlip(slip)}
                          className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors active:scale-95"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPrintSlip(slip)}
                          className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors active:scale-95"
                          title="Print"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Desktop table ── */}
          <div
            className={cn(
              companySettings.mobileLayout === "Compact"
                ? "block"
                : "hidden md:block",
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
                      No slips found.
                    </td>
                  </tr>
                )}
                {filteredSlips.map((slip) => {
                  const cust = customers.find((c) => c.id === slip.customerId);
                  return (
                    <tr
                      key={slip.id}
                      className="border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          #{slip.id}
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
                          {slip.freightAmount > 0 && (
                            <span className="text-indigo-500 ml-1">
                              + ₹{slip.freightAmount} frt
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold",
                            statusStyle(slip.status),
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
                                onClick={() =>
                                  updateSlipStatus(slip.id, "Loaded")
                                }
                                className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                              >
                                Loaded
                              </button>
                              <button
                                onClick={() =>
                                  window.confirm("Cancel this slip?") &&
                                  updateSlipStatus(slip.id, "Cancelled")
                                }
                                className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                title="Cancel"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {slip.status === "Loaded" && (
                            <button
                              onClick={() =>
                                updateSlipStatus(slip.id, "Tallied")
                              }
                              className="text-xs bg-primary-50 text-primary-600 px-3 py-1.5 rounded-lg font-medium hover:bg-primary-100 transition-colors"
                            >
                              Tally
                            </button>
                          )}
                          <button
                            onClick={() => setEditingSlip(slip)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPrintSlip(slip)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
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

      {/* ── Mobile FAB ── */}
      <button
        onClick={() => setIsCreateOpen(true)}
        className="md:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 flex items-center justify-center active:scale-95 transition-all"
        aria-label="Create Slip"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* ── Filter bottom sheet (mobile) ── */}
      <MobileModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Slips"
        maxWidth="max-w-md"
      >
        {filterPanel}
      </MobileModal>

      {/* ── Create Slip modal ── */}
      <MobileModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Dispatch Slip"
      >
        <CreateSlipForm onSuccess={() => setIsCreateOpen(false)} />
      </MobileModal>

      {/* ── Edit Slip modal ── */}
      <MobileModal
        isOpen={!!editingSlip}
        onClose={() => setEditingSlip(null)}
        title="Edit Dispatch Slip"
        subtitle={editingSlip ? `#${editingSlip.id} · ${editingSlip.vehicleNo}` : undefined}
      >
        {editingSlip && (
          <EditSlipForm
            slip={editingSlip}
            onSuccess={() => setEditingSlip(null)}
            onCancel={() => setEditingSlip(null)}
          />
        )}
      </MobileModal>

      {/* ── Print Modal ── */}
      {printSlip && (
        <PrintSlipModal slip={printSlip} onClose={() => setPrintSlip(null)} />
      )}
    </div>
  );
}
