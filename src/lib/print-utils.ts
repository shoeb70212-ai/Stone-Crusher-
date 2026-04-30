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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Collects all stylesheets from the current document as raw HTML strings. */
function collectCssRules(): string {
  let css = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
    css += node.outerHTML + '\n';
  });
  return css;
}

/**
 * Wraps raw invoice HTML in a full document with styles so html2pdf can render it.
 * @param bodyHtml - The innerHTML of the invoice area.
 * @param title    - Document <title> for the generated HTML.
 */
function buildFullHtml(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    ${collectCssRules()}
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: white !important; color: black;
             font-family: system-ui, -apple-system, sans-serif; }
      .shadow-2xl { box-shadow: none !important; }
      .rounded-xl { border-radius: 0 !important; }
    </style>
  </head>
  <body class="bg-white text-black">
    ${bodyHtml}
  </body>
</html>`;
}

/** Default html2pdf options for A4 portrait output. */
function pdfOptions(filename: string) {
  return {
    margin: [8, 8] as [number, number],
    filename,
    image: { type: 'png' as const, quality: 1 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  };
}

// ---------------------------------------------------------------------------
// Core PDF generation
// ---------------------------------------------------------------------------

/**
 * Converts HTML content into a PDF Blob via html2pdf.js.
 * Temporarily appends a hidden div to the DOM so html2pdf can measure layout.
 *
 * @param htmlContent - Raw innerHTML of the invoice area.
 * @param filename    - Filename embedded in the PDF metadata.
 * @returns A Blob containing the generated PDF.
 */
async function generatePdfBlob(htmlContent: string, filename: string): Promise<Blob> {
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = (html2pdfModule.default || html2pdfModule) as typeof html2pdfModule.default;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildFullHtml(htmlContent, filename);
  document.body.appendChild(wrapper);

  try {
    return await html2pdf().set(pdfOptions(filename)).from(wrapper).outputPdf('blob');
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Opens a browser print dialog for the given HTML content using a hidden iframe.
 * Used as a fallback when html2pdf.js fails.
 *
 * @param htmlContent - Raw innerHTML to print.
 */
export function printHtml(htmlContent: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write('<html><head><title>Print</title>');
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
    doc.write(node.outerHTML);
  });
  doc.write(`<style>
    @media print {
      @page { size: A4; margin: 8mm; }
      body { margin:0; padding:0; -webkit-print-color-adjust:exact; color-adjust:exact; background:white!important; }
      .shadow-2xl { box-shadow:none!important; }
      .rounded-xl { border-radius:0!important; }
      .m-4 { margin:0!important; }
    }
  </style>`);
  doc.write('</head><body class="bg-white text-black p-2 md:p-4">');
  doc.write(htmlContent);
  doc.write('</body></html>');
  doc.close();

  iframe.onload = () => {
    // requestAnimationFrame ensures the iframe content has been painted before
    // triggering the print dialog, replacing the arbitrary 500ms setTimeout.
    requestAnimationFrame(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    });
  };
}

/**
 * Generates a PDF and displays it in a pre-opened browser tab.
 *
 * IMPORTANT: `targetWindow` must be opened synchronously inside the click
 * handler (before any awaits) to avoid popup blockers. If the caller cannot
 * open a window (e.g. blocked), pass `null` and we fall back to `printHtml`.
 *
 * @param htmlContent  - Raw innerHTML of the invoice area.
 * @param targetWindow - A window reference opened via `window.open('','_blank')`
 *                       in the synchronous click handler. Pass `null` to skip.
 */
export async function openPdfInNewTab(
  htmlContent: string,
  targetWindow: Window | null,
): Promise<void> {
  if (!htmlContent) return;

  try {
    const blob = await generatePdfBlob(htmlContent, 'document.pdf');
    const url = URL.createObjectURL(blob);

    if (targetWindow) {
      targetWindow.location.href = url;
    } else {
      // Fallback: try opening (may be blocked) or use iframe print
      const fallback = window.open(url, '_blank');
      if (!fallback) printHtml(htmlContent);
    }
  } catch (error) {
    console.error('PDF generation failed, falling back to iframe print:', error);
    if (targetWindow) targetWindow.close();
    printHtml(htmlContent);
  }
}

/**
 * Generates a PDF and triggers a browser download.
 *
 * @param source   - Either an HTMLElement (we read its innerHTML) or a raw HTML string.
 * @param filename - The download filename, e.g. "Invoice-INV001.pdf".
 */
export async function downloadPdf(
  source: HTMLElement | string,
  filename: string,
): Promise<void> {
  const htmlContent = typeof source === 'string' ? source : source.innerHTML;
  if (!htmlContent) return;

  try {
    const blob = await generatePdfBlob(htmlContent, filename);
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();

    // Clean up after the browser has had time to initiate the download
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error('PDF download failed, falling back to iframe print:', error);
    printHtml(htmlContent);
  }
}

// ---------------------------------------------------------------------------
// Native share sheet (P0 — Share Sheet Integration)
// ---------------------------------------------------------------------------

/**
 * Shares a PDF via the native OS share sheet (WhatsApp, email, Drive, etc.).
 * On web, falls back to a standard browser download.
 *
 * @param source   - HTMLElement or raw HTML string for the PDF content.
 * @param filename - Suggested filename, e.g. "Invoice-INV001.pdf".
 * @param title    - Share dialog title shown on Android.
 */
export async function sharePdf(
  source: HTMLElement | string,
  filename: string,
  title = 'Share Document',
): Promise<void> {
  const htmlContent = typeof source === 'string' ? source : source.innerHTML;
  if (!htmlContent) return;

  if (!isNative()) {
    // Web: fall back to browser download
    return downloadPdf(source, filename);
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const blob = await generatePdfBlob(htmlContent, filename);
    const base64 = await blobToBase64(blob);

    // Write to a temp file in the cache directory so Share can attach it
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title,
      url: result.uri,
      dialogTitle: title,
    });
  } catch (error) {
    console.error('Native share failed, falling back to download:', error);
    return downloadPdf(source, filename);
  }
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

  if (!isNative()) {
    await downloadPdf(source, filename);
    return;
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    const blob = await generatePdfBlob(htmlContent, filename);
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
    await downloadPdf(source, filename);
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
  if (!isNative()) return;

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    const result = await Filesystem.writeFile({
      path: filename,
      data: btoa(unescape(encodeURIComponent(csvContent))),
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
      // Strip "data:<mime>;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}