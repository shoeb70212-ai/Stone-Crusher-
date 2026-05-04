import React, { useState, useRef, useEffect } from "react";
import { Invoice, Customer } from "../../types";
import { X, Printer, Download, Share2, Loader2, MessageCircle } from "lucide-react";
import { useErp } from "../../context/ErpContext";
import { createInvoicePdfBlob, downloadInvoicePdf, printHtml, sharePdfBlob, PRIMARY_COLORS, DEFAULT_PAYMENT_TERM_MS } from "../../lib/print-utils";
import { buildInvoiceWhatsAppMessage, openWhatsAppMessage } from "../../lib/whatsapp-share";
import { isNative } from "../../lib/capacitor";
import { toWords } from "../../lib/utils";
import { useBodyScrollLock } from "../../lib/use-body-scroll-lock";
import { useToast } from "../ui/Toast";

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
  const { addToast } = useToast();
  const [format, setFormat] = useState(companySettings.invoiceFormat || "A4");
  const [isPrinting, setIsPrinting] = useState(false);

  useBodyScrollLock(true);

  const previewWrapRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState(940);

  // Scale the fixed-width A4 preview while preserving the full rendered height.
  useEffect(() => {
    if (format !== 'A4') {
      setPreviewScale(1);
      setPreviewHeight(940);
      return;
    }
    const el = previewWrapRef.current;
    const content = previewContentRef.current;
    if (!el) return;
    const contentWidth = 700;
    const updatePreviewMetrics = () => {
      const containerWidth = Math.max(220, el.clientWidth - 16);
      setPreviewScale(Math.min(1, containerWidth / contentWidth));
      setPreviewHeight(Math.max(940, content?.scrollHeight || 940));
    };

    updatePreviewMetrics();
    const observer = new ResizeObserver(updatePreviewMetrics);
    observer.observe(el);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [format, invoice, customer, companySettings]);

  const primaryColorHex = PRIMARY_COLORS[companySettings.primaryColor || "emerald"];

  const handleWhatsAppShare = async () => {
    const message = buildInvoiceWhatsAppMessage({ invoice, customer, companySettings });
    const filename = `Invoice-${invoice.invoiceNo}.pdf`;
    setIsPrinting(true);
    try {
      const blob = await createInvoicePdfBlob(invoice, customer, companySettings);
      const result = await sharePdfBlob(blob, filename, `Invoice ${invoice.invoiceNo}`, message);

      if (result === 'downloaded') {
        openWhatsAppMessage(message);
        addToast("info", "Invoice PDF downloaded. Attach it in WhatsApp.");
      } else if (result === 'shared') {
        addToast("success", "Invoice PDF is ready to send. Choose WhatsApp from the share sheet.");
      }
    } catch {
      addToast("error", "Could not prepare the invoice PDF for WhatsApp.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/80 flex items-stretch justify-center md:items-center md:p-4 z-[70] overflow-hidden">
      <div className={`bg-white dark:bg-zinc-800 md:rounded-2xl w-full h-dvh md:h-auto shadow-xl flex flex-col md:max-h-[90vh] ${format === 'A4' ? 'md:max-w-4xl' : 'md:max-w-sm'}`}>
        <div className="p-4 border-b flex justify-between items-center print:hidden shrink-0">
          <h3 className="font-bold text-zinc-900 dark:text-white">Print Invoice</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={previewWrapRef} className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-auto bg-zinc-100 dark:bg-zinc-900 p-2 md:p-4 overscroll-contain">
          {/* Scale wrapper: shrinks to the scaled height so no dead space below A4 */}
          <div
            style={format === 'A4' ? {
              width: 700 * previewScale,
              height: previewHeight * previewScale,
              margin: '0 auto',
              overflow: 'visible',
            } : { margin: '0 auto' }}
          >
          <div
            ref={previewContentRef}
            id="print-invoice-area"
            className="text-black bg-white relative p-4 md:p-6"
            style={{
              width: format === 'A4' ? '700px' : (format === 'Thermal-58mm' ? '220px' : '300px'),
              transformOrigin: 'top left',
              transform: format === 'A4' && previewScale < 1 ? `scale(${previewScale})` : undefined,
            }}
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
                width: ${format === 'A4' ? '700px' : format === 'Thermal-58mm' ? '220px' : '300px'} !important;
                transform: none !important;
                transform-origin: top left !important;
                box-sizing: border-box !important;
              }
              #print-invoice-area * {
                box-sizing: border-box !important;
              }
            }
          `}} />
          
          {format === "A4" ? (
             companySettings.invoiceTemplate === "Modern" ? (
               <div className="flex flex-col min-h-225 bg-white text-black font-sans m-4 shadow-2xl overflow-hidden rounded-xl relative">
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
                             <td className="font-bold text-gray-900">{new Date(new Date(invoice.date).getTime() + DEFAULT_PAYMENT_TERM_MS).toLocaleDateString('en-GB')}</td>
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
                           {toWords.convert(invoice.total)}
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
               <div className="flex flex-col min-h-225 bg-white text-black font-sans border-2 border-black m-4 relative overflow-hidden">
                  {companySettings.invoiceWatermark && companySettings.invoiceWatermark !== "None" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 opacity-[0.03]">
                      <div className="text-[150px] font-black transform -rotate-45 whitespace-nowrap" style={{ color: primaryColorHex }}>
                        {companySettings.invoiceWatermark === "Company Name" ? companySettings.name : 
                         companySettings.invoiceWatermark === "Status" ? invoice.status || "PENDING" : 
                         companySettings.invoiceWatermarkText}
                      </div>
                    </div>
                 )}
                 <div className="relative z-10 flex flex-col min-h-225">
                   {/* Title Bar */}
                   <div className="border-b-2 border-black bg-gray-100 py-2 text-center text-base font-black uppercase tracking-widest">
                     {invoice.type === "GST" ? "TAX INVOICE" : "INVOICE"}
                   </div>

                   {/* Minimal Header */}
                   <div className="border-b-2 border-black p-5">
                     <div className="flex justify-between items-start gap-6">
                       <div className="min-w-0">
                         <h1 className="text-3xl font-black uppercase leading-tight">{companySettings.name || "COMPANY NAME"}</h1>
                         <div className="text-[11px] mt-2 text-gray-700 whitespace-pre-wrap max-w-md leading-snug">{companySettings.address}</div>
                       </div>
                       <div className="text-right text-[11px] leading-relaxed font-semibold shrink-0">
                         {companySettings.phone && <p><span className="font-bold">Tel :</span> {companySettings.phone}</p>}
                         {companySettings.gstin && invoice.type === "GST" && <p><span className="font-bold">GSTIN :</span> {companySettings.gstin}</p>}
                       </div>
                     </div>
                   </div>

                   {/* Minimal Billed To */}
                   <div className="grid grid-cols-2 border-b-2 border-black text-[11px] leading-tight">
                     <div className="border-r border-black">
                       <div className="border-b border-black bg-gray-50 px-3 py-1.5 text-center font-bold uppercase">Billed To</div>
                       <div className="grid grid-cols-[74px_1fr] gap-y-1.5 p-3 min-h-28">
                         <div className="font-bold text-gray-700">Name</div>
                         <div className="font-bold">{customer?.name || (invoice.customerId === 'CASH' ? 'Cash Customer' : invoice.customerId)}</div>
                         <div className="font-bold text-gray-700">Address</div>
                         <div className="whitespace-pre-wrap">{customer?.address || "-"}</div>
                         <div className="font-bold text-gray-700">Phone</div>
                         <div>{customer?.phone || "-"}</div>
                         {invoice.type === "GST" && (
                           <>
                             <div className="font-bold text-gray-700">GSTIN</div>
                             <div className="font-bold uppercase">{customer?.gstin || "-"}</div>
                           </>
                         )}
                       </div>
                     </div>
                     <div>
                       <div className="border-b border-black bg-gray-50 px-3 py-1.5 text-center font-bold uppercase">Invoice / Payment Details</div>
                       <div className="grid grid-cols-[92px_1fr] gap-y-1.5 p-3 min-h-28">
                         <div className="font-bold text-gray-700">Invoice No.</div>
                         <div className="font-bold">{invoice.invoiceNo}</div>
                         <div className="font-bold text-gray-700">Invoice Date</div>
                         <div className="font-bold">{new Date(invoice.date).toLocaleDateString('en-GB')}</div>
                         {companySettings.invoiceShowDueDate && (
                           <>
                             <div className="font-bold text-gray-700">Due Date</div>
                             <div className="font-bold">{new Date(new Date(invoice.date).getTime() + DEFAULT_PAYMENT_TERM_MS).toLocaleDateString('en-GB')}</div>
                           </>
                         )}
                         <div className="font-bold text-gray-700">Status</div>
                         <div className="font-bold">{invoice.status}</div>
                         <div className="font-bold text-gray-700">Type</div>
                         <div>{invoice.type}</div>
                         <div className="font-bold text-gray-700">Bank</div>
                         <div>{companySettings.bankName || "-"}</div>
                         <div className="font-bold text-gray-700">A/C - IFSC</div>
                         <div>{[companySettings.accountNumber, companySettings.ifscCode].filter(Boolean).join(" / ") || "-"}</div>
                       </div>
                     </div>
                   </div>

                   {/* Minimal Table */}
                   <div className="flex-1 flex flex-col relative z-10">
                     <table className="w-full h-full table-fixed border-collapse text-[11px]">
                       <thead className="bg-gray-100 font-bold text-center uppercase">
                         <tr className="border-b-2 border-black">
                           <th className="border-r border-black px-1 py-2 w-10">Sr.</th>
                           <th className="border-r border-black px-2 py-2 text-left">Description</th>
                           <th className="border-r border-black px-1 py-2 w-20">HSN / SAC</th>
                           <th className="border-r border-black px-1 py-2 w-16">Qty</th>
                           <th className="border-r border-black px-1 py-2 w-20">Rate</th>
                           <th className="px-1 py-2 w-24">Amount</th>
                         </tr>
                       </thead>
                       <tbody>
                         {invoice.items.map((item, i) => (
                           <tr key={i} className="border-b border-black align-top">
                             <td className="border-r border-black px-1 py-2 text-center">{i + 1}</td>
                             <td className="border-r border-black px-2 py-2 font-semibold">{item.materialType}</td>
                             <td className="border-r border-black px-1 py-2 text-center">{item.hsnCode || "-"}</td>
                             <td className="border-r border-black px-1 py-2 text-center">{item.quantity}</td>
                             <td className="border-r border-black px-1 py-2 text-right">{item.rate.toFixed(2)}</td>
                             <td className="px-1 py-2 text-right font-semibold">{item.amount.toFixed(2)}</td>
                           </tr>
                         ))}
                         {Array.from({ length: Math.max(0, 8 - invoice.items.length) }).map((_, i) => (
                           <tr key={`minimal-pad-${i}`} className="border-b border-black">
                             <td className="border-r border-black px-1 py-3">&nbsp;</td>
                             <td className="border-r border-black px-2 py-3">&nbsp;</td>
                             <td className="border-r border-black px-1 py-3">&nbsp;</td>
                             <td className="border-r border-black px-1 py-3">&nbsp;</td>
                             <td className="border-r border-black px-1 py-3">&nbsp;</td>
                             <td className="px-1 py-3">&nbsp;</td>
                           </tr>
                         ))}
                       </tbody>
                       <tfoot className="border-t-2 border-black bg-gray-100 font-bold">
                         <tr>
                           <td colSpan={3} className="border-r border-black px-2 py-2 text-right uppercase">Total</td>
                           <td className="border-r border-black px-1 py-2 text-center">{invoice.items.reduce((sum, item) => sum + item.quantity, 0).toFixed(2)}</td>
                           <td className="border-r border-black px-1 py-2"></td>
                           <td className="px-1 py-2 text-right">{invoice.subTotal.toFixed(2)}</td>
                         </tr>
                       </tfoot>
                     </table>
                   </div>

                  {/* Minimal Footer */}
                  <div className="grid grid-cols-[1fr_240px] border-t-2 border-black text-[11px] leading-tight relative z-10">
                   <div className="flex flex-col">
                     <div className="border-b border-black p-2">
                       <div className="font-bold text-gray-700 mb-1 uppercase">Amount in words</div>
                       <div className="uppercase font-bold">{toWords.convert(invoice.total)}</div>
                     </div>
                     {companySettings.termsAndConditions && (
                       <div className="border-b border-black p-2">
                         <div className="font-bold text-gray-700 mb-1 uppercase">Terms and Conditions</div>
                         <div className="text-xs text-gray-600 whitespace-pre-wrap">{companySettings.termsAndConditions}</div>
                       </div>
                     )}
                     {companySettings.bankName && (
                        <div className="p-2">
                          <div className="font-bold text-gray-700 mb-1 uppercase">Payment Details</div>
                         <div className="text-xs text-gray-600">
                           {companySettings.bankName} • A/C: {companySettings.accountNumber} • IFSC: {companySettings.ifscCode}
                         </div>
                       </div>
                     )}
                   </div>
                   
                   <div className="border-l-2 border-black flex flex-col">
                     <div className="flex flex-col h-full">
                       <div className="flex justify-between border-b border-black p-2">
                         <span>Subtotal</span>
                         <span>{invoice.subTotal.toFixed(2)}</span>
                       </div>
                       {invoice.type === "GST" && (
                         <>
                            <div className="flex justify-between border-b border-black p-2">
                             <span>CGST</span>
                             <span>{invoice.cgst.toFixed(2)}</span>
                           </div>
                            <div className="flex justify-between border-b border-black p-2">
                             <span>SGST</span>
                             <span>{invoice.sgst.toFixed(2)}</span>
                           </div>
                         </>
                       )}
                        <div className="flex justify-between items-baseline border-t-2 border-black bg-gray-100 p-3">
                         <span className="font-medium uppercase tracking-wider">Total</span>
                         <span className="text-xl font-bold">Rs. {invoice.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                       </div>
                     </div>
                   </div>
                 </div>

                </div>
               </div>
              ) : (
            <div className="flex flex-col min-h-225 bg-white text-black font-sans border-2 border-black m-4 relative">
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
               {/* Title Bar */}
               <div className="border-b-2 border-black flex items-center justify-center px-3 py-1.5 text-xs font-bold uppercase bg-gray-50">
                 <div className="text-center text-sm tracking-wider font-extrabold text-black">
                   {invoice.type === "GST" ? "TAX INVOICE" : "INVOICE"}
                 </div>
               </div>

               {/* header */}
               <div className="p-4 flex flex-col border-b-2 border-black">
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
                 <div className="w-1/2 p-3 grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-2">
                     <div className="font-bold text-gray-700">Invoice No.</div>
                     <div className="font-bold">{invoice.invoiceNo}</div>
                     <div className="font-bold text-gray-700">Invoice Date</div>
                     <div className="font-bold">{new Date(invoice.date).toLocaleDateString('en-GB')}</div>
                 </div>
               </div>

               {/* Table */}
               <div className="flex-1 flex flex-col">
                 <table className="w-full text-[10.5px] table-fixed flex-1">
                    <colgroup>
                      <col style={{ width: '38px' }} />
                      <col />
                      <col style={{ width: '68px' }} />
                      <col style={{ width: '46px' }} />
                      <col style={{ width: '60px' }} />
                      <col style={{ width: '74px' }} />
                      {invoice.type === "GST" && <col style={{ width: '58px' }} />}
                      {invoice.type === "GST" && <col style={{ width: '58px' }} />}
                      <col style={{ width: '74px' }} />
                    </colgroup>
                     <thead className="border-b-2 border-black font-bold text-center bg-gray-50">
                       <tr>
                         <th className="border-r border-black px-1 py-2 leading-snug">Sr.<br/>No.</th>
                         <th className="border-r border-black px-2 py-2 text-left leading-snug whitespace-normal">Name of Product / Service</th>
                         <th className="border-r border-black px-1 py-2 leading-snug whitespace-nowrap">HSN / SAC</th>
                         <th className="border-r border-black px-1 py-2 leading-snug">Qty</th>
                         <th className="border-r border-black px-1 py-2 leading-snug">Rate</th>
                         <th className="border-r border-black px-1 py-2 leading-snug">Taxable<br/>Value</th>
                         {invoice.type === "GST" && <th className="border-r border-black px-1 py-2 leading-snug">CGST</th>}
                         {invoice.type === "GST" && <th className="border-r border-black px-1 py-2 leading-snug">SGST</th>}
                         <th className="px-1 py-2 leading-snug">Total</th>
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
                            <td className="border-r border-black px-2 py-2 text-left font-semibold text-gray-800 whitespace-normal break-words leading-snug">{item.materialType}</td>
                            <td className="border-r border-black px-1 py-2 tabular-nums whitespace-nowrap">{item.hsnCode || "-"}</td>
                            <td className="border-r border-black px-1 py-2 tabular-nums whitespace-nowrap">{item.quantity}</td>
                            <td className="border-r border-black px-1 py-2 text-right tabular-nums whitespace-nowrap">{item.rate.toFixed(2)}</td>
                            <td className="border-r border-black px-1 py-2 text-right tabular-nums whitespace-nowrap">{itemTaxable.toFixed(2)}</td>
                            {invoice.type === "GST" && <td className="border-r border-black px-1 py-2 text-right tabular-nums whitespace-nowrap">{itemCgst.toFixed(2)}</td>}
                            {invoice.type === "GST" && <td className="border-r border-black px-1 py-2 text-right tabular-nums whitespace-nowrap">{itemSgst.toFixed(2)}</td>}
                            <td className="px-1 py-2 text-right font-semibold tabular-nums whitespace-nowrap">{itemTotal.toFixed(2)}</td>
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
                        <td className="border-r border-black px-1 py-2 tabular-nums whitespace-nowrap">{invoice.items.reduce((s,i)=>s+i.quantity, 0).toFixed(2)}</td>
                        <td className="border-r border-black px-1 py-2"></td>
                        <td className="border-r border-black px-1 py-2 text-right tabular-nums whitespace-nowrap">{invoice.subTotal.toFixed(2)}</td>
                        {invoice.type === "GST" && <td className="border-r border-black px-1 py-2 text-right tabular-nums whitespace-nowrap">{invoice.cgst.toFixed(2)}</td>}
                        {invoice.type === "GST" && <td className="border-r border-black px-1 py-2 text-right tabular-nums whitespace-nowrap">{invoice.sgst.toFixed(2)}</td>}
                        <td className="px-1 py-2 text-right text-[11px] tabular-nums whitespace-nowrap">{invoice.total.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                 </table>
               </div>

               <div className="flex text-[11px] leading-tight border-t-2 border-black flex-none">
                 {/* Left Side Footer */}
                 <div className="w-2/3 flex flex-col border-r border-black">
                   <div className="border-b border-black p-2">
                     <div className="font-bold text-gray-700 mb-1">Total in words</div>
                     <div className="uppercase font-bold tracking-wide">{toWords.convert(invoice.total)}</div>
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
          </div>{/* end scale wrapper */}
        </div>{/* end previewWrap */}

        <div className="shrink-0 sticky bottom-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-4 md:pb-4 border-t bg-zinc-50 dark:bg-zinc-900/50 md:rounded-b-2xl print:hidden">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              onClick={onClose}
              disabled={isPrinting}
              className="min-h-11 px-3 py-3 md:py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-sm active:scale-95 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isPrinting}
              onClick={handleWhatsAppShare}
              aria-label="Send invoice on WhatsApp"
              className="min-h-11 flex-1 py-3 md:py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            {isNative() ? (
              <button
                disabled={isPrinting}
                onClick={async () => {
                  setIsPrinting(true);
                  try {
                    const blob = await createInvoicePdfBlob(invoice, customer, companySettings);
                    await sharePdfBlob(blob, `Invoice-${invoice.invoiceNo}.pdf`, `Invoice ${invoice.invoiceNo}`);
                  } finally {
                    setIsPrinting(false);
                  }
                }}
                className="min-h-11 flex-1 py-3 md:py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                {isPrinting ? 'Generating…' : 'Share PDF'}
              </button>
            ) : (
              <button
                disabled={isPrinting}
                onClick={async () => {
                  setIsPrinting(true);
                  try {
                    await downloadInvoicePdf(invoice, customer, companySettings, `Invoice-${invoice.invoiceNo}.pdf`);
                    addToast('success', 'PDF downloaded successfully.');
                    // Delay close so the browser finishes saving the blob URL
                    setTimeout(() => onClose(), 1500);
                  } catch {
                    addToast('error', 'Download failed. Please try again.');
                  } finally {
                    setIsPrinting(false);
                  }
                }}
                className="min-h-11 flex-1 py-3 md:py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isPrinting ? 'Generating…' : 'Download'}
              </button>
            )}
            <button
              disabled={isPrinting}
              onClick={async () => {
                if (isNative()) {
                  // Android WebView cannot use window.print() or html2canvas.
                  // Generate via jsPDF and open the native share sheet instead.
                  setIsPrinting(true);
                  try {
                    const blob = await createInvoicePdfBlob(invoice, customer, companySettings);
                    await sharePdfBlob(blob, `Invoice-${invoice.invoiceNo}.pdf`, `Invoice ${invoice.invoiceNo}`);
                  } finally {
                    setIsPrinting(false);
                  }
                } else {
                  const element = document.getElementById('print-invoice-area');
                  if (!element) return;
                  // Use iframe print in the current tab — opening a new tab
                  // causes a freeze when the user cancels the print dialog.
                  printHtml(element.outerHTML);
                  onClose();
                }
              }}
              className="min-h-11 flex-1 py-3 md:py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-sm active:scale-95 disabled:opacity-50"
            >
              {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {isPrinting ? 'Generating…' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
