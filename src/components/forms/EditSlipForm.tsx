import React, { useState, useEffect } from "react";
import { useErp } from "../../context/ErpContext";
import { Slip, MaterialType, DeliveryMode, MeasurementType } from "../../types";
import { Combobox } from "../ui/Combobox";
import { parseFeetInches } from "../../lib/utils";

export function EditSlipForm({ slip, onSuccess, onCancel }: { slip: Slip, onSuccess: () => void, onCancel: () => void }) {
  const { vehicles, addVehicle, updateVehicle, customers, updateSlip, slips, transactions, addTransaction, updateTransaction, deleteTransaction, companySettings } = useErp();
  const [formData, setFormData] = useState({
    vehicleNo: slip.vehicleNo || "",
    driverName: slip.driverName || "",
    driverPhone: slip.driverPhone || "",
    materialType: slip.materialType || "10mm",
    deliveryMode: slip.deliveryMode || "Third-Party Vehicle",
    measurementType: slip.measurementType || "Volume (Brass)",
    lengthFeet: slip.measurement?.lengthFeet?.toString() || "",
    widthFeet: slip.measurement?.widthFeet?.toString() || "",
    heightFeet: slip.measurement?.heightFeet?.toString() || "",
    grossWeight: slip.measurement?.grossWeight?.toString() || "",
    tareWeight: slip.measurement?.tareWeight?.toString() || "",
    customerId: slip.customerId || "CASH",
    ratePerUnit: slip.ratePerUnit?.toString() || "",
    freightAmount: slip.freightAmount?.toString() || "",
    amountPaid: slip.amountPaid?.toString() || "",
    notes: slip.notes || "",
    operatorName: slip.operatorName || "",
    loaderName: slip.loaderName || "",
  });

  const calculateQuantity = () => {
    if (formData.measurementType === "Volume (Brass)") {
      const l = parseFeetInches(formData.lengthFeet);
      const w = parseFeetInches(formData.widthFeet);
      const h = parseFeetInches(formData.heightFeet);
      return (l * w * h) / 100;
    } else {
      const g = parseFloat(formData.grossWeight) || 0;
      const t = parseFloat(formData.tareWeight) || 0;
      return Math.max(0, g - t);
    }
  };

  const calculatedQty = calculateQuantity();
  const freightVisible = formData.deliveryMode === "Third-Party Vehicle" && formData.customerId !== "CASH";
  const appliedFreight = freightVisible ? (parseFloat(formData.freightAmount) || 0) : 0;
  
  const calculatedTotalAmount = Math.round(
    calculatedQty * (parseFloat(formData.ratePerUnit) || 0) + appliedFreight
  );

  const [prevCalculatedAmount, setPrevCalculatedAmount] = useState<number>(calculatedTotalAmount);
  const [manualTotalAmount, setManualTotalAmount] = useState<string>(Math.round(slip.totalAmount).toString());

  if (calculatedTotalAmount !== prevCalculatedAmount) {
    setPrevCalculatedAmount(calculatedTotalAmount);
    setManualTotalAmount(calculatedTotalAmount.toString());
  }

  const finalAmount = parseFloat(manualTotalAmount) || 0;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleNo || !formData.ratePerUnit) return;

    if (formData.measurementType === "Weight (Tonnes)") {
      const tare = parseFloat(formData.tareWeight) || 0;
      const gross = parseFloat(formData.grossWeight) || 0;
      if (tare < 0 || gross < 0) {
        alert("Weights cannot be negative.");
        return;
      }
      if (tare > gross) {
        alert("Tare Weight cannot be greater than Gross Weight.");
        return;
      }
    } else if (formData.measurementType === "Volume (Brass)") {
      const l = parseFeetInches(formData.lengthFeet);
      const w = parseFeetInches(formData.widthFeet);
      const h = parseFeetInches(formData.heightFeet);
      if (l <= 0 || w <= 0 || h <= 0) {
        alert("Length, width, and height must be positive values.");
        return;
      }
    }

    if (calculatedQty < 0) {
      alert("Calculated quantity cannot be negative.");
      return;
    }

    if (parseFloat(formData.ratePerUnit) < 0) {
      alert("Rate per unit cannot be negative.");
      return;
    }

    const freightAmt = parseFloat(formData.freightAmount) || 0;
    if (freightVisible && freightAmt < 0) {
      alert("Freight amount cannot be negative.");
      return;
    }

    const finalAmountPaid = parseFloat(formData.amountPaid) || 0;
    if (finalAmountPaid < 0) {
      alert("Amount paid cannot be negative.");
      return;
    }

    // Auto-update or add vehicle
    if (formData.vehicleNo) {
      const existingVehicle = vehicles.find(v => v.vehicleNo === formData.vehicleNo);
      if (existingVehicle) {
        if (formData.driverName !== existingVehicle.driverName || formData.driverPhone !== existingVehicle.driverPhone) {
          updateVehicle({
            ...existingVehicle,
            driverName: formData.driverName,
            driverPhone: formData.driverPhone,
          });
        }
      } else {
         addVehicle({
            id: Math.random().toString(36).substring(2, 11),
            vehicleNo: formData.vehicleNo.toUpperCase(),
            ownerName: formData.driverName || '',
            driverName: formData.driverName,
            driverPhone: formData.driverPhone,
            defaultMeasurementType: formData.measurementType,
            measurement: {
                lengthFeet: parseFloat(formData.lengthFeet) || undefined,
                widthFeet: parseFloat(formData.widthFeet) || undefined,
                heightFeet: parseFloat(formData.heightFeet) || undefined,
                tareWeight: parseFloat(formData.tareWeight) || undefined,
            }
         });
      }
    }

    const updatedSlip: Slip = {
      ...slip,
      vehicleNo: formData.vehicleNo,
      driverName: formData.driverName,
      driverPhone: formData.driverPhone,
      materialType: formData.materialType as MaterialType,
      deliveryMode: formData.deliveryMode as DeliveryMode,
      measurementType: formData.measurementType as MeasurementType,
      measurement: {
        lengthFeet: parseFloat(formData.lengthFeet) || undefined,
        widthFeet: parseFloat(formData.widthFeet) || undefined,
        heightFeet: parseFloat(formData.heightFeet) || undefined,
        grossWeight: parseFloat(formData.grossWeight) || undefined,
        tareWeight: parseFloat(formData.tareWeight) || undefined,
      },
      quantity: calculatedQty,
      ratePerUnit: parseFloat(formData.ratePerUnit) || 0,
      freightAmount: appliedFreight,
      totalAmount: finalAmount,
      amountPaid: finalAmountPaid,
      customerId: formData.customerId,
      notes: formData.notes,
      operatorName: formData.operatorName,
      loaderName: formData.loaderName,
    };

    if (slip.status === "Tallied" || slip.invoiceId) {
      if (slip.customerId !== updatedSlip.customerId || slip.totalAmount !== updatedSlip.totalAmount) {
         if (!window.confirm("WARNING: This slip has already been tallied or invoiced. Changing the customer or financial amounts may cause discrepancies in the ledger. Are you SURE you want to continue?")) {
            return;
         }
      }
    }

    if (updateSlip) {
      updateSlip(slip.id, updatedSlip);
    }

    if (transactions) {
       const existingTx = transactions.find(t => t.slipId === slip.id);
       if (existingTx) {
          if (finalAmountPaid > 0) {
             if (updateTransaction) {
                updateTransaction(existingTx.id, {
                   amount: finalAmountPaid,
                   customerId: updatedSlip.customerId
                });
             }
          } else {
             if (deleteTransaction) {
                deleteTransaction(existingTx.id);
             }
          }
       } else {
          if (finalAmountPaid > 0) {
             if (addTransaction) {
                 addTransaction({
                    id: "tx_" + Math.random().toString(36).substring(2, 11),
                    date: new Date().toISOString(),
                    type: "Income",
                    category: "Slip Payment",
                    amount: finalAmountPaid,
                    description: `Payment for slip #${slip.id.slice(0,5).toUpperCase()}`,
                    customerId: updatedSlip.customerId,
                    slipId: slip.id
                 });
             }
          }
       }
    }

    onSuccess();
  };

  return (
    <form onSubmit={handleUpdate} className="p-4 md:p-5 space-y-4">
      {/* Vehicle Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1 relative col-span-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Vehicle Number
          </label>
          <Combobox
            options={vehicles.filter(v => v.isActive !== false).map((v) => ({ label: v.vehicleNo, value: v.vehicleNo }))}
            value={formData.vehicleNo}
            allowCreate
            onChange={(val) => {
              const v = vehicles.find((vehicle) => vehicle.vehicleNo === val);
              if (v) {
                setFormData({
                  ...formData,
                  vehicleNo: v.vehicleNo.toUpperCase(),
                  driverName: v.driverName || "",
                  driverPhone: v.driverPhone || "",
                  measurementType: v.defaultMeasurementType,
                  lengthFeet: v.measurement.lengthFeet?.toString() || "",
                  widthFeet: v.measurement.widthFeet?.toString() || "",
                  heightFeet: v.measurement.heightFeet?.toString() || "",
                  tareWeight: v.measurement.tareWeight?.toString() || "",
                });
              } else {
                setFormData({
                  ...formData,
                  vehicleNo: val.toUpperCase(),
                });
              }
            }}
            placeholder="MH 14 AB 1234 or Search Vehicle..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Driver Name
          </label>
          <input
            type="text"
            value={formData.driverName}
            onChange={(e) =>
              setFormData({ ...formData, driverName: e.target.value })
            }
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Driver Phone
          </label>
          <input
            type="tel"
            value={formData.driverPhone}
            onChange={(e) =>
              setFormData({ ...formData, driverPhone: e.target.value })
            }
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      {/* Material & Measurement Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Material Type</label>
          <select
            value={formData.materialType}
            onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-zinc-900"
          >
            {(companySettings.materials || [])
            .filter(m => m.isActive !== false)
            .map((mat) => (
              <option key={mat.id} value={mat.name}>{mat.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Delivery Mode</label>
          <select
            value={formData.deliveryMode}
            onChange={(e) => setFormData({ ...formData, deliveryMode: e.target.value })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-zinc-900"
          >
            <option value="Company Vehicle">Company Vehicle</option>
            <option value="Third-Party Vehicle">Third-Party Vehicle</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Measurement</label>
          <select
            value={formData.measurementType}
            onChange={(e) => setFormData({ ...formData, measurementType: e.target.value })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-zinc-900"
          >
            <option value="Volume (Brass)">Volume (Brass)</option>
            <option value="Weight (Tonnes)">Weight (Tons)</option>
          </select>
        </div>
      </div>

      {/* Dimensions / Weights Section */}
      {formData.measurementType === "Volume (Brass)" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Length (ft)</label>
            <input type="number" min="0" step="0.01" required value={formData.lengthFeet} onChange={(e) => setFormData({ ...formData, lengthFeet: e.target.value })} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"/>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Width (ft)</label>
            <input type="number" min="0" step="0.01" required value={formData.widthFeet} onChange={(e) => setFormData({ ...formData, widthFeet: e.target.value })} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"/>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Height (ft)</label>
            <input type="number" min="0" step="0.01" required value={formData.heightFeet} onChange={(e) => setFormData({ ...formData, heightFeet: e.target.value })} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"/>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Gross Wt (Tons)</label>
            <input type="number" min="0" step="0.01" required value={formData.grossWeight} onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"/>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Tare Wt (Tons)</label>
            <input type="number" min="0" step="0.01" required value={formData.tareWeight} onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })} className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"/>
          </div>
        </div>
      )}

      {/* Customer & Rate Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Customer Name</label>
          <Combobox
            options={customers.map((c) => ({ label: c.name, value: c.id }))}
            value={formData.customerId === "CASH" ? "" : formData.customerId}
            allowCreate
            onChange={(val) => {
              setFormData({ ...formData, customerId: val });
            }}
            placeholder="Type customer name or search..."
          />
        </div>
         <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Rate / Unit (₹)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={formData.ratePerUnit}
            onChange={(e) => setFormData({ ...formData, ratePerUnit: e.target.value })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      {/* Operator & Loader Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Operator</label>
          <Combobox
            options={Array.from(new Set(slips.map(s => s.operatorName).filter(Boolean))).map(name => ({ label: name as string, value: name as string }))}
            value={formData.operatorName}
            allowCreate
            onChange={(val) => setFormData({ ...formData, operatorName: val })}
            placeholder="Generated By..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Loader</label>
           <Combobox
            options={Array.from(new Set(slips.map(s => s.loaderName).filter(Boolean))).map(name => ({ label: name as string, value: name as string }))}
            value={formData.loaderName}
            allowCreate
            onChange={(val) => setFormData({ ...formData, loaderName: val })}
            placeholder="Loader's Name..."
          />
        </div>
      </div>
      
      {/* Freight Section */}
      {freightVisible && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Freight Charge (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.freightAmount}
            onChange={(e) => setFormData({ ...formData, freightAmount: e.target.value })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
      )}

      {/* Payment Section */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Amount Paid (₹)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.amountPaid}
            onChange={(e) =>
              setFormData({ ...formData, amountPaid: e.target.value })
            }
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="0"
          />
        </div>
      </div>

      {/* Summary Section */}
      <div className="p-4 rounded-xl border-2 border-primary-500 bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-between mt-6">
        <div>
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Total Quantity
          </p>
          <p className="text-lg font-bold text-zinc-900 dark:text-white">
            {calculatedQty.toFixed(2)}{" "}
            {formData.measurementType === "Volume (Brass)" ? "Brass" : "Tonnes"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
            Final Amount
          </p>
          <div className="relative inline-block w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-lg">₹</span>
            <input
              type="number"
              min="0"
              value={manualTotalAmount}
              onChange={(e) => setManualTotalAmount(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg pl-8 pr-3 py-1.5 text-xl font-bold text-primary-600 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow text-left"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
        >
          Save Changes
        </button>
      </div>
    </form>
  )
}
