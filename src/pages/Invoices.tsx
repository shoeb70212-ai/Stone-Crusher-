import React, { useState, useEffect, useMemo } from "react";
import { useErp } from "../context/ErpContext";
import { Invoice, InvoiceItem } from "../types";
import { Plus, Download, FileText, Upload, Printer } from "lucide-react";
import { Combobox } from "../components/ui/Combobox";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { PrintInvoiceModal } from "../components/forms/PrintInvoiceModal";
import { MobileModal } from "../components/ui/MobileModal";
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
  const { invoices, customers, slips, addInvoice, updateInvoice, updateSlip, companySettings, addCustomer } = useErp();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState<"All" | "GST" | "Cash">("All");

  const [filterCustomerId, setFilterCustomerId] = useState<string>("All");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selectedSlipIds, setSelectedSlipIds] = useState<string[]>([]);
  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    type: "GST",
    date: new Date().toISOString().split("T")[0],
    invoiceNo: "",
    items: [],
  });

  const unbilledSlips = useMemo(() => {
    if (!newInvoice.customerId || newInvoice.customerId === "CASH") return [];
    return slips.filter(
      (s) =>
        s.customerId === newInvoice.customerId &&
        (s.status === "Pending" || s.status === "Tallied") &&
        (!s.invoiceId || s.invoiceId === editingInvoiceId)
    );
  }, [slips, newInvoice.customerId, editingInvoiceId]);

  useEffect(() => {
    if (editingInvoiceId) {
      const editingInvoice = invoices.find(inv => inv.id === editingInvoiceId);
      if (editingInvoice && editingInvoice.slipIds) {
        setSelectedSlipIds(editingInvoice.slipIds);
      } else {
        setSelectedSlipIds([]);
      }
    } else {
      setSelectedSlipIds([]);
    }
  }, [newInvoice.customerId, editingInvoiceId, invoices]);

  const handleStatusChange = (invId: string, newStatus: string) => {
    if (newStatus === "Cancelled") {
      setInvoiceToCancel(invId);
    } else {
      updateInvoice(invId, { status: newStatus as Invoice["status"] });
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
    // Fallback defaults if no materials configured
    return [
      { id: 1, name: "10mm", defaultPrice: 450, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
      { id: 2, name: "20mm", defaultPrice: 480, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
      { id: 3, name: "40mm", defaultPrice: 400, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
      { id: 4, name: "Dust", defaultPrice: 350, unit: "Ton", hsnCode: "25171010", gstRate: 5 },
      { id: 5, name: "GSB", defaultPrice: 300, unit: "Ton", hsnCode: "25171020", gstRate: 5 },
      { id: 6, name: "Boulders", defaultPrice: 250, unit: "Ton", hsnCode: "25169090", gstRate: 5 },
    ];
  }, [companySettings.materials]);

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
  }, [newInvoice.customerId, newItem.materialType, invoices, materials]);

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

  const generateInvoiceNoForType = (type: string) => {
    const today = new Date();
    const yearStr = today.getFullYear().toString().slice(-2);
    const prefix = type === "GST" ? "GST" : "CASH";
    // Extract the highest existing number for this type to prevent collisions on deletion
    const typeInvoices = invoices.filter(inv => inv.type === type);
    let maxNo = 0;
    typeInvoices.forEach(inv => {
      const match = inv.invoiceNo.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNo) maxNo = num;
      }
    });
    const nextNo = maxNo + 1;
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

  const handleGenerate = () => {
    if (!newInvoice.customerId || !newInvoice.items?.length || !newInvoice.invoiceNo) return;

    let finalCustomerId = newInvoice.customerId;
    
    // Check if new customer
    if (finalCustomerId !== "CASH" && !customers.find(c => c.id === finalCustomerId)) {
      const newCust = {
        id: "cust_" + Math.random().toString(36).substring(2, 11),
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
        slipIds: selectedSlipIds,
      });

      // Remove invoiceId from unselected slips
      const oldInvoice = invoices.find(inv => inv.id === editingInvoiceId);
      if (oldInvoice && oldInvoice.slipIds) {
        oldInvoice.slipIds.forEach(id => {
          if (!selectedSlipIds.includes(id)) {
            updateSlip(id, { invoiceId: undefined });
          }
        });
      }
      // Add invoiceId to newly selected slips
      selectedSlipIds.forEach(id => updateSlip(id, { invoiceId: editingInvoiceId }));

    } else {
      const newInvoiceId = "inv_" + Math.random().toString(36).substring(2, 11);
      const invoice: Invoice = {
        id: newInvoiceId,
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
        slipIds: selectedSlipIds,
      };
      addInvoice(invoice);
      selectedSlipIds.forEach(id => updateSlip(id, { invoiceId: newInvoiceId }));
    }
    
    setShowGenerateModal(false);
  };

  const downloadPDF = (invoice: Invoice) => {
    setPrintInvoice(invoice);
  };
  const exportData = () => {
    // Generate CSV for Chartered Accountant
    const headers = [
      "Invoice No",
      "Date",
      "Type",
      "Customer Name",
      "SubTotal",
      "CGST",
      "SGST",
      "Total Amount",
      "Status"
    ];

    const csvRows = [headers.join(",")];

    filteredInvoices.forEach(inv => {
      const customerName = customers.find(c => c.id === inv.customerId)?.name || "Cash Customer";
      const row = [
        inv.invoiceNo,
        new Date(inv.date).toLocaleDateString("en-IN"),
        inv.type,
        `"${customerName}"`,
        inv.subTotal.toFixed(2),
        inv.cgst.toFixed(2),
        inv.sgst.toFixed(2),
        inv.total.toFixed(2),
        inv.status
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", csvContent);
    dlAnchorElem.setAttribute("download", `invoices_export_${new Date().toISOString().split('T')[0]}.csv`);
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
    (inv) => {
      const matchTab = activeTab === "All" || inv.type === activeTab;
      const matchCustomer = filterCustomerId === "All" || inv.customerId === filterCustomerId;
      const matchStart = !startDate || inv.date >= startDate;
      const matchEnd = !endDate || inv.date <= endDate;
      return matchTab && matchCustomer && matchStart && matchEnd;
    }
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
            Invoicing
          </h2>
          <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Generate and manage invoices.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Secondary actions – icon-only on mobile */}
          <label className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm font-medium cursor-pointer text-sm active:scale-95">
            <Upload className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">Import JSON</span>
            <input type="file" accept=".json" className="hidden" onChange={importData} />
          </label>
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm font-medium text-sm active:scale-95"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">Export CSV</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3 py-2 md:px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm font-medium text-sm active:scale-95"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">New Invoice</span>
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

        <div className="border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 bg-white dark:bg-zinc-800 flex flex-wrap gap-4 items-center text-sm">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-zinc-500 font-medium">Customer:</span>
            <select
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="All">All Customers</option>
              <option value="CASH">Cash Customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-zinc-500 font-medium">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-zinc-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Mobile View */}
        <div className={`${companySettings.mobileLayout === 'Compact' ? 'hidden' : 'md:hidden divide-y divide-zinc-100 dark:divide-zinc-700/50'}`}>
{filteredInvoices.length === 0 ? (
               <div className="py-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                 No invoices found
               </div>
            ) : (
              <div className="space-y-1">
              {filteredInvoices.map((inv) => (
                 <div key={inv.id} className="p-2.5 bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                       <div>
                         <div className="font-bold text-zinc-900 dark:text-white text-xs">
                           {inv.invoiceNo}
                           <span className="ml-1.5 text-[9px] text-zinc-500 font-normal px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700/50">
                             {inv.type}
                           </span>
                         </div>
                         <div className="text-[10px] text-zinc-500">{new Date(inv.date).toLocaleDateString()}</div>
                       </div>
                     </div>
                     <div className="flex items-center gap-2">
                       <span className="font-bold text-zinc-900 dark:text-white text-xs">
                         ₹{inv.total.toLocaleString()}
                       </span>
                       <select
                         value={inv.status}
                         onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                         className={`px-1.5 py-0.5 rounded text-[9px] font-semibold appearance-none outline-none cursor-pointer ${
                           inv.status === "Paid"
                             ? "bg-primary-100 text-primary-700"
                             : inv.status === "Cancelled"
                               ? "bg-rose-100 text-rose-700"
                               : "bg-amber-100 text-amber-700"
                         }`}
                       >
                         <option value="Pending">P</option>
                         <option value="Paid">✓</option>
                         <option value="Cancelled">✕</option>
                       </select>
                     </div>
                   </div>
                   <div className="flex justify-between items-center mt-1">
                     <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                       {customers.find((c) => c.id === inv.customerId)?.name || "Cash"}
                     </div>
                     <div className="flex gap-1">
                       <button
                         onClick={() => openEditModal(inv)}
                         className="text-indigo-600 dark:text-indigo-400 font-medium text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded"
                       >
                         Edit
                       </button>
                       <button
                         onClick={() => setPrintInvoice(inv)}
                         className="text-zinc-600 dark:text-zinc-300 font-medium text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700/50 rounded flex items-center"
                       >
                         <Printer className="w-3 h-3 mr-0.5" />
                         Print
                       </button>
                     </div>
                   </div>
                  </div>
               ))}
            </div>
            )}
        </div>

        {/* Desktop View */}
        <div className={`${companySettings.mobileLayout === 'Compact' ? 'block' : 'hidden md:block'} overflow-x-auto`}>
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

      <MobileModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title={editingInvoiceId ? "Edit Invoice" : "Generate Invoice"}
        maxWidth="max-w-sm"
      >
        <div className="p-2 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
                    Invoice No
                  </label>
                  <input
                    type="text"
                    value={newInvoice.invoiceNo || ""}
                    onChange={(e) =>
                      setNewInvoice({ ...newInvoice, invoiceNo: e.target.value })
                    }
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs bg-white dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
                    Type
                  </label>
                  <select
                    value={newInvoice.type}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setNewInvoice({
                        ...newInvoice,
                        type: newType,
                        invoiceNo: !editingInvoiceId ? generateInvoiceNoForType(newType) : newInvoice.invoiceNo,
                      });
                    }}
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs bg-white dark:bg-zinc-800"
                  >
                    <option value="GST">GST</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
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
                  placeholder="Search customer..."
                />
              </div>

              {unbilledSlips.length > 0 && (
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 px-2 py-2 border-b border-zinc-200 dark:border-zinc-700 font-semibold text-xs text-zinc-700 dark:text-zinc-200 flex justify-between items-center">
                    <span>Select Slips</span>
                    <button
                      onClick={() => {
                        const itemsMap = new Map<string, InvoiceItem>();
                        selectedSlipIds.forEach(id => {
                           const slip = unbilledSlips.find(s => s.id === id);
                           if (slip) {
                              const mat = slip.materialType;
                              if (!itemsMap.has(mat)) {
                                 itemsMap.set(mat, {
                                    materialType: mat,
                                    quantity: 0,
                                    rate: slip.ratePerUnit || materials.find(m => m.name === mat)?.defaultPrice || 0,
                                    amount: 0,
                                    hsnCode: materials.find(m => m.name === mat)?.hsnCode || "25171010",
                                    gstRate: materials.find(m => m.name === mat)?.gstRate || 5
                                 });
                              }
                              const item = itemsMap.get(mat)!;
                              item.quantity += slip.quantity;
                              item.amount += slip.totalAmount;
                           }
                        });
                        const newItems = Array.from(itemsMap.values()).map(item => {
                          item.rate = item.quantity > 0 ? Number((item.amount / item.quantity).toFixed(2)) : 0;
                          return item;
                        });
                        setNewInvoice(prev => ({ ...prev, items: newItems }));
                      }}
                      className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm"
                    >
                      Generate Items
                    </button>
                  </div>
                  <div className="p-2 max-h-48 overflow-y-auto bg-white dark:bg-zinc-800 space-y-1">
                    {unbilledSlips.map(slip => (
                      <label key={slip.id} className="flex items-center space-x-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                        <input
                          type="checkbox"
                          checked={selectedSlipIds.includes(slip.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSlipIds(prev => [...prev, slip.id]);
                            } else {
                              setSelectedSlipIds(prev => prev.filter(id => id !== slip.id));
                            }
                          }}
                          className="rounded text-primary-600 focus:ring-primary-500 bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600"
                        />
                        <div className="flex-1 flex justify-between items-center text-sm">
                          <div>
                            <span className="font-medium text-zinc-900 dark:text-white mr-2">{new Date(slip.date).toLocaleDateString()}</span>
                            <span className="text-zinc-500 dark:text-zinc-400">{slip.vehicleNo}</span>
                          </div>
                          <div className="flex space-x-4">
                            <span className="text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs">
                              {slip.materialType}
                            </span>
                            <span className="font-medium text-zinc-900 dark:text-white">
                              {slip.quantity} {slip.measurementType.includes("Brass") ? "Brass" : "Ton"}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 px-2 py-2 border-b border-zinc-200 dark:border-zinc-700 font-semibold text-xs text-zinc-700 dark:text-zinc-200">
                  Add Items
                </div>
                <div className={`p-2 bg-white dark:bg-zinc-800 grid grid-cols-2 gap-2 items-end`}>
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
        </MobileModal>

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
