import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secureSessionStorage } from './secure-session-storage';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const mobileAuthConfigured = Boolean(url && publishableKey);

// Supabase session persistence is routed through the native Android KeyStore/iOS
// Keychain adapter. Browser/Vite development intentionally falls back to memory only.
export const supabase: SupabaseClient | null = mobileAuthConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        storage: secureSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
