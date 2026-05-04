import React, { useState, useEffect, useRef } from "react";
import { useErp } from "../../context/ErpContext";
import { Slip, MaterialType, DeliveryMode, MeasurementType } from "../../types";
import { Plus, Truck, StickyNote } from "lucide-react";
import { Combobox } from "../ui/Combobox";
import { MobileStickyFooter } from "../ui/MobilePrimitives";
import { parseFeetInches } from "../../lib/utils";
import { useActive } from "../../hooks/useActive";
import { useToast } from "../ui/Toast";
import { useKeepAwake } from "../../lib/use-keep-awake";
import { captureDocument } from "../../lib/camera";
import { Camera } from "lucide-react";

export function EditSlipForm({ slip, onSuccess, onCancel }: { slip: Slip; onSuccess: () => void; onCancel: () => void }) {
  const { vehicles, addVehicle, updateVehicle, customers, updateSlip, slips, transactions, addTransaction, updateTransaction, deleteTransaction, companySettings, employees } = useErp();
  const activeVehicles = useActive(vehicles);
  const activeCustomers = useActive(customers);
  const activeEmployees = useActive(employees);
  const activeMaterials = useActive(companySettings.materials || []);
  const { addToast } = useToast();
  useKeepAwake();
  const creatingVehicleRef = useRef(false);

  const [formData, setFormData] = useState({
    vehicleNo: slip.vehicleNo || "",
    driverName: slip.driverName || "",
    driverPhone: slip.driverPhone || "",
    materialType: slip.materialType || companySettings.materials?.[0]?.name || "20mm",
    deliveryMode: (slip.deliveryMode || "Third-Party Vehicle") as DeliveryMode,
    measurementType: (slip.measurementType || "Volume (Brass)") as MeasurementType,
    lengthFeet: slip.measurement?.lengthFeet?.toString() || "",
    widthFeet: slip.measurement?.widthFeet?.toString() || "",
    heightFeet: slip.measurement?.heightFeet?.toString() || "",
    grossWeight: slip.measurement?.grossWeight?.toString() || "",
    tareWeight: slip.measurement?.tareWeight?.toString() || "",
    ratePerUnit: slip.ratePerUnit?.toString() || "",
    paymentStatus: ((slip.amountPaid ?? 0) === slip.totalAmount && slip.totalAmount > 0 ? "Cash (Paid)" : (slip.amountPaid ?? 0) > 0 ? "Partial" : "Credit (Unpaid)") as "Credit (Unpaid)" | "Cash (Paid)" | "Partial",
    amountPaid: slip.amountPaid?.toString() || "",
    customerId: slip.customerId || "CASH",
    notes: slip.notes || "",
    operatorName: slip.operatorName || "",
    loaderName: slip.loaderName || "",
  });

  const isExistingVehicle = !!vehicles.find((v) => v.vehicleNo === formData.vehicleNo);

  const calculateQuantity = () => {
    if (formData.measurementType === "Volume (Brass)") {
      const l = parseFeetInches(formData.lengthFeet);
      const w = parseFeetInches(formData.widthFeet);
      const h = parseFeetInches(formData.heightFeet);
      return (l * w * h) / 100;
    }
    return Math.max(0, (parseFloat(formData.grossWeight) || 0) - (parseFloat(formData.tareWeight) || 0));
  };

  const calculatedQty = calculateQuantity();
  const calculatedTotalAmount = Math.round(calculatedQty * (parseFloat(formData.ratePerUnit) || 0));

  const [manualTotalAmount, setManualTotalAmount] = useState<string>(Math.round(slip.totalAmount).toString());
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | undefined>(slip.attachmentUri);
  const [showNotes, setShowNotes] = useState(!!slip.notes);

  useEffect(() => {
    if (!hasManualOverride) setManualTotalAmount(calculatedTotalAmount.toString());
  }, [calculatedTotalAmount, hasManualOverride]);

  const finalAmount = parseFloat(manualTotalAmount) || 0;

  const autofillVehicle = (vehicleNo: string) => {
    const cleanVehicleNo = vehicleNo.startsWith("NEW:") ? vehicleNo.slice(4) : vehicleNo;
    const v = vehicles.find((vehicle) => vehicle.vehicleNo === cleanVehicleNo);
    if (v) {
      setFormData((prev) => ({
        ...prev,
        vehicleNo: v.vehicleNo,
        driverName: v.driverName || "",
        driverPhone: v.driverPhone || "",
        deliveryMode: v.defaultDeliveryMode || "Third-Party Vehicle",
        measurementType: v.defaultMeasurementType,
        lengthFeet: v.measurement.lengthFeet?.toString() || "",
        widthFeet: v.measurement.widthFeet?.toString() || "",
        heightFeet: v.measurement.heightFeet?.toString() || "",
        tareWeight: v.measurement.tareWeight?.toString() || "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, vehicleNo: cleanVehicleNo.toUpperCase() }));
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleNo || !formData.ratePerUnit) return;

    if (formData.measurementType === "Weight (Tonnes)") {
      const tare = parseFloat(formData.tareWeight) || 0;
      const gross = parseFloat(formData.grossWeight) || 0;
      if (tare < 0 || gross < 0) { addToast('error', 'Weights cannot be negative.'); return; }
      if (tare > gross) { addToast('error', 'Tare cannot be greater than Gross.'); return; }
    } else {
      const l = parseFeetInches(formData.lengthFeet);
      const w = parseFeetInches(formData.widthFeet);
      const h = parseFeetInches(formData.heightFeet);
      if (l <= 0 || w <= 0 || h <= 0) { addToast('error', 'L, W and H must be positive.'); return; }
    }

    if (calculatedQty < 0) { addToast('error', 'Quantity cannot be negative.'); return; }
    if (parseFloat(formData.ratePerUnit) < 0) { addToast('error', 'Rate cannot be negative.'); return; }

    let finalAmountPaid = 0;
    if (formData.paymentStatus === "Cash (Paid)") {
      finalAmountPaid = finalAmount;
    } else if (formData.paymentStatus === "Partial") {
      finalAmountPaid = parseFloat(formData.amountPaid) || 0;
      if (finalAmountPaid < 0) { addToast('error', 'Amount paid cannot be negative.'); return; }
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
      } else if (!creatingVehicleRef.current) {
        creatingVehicleRef.current = true;
        addVehicle({
          id: crypto.randomUUID(),
          vehicleNo: formData.vehicleNo.toUpperCase(),
          ownerName: formData.driverName || '',
          driverName: formData.driverName,
          driverPhone: formData.driverPhone,
          defaultMeasurementType: formData.measurementType,
          defaultDeliveryMode: formData.deliveryMode,
          measurement: {
            lengthFeet: parseFeetInches(formData.lengthFeet) || undefined,
            widthFeet: parseFeetInches(formData.widthFeet) || undefined,
            heightFeet: parseFeetInches(formData.heightFeet) || undefined,
            tareWeight: parseFloat(formData.tareWeight) || undefined,
          },
        });
        setTimeout(() => { creatingVehicleRef.current = false; }, 0);
      }
    }

    const updatedSlip: Slip = {
      ...slip,
      vehicleNo: formData.vehicleNo.toUpperCase(),
      driverName: formData.driverName,
      driverPhone: formData.driverPhone,
      materialType: formData.materialType as MaterialType,
      deliveryMode: formData.deliveryMode as DeliveryMode,
      measurementType: formData.measurementType as MeasurementType,
      measurement: {
        lengthFeet: parseFeetInches(formData.lengthFeet) || undefined,
        widthFeet: parseFeetInches(formData.widthFeet) || undefined,
        heightFeet: parseFeetInches(formData.heightFeet) || undefined,
        grossWeight: parseFloat(formData.grossWeight) || undefined,
        tareWeight: parseFloat(formData.tareWeight) || undefined,
      },
      quantity: Math.round(calculatedQty * 100) / 100,
      ratePerUnit: parseFloat(formData.ratePerUnit) || 0,
      totalAmount: finalAmount,
      amountPaid: finalAmountPaid,
      customerId: formData.customerId,
      notes: formData.notes,
      operatorName: formData.operatorName || undefined,
      loaderName: formData.loaderName || undefined,
      attachmentUri: attachmentUri || undefined,
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
              id: "tx_" + crypto.randomUUID(),
              date: new Date().toISOString(),
              type: "Income",
              category: "Slip Payment",
              amount: finalAmountPaid,
              description: `Payment for slip #${slip.id.slice(0, 5).toUpperCase()}`,
              customerId: updatedSlip.customerId,
              slipId: slip.id
            });
          }
        }
      }
    }

    onSuccess();
  };

  // ── Shared design tokens ───────────────────────────────────────────────────
  const inp = [
    "w-full h-8 rounded-lg border border-zinc-200 dark:border-zinc-700",
    "bg-zinc-50 dark:bg-zinc-800 px-2.5 text-xs",
    "text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500",
    "focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors",
  ].join(" ");

  const lbl = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-0.5 block";

  // Segmented pill toggle
  const seg = "flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-0.5 gap-0.5 h-8";
  const segBtn = (active: boolean, onClick: () => void, label: string) => (
    <button key={label} type="button" onClick={onClick}
      className={[
        "flex-1 rounded-md text-[10px] font-semibold transition-colors",
        active ? "bg-primary-600 text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200",
      ].join(" ")}>
      {label}
    </button>
  );

  return (
    <form onSubmit={handleUpdate} className="p-3 pb-20 md:pb-4 space-y-2.5">

      {/* ── Row 1: Vehicle No (left) | Delivery Mode (right) ──────────── */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1">
              <Truck className="w-3 h-3 text-zinc-500" />
              <label className={lbl + " mb-0"}>Vehicle No *</label>
            </div>
          </div>
          <Combobox
            options={activeVehicles.map(v => ({ label: v.vehicleNo, value: v.vehicleNo }))}
            value={formData.vehicleNo} allowCreate onChange={autofillVehicle} placeholder="Vehicle No"
          />
        </div>

        <div>
          <label className={lbl}>Delivery Mode</label>
          {isExistingVehicle ? (
            <div className={inp + " flex items-center text-zinc-600 dark:text-zinc-300"}>
              {formData.deliveryMode === "Company Vehicle" ? "Company Vehicle" : "Third-Party Vehicle"}
            </div>
          ) : (
            <div className={seg}>
              {segBtn(formData.deliveryMode === "Company Vehicle", () => setFormData({ ...formData, deliveryMode: "Company Vehicle" }), "Company")}
              {segBtn(formData.deliveryMode === "Third-Party Vehicle", () => setFormData({ ...formData, deliveryMode: "Third-Party Vehicle" }), "Third Party")}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Driver Name (left) | Measurement toggle (right) ───── */}
      <div className="grid grid-cols-2 gap-x-3">
        <div>
          <label className={lbl}>Driver Name</label>
          <input type="text" value={formData.driverName}
            onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
            className={inp} placeholder="Driver name" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className={lbl + " mb-0"}>Measurement</label>
          </div>
          <div className={seg}>
            {segBtn(formData.measurementType === "Volume (Brass)", () => setFormData({ ...formData, measurementType: "Volume (Brass)" }), "Brass")}
            {segBtn(formData.measurementType === "Weight (Tonnes)", () => setFormData({ ...formData, measurementType: "Weight (Tonnes)" }), "Weight")}
          </div>
        </div>
      </div>

      {/* ── Row 3: Driver Phone (left) | L W H / Tare+Gross (right) ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 items-end">
        <div>
          <label className={lbl}>Driver Phone</label>
          <input type="tel" value={formData.driverPhone}
            onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
            className={inp} placeholder="Phone" />
        </div>

        {formData.measurementType === "Volume (Brass)" ? (
          <div>
            <div className="grid grid-cols-3 gap-1">
              {(["lengthFeet", "widthFeet", "heightFeet"] as const).map((field, i) => (
                <div key={field}>
                  <label className={lbl + " text-center"}>{["L", "W", "H"][i]}</label>
                  <input required type="number" step="0.01" value={formData[field]}
                    onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                    className={inp + " text-center px-1"} placeholder="0" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className={lbl}>Tare (T)</label>
              <input required type="number" step="0.01" value={formData.tareWeight}
                onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })}
                className={inp} placeholder="0" />
            </div>
            <div>
              <label className={lbl}>Gross (T)</label>
              <input required type="number" step="0.01" value={formData.grossWeight}
                onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                className={inp} placeholder="0" />
            </div>
          </div>
        )}
      </div>

      {/* Qty display — right-aligned under the dimension inputs */}
      <div className="flex justify-end -mt-1.5">
        <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">
          {calculatedQty.toFixed(2)} {formData.measurementType === "Volume (Brass)" ? "Brass" : "T"}
        </span>
      </div>

      {/* ── Row 4: Customer (full width) ─────────────────────────────── */}
      <div>
        <label className={lbl}>Customer</label>
        <Combobox
          options={[{ label: "Cash Sale", value: "CASH" }, ...activeCustomers.map(c => ({ label: c.name, value: c.id }))]}
          value={formData.customerId} allowCreate
          onChange={(val) => setFormData({ ...formData, customerId: val || "" })}
          placeholder="Select customer" mobileTitle="Select Customer"
        />
      </div>

      {/* ── Row 5: Material (left) | Rate (right) ────────────────────── */}
      <div className="grid grid-cols-2 gap-x-3">
        <div>
          <label className={lbl}>Material *</label>
          <Combobox
            options={activeMaterials.map(mat => ({ label: mat.name, value: mat.name }))}
            value={formData.materialType}
            onChange={(val) => setFormData({ ...formData, materialType: val as MaterialType })}
            placeholder="Material" mobileTitle="Select Material"
          />
        </div>
        <div>
          <label className={lbl}>Rate ₹ *</label>
          <input required type="number" step="0.01" value={formData.ratePerUnit}
            onChange={(e) => setFormData({ ...formData, ratePerUnit: e.target.value })}
            className={inp} placeholder="0" />
        </div>
      </div>

      {/* ── Row 6: Operator (left) | Loader (right) ──────────────────── */}
      <div className="grid grid-cols-2 gap-x-3">
        <div>
          <label className={lbl}>Operator</label>
          <Combobox
            options={Array.from(new Set(slips.map(s => s.operatorName).filter(Boolean))).map(name => ({ label: name as string, value: name as string }))}
            value={formData.operatorName}
            allowCreate
            onChange={(val) => setFormData({ ...formData, operatorName: val })}
            placeholder="Operator name"
          />
        </div>
        <div>
          <label className={lbl}>Loader</label>
          <Combobox
            options={employees
              .filter((e) => /loader/i.test(e.role || ""))
              .map((e) => ({ label: e.name, value: e.name }))}
            value={formData.loaderName}
            onChange={(val) => setFormData({ ...formData, loaderName: val })}
            placeholder="Loader name"
            mobileTitle="Select Loader"
          />
        </div>
      </div>

      {/* ── Row 7: Challan Photo (left) | Notes toggle (right) ───────── */}
      <div className="grid grid-cols-2 gap-x-3">
        <div>
          <label className={lbl}>Challan Photo</label>
          {attachmentUri ? (
            <div className="relative h-8">
              <img src={attachmentUri} alt="Challan"
                className="w-full h-8 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700" />
              <button type="button" onClick={() => setAttachmentUri(undefined)}
                className="absolute top-0 right-0 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"
                aria-label="Remove">×</button>
            </div>
          ) : (
            <button type="button"
              onClick={async () => { try { const r = await captureDocument(); if (r) setAttachmentUri(r.uri); } catch { addToast('error', 'Camera failed.'); } }}
              className="w-full h-8 flex items-center justify-center gap-1 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-[10px] text-zinc-500 hover:border-primary-500 hover:text-primary-500 transition-colors">
              <Camera className="w-3 h-3" />Attach
            </button>
          )}
        </div>
        <div className="flex items-end justify-end">
          {!showNotes ? (
            <button type="button" onClick={() => setShowNotes(true)}
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-primary-500 transition-colors">
              <StickyNote className="w-3 h-3" />Add Note
            </button>
          ) : (
            <div className="w-full">
              <div className="flex items-center justify-between mb-0.5">
                <label className={lbl}>Notes</label>
                <button type="button"
                  onClick={() => { setShowNotes(false); setFormData({ ...formData, notes: "" }); }}
                  className="text-[9px] text-zinc-400 hover:text-rose-500 transition-colors">
                  Remove
                </button>
              </div>
              <textarea autoFocus rows={2} value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full resize-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="Optional remarks"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Row 8: Payment toggle (full width) ───────────────────────── */}
      <div>
        <label className={lbl}>Payment</label>
        <div className={seg + " h-8"}>
          {(["Cash (Paid)", "Credit (Unpaid)", "Partial"] as const).map((s) =>
            segBtn(formData.paymentStatus === s, () => setFormData({ ...formData, paymentStatus: s, amountPaid: "" }), s.split(" ")[0])
          )}
        </div>
      </div>

      {/* ── Row 9: Total ₹ (left) | Save Changes (right) ─────────────── */}
      <div className="grid grid-cols-2 gap-x-3 items-end">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className={lbl + " mb-0"}>Total ₹</label>
            {hasManualOverride && (
              <button type="button"
                onClick={() => { setHasManualOverride(false); setManualTotalAmount(calculatedTotalAmount.toString()); }}
                className="text-[9px] text-primary-600 hover:underline">
                Reset
              </button>
            )}
          </div>
          <input type="number" step="1" value={manualTotalAmount}
            onChange={(e) => { setHasManualOverride(true); setManualTotalAmount(e.target.value); }}
            className={[
              "w-full h-8 rounded-lg border-2 border-primary-500 px-2.5 text-xs font-bold",
              "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300",
              "focus:outline-none focus:border-primary-400 transition-colors",
            ].join(" ")}
          />
          {hasManualOverride && (
            <div className="text-[9px] text-zinc-500 mt-0.5">Auto: ₹{calculatedTotalAmount.toLocaleString()}</div>
          )}
          {formData.paymentStatus === "Partial" && (
            <div className="mt-2">
              <label className={lbl}>Paid ₹</label>
              <input required type="number" step="0.01" value={formData.amountPaid}
                onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                className={inp} placeholder="0" />
            </div>
          )}
        </div>

        <div className="hidden md:flex items-end gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 h-8 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-white text-xs font-bold rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 active:scale-95 transition-all flex items-center justify-center">
            Cancel
          </button>
          <button type="submit"
            className="flex-1 h-8 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />Save
          </button>
        </div>
      </div>

      {/* ── Mobile sticky footer: qty summary + quick-submit ─────────── */}
      <MobileStickyFooter>
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Total · Qty</div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              ₹{finalAmount.toLocaleString()}
              <span className="text-xs font-normal text-zinc-500 ml-1">
                · {calculatedQty.toFixed(2)} {formData.measurementType === "Volume (Brass)" ? "Brass" : "T"}
              </span>
            </div>
          </div>
          <button type="button" onClick={onCancel}
            className="min-h-11 rounded-xl bg-zinc-200 dark:bg-zinc-700 px-4 text-sm font-bold text-zinc-800 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600 active:scale-95 transition-all whitespace-nowrap">
            Cancel
          </button>
          <button type="submit"
            className="min-h-11 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 active:scale-95 transition-all whitespace-nowrap">
            Save
          </button>
        </div>
      </MobileStickyFooter>
    </form>
  );
}
