import React, { useState } from "react";
import { Slip } from "../../types";
import { X, Printer } from "lucide-react";
import { useErp } from "../../context/ErpContext";
import { openPdfInNewTab, downloadPdf } from "../../lib/print-utils";

export function PrintSlipModal({ slip, onClose }: { slip: Slip; onClose: () => void }) {
  const { companySettings, customers } = useErp();
  const [format, setFormat] = useState(companySettings.slipFormat || "Thermal-58mm");

  const primaryColorHex: Record<string, string> = {
    emerald: "#10b981", blue: "#3b82f6", violet: "#8b5cf6",
    rose: "#f43f5e", amber: "#f59e0b",
  };
  const borderColor = primaryColorHex[companySettings.primaryColor || "emerald"] ?? "#10b981";


  return (
    <div className="fixed inset-0 bg-zinc-900/80 flex items-center justify-center md:p-4 z-50 overflow-hidden">
      <div className={`bg-white dark:bg-zinc-800 md:rounded-2xl w-full h-full md:h-auto shadow-xl flex flex-col md:max-h-[90vh] ${format === 'A4' ? 'max-w-3xl' : 'max-w-sm'}`}>
        <div className="p-4 border-b flex justify-between items-center print:hidden">
          <h3 className="font-bold text-zinc-900 dark:text-white">Print Loading Token</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900 p-4">
          <div
            id="print-area"
            className="text-black bg-white mx-auto relative p-2 md:p-4"
            style={{ width: format === 'A4' ? '794px' : (format === 'Thermal-58mm' ? '180px' : '240px') }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: ${format === 'A4' ? 'A4' : format === 'Thermal-58mm' ? '58mm auto' : '80mm auto'};
                margin: 0;
              }
            }
          `}} />
          <div className="text-center mb-2 border-b border-black pb-2" style={format === 'A4' ? { borderColor } : undefined}>
            {companySettings.logo && (
               <img src={companySettings.logo} alt="Logo" className={`${format === 'A4' ? 'h-16' : 'h-8'} object-contain mx-auto mb-1 grayscale`} />
            )}
            <h1 className={`${format === 'A4' ? 'text-4xl' : 'text-sm'} font-bold uppercase tracking-wider print:text-2xl`}>
              {companySettings.name || "CrushTrack"}
            </h1>
            <p className="text-[9px] md:text-sm font-medium mt-0.5">
              {companySettings.address || "Stone Crushing & Minerals"}
            </p>
            <p className="text-[8px] md:text-xs mt-1 font-mono bg-black text-white inline-block px-1.5 py-0.5 uppercase">
              Gate Pass
            </p>
          </div>

          <table className={`w-full font-mono mt-2 mb-2 border-collapse border border-black ${format === 'Thermal-58mm' ? 'text-[8px]' : 'text-[10px] md:text-xs'}`}>
            <tbody>
              <tr>
                <td className="border border-black p-1 font-bold">Token</td>
                <td className="border border-black p-1">#{slip.id.toUpperCase().slice(0,6)}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">Date</td>
                <td className="border border-black p-1">{new Date(slip.date).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">Vehicle</td>
                <td className="border border-black p-1 font-bold">{slip.vehicleNo}</td>
              </tr>
              {slip.driverName && (
                <tr>
                  <td className="border border-black p-1 font-bold">Driver</td>
                  <td className="border border-black p-1 font-bold">
                    {slip.driverName}{slip.driverPhone ? ` (${slip.driverPhone.slice(-4)})` : ''}
                  </td>
                </tr>
              )}
              {slip.operatorName && (
                <tr>
                  <td className="border border-black p-1 font-bold">Operator</td>
                  <td className="border border-black p-1">{slip.operatorName}</td>
                </tr>
              )}
              {slip.loaderName && (
                <tr>
                  <td className="border border-black p-1 font-bold">Loader</td>
                  <td className="border border-black p-1">{slip.loaderName}</td>
                </tr>
              )}
              <tr>
                <td className="border border-black p-1 font-bold">Customer</td>
                <td className="border border-black p-1 font-bold">
                  {
                    (() => {
                      if (slip.customerId === 'CASH' || !slip.customerId) return 'Counter Sale';
                      const cust = customers.find(c => c.id === slip.customerId);
                      return cust ? cust.name.slice(0, 12) : slip.customerId;
                    })()
                  }
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">Material</td>
                <td className="border border-black p-1 font-bold">{slip.materialType}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">Qty</td>
                <td className="border border-black p-1 font-bold">
                  {slip.quantity.toFixed(1)}{" "}
                  {slip.measurementType === "Volume (Brass)" ? "Br" : "T"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">Rate</td>
                <td className="border border-black p-1">₹{slip.ratePerUnit.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">Total</td>
                <td className="border border-black p-1 font-bold">₹{slip.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              </tr>
              {(slip.amountPaid ?? 0) > 0 && (
                <>
                  <tr>
                    <td className="border border-black p-1 font-bold text-green-700">Paid</td>
                    <td className="border border-black p-1 font-bold text-green-700">₹{slip.amountPaid!.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 font-bold">Balance</td>
                    <td className="border border-black p-1 font-bold">₹{Math.max(0, slip.totalAmount - slip.amountPaid!).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <div className="mt-2 pt-2 border-t border-black flex justify-between items-end text-[9px] md:text-xs font-mono">
            <div className="text-center">
              <div className="border-t border-black pt-1 px-1 md:px-2">
                Auth
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-1 px-1 md:px-2">
                Driver
              </div>
            </div>
          </div>
          <p className="text-[8px] text-center mt-2 italic text-zinc-500 font-mono">
            {companySettings.receiptFooter || "Thank you!"}
          </p>
        </div>
          </div>

        <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 print:hidden flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => {
                const el = document.getElementById('print-area');
                if (el) {
                  downloadPdf(el, `Slip-${slip.id}.pdf`);
                  setTimeout(() => onClose(), 500);
                }
              }}
              className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-2 rounded-lg font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Download
            </button>
            <button
              onClick={() => {
                // Open window synchronously to bypass popup blocker
                const win = window.open('', '_blank');
                const printContent = document.getElementById('print-area')?.innerHTML;
                if (printContent) {
                  openPdfInNewTab(printContent, win);
                  setTimeout(() => onClose(), 500);
                } else if (win) {
                  win.close();
                }
              }}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
