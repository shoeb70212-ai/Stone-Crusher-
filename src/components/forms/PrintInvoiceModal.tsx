import React, { useState } from "react";
import { Invoice, Customer } from "../../types";
import { X, Printer, Download, Share2 } from "lucide-react";
import { useErp } from "../../context/ErpContext";
import { openPdfInNewTab, downloadPdf, sharePdf } from "../../lib/print-utils";
import { isNative } from "../../lib/capacitor";
import { toWords } from "../../lib/utils";

export function PrintInvoiceModal({ 
  invoice, 
  onClose,
  customer
}: { 
  invoice: Invoice; 
  onClose: () => void;
  customer?: Customer;
}) {
  const { companySettings } = useErp();
  const [format, setFormat] = useState(companySettings.invoiceFormat || "A4");

  const primaryColorHex = {
    emerald: "#10b981",
    blue: "#3b82f6",
    violet: "#8b5cf6",
    rose: "#f43f5e",
    amber: "#f59e0b"
  }[companySettings.primaryColor || "emerald"];

  return (
    <div className="fixed inset-0 bg-zinc-900/80 flex items-center justify-center md:p-4 z-50 overflow-hidden">
      <div className={`bg-white dark:bg-zinc-800 md:rounded-2xl w-full h-full md:h-auto shadow-xl flex flex-col md:max-h-[90vh] ${format === 'A4' ? 'md:max-w-4xl' : 'md:max-w-sm'}`}>
        <div className="p-4 border-b flex justify-between items-center print:hidden">
          <h3 className="font-bold text-zinc-900 dark:text-white">Print Invoice</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900 p-2 md:p-4">
          {/* Horizontal scroll wrapper so the fixed-width invoice doesn't crush columns on narrow screens */}
          <div className="overflow-x-auto -mx-2 px-2">
          <div
            id="print-invoice-area"
            className="text-black bg-white mx-auto relative p-4 md:p-6"
            style={{ width: format === 'A4' ? '700px' : (format === 'Thermal-58mm' ? '220px' : '300px'), minWidth: format === 'A4' ? '700px' : undefined }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4;
                margin: 8mm;
              }
              body {
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
              }
              #print-invoice-area {
                margin: 0 !important;
                padding: 0 !important;
              }
            }
          `}} />
          
          {format === "A4" ? (
             companySettings.invoiceTemplate === "Modern" ? (
               <div className="flex flex-col min-h-[900px] bg-white text-black font-sans m-4 shadow-2xl overflow-hidden rounded-xl relative">
                  {companySettings.invoiceWatermark && companySettings.invoiceWatermark !== "None" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 opacity-[0.03]">
                      <div className="text-[150px] font-black transform -rotate-45 whitespace-nowrap" style={{ color: primaryColorHex }}>
                        {companySettings.invoiceWatermark === "Company Name" ? companySettings.name : 
                         companySettings.invoiceWatermark === "Status" ? invoice.status || "PENDING" : 
                         companySettings.invoiceWatermarkText}
                      </div>
                    </div>
                  )}
                 {/* Modern Header */}
                 <div className="p-8 text-white flex justify-between items-center relative z-10" style={{ backgroundColor: primaryColorHex }}>
                   <div className="flex items-center gap-4">
                     {companySettings.logo && (
                        <div className="bg-white p-2 rounded-lg">
                           <img src={companySettings.logo} alt="Logo" className="h-16 w-16 object-contain" />
                        </div>
                     )}
                     <div>
                       <h1 className="text-3xl font-extrabold tracking-tight uppercase">{companySettings.name || "COMPANY NAME"}</h1>
                       <div className="text-sm opacity-90 mt-1 whitespace-pre-wrap">{companySettings.address}</div>
                     </div>
                   </div>
                   <div className="text-right text-sm space-y-1">
                      <div className="text-2xl font-black tracking-widest uppercase mb-2">
                        {invoice.type === "GST" ? "TAX INVOICE" : "INVOICE"}
                      </div>
                      {companySettings.phone && <p>Tel: {companySettings.phone}</p>}
                      {companySettings.gstin && <p>GSTIN: {companySettings.gstin}</p>}
                   </div>
                 </div>
                 
                 {/* Details */}
                 <div className="p-8 grid grid-cols-2 gap-8 relative z-10">
                   <div>
                     <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billed To</div>
                     <div className="font-bold text-lg text-gray-800">{customer?.name || (invoice.customerId === 'CASH' ? 'Cash Customer' : invoice.customerId)}</div>
                     {customer?.address && <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{customer.address}</div>}
                     {customer?.phone && <div className="text-sm text-gray-600 mt-1">Ph: {customer.phone}</div>}
                     {invoice.type === "GST" && customer?.gstin && <div className="text-sm text-gray-600 mt-1">GSTIN: {customer.gstin}</div>}
                   </div>
                   <div className="text-right flex flex-col items-end">
                     <table className="text-sm text-gray-600">
                       <tbody>
                         <tr>
                           <td className="pr-4 py-1 text-gray-500 font-medium">Invoice No:</td>
                           <td className="font-bold text-gray-900">{invoice.invoiceNo}</td>
                         </tr>
                         <tr>
                           <td className="pr-4 py-1 text-gray-500 font-medium">Date:</td>
                           <td className="font-bold text-gray-900">{new Date(invoice.date).toLocaleDateString('en-GB')}</td>
                         </tr>
                         {companySettings.invoiceShowDueDate && (
                           <tr>
                             <td className="pr-4 py-1 text-gray-500 font-medium">Due Date:</td>
                             <td className="font-bold text-gray-900">{new Date(new Date(invoice.date).getTime() + 15 * 86400000).toLocaleDateString('en-GB')}</td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                   </div>
                 </div>

                 {/* Table */}
                 <div className="px-8 flex-1 relative z-10">
                   <table className="w-full text-sm">
                     <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase tracking-wider">
                       <tr>
                         <th className="py-3 px-4 text-left rounded-l-lg">Description</th>
                         <th className="py-3 px-4 text-left">HSN</th>
                         <th className="py-3 px-4 text-right">Qty</th>
                         <th className="py-3 px-4 text-right">Rate</th>
                         <th className="py-3 px-4 text-right rounded-r-lg">Total</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                       {invoice.items.map((item, i) => (
                         <tr key={i} className="text-gray-700">
                           <td className="py-4 px-4 font-medium">{item.materialType}</td>
                           <td className="py-4 px-4">{item.hsnCode || "-"}</td>
                           <td className="py-4 px-4 text-right">{item.quantity}</td>
                           <td className="py-4 px-4 text-right">{item.rate.toFixed(2)}</td>
                           <td className="py-4 px-4 text-right font-semibold text-gray-900">{item.amount.toFixed(2)}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>

                 {/* Totals & Footer */}
                 <div className="p-8 grid grid-cols-2 gap-8 border-t border-gray-100 relative z-10">
                    <div>
                      {companySettings.bankName && (
                        <div className="mb-6">
                           <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Info</div>
                           <div className="text-sm text-gray-600">
                             <div><span className="font-medium">Bank:</span> {companySettings.bankName}</div>
                             <div><span className="font-medium">Account:</span> {companySettings.accountNumber}</div>
                             <div><span className="font-medium">IFSC:</span> {companySettings.ifscCode}</div>
                           </div>
                        </div>
                      )}
                      <div>
                         <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Terms & Conditions</div>
                         <div className="text-[10px] text-gray-500 whitespace-pre-wrap">
                           {companySettings.termsAndConditions || "Subject to local jurisdiction. Goods once sold will not be taken back."}
                         </div>
                      </div>
                    </div>
                    <div>
                      <div className="bg-gray-50 rounded-xl p-6">
                         <div className="flex justify-between text-sm mb-2 text-gray-600">
                           <span>Subtotal</span>
                           <span className="font-medium">₹{invoice.subTotal.toFixed(2)}</span>
                         </div>
                         {invoice.type === "GST" && (
                           <>
                             <div className="flex justify-between text-sm mb-2 text-gray-600">
                               <span>CGST</span>
                               <span className="font-medium">₹{invoice.cgst.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-sm mb-4 text-gray-600">
                               <span>SGST</span>
                               <span className="font-medium">₹{invoice.sgst.toFixed(2)}</span>
                             </div>
                           </>
                         )}
                         <div className="flex justify-between items-center border-t border-gray-200 pt-4">
                           <span className="font-bold text-gray-900 uppercase">Total Amount</span>
                           <span className="text-2xl font-black" style={{ color: primaryColorHex }}>₹{invoice.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                         </div>
                         <div className="text-right text-[10px] text-gray-500 mt-2 font-medium">
                           {toWords.convert(invoice.total, { doNotAddOnly: false })}
                         </div>
                      </div>
                      
                      <div className="mt-12 text-center flex flex-col items-end">
                         <div className="w-48 border-t-2 border-gray-200 pt-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                           Authorized Signatory
                         </div>
                      </div>
                    </div>
                 </div>

               </div>
             ) : companySettings.invoiceTemplate === "Minimal" ? (
               <div className="flex flex-col min-h-[900px] bg-white text-black font-sans m-4 p-12 relative">
                  {companySettings.invoiceWatermark && companySettings.invoiceWatermark !== "None" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 opacity-[0.03]">
                      <div className="text-[150px] font-black transform -rotate-45 whitespace-nowrap" style={{ color: primaryColorHex }}>
                        {companySettings.invoiceWatermark === "Company Name" ? companySettings.name : 
                         companySettings.invoiceWatermark === "Status" ? invoice.status || "PENDING" : 
                         companySettings.invoiceWatermarkText}
                      </div>
                    </div>
                  )}
                 {/* Minimal Header */}
                 <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-8 relative z-10">
                   <div>
                     <h1 className="text-4xl font-black uppercase tracking-tighter">{companySettings.name || "COMPANY NAME"}</h1>
                     <div className="text-sm mt-2 text-gray-600 whitespace-pre-wrap max-w-sm">{companySettings.address}</div>
                     <div className="text-sm text-gray-600 mt-1">
                       {companySettings.phone && <span className="mr-4">T: {companySettings.phone}</span>}
                       {companySettings.gstin && <span>GSTIN: {companySettings.gstin}</span>}
                     </div>
                   </div>
                   <div className="text-right">
                     <div className="text-2xl font-light uppercase tracking-widest text-gray-400 mb-4">
                       {invoice.type === "GST" ? "Tax Invoice" : "Invoice"}
                     </div>
                     <div className="text-sm">
                       <div className="mb-1"><span className="text-gray-500 inline-block w-20">Inv No.</span> <span className="font-medium">{invoice.invoiceNo}</span></div>
                       <div className="mb-1"><span className="text-gray-500 inline-block w-20">Date</span> <span className="font-medium">{new Date(invoice.date).toLocaleDateString('en-GB')}</span></div>
                       {companySettings.invoiceShowDueDate && (
                          <div className="mb-1"><span className="text-gray-500 inline-block w-20">Due Date</span> <span className="font-medium">{new Date(new Date(invoice.date).getTime() + 15 * 86400000).toLocaleDateString('en-GB')}</span></div>
                       )}
                     </div>
                   </div>
                 </div>

                 {/* Minimal Billed To */}
                 <div className="mb-12 relative z-10">
                   <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">Billed To</div>
                   <div className="font-medium text-lg">{customer?.name || (invoice.customerId === 'CASH' ? 'Cash Customer' : invoice.customerId)}</div>
                   {customer?.address && <div className="text-gray-600 mt-1">{customer.address}</div>}
                   {customer?.phone && <div className="text-gray-600 mt-1">{customer.phone}</div>}
                 </div>

                 {/* Minimal Table */}
                 <div className="flex-1 relative z-10">
                   <table className="w-full text-sm">
                     <thead>
                       <tr className="border-b-2 border-black">
                         <th className="py-2 text-left font-medium">Description</th>
                         <th className="py-2 text-right font-medium">Qty</th>
                         <th className="py-2 text-right font-medium">Rate</th>
                         <th className="py-2 text-right font-medium">Amount</th>
                       </tr>
                     </thead>
                     <tbody>
                       {invoice.items.map((item, i) => (
                         <tr key={i} className="border-b border-gray-200">
                           <td className="py-4">
                             <div className="font-medium">{item.materialType}</div>
                             {item.hsnCode && <div className="text-xs text-gray-500 mt-0.5">HSN: {item.hsnCode}</div>}
                           </td>
                           <td className="py-4 text-right">{item.quantity}</td>
                           <td className="py-4 text-right">{item.rate.toFixed(2)}</td>
                           <td className="py-4 text-right">{item.amount.toFixed(2)}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>

                 {/* Minimal Footer */}
                 <div className="mt-auto pt-8 flex justify-between items-end relative z-10">
                   <div className="w-1/2">
                     {companySettings.termsAndConditions && (
                       <div className="mb-6">
                         <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">Terms</div>
                         <div className="text-xs text-gray-600 whitespace-pre-wrap">{companySettings.termsAndConditions}</div>
                       </div>
                     )}
                     {companySettings.bankName && (
                       <div>
                         <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">Payment Details</div>
                         <div className="text-xs text-gray-600">
                           {companySettings.bankName} • A/C: {companySettings.accountNumber} • IFSC: {companySettings.ifscCode}
                         </div>
                       </div>
                     )}
                   </div>
                   
                   <div className="w-1/3">
                     <div className="border-t border-black pt-4">
                       <div className="flex justify-between mb-2 text-sm text-gray-600">
                         <span>Subtotal</span>
                         <span>{invoice.subTotal.toFixed(2)}</span>
                       </div>
                       {invoice.type === "GST" && (
                         <>
                           <div className="flex justify-between mb-2 text-sm text-gray-600">
                             <span>CGST</span>
                             <span>{invoice.cgst.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between mb-4 text-sm text-gray-600">
                             <span>SGST</span>
                             <span>{invoice.sgst.toFixed(2)}</span>
                           </div>
                         </>
                       )}
                       <div className="flex justify-between items-baseline pt-4 border-t-2 border-black">
                         <span className="font-medium uppercase tracking-wider">Total</span>
                         <span className="text-xl font-bold">₹{invoice.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                       </div>
                     </div>
                   </div>
                 </div>

               </div>
             ) : (
            <div className="flex flex-col min-h-[900px] bg-white text-black font-sans border-2 border-black m-4 relative">
              {companySettings.invoiceWatermark && companySettings.invoiceWatermark !== "None" && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 opacity-[0.03]">
                  <div className="text-[150px] font-black transform -rotate-45 whitespace-nowrap" style={{ color: primaryColorHex }}>
                    {companySettings.invoiceWatermark === "Company Name" ? companySettings.name : 
                     companySettings.invoiceWatermark === "Status" ? invoice.status || "PENDING" : 
                     companySettings.invoiceWatermarkText}
                  </div>
                </div>
              )}
              <div className="relative z-10 flex flex-col h-full">
               {/* header */}
               <div className="p-4 flex flex-col">
                 <div className="flex justify-between items-start">
                     <div className="flex-1">
                       <h1 className="text-4xl font-extrabold tracking-tight uppercase" style={{ color: primaryColorHex }}>
                          {companySettings.name || "COMPANY NAME"}
                       </h1>
                     </div>
                   {companySettings.logo && (
                      <img src={companySettings.logo} alt="Logo" className="h-16 object-contain" />
                   )}
                 </div>

                 <div className="flex justify-between items-end mt-4 text-[11px] leading-relaxed font-medium">
                   <div>
                     <p className="whitespace-pre-wrap">{companySettings.address}</p>
                   </div>
                   <div className="text-right">
                     {companySettings.phone && <p><span className="font-semibold">Tel :</span> {companySettings.phone}</p>}
                     {companySettings.gstin && <p><span className="font-semibold">GSTIN :</span> {companySettings.gstin}</p>}
                   </div>
                 </div>
               </div>

               {/* Title Bar */}
               <div className="border-y-2 border-black flex items-center justify-center px-3 py-1.5 text-xs font-bold uppercase bg-gray-50">
                 <div className="text-center text-sm tracking-wider font-extrabold text-black">
                   {invoice.type === "GST" ? "TAX INVOICE" : "INVOICE"}
                 </div>
               </div>

               {/* Details Box */}
               <div className="flex border-b border-black text-[11px] leading-tight flex-none">
                 <div className="w-1/2 border-r border-black flex flex-col">
                   <div className="text-center border-b border-black font-bold py-1 bg-gray-50">
                     Customer Detail
                   </div>
                   <div className="p-3 grid grid-cols-[80px_1fr] gap-y-1.5">
                     <div className="font-bold text-gray-700">M/S</div>
                     <div className="font-bold">{customer?.name || (invoice.customerId === 'CASH' ? 'Cash Customer' : invoice.customerId)}</div>
                     <div className="font-bold text-gray-700">Address</div>
                     <div className="whitespace-pre-wrap leading-tight">{customer?.address || "-"}</div>
                     <div className="font-bold text-gray-700">Phone</div>
                     <div className="font-bold">{customer?.phone || "-"}</div>
                     {invoice.type === "GST" && (
                        <>
                           <div className="font-bold text-gray-700">GSTIN</div>
                           <div className="font-bold uppercase">{customer?.gstin || "-"}</div>
                        </>
                     )}
                   </div>
                 </div>
                 <div className="w-1/2 flex flex-col p-3 grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-2">
                     <div className="font-bold text-gray-700">Invoice No.</div>
                     <div className="font-bold">{invoice.invoiceNo}</div>
                     <div className="font-bold text-gray-700">Invoice Date</div>
                     <div className="font-bold">{new Date(invoice.date).toLocaleDateString('en-GB')}</div>
                 </div>
               </div>

               {/* Table */}
               <div className="flex-1 flex flex-col">
                 <table className="w-full text-[11px] table-fixed flex-1">
                    <thead className="border-b-2 border-black font-bold text-center bg-gray-50">
                      <tr>
                        <th className="border-r border-black px-1 py-2 w-10">Sr.<br/>No.</th>
                        <th className="border-r border-black px-2 py-2 text-left">Name of Product / Service</th>
                        <th className="border-r border-black px-1 py-2 w-20">HSN / SAC</th>
                        <th className="border-r border-black px-1 py-2 w-16">Qty</th>
                        <th className="border-r border-black px-1 py-2 w-20">Rate</th>
                        <th className="border-r border-black px-1 py-2 w-24">Taxable<br/>Value</th>
                        {invoice.type === "GST" && <th className="border-r border-black px-1 py-2 w-20">CGST</th>}
                        {invoice.type === "GST" && <th className="border-r border-black px-1 py-2 w-20">SGST</th>}
                        <th className="px-1 py-2 w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, i) => {
                         const itemTaxable = item.amount;
                         const itemCgst = invoice.type === "GST" ? (itemTaxable * ((item.gstRate || 5) / 2)) / 100 : 0;
                         const itemSgst = invoice.type === "GST" ? (itemTaxable * ((item.gstRate || 5) / 2)) / 100 : 0;
                         const itemTotal = itemTaxable + itemCgst + itemSgst;
                         return (
                          <tr key={i} className="text-center align-top">
                            <td className="border-r border-black px-1 py-2">{i + 1}</td>
                            <td className="border-r border-black px-2 py-2 text-left font-semibold text-gray-800">{item.materialType}</td>
                            <td className="border-r border-black px-1 py-2">{item.hsnCode || "-"}</td>
                            <td className="border-r border-black px-1 py-2">{item.quantity}</td>
                            <td className="border-r border-black px-1 py-2 text-right">{item.rate.toFixed(2)}</td>
                            <td className="border-r border-black px-1 py-2 text-right">{itemTaxable.toFixed(2)}</td>
                            {invoice.type === "GST" && <td className="border-r border-black px-1 py-2 text-right">{itemCgst.toFixed(2)}</td>}
                            {invoice.type === "GST" && <td className="border-r border-black px-1 py-2 text-right">{itemSgst.toFixed(2)}</td>}
                            <td className="px-1 py-2 text-right font-semibold">{itemTotal.toFixed(2)}</td>
                          </tr>
                         );
                      })}
                      {Array.from({ length: Math.max(0, 8 - invoice.items.length) }).map((_, i) => (
                        <tr key={'pad-'+i}>
                            <td className="border-r border-black px-1 py-3 border-b-0"></td>
                            <td className="border-r border-black px-2 py-3 border-b-0"></td>
                            <td className="border-r border-black px-1 py-3 border-b-0"></td>
                            <td className="border-r border-black px-1 py-3 border-b-0"></td>
                            <td className="border-r border-black px-1 py-3 border-b-0"></td>
                            <td className="border-r border-black px-1 py-3 border-b-0"></td>
                            {invoice.type === "GST" && <td className="border-r border-black px-1 py-3 border-b-0"></td>}
                            {invoice.type === "GST" && <td className="border-r border-black px-1 py-3 border-b-0"></td>}
                            <td className="px-1 py-3 border-b-0"></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-black font-bold text-center bg-gray-100 h-8">
                      <tr>
                        <td colSpan={3} className="border-r border-black px-2 py-2 text-right uppercase">Total</td>
                        <td className="border-r border-black px-1 py-2">{invoice.items.reduce((s,i)=>s+i.quantity, 0).toFixed(2)}</td>
                        <td className="border-r border-black px-1 py-2"></td>
                        <td className="border-r border-black px-1 py-2 text-right">{invoice.subTotal.toFixed(2)}</td>
                        {invoice.type === "GST" && <td className="border-r border-black px-1 py-2 text-right">{invoice.cgst.toFixed(2)}</td>}
                        {invoice.type === "GST" && <td className="border-r border-black px-1 py-2 text-right">{invoice.sgst.toFixed(2)}</td>}
                        <td className="px-1 py-2 text-right text-sm">{invoice.total.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                 </table>
               </div>

               <div className="flex text-[11px] leading-tight border-t-2 border-black flex-none">
                 {/* Left Side Footer */}
                 <div className="w-2/3 flex flex-col border-r border-black">
                   <div className="border-b border-black p-2">
                     <div className="font-bold text-gray-700 mb-1">Total in words</div>
                     <div className="uppercase font-bold tracking-wide">{toWords.convert(invoice.total, { doNotAddOnly: false })}</div>
                   </div>
                   <div className="flex border-b border-black flex-1">
                      <div className="w-full flex flex-col">
                         <div className="font-bold text-center border-b border-black bg-gray-50 py-1">Bank Details</div>
                         <div className="grid grid-cols-[80px_1fr] gap-y-1.5 p-2 flex-1">
                            <div className="font-semibold text-gray-600">Bank Name</div>
                            <div className="font-bold">{companySettings.bankName || "-"}</div>
                            <div className="font-semibold text-gray-600">Branch</div>
                            <div className="font-bold">{companySettings.branchName || "-"}</div>
                            <div className="font-semibold text-gray-600">Acc. Number</div>
                            <div className="font-bold">{companySettings.accountNumber || "-"}</div>
                            <div className="font-semibold text-gray-600">IFSC</div>
                            <div className="font-bold">{companySettings.ifscCode || "-"}</div>
                         </div>
                      </div>
                   </div>
                   <div className="flex flex-col">
                      <div className="font-bold text-center border-b border-black bg-gray-50 py-1">Terms and Conditions</div>
                      <div className="p-2">
                        {companySettings.termsAndConditions ? (
                           <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10px] text-gray-700 font-medium">
                              {companySettings.termsAndConditions.split('\n').filter(Boolean).map((t, idx) => (
                                 <li key={idx}>{t}</li>
                              ))}
                           </ul>
                        ) : (
                           <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10px] text-gray-700 font-medium">
                              <li>Subject to local jurisdiction.</li>
                              <li>Our Responsibility Ceases as soon as goods leaves our Premises.</li>
                              <li>Goods once sold will not be taken back.</li>
                              <li>Delivery Ex-Premises.</li>
                           </ul>
                        )}
                      </div>
                   </div>
                 </div>

                 {/* Right Side Footer */}
                 <div className="w-1/3 flex flex-col">
                   <div className="flex justify-between border-b border-black p-2 bg-gray-50">
                      <div className="font-bold text-gray-700">Taxable Amount</div>
                      <div className="font-bold">{invoice.subTotal.toFixed(2)}</div>
                   </div>
                   {invoice.type === "GST" && (
                     <>
                       <div className="flex justify-between border-b border-black p-2">
                         <div className="font-bold text-gray-700">Add : CGST</div>
                         <div className="font-bold">{invoice.cgst.toFixed(2)}</div>
                       </div>
                       <div className="flex justify-between border-b border-black p-2">
                         <div className="font-bold text-gray-700">Add : SGST</div>
                         <div className="font-bold">{invoice.sgst.toFixed(2)}</div>
                       </div>
                     </>
                   )}
                   <div className="flex justify-between border-b-2 border-black p-2 bg-gray-50">
                      <div className="font-bold text-gray-700">Total Tax</div>
                      <div className="font-bold text-sm">{(invoice.cgst + invoice.sgst).toFixed(2)}</div>
                   </div>
                   <div className="flex justify-between border-b border-black p-3 bg-gray-100">
                      <div className="font-extrabold">Total Amount After Tax</div>
                      <div className="font-extrabold text-base text-black">₹{invoice.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                   </div>
                   <div className="flex-1 flex flex-col justify-between p-3">
                      <div className="text-[9px] text-center text-gray-600 mb-6 font-medium italic">
                         Certified that the particulars given above are true and correct.
                      </div>
                      <div className="text-center font-extrabold tracking-wide mb-12 uppercase text-sm" style={{ color: primaryColorHex }}>
                         For {companySettings.name}
                      </div>
                      <div className="text-center text-[10px] font-bold border-t border-black pt-2 mx-4 uppercase">
                         Authorised Signatory
                      </div>
                   </div>
                 </div>
               </div>
              </div>
            </div>
          )) : (
            // Thermal Formats (80mm or 58mm)
            <div className={`mx-auto font-mono leading-tight ${format === 'Thermal-58mm' ? 'max-w-[58mm] text-[10px] p-2' : 'max-w-[80mm] text-xs p-4'}`}>
              <div className="text-center mb-3 border-b-2 border-dashed pb-3" style={{ borderColor: primaryColorHex }}>
                {companySettings.logo && (
                   <img src={companySettings.logo} alt="Logo" className={`${format === 'Thermal-58mm' ? 'h-8' : 'h-12'} object-contain mx-auto mb-2 grayscale`} />
                )}
                <h1 className={`${format === 'Thermal-58mm' ? 'text-sm' : 'text-xl'} font-bold uppercase tracking-wider`}>{companySettings.name}</h1>
                {companySettings.address && <p className="mt-1">{companySettings.address}</p>}
                {companySettings.phone && <p>Ph: {companySettings.phone}</p>}
                {companySettings.gstin && invoice.type === "GST" && <p>GSTIN: {companySettings.gstin}</p>}
                <p className="font-bold uppercase mt-2 inline-block px-2 border-2" style={{ borderColor: primaryColorHex, color: primaryColorHex }}>{invoice.type === "GST" ? "TAX INVOICE" : "INVOICE"}</p>
              </div>

              <div className="mb-3">
                 <p><span className="font-bold">Date:</span> {new Date(invoice.date).toLocaleString()}</p>
                 <p><span className="font-bold">Inv No:</span> {invoice.invoiceNo}</p>
                 <p><span className="font-bold">Bill To:</span> {customer?.name || (invoice.customerId === 'CASH' ? 'Cash' : invoice.customerId)}</p>
                 {customer?.phone && <p>Ph: {customer.phone}</p>}
              </div>

              {companySettings.bankName && (
                <div className="mb-3 border-t border-black border-dashed pt-2">
                   <p className="font-bold underline mb-1">Bank Details</p>
                   <p><span className="font-semibold">Bank:</span> {companySettings.bankName}</p>
                   <p><span className="font-semibold">A/C No:</span> {companySettings.accountNumber}</p>
                   <p><span className="font-semibold">IFSC:</span> {companySettings.ifscCode}</p>
                </div>
              )}

              <table className="w-full text-left mb-3 border-t border-b border-black border-dashed">
                 <thead>
                   <tr className="border-b border-black border-dashed border-opacity-50">
                     <th className="py-1">Item</th>
                     <th className="text-right">Qty</th>
                     <th className="text-right">Rate</th>
                     <th className="text-right">Amt</th>
                   </tr>
                 </thead>
                 <tbody>
                   {invoice.items.map((item, i) => (
                     <tr key={i}>
                       <td className="py-1">{item.materialType}</td>
                       <td className="text-right">{item.quantity}</td>
                       <td className="text-right">{item.rate}</td>
                       <td className="text-right font-medium">{item.amount.toLocaleString()}</td>
                     </tr>
                   ))}
                 </tbody>
              </table>

              <div className="flex justify-end text-right">
                 <table className="w-48">
                    <tbody>
                      <tr>
                        <td className="pr-2 pb-1">Sub Total:</td>
                        <td className="pb-1">₹{invoice.subTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                      {invoice.type === "GST" && (
                        <>
                          <tr>
                            <td className="pr-2 pb-1">CGST:</td>
                            <td className="pb-1">₹{invoice.cgst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          </tr>
                          <tr>
                            <td className="pr-2 pb-1 border-b border-black border-dashed">SGST:</td>
                            <td className="pb-1 border-b border-black border-dashed">₹{invoice.sgst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td className="pr-2 pt-1 font-bold text-sm">TOTAL:</td>
                        <td className="pt-1 font-bold text-sm">₹{invoice.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    </tbody>
                 </table>
              </div>

              <div className="mt-4 pt-4 border-t-2 border-black border-dashed text-center">
                 <p className="mb-2 italic">{companySettings.receiptFooter || "Thank you for your business!"}</p>
                 <p>*** END OF RECEIPT ***</p>
              </div>
            </div>
          )}
          </div>
          </div>{/* end overflow-x-auto */}
        </div>

        <div className="p-3 md:p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl print:hidden">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-3 md:py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-sm active:scale-95"
            >
              Close
            </button>
            {isNative() ? (
              <button
                onClick={() => {
                  const element = document.getElementById('print-invoice-area');
                  if (element) {
                    sharePdf(element, `Invoice-${invoice.invoiceNo}.pdf`, `Invoice ${invoice.invoiceNo}`);
                  }
                }}
                className="flex-1 py-3 md:py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-sm flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                Share PDF
              </button>
            ) : (
              <button
                onClick={() => {
                  const element = document.getElementById('print-invoice-area');
                  if (element) {
                    downloadPdf(element, `Invoice-${invoice.invoiceNo}.pdf`);
                    setTimeout(() => onClose(), 500);
                  }
                }}
                className="flex-1 py-3 md:py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-sm flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
            <button
              onClick={() => {
                const win = window.open('', '_blank');
                const printContent = document.getElementById('print-invoice-area')?.innerHTML;
                if (printContent) {
                  openPdfInNewTab(printContent, win);
                  setTimeout(() => onClose(), 500);
                } else if (win) {
                  win.close();
                }
              }}
              className="flex-1 py-3 md:py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-sm active:scale-95"
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
