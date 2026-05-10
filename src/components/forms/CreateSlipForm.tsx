import React, { useState, useEffect, useRef, useCallback } from "react";
import { useErp } from "../../context/ErpContext";
import { MaterialType, DeliveryMode, MeasurementType, Slip } from "../../types";
import { Plus, Truck, StickyNote, Camera, QrCode, Nfc, Download, Printer, MessageCircle, Loader2 } from "lucide-react";
import { Combobox } from "../ui/Combobox";
import { parseFeetInches, generateId, normalizeVehicleNo, formatVehicleNo } from "../../lib/utils";
import { useActive } from "../../hooks/useActive";
import { useToast } from "../ui/Toast";
import { useKeepAwake } from "../../lib/use-keep-awake";
import { captureDocument } from "../../lib/camera";
import { scanBarcode } from "../../lib/barcode";
import { scanNfcVehicleTag, isNfcAvailable } from "../../lib/nfc";
import { isNative } from "../../lib/capacitor";
import { createSlipPdfBlob, downloadPdfBlob, printPdfBlob, sharePdfBlob } from "../../lib/print-utils";
import { buildSlipWhatsAppMessage, openWhatsAppMessage } from "../../lib/whatsapp-share";

export function CreateSlipForm({ onSuccess }: { onSuccess: (slip?: Slip) => void }) {
  const { vehicles, customers, employees, addSlip, slips, companySettings, addVehicle, updateVehicle, addCustomer, userRole, session } = useErp();
  const activeVehicles = useActive(vehicles);
  const activeCustomers = useActive(customers);
  const activeEmployees = useActive(employees);
  const activeMaterials = useActive(companySettings.materials || []);
  const { addToast } = useToast();
  useKeepAwake();
  const creatingVehicleRef = useRef(false);

  // Resolve the operator name from the Supabase session
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

  const isExistingVehicle = !!vehicles.find((v) => normalizeVehicleNo(v.vehicleNo) === normalizeVehicleNo(formData.vehicleNo));

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
  const [isSubmittingAction, setIsSubmittingAction] = useState<"download" | "whatsapp" | "print" | "create" | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => { isNfcAvailable().then(setNfcAvailable); }, []);
  useEffect(() => {
    if (!hasManualOverride) setManualTotalAmount(calculatedTotalAmount.toString());
  }, [calculatedTotalAmount, hasManualOverride]);

  const finalAmount = parseFloat(manualTotalAmount) || 0;

  const autofillVehicle = (vehicleNo: string) => {
    const rawInput = vehicleNo.startsWith("NEW:") ? vehicleNo.slice(4) : vehicleNo;
    const normalized = normalizeVehicleNo(rawInput);
    const v = vehicles.find((vehicle) => normalizeVehicleNo(vehicle.vehicleNo) === normalized);
    if (v) {
      setFormData((prev) => ({
        ...prev,
        vehicleNo: formatVehicleNo(v.vehicleNo),
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
      setFormData((prev) => ({ ...prev, vehicleNo: formatVehicleNo(rawInput) }));
    }
  };

  const getCustomerName = (customerId: string) => {
    if (customerId === "CASH" || !customerId) return "Counter Sale";
    return customers.find((c) => c.id === customerId)?.name ?? customerId;
  };

  const handleCreate = async (action: "download" | "whatsapp" | "print" | "create" = "create") => {
    if (isSubmittingAction) return;

    if (formData.vehicleNo.trim() === "") { addToast('error', 'Vehicle number is required.'); return; }
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
    if (formData.customerId.trim() === "") { addToast('error', 'Customer is required.'); return; }

    setIsSubmittingAction(action);
    try {
      let finalAmountPaid = 0;
      if (formData.paymentStatus === "Cash (Paid)") {
        finalAmountPaid = finalAmount;
      } else if (formData.paymentStatus === "Partial") {
        finalAmountPaid = parseFloat(formData.amountPaid) || 0;
        if (finalAmountPaid < 0) { addToast('error', 'Amount paid cannot be negative.'); return; }
      }

      const finalVehicleNo = formatVehicleNo(formData.vehicleNo);
      if (finalVehicleNo) {
        const existing = vehicles.find(v => normalizeVehicleNo(v.vehicleNo) === normalizeVehicleNo(finalVehicleNo));
        if (existing) {
          if (formData.driverName !== existing.driverName || formData.driverPhone !== existing.driverPhone)
            updateVehicle({ ...existing, driverName: formData.driverName, driverPhone: formData.driverPhone });
        } else if (userRole === 'Partner') {
          addToast('warning', `Vehicle ${finalVehicleNo} not saved — Partners cannot add vehicles.`);
        } else if (!creatingVehicleRef.current) {
          creatingVehicleRef.current = true;
          addVehicle({
            id: generateId(),
            vehicleNo: finalVehicleNo,
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

      const rawCustomerId = formData.customerId.trim() || "CASH";
      const resolvedCustomerName = rawCustomerId.startsWith("NEW:") ? rawCustomerId.slice(4).trim() : rawCustomerId;
      let finalCustomerId = resolvedCustomerName;
      if (finalCustomerId !== "CASH" && !customers.find(c => c.id === finalCustomerId)) {
        const nc = { id: "cust_" + generateId(), name: finalCustomerId, phone: "", openingBalance: 0 };
        addCustomer(nc);
        finalCustomerId = nc.id;
      }

      const newSlip: Slip = {
        id: generateId(),
        date: new Date().toISOString(),
        vehicleNo: finalVehicleNo,
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
        quantity: Number(calculatedQty.toFixed(2)),
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
      // amountPaid is tracked on the slip itself — getCustomerBalance uses
      // totalAmount - amountPaid, and the ledger shows "Cash Received" from it.
      // No separate customer transaction is needed (that would double-count).

      try { if (formData.loaderName) localStorage.setItem('lastLoaderName', formData.loaderName); } catch { /* noop */ }

      // Handle post-save actions
      if (action !== "create") {
        const customerName = getCustomerName(finalCustomerId);
        const filename = `Slip-${newSlip.id.slice(0, 8).toUpperCase()}.pdf`;
        const blob = await createSlipPdfBlob(newSlip, customerName, companySettings);

        if (action === "download") {
          downloadPdfBlob(blob, filename);
          addToast("success", "Slip created and PDF downloaded.");
        } else if (action === "whatsapp") {
          const message = buildSlipWhatsAppMessage({ slip: newSlip, customerName, companySettings });
          const result = await sharePdfBlob(blob, filename, "Loading Slip", message);
          if (result === "downloaded") {
            openWhatsAppMessage(message);
            addToast("info", "Slip created. Attach PDF in WhatsApp.");
          } else {
            addToast("success", "Slip created. Shared to WhatsApp.");
          }
        } else if (action === "print") {
          if (isNative()) {
            await sharePdfBlob(blob, filename, "Share Loading Token");
          } else {
            await printPdfBlob(blob, `Slip ${newSlip.id.slice(0, 8).toUpperCase()}`);
          }
          addToast("success", "Slip created and sent to print.");
        }
      }

      onSuccess(newSlip);
    } catch (err) {
      console.error("Failed to create slip or perform action:", err);
      addToast("error", "Failed to complete the request.");
    } finally {
      setIsSubmittingAction(null);
    }
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

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleCreate("create"); }} className="p-4 pb-4 space-y-4">
      {/* Row 1: Vehicle & Delivery Mode */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={lbl + " mb-0"}>Vehicle No *</label>
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
            options={activeVehicles.map(v => ({ label: formatVehicleNo(v.vehicleNo), value: formatVehicleNo(v.vehicleNo) }))}
            value={formData.vehicleNo} allowCreate onChange={autofillVehicle} placeholder="MH 20 XX 0000"
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

      {/* Row 2: Driver Name & Measurement */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Driver Name</label>
          <Combobox
            options={activeEmployees.filter(e => /driver/i.test(e.role || "")).map(e => ({ label: e.name, value: e.name }))}
            value={formData.driverName}
            allowCreate
            onChange={(val) => setFormData({ ...formData, driverName: (val?.startsWith("NEW:") ? val.slice(4) : val) || "" })}
            placeholder="Driver name"
            mobileTitle="Select Driver"
          />
        </div>
        <div>
          <label className={lbl}>Measurement</label>
          <div className={seg}>
            {segBtn(formData.measurementType === "Volume (Brass)", () => setFormData({ ...formData, measurementType: "Volume (Brass)" }), "Brass")}
            {segBtn(formData.measurementType === "Weight (Tonnes)", () => setFormData({ ...formData, measurementType: "Weight (Tonnes)" }), "Weight")}
          </div>
        </div>
      </div>

      {/* Row 3: Driver Phone (left) | Dimensions/Weight (right) */}
      <div className="grid grid-cols-2 gap-3 items-start">
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
                  <input required type="tel" step="0.01" value={formData[field]}
                    onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                    className={inp + " text-center px-1"} placeholder="0" />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-1">
              <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">
                {calculatedQty.toFixed(2)} Brass
              </span>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className={lbl}>Tare (T)</label>
                <input required type="tel" step="0.01" value={formData.tareWeight}
                  onChange={(e) => setFormData({ ...formData, tareWeight: e.target.value })}
                  className={inp + " text-center px-1"} placeholder="0" />
              </div>
              <div>
                <label className={lbl}>Gross (T)</label>
                <input required type="tel" step="0.01" value={formData.grossWeight}
                  onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                  className={inp + " text-center px-1"} placeholder="0" />
              </div>
            </div>
            <div className="flex justify-end mt-1">
              <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">
                {calculatedQty.toFixed(2)} T
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Row 5: Customer */}
      <div>
        <label className={lbl}>Customer</label>
        <Combobox
          options={[{ label: "Cash Sale", value: "CASH" }, ...activeCustomers.map(c => ({ label: c.name, value: c.id }))]}
          value={formData.customerId} allowCreate
          onChange={(val) => setFormData({ ...formData, customerId: val || "" })}
          placeholder="Select customer" mobileTitle="Select Customer"
        />
      </div>

      {/* Row 6: Material & Rate */}
      <div className="grid grid-cols-2 gap-3">
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
          <input required type="tel" step="0.01" value={formData.ratePerUnit}
            onChange={(e) => setFormData({ ...formData, ratePerUnit: e.target.value })}
            className={inp} placeholder="0" />
        </div>
      </div>

      {/* Row 7: Loader & Payment */}
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className={lbl}>Loader</label>
          <Combobox
            options={activeEmployees
              .filter((e) => /loader/i.test(e.role || ""))
              .map((e) => ({ label: e.name, value: e.name }))}
            value={formData.loaderName}
            onChange={(val) => setFormData({ ...formData, loaderName: val })}
            placeholder="Loader name"
            mobileTitle="Select Loader"
          />
        </div>
        <div>
          <label className={lbl}>Payment</label>
          <div className={seg + " min-h-[40px]"}>
            {(["Cash (Paid)", "Credit (Unpaid)", "Partial"] as const).map((s) =>
              segBtn(formData.paymentStatus === s, () => setFormData({ ...formData, paymentStatus: s, amountPaid: "" }), s.split(" ")[0])
            )}
          </div>
        </div>
      </div>

      {/* Attach & Add Note Buttons */}
      <div className="flex justify-end gap-4 mt-2 mb-1">
        {attachmentUri ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 font-medium">Attached</span>
            <button type="button" onClick={() => setAttachmentUri(undefined)}
              className="text-xs text-rose-500 flex items-center gap-1 hover:underline">
              Remove
            </button>
          </div>
        ) : (
          <button type="button"
            onClick={async () => { try { const r = await captureDocument(); if (r) setAttachmentUri(r.uri); } catch { addToast('error', 'Camera failed.'); } }}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-primary-500 transition-colors">
            <Camera className="w-3.5 h-3.5" />Attach
          </button>
        )}
        
        {!showNotes && (
          <button type="button" onClick={() => setShowNotes(true)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-primary-500 transition-colors">
            <StickyNote className="w-3.5 h-3.5" />Add Note
          </button>
        )}
      </div>

      {/* Notes Textarea */}
      {showNotes && (
        <div className="w-full mt-1 animate-fade-in">
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

      {/* Optional Partial Payment */}
      {formData.paymentStatus === "Partial" && (
        <div className="animate-fade-in mt-1">
          <label className={lbl}>Paid ₹</label>
          <input required type="tel" step="0.01" value={formData.amountPaid}
            onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
            className={inp} placeholder="0" />
        </div>
      )}

      {/* Total + Action Buttons row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end pt-2 border-t dark:border-zinc-700">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={lbl + " mb-0"}>Total ₹</label>
            {hasManualOverride && (
              <button type="button"
                onClick={() => { setHasManualOverride(false); setManualTotalAmount(calculatedTotalAmount.toString()); }}
                className="text-xs text-primary-600 hover:underline">
                Reset
              </button>
            )}
          </div>
          <input type="number" step="1" value={manualTotalAmount}
            onChange={(e) => { setHasManualOverride(true); setManualTotalAmount(e.target.value); }}
            className={[
              "w-full h-11 rounded-xl border-2 border-primary-500 px-3 text-lg font-bold",
              "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300",
              "focus:outline-none focus:border-primary-400 transition-colors",
            ].join(" ")}
          />
          {hasManualOverride && (
            <div className="text-[10px] text-zinc-500 mt-1">Auto: ₹{calculatedTotalAmount.toLocaleString()}</div>
          )}
        </div>

        <div className="flex items-center gap-1.5 justify-end">
          <button type="button" disabled={!!isSubmittingAction}
            onClick={() => handleCreate("download")}
            className="flex-1 md:flex-none h-11 px-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center border border-zinc-200 dark:border-zinc-700 disabled:opacity-50"
            title="Download PDF"
          >
            {isSubmittingAction === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          
          <button type="button" disabled={!!isSubmittingAction}
            onClick={() => handleCreate("whatsapp")}
            className="flex-1 md:flex-none h-11 px-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all flex items-center justify-center border border-emerald-200 dark:border-emerald-800/30 disabled:opacity-50"
            title="Share on WhatsApp"
          >
            {isSubmittingAction === "whatsapp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          </button>

          <button type="button" disabled={!!isSubmittingAction}
            onClick={() => handleCreate("print")}
            className="flex-1 md:flex-none h-11 px-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all flex items-center justify-center border border-blue-200 dark:border-blue-800/30 disabled:opacity-50"
            title="Print Slip"
          >
            {isSubmittingAction === "print" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          </button>

          <button type="submit" disabled={!!isSubmittingAction}
            className="flex-[2] md:flex-none h-11 px-4 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isSubmittingAction === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="whitespace-nowrap">Create Slip</span>
          </button>
        </div>
      </div>
    </form>
  );
}
