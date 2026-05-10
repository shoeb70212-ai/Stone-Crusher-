/**
 * Utility functions for generating, printing, downloading, and sharing PDF invoices.
 *
 * Architecture notes:
 * - `printHtml` uses a hidden iframe + browser print dialog (fallback path).
 * - `generatePdfBlob` is the shared core that converts HTML → PDF blob via html2pdf.js.
 * - `openPdfInNewTab` and `downloadPdf` are the two primary entry points.
 * - `sharePdf` / `saveNativePdf` use @capacitor/share and @capacitor/filesystem
 *   when running inside the Capacitor native shell; they fall back to the
 *   browser download path on web.
 * - Popup blockers require `window.open` to be called synchronously inside the
 *   user-initiated click handler. Callers MUST open the window themselves and
 *   pass it in — this module never calls `window.open` on its own.
 */

import { isNative } from './capacitor';
import type { CompanySettings, Customer, Invoice, Slip } from '../types';
import { toWords, formatVehicleNo, formatQuantity } from './utils';

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

/** Hex colour for each named primary-colour token used in company settings. */
export const PRIMARY_COLORS: Record<string, string> = {
  emerald: '#10b981',
  blue:    '#3b82f6',
  violet:  '#8b5cf6',
  rose:    '#f43f5e',
  amber:   '#f59e0b',
};

/** Default payment-term offset used when rendering a due date on invoices. */
export const DEFAULT_PAYMENT_TERM_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

/** Fallback T&C printed on invoices when the company hasn't configured custom terms. */
const DEFAULT_INVOICE_TERMS = [
  'Subject to local jurisdiction.',
  'Our Responsibility Ceases as soon as goods leaves our Premises.',
  'Goods once sold will not be taken back.',
  'Delivery Ex-Premises.',
];

// ---------------------------------------------------------------------------
// PDF type aliases (hoisted so both invoice and slip generators can use them)
// ---------------------------------------------------------------------------

type PdfColor  = string | [number, number, number];
type TextAlign = 'left' | 'center' | 'right';
type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';
type CellOptions = {
  align?:      TextAlign;
  valign?:     'top' | 'middle';
  fill?:       PdfColor;
  color?:      PdfColor;
  size?:       number;
  style?:      FontStyle;
  pad?:        number;
  lineHeight?: number;
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Yields to the main thread, guaranteeing at least one paint frame so loading
 * spinners / overlays can render before html2canvas blocks the UI thread.
 */
export function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  });
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    promise.then(
      value => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      error => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>(resolve => {
        const timeoutId = window.setTimeout(resolve, 5000);
        const done = () => { window.clearTimeout(timeoutId); resolve(); };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    }),
  );
}

/** Default html2pdf options for A4 portrait output. */
function pdfOptions(filename: string) {
  return {
    margin: [8, 8] as [number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.85 },
    // Scale 1 keeps the canvas work manageable on both web and native.
    // Scale 2 doubles memory/CPU and freezes the UI thread for several seconds.
    html2canvas: { scale: 1, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  };
}

// ---------------------------------------------------------------------------
// Core PDF generation
// ---------------------------------------------------------------------------

/**
 * Converts HTML content into a PDF Blob via html2pdf.js.
 * Temporarily appends a measurable render host to the DOM so html2pdf can
 * compute layout without touching the visible invoice modal.
 *
 * @param htmlContent - Raw innerHTML of the invoice area.
 * @param filename    - Filename embedded in the PDF metadata.
 * @returns A Blob containing the generated PDF.
 */
async function generatePdfBlob(htmlContent: string, filename: string): Promise<Blob> {
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = (html2pdfModule.default || html2pdfModule) as typeof html2pdfModule.default;

  // Create a hidden wrapper. The page's loaded stylesheets (Tailwind, etc.)
  // already apply to any element appended to document.body, so we do NOT
  // need to re-inject all CSS via collectCssRules(). This dramatically
  // reduces html2canvas parse/layout time.
  // NOTE: Do NOT use position:fixed;left:-9999px — html2canvas cannot render
  // elements positioned off-screen with fixed positioning.
  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.cssText = [
    'position:absolute',
    `top:${Math.max(0, window.scrollY)}px`,
    'left:0',
    'width:max-content',
    'max-width:none',
    'background:white',
    'color:black',
    'pointer-events:none',
    'z-index:-1',
    'contain:layout style',
  ].join(';');
  wrapper.innerHTML = `<style>
    .shadow-2xl { box-shadow: none !important; }
    .rounded-xl { border-radius: 0 !important; }
    .print\\:hidden { display: none !important; }
  </style>
  <div style="background:white;color:black;width:max-content;max-width:none;">${htmlContent}</div>`;
  document.body.appendChild(wrapper);

  // Yield so the loading spinner / overlay can paint at least one frame
  // before html2canvas blocks the main thread.
  await yieldToMain();
  await waitForImages(wrapper);

  try {
    return await withTimeout(
      html2pdf().set(pdfOptions(filename)).from(wrapper).outputPdf('blob'),
      10000,
      'PDF generation',
    );
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Opens a browser print dialog for the given HTML content using a hidden iframe.
 * Used as a fallback when jsPDF-based printing is unavailable.
 *
 * Waits for all linked stylesheets in the iframe to finish loading before
 * triggering print() — otherwise Tailwind styles may not be applied yet and
 * the printed output is unstyled.
 *
 * @param htmlContent - Raw innerHTML to print.
 * @returns Promise that resolves when the print dialog is dismissed (or after
 *          a 90s timeout for WebViews that never fire afterprint).
 */
export function printHtml(htmlContent: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    // Off-screen but visible to the rendering engine so html/css applies.
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      resolve();
      return;
    }

    // Collect existing stylesheet hrefs and inline <style> contents so the
    // iframe inherits the host page's styling (Tailwind, design tokens, etc.).
    const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Print</title>${styleNodes}<style>
      @media print {
        @page { size: A4; margin: 8mm; }
        html, body { margin:0; padding:0; }
        body { -webkit-print-color-adjust:exact; print-color-adjust:exact; background:white!important; color:black!important; }
        .shadow-2xl { box-shadow:none!important; }
        .rounded-xl, .rounded-2xl { border-radius:0!important; }
        .m-4 { margin:0!important; }
        /* Strip preview transforms — the modal preview applies scale() that
           would otherwise carry over into print output. */
        [id="print-area"], [id="print-invoice-area"] {
          transform: none !important;
          width: auto !important;
        }
      }
    </style></head><body class="bg-white text-black p-2 md:p-4">${htmlContent}</body></html>`);
    doc.close();

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // print() can throw on some WebViews — fall through to cleanup.
        cleanup();
        finish();
        return;
      }
      // afterprint fires whether the user prints OR cancels. Keep iframe alive
      // until then so the print job can flush to the printer.
      iframe.contentWindow?.addEventListener('afterprint', () => {
        finish();
        setTimeout(cleanup, 500);
      }, { once: true });
      // Long fallback for WebViews that never fire afterprint.
      setTimeout(() => {
        if (!settled) {
          finish();
          cleanup();
        }
      }, 90_000);
    };

    // Wait for stylesheets in the iframe to finish loading before printing.
    // Without this, Tailwind utilities haven't been applied yet on first paint.
    const waitForStyles = async () => {
      const idoc = iframe.contentWindow?.document;
      if (!idoc) { triggerPrint(); return; }
      const links = Array.from(idoc.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
      await Promise.all(links.map(link => {
        if ((link as any).sheet) return Promise.resolve();
        return new Promise<void>((res) => {
          const done = () => res();
          const t = window.setTimeout(done, 3000);
          link.addEventListener('load', () => { window.clearTimeout(t); done(); }, { once: true });
          link.addEventListener('error', () => { window.clearTimeout(t); done(); }, { once: true });
        });
      }));
      // One extra paint frame so layout settles after style application.
      await yieldToMain();
      triggerPrint();
    };

    iframe.onload = () => { void waitForStyles(); };
    // Some browsers don't fire onload for document.write content — fall back.
    setTimeout(() => { if (!settled && !cleaned) void waitForStyles(); }, 200);
  });
}



// ---------------------------------------------------------------------------
// Native share sheet (P0 — Share Sheet Integration)
// ---------------------------------------------------------------------------

/** Coerces any value to a finite number, returning 0 for NaN / Infinity. */
export function safeNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function sanitizePdfFilename(filename: string): string {
  // eslint-disable-next-line no-control-regex
  return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const safeFilename = sanitizePdfFilename(filename);
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = safeFilename;
  document.body.appendChild(anchor);
  anchor.click();

  // Clean up after the browser has had time to initiate the download.
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1000);
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  triggerBlobDownload(blob, filename);
}

/**
 * Detects browsers/WebViews where `iframe.contentWindow.print()` does NOT
 * reliably print PDF blob contents (it either prints the host page or
 * silently does nothing). When detected, callers should download instead.
 */
function isIframePrintUnsupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS Safari / iOS WebView — iframe.print() does not print the PDF blob.
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  // Firefox — printing a PDF blob from a hidden iframe shows the PDF viewer's
  // own print, which prints the iframe's host document instead.
  const isFirefox = /Firefox\//.test(ua);
  return isIOS || isFirefox;
}

export function printPdfBlob(blob: Blob, title = 'Print Document'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Printing is only available in a browser.'));
      return;
    }

    // Browsers where iframe-based PDF printing is unreliable: download instead.
    // Caller can chain a toast informing the user.
    if (isIframePrintUnsupported()) {
      try {
        const filename = sanitizePdfFilename(`${title}.pdf`);
        triggerBlobDownload(blob, filename);
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Print fallback failed.'));
      }
      return;
    }

    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.title = title;
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';

    let cleaned = false;
    let settled = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      URL.revokeObjectURL(url);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    iframe.onload = () => {
      // Two RAFs to ensure the embedded PDF viewer has rendered its first frame
      // before we trigger print(). Otherwise some browsers print a blank page.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (error) {
            fail(error instanceof Error ? error : new Error('Print failed.'));
            return;
          }

          // Resolve once afterprint fires (user dismissed the print dialog).
          // Do NOT remove the iframe before this — Chrome cancels the print
          // job if the iframe is detached while the dialog is still open.
          iframe.contentWindow?.addEventListener(
            'afterprint',
            () => {
              finish();
              // Delay cleanup so the print job actually flushes to the printer.
              setTimeout(cleanup, 500);
            },
            { once: true },
          );

          // Fallback for browsers/WebViews that don't fire afterprint on cancel.
          // 4s covers the dialog appearing; afterprint handles the normal path.
          setTimeout(() => {
            if (!settled) {
              finish();
              cleanup();
            }
          }, 4_000);
        });
      });
    };
    iframe.onerror = () => {
      fail(new Error('Could not load PDF for printing.'));
    };

    document.body.appendChild(iframe);
    iframe.src = url;
  });
}

function isShareCancel(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || /cancel/i.test(error.message);
}

export type PdfShareResult = 'shared' | 'downloaded' | 'cancelled';

// ---------------------------------------------------------------------------
// jsPDF drawing primitives
// ---------------------------------------------------------------------------

/**
 * Returns a set of stateless drawing helpers bound to a single jsPDF document.
 * Extracting these keeps `createInvoicePdfBlob` focused on layout logic rather
 * than low-level PDF API calls.
 */
function createPainter(doc: import('jspdf').jsPDF, textDark: PdfColor) {
  const setFillColor = (color: PdfColor) => {
    if (typeof color === 'string') doc.setFillColor(color);
    else doc.setFillColor(color[0], color[1], color[2]);
  };

  const setTextColor = (color: PdfColor) => {
    if (typeof color === 'string') doc.setTextColor(color);
    else doc.setTextColor(color[0], color[1], color[2]);
  };

  const setStroke = (lineWidth = 0.25) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(lineWidth);
  };

  const setFont = (size = 9, style: FontStyle = 'normal', color: PdfColor = textDark) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    setTextColor(color);
  };

  const rect = (x: number, y: number, w: number, h: number, fill?: PdfColor, lineWidth = 0.25) => {
    setStroke(lineWidth);
    if (fill) {
      setFillColor(fill);
      doc.rect(x, y, w, h, 'FD');
    } else {
      doc.rect(x, y, w, h, 'S');
    }
  };

  const line = (x1: number, y1: number, x2: number, y2: number, width = 0.25) => {
    setStroke(width);
    doc.line(x1, y1, x2, y2);
  };

  const writeText = (
    value: string,
    x: number,
    y: number,
    options: CellOptions & { maxWidth?: number } = {},
  ) => {
    setFont(options.size ?? 9, options.style ?? 'normal', options.color ?? textDark);
    const lines = options.maxWidth ? doc.splitTextToSize(value || '-', options.maxWidth) : value || '-';
    doc.text(lines, x, y, { align: options.align });
  };

  const drawCell = (x: number, y: number, w: number, h: number, value: string, options: CellOptions = {}) => {
    rect(x, y, w, h, options.fill);
    const pad = options.pad ?? 2.3;
    const align = options.align ?? 'left';
    const lineHeight = options.lineHeight ?? 4.2;
    const lines = doc.splitTextToSize(value || '', Math.max(1, w - pad * 2));
    const textX = align === 'right' ? x + w - pad : align === 'center' ? x + w / 2 : x + pad;
    const blockHeight = Math.max(0, (lines.length - 1) * lineHeight);
    const textY = options.valign === 'middle'
      ? y + h / 2 - blockHeight / 2 + 1.5
      : y + pad + 3;
    setFont(options.size ?? 8.5, options.style ?? 'normal', options.color ?? textDark);
    doc.text(lines, textX, textY, { align });
  };

  const drawLabelValue = (
    label: string,
    value: string,
    x: number,
    y: number,
    labelW: number,
    valueW: number,
    boldValue = false,
  ) => {
    const textMuted: PdfColor = [65, 72, 86];
    writeText(label, x, y + 4, { size: 8.2, style: 'bold', color: textMuted });
    writeText(value || '-', x + labelW, y + 4, { size: 8.4, style: boldValue ? 'bold' : 'normal', maxWidth: valueW });
  };

  return { setFillColor, setTextColor, setFont, rect, line, writeText, drawCell, drawLabelValue };
}

/**
 * Generates an invoice PDF directly with jsPDF.
 *
 * The invoice download path intentionally avoids html2canvas/html2pdf because
 * rasterising the live Tailwind/React invoice preview can hang the browser.
 */
export async function createInvoicePdfBlob(
  invoice: Invoice,
  customer: Customer | undefined,
  companySettings: CompanySettings,
  slips?: Slip[],
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const boxX = margin;
  const boxY = 14;
  const boxW = pageWidth - margin * 2;
  const boxH = pageHeight - boxY - 18;
  const isGst = invoice.type === 'GST';
  const title = isGst ? 'TAX INVOICE' : 'INVOICE';
  const customerName = customer?.name || (invoice.customerId === 'CASH' ? 'Cash Customer' : invoice.customerId) || 'Unknown Customer';
  const invoiceDate = new Date(invoice.date).toLocaleDateString('en-GB');
  const totalQty = invoice.items.reduce((sum, item) => sum + safeNumber(item.quantity), 0);
  const totalTax = safeNumber(invoice.cgst) + safeNumber(invoice.sgst);
  const amountInWords = toWords.convert(safeNumber(invoice.total)).toUpperCase();
  const primary =
    PRIMARY_COLORS[companySettings.primaryColor || 'emerald'] ||
    companySettings.invoiceColor ||
    '#10b981';

  const black: PdfColor = [0, 0, 0];
  const textDark: PdfColor = [20, 20, 20];
  const textMuted: PdfColor = [65, 72, 86];
  const lightFill: PdfColor = [248, 249, 250];
  const totalFill: PdfColor = [243, 244, 246];

  const { setFillColor, setTextColor, setFont, rect, line, writeText, drawCell, drawLabelValue } =
    createPainter(doc, textDark);

  const drawWatermark = () => {
    if (!companySettings.invoiceWatermark || companySettings.invoiceWatermark === 'None') return;
    const watermarkText =
      companySettings.invoiceWatermark === 'Company Name'
        ? companySettings.name
        : companySettings.invoiceWatermark === 'Status'
          ? invoice.status || 'PENDING'
          : companySettings.invoiceWatermarkText;
    if (!watermarkText) return;
    doc.saveGraphicsState();
    setTextColor([235, 235, 235]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(42);
    doc.text(watermarkText.toUpperCase(), pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: -35,
    });
    doc.restoreGraphicsState();
  };

  const terms = companySettings.termsAndConditions
    ? companySettings.termsAndConditions.split('\n').map(term => term.trim()).filter(Boolean)
    : DEFAULT_INVOICE_TERMS;

  const drawHeader = (headerH: number, splitRight = false, headerY = boxY) => {
    if (splitRight) {
      const rightW = 54;
      line(boxX + boxW - rightW, headerY, boxX + boxW - rightW, headerY + headerH, 0.45);
      drawCell(boxX + boxW - rightW, headerY, rightW, 13, title, {
        align: 'center',
        valign: 'middle',
        fill: totalFill,
        size: 10,
        style: 'bold',
      });
      const detailY = headerY + 13;
      const labelW = 22;
      const rowH = companySettings.invoiceShowDueDate ? 8.4 : 10.5;
      const rows = [
        ['Inv No.', invoice.invoiceNo],
        ['Date', invoiceDate],
        ...(companySettings.invoiceShowDueDate
          ? [['Due Date', new Date(new Date(invoice.date).getTime() + DEFAULT_PAYMENT_TERM_MS).toLocaleDateString('en-GB')]]
          : []),
      ];
      rows.forEach(([labelText, valueText], index) => {
        const rowY = detailY + index * rowH;
        drawCell(boxX + boxW - rightW, rowY, labelW, rowH, labelText, {
          size: 7.5,
          style: 'bold',
          color: textMuted,
        });
        drawCell(boxX + boxW - rightW + labelW, rowY, rightW - labelW, rowH, valueText, {
          size: 7.5,
          style: 'bold',
        });
      });
    }

    const nameMaxWidth = splitRight ? 116 : 126;
    writeText((companySettings.name || 'COMPANY NAME').toUpperCase(), boxX + 6, headerY + 18, {
      size: 22,
      style: 'bold',
      color: splitRight ? black : primary,
      maxWidth: nameMaxWidth,
    });
    if (companySettings.address) {
      writeText(companySettings.address, boxX + 6, headerY + 32, {
        size: 8.3,
        color: textDark,
        maxWidth: 78,
      });
    }
    if (!splitRight) {
      const rightX = boxX + boxW - 6;
      if (companySettings.phone) {
        writeText(`Tel : ${companySettings.phone}`, rightX, headerY + 32, {
          size: 8.5,
          style: 'bold',
          align: 'right',
        });
      }
      if (companySettings.gstin) {
        writeText(`GSTIN : ${companySettings.gstin}`, rightX, headerY + 39, {
          size: 8.5,
          style: 'bold',
          align: 'right',
        });
      }
    } else {
      const inlineDetails = [
        companySettings.phone ? `Phone: ${companySettings.phone}` : '',
        companySettings.gstin && isGst ? `GSTIN: ${companySettings.gstin}` : '',
      ].filter(Boolean).join('    ');
      if (inlineDetails) {
        writeText(inlineDetails, boxX + 6, headerY + 43, { size: 7.8, color: textMuted, maxWidth: 116 });
      }
    }
    line(boxX, headerY + headerH, boxX + boxW, headerY + headerH, 0.45);
  };

  const drawClassicDetails = (y: number, h: number) => {
    line(boxX + boxW / 2, y, boxX + boxW / 2, y + h);
    drawCell(boxX, y, boxW / 2, 9, 'Customer Detail', {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 8.5,
      style: 'bold',
    });
    const leftX = boxX + 4;
    const rightX = boxX + boxW / 2 + 6;
    const contentY = y + 14;
    drawLabelValue('M/S', customerName || '-', leftX, contentY, 24, 56, true);
    drawLabelValue('Address', customer?.address || '-', leftX, contentY + 7, 24, 56);
    drawLabelValue('Phone', customer?.phone || '-', leftX, contentY + 14, 24, 56);
    if (isGst) drawLabelValue('GSTIN', customer?.gstin || '-', leftX, contentY + 21, 24, 56);
    drawLabelValue('Invoice No.', invoice.invoiceNo, rightX, contentY + 1, 32, 46, true);
    drawLabelValue('Invoice Date', invoiceDate, rightX, contentY + 14, 32, 46);
  };

  const drawMinimalDetails = (y: number, h: number) => {
    line(boxX + boxW / 2, y, boxX + boxW / 2, y + h);
    drawCell(boxX, y, boxW / 2, 8, 'Billed To', {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 8,
      style: 'bold',
    });
    drawCell(boxX + boxW / 2, y, boxW / 2, 8, 'Invoice / Payment Details', {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 8,
      style: 'bold',
    });
    const leftX = boxX + 4;
    const rightX = boxX + boxW / 2 + 4;
    const contentY = y + 13;
    drawLabelValue('Name', customerName || '-', leftX, contentY, 22, 58, true);
    drawLabelValue('Address', customer?.address || '-', leftX, contentY + 7, 22, 58);
    drawLabelValue('Phone', customer?.phone || '-', leftX, contentY + 14, 22, 58);
    if (isGst) drawLabelValue('GSTIN', customer?.gstin || '-', leftX, contentY + 21, 22, 58);
    const rightRows: [string, string, boolean][] = [
      ['Invoice No.', invoice.invoiceNo, true],
      ['Invoice Date', invoiceDate, false],
      ['Status', invoice.status, false],
      ['Type', invoice.type, false],
      ['Bank', companySettings.bankName || '-', false],
    ];
    if (companySettings.invoiceShowDueDate) {
      const dueDate = new Date(new Date(invoice.date).getTime() + DEFAULT_PAYMENT_TERM_MS).toLocaleDateString('en-GB');
      rightRows.splice(2, 0, ['Due Date', dueDate, false]);
    }
    rightRows.slice(0, 5).forEach(([label, value, bold], index) => {
      drawLabelValue(label, value, rightX, contentY + index * 6.5, 30, 54, bold);
    });
  };

  const drawInvoiceTable = (y: number, h: number, mode: 'classic' | 'minimal') => {
    const headerH = mode === 'classic' ? 17 : 15;
    const totalH = 12;
    const bodyH = h - headerH - totalH;
    const rowCount = Math.max(8, invoice.items.length);
    const rowH = bodyH / rowCount;
    const columns = mode === 'minimal'
      ? [
          { label: 'Sr.', w: 12, align: 'center' as TextAlign },
          { label: 'Description', w: 70, align: 'left' as TextAlign },
          { label: 'HSN / SAC', w: 25, align: 'center' as TextAlign },
          { label: 'Qty', w: 18, align: 'center' as TextAlign },
          { label: 'Rate', w: 25, align: 'right' as TextAlign },
          { label: 'Amount', w: 32, align: 'right' as TextAlign },
        ]
      : isGst
        ? [
            { label: 'Sr.\nNo.', w: 10, align: 'center' as TextAlign },
            { label: 'Name of Product / Service', w: 48, align: 'left' as TextAlign },
            { label: 'HSN / SAC', w: 18, align: 'center' as TextAlign },
            { label: 'Qty', w: 13, align: 'center' as TextAlign },
            { label: 'Rate', w: 17, align: 'right' as TextAlign },
            { label: 'Taxable\nValue', w: 23, align: 'right' as TextAlign },
            { label: 'CGST', w: 16, align: 'right' as TextAlign },
            { label: 'SGST', w: 16, align: 'right' as TextAlign },
            { label: 'Total', w: 21, align: 'right' as TextAlign },
          ]
        : [
            { label: 'Sr.\nNo.', w: 12, align: 'center' as TextAlign },
            { label: 'Name of Product / Service', w: 62, align: 'left' as TextAlign },
            { label: 'HSN / SAC', w: 22, align: 'center' as TextAlign },
            { label: 'Qty', w: 16, align: 'center' as TextAlign },
            { label: 'Rate', w: 23, align: 'right' as TextAlign },
            { label: 'Taxable\nValue', w: 28, align: 'right' as TextAlign },
            { label: 'Total', w: 19, align: 'right' as TextAlign },
          ];

    rect(boxX, y, boxW, h);
    rect(boxX, y, boxW, headerH, lightFill);
    rect(boxX, y + h - totalH, boxW, totalH, totalFill);

    let x = boxX;
    columns.forEach((column, index) => {
      if (index > 0) line(x, y, x, y + h);
      drawCell(x, y, column.w, headerH, column.label, {
        align: column.align,
        valign: 'middle',
        size: 8,
        style: 'bold',
        fill: lightFill,
        pad: 1.5,
      });
      x += column.w;
    });
    line(boxX, y + headerH, boxX + boxW, y + headerH, 0.45);
    line(boxX, y + h - totalH, boxX + boxW, y + h - totalH, 0.45);

    invoice.items.forEach((item, index) => {
      const itemY = y + headerH + index * rowH;
      const taxable = safeNumber(item.amount);
      const gstRate = safeNumber(item.gstRate || 5);
      const itemCgst = isGst ? (taxable * (gstRate / 2)) / 100 : 0;
      const itemSgst = isGst ? (taxable * (gstRate / 2)) / 100 : 0;
      const itemTotal = mode === 'minimal' ? taxable : taxable + itemCgst + itemSgst;
      const values = mode === 'minimal'
        ? [
            String(index + 1),
            item.materialType || '-',
            item.hsnCode || '-',
            safeNumber(item.quantity).toLocaleString('en-IN'),
            safeNumber(item.rate).toFixed(2),
            itemTotal.toFixed(2),
          ]
        : isGst
          ? [
              String(index + 1),
              item.materialType || '-',
              item.hsnCode || '-',
              safeNumber(item.quantity).toLocaleString('en-IN'),
              safeNumber(item.rate).toFixed(2),
              taxable.toFixed(2),
              itemCgst.toFixed(2),
              itemSgst.toFixed(2),
              itemTotal.toFixed(2),
            ]
          : [
              String(index + 1),
              item.materialType || '-',
              item.hsnCode || '-',
              safeNumber(item.quantity).toLocaleString('en-IN'),
              safeNumber(item.rate).toFixed(2),
              taxable.toFixed(2),
              itemTotal.toFixed(2),
            ];
      let cellX = boxX;
      values.forEach((value, valueIndex) => {
        const column = columns[valueIndex];
        if (!column) return;
        writeText(value, column.align === 'right' ? cellX + column.w - 2 : column.align === 'center' ? cellX + column.w / 2 : cellX + 2, itemY + 5.5, {
          size: 8,
          style: valueIndex === 1 || valueIndex === values.length - 1 ? 'bold' : 'normal',
          align: column.align,
          maxWidth: column.w - 4,
        });
        cellX += column.w;
      });
    });

    let footerX = boxX;
    columns.forEach((column, index) => {
      if (index > 0) line(footerX, y + h - totalH, footerX, y + h);
      footerX += column.w;
    });

    const totalY = y + h - totalH + 7.5;
    if (mode === 'minimal') {
      writeText('Total', boxX + columns[0].w + columns[1].w + columns[2].w - 2, totalY, {
        size: 8,
        style: 'bold',
        align: 'right',
      });
      writeText(totalQty.toFixed(2), boxX + columns[0].w + columns[1].w + columns[2].w + columns[3].w / 2, totalY, {
        size: 8,
        style: 'bold',
        align: 'center',
      });
      writeText(safeNumber(invoice.subTotal).toFixed(2), boxX + boxW - 2, totalY, {
        size: 8.5,
        style: 'bold',
        align: 'right',
      });
      return;
    }

    // Named references replace magic indices — the GST and non-GST column sets
    // have different lengths so index-based access is fragile if columns change.
    const columnRight = (index: number) =>
      boxX + columns.slice(0, index + 1).reduce((sum, column) => sum + column.w, 0);

    const qtyIndex = 3;
    const subtotalIndex = columns.length - (isGst ? 4 : 2);
    const cgstIndex = isGst ? columns.length - 3 : -1;
    const sgstIndex = isGst ? columns.length - 2 : -1;
    const totalIndex = columns.length - 1;

    const labelEnd = columnRight(2) - 2;
    const qtyCenter = columnRight(2) + columns[qtyIndex].w / 2;
    writeText('TOTAL', labelEnd, totalY, { size: 8, style: 'bold', align: 'right' });
    writeText(totalQty.toFixed(2), qtyCenter, totalY, { size: 8, style: 'bold', align: 'center' });
    writeText(safeNumber(invoice.subTotal).toFixed(2), columnRight(subtotalIndex) - 2, totalY, {
      size: 8,
      style: 'bold',
      align: 'right',
    });
    if (isGst) {
      writeText(safeNumber(invoice.cgst).toFixed(2), columnRight(cgstIndex) - 2, totalY, {
        size: 8,
        style: 'bold',
        align: 'right',
      });
      writeText(safeNumber(invoice.sgst).toFixed(2), columnRight(sgstIndex) - 2, totalY, {
        size: 8,
        style: 'bold',
        align: 'right',
      });
    }
    writeText(safeNumber(invoice.total).toFixed(2), columnRight(totalIndex) - 2, totalY, {
      size: 8.8,
      style: 'bold',
      align: 'right',
    });
  };

  const drawClassicFooter = (y: number, h: number, compact = false) => {
    const rightW = compact ? 62 : 61;
    const leftW = boxW - rightW;
    rect(boxX, y, boxW, h);
    line(boxX + leftW, y, boxX + leftW, y + h, 0.45);

    // --- Left column: words → bank → terms ---
    // Fixed heights that always sum to exactly h (no overflow, no gap).
    // bank section = header(8) + 4 rows at 6mm each (24) + 3mm buffer = 35
    // words section = 16mm
    // terms gets all remaining space
    const wordsH = 16;
    const bankSectionH = 35;
    const termsH = h - wordsH - bankSectionH;

    drawCell(boxX, y, leftW, wordsH, `Total in words\n${amountInWords}`, {
      size: 7.5,
      style: 'bold',
      pad: 2.5,
      lineHeight: 4.0,
    });

    const bankY = y + wordsH;
    drawCell(boxX, bankY, leftW, 8, 'Bank Details', {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 8,
      style: 'bold',
    });
    const bankRowH = 6;
    const bankTextY = bankY + 11;
    drawLabelValue('Bank Name',   companySettings.bankName      || '-', boxX + 4, bankTextY,              34, 74);
    drawLabelValue('Branch',      companySettings.branchName    || '-', boxX + 4, bankTextY + bankRowH,   34, 74);
    drawLabelValue('Acc. Number', companySettings.accountNumber || '-', boxX + 4, bankTextY + bankRowH*2, 34, 74);
    drawLabelValue('IFSC',        companySettings.ifscCode      || '-', boxX + 4, bankTextY + bankRowH*3, 34, 74);

    const termsY = bankY + bankSectionH;
    if (termsH >= 8) {
      drawCell(boxX, termsY, leftW, 7, 'Terms and Conditions', {
        align: 'center',
        valign: 'middle',
        fill: lightFill,
        size: 7.8,
        style: 'bold',
      });
      // Fit as many term lines as the remaining space allows
      const termLineH = 4.5;
      const maxTerms = Math.floor((termsH - 7 - 4) / termLineH);
      terms.slice(0, Math.max(1, maxTerms)).forEach((term, index) => {
        writeText(`- ${term}`, boxX + 4, termsY + 11 + index * termLineH, {
          size: 6.8,
          color: textMuted,
          maxWidth: leftW - 8,
        });
      });
    }

    // --- Right column: tax summary rows ---
    // Calculate how tall the summary rows will be so the remaining space
    // can be given to the signature block that sits below them.
    const rightX = boxX + leftW;
    const taxRowH = 9;       // fixed height for each summary row
    const totalRowH = 12;    // slightly taller for the grand total row
    const sigH = 32;         // fixed height reserved for the signature block

    // Rows: Taxable Amount + (CGST + SGST if GST) + Total Tax + Total Amount
    const taxRowCount = isGst ? 4 : 2;  // non-GST: Taxable + Total Tax
    const summaryH = taxRowCount * taxRowH + totalRowH;

    // If summary + signature overflows h, shrink taxRowH proportionally
    const available = h - sigH;
    const effectiveTaxRowH = summaryH <= available ? taxRowH : Math.max(7, (available - totalRowH) / taxRowCount);
    const effectiveTotalRowH = summaryH <= available ? totalRowH : Math.max(10, available - effectiveTaxRowH * taxRowCount);

    const drawSummaryRow = (
      rowY: number,
      rowH: number,
      label: string,
      value: string,
      fill?: PdfColor,
      valueSize = 7.8,
    ) => {
      rect(rightX, rowY, rightW, rowH, fill);
      const baselineY = rowY + rowH / 2 + 1.4;
      writeText(label, rightX + 3, baselineY, {
        size: 7.4,
        style: 'bold',
        color: textMuted,
        maxWidth: rightW - 24,
      });
      writeText(value, rightX + rightW - 3, baselineY, {
        size: valueSize,
        style: 'bold',
        align: 'right',
        maxWidth: 22,
      });
    };

    const drawGrandTotalRow = (rowY: number, rowH: number) => {
      rect(rightX, rowY, rightW, rowH, totalFill);
      const labelLines = doc.splitTextToSize('Total Amount After Tax', 32);
      const lineHeight = 4.1;
      const labelY = rowY + rowH / 2 - ((labelLines.length - 1) * lineHeight) / 2 + 1.5;
      setFont(8, 'bold', textDark);
      doc.text(labelLines, rightX + 3, labelY, { align: 'left', lineHeightFactor: 1.2 });
      writeText(`Rs. ${safeNumber(invoice.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, rightX + rightW - 3, rowY + rowH / 2 + 1.6, {
        size: 8.9,
        style: 'bold',
        align: 'right',
        maxWidth: 25,
      });
    };

    drawSummaryRow(y, effectiveTaxRowH, 'Taxable Amount', safeNumber(invoice.subTotal).toFixed(2), lightFill);
    let rightY = y + effectiveTaxRowH;
    if (isGst) {
      drawSummaryRow(rightY, effectiveTaxRowH, 'Add : CGST', safeNumber(invoice.cgst).toFixed(2));
      rightY += effectiveTaxRowH;
      drawSummaryRow(rightY, effectiveTaxRowH, 'Add : SGST', safeNumber(invoice.sgst).toFixed(2));
      rightY += effectiveTaxRowH;
    }
    drawSummaryRow(rightY, effectiveTaxRowH, 'Total Tax', totalTax.toFixed(2), lightFill, 8.8);
    rightY += effectiveTaxRowH;
    drawGrandTotalRow(rightY, effectiveTotalRowH);
    rightY += effectiveTotalRowH;

    // --- Signature block anchored immediately below summary rows ---
    // Distribute the remaining space: company name at top, signature line + signatory at bottom.
    const sigBottom = y + h;
    writeText(`For ${companySettings.name || 'Company'}`.toUpperCase(), rightX + rightW / 2, rightY + 9, {
      size: 7.5,
      style: 'bold',
      color: primary,
      align: 'center',
      maxWidth: rightW - 6,
    });
    line(rightX + 10, sigBottom - 10, rightX + rightW - 10, sigBottom - 10);
    writeText('Authorised Signatory', rightX + rightW / 2, sigBottom - 5, {
      size: 6.5,
      style: 'bold',
      align: 'center',
    });
  };

  const drawMinimalFooter = (y: number, h: number) => {
    // Guard against negative/zero height if invoice table overflows page.
    const fh = Math.max(20, h);
    const rightW = 64;
    const leftW = boxW - rightW;
    rect(boxX, y, boxW, fh);
    line(boxX + leftW, y, boxX + leftW, y + fh, 0.45);
    drawCell(boxX, y, leftW, 18, `Amount in words\n${amountInWords}`, {
      size: 8,
      style: 'bold',
      lineHeight: 4.5,
    });
    let leftY = y + 18;
    if (companySettings.termsAndConditions) {
      drawCell(boxX, leftY, leftW, 20, `Terms and Conditions\n${companySettings.termsAndConditions}`, {
        size: 7,
        color: textMuted,
        lineHeight: 4.1,
      });
      leftY += 20;
    }
    drawCell(boxX, leftY, leftW, y + fh - leftY, `Payment Details\n${[companySettings.bankName, companySettings.accountNumber ? `A/C: ${companySettings.accountNumber}` : '', companySettings.ifscCode ? `IFSC: ${companySettings.ifscCode}` : ''].filter(Boolean).join('  ') || '-'}`, {
      size: 7.3,
      color: textMuted,
      lineHeight: 4.2,
    });

    const rightX = boxX + leftW;
    const rows = [
      ['Subtotal', safeNumber(invoice.subTotal).toFixed(2), false],
      ...(isGst
        ? [
            ['CGST', safeNumber(invoice.cgst).toFixed(2), false],
            ['SGST', safeNumber(invoice.sgst).toFixed(2), false],
          ] as [string, string, boolean][]
        : []),
      ['Total', `Rs. ${safeNumber(invoice.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, true],
    ] as [string, string, boolean][];
    const rowH = Math.max(1, fh) / Math.max(1, rows.length);
    rows.forEach(([label, value, bold], index) => {
      const rowY = y + index * rowH;
      drawCell(rightX, rowY, rightW, rowH, `${label}\n${value}`, {
        fill: bold ? totalFill : undefined,
        size: bold ? 10 : 8,
        style: bold ? 'bold' : 'normal',
        align: 'right',
        valign: 'middle',
        lineHeight: bold ? 5 : 4.4,
      });
    });
  };

  const renderClassic = () => {
    drawWatermark();
    rect(boxX, boxY, boxW, boxH, undefined, 0.45);
    const headerH = 48;
    const titleH = 11;
    drawCell(boxX, boxY, boxW, titleH, title, {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 11,
      style: 'bold',
    });
    const headerY = boxY + titleH;
    drawHeader(headerH, false, headerY);
    const detailsY = headerY + headerH;
    const detailsH = 44;
    const tableH = 84;
    drawClassicDetails(detailsY, detailsH);
    const tableY = detailsY + detailsH;
    drawInvoiceTable(tableY, tableH, 'classic');
    drawClassicFooter(tableY + tableH, boxY + boxH - (tableY + tableH));
  };

  const renderMinimal = () => {
    drawWatermark();
    rect(boxX, boxY, boxW, boxH, undefined, 0.45);
    const headerH = 48;
    const titleH = 11;
    const detailsH = 46;
    const tableH = 96;
    drawCell(boxX, boxY, boxW, titleH, title, {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 11,
      style: 'bold',
    });
    const headerY = boxY + titleH;
    drawHeader(headerH, false, headerY);
    const detailsY = headerY + headerH;
    drawMinimalDetails(detailsY, detailsH);
    const tableY = detailsY + detailsH;
    drawInvoiceTable(tableY, tableH, 'minimal');
    drawMinimalFooter(tableY + tableH, boxY + boxH - (tableY + tableH));
  };

  const renderModern = () => {
    const headerH = 39;
    drawWatermark();
    setFillColor(primary);
    doc.rect(0, 0, pageWidth, headerH, 'F');
    writeText((companySettings.name || 'COMPANY NAME').toUpperCase(), margin, 15, {
      size: 18,
      style: 'bold',
      color: [255, 255, 255],
      maxWidth: 112,
    });
    if (companySettings.address) {
      writeText(companySettings.address, margin, 24, {
        size: 8,
        color: [255, 255, 255],
        maxWidth: 96,
      });
    }
    writeText(title, pageWidth - margin, 14, {
      size: 15,
      style: 'bold',
      color: [255, 255, 255],
      align: 'right',
    });
    if (companySettings.phone) writeText(`Tel: ${companySettings.phone}`, pageWidth - margin, 23, { size: 8, color: [255, 255, 255], align: 'right' });
    if (companySettings.gstin) writeText(`GSTIN: ${companySettings.gstin}`, pageWidth - margin, 29, { size: 8, color: [255, 255, 255], align: 'right' });

    const detailsY = 50;
    drawCell(margin, detailsY, 82, 36, `Billed To\n${customerName}\n${customer?.address || '-'}\n${customer?.phone || '-'}`, {
      size: 8,
      style: 'bold',
      lineHeight: 4.5,
    });
    drawCell(pageWidth - margin - 82, detailsY, 82, 36, `Invoice No: ${invoice.invoiceNo}\nDate: ${invoiceDate}\nStatus: ${invoice.status}`, {
      size: 8.5,
      style: 'bold',
      lineHeight: 6,
      align: 'right',
    });
    const tableY = detailsY + 46;
    drawInvoiceTable(tableY, 102, 'classic');
    drawClassicFooter(tableY + 102, pageHeight - margin - (tableY + 102), true);
  };

  if (companySettings.invoiceTemplate === 'Modern') {
    renderModern();
  } else if (companySettings.invoiceTemplate === 'Minimal') {
    renderMinimal();
  } else {
    renderClassic();
  }

  // ── Page 2: Slip / Delivery Details (only when slips are provided) ──────
  const linkedSlips = slips?.filter(
    (s) => invoice.slipIds?.includes(s.id),
  );
  if (linkedSlips && linkedSlips.length > 0) {
    doc.addPage();
    const p2W = doc.internal.pageSize.getWidth();
    const p2H = doc.internal.pageSize.getHeight();
    const m2 = 14;
    const cw2 = p2W - m2 * 2;

    const textDark2: PdfColor  = [20, 20, 20];
    const textMuted2: PdfColor = [80, 90, 105];
    const lightFill2: PdfColor = [248, 249, 250];
    const headerFill2: PdfColor = [240, 242, 245];

    const p2 = createPainter(doc, textDark2);

    // Header
    p2.setFillColor(primary);
    doc.rect(m2, 10, cw2, 1, 'F');
    p2.setFont(14, 'bold', black);
    doc.text((companySettings.name || 'COMPANY').toUpperCase(), m2, 20);
    p2.setFont(9, 'bold', textMuted2);
    doc.text('DELIVERY / DISPATCH DETAILS', p2W - m2, 20, { align: 'right' });
    p2.setFont(7.5, 'normal', textMuted2);
    const invoiceRef = `Invoice: ${invoice.invoiceNo}  |  Customer: ${customerName}  |  Date: ${invoiceDate}`;
    doc.text(invoiceRef, m2, 27);
    p2.line(m2, 30, m2 + cw2, 30, 0.4);

    // Table column definitions
    const slipCols = [
      { label: '#',          w: 8,                                     align: 'center' as TextAlign },
      { label: 'Date',       w: 22,                                    align: 'left'   as TextAlign },
      { label: 'Vehicle',    w: 28,                                    align: 'left'   as TextAlign },
      { label: 'Driver',     w: 28,                                    align: 'left'   as TextAlign },
      { label: 'Material',   w: 24,                                    align: 'left'   as TextAlign },
      { label: 'Mode',       w: 26,                                    align: 'left'   as TextAlign },
      { label: 'Qty',        w: 18,                                    align: 'right'  as TextAlign },
      { label: 'Amount (₹)', w: cw2 - 8 - 22 - 28 - 28 - 24 - 26 - 18, align: 'right' as TextAlign },
    ];

    const sRowH = 6.5;
    const sHeaderH = 8;

    const drawSlipTableHeader = (startY: number) => {
      p2.setFillColor(headerFill2);
      doc.rect(m2, startY, cw2, sHeaderH, 'F');
      let hx = m2;
      slipCols.forEach((col) => {
        p2.setFont(7.5, 'bold', textMuted2);
        const lx = col.align === 'right' ? hx + col.w - 1.5 : col.align === 'center' ? hx + col.w / 2 : hx + 1.5;
        doc.text(col.label, lx, startY + 5.3, { align: col.align });
        hx += col.w;
      });
      p2.line(m2, startY + sHeaderH, m2 + cw2, startY + sHeaderH, 0.35);
    };

    let sy = 33;
    drawSlipTableHeader(sy);
    sy += sHeaderH;

    let slipTotalQty = 0;
    let slipTotalAmt = 0;

    linkedSlips.forEach((slip, idx) => {
      if (sy + sRowH > p2H - 20) {
        doc.addPage();
        sy = 20;
        p2.setFont(7.5, 'italic', textMuted2);
        doc.text('Delivery Details — continued', m2, sy - 2);
        drawSlipTableHeader(sy);
        sy += sHeaderH;
      }

      const isEven = idx % 2 === 0;
      p2.setFillColor(isEven ? ([255, 255, 255] as PdfColor) : lightFill2);
      doc.rect(m2, sy, cw2, sRowH, 'F');

      const slipDate = new Date(slip.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
      const unitLabel = slip.measurementType.includes('Brass') ? 'Brass' : 'Ton';
      const modeLabel = slip.deliveryMode === 'Company Vehicle' ? 'Company' : 'Third-Party';

      const rowValues = [
        { val: String(idx + 1),                         align: 'center' as TextAlign },
        { val: slipDate,                                 align: 'left'   as TextAlign },
        { val: formatVehicleNo(slip.vehicleNo),          align: 'left'   as TextAlign },
        { val: slip.driverName || '-',                   align: 'left'   as TextAlign },
        { val: slip.materialType,                        align: 'left'   as TextAlign },
        { val: modeLabel,                                align: 'left'   as TextAlign },
        { val: `${formatQuantity(slip.quantity)} ${unitLabel}`, align: 'right' as TextAlign },
        { val: slip.totalAmount.toLocaleString('en-IN'), align: 'right'  as TextAlign },
      ];

      let vx = m2;
      rowValues.forEach(({ val, align }, ci) => {
        const col = slipCols[ci];
        const cx = align === 'right' ? vx + col.w - 1.5 : align === 'center' ? vx + col.w / 2 : vx + 1.5;
        p2.setFont(7, 'normal', textDark2);
        const fitted = doc.splitTextToSize(val, col.w - 3)[0];
        doc.text(fitted, cx, sy + 4.5, { align });
        vx += col.w;
      });

      p2.line(m2, sy + sRowH, m2 + cw2, sy + sRowH, 0.1);
      sy += sRowH;
      slipTotalQty += slip.quantity;
      slipTotalAmt += slip.totalAmount;
    });

    // Totals row
    sy += 1;
    p2.setFillColor(headerFill2);
    doc.rect(m2, sy, cw2, sRowH + 1, 'F');
    p2.setFont(8, 'bold', textDark2);
    doc.text('TOTAL', m2 + 1.5, sy + 5);
    const lastColX = m2 + slipCols.slice(0, 6).reduce((acc, c) => acc + c.w, 0);
    const qtyColW = slipCols[6].w;
    const amtColW = slipCols[7].w;
    doc.text(slipTotalQty.toLocaleString('en-IN'), lastColX + qtyColW - 1.5, sy + 5, { align: 'right' });
    doc.text(`₹ ${slipTotalAmt.toLocaleString('en-IN')}`, lastColX + qtyColW + amtColW - 1.5, sy + 5, { align: 'right' });
    p2.line(m2, sy, m2 + cw2, sy, 0.4);
    p2.line(m2, sy + sRowH + 1, m2 + cw2, sy + sRowH + 1, 0.4);

    // Note
    sy += sRowH + 5;
    p2.setFont(6.5, 'italic', textMuted2);
    doc.text(
      'This page lists the dispatch slips referenced in the invoice above. Quantities and amounts as recorded at dispatch.',
      m2,
      sy,
      { maxWidth: cw2 },
    );
    sy += 5;

    // Outer border box enclosing the entire dispatch section (header → note)
    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.5);
    doc.rect(m2 - 2, 8, cw2 + 4, sy - 6);
    doc.setLineWidth(0.2);

    // Suppress unused vars from destructuring
    void lightFill2;
  }

  return doc.output('blob');
}

// ---------------------------------------------------------------------------
// Slip PDF generation (jsPDF — no html2canvas, no timeout risk)
// ---------------------------------------------------------------------------

/**
 * Generates a loading-slip PDF directly with jsPDF.
 * Avoids html2canvas entirely so it never times out or fails silently.
 */
export async function createSlipPdfBlob(
  slip: Slip,
  customerName: string,
  companySettings: CompanySettings,
  formatOverride?: string
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const selectedFormat = formatOverride || companySettings.slipFormat || 'Thermal-58mm';
  const isWide = selectedFormat === 'A4';
  
  const SLIP_PAPER_SIZES: Record<string, { width: number; autoHeight: boolean }> = {
    'A4':            { width: 210, autoHeight: false },
    'Thermal-58mm':  { width: 58,  autoHeight: true },
    'Thermal-76mm':  { width: 76,  autoHeight: true },
    'Thermal-80mm':  { width: 80,  autoHeight: true },
    'Thermal-100mm': { width: 100, autoHeight: true },
    'Thermal-110mm': { width: 110, autoHeight: true },
  };

  const paperSize = SLIP_PAPER_SIZES[selectedFormat] || SLIP_PAPER_SIZES['Thermal-58mm'];
  const pageWidth = paperSize.width;
  
  // Calculate content height to set page format properly for thermal
  let contentHeight = isWide ? 14 : 6;
  
  const badgeH = isWide ? 5.5 : 4;
  contentHeight += isWide ? 6 : 4; // company name
  if (companySettings.address) contentHeight += isWide ? 5 : 3.5;
  contentHeight += badgeH + (isWide ? 4 : 2.5); // badge
  contentHeight += isWide ? 4 : 2.5; // divider
  
  const rowH = isWide ? 7 : 5.5;
  const numRows = 6 + (slip.driverName ? 1 : 0);
  contentHeight += numRows * rowH;
  
  contentHeight += isWide ? 8 : 5; // spacing before sig
  contentHeight += 3; // sig line to text
  
  if (companySettings.receiptFooter) {
    contentHeight += isWide ? 8 : 10;
  }
  
  contentHeight += isWide ? 14 : 10; // bottom margin

  // For thermal, use calculated height. For A4, use standard A4 height (297)
  const format = isWide ? 'a4' : ([pageWidth, Math.max(contentHeight, 50)] as [number, number]);

  const doc = new jsPDF({ unit: 'mm', format, orientation: 'portrait' });

  const margin = isWide ? 14 : 3;
  const colW = (pageWidth - margin * 2) / 2;
  let y = isWide ? 14 : 6;

  const primary = PRIMARY_COLORS[companySettings.primaryColor || 'emerald'] || '#10b981';

  // Base fonts on width rather than just "A4 vs not"
  const scale = Math.min(1, pageWidth / 58); // scale slightly for larger thermal sizes
  const fs = isWide ? 9 : 7 * scale;
  const titleFs = isWide ? 16 : 9 * scale;
  const subFs = isWide ? 8 : 6 * scale;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleFs);
  doc.setTextColor(primary);
  doc.text((companySettings.name || 'COMPANY NAME').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += isWide ? 6 : 4;

  if (companySettings.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(subFs);
    doc.setTextColor(60, 60, 60);
    doc.text(companySettings.address, pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - margin * 2 });
    y += isWide ? 5 : 3.5;
  }

  // GATE PASS badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(subFs + 0.5);
  doc.setTextColor(255, 255, 255);
  const badgeText = 'GATE PASS';
  const badgeW = isWide ? 24 : 16;
  doc.setFillColor(0, 0, 0);
  doc.rect(pageWidth / 2 - badgeW / 2, y, badgeW, badgeH, 'F');
  doc.text(badgeText, pageWidth / 2, y + badgeH - 1.2, { align: 'center' });
  y += badgeH + (isWide ? 4 : 2.5);

  // Divider
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += isWide ? 4 : 2.5;

  // Table rows
  const rows: [string, string][] = [
    ['Token', `#${slip.id.toUpperCase().slice(0, 6)}`],
    ['Date', new Date(slip.date).toLocaleDateString('en-IN')],
    ['Vehicle', formatVehicleNo(slip.vehicleNo)],
    ...(slip.driverName ? [['Driver', slip.driverName + (slip.driverPhone ? ` (${slip.driverPhone.slice(-4)})` : '')] as [string, string]] : []),
    ['Customer', customerName],
    ['Material', slip.materialType],
    ['Qty', `${formatQuantity(slip.quantity)} ${slip.measurementType === 'Volume (Brass)' ? 'Br' : 'T'}`],
  ];

  doc.setLineWidth(0.2);
  rows.forEach(([label, value]) => {
    doc.setDrawColor(0, 0, 0);
    doc.rect(margin, y, colW, rowH, 'S');
    doc.rect(margin + colW, y, colW, rowH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    doc.setTextColor(30, 30, 30);
    doc.text(label, margin + 1.5, y + rowH - 1.8);

    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + colW + 1.5, y + rowH - 1.8, { maxWidth: colW - 3 });
    y += rowH;
  });

  // Signature line
  y += isWide ? 8 : 5;
  const sigW = (pageWidth - margin * 2) / 2 - 4;
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + sigW, y);
  doc.line(pageWidth - margin - sigW, y, pageWidth - margin, y);
  y += 3;
  doc.setFontSize(subFs);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Auth', margin + sigW / 2, y, { align: 'center' });
  doc.text('Driver', pageWidth - margin - sigW / 2, y, { align: 'center' });

  // Footer
  if (companySettings.receiptFooter) {
    y += isWide ? 8 : 5;
    doc.setFontSize(subFs - 0.5);
    doc.setTextColor(120, 120, 120);
    doc.text(companySettings.receiptFooter, pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - margin * 2 });
  }

  return doc.output('blob');
}

export async function downloadInvoicePdf(
  invoice: Invoice,
  customer: Customer | undefined,
  companySettings: CompanySettings,
  filename: string,
  slips?: Slip[],
): Promise<void> {
  const blob = await createInvoicePdfBlob(invoice, customer, companySettings, slips);
  triggerBlobDownload(blob, filename);
}

export async function sharePdfBlob(
  blob: Blob,
  filename: string,
  title = 'Share Document',
  text?: string,
): Promise<PdfShareResult> {
  const safeFilename = sanitizePdfFilename(filename);

  if (isNative()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      // Guard against memory exhaustion on large PDFs (> 5 MB).
      const MAX_SHARE_SIZE = 5 * 1024 * 1024;
      if (blob.size > MAX_SHARE_SIZE) {
        console.warn('PDF too large for native share; falling back to download.');
        triggerBlobDownload(blob, safeFilename);
        return 'downloaded';
      }

      const base64 = await blobToBase64(blob);

      const result = await Filesystem.writeFile({
        path: safeFilename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title,
        text,
        url: result.uri,
        dialogTitle: title,
      });
      return 'shared';
    } catch (error) {
      if (isShareCancel(error)) return 'cancelled';
      console.error('Native PDF share failed, falling back to download:', error);
      triggerBlobDownload(blob, safeFilename);
      return 'downloaded';
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined') {
    const file = new File([blob], safeFilename, { type: 'application/pdf' });
    const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });

    if (canShareFiles) {
      try {
        await navigator.share({ title, text, files: [file] });
        return 'shared';
      } catch (error) {
        if (isShareCancel(error)) return 'cancelled';
        console.error('Web PDF share failed, falling back to download:', error);
      }
    }
  }

  triggerBlobDownload(blob, safeFilename);
  return 'downloaded';
}

export async function sharePdf(
  source: HTMLElement | string,
  filename: string,
  title = 'Share Document',
  text?: string,
): Promise<PdfShareResult> {
  const htmlContent = typeof source === 'string' ? source : source.innerHTML;
  const blob = await generatePdfBlob(htmlContent, filename);
  return sharePdfBlob(blob, filename, title, text);
}

// ---------------------------------------------------------------------------
// Native filesystem save (P0 — File Export to Device Storage)
// ---------------------------------------------------------------------------

/**
 * Saves a PDF directly to the device's Documents/Downloads folder.
 * On web, falls back to a standard browser download.
 *
 * @param source   - HTMLElement or raw HTML string for the PDF content.
 * @param filename - Target filename, e.g. "Invoice-INV001.pdf".
 * @returns The saved file URI on native, or undefined on web.
 */
export async function saveNativePdf(
  source: HTMLElement | string,
  filename: string,
): Promise<string | undefined> {
  const htmlContent = typeof source === 'string' ? source : source.innerHTML;
  if (!htmlContent) return;

  const blob = await generatePdfBlob(htmlContent, filename);

  if (!isNative()) {
    triggerBlobDownload(blob, filename);
    return;
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const base64 = await blobToBase64(blob);

    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    return result.uri;
  } catch (error) {
    console.error('Native file save failed, falling back to download:', error);
    triggerBlobDownload(blob, filename);
    return;
  }
}

// ---------------------------------------------------------------------------
// Native filesystem save for CSV (P0 — File Export to Device Storage)
// ---------------------------------------------------------------------------

/**
 * Saves a CSV string to the device's Documents folder on native,
 * or triggers a browser download on web.
 *
 * @param csvContent - The raw CSV string (UTF-8 with BOM already included).
 * @param filename   - Target filename without path, e.g. "Ledger_2024.csv".
 * @returns The saved file URI on native, or undefined on web.
 */
export async function saveNativeCsv(
  csvContent: string,
  filename: string,
): Promise<string | undefined> {
  if (!isNative()) {
    // Web fallback: trigger a standard browser download.
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    return;
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    // Re-use blobToBase64 so encoding is consistent and handles large files safely.
    const base64 = await blobToBase64(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));

    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    return result.uri;
  } catch (error) {
    console.error('Native CSV save failed:', error);
    return;
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/** Converts a Blob to a base64 data string (without the data-URI prefix). */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:<mime>;base64," prefix — use indexOf so a comma inside the
      // MIME type (non-standard but theoretically possible) doesn't truncate data.
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) { reject(new Error('FileReader produced invalid data URL')); return; }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


// ---------------------------------------------------------------------------
// Customer Ledger Statement PDF (pure jsPDF — bank-statement layout, A4)
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  date: Date;
  desc: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

/**
 * Builds the bank-statement HTML for a customer ledger.
 * Matches the reference layout: company header, customer info block,
 * summary block, then a full transaction table with running balance.
 */
function buildLedgerStatementHtml(
  customer: Customer,
  entries: LedgerEntry[],
  openingBalance: number,
  closingBalance: number,
  companySettings: CompanySettings,
  dateRange?: { start?: string; end?: string },
): string {
  const primary = PRIMARY_COLORS[companySettings.primaryColor || 'emerald'] || '#10b981';
  const periodLabel = dateRange?.start || dateRange?.end
    ? `(${dateRange.start || 'All'} to ${dateRange.end || 'Date'})`
    : '(All Transactions)';

  const totalDebit  = entries.reduce((s, e) => s + e.debit,  0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const totalTx     = entries.length;

  const fmt = (n: number) => `Rs.${Math.abs(n).toLocaleString('en-IN')}`;
  const balLabel = (n: number) =>
    n === 0 ? 'Rs.0'
    : n < 0  ? `Rs.${Math.abs(n).toLocaleString('en-IN')} (Credit)`
    : `Rs.${n.toLocaleString('en-IN')} (Debit)`;

  const compContacts = [
    companySettings.phone  ? `Ph: ${companySettings.phone}` : '',
    companySettings.gstin  ? `GSTIN: ${companySettings.gstin}` : '',
    companySettings.address || '',
  ].filter(Boolean).join('  |  ');

  const rows = entries.map((e, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">
        ${e.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${e.desc}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${e.debit > 0 ? '#dc2626' : '#9ca3af'};">
        ${e.debit > 0 ? fmt(e.debit) : '-'}
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${e.credit > 0 ? '#059669' : '#9ca3af'};">
        ${e.credit > 0 ? fmt(e.credit) : '-'}
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${e.runningBalance > 0 ? '#dc2626' : e.runningBalance < 0 ? '#059669' : '#374151'};">
        ${e.runningBalance === 0 ? 'Rs.0'
          : e.runningBalance < 0
            ? `(Rs.${Math.abs(e.runningBalance).toLocaleString('en-IN')})`
            : `(Rs.${e.runningBalance.toLocaleString('en-IN')})`}
      </td>
    </tr>`).join('');

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;width:760px;margin:0 auto;padding:20px 24px;">

      <!-- Company Header -->
      <div style="text-align:center;border-bottom:3px solid ${primary};padding-bottom:10px;margin-bottom:6px;">
        <div style="font-size:22px;font-weight:900;letter-spacing:0.04em;text-transform:uppercase;">${companySettings.name || 'COMPANY'}</div>
        ${compContacts ? `<div style="font-size:11px;color:#6b7280;margin-top:3px;">${compContacts}</div>` : ''}
      </div>

      <!-- Report Title + Period -->
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Customer Ledger Report</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">${periodLabel}</div>
      </div>

      <!-- Customer Info + Summary side by side -->
      <div style="display:flex;gap:16px;margin-bottom:16px;">

        <!-- Left: Customer Info -->
        <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Customer Details</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr>
              <td style="padding:2px 0;font-weight:700;width:120px;">Customer Name:</td>
              <td style="padding:2px 0;">${customer.name}</td>
            </tr>
            ${customer.phone ? `<tr><td style="padding:2px 0;font-weight:700;">Phone:</td><td>${customer.phone}</td></tr>` : ''}
            ${customer.address ? `<tr><td style="padding:2px 0;font-weight:700;">Address:</td><td>${customer.address}</td></tr>` : ''}
            ${customer.gstin ? `<tr><td style="padding:2px 0;font-weight:700;">GSTIN:</td><td>${customer.gstin}</td></tr>` : ''}
          </table>
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:4px;">Final Balance:</div>
            <div style="font-size:16px;font-weight:900;color:${closingBalance > 0 ? '#dc2626' : closingBalance < 0 ? '#059669' : '#374151'};">
              ${balLabel(closingBalance)}
            </div>
            ${dateRange?.end || dateRange?.start ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">(${dateRange.end || dateRange.start})</div>` : ''}
          </div>
        </div>

        <!-- Right: Summary -->
        <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Summary</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr>
              <td style="padding:3px 0;font-weight:700;width:160px;">Starting Balance:</td>
              <td style="padding:3px 0;color:${openingBalance > 0 ? '#dc2626' : openingBalance < 0 ? '#059669' : '#374151'};font-weight:600;">
                ${balLabel(openingBalance)}
              </td>
            </tr>
            ${dateRange?.start ? `<tr><td></td><td style="font-size:10px;color:#9ca3af;">(${dateRange.start})</td></tr>` : ''}
            <tr>
              <td style="padding:3px 0;font-weight:700;color:#dc2626;">Total Debit (-):</td>
              <td style="padding:3px 0;font-weight:700;color:#dc2626;">${fmt(totalDebit)}</td>
            </tr>
            <tr>
              <td style="padding:3px 0;font-weight:700;color:#059669;">Total Credit (+):</td>
              <td style="padding:3px 0;font-weight:700;color:#059669;">${fmt(totalCredit)}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="padding:3px 0;font-weight:700;">Closing Balance:</td>
              <td style="padding:3px 0;font-weight:900;color:${closingBalance > 0 ? '#dc2626' : closingBalance < 0 ? '#059669' : '#374151'};">
                ${balLabel(closingBalance)}
              </td>
            </tr>
            ${dateRange?.end ? `<tr><td></td><td style="font-size:10px;color:#9ca3af;">(${dateRange.end})</td></tr>` : ''}
            <tr>
              <td style="padding:3px 0;font-weight:700;">Total Transactions:</td>
              <td style="padding:3px 0;font-weight:700;">${totalTx}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Transaction Table -->
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:7px 8px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:2px solid #d1d5db;width:36px;">SR.</th>
            <th style="padding:7px 8px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:2px solid #d1d5db;width:110px;">Date</th>
            <th style="padding:7px 8px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:2px solid #d1d5db;">Description</th>
            <th style="padding:7px 8px;text-align:right;font-size:10px;color:#dc2626;font-weight:700;text-transform:uppercase;border-bottom:2px solid #d1d5db;width:110px;">Debit (-)</th>
            <th style="padding:7px 8px;text-align:right;font-size:10px;color:#059669;font-weight:700;text-transform:uppercase;border-bottom:2px solid #d1d5db;width:110px;">Credit (+)</th>
            <th style="padding:7px 8px;text-align:right;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;border-bottom:2px solid #d1d5db;width:130px;">Balance</th>
          </tr>
        </thead>
        <tbody>
          <!-- Opening balance row -->
          <tr style="background:#f9fafb;">
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:#9ca3af;">-</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#9ca3af;">-</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;">Sabqa Raqam (Opening Balance)</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${openingBalance > 0 ? '#dc2626' : '#9ca3af'};">
              ${openingBalance > 0 ? fmt(openingBalance) : '-'}
            </td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${openingBalance < 0 ? '#059669' : '#9ca3af'};">
              ${openingBalance < 0 ? fmt(openingBalance) : '-'}
            </td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${openingBalance > 0 ? '#dc2626' : openingBalance < 0 ? '#059669' : '#374151'};">
              ${openingBalance === 0 ? 'Rs.0'
                : openingBalance < 0 ? `(Rs.${Math.abs(openingBalance).toLocaleString('en-IN')})`
                : `(Rs.${openingBalance.toLocaleString('en-IN')})`}
            </td>
          </tr>
          ${rows}
        </tbody>
      </table>

      <!-- Footer -->
      <div style="margin-top:10px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:8px;">
        Printed at: ${new Date().toLocaleString('en-IN')}
      </div>
    </div>`;
}

/**
 * Generates a bank-statement-style Customer Ledger PDF using pure jsPDF.
 * No html2canvas — avoids blank-page rendering bugs on z-index / off-screen elements.
 */
export async function createLedgerStatementPdfBlob(
  customer: Customer,
  entries: LedgerEntry[],
  openingBalance: number,
  closingBalance: number,
  companySettings: CompanySettings,
  dateRange?: { start?: string; end?: string },
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth();   // 210
  const ph = doc.internal.pageSize.getHeight();  // 297
  const ml = 14; // left margin
  const mr = 14; // right margin
  const cw = pw - ml - mr; // content width = 182

  const primary = PRIMARY_COLORS[companySettings.primaryColor || 'emerald'] || '#10b981';
  // convert hex to rgb for jsPDF
  const hexToRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '');
    return [parseInt(clean.slice(0,2),16), parseInt(clean.slice(2,4),16), parseInt(clean.slice(4,6),16)];
  };
  const [pr, pg, pb] = hexToRgb(primary);

  const fmt = (n: number) => `Rs.${Math.abs(n).toLocaleString('en-IN')}`;
  const balLabel = (n: number) =>
    n === 0 ? 'Rs.0'
    : n < 0  ? `Rs.${Math.abs(n).toLocaleString('en-IN')} (Cr)`
    : `Rs.${n.toLocaleString('en-IN')} (Dr)`;

  const periodLabel = dateRange?.start || dateRange?.end
    ? `${dateRange.start || 'All'} to ${dateRange.end || 'Date'}`
    : 'All Transactions';

  let y = 14;

  // ── Company header ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(companySettings.name || 'COMPANY', pw / 2, y, { align: 'center' });
  y += 5;

  const contacts = [
    companySettings.phone  ? `Ph: ${companySettings.phone}` : '',
    companySettings.gstin  ? `GSTIN: ${companySettings.gstin}` : '',
    companySettings.address || '',
  ].filter(Boolean).join('  |  ');
  if (contacts) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(contacts, pw / 2, y, { align: 'center' });
    y += 4;
  }

  // primary underline
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(0.7);
  doc.line(ml, y, ml + cw, y);
  y += 5;

  // ── Report title ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text('Customer Ledger Report', pw / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`(${periodLabel})`, pw / 2, y, { align: 'center' });
  y += 7;

  // ── Info boxes (left: customer, right: summary) ───────────────────────────
  const boxH = 38;
  const halfW = (cw - 4) / 2;

  // left box border
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.rect(ml, y, halfW, boxH);
  // right box border
  doc.rect(ml + halfW + 4, y, halfW, boxH);

  // LEFT: Customer Details
  let ly = y + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('CUSTOMER DETAILS', ml + 3, ly);
  ly += 5;

  const customerRows: [string, string][] = [
    ['Customer Name:', customer.name],
    ...(customer.phone   ? [['Phone:', customer.phone] as [string,string]]   : []),
    ...(customer.address ? [['Address:', customer.address] as [string,string]] : []),
    ...(customer.gstin   ? [['GSTIN:', customer.gstin] as [string,string]]   : []),
  ];
  for (const [label, val] of customerRows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(label, ml + 3, ly);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(val, halfW - 35), ml + 35, ly);
    ly += 4.5;
  }

  // Final balance in left box
  ly = y + boxH - 12;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(ml + 2, ly, ml + halfW - 2, ly);
  ly += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Final Balance:', ml + 3, ly);
  const balColor: [number,number,number] = closingBalance > 0 ? [220,38,38] : closingBalance < 0 ? [5,150,105] : [50,50,50];
  doc.setTextColor(...balColor);
  doc.setFontSize(9);
  doc.text(balLabel(closingBalance), ml + 35, ly);

  // RIGHT: Summary
  const rx = ml + halfW + 4;
  ly = y + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('SUMMARY', rx + 3, ly);
  ly += 5;

  const totalDebit  = entries.reduce((s, e) => s + e.debit,  0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  const summaryRows: [string, string, [number,number,number]][] = [
    ['Starting Balance:', balLabel(openingBalance), openingBalance > 0 ? [220,38,38] : openingBalance < 0 ? [5,150,105] : [50,50,50]],
    [`(${dateRange?.start || '-'})`, '', [130,130,130]],
    ['Total Debit (-):', fmt(totalDebit), [220,38,38]],
    ['Total Credit (+):', fmt(totalCredit), [5,150,105]],
    ['Closing Balance:', balLabel(closingBalance), closingBalance > 0 ? [220,38,38] : closingBalance < 0 ? [5,150,105] : [50,50,50]],
    [`(${dateRange?.end || '-'})`, '', [130,130,130]],
    ['Total Transactions:', String(entries.length), [50,50,50]],
  ];
  for (const [label, val, color] of summaryRows) {
    if (!label && !val) { ly += 1; continue; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(label, rx + 3, ly);
    doc.setFont('helvetica', val === balLabel(closingBalance) ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(val, rx + halfW - 3, ly, { align: 'right' });
    ly += 4.5;
  }

  y += boxH + 6;

  // ── Transaction table ────────────────────────────────────────────────────────
  // column layout: SR | Date | Description | Debit | Credit | Balance
  const cols = {
    sr:   { x: ml,           w: 10 },
    date: { x: ml + 10,      w: 24 },
    desc: { x: ml + 34,      w: 72 },
    deb:  { x: ml + 106,     w: 24 },
    crd:  { x: ml + 130,     w: 24 },
    bal:  { x: ml + 154,     w: cw - 154 },
  };
  const rowH = 6.5;

  // header row
  doc.setFillColor(243, 244, 246);
  doc.rect(ml, y, cw, rowH, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(ml, y + rowH, ml + cw, y + rowH);

  const hStyle = { size: 7.5, bold: true };
  const drawHeader = (text: string, cx: number, cwidth: number, align: 'left'|'right'|'center' = 'left') => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(hStyle.size);
    doc.setTextColor(80, 80, 80);
    const tx = align === 'right' ? cx + cwidth - 2 : align === 'center' ? cx + cwidth / 2 : cx + 2;
    doc.text(text, tx, y + 4.2, { align });
  };
  drawHeader('SR.',   cols.sr.x,   cols.sr.w,   'center');
  drawHeader('DATE',  cols.date.x, cols.date.w);
  drawHeader('DESCRIPTION', cols.desc.x, cols.desc.w);
  drawHeader('DEBIT (-)', cols.deb.x, cols.deb.w, 'right');
  drawHeader('CREDIT (+)', cols.crd.x, cols.crd.w, 'right');
  drawHeader('BALANCE', cols.bal.x, cols.bal.w, 'right');
  y += rowH;

  // opening balance row
  const drawRow = (
    sr: string, date: string, desc: string,
    debit: string, credit: string, balance: string,
    bg: string, balColor: [number,number,number],
    debitColor: [number,number,number], creditColor: [number,number,number],
  ) => {
    if (y + rowH > ph - 16) {
      doc.addPage();
      y = 14;
    }
    if (bg !== '#fff') {
      doc.setFillColor(249, 250, 251);
      doc.rect(ml, y, cw, rowH, 'F');
    }
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(ml, y + rowH, ml + cw, y + rowH);

    const cell = (text: string, cx: number, cwidth: number, align: 'left'|'right'|'center', color: [number,number,number], bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...color);
      const tx = align === 'right' ? cx + cwidth - 2 : align === 'center' ? cx + cwidth / 2 : cx + 2;
      doc.text(text, tx, y + 4.2, { align });
    };

    cell(sr,      cols.sr.x,   cols.sr.w,   'center', [130,130,130]);
    cell(date,    cols.date.x, cols.date.w, 'left',   [80,80,80]);
    cell(desc,    cols.desc.x, cols.desc.w, 'left',   [30,30,30]);
    cell(debit,   cols.deb.x,  cols.deb.w,  'right',  debitColor);
    cell(credit,  cols.crd.x,  cols.crd.w,  'right',  creditColor);
    cell(balance, cols.bal.x,  cols.bal.w,  'right',  balColor, true);
    y += rowH;
  };

  const openingBalColor: [number,number,number] = openingBalance > 0 ? [220,38,38] : openingBalance < 0 ? [5,150,105] : [100,100,100];
  drawRow(
    '-', '-', 'Opening Balance',
    openingBalance > 0 ? fmt(openingBalance) : '-',
    openingBalance < 0 ? fmt(Math.abs(openingBalance)) : '-',
    openingBalance === 0 ? 'Rs.0' : `(Rs.${Math.abs(openingBalance).toLocaleString('en-IN')})`,
    '#f9fafb',
    openingBalColor,
    openingBalance > 0 ? [220,38,38] : [156,163,175],
    openingBalance < 0 ? [5,150,105] : [156,163,175],
  );

  entries.forEach((e, i) => {
    const rb = e.runningBalance;
    const rbColor: [number,number,number] = rb > 0 ? [220,38,38] : rb < 0 ? [5,150,105] : [100,100,100];
    drawRow(
      String(i + 1),
      e.date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
      e.desc,
      e.debit > 0  ? fmt(e.debit)  : '-',
      e.credit > 0 ? fmt(e.credit) : '-',
      rb === 0 ? 'Rs.0' : `(Rs.${Math.abs(rb).toLocaleString('en-IN')})`,
      i % 2 === 0 ? '#fff' : '#f9fafb',
      rbColor,
      e.debit  > 0 ? [220,38,38] : [156,163,175],
      e.credit > 0 ? [5,150,105] : [156,163,175],
    );
  });

  // ── Footer ───────────────────────────────────────────────────────────────────
  y += 3;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(ml, y, ml + cw, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 130);
  doc.text(`Printed at: ${new Date().toLocaleString('en-IN')}`, ml, y);

  return doc.output('blob');
}

export async function createQuotationPdfBlob(
  quotation: import("../types").Quotation,
  customer: Customer | undefined,
  companySettings: CompanySettings,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const boxX = margin;
  const boxY = 14;
  const boxW = pageWidth - margin * 2;
  const boxH = pageHeight - boxY - 18;
  const isGst = quotation.type === 'GST';
  const title = isGst ? 'PROFORMA INVOICE' : 'QUOTATION';
  const customerName = customer?.name || (quotation.customerId === 'CASH' ? 'Cash Customer' : quotation.customerId) || 'Unknown Customer';
  const invoiceDate = new Date(quotation.date).toLocaleDateString('en-GB');
  const totalQty = quotation.items.reduce((sum, item) => sum + safeNumber(item.quantity), 0);
  const totalTax = safeNumber(quotation.cgst) + safeNumber(quotation.sgst);
  const amountInWords = toWords.convert(safeNumber(quotation.total)).toUpperCase();
  const primary =
    PRIMARY_COLORS[companySettings.primaryColor || 'emerald'] ||
    companySettings.invoiceColor ||
    '#10b981';

  const black: PdfColor = [0, 0, 0];
  const textDark: PdfColor = [20, 20, 20];
  const textMuted: PdfColor = [65, 72, 86];
  const lightFill: PdfColor = [248, 249, 250];
  const totalFill: PdfColor = [243, 244, 246];

  const { setFillColor, setTextColor, setFont, rect, line, writeText, drawCell, drawLabelValue } =
    createPainter(doc, textDark);

  const drawWatermark = () => {
    if (!companySettings.invoiceWatermark || companySettings.invoiceWatermark === 'None') return;
    const watermarkText =
      companySettings.invoiceWatermark === 'Company Name'
        ? companySettings.name
        : companySettings.invoiceWatermark === 'Status'
          ? quotation.status || 'PENDING'
          : companySettings.invoiceWatermarkText;
    if (!watermarkText) return;
    doc.saveGraphicsState();
    setTextColor([235, 235, 235]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(42);
    doc.text(watermarkText.toUpperCase(), pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: -35,
    });
    doc.restoreGraphicsState();
  };

  const terms = companySettings.termsAndConditions
    ? companySettings.termsAndConditions.split('\n').map(term => term.trim()).filter(Boolean)
    : DEFAULT_INVOICE_TERMS;

  const drawHeader = (headerH: number, splitRight = false, headerY = boxY) => {
    if (splitRight) {
      const rightW = 54;
      line(boxX + boxW - rightW, headerY, boxX + boxW - rightW, headerY + headerH, 0.45);
      drawCell(boxX + boxW - rightW, headerY, rightW, 13, title, {
        align: 'center',
        valign: 'middle',
        fill: totalFill,
        size: 10,
        style: 'bold',
      });
      const detailY = headerY + 13;
      const labelW = 22;
      const rowH = companySettings.invoiceShowDueDate ? 8.4 : 10.5;
      const rows = [
        ['Quote No.', quotation.quotationNo],
        ['Date', invoiceDate],
        ...(companySettings.invoiceShowDueDate
          ? [['Valid Till', new Date(new Date(quotation.date).getTime() + DEFAULT_PAYMENT_TERM_MS).toLocaleDateString('en-GB')]]
          : []),
      ];
      rows.forEach(([labelText, valueText], index) => {
        const rowY = detailY + index * rowH;
        drawCell(boxX + boxW - rightW, rowY, labelW, rowH, labelText, {
          size: 7.5,
          style: 'bold',
          color: textMuted,
        });
        drawCell(boxX + boxW - rightW + labelW, rowY, rightW - labelW, rowH, valueText, {
          size: 7.5,
          style: 'bold',
        });
      });
    }

    const nameMaxWidth = splitRight ? 116 : 126;
    writeText((companySettings.name || 'COMPANY NAME').toUpperCase(), boxX + 6, headerY + 18, {
      size: 22,
      style: 'bold',
      color: splitRight ? black : primary,
      maxWidth: nameMaxWidth,
    });
    if (companySettings.address) {
      writeText(companySettings.address, boxX + 6, headerY + 32, {
        size: 8.3,
        color: textDark,
        maxWidth: 78,
      });
    }
    if (!splitRight) {
      const rightX = boxX + boxW - 6;
      if (companySettings.phone) {
        writeText(`Tel : ${companySettings.phone}`, rightX, headerY + 32, {
          size: 8.5,
          style: 'bold',
          align: 'right',
        });
      }
      if (companySettings.gstin) {
        writeText(`GSTIN : ${companySettings.gstin}`, rightX, headerY + 39, {
          size: 8.5,
          style: 'bold',
          align: 'right',
        });
      }
    } else {
      const inlineDetails = [
        companySettings.phone ? `Phone: ${companySettings.phone}` : '',
        companySettings.gstin && isGst ? `GSTIN: ${companySettings.gstin}` : '',
      ].filter(Boolean).join('    ');
      if (inlineDetails) {
        writeText(inlineDetails, boxX + 6, headerY + 43, { size: 7.8, color: textMuted, maxWidth: 116 });
      }
    }
    line(boxX, headerY + headerH, boxX + boxW, headerY + headerH, 0.45);
  };

  const drawClassicDetails = (y: number, h: number) => {
    line(boxX + boxW / 2, y, boxX + boxW / 2, y + h);
    drawCell(boxX, y, boxW / 2, 9, 'Customer Detail', {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 8.5,
      style: 'bold',
    });
    const leftX = boxX + 4;
    const rightX = boxX + boxW / 2 + 6;
    const contentY = y + 14;
    drawLabelValue('M/S', customerName || '-', leftX, contentY, 24, 56, true);
    drawLabelValue('Address', customer?.address || '-', leftX, contentY + 7, 24, 56);
    drawLabelValue('Phone', customer?.phone || '-', leftX, contentY + 14, 24, 56);
    if (isGst) drawLabelValue('GSTIN', customer?.gstin || '-', leftX, contentY + 21, 24, 56);
    drawLabelValue('Quote No.', quotation.quotationNo, rightX, contentY + 1, 32, 46, true);
    drawLabelValue('Quote Date', invoiceDate, rightX, contentY + 14, 32, 46);
  };

  const drawMinimalDetails = (y: number, h: number) => {
    line(boxX + boxW / 2, y, boxX + boxW / 2, y + h);
    drawCell(boxX, y, boxW / 2, 8, 'Billed To', {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 8,
      style: 'bold',
    });
    drawCell(boxX + boxW / 2, y, boxW / 2, 8, 'Quotation Details', {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 8,
      style: 'bold',
    });
    const leftX = boxX + 4;
    const rightX = boxX + boxW / 2 + 4;
    const contentY = y + 13;
    drawLabelValue('Name', customerName || '-', leftX, contentY, 22, 58, true);
    drawLabelValue('Address', customer?.address || '-', leftX, contentY + 7, 22, 58);
    drawLabelValue('Phone', customer?.phone || '-', leftX, contentY + 14, 22, 58);
    if (isGst) drawLabelValue('GSTIN', customer?.gstin || '-', leftX, contentY + 21, 22, 58);
    const rightRows: [string, string, boolean][] = [
      ['Quote No.', quotation.quotationNo, true],
      ['Quote Date', invoiceDate, false],
      ['Status', quotation.status, false],
      ['Type', quotation.type, false],
      ['Bank', companySettings.bankName || '-', false],
    ];
    if (companySettings.invoiceShowDueDate) {
      const validTill = new Date(new Date(quotation.date).getTime() + DEFAULT_PAYMENT_TERM_MS).toLocaleDateString('en-GB');
      rightRows.splice(2, 0, ['Valid Till', validTill, false]);
    }
    rightRows.slice(0, 5).forEach(([label, value, bold], index) => {
      drawLabelValue(label, value, rightX, contentY + index * 6.5, 30, 54, bold);
    });
  };

  const drawInvoiceTable = (y: number, h: number, mode: 'classic' | 'minimal') => {
    const headerH = mode === 'classic' ? 17 : 15;
    const totalH = 12;
    const bodyH = h - headerH - totalH;
    const rowCount = Math.max(8, quotation.items.length);
    const rowH = bodyH / rowCount;
    const columns = mode === 'minimal'
      ? [
          { label: 'Sr.', w: 12, align: 'center' as TextAlign },
          { label: 'Description', w: 70, align: 'left' as TextAlign },
          { label: 'HSN / SAC', w: 25, align: 'center' as TextAlign },
          { label: 'Qty', w: 18, align: 'center' as TextAlign },
          { label: 'Rate', w: 25, align: 'right' as TextAlign },
          { label: 'Amount', w: 32, align: 'right' as TextAlign },
        ]
      : isGst
        ? [
            { label: 'Sr.\nNo.', w: 10, align: 'center' as TextAlign },
            { label: 'Name of Product / Service', w: 48, align: 'left' as TextAlign },
            { label: 'HSN / SAC', w: 18, align: 'center' as TextAlign },
            { label: 'Qty', w: 13, align: 'center' as TextAlign },
            { label: 'Rate', w: 17, align: 'right' as TextAlign },
            { label: 'Taxable\nValue', w: 23, align: 'right' as TextAlign },
            { label: 'CGST', w: 16, align: 'right' as TextAlign },
            { label: 'SGST', w: 16, align: 'right' as TextAlign },
            { label: 'Total', w: 21, align: 'right' as TextAlign },
          ]
        : [
            { label: 'Sr.\nNo.', w: 12, align: 'center' as TextAlign },
            { label: 'Name of Product / Service', w: 62, align: 'left' as TextAlign },
            { label: 'HSN / SAC', w: 22, align: 'center' as TextAlign },
            { label: 'Qty', w: 16, align: 'center' as TextAlign },
            { label: 'Rate', w: 23, align: 'right' as TextAlign },
            { label: 'Taxable\nValue', w: 28, align: 'right' as TextAlign },
            { label: 'Total', w: 19, align: 'right' as TextAlign },
          ];

    rect(boxX, y, boxW, h);
    rect(boxX, y, boxW, headerH, lightFill);
    rect(boxX, y + h - totalH, boxW, totalH, totalFill);

    let x = boxX;
    columns.forEach((column, index) => {
      if (index > 0) line(x, y, x, y + h);
      drawCell(x, y, column.w, headerH, column.label, {
        align: column.align,
        valign: 'middle',
        size: 8,
        style: 'bold',
        fill: lightFill,
        pad: 1.5,
      });
      x += column.w;
    });
    line(boxX, y + headerH, boxX + boxW, y + headerH, 0.45);
    line(boxX, y + h - totalH, boxX + boxW, y + h - totalH, 0.45);

    quotation.items.forEach((item, index) => {
      const itemY = y + headerH + index * rowH;
      const taxable = safeNumber(item.amount);
      const gstRate = safeNumber(item.gstRate || 5);
      const itemCgst = isGst ? (taxable * (gstRate / 2)) / 100 : 0;
      const itemSgst = isGst ? (taxable * (gstRate / 2)) / 100 : 0;
      const itemTotal = mode === 'minimal' ? taxable : taxable + itemCgst + itemSgst;
      const values = mode === 'minimal'
        ? [
            String(index + 1),
            item.materialType || '-',
            item.hsnCode || '-',
            safeNumber(item.quantity).toLocaleString('en-IN'),
            safeNumber(item.rate).toFixed(2),
            itemTotal.toFixed(2),
          ]
        : isGst
          ? [
              String(index + 1),
              item.materialType || '-',
              item.hsnCode || '-',
              safeNumber(item.quantity).toLocaleString('en-IN'),
              safeNumber(item.rate).toFixed(2),
              taxable.toFixed(2),
              itemCgst.toFixed(2),
              itemSgst.toFixed(2),
              itemTotal.toFixed(2),
            ]
          : [
              String(index + 1),
              item.materialType || '-',
              item.hsnCode || '-',
              safeNumber(item.quantity).toLocaleString('en-IN'),
              safeNumber(item.rate).toFixed(2),
              taxable.toFixed(2),
              itemTotal.toFixed(2),
            ];
      let cellX = boxX;
      values.forEach((value, valueIndex) => {
        const column = columns[valueIndex];
        if (!column) return;
        writeText(value, column.align === 'right' ? cellX + column.w - 2 : column.align === 'center' ? cellX + column.w / 2 : cellX + 2, itemY + 5.5, {
          size: 8,
          style: valueIndex === 1 || valueIndex === values.length - 1 ? 'bold' : 'normal',
          align: column.align,
          maxWidth: column.w - 4,
        });
        cellX += column.w;
      });
    });

    let footerX = boxX;
    columns.forEach((column, index) => {
      if (index > 0) line(footerX, y + h - totalH, footerX, y + h);
      footerX += column.w;
    });

    const totalY = y + h - totalH + 7.5;
    if (mode === 'minimal') {
      writeText('Total', boxX + columns[0].w + columns[1].w + columns[2].w - 2, totalY, {
        size: 8,
        style: 'bold',
        align: 'right',
      });
      writeText(totalQty.toFixed(2), boxX + columns[0].w + columns[1].w + columns[2].w + columns[3].w / 2, totalY, {
        size: 8,
        style: 'bold',
        align: 'center',
      });
      writeText(safeNumber(quotation.subTotal).toFixed(2), boxX + boxW - 2, totalY, {
        size: 8.5,
        style: 'bold',
        align: 'right',
      });
      return;
    }

    // Named references replace magic indices — the GST and non-GST column sets
    // have different lengths so index-based access is fragile if columns change.
    const columnRight = (index: number) =>
      boxX + columns.slice(0, index + 1).reduce((sum, column) => sum + column.w, 0);

    const qtyIndex = 3;
    const subtotalIndex = columns.length - (isGst ? 4 : 2);
    const cgstIndex = isGst ? columns.length - 3 : -1;
    const sgstIndex = isGst ? columns.length - 2 : -1;
    const totalIndex = columns.length - 1;

    const labelEnd = columnRight(2) - 2;
    const qtyCenter = columnRight(2) + columns[qtyIndex].w / 2;
    writeText('TOTAL', labelEnd, totalY, { size: 8, style: 'bold', align: 'right' });
    writeText(totalQty.toFixed(2), qtyCenter, totalY, { size: 8, style: 'bold', align: 'center' });
    writeText(safeNumber(quotation.subTotal).toFixed(2), columnRight(subtotalIndex) - 2, totalY, {
      size: 8,
      style: 'bold',
      align: 'right',
    });
    if (isGst) {
      writeText(safeNumber(quotation.cgst).toFixed(2), columnRight(cgstIndex) - 2, totalY, {
        size: 8,
        style: 'bold',
        align: 'right',
      });
      writeText(safeNumber(quotation.sgst).toFixed(2), columnRight(sgstIndex) - 2, totalY, {
        size: 8,
        style: 'bold',
        align: 'right',
      });
    }
    writeText(safeNumber(quotation.total).toFixed(2), columnRight(totalIndex) - 2, totalY, {
      size: 8.8,
      style: 'bold',
      align: 'right',
    });
  };

  const drawClassicFooter = (y: number, h: number, compact = false) => {
    const rightW = compact ? 62 : 61;
    const leftW = boxW - rightW;
    rect(boxX, y, boxW, h);
    line(boxX + leftW, y, boxX + leftW, y + h, 0.45);

    // --- Left column: words → bank → terms ---
    // Fixed heights that always sum to exactly h (no overflow, no gap).
    // bank section = header(8) + 4 rows at 6mm each (24) + 3mm buffer = 35
    // words section = 16mm
    // terms gets all remaining space
    const wordsH = 16;
    const bankSectionH = 35;
    const termsH = h - wordsH - bankSectionH;

    drawCell(boxX, y, leftW, wordsH, `Total in words\n${amountInWords}`, {
      size: 7.5,
      style: 'bold',
      pad: 2.5,
      lineHeight: 4.0,
    });

    const bankY = y + wordsH;
    drawCell(boxX, bankY, leftW, 8, 'Bank Details', {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 8,
      style: 'bold',
    });
    const bankRowH = 6;
    const bankTextY = bankY + 11;
    drawLabelValue('Bank Name',   companySettings.bankName      || '-', boxX + 4, bankTextY,              34, 74);
    drawLabelValue('Branch',      companySettings.branchName    || '-', boxX + 4, bankTextY + bankRowH,   34, 74);
    drawLabelValue('Acc. Number', companySettings.accountNumber || '-', boxX + 4, bankTextY + bankRowH*2, 34, 74);
    drawLabelValue('IFSC',        companySettings.ifscCode      || '-', boxX + 4, bankTextY + bankRowH*3, 34, 74);

    const termsY = bankY + bankSectionH;
    if (termsH >= 8) {
      drawCell(boxX, termsY, leftW, 7, 'Terms and Conditions', {
        align: 'center',
        valign: 'middle',
        fill: lightFill,
        size: 7.8,
        style: 'bold',
      });
      // Fit as many term lines as the remaining space allows
      const termLineH = 4.5;
      const maxTerms = Math.floor((termsH - 7 - 4) / termLineH);
      terms.slice(0, Math.max(1, maxTerms)).forEach((term, index) => {
        writeText(`- ${term}`, boxX + 4, termsY + 11 + index * termLineH, {
          size: 6.8,
          color: textMuted,
          maxWidth: leftW - 8,
        });
      });
    }

    // --- Right column: tax summary rows ---
    // Calculate how tall the summary rows will be so the remaining space
    // can be given to the signature block that sits below them.
    const rightX = boxX + leftW;
    const taxRowH = 9;       // fixed height for each summary row
    const totalRowH = 12;    // slightly taller for the grand total row
    const sigH = 32;         // fixed height reserved for the signature block

    // Rows: Taxable Amount + (CGST + SGST if GST) + Total Tax + Total Amount
    const taxRowCount = isGst ? 4 : 2;  // non-GST: Taxable + Total Tax
    const summaryH = taxRowCount * taxRowH + totalRowH;

    // If summary + signature overflows h, shrink taxRowH proportionally
    const available = h - sigH;
    const effectiveTaxRowH = summaryH <= available ? taxRowH : Math.max(7, (available - totalRowH) / taxRowCount);
    const effectiveTotalRowH = summaryH <= available ? totalRowH : Math.max(10, available - effectiveTaxRowH * taxRowCount);

    const drawSummaryRow = (
      rowY: number,
      rowH: number,
      label: string,
      value: string,
      fill?: PdfColor,
      valueSize = 7.8,
    ) => {
      rect(rightX, rowY, rightW, rowH, fill);
      const baselineY = rowY + rowH / 2 + 1.4;
      writeText(label, rightX + 3, baselineY, {
        size: 7.4,
        style: 'bold',
        color: textMuted,
        maxWidth: rightW - 24,
      });
      writeText(value, rightX + rightW - 3, baselineY, {
        size: valueSize,
        style: 'bold',
        align: 'right',
        maxWidth: 22,
      });
    };

    const drawGrandTotalRow = (rowY: number, rowH: number) => {
      rect(rightX, rowY, rightW, rowH, totalFill);
      const labelLines = doc.splitTextToSize('Total Amount After Tax', 32);
      const lineHeight = 4.1;
      const labelY = rowY + rowH / 2 - ((labelLines.length - 1) * lineHeight) / 2 + 1.5;
      setFont(8, 'bold', textDark);
      doc.text(labelLines, rightX + 3, labelY, { align: 'left', lineHeightFactor: 1.2 });
      writeText(`Rs. ${safeNumber(quotation.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, rightX + rightW - 3, rowY + rowH / 2 + 1.6, {
        size: 8.9,
        style: 'bold',
        align: 'right',
        maxWidth: 25,
      });
    };

    drawSummaryRow(y, effectiveTaxRowH, 'Taxable Amount', safeNumber(quotation.subTotal).toFixed(2), lightFill);
    let rightY = y + effectiveTaxRowH;
    if (isGst) {
      drawSummaryRow(rightY, effectiveTaxRowH, 'Add : CGST', safeNumber(quotation.cgst).toFixed(2));
      rightY += effectiveTaxRowH;
      drawSummaryRow(rightY, effectiveTaxRowH, 'Add : SGST', safeNumber(quotation.sgst).toFixed(2));
      rightY += effectiveTaxRowH;
    }
    drawSummaryRow(rightY, effectiveTaxRowH, 'Total Tax', totalTax.toFixed(2), lightFill, 8.8);
    rightY += effectiveTaxRowH;
    drawGrandTotalRow(rightY, effectiveTotalRowH);
    rightY += effectiveTotalRowH;

    // --- Signature block anchored immediately below summary rows ---
    // Distribute the remaining space: company name at top, signature line + signatory at bottom.
    const sigBottom = y + h;
    writeText(`For ${companySettings.name || 'Company'}`.toUpperCase(), rightX + rightW / 2, rightY + 9, {
      size: 7.5,
      style: 'bold',
      color: primary,
      align: 'center',
      maxWidth: rightW - 6,
    });
    line(rightX + 10, sigBottom - 10, rightX + rightW - 10, sigBottom - 10);
    writeText('Authorised Signatory', rightX + rightW / 2, sigBottom - 5, {
      size: 6.5,
      style: 'bold',
      align: 'center',
    });
  };

  const drawMinimalFooter = (y: number, h: number) => {
    // Guard against negative/zero height if invoice table overflows page.
    const fh = Math.max(20, h);
    const rightW = 64;
    const leftW = boxW - rightW;
    rect(boxX, y, boxW, fh);
    line(boxX + leftW, y, boxX + leftW, y + fh, 0.45);
    drawCell(boxX, y, leftW, 18, `Amount in words\n${amountInWords}`, {
      size: 8,
      style: 'bold',
      lineHeight: 4.5,
    });
    let leftY = y + 18;
    if (companySettings.termsAndConditions) {
      drawCell(boxX, leftY, leftW, 20, `Terms and Conditions\n${companySettings.termsAndConditions}`, {
        size: 7,
        color: textMuted,
        lineHeight: 4.1,
      });
      leftY += 20;
    }
    drawCell(boxX, leftY, leftW, y + fh - leftY, `Payment Details\n${[companySettings.bankName, companySettings.accountNumber ? `A/C: ${companySettings.accountNumber}` : '', companySettings.ifscCode ? `IFSC: ${companySettings.ifscCode}` : ''].filter(Boolean).join('  ') || '-'}`, {
      size: 7.3,
      color: textMuted,
      lineHeight: 4.2,
    });

    const rightX = boxX + leftW;
    const rows = [
      ['Subtotal', safeNumber(quotation.subTotal).toFixed(2), false],
      ...(isGst
        ? [
            ['CGST', safeNumber(quotation.cgst).toFixed(2), false],
            ['SGST', safeNumber(quotation.sgst).toFixed(2), false],
          ] as [string, string, boolean][]
        : []),
      ['Total', `Rs. ${safeNumber(quotation.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, true],
    ] as [string, string, boolean][];
    const rowH = Math.max(1, fh) / Math.max(1, rows.length);
    rows.forEach(([label, value, bold], index) => {
      const rowY = y + index * rowH;
      drawCell(rightX, rowY, rightW, rowH, `${label}\n${value}`, {
        fill: bold ? totalFill : undefined,
        size: bold ? 10 : 8,
        style: bold ? 'bold' : 'normal',
        align: 'right',
        valign: 'middle',
        lineHeight: bold ? 5 : 4.4,
      });
    });
  };

  const renderClassic = () => {
    drawWatermark();
    rect(boxX, boxY, boxW, boxH, undefined, 0.45);
    const headerH = 48;
    const titleH = 11;
    drawCell(boxX, boxY, boxW, titleH, title, {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 11,
      style: 'bold',
    });
    const headerY = boxY + titleH;
    drawHeader(headerH, false, headerY);
    const detailsY = headerY + headerH;
    const detailsH = 44;
    const tableH = 84;
    drawClassicDetails(detailsY, detailsH);
    const tableY = detailsY + detailsH;
    drawInvoiceTable(tableY, tableH, 'classic');
    drawClassicFooter(tableY + tableH, boxY + boxH - (tableY + tableH));
  };

  const renderMinimal = () => {
    drawWatermark();
    rect(boxX, boxY, boxW, boxH, undefined, 0.45);
    const headerH = 48;
    const titleH = 11;
    const detailsH = 46;
    const tableH = 96;
    drawCell(boxX, boxY, boxW, titleH, title, {
      align: 'center',
      valign: 'middle',
      fill: lightFill,
      size: 11,
      style: 'bold',
    });
    const headerY = boxY + titleH;
    drawHeader(headerH, false, headerY);
    const detailsY = headerY + headerH;
    drawMinimalDetails(detailsY, detailsH);
    const tableY = detailsY + detailsH;
    drawInvoiceTable(tableY, tableH, 'minimal');
    drawMinimalFooter(tableY + tableH, boxY + boxH - (tableY + tableH));
  };

  const renderModern = () => {
    const headerH = 39;
    drawWatermark();
    setFillColor(primary);
    doc.rect(0, 0, pageWidth, headerH, 'F');
    writeText((companySettings.name || 'COMPANY NAME').toUpperCase(), margin, 15, {
      size: 18,
      style: 'bold',
      color: [255, 255, 255],
      maxWidth: 112,
    });
    if (companySettings.address) {
      writeText(companySettings.address, margin, 24, {
        size: 8,
        color: [255, 255, 255],
        maxWidth: 96,
      });
    }
    writeText(title, pageWidth - margin, 14, {
      size: 15,
      style: 'bold',
      color: [255, 255, 255],
      align: 'right',
    });
    if (companySettings.phone) writeText(`Tel: ${companySettings.phone}`, pageWidth - margin, 23, { size: 8, color: [255, 255, 255], align: 'right' });
    if (companySettings.gstin) writeText(`GSTIN: ${companySettings.gstin}`, pageWidth - margin, 29, { size: 8, color: [255, 255, 255], align: 'right' });

    const detailsY = 50;
    drawCell(margin, detailsY, 82, 36, `Billed To\n${customerName}\n${customer?.address || '-'}\n${customer?.phone || '-'}`, {
      size: 8,
      style: 'bold',
      lineHeight: 4.5,
    });
    drawCell(pageWidth - margin - 82, detailsY, 82, 36, `Invoice No: ${quotation.quotationNo}\nDate: ${invoiceDate}\nStatus: ${quotation.status}`, {
      size: 8.5,
      style: 'bold',
      lineHeight: 6,
      align: 'right',
    });
    const tableY = detailsY + 46;
    drawInvoiceTable(tableY, 102, 'classic');
    drawClassicFooter(tableY + 102, pageHeight - margin - (tableY + 102), true);
  };

  if (companySettings.invoiceTemplate === 'Modern') {
    renderModern();
  } else if (companySettings.invoiceTemplate === 'Minimal') {
    renderMinimal();
  } else {
    renderClassic();
  }

  return doc.output('blob');
}

export async function downloadQuotationPdf(
  quotation: import("../types").Quotation,
  customer: import("../types").Customer | undefined,
  companySettings: import("../types").CompanySettings,
  filename: string,
): Promise<void> {
  const blob = await createQuotationPdfBlob(quotation, customer, companySettings);
  triggerBlobDownload(blob, filename);
}

