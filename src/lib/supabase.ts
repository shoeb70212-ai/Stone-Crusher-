/**
 * Browser-side Supabase client singleton.
 *
 * Import `supabase` from this module everywhere in src/ that needs
 * auth or database access.  Never import the admin client here.
 *
 * The session is persisted automatically to localStorage under the key
 * `crushtrack-auth` and auto-refreshed by the SDK.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const missingKeys =
  !supabaseUrl ||
  supabaseUrl === 'https://YOUR_PROJECT_REF.supabase.co' ||
  !supabaseAnonKey ||
  supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY';

if (missingKeys) {
  console.error(
    '[CrushTrack] Supabase is not configured.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.\n' +
    'Get them from: supabase.com/dashboard → Project → Settings → API',
  );
}

// Create the client unconditionally so the rest of the app can import it
// without crashing; auth calls will simply fail with a network error until
// the keys are configured.
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'crushtrack-auth',
    },
  },
);

/** True when Supabase keys are properly configured. */
export const isSupabaseConfigured = !missingKeys;
