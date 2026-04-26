import React, { useState } from "react";
import { Slip } from "../../types";
import { X, Printer } from "lucide-react";
import { useErp } from "../../context/ErpContext";
import { openPdfBackend, downloadPdfBackend } from "../../lib/print-utils";

export function PrintSlipModal({ slip, onClose }: { slip: Slip; onClose: () => void }) {
  const { companySettings, customers } = useErp();
  const [format, setFormat] = useState(companySettings.slipFormat || "Thermal-80mm");
  
  let printWidthClass = "max-w-sm"; // default for 80mm
  if (format === "A4") printWidthClass = "max-w-3xl";
  if (format === "Thermal-58mm") printWidthClass = "max-w-[58mm] text-[10px]";

  return (
    <div className="fixed inset-0 bg-zinc-900/80 flex items-center justify-center p-4 z-50">
      <div className={`bg-white dark:bg-zinc-800 rounded-2xl w-full shadow-xl flex flex-col max-h-[90vh] ${format === 'A4' ? 'max-w-3xl' : 'max-w-sm'}`}>
        <div className="p-4 border-b flex justify-between items-center print:hidden">
          <h3 className="font-bold text-zinc-900 dark:text-white">Print Loading Token</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          id="print-area"
          className="p-4 md:p-6 text-black bg-white dark:bg-white flex-1 overflow-y-auto"
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: ${format === 'A4' ? 'A4' : format === 'Thermal-58mm' ? '58mm auto' : '80mm auto'};
                margin: 0;
              }
            }
          `}} />
          <div className="text-center mb-4 border-b-2 border-black pb-3" style={format === 'A4' ? { borderColor: '#10b981' } : undefined}>
            {companySettings.logo && (
               <img src={companySettings.logo} alt="Logo" className={`${format === 'A4' ? 'h-16' : 'h-10'} object-contain mx-auto mb-2 grayscale`} />
            )}
            <h1 className={`${format === 'A4' ? 'text-4xl' : 'text-xl'} font-bold uppercase tracking-wider print:text-2xl`}>
              {companySettings.name || "CrushTrack"}
            </h1>
            <p className="text-[11px] md:text-sm font-medium mt-1">
              {companySettings.address || "Stone Crushing & Minerals"}
            </p>
            <p className="text-[10px] md:text-xs mt-1 font-mono bg-black text-white inline-block px-2 py-0.5 uppercase">
              Gate Pass / Loading Token
            </p>
          </div>

          <table className={`w-full font-mono mt-4 mb-4 border-collapse border border-black ${format === 'Thermal-58mm' ? 'text-[9px]' : 'text-[11px] md:text-xs'}`}>
            <tbody>
              <tr>
                <td className="border border-black p-1.5 font-bold">Token ID</td>
                <td className="border border-black p-1.5">#{slip.id.toUpperCase()}</td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Date & Time</td>
                <td className="border border-black p-1.5">{new Date(slip.date).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Vehicle No</td>
                <td className="border border-black p-1.5 font-bold">{slip.vehicleNo}</td>
              </tr>
              {slip.driverName && (
                <tr>
                  <td className="border border-black p-1.5 font-bold">Driver</td>
                  <td className="border border-black p-1.5 font-bold">
                    {slip.driverName} {slip.driverPhone && `(${slip.driverPhone})`}
                  </td>
                </tr>
              )}
              {slip.operatorName && (
                <tr>
                  <td className="border border-black p-1.5 font-bold">Operator</td>
                  <td className="border border-black p-1.5">{slip.operatorName}</td>
                </tr>
              )}
              {slip.loaderName && (
                <tr>
                  <td className="border border-black p-1.5 font-bold">Loader</td>
                  <td className="border border-black p-1.5">{slip.loaderName}</td>
                </tr>
              )}
              <tr>
                <td className="border border-black p-1.5 font-bold">Customer</td>
                <td className="border border-black p-1.5 font-bold">
                  {
                    (() => {
                      if (slip.customerId === 'CASH' || !slip.customerId) return 'Counter Sale';
                      const cust = customers.find(c => c.id === slip.customerId);
                      return cust ? cust.name : slip.customerId;
                    })()
                  }
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Material</td>
                <td className="border border-black p-1.5 font-bold">{slip.materialType}</td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Quantity</td>
                <td className="border border-black p-1.5 font-bold">
                  {slip.quantity.toFixed(2)}{" "}
                  {slip.measurementType === "Volume (Brass)" ? "Brass" : "Tons"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Rate</td>
                <td className="border border-black p-1.5">₹{slip.ratePerUnit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Total Amount</td>
                <td className="border border-black p-1.5 font-bold">₹{slip.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              </tr>
              {(slip.amountPaid ?? 0) > 0 && (
                <>
                  <tr>
                    <td className="border border-black p-1.5 font-bold text-green-700">Amount Paid</td>
                    <td className="border border-black p-1.5 font-bold text-green-700">₹{slip.amountPaid!.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 font-bold">Balance</td>
                    <td className="border border-black p-1.5 font-bold">₹{Math.max(0, slip.totalAmount - slip.amountPaid!).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <div className="mt-4 pt-4 md:mt-6 md:pt-6 border-t border-black flex justify-between items-end text-[10px] md:text-xs font-mono">
            <div className="text-center">
              <div className="border-t border-black pt-1 px-2 md:px-4">
                Auth Sign
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-1 px-2 md:px-4">
                Driver Sign
              </div>
            </div>
          </div>
          <p className="text-[9px] md:text-[10px] text-center mt-4 italic text-zinc-500 font-mono">
            {companySettings.receiptFooter || "Thank you!"}
          </p>
        </div>

        <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 print:hidden flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Format:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
            >
              <option value="A4">A4</option>
              <option value="Thermal-80mm">Thermal 80mm</option>
              <option value="Thermal-58mm">Thermal 58mm</option>
            </select>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                const printContent = document.getElementById('print-area')?.innerHTML;
                if (printContent) {
                   downloadPdfBackend(printContent, format, `Slip-${slip.id}.pdf`);
                }
              }}
              className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
            >
              Download PDF
            </button>
            <button
              onClick={() => {
                const printContent = document.getElementById('print-area')?.innerHTML;
                if (printContent) {
                   openPdfBackend(printContent, format);
                }
              }}
              className="bg-zinc-900 dark:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 justify-center hover:bg-zinc-800 dark:hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Printer className="w-5 h-5 mr-1" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
