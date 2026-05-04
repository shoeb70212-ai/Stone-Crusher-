import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/// <reference types="vitest" />

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(process.env.CI === 'true' && env.VITE_SENTRY_DSN
        ? [sentryVitePlugin({ authToken: env.SENTRY_AUTH_TOKEN, org: env.SENTRY_ORG, project: env.SENTRY_PROJECT })]
        : []),
    ],
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
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/__tests__/setup.ts'],
      globals: true,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Keep heavy PDF/print libs out of the main bundle
            'pdf-libs': ['html2pdf.js'],
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
