import React from "react";
import { Invoice, InvoiceItem, Slip, Customer } from "../../types";
import { MobileModal } from "../../components/ui/MobileModal";
import { Combobox } from "../../components/ui/Combobox";

interface Material {
  id: string | number;
  name: string;
  defaultPrice: number;
  unit: string;
  hsnCode: string;
  gstRate: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingInvoiceId: string | null;
  newInvoice: Partial<Invoice>;
  setNewInvoice: (inv: Partial<Invoice>) => void;
  newItem: InvoiceItem;
  setNewItem: (item: InvoiceItem) => void;
  selectedSlipIds: string[];
  setSelectedSlipIds: (ids: string[]) => void;
  unbilledSlips: Slip[];
  materials: Material[];
  customers: Customer[];
  isSubmitting: boolean;
  onGenerate: () => void;
  onAddItem: () => void;
  generateInvoiceNoForType: (type: string) => string;
}

export function InvoiceCreateModal({
  isOpen, onClose, editingInvoiceId,
  newInvoice, setNewInvoice,
  newItem, setNewItem,
  selectedSlipIds, setSelectedSlipIds,
  unbilledSlips, materials, customers,
  isSubmitting, onGenerate, onAddItem,
  generateInvoiceNoForType,
}: Props) {
  return (
    <MobileModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingInvoiceId ? "Edit Invoice" : "Generate Invoice"}
      maxWidth="max-w-sm"
      mobileMode="taskSheet"
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
              onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNo: e.target.value })}
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
                const newType = e.target.value as "GST" | "Cash";
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
              ...customers.map((c) => ({ label: c.name, value: c.id })),
            ]}
            value={newInvoice.customerId || ""}
            onChange={(val) => setNewInvoice({ ...newInvoice, customerId: val })}
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
                  selectedSlipIds.forEach((id) => {
                    const slip = unbilledSlips.find((s) => s.id === id);
                    if (slip) {
                      const mat = slip.materialType;
                      if (!itemsMap.has(mat)) {
                        itemsMap.set(mat, {
                          materialType: mat,
                          quantity: 0,
                          rate: slip.ratePerUnit || materials.find((m) => m.name === mat)?.defaultPrice || 0,
                          amount: 0,
                          hsnCode: materials.find((m) => m.name === mat)?.hsnCode || "25171010",
                          gstRate: materials.find((m) => m.name === mat)?.gstRate || 5,
                        });
                      }
                      const item = itemsMap.get(mat)!;
                      item.quantity += slip.quantity;
                      item.amount += slip.totalAmount;
                    }
                  });
                  const newItems = Array.from(itemsMap.values()).map((item) => {
                    item.rate = item.quantity > 0 ? Number((item.amount / item.quantity).toFixed(2)) : 0;
                    return item;
                  });
                  setNewInvoice({ ...newInvoice, items: newItems });
                }}
                className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm"
              >
                Generate Items
              </button>
            </div>
            <div className="p-2 max-h-48 overflow-y-auto bg-white dark:bg-zinc-800 space-y-1">
              {unbilledSlips.map((slip) => (
                <label
                  key={slip.id}
                  className="flex items-center space-x-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedSlipIds.includes(slip.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSlipIds([...selectedSlipIds, slip.id]);
                      } else {
                        setSelectedSlipIds(selectedSlipIds.filter((id) => id !== slip.id));
                      }
                    }}
                    className="rounded text-primary-600 focus:ring-primary-500 bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600"
                  />
                  <div className="flex-1 flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-white mr-2">
                        {new Date(slip.date).toLocaleDateString()}
                      </span>
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
          <div className="p-2 bg-white dark:bg-zinc-800 grid grid-cols-2 gap-2 items-end">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Material</label>
              <select
                value={newItem.materialType}
                onChange={(e) => {
                  const mat = materials.find((m) => m.name === e.target.value);
                  setNewItem({
                    ...newItem,
                    materialType: e.target.value,
                    hsnCode: mat?.hsnCode,
                    gstRate: mat?.gstRate,
                    rate: mat?.defaultPrice || 0,
                  });
                }}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Qty</label>
              <input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Rate</label>
              <input
                type="number"
                value={newItem.rate}
                onChange={(e) => setNewItem({ ...newItem, rate: Number(e.target.value) })}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
              />
            </div>
            {newInvoice.type === "GST" && (
              <>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">HSN</label>
                  <input
                    type="text"
                    value={newItem.hsnCode}
                    onChange={(e) => setNewItem({ ...newItem, hsnCode: e.target.value })}
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">GST %</label>
                  <input
                    type="number"
                    value={newItem.gstRate}
                    onChange={(e) => setNewItem({ ...newItem, gstRate: Number(e.target.value) })}
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:border-primary-500 text-sm"
                  />
                </div>
              </>
            )}
            <button
              onClick={onAddItem}
              className="col-span-2 md:col-span-1 bg-zinc-900 text-white rounded-lg px-4 py-2 hover:bg-zinc-800 transition-colors text-sm font-medium w-full"
            >
              Add
            </button>
          </div>

          {newInvoice.items && newInvoice.items.length > 0 && (
            <>
              {/* Mobile list view */}
              <div className="md:hidden space-y-2 mt-4 px-2 pb-2">
                {newInvoice.items.map((it, idx) => {
                  const gstAmount = newInvoice.type === "GST" ? it.amount * ((it.gstRate || 0) / 100) : 0;
                  const total = Math.round(it.amount + gstAmount);
                  return (
                    <div key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 relative text-sm">
                      <button
                        onClick={() => setNewInvoice({ ...newInvoice, items: newInvoice.items?.filter((_, i) => i !== idx) })}
                        className="absolute top-3 right-3 text-rose-500 hover:text-rose-700 font-medium bg-white dark:bg-zinc-800 rounded px-2 py-0.5 text-xs"
                      >
                        Remove
                      </button>
                      <div className="font-bold text-zinc-900 dark:text-white pr-14">{it.materialType}</div>
                      <div className="text-zinc-600 dark:text-zinc-400 mt-1">
                        {it.quantity} x ₹{it.rate} = ₹{it.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                      {newInvoice.type === "GST" && (
                        <div className="text-xs text-zinc-500 mt-1 flex gap-2">
                          <span>HSN: {it.hsnCode}</span>
                          <span>GST: {it.gstRate}% (₹{gstAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })})</span>
                        </div>
                      )}
                      <div className="mt-2 text-right font-bold text-zinc-900 dark:text-white border-t border-zinc-200 dark:border-zinc-700/50 pt-2">
                        Total: ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto mt-4">
                <table className="w-full text-sm text-left border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Material</th>
                      {newInvoice.type === "GST" && (
                        <>
                          <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">HSN</th>
                          <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">GST %</th>
                        </>
                      )}
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Qty</th>
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Rate</th>
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">Amount</th>
                      {newInvoice.type === "GST" && (
                        <>
                          <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">CGST</th>
                          <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">SGST</th>
                        </>
                      )}
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">Total</th>
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
                          <td className="py-2 px-4 text-right">₹{it.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                          {newInvoice.type === "GST" && (
                            <>
                              <td className="py-2 px-4 text-right">₹{cgst.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td className="py-2 px-4 text-right">₹{sgst.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                            </>
                          )}
                          <td className="py-2 px-4 text-right font-medium text-zinc-900 dark:text-white">
                            ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <button
                              onClick={() => setNewInvoice({ ...newInvoice, items: newInvoice.items?.filter((_, i) => i !== idx) })}
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
                      <td colSpan={newInvoice.type === "GST" ? 8 : 4} className="py-3 px-4 text-right font-medium text-zinc-600 dark:text-zinc-300">
                        Subtotal:
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                        ₹{Math.round(newInvoice.items.reduce((sum, item) => sum + item.amount, 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </td>
                      <td></td>
                    </tr>
                    {newInvoice.type === "GST" && (
                      <>
                        <tr>
                          <td colSpan={8} className="py-1 px-4 text-right text-sm text-zinc-500 dark:text-zinc-400">Total CGST:</td>
                          <td className="py-1 px-4 text-right text-sm text-zinc-700 dark:text-zinc-200">
                            ₹{Math.round(newInvoice.items.reduce((sum, item) => sum + (item.amount * ((item.gstRate || 0) / 100)) / 2, 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={8} className="py-1 px-4 text-right text-sm text-zinc-500 dark:text-zinc-400">Total SGST:</td>
                          <td className="py-1 px-4 text-right text-sm text-zinc-700 dark:text-zinc-200">
                            ₹{Math.round(newInvoice.items.reduce((sum, item) => sum + (item.amount * ((item.gstRate || 0) / 100)) / 2, 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </td>
                          <td></td>
                        </tr>
                      </>
                    )}
                    <tr className="border-t border-zinc-200 dark:border-zinc-700">
                      <td colSpan={newInvoice.type === "GST" ? 8 : 4} className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                        Grand Total:
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-primary-600">
                        ₹{(() => {
                          let sub = 0, cgst = 0, sgst = 0;
                          newInvoice.items.forEach((it) => {
                            sub += it.amount;
                            if (newInvoice.type === "GST") {
                              const gst = it.amount * ((it.gstRate || 0) / 100);
                              cgst += gst / 2;
                              sgst += gst / 2;
                            }
                          });
                          return Math.round(sub + cgst + sgst).toLocaleString("en-IN", { maximumFractionDigits: 0 });
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
          onClick={onClose}
          className="px-6 py-2.5 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:bg-zinc-800 transition-colors font-medium text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onGenerate}
          disabled={isSubmitting || !newInvoice.customerId || !newInvoice.items?.length || !newInvoice.invoiceNo}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {editingInvoiceId ? "Save Changes" : "Generate & Save"}
        </button>
      </div>
    </MobileModal>
  );
}
