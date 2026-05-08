/**
 * Export utilities for generating CSV downloads and PDF statements.
 * Used by Ledger, Daybook, and Customer Statement views.
 *
 * On native (Capacitor), CSV files are saved to the device Documents folder
 * via @capacitor/filesystem and shared via the OS share sheet.
 * On web, the existing browser-download path is preserved unchanged.
 */

import { isNative } from './capacitor';
import { saveNativeCsv, yieldToMain, withTimeout } from './print-utils';

/**
 * Converts an array of objects to CSV format and triggers a download.
 * On native: saves to Documents folder and opens the share sheet.
 * On web: triggers a standard browser anchor download.
 *
 * @param data     - Array of row objects with consistent keys.
 * @param headers  - Map of key → display column name.
 * @param filename - The output filename without extension.
 * @throws {Error} if data is empty — callers should check before calling.
 */
export async function downloadCSV(
  data: Record<string, unknown>[],
  headers: Record<string, string>,
  filename: string,
): Promise<void> {
  if (data.length === 0) throw new Error('No data to export.');

  const keys = Object.keys(headers);
  const headerRow = keys.map((k) => `"${headers[k]}"`).join(',');

  const rows = data.map((row) =>
    keys
      .map((k) => {
        const val = row[k] ?? '';
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(','),
  );

  const csvContent = [headerRow, ...rows].join('\n');
  const csvWithBom = '﻿' + csvContent;

  if (isNative()) {
    const { Share } = await import('@capacitor/share');
    const uri = await saveNativeCsv(csvWithBom, `${filename}.csv`);
    if (uri) {
      try {
        await Share.share({ title: filename, url: uri, dialogTitle: `Share ${filename}` });
      } catch {
        // User dismissed share sheet — file was still saved successfully
      }
    }
    return;
  }

  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revocation so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Creates a PDF Blob from the Customer Ledger Statement HTML.
 * Callers can then download it via `downloadPdfBlob` or share it via `sharePdfBlob`.
 *
 * @param customerName  - Used for wrapper display; not embedded in the blob filename.
 * @param statementHtml - The rendered HTML string of the statement table.
 * @returns A PDF Blob ready for download or sharing.
 */
export async function createLedgerPdfBlob(
  customerName: string,
  statementHtml: string,
): Promise<Blob> {
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = (html2pdfModule.default || html2pdfModule) as typeof html2pdfModule.default;

  const opt = {
    margin: [0.4, 0.4] as [number, number],
    filename: `Ledger_Statement_${customerName.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.85 },
    // Scale 1 keeps canvas work manageable; scale 2 freezes the UI thread for several seconds.
    html2canvas: { scale: 1, useCORS: true, logging: false },
    jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const },
  };

  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  // position:fixed off-screen so html2canvas can capture it; z-index:-1 causes blank output.
  wrapper.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    'pointer-events:none',
    'background:white',
    'color:#1a1a2e',
  ].join(';');
  wrapper.innerHTML = `<div style="font-family:'Inter','Segoe UI',sans-serif;padding:24px;">${statementHtml}</div>`;
  document.body.appendChild(wrapper);

  // Yield so loading indicators can paint before html2canvas blocks the thread.
  await yieldToMain();

  try {
    return await withTimeout(
      html2pdf().set(opt).from(wrapper).outputPdf('blob'),
      15000,
      'Ledger PDF generation',
    );
  } finally {
    document.body.removeChild(wrapper);
  }
}

/**
 * Generates a PDF from the Customer Ledger Statement HTML and triggers a download.
 *
 * @param customerName  - Used to build the output filename.
 * @param statementHtml - The rendered HTML string of the statement table.
 */
export async function downloadLedgerStatementPdf(
  customerName: string,
  statementHtml: string,
): Promise<void> {
  const { downloadPdfBlob } = await import('./print-utils');
  const blob = await createLedgerPdfBlob(customerName, statementHtml);
  const filename = `Ledger_Statement_${customerName.replace(/\s+/g, '_')}.pdf`;
  downloadPdfBlob(blob, filename);
}
