import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const mobileAuthConfigured = Boolean(url && publishableKey);

// Deliberately no localStorage/session persistence. Until OS-backed secure storage
// is integrated and audited, authentication lives only inside the current process.
export const supabase: SupabaseClient | null = mobileAuthConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
