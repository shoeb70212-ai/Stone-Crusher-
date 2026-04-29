/**
 * Utility functions for generating, printing, and downloading PDF invoices.
 *
 * Architecture notes:
 * - `printHtml` uses a hidden iframe + browser print dialog (fallback path).
 * - `generatePdfBlob` is the shared core that converts HTML → PDF blob via html2pdf.js.
 * - `openPdfInNewTab` and `downloadPdf` are the two primary entry points.
 * - Popup blockers require `window.open` to be called synchronously inside the
 *   user-initiated click handler. Callers MUST open the window themselves and
 *   pass it in — this module never calls `window.open` on its own.
 */

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