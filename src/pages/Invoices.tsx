import React, { useState, useEffect } from "react";
import { useErp } from "../context/ErpContext";
import { Invoice, InvoiceItem } from "../types";
import { Plus, Download, FileText, Upload, Printer } from "lucide-react";
import { Combobox } from "../components/ui/Combobox";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { PrintInvoiceModal } from "../components/forms/PrintInvoiceModal";
import { ToWords } from 'to-words';

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: false,
    currencyOptions: {
      name: 'Rupee',
      plural: 'Rupees',
      symbol: '₹',
      fractionalUnit: {
        name: 'Paisa',
        plural: 'Paise',
        symbol: '',
      },
    }
  }
});

const getPrimaryRGB = (color: string) => {
  switch(color) {
    case 'blue': return [37, 99, 235];
    case 'violet': return [124, 58, 237];
    case 'rose': return [225, 29, 72];
    case 'amber': return [217, 119, 6];
    case 'emerald':
    default: return [4, 120, 87];
  }
};

export function Invoices() {
  const { invoices, customers, addInvoice, updateInvoice, companySettings, addCustomer } = useErp();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState<"All" | "GST" | "Cash">("All");

  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    type: "GST",
    date: new Date().toISOString().split("T")[0],
    invoiceNo: "",
    items: [],
  });

  const handleStatusChange = (invId: string, newStatus: string) => {
    if (newStatus === "Cancelled") {
      setInvoiceToCancel(invId);
    } else {
      updateInvoice(invId, { status: newStatus as any });
    }
  };

  const [newItem, setNewItem] = useState<InvoiceItem>({
    materialType: "10mm",
    quantity: 0,
    rate: 0,
    amount: 0,
    hsnCode: "25171010",
    gstRate: 5,
  });

  const materials = [
    {
      id: 1,
      name: "10mm",
      defaultPrice: 450,
      unit: "Ton",
      hsnCode: "25171010",
      gstRate: 5,
    },
    {
      id: 2,
      name: "20mm",
      defaultPrice: 480,
      unit: "Ton",
      hsnCode: "25171010",
      gstRate: 5,
    },
    {
      id: 3,
      name: "40mm",
      defaultPrice: 400,
      unit: "Ton",
      hsnCode: "25171010",
      gstRate: 5,
    },
    {
      id: 4,
      name: "Dust",
      defaultPrice: 350,
      unit: "Ton",
      hsnCode: "25171010",
      gstRate: 5,
    },
    {
      id: 5,
      name: "GSB",
      defaultPrice: 300,
      unit: "Ton",
      hsnCode: "25171020",
      gstRate: 5,
    },
    {
      id: 6,
      name: "Boulders",
      defaultPrice: 250,
      unit: "Ton",
      hsnCode: "25169090",
      gstRate: 5,
    },
  ];

  // Calculate rate based on customer history
  useEffect(() => {
    if (newInvoice.customerId && newItem.materialType) {
      // Find the last invoice for this customer containing this material
      const customerInvoices = invoices
        .filter(inv => inv.customerId === newInvoice.customerId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      let historicalRate = 0;
      for (const inv of customerInvoices) {
        const item = inv.items.find((i: InvoiceItem) => i.materialType === newItem.materialType);
        if (item) {
          historicalRate = item.rate;
          break;
        }
      }

      const mat = materials.find((m) => m.name === newItem.materialType);
      
      setNewItem((prev) => ({
        ...prev,
        rate: historicalRate > 0 ? historicalRate : (mat?.defaultPrice || 0)
      }));
    }
  }, [newInvoice.customerId, newItem.materialType]);

  const handleAddItem = () => {
    if (newItem.quantity > 0 && newItem.rate > 0) {
      setNewInvoice({
        ...newInvoice,
        items: [
          ...(newInvoice.items || []),
          { ...newItem, amount: newItem.quantity * newItem.rate },
        ],
      });
      setNewItem({ ...newItem, quantity: 0, rate: 0, amount: 0 }); // reset
    }
  };

  const openCreateModal = () => {
    const today = new Date();
    const yearStr = today.getFullYear().toString().slice(-2);
    const nextNo = invoices.length + 1;
    const generatedNo = `INV-${yearStr}-${nextNo.toString().padStart(4, "0")}`;

    setEditingInvoiceId(null);
    setNewInvoice({
      type: "GST",
      date: new Date().toISOString().split("T")[0],
      invoiceNo: generatedNo,
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

  const handleGenerate = () => {
    if (!newInvoice.customerId || !newInvoice.items?.length || !newInvoice.invoiceNo) return;

    let finalCustomerId = newInvoice.customerId;
    
    // Check if new customer
    if (finalCustomerId !== "CASH" && !customers.find(c => c.id === finalCustomerId)) {
      const newCust = {
        id: "cust_" + Math.random().toString(36).substr(2, 9),
        name: finalCustomerId, // The combobox passed the new name directly
        phone: "",
        openingBalance: 0
      };
      if (addCustomer) addCustomer(newCust);
      finalCustomerId = newCust.id;
    }

    let subTotal = 0;
    let cgst = 0;
    let sgst = 0;

    newInvoice.items.forEach((item) => {
      subTotal += item.amount;
      if (newInvoice.type === "GST") {
        const itemGst = item.amount * ((item.gstRate || 0) / 100);
        cgst += itemGst / 2;
        sgst += itemGst / 2;
      }
    });

    const total = Math.round(subTotal + cgst + sgst);

    if (editingInvoiceId) {
      updateInvoice(editingInvoiceId, {
        invoiceNo: newInvoice.invoiceNo,
        date: newInvoice.date,
        customerId: finalCustomerId,
        type: newInvoice.type as "GST" | "Cash",
        items: newInvoice.items,
        subTotal,
        cgst,
        sgst,
        total,
      });
    } else {
      const invoice: Invoice = {
        id: "inv_" + Math.random().toString(36).substr(2, 9),
        invoiceNo: newInvoice.invoiceNo,
        date: newInvoice.date!,
        customerId: finalCustomerId,
        type: newInvoice.type as "GST" | "Cash",
        items: newInvoice.items,
        subTotal,
        cgst,
        sgst,
        total,
        status: "Pending",
      };
      addInvoice(invoice);
    }
    
    setShowGenerateModal(false);
  };

  const downloadPDF = (invoice: Invoice) => {
    setPrintInvoice(invoice);
    return;
    // Legacy jsPDF formatting bypassed in favor of PrintInvoiceModal 
    /*
    const customer = customers.find((c) => c.id === invoice.customerId);
    const primaryRGB = getPrimaryRGB(companySettings.primaryColor || 'emerald');

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(5, 5, 200, 287);

    // Add Watermark
    let watermarkConfig = companySettings.invoiceWatermark || "None";
    let watermarkText = "";
    if (watermarkConfig === "Custom") watermarkText = companySettings.invoiceWatermarkText || "";
    else if (watermarkConfig === "Company Name") watermarkText = companySettings.name;
    else if (watermarkConfig === "Status") watermarkText = invoice.status.toUpperCase();
    
    if (watermarkText) {
      doc.setFontSize(watermarkText.length > 15 ? 40 : 80);
      doc.setTextColor(240, 240, 240); // very light grey
      doc.setFont("helvetica", "bold");
      doc.text(watermarkText, 105, 160, { align: "center", angle: 45 });
    }

    // Header strip - top colored border
    doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]); // theme color
    doc.rect(0, 0, 210, 8, 'F');
    
    // Top right label
    doc.setFontSize(28);
    doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.text(invoice.type === "GST" ? "TAX INVOICE" : "INVOICE", 195, 25, { align: "right" });

    // Company info (Left)
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // zinc-900
    doc.setFont("helvetica", "bold");
    doc.text(companySettings.name, 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(companySettings.address || '', 80);
    doc.text(addressLines, 14, 32);
    let currentY = 32 + (addressLines.length * 5);
    if (companySettings.phone) {
      doc.text(`Phone: ${companySettings.phone}`, 14, currentY);
      currentY += 5;
    }
    if (invoice.type === "GST" && companySettings.gstin) {
      doc.text(`GSTIN: ${companySettings.gstin}`, 14, currentY);
      currentY += 5;
    }

    // Invoice info (Right)
    doc.setFontSize(10);
    const rightInfoY = 40;
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice No:`, 140, rightInfoY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.invoiceNo, 195, rightInfoY, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice Date:`, 140, rightInfoY + 6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(new Date(invoice.date).toLocaleDateString("en-IN"), 195, rightInfoY + 6, { align: "right" });

    const invoiceShowDueDate = companySettings.invoiceShowDueDate !== false;
    if (invoiceShowDueDate) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Due Date:`, 140, rightInfoY + 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      // Assuming due 15 days later if paid is not strict
      const dueDate = new Date(invoice.date);
      dueDate.setDate(dueDate.getDate() + 15);
      doc.text(dueDate.toLocaleDateString("en-IN"), 195, rightInfoY + 12, { align: "right" });
    }

    const statusY = rightInfoY + (invoiceShowDueDate ? 18 : 12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Status:`, 140, statusY);
    doc.setFont("helvetica", "bold");
    if (invoice.status === 'Paid') doc.setTextColor(16, 185, 129); // green
    else if (invoice.status === 'Cancelled') doc.setTextColor(244, 63, 94); // red
    else doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]); // theme
    doc.text(invoice.status, 195, statusY, { align: "right" });

    // Bill To (Left below company info)
    const billToY = Math.max(currentY + 15, 65);
    
    doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.rect(14, billToY - 5, 85, 6, 'F');
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`BILL TO`, 16, billToY - 0.5);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(customer?.name || "Cash Customer", 14, billToY + 6);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    let customerY = billToY + 12;
    if (customer?.phone) {
      doc.text(`Phone: ${customer.phone}`, 14, customerY);
      customerY += 5;
    }
    customerY += 2; // Small padding

    // Table
    const tableColumn = ["#", "Item Description"];
    if (invoice.type === "GST") tableColumn.push("HSN/SAC", "GST%");
    tableColumn.push("Qty", "Rate", "Amount");
    if (invoice.type === "GST") tableColumn.push("CGST", "SGST", "Total");

    const tableRows = invoice.items.map((item, index) => {
      const row = [(index + 1).toString(), item.materialType];
      if (invoice.type === "GST") row.push(item.hsnCode || "-", (item.gstRate || 0).toString() + "%");
      row.push(item.quantity.toString(), item.rate.toFixed(2), item.amount.toFixed(2));
      if (invoice.type === "GST") {
        const gstAmount = item.amount * ((item.gstRate || 0) / 100);
        const cgst = gstAmount / 2;
        const sgst = gstAmount / 2;
        const total = item.amount + cgst + sgst;
        row.push(cgst.toFixed(2), sgst.toFixed(2), total.toFixed(2));
      }
      return row;
    });

    const tableStartY = Math.max(customerY + 10, billToY + 20);

    autoTable(doc, {
      startY: tableStartY,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: primaryRGB as [number, number, number], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 4, textColor: [15, 23, 42], lineWidth: 0.1, lineColor: [226, 232, 240] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: invoice.type === "GST" ? {
        0: { cellWidth: 10, halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' }, 
        5: { halign: 'right' }, 
        6: { halign: 'right' }, 
        7: { halign: 'right' }, 
        8: { halign: 'right' }, 
        9: { halign: 'right', fontStyle: 'bold' } 
      } : {
        0: { cellWidth: 10, halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    const bottomY = Math.max(finalY + 15, 220); // anchor at bottom but allow pushing down
    
    // Line to box the footer
    doc.setDrawColor(200, 200, 200);
    doc.line(5, bottomY - 5, 205, bottomY - 5);
    
    // Bottom Section Grid
    // We will place amount in words and bank details on the left, and grand totals on the right.
    
    // Totals Box (Right Side)
    // We use a small table for totals for clean alignment
    const totalsColumns = ["", ""];
    const totalsRows = [];
    totalsRows.push(["Sub Total:", invoice.subTotal.toFixed(2)]);
    if (invoice.type === "GST") {
      totalsRows.push(["CGST:", invoice.cgst.toFixed(2)]);
      totalsRows.push(["SGST:", invoice.sgst.toFixed(2)]);
    }
    
    autoTable(doc, {
      startY: bottomY,
      margin: { left: 130 },
      tableWidth: 66,
      head: [],
      body: totalsRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2, textColor: [71, 85, 105], halign: 'right' },
      columnStyles: {
        0: { fontStyle: 'normal' },
        1: { fontStyle: 'bold', textColor: [15, 23, 42] }
      }
    });

    const currentTotalsY = (doc as any).lastAutoTable.finalY + 2;
    doc.setFillColor(241, 245, 249);
    doc.rect(130, currentTotalsY, 66, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Grand Total:", 135, currentTotalsY + 5.5);
    doc.text(`Rs. ${invoice.total.toFixed(2)}`, 194, currentTotalsY + 5.5, { align: 'right' });


    // Left side: Words, Bank Details, Terms
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Amount in Words:", 14, bottomY + 3);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const amountWords = toWords.convert(invoice.total);
    const amountWordsLines = doc.splitTextToSize(amountWords + " Only", 100);
    doc.text(amountWordsLines, 14, bottomY + 8);

    let termsY = bottomY + 15 + (amountWordsLines.length * 4);
    
    // Bank Details
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Bank Details", 14, termsY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Bank Name: ${companySettings.bankName || 'N/A'}`, 14, termsY + 5);
    doc.text(`A/C No: ${companySettings.accountNumber || 'N/A'}`, 14, termsY + 10);
    doc.text(`IFSC: ${companySettings.ifscCode || 'N/A'}`, 14, termsY + 15);
    doc.text(`Branch: ${companySettings.branchName || 'N/A'}`, 14, termsY + 20);

    // Terms
    let conditionY = termsY + 30;
    
    // Authorized Signatory on the right
    const signY = conditionY - 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`For ${companySettings.name}`, 196, signY, { align: 'right' });
    
    doc.setDrawColor(203, 213, 225);
    doc.line(146, signY + 15, 196, signY + 15);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Authorized Signatory", 196, signY + 20, { align: 'right' });

        
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]); // theme colored terms header looks premium
    doc.text("Terms & Conditions", 14, conditionY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("1. Subject to local jurisdiction.", 14, conditionY + 5);
    doc.text("2. Delayed payments will incur interest @18% p.a.", 14, conditionY + 10);
    doc.text("3. Make all cheques payable to the company name above.", 14, conditionY + 15);

    // Footer
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(10);
    doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.text(companySettings.receiptFooter || "Thank You For Your Business!", 105, 285, { align: "center" });

    // Bottom decorative bar
    doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]); // theme color
    doc.rect(0, 292, 210, 5, 'F');

    doc.save(`${invoice.invoiceNo}.pdf`);
    */
  };

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(invoices, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `invoices_export_${new Date().getTime()}.json`);
    dlAnchorElem.click();
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedInvoices = JSON.parse(e.target?.result as string);
        if (Array.isArray(importedInvoices)) {
          importedInvoices.forEach(inv => {
            // Basic validation
            if (inv.id && inv.invoiceNo && inv.items) {
               // Only add if not already present
               if (!invoices.find(existing => existing.id === inv.id)) {
                 addInvoice(inv);
               }
            }
          });
          alert("Import successful!");
        }
      } catch (error) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // clear input
    if (event.target) event.target.value = '';
  };

  const filteredInvoices = invoices.filter(
    (inv) => activeTab === "All" || inv.type === activeTab,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Invoicing
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Generate and manage invoices for your dispatches.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <label className="flex-1 md:flex-none justify-center flex items-center px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900/50 transition-colors shadow-sm font-medium cursor-pointer">
            <Upload className="w-4 h-4 mr-2 shrink-0" />
            <span className="whitespace-nowrap">Import</span>
            <input type="file" accept=".json" className="hidden" onChange={importData} />
          </label>
          <button 
            onClick={exportData}
            className="flex-1 md:flex-none justify-center flex items-center px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900/50 transition-colors shadow-sm font-medium"
          >
            <Download className="w-4 h-4 mr-2 shrink-0" />
            <span className="whitespace-nowrap">Export</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex-1 md:flex-none justify-center flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-medium w-full md:w-auto mt-1 md:mt-0"
          >
            <Plus className="w-5 h-5 mr-2 shrink-0" />
            <span className="whitespace-nowrap">Generate Invoice</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
        <div className="border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 flex flex-wrap gap-2 text-sm font-medium">
          {["All", "GST", "Cash"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-white dark:bg-zinc-800 text-primary-700 shadow-sm border border-zinc-200 dark:border-zinc-700"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white"
              }`}
            >
              {tab} Invoices
            </button>
          ))}
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-700/50">
           {filteredInvoices.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                No invoices found. Generate one to get started.
              </div>
           ) : (
             filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-3 bg-white dark:bg-zinc-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        {inv.invoiceNo}
                        <span className="text-[10px] text-zinc-500 font-normal px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700/50">
                          {inv.type}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">{new Date(inv.date).toLocaleDateString()}</div>
                    </div>
                    <select
                      value={inv.status}
                      onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                      className={`px-2 py-1.5 rounded-full text-xs font-semibold appearance-none outline-none cursor-pointer text-center ${
                        inv.status === "Paid"
                          ? "bg-primary-100 text-primary-700"
                          : inv.status === "Cancelled"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                     <div className="text-zinc-600 dark:text-zinc-300">
                        {customers.find((c) => c.id === inv.customerId)?.name || "Cash Customer"}
                     </div>
                     <div className="font-bold text-zinc-900 dark:text-white text-lg">
                        ₹{inv.total.toLocaleString()}
                     </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-700">
                    <button
                      onClick={() => openEditModal(inv)}
                      className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium text-sm px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPrintInvoice(inv)}
                      className="text-zinc-600 hover:text-primary-600 dark:text-zinc-300 font-medium text-sm px-3 py-1 bg-zinc-100 dark:bg-zinc-700/50 rounded-lg flex items-center"
                    >
                      <Printer className="w-4 h-4 mr-1" />
                      Print / Download
                    </button>
                  </div>
                </div>
             ))
           )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse ">
            <thead>
              <tr className="bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500">
                <th className="font-semibold text-sm py-4 px-6">Invoice #</th>
                <th className="font-semibold text-sm py-4 px-6">Date</th>
                <th className="font-semibold text-sm py-4 px-6">Customer</th>
                <th className="font-semibold text-sm py-4 px-6 text-right">
                  Amount
                </th>
                <th className="font-semibold text-sm py-4 px-6 text-center">
                  Status
                </th>
                <th className="font-semibold text-sm py-4 px-6 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900/50 transition-colors"
                >
                  <td className="py-4 px-6 font-medium text-zinc-900 dark:text-white">
                    {inv.invoiceNo}{" "}
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400 font-normal px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      {inv.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-zinc-500 dark:text-zinc-400">
                    {new Date(inv.date).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6">
                    {customers.find((c) => c.id === inv.customerId)?.name ||
                      "Cash Customer"}
                  </td>
                  <td className="py-4 px-6 font-semibold text-zinc-900 dark:text-white text-right">
                    ₹{inv.total.toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <select
                      value={inv.status}
                      onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold appearance-none outline-none cursor-pointer border-r-4 border-transparent ${
                        inv.status === "Paid"
                          ? "bg-primary-100 text-primary-700"
                          : inv.status === "Cancelled"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="py-4 px-6 text-right space-x-3">
                    <button
                      onClick={() => openEditModal(inv)}
                      className="text-indigo-500 hover:text-indigo-700 transition-colors text-sm font-medium"
                      title="Edit Invoice"
                    >
                      <i className="lucide-edit" />
                      Edit
                    </button>
                    <button
                      onClick={() => setPrintInvoice(inv)}
                      className="text-zinc-500 hover:text-primary-600 transition-colors text-sm font-medium"
                      title="Print / Download Invoice"
                    >
                      <Printer className="w-5 h-5 inline mr-1" />
                      <span className="hidden sm:inline">Print / Download</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    No invoices found. Generate one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl max-w-3xl w-full mx-2 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-3 md:p-5 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
              <h3 className="font-bold font-display text-lg text-zinc-900 dark:text-white">
                {editingInvoiceId ? "Edit Invoice" : "Generate Invoice"}
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-2 hover:bg-zinc-200 rounded-full text-zinc-500 dark:text-zinc-400 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-3 md:p-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
                    Invoice No
                  </label>
                  <input
                    type="text"
                    value={newInvoice.invoiceNo || ""}
                    onChange={(e) =>
                      setNewInvoice({ ...newInvoice, invoiceNo: e.target.value })
                    }
                    className="w-full border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
                    Invoice Type
                  </label>
                  <select
                    value={newInvoice.type}
                    onChange={(e) =>
                      setNewInvoice({
                        ...newInvoice,
                        type: e.target.value as any,
                      })
                    }
                    className="w-full border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white dark:bg-zinc-800"
                  >
                    <option value="GST">GST Invoice</option>
                    <option value="Cash">Cash Invoice</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
                    Customer
                  </label>
                  <Combobox
                    options={[
                      { label: "Cash Sale", value: "CASH" },
                      ...customers.map(c => ({ label: c.name, value: c.id }))
                    ]}
                    value={newInvoice.customerId || ""}
                    onChange={(val) => {
                      const existing = customers.find(c => c.name.toLowerCase() === val.toLowerCase());
                      setNewInvoice({ ...newInvoice, customerId: existing ? existing.id : val });
                    }}
                    allowCreate={true}
                    placeholder="Search or Create Customer..."
                  />
                </div>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 font-semibold text-sm text-zinc-700 dark:text-zinc-200">
                  Add Items
                </div>
                <div className={`p-4 bg-white dark:bg-zinc-800 grid grid-cols-2 gap-3 items-end ${newInvoice.type === 'GST' ? 'md:grid-cols-8' : 'md:grid-cols-6'}`}>
                  <div className="col-span-2">
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Material
                    </label>
                    <select
                      value={newItem.materialType}
                      onChange={(e) => {
                        const mat = materials.find(
                          (m) => m.name === e.target.value,
                        );
                        setNewItem({
                          ...newItem,
                          materialType: e.target.value,
                          hsnCode: mat?.hsnCode,
                          gstRate: mat?.gstRate,
                          rate: mat?.defaultPrice || 0,
                        });
                      }}
                      className="w-full border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          quantity: Number(e.target.value),
                        })
                      }
                      className="w-full border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Rate
                    </label>
                    <input
                      type="number"
                      value={newItem.rate}
                      onChange={(e) =>
                        setNewItem({ ...newItem, rate: Number(e.target.value) })
                      }
                      className="w-full border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
                    />
                  </div>
                  {newInvoice.type === "GST" && (
                    <>
                      <div>
                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                          HSN
                        </label>
                        <input
                          type="text"
                          value={newItem.hsnCode}
                          onChange={(e) =>
                            setNewItem({ ...newItem, hsnCode: e.target.value })
                          }
                          className="w-full border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                          GST %
                        </label>
                        <input
                          type="number"
                          value={newItem.gstRate}
                          onChange={(e) =>
                            setNewItem({ ...newItem, gstRate: Number(e.target.value) })
                          }
                          className="w-full border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
                        />
                      </div>
                    </>
                  )}
                  <button
                    onClick={handleAddItem}
                    className="col-span-2 md:col-span-1 bg-zinc-900 text-white rounded-lg px-4 py-2 hover:bg-zinc-800 transition-colors text-sm font-medium w-full"
                  >
                    Add
                  </button>
                </div>
                {newInvoice.items && newInvoice.items.length > 0 && (
                  <>
                  {/* Mobile list view */}
                  <div className="md:hidden space-y-2 mt-4">
                    {newInvoice.items.map((it, idx) => {
                      const gstAmount = newInvoice.type === "GST" ? it.amount * ((it.gstRate || 0) / 100) : 0;
                      const total = Math.round(it.amount + gstAmount);
                      return (
                        <div key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 relative text-sm">
                          <button onClick={() => setNewInvoice({...newInvoice, items: newInvoice.items?.filter((_, i) => i !== idx)})} className="absolute top-3 right-3 text-rose-500 hover:text-rose-700 font-medium bg-white dark:bg-zinc-800 rounded px-2 py-0.5 text-xs">Remove</button>
                          <div className="font-bold text-zinc-900 dark:text-white pr-14">{it.materialType}</div>
                          <div className="text-zinc-600 dark:text-zinc-400 mt-1">
                             {it.quantity} x ₹{it.rate} = ₹{it.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </div>
                          {newInvoice.type === "GST" && (
                            <div className="text-xs text-zinc-500 mt-1 flex gap-2">
                               <span>HSN: {it.hsnCode}</span>
                               <span>GST: {it.gstRate}% (₹{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                            </div>
                          )}
                          <div className="mt-2 text-right font-bold text-zinc-900 dark:text-white border-t border-zinc-200 dark:border-zinc-700/50 pt-2">
                             Total: ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Desktop table view */}
                  <div className="hidden md:block overflow-x-auto mt-4">
                    <table className="w-full text-sm text-left border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                      <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
                      <tr>
                        <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">
                          Material
                        </th>
                        {newInvoice.type === "GST" && (
                          <>
                            <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">
                              HSN
                            </th>
                            <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">
                              GST %
                            </th>
                          </>
                        )}
                        <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">
                          Qty
                        </th>
                        <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">
                          Rate
                        </th>
                        <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">
                          Amount
                        </th>
                        {newInvoice.type === "GST" && (
                          <>
                            <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">
                              CGST
                            </th>
                            <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">
                              SGST
                            </th>
                          </>
                        )}
                        <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">
                          Total
                        </th>
                        <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {newInvoice.items.map((it, idx) => {
                        const gstAmount = newInvoice.type === "GST" ? it.amount * ((it.gstRate || 0) / 100) : 0;
                        const cgst = gstAmount / 2;
                        const sgst = gstAmount / 2;
                        const total = Math.round(it.amount + cgst + sgst);
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-4">{it.materialType}</td>
                            {newInvoice.type === "GST" && (
                              <>
                                <td className="py-2 px-4">{it.hsnCode}</td>
                                <td className="py-2 px-4">{it.gstRate}%</td>
                              </>
                            )}
                            <td className="py-2 px-4">{it.quantity}</td>
                            <td className="py-2 px-4">₹{it.rate}</td>
                            <td className="py-2 px-4 text-right">₹{it.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            {newInvoice.type === "GST" && (
                              <>
                                <td className="py-2 px-4 text-right">₹{cgst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                <td className="py-2 px-4 text-right">₹{sgst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                              </>
                            )}
                            <td className="py-2 px-4 text-right font-medium text-zinc-900 dark:text-white">
                              ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2 px-4 text-right">
                              <button 
                                onClick={() => setNewInvoice({...newInvoice, items: newInvoice.items?.filter((_, i) => i !== idx)})}
                                className="text-rose-500 hover:text-rose-700 text-xs px-2 py-1 rounded hover:bg-rose-50"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-700">
                      <tr>
                        <td colSpan={newInvoice.type === "GST" ? 8 : 4} className="py-3 px-4 text-right font-medium text-zinc-600 dark:text-zinc-300">Subtotal:</td>
                        <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                          ₹{Math.round(newInvoice.items.reduce((sum, item) => sum + item.amount, 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td></td>
                      </tr>
                      {newInvoice.type === "GST" && (
                        <>
                          <tr>
                            <td colSpan={8} className="py-1 px-4 text-right text-sm text-zinc-500 dark:text-zinc-400">Total CGST:</td>
                            <td className="py-1 px-4 text-right text-sm text-zinc-700 dark:text-zinc-200">
                              ₹{Math.round(newInvoice.items.reduce((sum, item) => sum + (item.amount * ((item.gstRate || 0) / 100)) / 2, 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td></td>
                          </tr>
                          <tr>
                            <td colSpan={8} className="py-1 px-4 text-right text-sm text-zinc-500 dark:text-zinc-400">Total SGST:</td>
                            <td className="py-1 px-4 text-right text-sm text-zinc-700 dark:text-zinc-200">
                              ₹{Math.round(newInvoice.items.reduce((sum, item) => sum + (item.amount * ((item.gstRate || 0) / 100)) / 2, 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td></td>
                          </tr>
                        </>
                      )}
                      <tr className="border-t border-zinc-200 dark:border-zinc-700">
                        <td colSpan={newInvoice.type === "GST" ? 8 : 4} className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">Grand Total:</td>
                        <td className="py-3 px-4 text-right font-bold text-primary-600">
                          ₹{(() => {
                            let sub = 0, cgst = 0, sgst = 0;
                            newInvoice.items.forEach(it => {
                              sub += it.amount;
                              if (newInvoice.type === "GST") {
                                const gst = it.amount * ((it.gstRate || 0) / 100);
                                cgst += gst / 2;
                                sgst += gst / 2;
                              }
                            });
                            return Math.round(sub + cgst + sgst).toLocaleString('en-IN', { maximumFractionDigits: 0 });
                          })()}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 md:p-5 border-t border-zinc-100 dark:border-zinc-700 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-6 py-2.5 border border-zinc-300 dark:border-zinc-600 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:bg-zinc-800 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!newInvoice.customerId || !newInvoice.items?.length || !newInvoice.invoiceNo}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingInvoiceId ? "Save Changes" : "Generate & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!invoiceToCancel}
        title="Cancel Invoice"
        message="Are you sure you want to cancel this invoice? This action cannot be undone."
        confirmText="Cancel Invoice"
        onConfirm={() => {
          if (invoiceToCancel) {
            updateInvoice(invoiceToCancel, { status: "Cancelled" });
          }
        }}
        onCancel={() => setInvoiceToCancel(null)}
      />

      {printInvoice && (
        <PrintInvoiceModal 
          invoice={printInvoice} 
          customer={customers.find(c => c.id === printInvoice.customerId)}
          onClose={() => setPrintInvoice(null)} 
        />
      )}
    </div>
  );
}
