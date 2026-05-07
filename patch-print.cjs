const fs = require('fs');
let code = fs.readFileSync('src/lib/print-utils.ts', 'utf8');

// Normalize line endings to LF for easier processing
code = code.replace(/\r\n/g, '\n');

let startIndex = code.indexOf('export async function createInvoicePdfBlob');
let endIndex = code.indexOf("return doc.output('blob');\n}", startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  endIndex += "return doc.output('blob');\n}".length;
  let fn = code.substring(startIndex, endIndex);
  
  fn = fn.replace('createInvoicePdfBlob', 'createQuotationPdfBlob');
  fn = fn.replace('invoice: Invoice,', 'quotation: import("../types").Quotation,');
  fn = fn.replace(/invoice\./g, 'quotation.');
  fn = fn.replace(/quotation\.invoiceNo/g, 'quotation.quotationNo');
  
  fn = fn.replace(/const title = isGst \? 'TAX INVOICE' \: 'INVOICE';/g, "const title = isGst ? 'PROFORMA INVOICE' : 'QUOTATION';");

  let downloadFn = `
export async function downloadQuotationPdf(
  quotation: import("../types").Quotation,
  customer: import("../types").Customer | undefined,
  companySettings: import("../types").CompanySettings,
  filename: string,
): Promise<void> {
  const blob = await createQuotationPdfBlob(quotation, customer, companySettings);
  triggerBlobDownload(blob, filename);
}
`;
  
  // Re-add CRLF if needed or just use \n
  fs.appendFileSync('src/lib/print-utils.ts', '\n\n' + fn + '\n' + downloadFn + '\n');
  console.log('Patch applied successfully');
} else {
  console.log('Could not find bounds. startIndex:', startIndex, 'endIndex:', endIndex);
}
