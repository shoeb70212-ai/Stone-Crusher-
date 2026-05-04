/**
 * Shared CORS configuration for Vercel serverless API handlers.
 * Centralises allowed origins so every endpoint uses the same whitelist.
 */

export const ALLOWED_ORIGINS = new Set([
  'https://stone-crusher.vercel.app',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:8083',
  // Capacitor Android WebView origin
  'https://localhost',
  'capacitor://localhost',
]);

export function getCorsOrigin(origin: string | undefined): string {
  if (!origin) return '*';
  return ALLOWED_ORIGINS.has(origin) ? origin : 'null';
}
