import React, { useState, useMemo } from "react";
import { useErp } from "../context/ErpContext";
import { Truck, Plus, X, Building2, User, FileText } from "lucide-react";
import { MeasurementType, Vehicle } from "../types";
import { format, parseISO } from "date-fns";
import { Slip } from "../types";
import { PrintSlipModal } from "../components/forms/PrintSlipModal";
import { Printer } from "lucide-react";

export function Vehicles() {
  const { vehicles, addVehicle, updateVehicle, slips } = useErp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [printSlip, setPrintSlip] = useState<Slip | null>(null);

  const [formData, setFormData] = useState({
    vehicleNo: "",
    ownerName: "",
    driverName: "",
    driverPhone: "",
    measurementType: "Volume (Brass)" as MeasurementType,
    lengthFeet: "",
    widthFeet: "",
    heightFeet: "",
    tareWeight: "",
  });

  const [searchTerm, setSearchTerm] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newVehicle: Vehicle = {
      id: Math.random().toString(36).substring(2, 11),
      vehicleNo: formData.vehicleNo,
      ownerName: formData.ownerName,
      driverName: formData.driverName,
      driverPhone: formData.driverPhone,
      defaultMeasurementType: formData.measurementType,
      measurement: {
        lengthFeet: parseFloat(formData.lengthFeet) || undefined,
        widthFeet: parseFloat(formData.widthFeet) || undefined,
        heightFeet: parseFloat(formData.heightFeet) || undefined,
        tareWeight: parseFloat(formData.tareWeight) || undefined,
      },
    };
    addVehicle(newVehicle);
    setIsModalOpen(false);
    setFormData({
      vehicleNo: "",
      ownerName: "",
      driverName: "",
      driverPhone: "",
      measurementType: "Volume (Brass)",
      lengthFeet: "",
      widthFeet: "",
      heightFeet: "",
      tareWeight: "",
    });
  };

  const filteredVehicles = useMemo(() => {
    if (!searchTerm) return vehicles;
    const term = searchTerm.toLowerCase().replace(/\s+/g, '');
    return vehicles.filter(
      (v) =>
        v.vehicleNo.toLowerCase().replace(/\s+/g, '').includes(term) ||
        v.ownerName.toLowerCase().replace(/\s+/g, '').includes(term) ||
        (v.driverName && v.driverName.toLowerCase().replace(/\s+/g, '').includes(term))
    );
  }, [vehicles, searchTerm]);

  // Sort: active first
  const sortedVehicles = useMemo(() => {
    return [...filteredVehicles].sort((a, b) => {
      const aActive = a.isActive !== false ? 0 : 1;
      const bActive = b.isActive !== false ? 0 : 1;
      return aActive - bActive;
    });
  }, [filteredVehicles]);

  const vehicleHistory = useMemo(() => {
    if (!selectedVehicle) return [];

    // Slips involving this vehicle
    const vehicleSlips = slips.filter(
      (s) =>
        s.vehicleNo.toUpperCase() === selectedVehicle.vehicleNo.toUpperCase(),
    );

    return vehicleSlips.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [selectedVehicle, slips]);

  const historySummary = useMemo(() => {
    let totalBrass = 0;
    let totalTons = 0;
    let totalAmount = 0;
    vehicleHistory.forEach(t => {
      totalAmount += t.totalAmount;
      if (t.measurementType === "Volume (Brass)") totalBrass += t.quantity;
      else totalTons += t.quantity;
    });
    return { totalBrass, totalTons, totalAmount };
  }, [vehicleHistory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Vehicles Directory
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Manage vehicles, search, and history.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search vehicle or owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-primary-500 outline-none text-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Vehicle
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
        <div className="p-0 md:p-5">
          {/* Mobile list view */}
          <div className={`${companySettings.mobileLayout === 'Compact' ? 'hidden' : 'md:hidden divide-y divide-zinc-100 dark:divide-zinc-800'}`}>
            {sortedVehicles.map((v) => (
              <div key={v.id} className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                   <div className="font-bold text-zinc-900 dark:text-white text-lg">{v.vehicleNo}</div>
                   <span className={`px-2 py-1 rounded text-xs font-semibold ${v.defaultMeasurementType === "Volume (Brass)" ? "bg-indigo-50 text-indigo-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"}`}>
                      {v.defaultMeasurementType}
                   </span>
                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${v.isActive !== false ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
                     {v.isActive !== false ? "Active" : "Inactive"}
                   </span>
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                   <span className="font-semibold text-zinc-800 dark:text-zinc-200">Owner:</span> {v.ownerName}
                   {v.driverName && <div className="mt-1">Driver: {v.driverName} {v.driverPhone && `(${v.driverPhone})`}</div>}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                   {v.defaultMeasurementType === "Volume (Brass)"
                        ? `${v.measurement.lengthFeet}' L × ${v.measurement.widthFeet}' W × ${v.measurement.heightFeet}' H`
                        : `Tare Weight: ${v.measurement.tareWeight} Tons`}
                </div>
                <button
                  onClick={() => setSelectedVehicle(v)}
                  className="mt-2 text-indigo-600 hover:text-indigo-800 font-medium px-3 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center justify-center text-sm flex-1"
                >
                  <FileText className="w-4 h-4 mr-2" /> Trips
                </button>
                <button
                  onClick={() => updateVehicle({ ...v, isActive: v.isActive === false })}
                  className={`mt-2 font-medium px-3 py-2 rounded-lg transition-colors inline-flex items-center justify-center text-sm flex-1 ${v.isActive !== false ? "text-rose-600 bg-rose-50 hover:bg-rose-100" : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"}`}
                >
                  {v.isActive !== false ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
            {sortedVehicles.length === 0 && (
              <div className="p-8 text-center text-zinc-500">No vehicles found.</div>
            )}
          </div>
          
          {/* Desktop table view */}
          <div className={`${companySettings.mobileLayout === 'Compact' ? 'block' : 'hidden md:block'} overflow-x-auto`}>
            <table className="w-full text-sm text-left align-middle">
              <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase rounded-lg">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Vehicle No.</th>
                  <th className="px-4 py-3">Owner / Driver</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Dimensions</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedVehicles.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-zinc-50 dark:border-zinc-700/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <td className="px-4 py-4 font-bold text-zinc-900 dark:text-white align-top">
                      {v.vehicleNo}
                    </td>
                    <td className="px-4 py-4 font-medium text-zinc-700 dark:text-zinc-200 align-top">
                      {v.ownerName}
                      {v.driverName && (
                        <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                          Driver: {v.driverName} {v.driverPhone && `(${v.driverPhone})`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${v.defaultMeasurementType === "Volume (Brass)" ? "bg-indigo-50 text-indigo-700" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"}`}
                      >
                        {v.defaultMeasurementType}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300 align-top">
                      {v.defaultMeasurementType === "Volume (Brass)"
                        ? `${v.measurement.lengthFeet}' × ${v.measurement.widthFeet}' × ${v.measurement.heightFeet}'`
                        : `Tare Weight: ${v.measurement.tareWeight} Tons`}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.isActive !== false ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                        {v.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right align-top space-x-2">
                      <button
                        onClick={() => setSelectedVehicle(v)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center whitespace-nowrap"
                      >
                        <FileText className="w-4 h-4 mr-1.5" /> Trips
                      </button>
                      <button
                        onClick={() => updateVehicle({ ...v, isActive: v.isActive === false })}
                        className={`font-medium px-3 py-1.5 rounded-lg transition-colors inline-flex items-center whitespace-nowrap ${v.isActive !== false ? "text-rose-600 bg-rose-50 hover:bg-rose-100" : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"}`}
                      >
                        {v.isActive !== false ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {sortedVehicles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500">No vehicles found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Add New Vehicle
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-3 md:p-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Vehicle Number
                  </label>
                  <input
                    required
                    value={formData.vehicleNo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vehicleNo: e.target.value.toUpperCase(),
                      })
                    }
                    type="text"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none uppercase"
                    placeholder="MH 12 AB 1234"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Owner / Transporter Name
                  </label>
                  <input
                    required
                    value={formData.ownerName}
                    onChange={(e) =>
                      setFormData({ ...formData, ownerName: e.target.value })
                    }
                    type="text"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Akash Logistics"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Driver Name
                  </label>
                  <input
                    value={formData.driverName}
                    onChange={(e) =>
                      setFormData({ ...formData, driverName: e.target.value })
                    }
                    type="text"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="Ramesh"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Driver Phone
                  </label>
                  <input
                    value={formData.driverPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, driverPhone: e.target.value })
                    }
                    type="text"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2 block">
                  Default Measurement Method
                </label>
                <div className="flex border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        measurementType: "Volume (Brass)",
                      })
                    }
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${formData.measurementType === "Volume (Brass)" ? "bg-indigo-50 text-indigo-700" : "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:bg-zinc-800"}`}
                  >
                    Box Volume (Brass)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        measurementType: "Weight (Tonnes)",
                      })
                    }
                    className={`flex-1 py-2 text-sm font-medium border-l border-zinc-300 dark:border-zinc-600 transition-colors ${formData.measurementType === "Weight (Tonnes)" ? "bg-indigo-50 text-indigo-700" : "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:bg-zinc-800"}`}
                  >
                    Weight (Tons)
                  </button>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl space-y-4 border border-zinc-100 dark:border-zinc-700">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center">
                  <Truck className="w-4 h-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                  Fixed Details
                </h4>

                {formData.measurementType === "Volume (Brass)" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                        Length (ft)
                      </label>
                      <input
                        required
                        step="0.01"
                        type="number"
                        value={formData.lengthFeet}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            lengthFeet: e.target.value,
                          })
                        }
                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="10.5"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                        Width (ft)
                      </label>
                      <input
                        required
                        step="0.01"
                        type="number"
                        value={formData.widthFeet}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            widthFeet: e.target.value,
                          })
                        }
                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="5.0"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                        Height (ft)
                      </label>
                      <input
                        required
                        step="0.01"
                        type="number"
                        value={formData.heightFeet}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            heightFeet: e.target.value,
                          })
                        }
                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="2.0"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                        Tare Weight (Empty Truck) (Tons)
                      </label>
                      <input
                        required
                        step="0.01"
                        type="number"
                        value={formData.tareWeight}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tareWeight: e.target.value,
                          })
                        }
                        className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="10.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-100 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg transition-colors"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedVehicle && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#f8fafc] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col relative">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase">
                  {selectedVehicle.vehicleNo} - Trip History
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Owner: {selectedVehicle.ownerName || "Self"}
                </p>
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 md:px-6 grid grid-cols-3 gap-4 shrink-0">
               <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase">Total Amount</p>
                  <p className="font-bold text-lg text-zinc-900 dark:text-white">₹ {historySummary.totalAmount.toLocaleString()}</p>
               </div>
               <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase">Total Brass</p>
                  <p className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{historySummary.totalBrass.toFixed(2)}</p>
               </div>
               <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase">Total Tons</p>
                  <p className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{historySummary.totalTons.toFixed(2)}</p>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-800 p-0">
              <table className="w-full text-sm text-left ">
                <thead className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 uppercase sticky top-0 border-b border-zinc-100 dark:border-zinc-700">
                  <tr>
                    <th className="px-4 py-3 md:px-6 md:py-4">Date & Time</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Material</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Customer/Site</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Quantity</th>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-right">Trip Value</th>
                    <th className="px-4 py-3 md:px-6 md:py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {vehicleHistory.map((trip) => {
                    return (
                      <tr key={trip.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <td className="px-4 py-3 md:px-6 md:py-4 text-zinc-600 dark:text-zinc-300">
                          {format(parseISO(trip.date), "dd MMM yyyy, hh:mm a")}
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4 font-medium text-zinc-900 dark:text-white">
                          {trip.materialType}
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4 text-zinc-700 dark:text-zinc-200">
                          {trip.customerId === "CASH"
                            ? "Cash Sale"
                            : "Credit Sale"}
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4 text-zinc-600 dark:text-zinc-300">
                          {trip.quantity.toFixed(1)}{" "}
                          {trip.measurementType === "Volume (Brass)"
                            ? "Brass"
                            : "Tons"}
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4 text-right font-semibold text-zinc-900 dark:text-white">
                          ₹ {trip.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 md:px-6 md:py-4 text-right">
                          <button
                            onClick={() => setPrintSlip(trip)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            title="Print/Download"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {vehicleHistory.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400"
                      >
                        No trips recorded for this vehicle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 md:px-6 md:py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-700 shrink-0 flex justify-end">
              <button
                onClick={() => setSelectedVehicle(null)}
                className="px-5 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors shadow-sm"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {printSlip && (
        <PrintSlipModal slip={printSlip} onClose={() => setPrintSlip(null)} />
      )}
    </div>
  );
}
