import { normalizeCampaignId, normalizePlayerLoginId } from './SupabaseClient';

const RECENT_CAMPAIGNS_KEY = 'payaw-player-portal-recent-v1';
const MAX_RECENT_CAMPAIGNS = 8;

type RecentCampaignStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface RecentCampaign {
  readonly campaignId: string;
  readonly username: string;
  readonly campaignName: string;
  readonly lastUsedAt: string;
}

function parseRecentCampaign(value: unknown): RecentCampaign | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<Record<keyof RecentCampaign, unknown>>;
  if (
    typeof candidate.campaignId !== 'string'
    || typeof candidate.username !== 'string'
    || typeof candidate.campaignName !== 'string'
    || typeof candidate.lastUsedAt !== 'string'
  ) return null;

  try {
    const campaignId = normalizeCampaignId(candidate.campaignId);
    const username = normalizePlayerLoginId(candidate.username);
    const campaignName = candidate.campaignName.trim().slice(0, 120);
    const lastUsedAt = new Date(candidate.lastUsedAt);
    if (campaignName.length === 0 || Number.isNaN(lastUsedAt.getTime())) return null;
    return { campaignId, username, campaignName, lastUsedAt: lastUsedAt.toISOString() };
  } catch {
    return null;
  }
}

function recentCampaignKey(campaignId: string, username: string): string {
  return `${campaignId}:${username}`;
}

export function readRecentCampaigns(storage: RecentCampaignStorage = localStorage): readonly RecentCampaign[] {
  try {
    const raw = storage.getItem(RECENT_CAMPAIGNS_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const unique = new Map<string, RecentCampaign>();
    for (const value of parsed) {
      const campaign = parseRecentCampaign(value);
      if (campaign === null) continue;
      const key = recentCampaignKey(campaign.campaignId, campaign.username);
      const existing = unique.get(key);
      if (existing === undefined || existing.lastUsedAt < campaign.lastUsedAt) unique.set(key, campaign);
    }
    return [...unique.values()]
      .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
      .slice(0, MAX_RECENT_CAMPAIGNS);
  } catch {
    return [];
  }
}

export function rememberRecentCampaign(
  campaign: Omit<RecentCampaign, 'lastUsedAt'>,
  storage: RecentCampaignStorage = localStorage,
): readonly RecentCampaign[] {
  const normalized = parseRecentCampaign({ ...campaign, lastUsedAt: new Date().toISOString() });
  if (normalized === null) return readRecentCampaigns(storage);
  const key = recentCampaignKey(normalized.campaignId, normalized.username);
  const recent = [
    normalized,
    ...readRecentCampaigns(storage).filter((item) => recentCampaignKey(item.campaignId, item.username) !== key),
  ].slice(0, MAX_RECENT_CAMPAIGNS);
  storage.setItem(RECENT_CAMPAIGNS_KEY, JSON.stringify(recent));
  return recent;
}

export function forgetRecentCampaign(
  campaignId: string,
  username: string,
  storage: RecentCampaignStorage = localStorage,
): readonly RecentCampaign[] {
  let key: string;
  try {
    key = recentCampaignKey(normalizeCampaignId(campaignId), normalizePlayerLoginId(username));
  } catch {
    return readRecentCampaigns(storage);
  }
  const recent = readRecentCampaigns(storage)
    .filter((item) => recentCampaignKey(item.campaignId, item.username) !== key);
  storage.setItem(RECENT_CAMPAIGNS_KEY, JSON.stringify(recent));
  return recent;
}
