import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readNetcodeConfig } from './NetcodeConfig';

let singleton: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (singleton !== null) return singleton;
  const config = readNetcodeConfig();
  if (!config.enabled) throw new Error('PAYAW netcode is not configured. Add the public Supabase URL and publishable key.');
  singleton = createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 10 } },
    global: { headers: { 'X-Client-Info': 'payaw/0.23.2' } },
  });
  return singleton;
}

export function resetSupabaseClientForTests(): void {
  singleton = null;
}
