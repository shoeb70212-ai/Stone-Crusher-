import React, { useState, useRef, useEffect, useCallback } from "react";
import { Slip } from "../../types";
import { X, Printer, Share2, Bluetooth, Loader2, MessageCircle } from "lucide-react";
import { useErp } from "../../context/ErpContext";
import { createSlipPdfBlob, printHtml, sharePdfBlob, PRIMARY_COLORS } from "../../lib/print-utils";
import { buildSlipWhatsAppMessage, openWhatsAppMessage } from "../../lib/whatsapp-share";
import { isNative } from "../../lib/capacitor";
import { useBodyScrollLock } from "../../lib/use-body-scroll-lock";
import {
  scanForPrinters,
  connectPrinter,
  disconnectPrinter,
  printSlip,
  getConnectedPrinterId,
  type BluetoothDevice,
  type SlipPrintData,
} from "../../lib/escpos";
import { useToast } from "../ui/Toast";

export function PrintSlipModal({ slip, onClose }: { slip: Slip; onClose: () => void }) {
  const { companySettings, customers } = useErp();
  const { addToast } = useToast();
  const [format, setFormat] = useState(companySettings.slipFormat || "Thermal-58mm");
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);
  const [btScanning, setBtScanning] = useState(false);
  const [btConnecting, setBtConnecting] = useState<string | null>(null);
  const [btPrinting, setBtPrinting] = useState(false);
  const [showBtPanel, setShowBtPanel] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const scanCancelledRef = useRef(false);

  useBodyScrollLock(true);

  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  // Scale the fixed-width A4 preview so it fits the container without horizontal scroll
  useEffect(() => {
    if (format !== 'A4') {
      setPreviewScale(1);
      return;
    }
    const el = previewWrapRef.current;
    if (!el) return;
    const containerWidth = el.clientWidth - 32; // subtract p-4 padding
    const contentWidth = 794;
    const scale = Math.min(1, containerWidth / contentWidth);
    setPreviewScale(scale);

    const observer = new ResizeObserver(() => {
      const w = el.clientWidth - 32;
      setPreviewScale(Math.min(1, w / contentWidth));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [format]);

  const borderColor = PRIMARY_COLORS[companySettings.primaryColor || "emerald"] ?? "#10b981";
  const customerName = slip.customerId === 'CASH' || !slip.customerId
    ? 'Counter Sale'
    : (customers.find(c => c.id === slip.customerId)?.name ?? slip.customerId);

  const handleWhatsAppShare = async () => {
    const message = buildSlipWhatsAppMessage({ slip, customerName, companySettings });
    const filename = `Slip-${slip.id.slice(0, 8).toUpperCase()}.pdf`;
    setIsPrinting(true);
    try {
      const blob = await createSlipPdfBlob(slip, customerName, companySettings);
      const result = await sharePdfBlob(blob, filename, 'Loading Slip', message);

      if (result === 'downloaded') {
        openWhatsAppMessage(message);
        addToast("info", "Slip PDF downloaded. Attach it in WhatsApp.");
      } else if (result === 'shared') {
        addToast("success", "Slip PDF is ready to send. Choose WhatsApp from the share sheet.");
      }
    } catch {
      addToast("error", "Could not prepare the slip PDF for WhatsApp.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBluetoothScan = async () => {
    scanCancelledRef.current = false;
    setBtScanning(true);
    setBtDevices([]);
    try {
      const found = await scanForPrinters();
      if (!scanCancelledRef.current) {
        setBtDevices(found);
        if (found.length === 0) addToast("warning", "No Bluetooth devices found. Ensure printer is on and in range.");
      }
    } catch {
      if (!scanCancelledRef.current) addToast("error", "Bluetooth scan failed. Check permissions.");
    } finally {
      if (!scanCancelledRef.current) setBtScanning(false);
    }
  };

  const handleCancelScan = useCallback(() => {
    scanCancelledRef.current = true;
    setBtScanning(false);
  }, []);

  const handleConnect = async (device: BluetoothDevice) => {
    setBtConnecting(device.deviceId);
    try {
      const ok = await connectPrinter(device.deviceId);
      if (ok) {
        addToast('success', `Connected to ${device.name}`);
      } else {
        addToast('error', `Could not find print service on ${device.name}. Try a different device.`);
      }
    } catch {
      addToast('error', 'Connection failed. Check Bluetooth permissions.');
    } finally {
      setBtConnecting(null);
    }
  };

  const handleBtPrint = async () => {
    setBtPrinting(true);
    try {
      const data: SlipPrintData = {
        token: slip.id.toUpperCase().slice(0, 6),
        date: new Date(slip.date).toLocaleDateString('en-IN'),
        vehicleNo: slip.vehicleNo,
        driverName: slip.driverName,
        customerName,
        materialType: slip.materialType,
        quantity: `${slip.quantity.toFixed(1)} ${slip.measurementType === 'Volume (Brass)' ? 'Br' : 'T'}`,
        companyName: companySettings.name || 'CrushTrack',
        receiptFooter: companySettings.receiptFooter,
      };

      await printSlip(data);
      addToast('success', 'Slip printed successfully');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      addToast('error', msg);
    } finally {
      setBtPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/80 flex items-center justify-center md:p-4 z-50 overflow-hidden">
      <div className={`bg-white dark:bg-zinc-800 md:rounded-2xl w-full h-full md:h-auto shadow-xl flex flex-col md:max-h-[90vh] ${format === 'A4' ? 'md:max-w-3xl' : 'md:max-w-sm'}`}>
        <div className="p-4 border-b flex justify-between items-center print:hidden">
          <h3 className="font-bold text-zinc-900 dark:text-white">Print Loading Token</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={previewWrapRef} className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900 p-4">
          {/* Outer wrapper shrinks to the scaled height so there's no dead space below */}
          <div
            style={format === 'A4' ? {
              width: 794 * previewScale,
              height: 'auto',
              margin: '0 auto',
            } : { margin: '0 auto' }}
          >
          <div
            id="print-area"
            className="text-black bg-white relative p-2 md:p-4"
            style={{
              width: format === 'A4' ? '794px' : (format === 'Thermal-58mm' ? '180px' : '240px'),
              transformOrigin: 'top left',
              transform: format === 'A4' && previewScale < 1 ? `scale(${previewScale})` : undefined,
            }}
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
              <tr>
                <td className="border border-black p-1 font-bold">Customer</td>
                <td className="border border-black p-1 font-bold">{customerName}</td>
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
          </div>{/* end scale wrapper */}
          </div>{/* end previewWrap */}

        <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 print:hidden space-y-3">
          {/* Bluetooth printer panel — native only */}
          {isNative() && showBtPanel && (
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  {btScanning && <Loader2 className="w-3 h-3 animate-spin text-primary-500" />}
                  Bluetooth Printers
                </span>
                {btScanning ? (
                  <button
                    onClick={handleCancelScan}
                    className="text-[10px] text-rose-600 dark:text-rose-400 font-medium px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={handleBluetoothScan}
                    className="text-[10px] text-primary-600 dark:text-primary-400 font-medium"
                  >
                    Scan
                  </button>
                )}
              </div>
              {btDevices.length === 0 && !btScanning && (
                <p className="text-[10px] text-zinc-400">Tap Scan to find nearby printers</p>
              )}
              {btDevices.map((device) => {
                const isConnected = getConnectedPrinterId() === device.deviceId;
                const isConnecting = btConnecting === device.deviceId;
                return (
                  <div key={device.deviceId} className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-700 last:border-0">
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1 mr-2">{device.name}</span>
                    {isConnected ? (
                      <button
                        onClick={handleBtPrint}
                        disabled={btPrinting}
                        className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded font-medium disabled:opacity-50 flex items-center gap-1"
                      >
                        {btPrinting && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        {btPrinting ? 'Printing…' : 'Print'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(device)}
                        disabled={!!btConnecting}
                        className="text-[10px] bg-primary-500 hover:bg-primary-600 text-white px-2 py-1 rounded font-medium disabled:opacity-50 flex items-center gap-1"
                      >
                        {isConnecting && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                        {isConnecting ? 'Connecting…' : 'Connect'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:flex">
            {isNative() ? (
              <>
                <button
                  onClick={() => setShowBtPanel((v) => !v)}
                  disabled={isPrinting}
                  className="min-h-11 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-3 md:py-2 rounded-xl font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                  title="Bluetooth thermal print"
                >
                  <Bluetooth className="w-4 h-4" />
                </button>
                <button
                  disabled={isPrinting}
                  onClick={async () => {
                    const filename = `Slip-${slip.id.slice(0, 8).toUpperCase()}.pdf`;
                    setIsPrinting(true);
                    try {
                      const blob = await createSlipPdfBlob(slip, customerName, companySettings);
                      await sharePdfBlob(blob, filename, 'Share Loading Token');
                    } finally {
                      setIsPrinting(false);
                    }
                  }}
                  className="min-h-11 flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-3 md:py-2 rounded-xl font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  {isPrinting ? 'Generating…' : 'Share'}
                </button>
              </>
            ) : (
              <button
                disabled={isPrinting}
                onClick={async () => {
                  const filename = `Slip-${slip.id.slice(0, 8).toUpperCase()}.pdf`;
                  setIsPrinting(true);
                  try {
                    const blob = await createSlipPdfBlob(slip, customerName, companySettings);
                    await sharePdfBlob(blob, filename);
                    addToast('success', 'PDF downloaded successfully.');
                    setTimeout(() => onClose(), 1500);
                  } catch (err) {
                    console.error('Slip PDF download failed:', err);
                    addToast('error', 'Download failed. Please try again.');
                  } finally {
                    setIsPrinting(false);
                  }
                }}
                className="min-h-11 flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-3 md:py-2 rounded-xl font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isPrinting ? 'Generating…' : 'Download'}
              </button>
            )}
            <button
              type="button"
              disabled={isPrinting}
              onClick={handleWhatsAppShare}
              aria-label="Send slip on WhatsApp"
              className="min-h-11 flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3 py-3 md:py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              disabled={isPrinting}
              onClick={async () => {
                const el = document.getElementById('print-area');
                if (!el) return;
                if (isNative()) {
                  const filename = `Slip-${slip.id.slice(0, 8).toUpperCase()}.pdf`;
                  setIsPrinting(true);
                  try {
                    const blob = await createSlipPdfBlob(slip, customerName, companySettings);
                    await sharePdfBlob(blob, filename, 'Share Loading Token');
                  } finally {
                    setIsPrinting(false);
                  }
                } else {
                  // Use iframe print in the current tab — opening a new tab
                  // causes a freeze when the user cancels the print dialog.
                  printHtml(el.innerHTML);
                  onClose();
                }
              }}
              className="min-h-11 flex-1 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white px-3 py-3 md:py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50"
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
