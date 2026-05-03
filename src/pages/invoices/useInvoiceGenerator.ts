import { useState, useEffect, useMemo } from "react";
import { useErp } from "../../context/ErpContext";
import { Invoice, InvoiceItem, Slip } from "../../types";
import { useToast } from "../../components/ui/Toast";
import { downloadCSV } from "../../lib/export-utils";
import { invoiceSchema } from "../../lib/validation";

export function useInvoiceGenerator() {
  const { invoices, customers, slips, addInvoice, updateInvoice, updateSlip, companySettings, addCustomer } = useErp();
  const { addToast } = useToast();

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [selectedSlipIds, setSelectedSlipIds] = useState<string[]>([]);
  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    type: "GST",
    date: new Date().toISOString().split("T")[0],
    invoiceNo: "",
    items: [],
  });
  const [newItem, setNewItem] = useState<InvoiceItem>({
    materialType: "10mm",
    quantity: 0,
    rate: 0,
    amount: 0,
    hsnCode: "25171010",
    gstRate: 5,
  });

  const materials = useMemo(() => {
    if (companySettings.materials && companySettings.materials.length > 0) {
      return companySettings.materials
        .filter((m) => m.isActive !== false)
        .map((m, idx) => ({
          id: m.id || idx + 1,
          name: m.name,
          defaultPrice: m.defaultPrice || 0,
          unit: m.unit || "Ton",
          hsnCode: m.hsnCode || "25171010",
          gstRate: m.gstRate || 5,
        }));
    }
    return [
      { id: 1, name: "10mm", defaultPrice: 450, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
      { id: 2, name: "20mm", defaultPrice: 480, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
      { id: 3, name: "40mm", defaultPrice: 400, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
      { id: 4, name: "Dust", defaultPrice: 350, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
      { id: 5, name: "GSB", defaultPrice: 300, unit: "Ton", hsnCode: "25171020", gstRate: 5 },
      { id: 6, name: "Boulders", defaultPrice: 250, unit: "Ton", hsnCode: "25169090", gstRate: 5 },
    ];
  }, [companySettings.materials]);

  const unbilledSlips = useMemo(() => {
    if (!newInvoice.customerId || newInvoice.customerId === "CASH") return [];
    return slips.filter(
      (s) =>
        s.customerId === newInvoice.customerId &&
        s.status === "Tallied" &&
        (!s.invoiceId || s.invoiceId === editingInvoiceId)
    );
  }, [slips, newInvoice.customerId, editingInvoiceId]);

  // Restore slip selection when editing an existing invoice.
  useEffect(() => {
    if (editingInvoiceId) {
      const editingInvoice = invoices.find((inv) => inv.id === editingInvoiceId);
      setSelectedSlipIds(editingInvoice?.slipIds ?? []);
    } else {
      setSelectedSlipIds([]);
    }
  }, [editingInvoiceId, invoices]);

  // Clear slip selection when the customer changes mid-edit.
  useEffect(() => {
    if (editingInvoiceId) {
      setSelectedSlipIds([]);
    }
  }, [newInvoice.customerId, editingInvoiceId]);

  // Pre-fill rate from customer's invoice history.
  useEffect(() => {
    if (newInvoice.customerId && newItem.materialType) {
      const customerInvoices = invoices
        .filter((inv) => inv.customerId === newInvoice.customerId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      let historicalRate = 0;
      for (const inv of customerInvoices) {
        const item = inv.items.find((i: InvoiceItem) => i.materialType === newItem.materialType);
        if (item) { historicalRate = item.rate; break; }
      }
      const mat = materials.find((m) => m.name === newItem.materialType);
      setNewItem((prev) => ({
        ...prev,
        rate: historicalRate > 0 ? historicalRate : (mat?.defaultPrice || 0),
      }));
    }
  }, [newInvoice.customerId, newItem.materialType, invoices, materials]);

  // Accept an explicit snapshot so callers can pass the latest invoices array
  // and avoid reading a stale closure — guards against same-tab rapid clicks.
  const generateInvoiceNoForType = (type: string, invoiceSnapshot = invoices) => {
    const today = new Date();
    const yearStr = today.getFullYear().toString().slice(-2);
    const prefix = type === "GST" ? "GST" : "CASH";
    const existingNos = new Set(invoiceSnapshot.map((inv) => inv.invoiceNo));
    let maxNo = 0;
    invoiceSnapshot.forEach((inv) => {
      const match = inv.invoiceNo.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNo) maxNo = num;
      }
    });
    let nextNo = maxNo + 1;
    while (existingNos.has(`${prefix}-${yearStr}-${nextNo.toString().padStart(4, "0")}`)) {
      nextNo++;
    }
    return `${prefix}-${yearStr}-${nextNo.toString().padStart(4, "0")}`;
  };

  const openCreateModal = () => {
    setEditingInvoiceId(null);
    setNewInvoice({
      type: "GST",
      date: new Date().toISOString().split("T")[0],
      invoiceNo: generateInvoiceNoForType("GST"),
      items: [],
    });
    setNewItem({ ...materials[0], quantity: 0, rate: materials[0].defaultPrice, amount: 0, materialType: materials[0].name });
    setShowGenerateModal(true);
  };

  const openEditModal = (invoice: Invoice) => {
    setEditingInvoiceId(invoice.id);
    setNewInvoice(invoice);
    setShowGenerateModal(true);
  };

  const handleAddItem = () => {
    if (newItem.quantity > 0 && newItem.rate > 0) {
      setNewInvoice({
        ...newInvoice,
        items: [...(newInvoice.items || []), { ...newItem, amount: newItem.quantity * newItem.rate }],
      });
      // Re-compute rate for the same material so the next row is pre-filled.
      let nextRate = 0;
      if (newInvoice.customerId && newItem.materialType) {
        const customerInvoices = invoices
          .filter((inv) => inv.customerId === newInvoice.customerId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        for (const inv of customerInvoices) {
          const item = inv.items.find((i: InvoiceItem) => i.materialType === newItem.materialType);
          if (item) { nextRate = item.rate; break; }
        }
        if (nextRate === 0) {
          const mat = materials.find((m) => m.name === newItem.materialType);
          nextRate = mat?.defaultPrice || 0;
        }
      }
      setNewItem({ ...newItem, quantity: 0, rate: nextRate, amount: 0 });
    }
  };

  const handleGenerate = () => {
    if (isSubmitting) return;
    if (!newInvoice.customerId || !newInvoice.items?.length || !newInvoice.invoiceNo) return;
    setIsSubmitting(true);

    let finalCustomerId = newInvoice.customerId!;
    if (finalCustomerId.startsWith("NEW:")) {
      const newName = finalCustomerId.slice("NEW:".length).trim();
      const newCust = { id: crypto.randomUUID(), name: newName, phone: "", openingBalance: 0 };
      if (addCustomer) addCustomer(newCust);
      finalCustomerId = newCust.id;
    }

    const selectedSlips = selectedSlipIds
      .map((id) => slips.find((s) => s.id === id))
      .filter((slip): slip is Slip => Boolean(slip));

    if (selectedSlips.length !== selectedSlipIds.length) {
      addToast("error", "One or more selected slips could not be found. Refresh and try again.");
      setIsSubmitting(false);
      return;
    }

    const invalidSlip = selectedSlips.find(
      (slip) =>
        slip.customerId !== finalCustomerId ||
        slip.status !== "Tallied" ||
        (slip.invoiceId && slip.invoiceId !== editingInvoiceId),
    );
    if (invalidSlip) {
      addToast("error", "Selected slips no longer match this customer or invoice.");
      setIsSubmitting(false);
      return;
    }

    let subTotal = 0, cgst = 0, sgst = 0;
    newInvoice.items.forEach((item) => {
      subTotal += item.amount;
      if (newInvoice.type === "GST") {
        const itemGst = item.amount * ((item.gstRate || 0) / 100);
        cgst += itemGst / 2;
        sgst += itemGst / 2;
      }
    });

    if (selectedSlips.length > 0) {
      const selectedSlipTotal = Math.round(selectedSlips.reduce((sum, slip) => sum + slip.totalAmount, 0));
      if (Math.abs(Math.round(subTotal) - selectedSlipTotal) > 1) {
        addToast("error", "Invoice item total must match the selected slip total before slips can be linked.");
        setIsSubmitting(false);
        return;
      }
    }

    cgst = Math.round(cgst * 100) / 100;
    sgst = Math.round(sgst * 100) / 100;
    const total = Math.round(subTotal + cgst + sgst);

    if (editingInvoiceId) {
      updateInvoice(editingInvoiceId, {
        invoiceNo: newInvoice.invoiceNo,
        date: newInvoice.date,
        customerId: finalCustomerId,
        type: newInvoice.type as "GST" | "Cash",
        items: newInvoice.items,
        subTotal, cgst, sgst, total,
        slipIds: selectedSlipIds,
      });
      const oldInvoice = invoices.find((inv) => inv.id === editingInvoiceId);
      if (oldInvoice?.slipIds) {
        oldInvoice.slipIds.forEach((id) => {
          if (!selectedSlipIds.includes(id)) updateSlip(id, { invoiceId: null as unknown as undefined });
        });
      }
      selectedSlipIds.forEach((id) => updateSlip(id, { invoiceId: editingInvoiceId }));
    } else {
      const newInvoiceId = crypto.randomUUID();
      const invoice: Invoice = {
        id: newInvoiceId,
        invoiceNo: newInvoice.invoiceNo,
        date: newInvoice.date!,
        customerId: finalCustomerId,
        type: newInvoice.type as "GST" | "Cash",
        items: newInvoice.items,
        subTotal, cgst, sgst, total,
        status: "Pending",
        slipIds: selectedSlipIds,
      };
      addInvoice(invoice);
      selectedSlipIds.forEach((id) => updateSlip(id, { invoiceId: newInvoiceId }));
    }

    setIsSubmitting(false);
    setShowGenerateModal(false);
  };

  const exportData = async (filteredInvoices: Invoice[]) => {
    if (isExporting) return;
    const rows = filteredInvoices.map((inv: Invoice) => ({
      invoiceNo: inv.invoiceNo,
      date: new Date(inv.date).toLocaleDateString("en-IN"),
      type: inv.type,
      customer: customers.find((c) => c.id === inv.customerId)?.name || "Cash Customer",
      subTotal: inv.subTotal.toFixed(2),
      cgst: inv.cgst.toFixed(2),
      sgst: inv.sgst.toFixed(2),
      total: inv.total.toFixed(2),
      status: inv.status,
    }));

    if (rows.length === 0) {
      addToast("warning", "No invoices match the current filters.");
      return;
    }

    setIsExporting(true);
    try {
      await downloadCSV(
        rows,
        { invoiceNo: "Invoice No", date: "Date", type: "Type", customer: "Customer",
          subTotal: "SubTotal", cgst: "CGST", sgst: "SGST", total: "Total", status: "Status" },
        `invoices_${new Date().toISOString().split("T")[0]}`,
      );
      addToast("success", `Exported ${rows.length} invoice${rows.length === 1 ? "" : "s"}.`);
    } catch {
      addToast("error", "Invoice export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedInvoices = JSON.parse(e.target?.result as string);
        if (Array.isArray(importedInvoices)) {
          let imported = 0, skipped = 0;
          importedInvoices.forEach((inv) => {
            if (!inv.id || !inv.invoiceNo) { skipped++; return; }
            const result = invoiceSchema.safeParse(inv);
            if (!result.success) { skipped++; return; }
            if (!invoices.find((existing) => existing.id === inv.id)) {
              addInvoice(inv);
              imported++;
            }
          });
          if (skipped > 0) {
            addToast("error", `Import complete: ${imported} added, ${skipped} rejected (invalid format).`);
          } else {
            addToast("success", `Import successful: ${imported} invoice(s) added.`);
          }
        }
      } catch {
        addToast("error", "Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = "";
  };

  return {
    // state
    showGenerateModal, setShowGenerateModal,
    isSubmitting,
    isExporting,
    editingInvoiceId,
    selectedSlipIds, setSelectedSlipIds,
    newInvoice, setNewInvoice,
    newItem, setNewItem,
    materials,
    unbilledSlips,
    // actions
    openCreateModal,
    openEditModal,
    handleAddItem,
    handleGenerate,
    exportData,
    importData,
    generateInvoiceNoForType,
  };
}
