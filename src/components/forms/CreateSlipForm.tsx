import React, { useState, useEffect } from "react";
import { useErp } from "../../context/ErpContext";
import { MaterialType, DeliveryMode, MeasurementType, Slip } from "../../types";
import { Plus, Truck } from "lucide-react";
import { Combobox } from "../ui/Combobox";
import { parseFeetInches } from "../../lib/utils";
import { useToast } from "../ui/Toast";
import { useKeepAwake } from "../../lib/use-keep-awake";
import { captureDocument } from "../../lib/camera";
import { scanBarcode } from "../../lib/barcode";
import { scanNfcVehicleTag, isNfcAvailable } from "../../lib/nfc";
import { Camera, QrCode, Nfc } from "lucide-react";
import { isNative } from "../../lib/capacitor";

export function CreateSlipForm({ onSuccess }: { onSuccess: (slip?: Slip) => void }) {
  const { vehicles, customers, addSlip, slips, companySettings, addVehicle, updateVehicle, addCustomer, addTransaction } = useErp();
  const { addToast } = useToast();
  // Keep the screen on while the operator is filling in the slip form at the weigh-bridge
  useKeepAwake();
  
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
    operatorName: (() => { try { return localStorage.getItem('lastOperatorName') || ""; } catch { return ""; } })(),
    loaderName: (() => { try { return localStorage.getItem('lastLoaderName') || ""; } catch { return ""; } })(),
  });

  useEffect(() => {
    if (!formData.customerId || !formData.materialType) return;

    const defaultRates: Record<string, number> = Object.fromEntries(
      (companySettings.materials || []).map((m) => [m.name, m.defaultPrice || 0])
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
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | undefined>(undefined);
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);

  useEffect(() => {
    isNfcAvailable().then(setNfcAvailable);
  }, []);

  // Only sync the calculated total back into the field when the user has not
  // manually overridden it. This prevents dimension/rate changes from silently
  // discarding a value the user typed.
  useEffect(() => {
    if (!hasManualOverride) {
      setManualTotalAmount(calculatedTotalAmount.toString());
    }
  }, [calculatedTotalAmount, hasManualOverride]);

  const finalAmount = parseFloat(manualTotalAmount) || 0;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.measurementType === "Weight (Tonnes)") {
      const tare = parseFloat(formData.tareWeight) || 0;
      const gross = parseFloat(formData.grossWeight) || 0;
      if (tare < 0 || gross < 0) {
        addToast('error', 'Weights cannot be negative.');
        return;
      }
      if (tare > gross) {
        addToast('error', 'Tare Weight cannot be greater than Gross Weight.');
        return;
      }
    } else if (formData.measurementType === "Volume (Brass)") {
      const l = parseFeetInches(formData.lengthFeet);
      const w = parseFeetInches(formData.widthFeet);
      const h = parseFeetInches(formData.heightFeet);
      if (l <= 0 || w <= 0 || h <= 0) {
        addToast('error', 'Length, width, and height must be positive values.');
        return;
      }
    }

    if (calculatedQty < 0) {
      addToast('error', 'Calculated quantity cannot be negative.');
      return;
    }

    if (parseFloat(formData.ratePerUnit) < 0) {
      addToast('error', 'Rate per unit cannot be negative.');
      return;
    }

    const freightAmt = parseFloat(formData.freightAmount) || 0;
    if (freightVisible && freightAmt < 0) {
      addToast('error', 'Freight amount cannot be negative.');
      return;
    }

    let finalAmountPaid = 0;
    if (formData.paymentStatus === "Cash (Paid)") {
      finalAmountPaid = finalAmount;
    } else if (formData.paymentStatus === "Partial") {
      finalAmountPaid = parseFloat(formData.amountPaid) || 0;
      if (finalAmountPaid < 0) {
        addToast('error', 'Amount paid cannot be negative.');
        return;
      }
    }

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
         let newVehicleId = crypto.randomUUID();
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
        id: "cust_" + crypto.randomUUID(),
        name: finalCustomerId,
        phone: "",
        openingBalance: 0
      };
      addCustomer(newCust);
      finalCustomerId = newCust.id;
    }

    const newSlip: Slip = {
      id: crypto.randomUUID(),
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
      attachmentUri: attachmentUri || undefined,
    };
    addSlip(newSlip);

    if (finalAmountPaid > 0) {
       addTransaction({
           id: "tx_" + crypto.randomUUID(),
           date: new Date().toISOString(),
           type: "Income",
           category: "Slip Payment",
           amount: finalAmountPaid,
           description: `Initial payment for slip #${newSlip.id.slice(0,5).toUpperCase()}`,
           customerId: finalCustomerId,
           slipId: newSlip.id
       });
    }

    try {
      if (formData.operatorName) localStorage.setItem('lastOperatorName', formData.operatorName);
      if (formData.loaderName) localStorage.setItem('lastLoaderName', formData.loaderName);
    } catch { /* localStorage unavailable — not critical */ }

    onSuccess(newSlip);
  };

return (
    <form onSubmit={handleCreate} className="space-y-1.5 p-1.5 -mx-1">
      {/* Vehicle Details - Always Visible */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-2 space-y-1.5">
        <div className="flex items-center gap-2 mb-0.5">
          <Truck className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-semibold text-xs text-zinc-900 dark:text-white">Vehicle</span>
        </div>
        
        <div className="grid grid-cols-1 gap-1.5">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Vehicle *</label>
              <div className="flex items-center gap-2">
                {isNative() && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const value = await scanBarcode();
                        if (!value) return;
                        const scanned = value.toUpperCase();
                        const v = vehicles.find((vehicle) => vehicle.vehicleNo === scanned);
                        if (v) {
                          setFormData({
                            ...formData,
                            vehicleNo: v.vehicleNo,
                            driverName: v.driverName || "",
                            driverPhone: v.driverPhone || "",
                            measurementType: v.defaultMeasurementType,
                            lengthFeet: v.measurement.lengthFeet?.toString() || "",
                            widthFeet: v.measurement.widthFeet?.toString() || "",
                            heightFeet: v.measurement.heightFeet?.toString() || "",
                            tareWeight: v.measurement.tareWeight?.toString() || "",
                          });
                        } else {
                          setFormData({ ...formData, vehicleNo: scanned });
                        }
                      } catch {
                        addToast('error', 'Barcode scan failed. Check camera permissions.');
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] text-primary-600 dark:text-primary-400 font-medium"
                    aria-label="Scan vehicle QR code"
                  >
                    <QrCode className="w-3 h-3" />
                    Scan QR
                  </button>
                )}
                {nfcAvailable && (
                  <button
                    type="button"
                    disabled={nfcScanning}
                    onClick={async () => {
                      setNfcScanning(true);
                      try {
                        const vehicleNo = await scanNfcVehicleTag();
                        if (!vehicleNo) {
                          addToast('error', 'No NFC tag detected. Try again.');
                          return;
                        }
                        const v = vehicles.find((vehicle) => vehicle.vehicleNo === vehicleNo);
                        if (v) {
                          setFormData({
                            ...formData,
                            vehicleNo: v.vehicleNo,
                            driverName: v.driverName || "",
                            driverPhone: v.driverPhone || "",
                            measurementType: v.defaultMeasurementType,
                            lengthFeet: v.measurement.lengthFeet?.toString() || "",
                            widthFeet: v.measurement.widthFeet?.toString() || "",
                            heightFeet: v.measurement.heightFeet?.toString() || "",
                            tareWeight: v.measurement.tareWeight?.toString() || "",
                          });
                        } else {
                          setFormData({ ...formData, vehicleNo });
                        }
                      } catch {
                        addToast('error', 'NFC scan failed.');
                      } finally {
                        setNfcScanning(false);
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium disabled:opacity-50"
                    aria-label="Tap NFC tag to identify vehicle"
                  >
                    <Nfc className="w-3 h-3" />
                    {nfcScanning ? 'Scanning…' : 'Tap NFC'}
                  </button>
                )}
              </div>
            </div>
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
                  setFormData({ ...formData, vehicleNo: val.toUpperCase() });
                }
              }}
              placeholder="Vehicle No"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Driver</label>
            <input
              type="text"
              value={formData.driverName}
              onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
              placeholder="Driver"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Phone</label>
            <input
              type="tel"
              value={formData.driverPhone}
              onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
              placeholder="Phone"
            />
          </div>
        </div>
      </div>

      {/* Material & Rate - Always Visible */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-2 space-y-1.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px]">📦</span>
          <span className="font-semibold text-xs text-zinc-900 dark:text-white">Material</span>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Material *</label>
            <select
              value={formData.materialType}
              onChange={(e) => setFormData({ ...formData, materialType: e.target.value as MaterialType })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
            >
              {(companySettings.materials || []).filter(m => m.isActive !== false).map((mat) => (
                <option key={mat.id} value={mat.name}>{mat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Rate ₹ *</label>
            <input
              required
              type="number"
              step="0.01"
              value={formData.ratePerUnit}
              onChange={(e) => setFormData({ ...formData, ratePerUnit: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
              placeholder="Rate"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Delivery Mode</label>
          <div className="flex border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden">
            {(["Company Vehicle", "Third-Party Vehicle"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFormData({ ...formData, deliveryMode: mode })}
                className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
                  formData.deliveryMode === mode ? "bg-primary-500 text-white" : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {mode === "Company Vehicle" ? "Company" : "Third Party"}
              </button>
            ))}
          </div>
        </div>

        {freightVisible && (
          <div>
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Freight ₹</label>
            <input
              type="number"
              step="0.01"
              value={formData.freightAmount}
              onChange={(e) => setFormData({ ...formData, freightAmount: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
              placeholder="Freight"
            />
          </div>
        )}
      </div>

      {/* Measurement - Always Visible */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-2 space-y-1.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px]">📏</span>
          <span className="font-semibold text-xs text-zinc-900 dark:text-white">Measurement</span>
        </div>
        
        <div>
          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Type</label>
          <div className="flex border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden">
            {(["Volume (Brass)", "Weight (Tonnes)"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFormData({ ...formData, measurementType: mode })}
                className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
                  formData.measurementType === mode ? "bg-indigo-500 text-white" : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {mode === "Volume (Brass)" ? "Brass" : "Weight"}
              </button>
            ))}
          </div>
        </div>

        {formData.measurementType === "Volume (Brass)" ? (
          <div className="grid grid-cols-3 gap-1">
            <div>
              <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">L</label>
              <input
                required
                type="number"
                step="0.01"
                value={formData.lengthFeet}
                onChange={(e) => setFormData({ ...formData, lengthFeet: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1 py-0.5 text-xs text-center"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">W</label>
              <input
                required
                type="number"
                step="0.01"
                value={formData.widthFeet}
                onChange={(e) => setFormData({ ...formData, widthFeet: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1 py-0.5 text-xs text-center"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">H</label>
              <input
                required
                type="number"
                step="0.01"
                value={formData.heightFeet}
                onChange={(e) => setFormData({ ...formData, heightFeet: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1 py-0.5 text-xs text-center"
                placeholder="0"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Tare (T)</label>
              <input
                required
                type="number"
                step="0.01"
                value={formData.tareWeight}
                onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
                placeholder="Tare"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Gross (T)</label>
              <input
                required
                type="number"
                step="0.01"
                value={formData.grossWeight}
                onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
                placeholder="Gross"
              />
            </div>
          </div>
        )}
        <div className="text-[10px] text-zinc-500 text-center py-0.5">
          {formData.measurementType === "Volume (Brass)" 
            ? `Qty: ${calculatedQty.toFixed(2)} Brass` 
            : `Qty: ${calculatedQty.toFixed(2)} Tonnes`}
        </div>
      </div>

      {/* Customer - Always Visible */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-2 space-y-1.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px]">👤</span>
          <span className="font-semibold text-xs text-zinc-900 dark:text-white">Customer</span>
        </div>
        
        <div>
          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Customer</label>
          <Combobox
            options={customers.filter(c => c.isActive !== false).map((c) => ({ label: c.name, value: c.id }))}
            value={formData.customerId === "CASH" ? "" : formData.customerId}
            allowCreate
            onChange={(val) => setFormData({ ...formData, customerId: val || "CASH" })}
            placeholder="Select customer"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Operator</label>
            <input
              type="text"
              value={formData.operatorName}
              onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
              placeholder="Operator"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Loader</label>
            <input
              type="text"
              value={formData.loaderName}
              onChange={(e) => setFormData({ ...formData, loaderName: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
              placeholder="Loader"
            />
          </div>
        </div>

        {/* Document attachment — camera capture for challan scan */}
        <div>
          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Challan Photo</label>
          {attachmentUri ? (
            <div className="relative">
              <img
                src={attachmentUri}
                alt="Attached challan"
                className="w-full h-24 object-cover rounded border border-zinc-200 dark:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => setAttachmentUri(undefined)}
                className="absolute top-1 right-1 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold leading-none"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  const result = await captureDocument();
                  if (result) setAttachmentUri(result.uri);
                } catch {
                  addToast('error', 'Camera access failed. Check app permissions.');
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-zinc-300 dark:border-zinc-600 rounded text-[10px] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              Attach Challan
            </button>
          )}
        </div>
      </div>

      {/* Payment - Always Visible */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-2 space-y-1.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px]">💳</span>
          <span className="font-semibold text-xs text-zinc-900 dark:text-white">Payment</span>
        </div>
        
        <div>
          <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 block">Status</label>
          <div className="flex gap-1">
            {["Cash (Paid)", "Credit (Unpaid)", "Partial"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFormData({ ...formData, paymentStatus: status as "Cash (Paid)" | "Credit (Unpaid)" | "Partial", amountPaid: "" })}
                className={`flex-1 py-1 px-1 text-[10px] font-semibold rounded border transition-colors ${
                  formData.paymentStatus === status
                    ? "bg-primary-500 text-white border-primary-500"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {status.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Total ₹</label>
            {hasManualOverride && (
              <button
                type="button"
                onClick={() => { setHasManualOverride(false); setManualTotalAmount(calculatedTotalAmount.toString()); }}
                className="text-[9px] text-primary-600 dark:text-primary-400 hover:underline"
              >
                Reset to auto
              </button>
            )}
          </div>
          <input
            type="number"
            step="1"
            value={manualTotalAmount}
            onChange={(e) => { setHasManualOverride(true); setManualTotalAmount(e.target.value); }}
            className="w-full border-2 border-primary-300 dark:border-primary-600 rounded px-1.5 py-1 text-xs font-bold bg-primary-50 dark:bg-primary-900/20"
          />
          <div className="text-[9px] text-zinc-500 mt-0.5">
            Auto: ₹{calculatedTotalAmount.toLocaleString()}
          </div>
        </div>
        
        {formData.paymentStatus === "Partial" && (
          <div>
            <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5 block">Paid ₹</label>
            <input
              required
              type="number"
              step="0.01"
              value={formData.amountPaid}
              onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 text-xs"
              placeholder="Paid"
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2 bg-primary-600 text-white font-bold rounded-lg shadow hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Generate Slip</span>
        </button>
      </div>
    </form>
  );
}
