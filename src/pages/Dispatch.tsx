import React, { useState, useEffect } from "react";
import { useErp } from "../context/ErpContext";
import {
  MaterialType,
  Slip,
  DeliveryMode,
  MeasurementType,
  Vehicle,
} from "../types";
import {
  Plus,
  X,
  Truck,
  FileText,
  Printer,
  Building2,
  User,
  Edit2,
  Ban
} from "lucide-react";
import { CreateSlipForm } from "../components/forms/CreateSlipForm";
import { EditSlipForm } from "../components/forms/EditSlipForm";
import { PrintSlipModal } from "../components/forms/PrintSlipModal";

export function Dispatch() {
  const { slips, customers, vehicles, updateSlipStatus, companySettings } =
    useErp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState<Slip | null>(null);
  const [printSlip, setPrintSlip] = useState<Slip | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");

  // Filters
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("All");
  const [filterDeliveryMode, setFilterDeliveryMode] = useState("All");
  const [filterCustomer, setFilterCustomer] = useState("All");

  const filteredSlips = slips
    .filter((s) => {
      if (activeTab === "pending" && s.status !== "Pending") return false;
      if (filterMaterial !== "All" && s.materialType !== filterMaterial)
        return false;
      if (filterDeliveryMode !== "All" && s.deliveryMode !== filterDeliveryMode)
        return false;
      if (filterCustomer !== "All" && s.customerId !== filterCustomer)
        return false;
      if (filterStartDate) {
        if (new Date(s.date) < new Date(filterStartDate)) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(s.date) > end) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Dispatch & Slips
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Manage vehicle dispatches and measurements.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Slip
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
        <div className="border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 flex flex-wrap gap-4 text-sm md:text-base">
          <button
            className={`font-medium pb-3 border-b-2 transition-colors ${activeTab === "all" ? "border-primary-600 text-primary-600" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200"}`}
            onClick={() => setActiveTab("all")}
          >
            All Slips
          </button>
          <button
            className={`font-medium pb-3 border-b-2 transition-colors ${activeTab === "pending" ? "border-primary-600 text-primary-600" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200"}`}
            onClick={() => setActiveTab("pending")}
          >
            Pending Load
          </button>
        </div>

        <div className="border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 md:px-6 md:py-4 bg-zinc-50 dark:bg-zinc-900/50 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
              From Date
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
              To Date
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1 block">
              Material
            </label>
            <select
              value={filterMaterial}
              onChange={(e) => setFilterMaterial(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="All">All Materials</option>
              {(companySettings.materials || []).map((m) => (
                <option key={m.id || m.name} value={m.name}>{m.name}</option>
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
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 max-w-[200px]"
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
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="All">All Modes</option>
              <option value="Company Vehicle">Own Vehicle</option>
              <option value="Third-Party Vehicle">Third-Party</option>
            </select>
          </div>
          {(filterStartDate ||
            filterEndDate ||
            filterMaterial !== "All" ||
            filterCustomer !== "All" ||
            filterDeliveryMode !== "All") && (
            <button
              onClick={() => {
                setFilterStartDate("");
                setFilterEndDate("");
                setFilterMaterial("All");
                setFilterCustomer("All");
                setFilterDeliveryMode("All");
              }}
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 px-3 py-2"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="p-3 md:p-5">
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredSlips.length === 0 ? (
              <div className="text-center text-sm text-zinc-500 py-8">No records found.</div>
            ) : (
              filteredSlips.map((slip) => {
                const cust = customers.find((c) => c.id === slip.customerId);
                return (
                  <div key={slip.id} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-white uppercase">{slip.vehicleNo}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                           #{slip.id} • {new Date(slip.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${slip.status === "Tallied" ? "bg-primary-100 text-primary-700" : slip.status === "Loaded" ? "bg-blue-100 text-blue-700" : slip.status === "Cancelled" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {slip.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                         <span className="text-zinc-500 text-xs block">Customer</span>
                         <span className="font-medium dark:text-zinc-200 truncate">{slip.customerId === "CASH" ? "Cash Sale" : cust?.name}</span>
                      </div>
                      <div>
                         <span className="text-zinc-500 text-xs block">Material</span>
                         <span className="font-medium dark:text-zinc-200">{slip.materialType}</span>
                      </div>
                      <div>
                         <span className="text-zinc-500 text-xs block">Measurement</span>
                         <span className="font-medium dark:text-zinc-200">
                           {slip.quantity.toFixed(2)} {slip.measurementType === "Volume (Brass)" ? "Brass" : "Tons"}
                         </span>
                      </div>
                      <div>
                         <span className="text-zinc-500 text-xs block">Amount</span>
                         <span className="font-bold text-zinc-900 dark:text-white">₹{slip.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-2 gap-2 border-t border-zinc-100 dark:border-zinc-700/50">
                       {slip.status === "Pending" && (
                         <>
                           <button onClick={() => updateSlipStatus(slip.id, "Loaded")} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded font-medium hover:bg-blue-100">
                             Mark Loaded
                           </button>
                           <button onClick={() => confirm("Are you sure you want to cancel this slip?") && updateSlipStatus(slip.id, "Cancelled")} className="text-xs bg-rose-50 text-rose-600 px-3 py-1.5 rounded font-medium hover:bg-rose-100">
                             Cancel
                           </button>
                         </>
                       )}
                       {slip.status === "Loaded" && (
                         <button onClick={() => updateSlipStatus(slip.id, "Tallied")} className="text-xs bg-primary-50 text-primary-600 px-3 py-1.5 rounded font-medium hover:bg-primary-100">
                           Tally
                         </button>
                       )}
                       <button onClick={() => setEditingSlip(slip)} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 p-1.5"><Edit2 className="w-4 h-4" /></button>
                       <button onClick={() => setPrintSlip(slip)} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 p-1.5"><Printer className="w-4 h-4" /></button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left ">
              <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase rounded-lg">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">ID / Time</th>
                  <th className="px-4 py-3">Vehicle Details</th>
                  <th className="px-4 py-3">Measurement</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlips.map((slip) => {
                  const cust = customers.find((c) => c.id === slip.customerId);
                  return (
                    <tr
                      key={slip.id}
                      className="border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <td className="px-4 py-4">
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
                      <td className="px-4 py-4">
                        {slip.customerId === "CASH" ? "Cash Sale" : cust?.name}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-zinc-900 dark:text-white">
                          ₹{slip.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-col">
                          <span>
                            @ ₹{slip.ratePerUnit}/
                            {slip.measurementType === "Volume (Brass)"
                              ? "br"
                              : "t"}
                          </span>
                          {slip.freightAmount > 0 && (
                            <span className="text-indigo-600">
                              + ₹{slip.freightAmount} frt
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center
                          ${
                            slip.status === "Tallied"
                              ? "bg-primary-100 text-primary-700"
                              : slip.status === "Loaded"
                                ? "bg-blue-100 text-blue-700"
                                : slip.status === "Cancelled"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {slip.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right space-x-2">
                        {slip.status === "Pending" && (
                          <>
                            <button
                              onClick={() => updateSlipStatus(slip.id, "Loaded")}
                              className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded font-medium hover:bg-blue-100"
                            >
                              Mark Loaded
                            </button>
                            <button
                              onClick={() => confirm("Are you sure you want to cancel this slip?") && updateSlipStatus(slip.id, "Cancelled")}
                              className="text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:text-rose-400 p-1.5"
                              title="Cancel Slip"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {slip.status === "Loaded" && (
                          <button
                            onClick={() => updateSlipStatus(slip.id, "Tallied")}
                            className="text-xs bg-primary-50 text-primary-600 px-3 py-1.5 rounded font-medium hover:bg-primary-100"
                          >
                            Tally
                          </button>
                        )}
                        <button
                          onClick={() => setEditingSlip(slip)}
                          className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 p-1.5"
                          title="Edit Slip"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPrintSlip(slip)}
                          className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 p-1.5"
                          title="Print/View Slip"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
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
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center md:p-4 z-50 overflow-hidden">
          <div className="bg-white dark:bg-zinc-800 md:rounded-2xl w-full h-full md:h-auto max-w-2xl md:max-h-[90vh] overflow-y-auto shadow-xl flex flex-col">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                New Dispatch Slip
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CreateSlipForm onSuccess={() => setIsModalOpen(false)} />
          </div>
        </div>
      )}

      {editingSlip && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center md:p-4 z-50 overflow-hidden">
          <div className="bg-white dark:bg-zinc-800 md:rounded-2xl w-full h-full md:h-auto max-w-2xl md:max-h-[90vh] overflow-y-auto shadow-xl flex flex-col">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Edit Dispatch Slip
              </h3>
              <button
                onClick={() => setEditingSlip(null)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <EditSlipForm 
              slip={editingSlip} 
              onSuccess={() => setEditingSlip(null)} 
              onCancel={() => setEditingSlip(null)} 
            />
          </div>
        </div>
      )}

      {/* Print Modal for Token */}
      {printSlip && (
        <PrintSlipModal slip={printSlip} onClose={() => setPrintSlip(null)} />
      )}
    </div>
  );
}
