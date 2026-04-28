export function printHtml(htmlContent: string, format: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
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
  
  doc.write(`
    <style>
      @media print {
        @page {
          size: A4;
          margin: 8mm;
        }
        body { 
          margin: 0; 
          padding: 0; 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact;
          background-color: white !important;
        }
        .shadow-2xl { box-shadow: none !important; }
        .rounded-xl { border-radius: 0 !important; }
        .m-4 { margin: 0 !important; }
      }
    </style>
  `);
  doc.write('</head><body class="bg-white text-black p-2 md:p-4">');
  doc.write(htmlContent);
  doc.write('</body></html>');
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };
}

export async function openPdfBackend(htmlContent: string, format: string) {
  if (!htmlContent) return;
  
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = (html2pdfModule.default || html2pdfModule) as typeof html2pdfModule.default;
  
  let cssRules = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
    cssRules += node.outerHTML + '\n';
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print</title>
        <script src="https://cdn.tailwindcss.com"></script>
        ${cssRules}
        <style>
          body { margin: 0; padding: 0; background-color: white !important; color: black; }
          .shadow-2xl { box-shadow: none !important; }
          .rounded-xl { border-radius: 0 !important; }
        </style>
      </head>
      <body class="bg-white text-black font-sans">
        ${htmlContent}
      </body>
    </html>
  `;

  const opt = {
    margin:       [8, 8] as [number, number],
    filename:    'document.pdf',
    image:       { type: 'png' as const, quality: 1 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
  };

  try {
    const element = document.createElement('div');
    element.innerHTML = fullHtml;
    document.body.appendChild(element);
    
    const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
    document.body.removeChild(element);
    
    const url = window.URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  } catch (error) {
    console.error("PDF generation failed:", error);
    printHtml(htmlContent, format);
  }
}

export async function downloadPdfBackend(element: HTMLElement | string, format: string, filename: string) {
  const htmlContent = typeof element === 'string' ? element : element.innerHTML;
  
  if (!htmlContent) {
    printHtml('', format);
    return;
  }

  let cssRules = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
    cssRules += node.outerHTML + '\n';
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        ${cssRules}
        <style>
          body { margin: 0; padding: 0; background-color: white !important; color: black; font-family: sans-serif; }
          .shadow-2xl { box-shadow: none !important; }
          .rounded-xl { border-radius: 0 !important; }
        </style>
      </head>
      <body class="bg-white text-black font-sans">
        ${htmlContent}
      </body>
    </html>
  `;

  const opt = {
    margin:       [8, 8] as [number, number],
    filename:    filename,
    image:       { type: 'png' as const, quality: 1 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
  };

  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule.default || html2pdfModule) as typeof html2pdfModule.default;

    const div = document.createElement('div');
    div.innerHTML = fullHtml;
    document.body.appendChild(div);
    
    const pdfBlob = await html2pdf().set(opt).from(div).outputPdf('blob');
    document.body.removeChild(div);
    
    const url = window.URL.createObjectURL(pdfBlob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error("PDF download failed:", error);
    printHtml(htmlContent, format);
  }
}