/**
 * Browser-safe publishable pair already shipped on auth.acongm.com.
 * Used only when dedicated SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY
 * env vars are missing, so Chat/Portal can bootstrap a Supabase client.
 */
export const ACONGM_SUPABASE_URL = 'https://ejprvntpxlyydkzsjqnv.supabase.co';

export const ACONGM_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcHJ2bnRweGx5eWRrenNqcW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzAxNjYsImV4cCI6MjA5NjI0NjE2Nn0.a6E_WLbG-7Fv4JUzV1z7yYZH-zP89yD5AVWKV3XUSB8';

export function knownPublicKeyForSupabaseUrl(
  url: string | undefined,
): string | undefined {
  const normalized = url?.trim().replace(/\/+$/, '');
  if (normalized === ACONGM_SUPABASE_URL) {
    return ACONGM_SUPABASE_ANON_KEY;
  }
  return undefined;
}
