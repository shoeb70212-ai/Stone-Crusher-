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
    margin:       [0, 0] as [number, number],
    filename:     'document.pdf',
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: format === 'A4' ? 'a4' : ([3.15, 11] as [number, number]), orientation: 'portrait' as const }
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

export async function downloadPdfBackend(element: HTMLElement | string, format: string, filename: string) {
  // If element is passed as string (legacy), fallback to printHtml
  if (typeof element === 'string') {
     alert("Failed to download PDF. Falling back to native print.");
     printHtml(element, format);
     return;
  }

  try {
    const domtoimage = await import('dom-to-image-more');
    const { jsPDF } = await import('jspdf');

    // Conditionally import Capacitor
    let Capacitor, Filesystem, Directory, Share;
    try {
      const core = await import('@capacitor/core');
      Capacitor = core.Capacitor;
      const fs = await import('@capacitor/filesystem');
      Filesystem = fs.Filesystem;
      Directory = fs.Directory;
      const share = await import('@capacitor/share');
      Share = share.Share;
    } catch (e) {
      console.warn("Capacitor plugins not available", e);
    }

    // Capture the element using dom-to-image-more
    // Using JPEG to massively reduce file size
    const scale = 2; // high resolution
    const dataUrl = await domtoimage.default.toJpeg(element, {
      quality: 0.95,
      bgcolor: '#ffffff', // Ensure white background for JPEG
      width: element.clientWidth * scale,
      height: element.clientHeight * scale,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: element.clientWidth + 'px',
        height: element.clientHeight + 'px'
      }
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [element.clientWidth, element.clientHeight]
    });

    pdf.addImage(dataUrl, 'JPEG', 0, 0, element.clientWidth, element.clientHeight);

    if (Capacitor && Capacitor.isNativePlatform()) {
      const pdfBase64Str = pdf.output('datauristring');
      const base64Data = pdfBase64Str.split(',')[1];
      
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });
      
      await Share.share({
        title: filename,
        url: savedFile.uri,
        dialogTitle: 'Share or Save PDF'
      });
    } else {
      // For web browsers, we explicitly force a standard file download
      const blob = pdf.output('blob');
      
      // We skip navigator.share here because Windows 11 Desktop supports it
      // and pops open a confusing Share dialog when users just want a file download.
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
  } catch (error) {
     console.error("PDF download failed:", error);
     alert("Failed to download PDF natively. Falling back to browser print.");
     printHtml(element.innerHTML, format);
  }
}

