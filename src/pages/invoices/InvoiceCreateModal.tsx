import { Invoice, InvoiceItem, Slip, Customer } from "../../types";
import { MobileModal } from "../../components/ui/MobileModal";
import { Combobox } from "../../components/ui/Combobox";
import { formatVehicleNo, formatQuantity } from "../../lib/utils";
import { Download, MessageCircle, Printer, FileText, Loader2, X } from "lucide-react";

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
  submittingAction?: "download" | "whatsapp" | "print" | "create" | null;
  onGenerate: (action: "download" | "whatsapp" | "print" | "create") => void;
  onAddItem: () => void;
  generateInvoiceNoForType: (type: string) => string;
}

export function InvoiceCreateModal({
  isOpen, onClose, editingInvoiceId,
  newInvoice, setNewInvoice,
  newItem, setNewItem,
  selectedSlipIds, setSelectedSlipIds,
  unbilledSlips, materials, customers,
  isSubmitting, submittingAction, onGenerate, onAddItem,
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
              <div className="flex items-center gap-2">
                <span>Select Slips</span>
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = unbilledSlips.every((s) => selectedSlipIds.includes(s.id));
                    setSelectedSlipIds(allSelected ? [] : unbilledSlips.map((s) => s.id));
                  }}
                  className="text-[10px] font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline underline-offset-2"
                >
                  {unbilledSlips.every((s) => selectedSlipIds.includes(s.id)) ? "Clear All" : "Select All"}
                </button>
              </div>
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
                      <span className="text-zinc-500 dark:text-zinc-400">{formatVehicleNo(slip.vehicleNo)}</span>
                    </div>
                    <div className="flex space-x-4">
                      <span className="text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs">
                        {slip.materialType}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        {formatQuantity(slip.quantity)} {slip.measurementType.includes("Brass") ? "Brass" : "Ton"}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-800 p-3 space-y-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-1">Material</label>
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
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500 text-sm bg-zinc-50 dark:bg-zinc-900"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-1">Rate</label>
              <input
                type="number"
                value={newItem.rate}
                onChange={(e) => setNewItem({ ...newItem, rate: Number(e.target.value) })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500 text-sm bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
          </div>
          
          {newInvoice.type === "GST" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-1">HSN</label>
                <input
                  type="text"
                  value={newItem.hsnCode}
                  onChange={(e) => setNewItem({ ...newItem, hsnCode: e.target.value })}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500 text-sm bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-1">GST%</label>
                <input
                  type="number"
                  value={newItem.gstRate}
                  onChange={(e) => setNewItem({ ...newItem, gstRate: Number(e.target.value) })}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500 text-sm bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-1">Qty</label>
              <input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary-500 text-sm bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <button
              onClick={onAddItem}
              className="w-full bg-primary-600 text-white rounded-lg h-[38px] hover:bg-primary-700 transition-colors text-sm font-bold shadow-sm active:scale-[0.98]"
            >
              Add Item
            </button>
          </div>
              
              <div className="space-y-2">
                {newInvoice.items?.map((it, idx) => {
                  const gstAmount = newInvoice.type === "GST" ? it.amount * ((it.gstRate || 0) / 100) : 0;
                  const total = Math.round(it.amount + gstAmount);
                  return (
                    <div key={idx} className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700 p-3 shadow-sm relative group overflow-hidden">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-bold text-zinc-900 dark:text-white text-sm">{it.materialType}</div>
                        <button
                          onClick={() => setNewInvoice({ ...newInvoice, items: newInvoice.items?.filter((_, i) => i !== idx) })}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                        <div className="flex items-center gap-1">
                          <span className="opacity-60">Qty:</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{it.quantity}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="opacity-60">Rate:</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">₹{it.rate}</span>
                        </div>
                        {newInvoice.type === "GST" && (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="opacity-60">HSN:</span>
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{it.hsnCode}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="opacity-60">GST:</span>
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{it.gstRate}%</span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-50 dark:border-zinc-700/50">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Sub: ₹{it.amount.toLocaleString()}</span>
                        <div className="text-right">
                          <span className="text-sm font-black text-zinc-900 dark:text-white">₹{total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

        </div>
      </div>

      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3">
          {/* Left Half: Grand Total */}
          <div className="flex-1 bg-primary-600 text-white rounded-xl p-3 flex flex-col justify-center h-[76px] shadow-sm">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-2">Grand Total</span>
            <span className="text-xl font-black leading-none tracking-tight">
              ₹{(() => {
                let sub = 0, cgst = 0, sgst = 0;
                newInvoice.items?.forEach((it) => {
                  sub += it.amount;
                  if (newInvoice.type === "GST") {
                    const gst = it.amount * ((it.gstRate || 0) / 100);
                    cgst += gst / 2;
                    sgst += gst / 2;
                  }
                });
                return Math.round(sub + cgst + sgst).toLocaleString();
              })()}
            </span>
          </div>

          {/* Right Half: 4 Buttons Grid */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            <button
              onClick={() => onGenerate("download")}
              disabled={isSubmitting || !newInvoice.customerId || !newInvoice.items?.length}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-all active:scale-95 disabled:opacity-50"
            >
              {submittingAction === "download" ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
              ) : (
                <Download className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              )}
              <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-300">Download</span>
            </button>

            <button
              onClick={() => onGenerate("whatsapp")}
              disabled={isSubmitting || !newInvoice.customerId || !newInvoice.items?.length}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {submittingAction === "whatsapp" ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <MessageCircle className="w-4 h-4 text-emerald-600" />
              )}
              <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-300">Chat</span>
            </button>

            <button
              onClick={() => onGenerate("print")}
              disabled={isSubmitting || !newInvoice.customerId || !newInvoice.items?.length}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {submittingAction === "print" ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
              ) : (
                <Printer className="w-4 h-4 text-primary-600" />
              )}
              <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-300">Print</span>
            </button>

            <button
              onClick={() => onGenerate("create")}
              disabled={isSubmitting || !newInvoice.customerId || !newInvoice.items?.length}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-transparent dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {submittingAction === "create" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600 dark:text-zinc-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              )}
              <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-300 text-center leading-[1]">Save</span>
            </button>
          </div>
        </div>

        <div className="mt-2 flex justify-center">
          <button
            onClick={onClose}
            className="text-[10px] text-zinc-400 hover:text-zinc-600 font-bold uppercase tracking-widest px-4 py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </MobileModal>
  );
}
