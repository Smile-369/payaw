import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readNetcodeConfig } from './NetcodeConfig';

let singleton: SupabaseClient | null = null;

function normalizedPlayerLoginId(loginId: string): string {
  const normalized = loginId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(normalized)) {
    throw new Error('Enter a 3–24 character player username using letters, numbers, underscores, or hyphens.');
  }
  return normalized;
}

function normalizedCampaignId(campaignId: string): string {
  const normalized = campaignId.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error('Enter the campaign ID provided by the GM.');
  }
  return normalized;
}

function clientOptions(storageKey: string, detectSessionInUrl: boolean) {
  return {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
      storage: localStorage,
      storageKey,
    },
    realtime: { params: { eventsPerSecond: 10 } },
    global: { headers: { 'X-Client-Info': 'payaw/0.24.0' } },
  } as const;
}

/** GM/editor client. Player Portal uses createPlayerSupabaseClient instead. */
export function getSupabaseClient(): SupabaseClient {
  if (singleton !== null) return singleton;
  const config = readNetcodeConfig();
  if (!config.enabled) throw new Error('PAYAW netcode is not configured. Add the public Supabase URL and publishable key.');
  singleton = createClient(config.supabaseUrl, config.publishableKey, clientOptions('payaw-gm-auth', true));
  return singleton;
}

/**
 * Each campaign + player username receives a separate auth storage namespace.
 * This keeps a player signed in across refreshes without sharing credentials
 * with a different campaign or player account in the same browser.
 */
export function createPlayerSupabaseClient(campaignId: string, loginId: string): SupabaseClient {
  const config = readNetcodeConfig();
  if (!config.enabled) throw new Error('PAYAW netcode is not configured. Add the public Supabase URL and publishable key.');
  const normalizedCampaign = normalizedCampaignId(campaignId);
  const normalizedLogin = normalizedPlayerLoginId(loginId);
  return createClient(
    config.supabaseUrl,
    config.publishableKey,
    clientOptions(`payaw-player-auth-${normalizedCampaign}-${normalizedLogin.toLowerCase()}`, false),
  );
}

export function normalizePlayerLoginId(loginId: string): string {
  return normalizedPlayerLoginId(loginId);
}

export function normalizeCampaignId(campaignId: string): string {
  return normalizedCampaignId(campaignId);
}

export function resetSupabaseClientForTests(): void {
  singleton = null;
}
