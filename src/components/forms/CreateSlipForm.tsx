import React, { useState, useEffect } from "react";
import { useErp } from "../../context/ErpContext";
import { MaterialType, DeliveryMode, MeasurementType, Slip } from "../../types";
import { Plus, Truck, StickyNote } from "lucide-react";
import { Combobox } from "../ui/Combobox";
import { MobileStickyFooter } from "../ui/MobilePrimitives";
import { parseFeetInches } from "../../lib/utils";
import { useToast } from "../ui/Toast";
import { useKeepAwake } from "../../lib/use-keep-awake";
import { captureDocument } from "../../lib/camera";
import { scanBarcode } from "../../lib/barcode";
import { scanNfcVehicleTag, isNfcAvailable } from "../../lib/nfc";
import { Camera, QrCode, Nfc } from "lucide-react";
import { isNative } from "../../lib/capacitor";

export function CreateSlipForm({ onSuccess }: { onSuccess: (slip?: Slip) => void }) {
  const { vehicles, customers, employees, addSlip, slips, companySettings, addVehicle, updateVehicle, addCustomer, addTransaction, userRole } = useErp();
  const { addToast } = useToast();
  useKeepAwake();

  const resolvedOperatorName = (() => {
    try {
      const token = localStorage.getItem("erp_auth_token");
      const users = companySettings.users || [];
      if (token?.startsWith("session_")) {
        const userId = token.slice("session_".length);
        const user = users.find((u) => u.id === userId);
        if (user) return user.name || user.email || "";
      }
      if (token === "admin_session") {
        const admin = users.find((u) => u.role === "Admin" && u.status === "Active");
        return admin?.name || admin?.email || "Admin";
      }
    } catch { /* localStorage unavailable */ }
    return "";
  })();

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
    paymentStatus: "Cash (Paid)" as "Credit (Unpaid)" | "Cash (Paid)" | "Partial",
    amountPaid: "",
    customerId: "",
    notes: "",
    loaderName: (() => { try { return localStorage.getItem('lastLoaderName') || ""; } catch { return ""; } })(),
  });

  const isExistingVehicle = !!vehicles.find((v) => v.vehicleNo === formData.vehicleNo);

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
      if (s.materialType === formData.materialType) { historicalRate = s.ratePerUnit; break; }
    }
    if (historicalRate > 0) {
      setFormData((prev) => ({ ...prev, ratePerUnit: historicalRate.toString() }));
    } else {
      const dr = defaultRates[formData.materialType];
      if (dr) setFormData((prev) => ({ ...prev, ratePerUnit: dr.toString() }));
    }
  }, [formData.customerId, formData.materialType, slips, companySettings.materials]);

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

  const [manualTotalAmount, setManualTotalAmount] = useState<string>(calculatedTotalAmount.toString());
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | undefined>(undefined);
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => { isNfcAvailable().then(setNfcAvailable); }, []);
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
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

    if (formData.vehicleNo) {
      const existing = vehicles.find(v => v.vehicleNo === formData.vehicleNo);
      if (existing) {
        if (formData.driverName !== existing.driverName || formData.driverPhone !== existing.driverPhone)
          updateVehicle({ ...existing, driverName: formData.driverName, driverPhone: formData.driverPhone });
      } else if (userRole === 'Partner') {
        addToast('warning', `Vehicle ${formData.vehicleNo.toUpperCase()} not saved — Partners cannot add vehicles.`);
      } else {
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
      }
    }

    const rawCustomerId = formData.customerId.trim() || "CASH";
    const resolvedCustomerName = rawCustomerId.startsWith("NEW:") ? rawCustomerId.slice(4).trim() : rawCustomerId;
    let finalCustomerId = resolvedCustomerName;
    if (finalCustomerId !== "CASH" && !customers.find(c => c.id === finalCustomerId)) {
      const nc = { id: "cust_" + crypto.randomUUID(), name: finalCustomerId, phone: "", openingBalance: 0 };
      addCustomer(nc);
      finalCustomerId = nc.id;
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
        lengthFeet: parseFeetInches(formData.lengthFeet) || undefined,
        widthFeet: parseFeetInches(formData.widthFeet) || undefined,
        heightFeet: parseFeetInches(formData.heightFeet) || undefined,
        grossWeight: parseFloat(formData.grossWeight) || undefined,
        tareWeight: parseFloat(formData.tareWeight) || undefined,
      },
      quantity: Math.round(calculatedQty * 100) / 100,
      ratePerUnit: parseFloat(formData.ratePerUnit) || 0,
      freightAmount: 0,
      totalAmount: finalAmount,
      amountPaid: finalAmountPaid,
      customerId: finalCustomerId,
      status: "Pending",
      notes: formData.notes,
      operatorName: resolvedOperatorName || undefined,
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
        description: `Initial payment for slip #${newSlip.id.slice(0, 5).toUpperCase()}`,
        customerId: finalCustomerId,
        slipId: newSlip.id,
      });
    }

    try { if (formData.loaderName) localStorage.setItem('lastLoaderName', formData.loaderName); } catch { /* noop */ }
    onSuccess(newSlip);
  };

  // ── Shared design tokens ───────────────────────────────────────────────────
  // Every input/combobox is h-8 so all rows align perfectly across both columns.
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
    <form onSubmit={handleCreate} className="p-3 pb-20 md:pb-4 space-y-2.5">

      {/* ── Row 1: Vehicle No (left) | Delivery Mode (right) ──────────── */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1">
              <Truck className="w-3 h-3 text-zinc-500" />
              <label className={lbl + " mb-0"}>Vehicle No *</label>
            </div>
            {/* NFC / QR scan buttons — only rendered when available */}
            <div className="flex items-center gap-1.5">
              {isNative() && (
                <button type="button" aria-label="Scan QR"
                  onClick={async () => { try { const v = await scanBarcode(); if (v) autofillVehicle(v.toUpperCase()); } catch { addToast('error', 'Scan failed.'); } }}
                  className="text-[10px] text-primary-600 dark:text-primary-400 flex items-center gap-0.5">
                  <QrCode className="w-3 h-3" />QR
                </button>
              )}
              {nfcAvailable && (
                <button type="button" disabled={nfcScanning} aria-label="Tap NFC"
                  onClick={async () => { setNfcScanning(true); try { const v = await scanNfcVehicleTag(); if (!v) { addToast('error', 'No NFC tag.'); return; } autofillVehicle(v); } catch { addToast('error', 'NFC failed.'); } finally { setNfcScanning(false); } }}
                  className="text-[10px] text-primary-600 dark:text-primary-400 flex items-center gap-0.5 disabled:opacity-40">
                  <Nfc className="w-3 h-3" />{nfcScanning ? '…' : 'NFC'}
                </button>
              )}
            </div>
          </div>
          <Combobox
            options={vehicles.filter(v => v.isActive !== false).map(v => ({ label: v.vehicleNo, value: v.vehicleNo }))}
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
      <div className="grid grid-cols-2 gap-x-3 items-end">
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
          options={[{ label: "Cash Sale", value: "CASH" }, ...customers.filter(c => c.isActive !== false).map(c => ({ label: c.name, value: c.id }))]}
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
            options={(companySettings.materials || []).filter(m => m.isActive !== false).map(mat => ({ label: mat.name, value: mat.name }))}
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

      {/* ── Row 6: Loader (left) | Challan Photo (right) ─────────────── */}
      <div className="grid grid-cols-2 gap-x-3">
        <div>
          <label className={lbl}>Loader</label>
          <Combobox
            options={employees
              .filter((e) => e.isActive !== false && /loader/i.test(e.role || ""))
              .map((e) => ({ label: e.name, value: e.name }))}
            value={formData.loaderName}
            onChange={(val) => setFormData({ ...formData, loaderName: val })}
            placeholder="Loader name"
            mobileTitle="Select Loader"
          />
        </div>
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
      </div>

      {/* ── Row 7: Add Note (right-aligned) ──────────────────────────── */}
      <div className="flex justify-end">
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

      {/* ── Row 8: Payment toggle (full width) ───────────────────────── */}
      <div>
        <label className={lbl}>Payment</label>
        <div className={seg + " h-8"}>
          {(["Cash (Paid)", "Credit (Unpaid)", "Partial"] as const).map((s) =>
            segBtn(formData.paymentStatus === s, () => setFormData({ ...formData, paymentStatus: s, amountPaid: "" }), s.split(" ")[0])
          )}
        </div>
      </div>

      {/* ── Row 9: Total ₹ (left) | + Create Slip (right) ───────────── */}
      {/* Desktop: shown inline. Mobile: Total is in sticky footer, button here hidden. */}
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

        <div className="flex items-end">
          <button type="submit"
            className="w-full h-8 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />Create Slip
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
          <button type="submit"
            className="min-h-11 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 active:scale-95 transition-all whitespace-nowrap">
            + Create
          </button>
        </div>
      </MobileStickyFooter>
    </form>
  );
}
