import type { NetcodeConfig } from './NetcodeTypes';

export function readNetcodeConfig(): NetcodeConfig {
  const enabled = String(import.meta.env.VITE_PAYAW_NETCODE_ENABLED ?? '').toLocaleLowerCase() === 'true';
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  return { enabled: enabled && supabaseUrl.length > 0 && publishableKey.length > 0, supabaseUrl, publishableKey };
}
