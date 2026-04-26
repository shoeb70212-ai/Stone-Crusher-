import React, { useState, useEffect } from "react";
import { useErp } from "../../context/ErpContext";
import { Invoice, InvoiceItem } from "../../types";
import { Combobox } from "../ui/Combobox";
import { Plus, Trash2 } from "lucide-react";

export function CreateInvoiceForm({ onSuccess }: { onSuccess: (invoice?: Invoice) => void }) {
  const { invoices, customers, addInvoice, addCustomer, slips, updateSlip } = useErp();
  const [billedSlips, setBilledSlips] = useState<string[]>([]);

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

  const getNextNo = (type: "GST" | "Cash") => {
    const today = new Date();
    const yearStr = today.getFullYear().toString().slice(-2);
    const typeInvoices = invoices.filter(inv => inv.type === type);
    const nextNo = typeInvoices.length + 1;
    const prefix = type === "GST" ? "GST" : "CAS";
    return `${prefix}-${yearStr}-${nextNo.toString().padStart(4, "0")}`;
  };

  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    type: "GST",
    date: new Date().toISOString().split("T")[0],
    invoiceNo: getNextNo("GST"),
  });

  const getEmptyItem = (): InvoiceItem => ({
    materialType: materials[0].name,
    quantity: 0,
    rate: materials[0].defaultPrice,
    amount: 0,
    hsnCode: materials[0].hsnCode,
    gstRate: materials[0].gstRate,
  });

  const [items, setItems] = useState<InvoiceItem[]>([getEmptyItem()]);

  // Update item function
  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    if (field === "materialType") {
      const mat = materials.find((m) => m.name === value);
      if (mat) {
        item.hsnCode = mat.hsnCode;
        item.gstRate = mat.gstRate;
        item.rate = mat.defaultPrice;
      }
    }

    if (field === "quantity" || field === "rate" || field === "materialType") {
      item.amount = Math.round((Number(item.quantity) || 0) * (Number(item.rate) || 0));
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      
      if (field === 'materialType') {
         document.getElementById(`qty-${index}`)?.focus();
      } else if (field === 'quantity') {
         document.getElementById(`rate-${index}`)?.focus();
      } else if (field === 'rate' && newInvoice.type === 'Cash') {
         if (index === items.length - 1) {
            setItems(prev => [...prev, getEmptyItem()]);
            setTimeout(() => document.getElementById(`qty-${index + 1}`)?.focus(), 50);
         } else {
            document.getElementById(`qty-${index + 1}`)?.focus();
         }
      } else if (field === 'rate' && newInvoice.type === 'GST') {
         document.getElementById(`hsn-${index}`)?.focus();
      } else if (field === 'hsnCode') {
         document.getElementById(`gst-${index}`)?.focus();
      } else if (field === 'gstRate') {
         if (index === items.length - 1) {
            setItems(prev => [...prev, getEmptyItem()]);
            setTimeout(() => document.getElementById(`qty-${index + 1}`)?.focus(), 50);
         } else {
            document.getElementById(`qty-${index + 1}`)?.focus();
         }
      }
    }
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      setItems([getEmptyItem()]);
    } else {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const addNewItem = () => {
    setItems(prev => [...prev, getEmptyItem()]);
    setTimeout(() => document.getElementById(`qty-${items.length}`)?.focus(), 50);
  };

  const handleTypeChange = (type: "GST" | "Cash") => {
    setNewInvoice({
      ...newInvoice,
      type,
      invoiceNo: getNextNo(type)
    });
  };

  const handleLoadSlips = () => {
    if (!newInvoice.customerId || newInvoice.customerId === "CASH" || !customers.find(c => c.id === newInvoice.customerId)) {
       alert("Please select a saved customer first to load their unbilled slips.");
       return;
    }
    const uninvoicedSlips = slips.filter(s => s.customerId === newInvoice.customerId && s.status === "Tallied" && !s.invoiceId && !billedSlips.includes(s.id));
    
    if (uninvoicedSlips.length === 0) {
       alert("No un-billed Tallied slips found for this customer.");
       return;
    }
    
    const newItems: InvoiceItem[] = [];
    const justBilledIds: string[] = [];
    
    uninvoicedSlips.forEach(s => {
       const mat = materials.find((m) => m.name === s.materialType);
       
       let totalForSlip = s.quantity * s.ratePerUnit;
       // Add the main material item
       newItems.push({
          materialType: `${s.materialType} (Slip: ${s.id.slice(0, 5).toUpperCase()})`,
          quantity: s.quantity,
          rate: s.ratePerUnit,
          amount: totalForSlip,
          hsnCode: mat?.hsnCode || "25171010",
          gstRate: mat?.gstRate || 5,
       });

       // If there is freight, add it as a separate line item since freight has different HSN (996511)
       if (s.freightAmount && s.freightAmount > 0) {
          newItems.push({
             materialType: `Freight Charges (Slip: ${s.id.slice(0, 5).toUpperCase()})`,
             quantity: 1,
             rate: s.freightAmount,
             amount: s.freightAmount,
             hsnCode: "996511", // Transport services
             gstRate: newInvoice.type === "GST" ? 18 : 0,
          });
       }

       justBilledIds.push(s.id);
    });

    // Remove the empty placeholder if present and no other items exist
    const validExistingItems = items.filter(it => it.quantity > 0 || it.rate > 0);
    if (validExistingItems.length === 0 && newItems.length > 0) {
       setItems([...newItems, getEmptyItem()]);
    } else {
       // Insert before the last empty placeholder
       const lastWasEmpty = validExistingItems.length < items.length;
       setItems([...validExistingItems, ...newItems, ...(lastWasEmpty ? [getEmptyItem()] : [])]);
    }
    setBilledSlips([...billedSlips, ...justBilledIds]);
  };

  const handleGenerate = () => {
    const validItems = items.filter(it => it.quantity > 0 && it.amount > 0);
    if (
      !newInvoice.customerId ||
      !validItems.length ||
      !newInvoice.invoiceNo
    )
      return;

    let finalCustomerId = newInvoice.customerId;
    
    // Check if new customer
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

    let subTotal = 0;
    let cgst = 0;
    let sgst = 0;

    validItems.forEach((item) => {
      subTotal += item.amount;
      if (newInvoice.type === "GST") {
        const itemGst = item.amount * ((item.gstRate || 0) / 100);
        cgst += itemGst / 2;
        sgst += itemGst / 2;
      }
    });

    const total = subTotal + cgst + sgst;

    const invoice: Invoice = {
      id: "inv_" + Math.random().toString(36).substring(2, 11),
      invoiceNo: newInvoice.invoiceNo as string,
      date: newInvoice.date as string,
      customerId: finalCustomerId,
      type: newInvoice.type as "GST" | "Cash",
      items: validItems,
      subTotal,
      cgst,
      sgst,
      total,
      status: "Pending",
    };

    // Link slips
    billedSlips.forEach(slipId => {
      updateSlip(slipId, { invoiceId: invoice.id });
    });

    addInvoice(invoice);

    onSuccess(invoice);
  };

  const customerOptions = [
    { label: "Cash Sale", value: "CASH" },
    ...customers.map(c => ({ label: c.name, value: c.id }))
  ];

  return (
    <div className="p-4 sm:p-5 lg:p-6 space-y-6">
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
            onChange={(e) => handleTypeChange(e.target.value as any)}
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
            options={customerOptions}
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

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
          <span className="font-semibold text-sm text-zinc-700 dark:text-zinc-200">
            Bill Items
          </span>
          <button
            type="button"
            onClick={handleLoadSlips}
            className="text-xs px-3 py-1.5 bg-white border border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded font-medium transition-colors shadow-sm"
          >
            Load Unbilled Slips
          </button>
        </div>
        <div className="w-full">
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-800">
             {items.map((it, idx) => (
                <div key={idx} className="p-3 space-y-3 relative group">
                   <div className="flex justify-between items-start">
                     <div className="flex-1 mr-2">
                       <label className="text-xs font-semibold text-zinc-500 uppercase">Material / Desc</label>
                       <select
                         id={`m-material-${idx}`}
                         value={it.materialType}
                         onChange={(e) => updateItem(idx, "materialType", e.target.value)}
                         className="w-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm mt-1"
                       >
                         {materials.map((m) => (
                           <option key={m.id} value={m.name}>{m.name}</option>
                         ))}
                         {!materials.find(m => m.name === it.materialType) && (
                            <option value={it.materialType}>{it.materialType}</option>
                         )}
                       </select>
                     </div>
                     <button
                       onClick={() => removeItem(idx)}
                       className="text-zinc-400 hover:text-rose-500 p-1.5 rounded bg-zinc-100 dark:bg-zinc-700/50 mt-5"
                       title="Remove Item"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Qty</label>
                        <input
                           id={`m-qty-${idx}`}
                           type="number" min="0" value={it.quantity || ""}
                           onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                           placeholder="0"
                           className="w-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Rate</label>
                        <input
                           id={`m-rate-${idx}`}
                           type="number" min="0" value={it.rate || ""}
                           onChange={(e) => updateItem(idx, "rate", e.target.value)}
                           placeholder="0.00"
                           className="w-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm mt-1"
                        />
                      </div>
                   </div>

                   {newInvoice.type === "GST" && (
                      <div className="grid grid-cols-2 gap-3">
                         <div>
                          <label className="text-xs font-semibold text-zinc-500 uppercase">HSN</label>
                          <input
                             id={`m-hsn-${idx}`}
                             type="text" value={it.hsnCode || ""}
                             onChange={(e) => updateItem(idx, "hsnCode", e.target.value)}
                             className="w-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm mt-1"
                          />
                         </div>
                         <div>
                          <label className="text-xs font-semibold text-zinc-500 uppercase">GST %</label>
                          <input
                             id={`m-gst-${idx}`}
                             type="number" min="0" value={it.gstRate || ""}
                             onChange={(e) => updateItem(idx, "gstRate", e.target.value)}
                             className="w-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm mt-1"
                          />
                         </div>
                      </div>
                   )}

                   <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-900/50 p-2 rounded">
                      <span className="text-xs font-semibold text-zinc-500 uppercase">Amount</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 italic">₹{it.amount.toFixed(2)}</span>
                   </div>
                </div>
             ))}
          </div>

          <table className="w-full text-sm text-left hidden md:table">
            <thead className="bg-zinc-100/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 uppercase tracking-wide">
              <tr>
                <th className="py-2.5 px-3 min-w-[200px] font-semibold text-zinc-500 dark:text-zinc-400 text-xs">Material / Description</th>
                <th className="py-2.5 px-3 w-24 font-semibold text-zinc-500 dark:text-zinc-400 text-xs">Qty</th>
                <th className="py-2.5 px-3 w-32 font-semibold text-zinc-500 dark:text-zinc-400 text-xs text-right">Rate</th>
                {newInvoice.type === "GST" && (
                  <>
                    <th className="py-2.5 px-3 w-28 font-semibold text-zinc-500 dark:text-zinc-400 text-xs text-center">HSN</th>
                    <th className="py-2.5 px-3 w-20 font-semibold text-zinc-500 dark:text-zinc-400 text-xs text-center">GST %</th>
                  </>
                )}
                <th className="py-2.5 px-3 w-32 font-semibold text-zinc-500 dark:text-zinc-400 text-xs text-right">Amount</th>
                <th className="py-2.5 px-3 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50 bg-white dark:bg-zinc-800">
              {items.map((it, idx) => (
                <tr key={idx} className="group hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                  <td className="p-2">
                     <select
                       id={`material-${idx}`}
                       value={it.materialType}
                       onChange={(e) => updateItem(idx, "materialType", e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, idx, "materialType")}
                       className="w-full border-none bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm"
                     >
                       {materials.map((m) => (
                         <option key={m.id} value={m.name}>
                           {m.name}
                         </option>
                       ))}
                       {/* Allow for custom names loaded from slips directly */}
                       {!materials.find(m => m.name === it.materialType) && (
                          <option value={it.materialType}>{it.materialType}</option>
                       )}
                     </select>
                  </td>
                  <td className="p-2">
                     <input
                       id={`qty-${idx}`}
                       type="number"
                       min="0"
                       value={it.quantity || ""}
                       onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, idx, "quantity")}
                       placeholder="0.00"
                       className="w-full border border-zinc-200 dark:border-zinc-700 focus:border-primary-500 focus:bg-white bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm"
                     />
                  </td>
                  <td className="p-2">
                     <input
                       id={`rate-${idx}`}
                       type="number"
                       min="0"
                       value={it.rate || ""}
                       onChange={(e) => updateItem(idx, "rate", e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, idx, "rate")}
                       placeholder="0.00"
                       className="w-full text-right border border-zinc-200 dark:border-zinc-700 focus:border-primary-500 focus:bg-white bg-zinc-50 dark:bg-zinc-900 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm"
                     />
                  </td>
                  {newInvoice.type === "GST" && (
                    <>
                      <td className="p-2">
                         <input
                           id={`hsn-${idx}`}
                           type="text"
                           value={it.hsnCode || ""}
                           onChange={(e) => updateItem(idx, "hsnCode", e.target.value)}
                           onKeyDown={(e) => handleKeyDown(e, idx, "hsnCode")}
                           className="w-full text-center border-none bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm"
                         />
                      </td>
                      <td className="p-2">
                         <input
                           id={`gst-${idx}`}
                           type="number"
                           min="0"
                           value={it.gstRate || ""}
                           onChange={(e) => updateItem(idx, "gstRate", e.target.value)}
                           onKeyDown={(e) => handleKeyDown(e, idx, "gstRate")}
                           className="w-full text-center border-none bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 text-sm"
                         />
                      </td>
                    </>
                  )}
                  <td className="p-2 text-right">
                     <div className="px-2 py-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                        {it.amount.toFixed(2)}
                     </div>
                  </td>
                  <td className="p-2 text-center">
                     <button
                       onClick={() => removeItem(idx)}
                       className="text-zinc-400 hover:text-rose-500 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                       title="Remove Item"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="py-2 px-3">
             <button onClick={addNewItem} className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium flex items-center">
                 <Plus className="w-4 h-4 mr-1" /> Add Row
             </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleGenerate}
          className="bg-primary-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-primary-700 transition-colors shadow-md text-lg inline-flex items-center"
        >
          <span className="mr-2">Create Invoice &rarr;</span>
        </button>
      </div>
    </div>
  );
}
