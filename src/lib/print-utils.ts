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
  // Copy all styles from parent to ensure Tailwind applies
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
     doc.write(node.outerHTML);
  });
  
  doc.write(`
    <style>
      @media print {
        @page {
          size: ${format === 'A4' ? 'A4' : format === 'Thermal-58mm' ? '58mm auto' : '80mm auto'};
          margin: 0;
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
  doc.write('</head><body class="bg-white text-black p-4">');
  doc.write(htmlContent);
  doc.write('</body></html>');
  doc.close();

  // Print once the iframe has loaded
  iframe.onload = () => {
     setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000); // Give it time before removing
     }, 500);
  };
}

export async function openPdfBackend(htmlContent: string, format: string) {
  // Fix dynamic import for Vite
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = html2pdfModule.default || html2pdfModule;
  
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
          @media print {
            @page { margin: 0; }
          }
          body { 
            margin: 0; 
            padding: 0;
            background-color: white !important;
            color: black;
          }
          /* Override any modal-specific margins/shadows for print */
          .shadow-2xl { box-shadow: none !important; }
          .rounded-xl { border-radius: 0 !important; }
          .m-4 { margin: 0 !important; }
        </style>
      </head>
      <body class="bg-white text-black font-sans leading-relaxed text-sm">
        ${htmlContent}
      </body>
    </html>
  `;

  const opt = {
    margin:       [0, 0],
    filename:     'document.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: format === 'A4' ? 'a4' : [3.15, 11], orientation: 'portrait' }
  };

  try {
     const element = document.createElement('div');
     element.innerHTML = fullHtml;
     
     const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
     const url = window.URL.createObjectURL(pdfBlob);
     window.open(url, '_blank');
  } catch (error) {
     console.error("PDF generation failed:", error);
     alert("Failed to build PDF. Falling back to native print.");
     printHtml(htmlContent, format);
  }
}

export async function downloadPdfBackend(htmlContent: string, format: string, filename: string) {
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = html2pdfModule.default || html2pdfModule;
  
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
          @media print {
            @page { margin: 0; }
          }
          body { 
            margin: 0; 
            padding: 0;
            background-color: white !important;
            color: black;
          }
          .shadow-2xl { box-shadow: none !important; }
          .rounded-xl { border-radius: 0 !important; }
          .m-4 { margin: 0 !important; }
        </style>
      </head>
      <body class="bg-white text-black font-sans leading-relaxed text-sm">
        ${htmlContent}
      </body>
    </html>
  `;

  const opt = {
    margin:       [0, 0],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: format === 'A4' ? 'a4' : [3.15, 11], orientation: 'portrait' }
  };

  try {
     const element = document.createElement('div');
     element.innerHTML = fullHtml;
     
     await html2pdf().set(opt).from(element).save();
  } catch (error) {
     console.error("PDF download failed:", error);
     alert("Failed to download PDF. Falling back to native print.");
     printHtml(htmlContent, format);
  }
}

