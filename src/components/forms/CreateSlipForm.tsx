import React, { useState, useEffect, useRef, useCallback } from "react";
import { useErp } from "../../context/ErpContext";
import { MaterialType, DeliveryMode, MeasurementType, Slip } from "../../types";
import { Plus, Truck, StickyNote, ChevronRight, ChevronLeft } from "lucide-react";
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
  const { vehicles, customers, employees, addSlip, slips, companySettings, addVehicle, updateVehicle, addCustomer, addTransaction, userRole, session } = useErp();
  const { addToast } = useToast();
  useKeepAwake();
  const creatingVehicleRef = useRef(false);

  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const nextStep = useCallback(() => setStep((s) => Math.min(s + 1, totalSteps)), []);
  const prevStep = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  // Resolve the operator name from the Supabase session — match by user id or email
  // against companySettings.users so the slip records the correct person's name.
  const resolvedOperatorName = (() => {
    if (!session) return "";
    const users = companySettings.users || [];
    const user = users.find(
      (u) =>
        u.id === session.user.id ||
        u.email.toLowerCase() === (session.user.email ?? "").toLowerCase(),
    );
    return user?.name || user?.email || "";
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

  // Step validation helpers
  const isStep1Valid = formData.vehicleNo.trim() !== "";
  const isStep2Valid = formData.measurementType === "Volume (Brass)"
    ? (parseFloat(formData.lengthFeet) > 0 && parseFloat(formData.widthFeet) > 0 && parseFloat(formData.heightFeet) > 0)
    : (parseFloat(formData.grossWeight) > 0 && parseFloat(formData.tareWeight) >= 0 && parseFloat(formData.grossWeight) > parseFloat(formData.tareWeight));
  const isStep3Valid = formData.customerId.trim() !== "" && parseFloat(formData.ratePerUnit) > 0;

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

  const handleNext = () => {
    if (step === 1 && !isStep1Valid) { addToast('error', 'Vehicle number is required.'); return; }
    if (step === 2 && !isStep2Valid) { addToast('error', 'Please enter valid measurements.'); return; }
    if (step === 3 && !isStep3Valid) { addToast('error', 'Customer and rate are required.'); return; }
    nextStep();
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
        // Release the guard after a tick so subsequent rapid submissions
        // can see the newly created vehicle in the vehicles array.
        setTimeout(() => { creatingVehicleRef.current = false; }, 0);
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
  const inp = [
    "w-full min-h-[48px] rounded-xl border border-zinc-200 dark:border-zinc-700",
    "bg-zinc-50 dark:bg-zinc-800 px-3 text-sm",
    "text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500",
    "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors",
  ].join(" ");

  const lbl = "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1 block";

  // Segmented pill toggle
  const seg = "flex bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-0.5 gap-0.5 min-h-[40px]";
  const segBtn = (active: boolean, onClick: () => void, label: string) => (
    <button key={label} type="button" onClick={onClick}
      className={[
        "flex-1 rounded-lg text-xs font-semibold transition-colors",
        active ? "bg-primary-600 text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200",
      ].join(" ")}>
      {label}
    </button>
  );

  // ── Step content ───────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4 animate-fade-in">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <Truck className="w-4 h-4 text-zinc-500" />
                  <label className={lbl + " mb-0"}>Vehicle No *</label>
                </div>
                <div className="flex items-center gap-1.5">
                  {isNative() && (
                    <button type="button" aria-label="Scan QR"
                      onClick={async () => { try { const v = await scanBarcode(); if (v) autofillVehicle(v.toUpperCase()); } catch { addToast('error', 'Scan failed.'); } }}
                      className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-0.5">
                      <QrCode className="w-3 h-3" />QR
                    </button>
                  )}
                  {nfcAvailable && (
                    <button type="button" disabled={nfcScanning} aria-label="Tap NFC"
                      onClick={async () => { setNfcScanning(true); try { const v = await scanNfcVehicleTag(); if (!v) { addToast('error', 'No NFC tag.'); return; } autofillVehicle(v); } catch { addToast('error', 'NFC failed.'); } finally { setNfcScanning(false); } }}
                      className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-0.5 disabled:opacity-40">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Driver Name</label>
                <input type="text" value={formData.driverName}
                  onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                  className={inp} placeholder="Driver name" />
              </div>
              <div>
                <label className={lbl}>Driver Phone</label>
                <input type="tel" value={formData.driverPhone}
                  onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                  className={inp} placeholder="Phone" />
              </div>
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
        );
      case 2:
        return (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className={lbl}>Measurement</label>
              <div className={seg}>
                {segBtn(formData.measurementType === "Volume (Brass)", () => setFormData({ ...formData, measurementType: "Volume (Brass)" }), "Brass")}
                {segBtn(formData.measurementType === "Weight (Tonnes)", () => setFormData({ ...formData, measurementType: "Weight (Tonnes)" }), "Weight")}
              </div>
            </div>
            {formData.measurementType === "Volume (Brass)" ? (
              <div className="grid grid-cols-3 gap-2">
                {(["lengthFeet", "widthFeet", "heightFeet"] as const).map((field, i) => (
                  <div key={field}>
                    <label className={lbl + " text-center"}>{["L (ft)", "W (ft)", "H (ft)"][i]}</label>
                    <input required type="tel" step="0.01" value={formData[field]}
                      onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                      className={inp + " text-center px-1"} placeholder="0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Tare (T)</label>
                  <input required type="tel" step="0.01" value={formData.tareWeight}
                    onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })}
                    className={inp} placeholder="0" />
                </div>
                <div>
                  <label className={lbl}>Gross (T)</label>
                  <input required type="tel" step="0.01" value={formData.grossWeight}
                    onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                    className={inp} placeholder="0" />
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                {calculatedQty.toFixed(2)} {formData.measurementType === "Volume (Brass)" ? "Brass" : "T"}
              </span>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className={lbl}>Customer *</label>
              <Combobox
                options={[{ label: "Cash Sale", value: "CASH" }, ...customers.filter(c => c.isActive !== false).map(c => ({ label: c.name, value: c.id }))]}
                value={formData.customerId} allowCreate
                onChange={(val) => setFormData({ ...formData, customerId: val || "" })}
                placeholder="Select customer" mobileTitle="Select Customer"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <input required type="tel" step="0.01" value={formData.ratePerUnit}
                  onChange={(e) => setFormData({ ...formData, ratePerUnit: e.target.value })}
                  className={inp} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                  <div className="relative min-h-[48px]">
                    <img src={attachmentUri} alt="Challan"
                      className="w-full h-12 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700" />
                    <button type="button" onClick={() => setAttachmentUri(undefined)}
                      className="absolute top-0 right-0 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold"
                      aria-label="Remove">×</button>
                  </div>
                ) : (
                  <button type="button"
                    onClick={async () => { try { const r = await captureDocument(); if (r) setAttachmentUri(r.uri); } catch { addToast('error', 'Camera failed.'); } }}
                    className="w-full min-h-[48px] flex items-center justify-center gap-1 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl text-xs text-zinc-500 hover:border-primary-500 hover:text-primary-500 transition-colors">
                    <Camera className="w-4 h-4" />Attach Photo
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className={lbl}>Payment</label>
              <div className={seg + " min-h-[40px]"}>
                {(["Cash (Paid)", "Credit (Unpaid)", "Partial"] as const).map((s) =>
                  segBtn(formData.paymentStatus === s, () => setFormData({ ...formData, paymentStatus: s, amountPaid: "" }), s.split(" ")[0])
                )}
              </div>
            </div>
            {formData.paymentStatus === "Partial" && (
              <div>
                <label className={lbl}>Paid ₹</label>
                <input required type="tel" step="0.01" value={formData.amountPaid}
                  onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                  className={inp} placeholder="0" />
              </div>
            )}
            {!showNotes ? (
              <button type="button" onClick={() => setShowNotes(true)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-primary-500 transition-colors">
                <StickyNote className="w-3.5 h-3.5" />Add Note
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={lbl}>Notes</label>
                  <button type="button"
                    onClick={() => { setShowNotes(false); setFormData({ ...formData, notes: "" }); }}
                    className="text-xs text-zinc-400 hover:text-rose-500 transition-colors">
                    Remove
                  </button>
                </div>
                <textarea autoFocus rows={2} value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full resize-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
                  placeholder="Optional remarks"
                />
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Review Slip</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-zinc-500">Vehicle:</span> <span className="font-semibold text-zinc-900 dark:text-white">{formData.vehicleNo}</span></div>
                <div><span className="text-zinc-500">Driver:</span> <span className="font-semibold text-zinc-900 dark:text-white">{formData.driverName || "—"}</span></div>
                <div><span className="text-zinc-500">Delivery:</span> <span className="font-semibold text-zinc-900 dark:text-white">{formData.deliveryMode}</span></div>
                <div><span className="text-zinc-500">Measurement:</span> <span className="font-semibold text-zinc-900 dark:text-white">{formData.measurementType}</span></div>
                <div><span className="text-zinc-500">Customer:</span> <span className="font-semibold text-zinc-900 dark:text-white">{formData.customerId || "—"}</span></div>
                <div><span className="text-zinc-500">Material:</span> <span className="font-semibold text-zinc-900 dark:text-white">{formData.materialType}</span></div>
                <div><span className="text-zinc-500">Rate:</span> <span className="font-semibold text-zinc-900 dark:text-white">₹{formData.ratePerUnit}</span></div>
                <div><span className="text-zinc-500">Qty:</span> <span className="font-semibold text-zinc-900 dark:text-white">{calculatedQty.toFixed(2)}</span></div>
                <div className="col-span-2"><span className="text-zinc-500">Total:</span> <span className="font-bold text-primary-600 dark:text-primary-400 text-base">₹{finalAmount.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleCreate} className="p-4 pb-24 md:pb-4 space-y-4">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (i + 1 < step || (i + 1 === 2 && isStep1Valid) || (i + 1 === 3 && isStep1Valid && isStep2Valid) || (i + 1 === 4 && isStep1Valid && isStep2Valid && isStep3Valid)) {
                setStep(i + 1);
              }
            }}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i + 1 <= step ? "bg-primary-500" : "bg-zinc-200 dark:bg-zinc-700"
            }`}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 text-center">
        Step {step} of {totalSteps} — {step === 1 ? "Vehicle & Driver" : step === 2 ? "Material & Measurement" : step === 3 ? "Pricing & Customer" : "Review & Submit"}
      </p>

      {renderStep()}

      {/* Mobile step navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2 z-50">
        {step > 1 && (
          <button
            type="button"
            onClick={prevStep}
            className="px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-200 active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {step < totalSteps ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl bg-primary-600 text-white text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl bg-primary-600 text-white text-sm font-bold active:scale-95 transition-transform"
          >
            + Create Slip
          </button>
        )}
      </div>

      {/* Desktop submit */}
      <div className="hidden md:flex justify-end pt-4">
        <button type="submit"
          className="px-6 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />Create Slip
        </button>
      </div>
    </form>
  );
}
