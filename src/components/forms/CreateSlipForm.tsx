import React, { useState, useEffect } from "react";
import { useErp } from "../../context/ErpContext";
import { MaterialType, DeliveryMode, MeasurementType, Slip } from "../../types";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { Combobox } from "../ui/Combobox";
import { parseFeetInches } from "../../lib/utils";

export function CreateSlipForm({ onSuccess }: { onSuccess: (slip?: Slip) => void }) {
  const { vehicles, customers, addSlip, slips, companySettings, addVehicle, updateVehicle, addCustomer, addTransaction } = useErp();
  const [formData, setFormData] = useState({
    vehicleNo: "",
    driverName: "",
    driverPhone: "",
    materialType: companySettings.materials?.[0]?.name || "20mm",
    deliveryMode: "Third-Party Vehicle" as DeliveryMode,
    measurementType: "Volume (Brass)" as MeasurementType,
    lengthFeet: "",
    widthFeet: "",
    heightFeet: "",
    grossWeight: "",
    tareWeight: "",
    ratePerUnit: "",
    freightAmount: "",
    paymentStatus: "Cash (Paid)" as "Credit (Unpaid)" | "Cash (Paid)" | "Partial",
    amountPaid: "",
    customerId: "CASH",
    notes: "",
    operatorName: localStorage.getItem('lastOperatorName') || "",
    loaderName: localStorage.getItem('lastLoaderName') || "",
  });

  useEffect(() => {
    if (!formData.customerId || !formData.materialType) return;

    const defaultRates: Record<string, number> = Object.fromEntries(
      (companySettings.materials || []).map((m) => [m.name, m.defaultPrice || 0]),
    );

    const customerSlips = slips
      .filter((s) => s.customerId === formData.customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let historicalRate = 0;
    for (const s of customerSlips) {
      if (s.materialType === formData.materialType) {
        historicalRate = s.ratePerUnit;
        break;
      }
    }

    if (historicalRate > 0) {
      setFormData((prev) => ({ ...prev, ratePerUnit: historicalRate.toString() }));
    } else {
      const defaultRate = defaultRates[formData.materialType];
      if (defaultRate) {
        setFormData((prev) => ({ ...prev, ratePerUnit: defaultRate.toString() }));
      }
    }
  }, [formData.customerId, formData.materialType, slips, companySettings.materials]);

  const [vehicleSearch, setVehicleSearch] = useState("");
  // parseFeetInches imported from ../../lib/utils

  const calculateQuantity = () => {
    if (formData.measurementType === "Volume (Brass)") {
      const l = parseFeetInches(formData.lengthFeet);
      const w = parseFeetInches(formData.widthFeet);
      const h = parseFeetInches(formData.heightFeet);
      return (l * w * h) / 100;
    } else {
      const gross = parseFloat(formData.grossWeight) || 0;
      const tare = parseFloat(formData.tareWeight) || 0;
      return Math.max(0, gross - tare);
    }
  };

  const calculatedQty = calculateQuantity();
  const freightVisible = formData.deliveryMode === "Third-Party Vehicle" && formData.customerId !== "CASH";
  const appliedFreight = freightVisible ? (parseFloat(formData.freightAmount) || 0) : 0;
  
  const calculatedTotalAmount = Math.round(
    calculatedQty * (parseFloat(formData.ratePerUnit) || 0) + appliedFreight
  );

  const [manualTotalAmount, setManualTotalAmount] = useState<string>(calculatedTotalAmount.toString());

  // Sync the editable total whenever the calculated value changes due to
  // dimension / rate / freight changes. useEffect avoids setState-during-render.
  useEffect(() => {
    setManualTotalAmount(calculatedTotalAmount.toString());
  }, [calculatedTotalAmount]);

  const finalAmount = parseFloat(manualTotalAmount) || 0;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

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

    let finalAmountPaid = 0;
    if (formData.paymentStatus === "Cash (Paid)") {
      finalAmountPaid = finalAmount;
    } else if (formData.paymentStatus === "Partial") {
      finalAmountPaid = parseFloat(formData.amountPaid) || 0;
      if (finalAmountPaid < 0) {
        alert("Amount paid cannot be negative.");
        return;
      }
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
         let newVehicleId = Math.random().toString(36).substring(2, 11);
         addVehicle({
            id: newVehicleId,
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

    let finalCustomerId = formData.customerId || "CASH";
    if (finalCustomerId !== "CASH" && !customers.find(c => c.id === finalCustomerId)) {
      const newCust = {
        id: "cust_" + Math.random().toString(36).substring(2, 11),
        name: finalCustomerId, // The combobox passed the new name directly
        phone: "",
        openingBalance: 0
      };
      addCustomer(newCust);
      finalCustomerId = newCust.id;
    }

    const newSlip: Slip = {
      id: Math.random().toString(36).substring(2, 11),
      date: new Date().toISOString(),
      vehicleNo: formData.vehicleNo.toUpperCase(),
      driverName: formData.driverName,
      driverPhone: formData.driverPhone,
      materialType: formData.materialType,
      deliveryMode: formData.deliveryMode,
      measurementType: formData.measurementType,
      measurement: {
        lengthFeet: parseFloat(formData.lengthFeet) || undefined,
        widthFeet: parseFloat(formData.widthFeet) || undefined,
        heightFeet: parseFloat(formData.heightFeet) || undefined,
        grossWeight: parseFloat(formData.grossWeight) || undefined,
        tareWeight: parseFloat(formData.tareWeight) || undefined,
      },
      quantity: Math.round(calculatedQty * 100) / 100,
      ratePerUnit: parseFloat(formData.ratePerUnit) || 0,
      freightAmount: appliedFreight,
      totalAmount: finalAmount,
      amountPaid: finalAmountPaid,
      customerId: finalCustomerId,
      status: "Pending",
      notes: formData.notes,
      operatorName: formData.operatorName || undefined,
      loaderName: formData.loaderName || undefined,
    };
    addSlip(newSlip);

    if (finalAmountPaid > 0) {
       addTransaction({
           id: "tx_" + Math.random().toString(36).substring(2, 11),
           date: new Date().toISOString(),
           type: "Income",
           category: "Slip Payment",
           amount: finalAmountPaid,
           description: `Initial payment for slip #${newSlip.id.slice(0,5).toUpperCase()}`,
           customerId: finalCustomerId,
           slipId: newSlip.id
       });
    }

    // Save defaults
    if (formData.operatorName) localStorage.setItem('lastOperatorName', formData.operatorName);
    if (formData.loaderName) localStorage.setItem('lastLoaderName', formData.loaderName);

    onSuccess(newSlip);
  };

  return (
    <form onSubmit={handleCreate} className="p-3 md:p-5 space-y-4">
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
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
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
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Delivery Mode
        </label>
        <div className="flex border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden">
          {(["Company Vehicle", "Third-Party Vehicle"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFormData({ ...formData, deliveryMode: mode })}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                formData.deliveryMode === mode
                  ? "bg-primary-50 text-primary-700"
                  : "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              } ${mode === "Third-Party Vehicle" ? "border-l border-zinc-300 dark:border-zinc-600" : ""}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Material Type
        </label>
        <select
          value={formData.materialType}
          onChange={(e) =>
            setFormData({
              ...formData,
              materialType: e.target.value as MaterialType,
            })
          }
          className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          {(companySettings.materials || [])
            .filter(m => m.isActive !== false)
            .map((mat) => (
              <option key={mat.id} value={mat.name}>{mat.name}</option>
            ))}
        </select>
      </div>

      <div className="space-y-4">
        <div className="flex border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden">
          {(["Volume (Brass)", "Weight (Tonnes)"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                setFormData({ ...formData, measurementType: mode })
              }
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                formData.measurementType === mode
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              } ${mode === "Weight (Tonnes)" ? "border-l border-zinc-300 dark:border-zinc-600" : ""}`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl space-y-4 border border-zinc-100 dark:border-zinc-700">
          {formData.measurementType === "Volume (Brass)" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Length (ft)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.lengthFeet}
                  onChange={(e) =>
                    setFormData({ ...formData, lengthFeet: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Width (ft)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.widthFeet}
                  onChange={(e) =>
                    setFormData({ ...formData, widthFeet: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Height (ft)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.heightFeet}
                  onChange={(e) =>
                    setFormData({ ...formData, heightFeet: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Tare Weight (T)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tareWeight}
                  onChange={(e) =>
                    setFormData({ ...formData, tareWeight: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Gross Weight (T)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.grossWeight}
                  onChange={(e) =>
                    setFormData({ ...formData, grossWeight: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Customer Name
          </label>
          <Combobox
            options={customers.filter(c => c.isActive !== false).map((c) => ({ label: c.name, value: c.id }))}
            value={formData.customerId === "CASH" ? "" : formData.customerId}
            allowCreate
            onChange={(val) => {
              setFormData(prev => ({ 
                ...prev, 
                customerId: val,
              }));
            }}
            placeholder="Type customer name or search..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Rate / Unit (₹)
          </label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={formData.ratePerUnit}
            onChange={(e) =>
              setFormData({ ...formData, ratePerUnit: e.target.value })
            }
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>

      {formData.deliveryMode === "Third-Party Vehicle" && formData.customerId !== "CASH" && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Freight Charges (₹)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.freightAmount}
            onChange={(e) =>
              setFormData({ ...formData, freightAmount: e.target.value })
            }
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="Enter freight amount (if applicable)"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Operator / Author Name
          </label>
          <Combobox
            options={Array.from(new Set(slips.map(s => s.operatorName).filter(Boolean))).map(name => ({ label: name as string, value: name as string }))}
            value={formData.operatorName}
            allowCreate
            onChange={(val) =>
              setFormData({ ...formData, operatorName: val })
            }
            placeholder="Generated By..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Loader Name
          </label>
          <Combobox
            options={Array.from(new Set(slips.map(s => s.loaderName).filter(Boolean))).map(name => ({ label: name as string, value: name as string }))}
            value={formData.loaderName}
            allowCreate
            onChange={(val) =>
              setFormData({ ...formData, loaderName: val })
            }
            placeholder="Loader's Name..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Payment Status
          </label>
          <div className="flex gap-2">
            {["Cash (Paid)", "Credit (Unpaid)", "Partial"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFormData({ ...formData, paymentStatus: status as "Cash (Paid)" | "Credit (Unpaid)" | "Partial", amountPaid: "" })}
                className={`flex-1 py-2 px-2 text-sm font-semibold rounded-lg border transition-colors ${
                  formData.paymentStatus === status
                    ? "bg-primary-500 text-white border-primary-500 shadow-sm"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {status.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {formData.paymentStatus === "Partial" && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Amount Paid (₹)
            </label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              max={manualTotalAmount}
              value={formData.amountPaid}
              onChange={(e) =>
                setFormData({ ...formData, amountPaid: e.target.value })
              }
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Enter partial amount"
            />
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl border-2 border-primary-500 bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-between">
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

      <button
        type="submit"
        className="w-full py-3 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl transition-colors shadow-md flex items-center justify-center text-lg"
      >
        <Plus className="w-6 h-6 mr-2" />
        Generate Dispatch Slip
      </button>
    </form>
  );
}
