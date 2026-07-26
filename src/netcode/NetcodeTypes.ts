import type { PlayerCommand } from '../player/PlayerCommands';
import type { PlayerProjection } from '../player/PlayerProjection';

export const NETCODE_SCHEMA_VERSION = 23 as const;

export type CampaignRole = 'owner-gm' | 'co-gm' | 'player' | 'observer';
export type ConnectionState = 'disabled' | 'signed-out' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'error';

export interface NetcodeConfig {
  readonly enabled: boolean;
  readonly supabaseUrl: string;
  readonly publishableKey: string;
}

export interface CampaignRoomRecord {
  readonly id: string;
  readonly owner_user_id: string;
  readonly source_campaign_id: string;
  readonly name: string;
  readonly status: 'setup' | 'active' | 'paused' | 'archived';
  readonly projection_revision: number;
  readonly schema_version: number;
}

export interface CampaignAuthorityRecord {
  readonly campaign_id: string;
  readonly revision: number;
  readonly schema_version: number;
  readonly campaign_document: Readonly<Record<string, unknown>>;
  readonly updated_by: string;
  readonly updated_at: string;
}

export interface CampaignMemberRecord {
  readonly campaign_id: string;
  readonly user_id: string;
  readonly role: CampaignRole;
  readonly source_player_id: string | null;
  readonly display_name: string;
  readonly assigned_character_id: string | null;
  readonly revoked_at: string | null;
  readonly joined_at: string;
  readonly last_seen_at: string | null;
}

export interface PlayerSlotRecord {
  readonly campaign_id: string;
  readonly source_player_id: string;
  readonly assigned_user_id: string | null;
  readonly assigned_character_id: string;
  readonly display_name: string;
  readonly projection_version: number;
  readonly revision: number;
  readonly projection: PlayerProjection;
  readonly generated_at: string;
}


export interface PlayerPortalLoginRecord {
  readonly source_player_id: string;
  readonly login_id: string;
  readonly enabled: boolean;
  readonly updated_at: string;
}

export interface PlayerPortalResolution {
  readonly authEmail: string;
  readonly campaignId: string;
  readonly sourcePlayerId: string;
  readonly displayName: string;
}

export interface CampaignCommandRecord {
  readonly id: string;
  readonly campaign_id: string;
  readonly user_id: string;
  readonly source_player_id: string;
  readonly idempotency_key: string;
  readonly kind: PlayerCommand['kind'];
  readonly payload: PlayerCommand;
  readonly expected_revision: number;
  readonly offline_safe: boolean;
  readonly status: 'queued' | 'processing' | 'applied' | 'rejected';
  readonly result: Readonly<Record<string, unknown>> | null;
  readonly error_code: string | null;
  readonly created_at: string;
  readonly resolved_at: string | null;
}

export interface PresenceRecord {
  readonly userId: string;
  readonly displayName: string;
  readonly role: CampaignRole;
  readonly sourcePlayerId: string | null;
  readonly view: 'gm' | 'player';
  readonly state: 'online' | 'reconnecting';
  readonly onlineAt: string;
}

export interface QueuedPlayerCommand {
  readonly campaignId: string;
  readonly idempotencyKey: string;
  readonly command: PlayerCommand;
  readonly expectedRevision: number;
  readonly offlineSafe: boolean;
  readonly queuedAt: string;
  readonly attempts: number;
}

export interface ConnectionSnapshot {
  readonly state: ConnectionState;
  readonly detail: string;
  readonly lastOnlineAt: string | null;
  readonly pendingCommands: number;
}

export function isOfflineSafeCommand(command: PlayerCommand): boolean {
  return command.kind === 'journal.create'
    || command.kind === 'journal.share'
    || command.kind === 'character.update'
    || command.kind === 'objective.propose';
}

