/**
 * Export utilities for generating CSV downloads and PDF statements.
 * Used by Ledger, Daybook, and Customer Statement views.
 *
 * On native (Capacitor), CSV files are saved to the device Documents folder
 * via @capacitor/filesystem and shared via the OS share sheet.
 * On web, the existing browser-download path is preserved unchanged.
 */

import { isNative } from './capacitor';
import { saveNativeCsv } from './print-utils';

/**
 * Converts an array of objects to CSV format and triggers a download.
 * On native: saves to Documents folder and opens the share sheet.
 * On web: triggers a standard browser anchor download.
 * @param data - Array of row objects with consistent keys.
 * @param headers - Map of key → display column name.
 * @param filename - The output filename (without extension).
 */
export async function downloadCSV(
  data: Record<string, any>[],
  headers: Record<string, string>,
  filename: string
): Promise<void> {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  const keys = Object.keys(headers);
  const headerRow = keys.map((k) => `"${headers[k]}"`).join(",");

  const rows = data.map((row) =>
    keys
      .map((k) => {
        const val = row[k] ?? "";
        // Escape double quotes in cell values
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",")
  );

  const csvContent = [headerRow, ...rows].join("\n");
  const csvWithBom = "\uFEFF" + csvContent;

  if (isNative()) {
    // On device: save to Documents folder, then optionally share
    const { Share } = await import('@capacitor/share');
    const uri = await saveNativeCsv(csvWithBom, `${filename}.csv`);
    if (uri) {
      try {
        await Share.share({ title: filename, url: uri, dialogTitle: `Share ${filename}` });
      } catch {
        // User dismissed share sheet \u2014 file was still saved successfully
      }
    }
    return;
  }

  const blob = new Blob([csvWithBom], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates a professional PDF from the Customer Ledger Statement HTML.
 * Uses html2pdf.js for client-side PDF rendering.
 * @param customerName - Name for the filename.
 * @param statementHtml - The rendered HTML string of the statement table.
 */
export async function downloadLedgerStatementPdf(
  customerName: string,
  statementHtml: string
): Promise<void> {
  const html2pdf = (await import("html2pdf.js")).default;

  const fullHtml = `
    <div style="font-family: 'Inter', 'Segoe UI', sans-serif; color: #1a1a2e; padding: 24px;">
      ${statementHtml}
    </div>
  `;

  const opt = {
    margin: [0.4, 0.4] as [number, number],
    filename: `Ledger_Statement_${customerName.replace(/\s+/g, "_")}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: {
      unit: "in" as const,
      format: "a4" as const,
      orientation: "portrait" as const,
    },
  };

  try {
    const element = document.createElement("div");
    element.innerHTML = fullHtml;
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error("Ledger PDF generation failed:", error);
    alert("Failed to generate PDF. Please try again.");
  }
}
