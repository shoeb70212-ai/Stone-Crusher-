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
          padding: 10px; 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact;
          background-color: white !important;
        }
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
  let cssRules = '';
  document.querySelectorAll('style').forEach(node => {
     cssRules += node.innerHTML + '\n';
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          ${cssRules}
          @media print {
            @page { margin: 0; }
          }
          body { 
            margin: 0; 
            padding: ${format === 'A4' ? '20px' : '10px'}; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            background-color: white !important;
          }
        </style>
      </head>
      <body class="bg-white text-black font-sans leading-relaxed text-sm">
        ${htmlContent}
      </body>
    </html>
  `;

  try {
     const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, format })
     });

     if (!res.ok) throw new Error("Failed to generate PDF on server");

     const blob = await res.blob();
     const url = window.URL.createObjectURL(blob);
     window.open(url, '_blank');
  } catch (error) {
     console.error("PDF generation failed:", error);
     alert("Failed to build PDF on server. Falling back to native print.");
     printHtml(htmlContent, format);
  }
}

export async function downloadPdfBackend(htmlContent: string, format: string, filename: string) {
  let cssRules = '';
  document.querySelectorAll('style').forEach(node => {
     cssRules += node.innerHTML + '\n';
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          ${cssRules}
          @media print {
            @page { margin: 0; }
          }
          body { 
            margin: 0; 
            padding: ${format === 'A4' ? '20px' : '10px'}; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            background-color: white !important;
          }
        </style>
      </head>
      <body class="bg-white text-black font-sans leading-relaxed text-sm">
        ${htmlContent}
      </body>
    </html>
  `;

  try {
     const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, format })
     });

     if (!res.ok) throw new Error("Failed to generate PDF on server");

     const blob = await res.blob();
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     document.body.appendChild(a);
     a.click();
     window.URL.revokeObjectURL(url);
     document.body.removeChild(a);
  } catch (error) {
     console.error("PDF download failed:", error);
     alert("Failed to download PDF. Falling back to native print.");
     printHtml(htmlContent, format);
  }
}

