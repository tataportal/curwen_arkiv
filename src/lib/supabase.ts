import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read lazily: CLI dotenv initialization must precede use, not module evaluation.
export function isSupabaseConfigured(): boolean {
  return Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
    && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY));
}
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const key = publicKey || (typeof window === 'undefined'
    ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY : undefined);
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: {
    fetch: (url, options) => fetch(url, { ...options, signal: options?.signal ?? AbortSignal.timeout(30_000) }),
  } });
}
