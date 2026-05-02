import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Keep heavy PDF/print libs out of the main bundle
            'pdf-libs': ['html2pdf.js', 'jspdf'],
            // Split finance-heavy pages into their own chunk
            'pages-finance': [
              './src/pages/Invoices.tsx',
              './src/pages/Ledger.tsx',
              './src/pages/Daybook.tsx',
            ],
            // Operations pages
            'pages-ops': [
              './src/pages/Dispatch.tsx',
              './src/pages/Vehicles.tsx',
              './src/pages/Customers.tsx',
            ],
          },
        },
      },
    },
  };
});
