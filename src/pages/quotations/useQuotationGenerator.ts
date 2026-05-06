import { useState, useEffect, useMemo, useCallback } from "react";
import { useErp } from "../../context/ErpContext";
import { Quotation, InvoiceItem, Invoice } from "../../types";
import { useToast } from "../../components/ui/Toast";
import { generateId } from "../../lib/utils";

export function useQuotationGenerator() {
  const {
    quotations, customers, invoices, companySettings,
    addQuotation, updateQuotation,
    addInvoice, updateSlip, addCustomer,
  } = useErp();
  const { addToast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuotation, setNewQuotation] = useState<Partial<Quotation>>({
    type: "GST",
    date: new Date().toISOString().split("T")[0],
    validUntil: "",
    quotationNo: "",
    items: [],
    notes: "",
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

  // Pre-fill rate from customer's quotation/invoice history.
  useEffect(() => {
    if (newQuotation.customerId && newItem.materialType) {
      const allDocs = [
        ...quotations.map((q) => ({ customerId: q.customerId, date: q.date, items: q.items })),
        ...invoices.map((inv) => ({ customerId: inv.customerId, date: inv.date, items: inv.items })),
      ]
        .filter((d) => d.customerId === newQuotation.customerId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let historicalRate = 0;
      for (const doc of allDocs) {
        const item = doc.items.find((i: InvoiceItem) => i.materialType === newItem.materialType);
        if (item) { historicalRate = item.rate; break; }
      }
      const mat = materials.find((m) => m.name === newItem.materialType);
      setNewItem((prev) => ({
        ...prev,
        rate: historicalRate > 0 ? historicalRate : (mat?.defaultPrice || 0),
      }));
    }
  }, [newQuotation.customerId, newItem.materialType, quotations, invoices, materials]);

  const generateQuotationNo = useCallback((snapshot = quotations) => {
    const today = new Date();
    const yearStr = today.getFullYear().toString().slice(-2);
    const prefix = "QT";
    const existingNos = new Set(snapshot.map((q) => q.quotationNo));
    let maxNo = 0;
    snapshot.forEach((q) => {
      const match = q.quotationNo.match(/(\d+)$/);
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
  }, [quotations]);

  const getDefaultValidUntil = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  };

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setNewQuotation({
      type: "GST",
      date: new Date().toISOString().split("T")[0],
      validUntil: getDefaultValidUntil(),
      quotationNo: generateQuotationNo(),
      items: [],
      notes: companySettings.termsAndConditions || "",
    });
    setNewItem({ ...materials[0], quantity: 0, rate: materials[0].defaultPrice, amount: 0, materialType: materials[0].name });
    setShowModal(true);
  }, [generateQuotationNo, materials, companySettings.termsAndConditions]);

  const openEditModal = useCallback((quotation: Quotation) => {
    setEditingId(quotation.id);
    setNewQuotation(quotation);
    setShowModal(true);
  }, []);

  const handleAddItem = useCallback(() => {
    if (newItem.quantity > 0 && newItem.rate > 0) {
      setNewQuotation((prev) => ({
        ...prev,
        items: [...(prev.items || []), { ...newItem, amount: newItem.quantity * newItem.rate }],
      }));
      const mat = materials.find((m) => m.name === newItem.materialType);
      setNewItem({ ...newItem, quantity: 0, rate: mat?.defaultPrice || 0, amount: 0 });
    }
  }, [newItem, materials]);

  const handleSave = useCallback(() => {
    if (isSubmitting) return;
    if ((!newQuotation.customerId && !newQuotation.customerName) || !newQuotation.items?.length || !newQuotation.quotationNo) return;
    setIsSubmitting(true);

    let finalCustomerId: string | undefined = newQuotation.customerId!;
    let finalCustomerName: string | undefined = newQuotation.customerName;

    if (finalCustomerId?.startsWith("NEW:")) {
      finalCustomerName = finalCustomerId.slice("NEW:".length).trim();
      finalCustomerId = undefined;
    } else if (finalCustomerId === "CASH") {
      finalCustomerName = "Cash Customer";
      finalCustomerId = undefined;
    } else if (finalCustomerId) {
      const cust = customers.find(c => c.id === finalCustomerId);
      if (cust) finalCustomerName = cust.name;
    }

    let subTotal = 0, cgst = 0, sgst = 0;
    newQuotation.items!.forEach((item) => {
      subTotal += item.amount;
      if (newQuotation.type === "GST") {
        const itemGst = item.amount * ((item.gstRate || 0) / 100);
        cgst += itemGst / 2;
        sgst += itemGst / 2;
      }
    });
    cgst = Math.round(cgst * 100) / 100;
    sgst = Math.round(sgst * 100) / 100;
    const total = Math.round(subTotal + cgst + sgst);

    if (editingId) {
      updateQuotation(editingId, {
        quotationNo: newQuotation.quotationNo,
        date: newQuotation.date,
        validUntil: newQuotation.validUntil,
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        type: newQuotation.type as "GST" | "Cash",
        items: newQuotation.items!,
        subTotal, cgst, sgst, total,
        notes: newQuotation.notes,
      });
    } else {
      const quotation: Quotation = {
        id: generateId(),
        quotationNo: newQuotation.quotationNo!,
        date: newQuotation.date!,
        validUntil: newQuotation.validUntil,
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        type: newQuotation.type as "GST" | "Cash",
        items: newQuotation.items!,
        subTotal, cgst, sgst, total,
        status: "Draft",
        notes: newQuotation.notes,
      };
      addQuotation(quotation);
    }

    setIsSubmitting(false);
    setShowModal(false);
  }, [isSubmitting, newQuotation, editingId, addQuotation, updateQuotation, addCustomer]);

  /** Convert a quotation into a formal invoice. */
  const handleConvertToInvoice = useCallback((quotation: Quotation) => {
    if (quotation.convertedInvoiceId) {
      addToast("warning", "This quotation has already been converted to an invoice.");
      return;
    }

    // Generate a new invoice number
    const today = new Date();
    const yearStr = today.getFullYear().toString().slice(-2);
    const prefix = quotation.type === "GST" ? "GST" : "CASH";
    let maxNo = 0;
    invoices.forEach((inv) => {
      const match = inv.invoiceNo.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNo) maxNo = num;
      }
    });
    const invoiceNo = `${prefix}-${yearStr}-${(maxNo + 1).toString().padStart(4, "0")}`;

    let finalCustomerId = quotation.customerId;
    if (!finalCustomerId) {
      const newCust = { id: generateId(), name: quotation.customerName || "Unknown Customer", phone: "", openingBalance: 0 };
      if (addCustomer) addCustomer(newCust);
      finalCustomerId = newCust.id;
    }

    const newInvoice: Invoice = {
      id: generateId(),
      invoiceNo,
      date: new Date().toISOString().split("T")[0],
      customerId: finalCustomerId,
      type: quotation.type,
      items: [...quotation.items],
      subTotal: quotation.subTotal,
      cgst: quotation.cgst,
      sgst: quotation.sgst,
      total: quotation.total,
      status: "Pending",
    };

    addInvoice(newInvoice);
    updateQuotation(quotation.id, {
      status: "Accepted",
      convertedInvoiceId: newInvoice.id,
    });

    addToast("success", `Invoice ${invoiceNo} created from quotation ${quotation.quotationNo}.`);
  }, [invoices, addInvoice, updateQuotation, addToast]);

  return {
    showModal, setShowModal,
    isSubmitting,
    editingId,
    newQuotation, setNewQuotation,
    newItem, setNewItem,
    materials,
    openCreateModal,
    openEditModal,
    handleAddItem,
    handleSave,
    handleConvertToInvoice,
    generateQuotationNo,
  };
}
