/**
 * Server-side Supabase admin client (service-role key).
 *
 * SECURITY: This module must NEVER be imported by any file under src/.
 * The service-role key bypasses Row Level Security — it must only run
 * in server-side Vercel functions (api/*.ts) and scripts/*.
 *
 * The file starts with `_` so Vercel does not expose it as a public route.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

/** Lazily-created admin client so a missing env var doesn't crash the server at startup. */
let _adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing server-side Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
    );
  }

  _adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _adminClient;
}

/** Admin client — full access, bypasses RLS. Server use only. */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getAdminClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Verifies a Bearer JWT from an incoming request using the anon client.
 * Returns the authenticated user's id and email, or null if invalid.
 */
export async function verifyBearerToken(
  req: VercelRequest,
): Promise<{ userId: string; email: string } | null> {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length);

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
  };
}
