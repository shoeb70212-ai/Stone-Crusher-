import React from "react";
import { Quotation, InvoiceItem, Customer } from "../../types";
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
  editingId: string | null;
  newQuotation: Partial<Quotation>;
  setNewQuotation: (q: Partial<Quotation>) => void;
  newItem: InvoiceItem;
  setNewItem: (item: InvoiceItem) => void;
  materials: Material[];
  customers: Customer[];
  isSubmitting: boolean;
  onSave: () => void;
  onAddItem: () => void;
  generateQuotationNo: () => string;
}

export function QuotationCreateModal({
  isOpen, onClose, editingId,
  newQuotation, setNewQuotation,
  newItem, setNewItem,
  materials, customers,
  isSubmitting, onSave, onAddItem,
  generateQuotationNo,
}: Props) {
  return (
    <MobileModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingId ? "Edit Quotation" : "New Quotation"}
      maxWidth="max-w-sm"
      mobileMode="taskSheet"
    >
      <div className="p-2 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
              Quotation No
            </label>
            <input
              type="text"
              value={newQuotation.quotationNo || ""}
              onChange={(e) => setNewQuotation({ ...newQuotation, quotationNo: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs bg-white dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
              Type
            </label>
            <select
              value={newQuotation.type}
              onChange={(e) => {
                const newType = e.target.value as "GST" | "Cash";
                setNewQuotation({
                  ...newQuotation,
                  type: newType,
                  quotationNo: !editingId ? generateQuotationNo() : newQuotation.quotationNo,
                });
              }}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs bg-white dark:bg-zinc-800"
            >
              <option value="GST">GST</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
              Date
            </label>
            <input
              type="date"
              value={newQuotation.date || ""}
              onChange={(e) => setNewQuotation({ ...newQuotation, date: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs bg-white dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
              Valid Until
            </label>
            <input
              type="date"
              value={newQuotation.validUntil || ""}
              onChange={(e) => setNewQuotation({ ...newQuotation, validUntil: e.target.value })}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs bg-white dark:bg-zinc-800"
            />
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
            value={newQuotation.customerId || (newQuotation.customerName ? `NEW: ${newQuotation.customerName}` : "")}
            onChange={(val) => setNewQuotation({ ...newQuotation, customerId: val })}
            allowCreate={true}
            placeholder="Search customer..."
          />
        </div>

        {/* Item builder */}
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
            {newQuotation.type === "GST" && (
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

          {/* Item list */}
          {newQuotation.items && newQuotation.items.length > 0 && (
            <>
              {/* Mobile view */}
              <div className="md:hidden space-y-2 mt-4 px-2 pb-2">
                {newQuotation.items.map((it, idx) => {
                  const gstAmount = newQuotation.type === "GST" ? it.amount * ((it.gstRate || 0) / 100) : 0;
                  const total = Math.round(it.amount + gstAmount);
                  return (
                    <div key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 relative text-sm">
                      <button
                        onClick={() => setNewQuotation({ ...newQuotation, items: newQuotation.items?.filter((_, i) => i !== idx) })}
                        className="absolute top-3 right-3 text-rose-500 hover:text-rose-700 font-medium bg-white dark:bg-zinc-800 rounded px-2 py-0.5 text-xs"
                      >
                        Remove
                      </button>
                      <div className="font-bold text-zinc-900 dark:text-white pr-14">{it.materialType}</div>
                      <div className="text-zinc-600 dark:text-zinc-400 mt-1">
                        {it.quantity} x ₹{it.rate} = ₹{it.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                      {newQuotation.type === "GST" && (
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

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto mt-4">
                <table className="w-full text-sm text-left border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Material</th>
                      {newQuotation.type === "GST" && (
                        <>
                          <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">HSN</th>
                          <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">GST %</th>
                        </>
                      )}
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Qty</th>
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300">Rate</th>
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">Amount</th>
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300 text-right">Total</th>
                      <th className="py-2 px-4 font-semibold text-zinc-600 dark:text-zinc-300"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {newQuotation.items.map((it, idx) => {
                      const gstAmount = newQuotation.type === "GST" ? it.amount * ((it.gstRate || 0) / 100) : 0;
                      const total = Math.round(it.amount + gstAmount);
                      return (
                        <tr key={idx}>
                          <td className="py-2 px-4">{it.materialType}</td>
                          {newQuotation.type === "GST" && (
                            <>
                              <td className="py-2 px-4">{it.hsnCode}</td>
                              <td className="py-2 px-4">{it.gstRate}%</td>
                            </>
                          )}
                          <td className="py-2 px-4">{it.quantity}</td>
                          <td className="py-2 px-4">₹{it.rate}</td>
                          <td className="py-2 px-4 text-right">₹{it.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 px-4 text-right font-medium text-zinc-900 dark:text-white">
                            ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <button
                              onClick={() => setNewQuotation({ ...newQuotation, items: newQuotation.items?.filter((_, i) => i !== idx) })}
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
                    <tr className="border-t border-zinc-200 dark:border-zinc-700">
                      <td colSpan={newQuotation.type === "GST" ? 6 : 4} className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">
                        Grand Total:
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-primary-600">
                        ₹{(() => {
                          let sub = 0, cgst = 0, sgst = 0;
                          newQuotation.items!.forEach((it) => {
                            sub += it.amount;
                            if (newQuotation.type === "GST") {
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

        {/* Notes / Terms */}
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
            Notes / Terms
          </label>
          <textarea
            value={newQuotation.notes || ""}
            onChange={(e) => setNewQuotation({ ...newQuotation, notes: e.target.value })}
            rows={3}
            placeholder="Terms and conditions, special instructions..."
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs bg-white dark:bg-zinc-800 resize-none"
          />
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
          onClick={onSave}
          disabled={isSubmitting || (!newQuotation.customerId && !newQuotation.customerName) || !newQuotation.items?.length || !newQuotation.quotationNo}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {editingId ? "Save Changes" : "Create Quotation"}
        </button>
      </div>
    </MobileModal>
  );
}
