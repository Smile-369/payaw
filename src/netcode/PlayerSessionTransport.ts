import type { PlayerCommand } from '../player/PlayerCommands';
import type { PlayerProjection } from '../player/PlayerProjection';
import type { CampaignEventRecord, PlayerSlotRecord, PresenceRecord } from './NetcodeTypes';

/** The session needs only this transport boundary, not a concrete Supabase client. */
export interface PlayerSessionTransport {
  uploadCharacterImage(campaignId: string, userId: string, file: File): Promise<string>;
  resolveCharacterImage(uri: string): Promise<string>;
  assignedSlot(campaignId: string, userId: string): Promise<PlayerSlotRecord>;
  diceEvents(campaignId: string, limit?: number): Promise<readonly CampaignEventRecord[]>;
  submitCommand(campaignId: string, command: PlayerCommand, revision: number, offlineSafe: boolean, key: string): Promise<{
    readonly projection: PlayerProjection | null;
    readonly diceRoll: unknown | null;
  }>;
  subscribePlayer(campaignId: string, userId: string, presence: PresenceRecord, handlers: {
    readonly onProjection: (projection: PlayerProjection) => void;
    readonly onConnection: (state: 'online' | 'reconnecting' | 'offline' | 'error', detail: string) => void;
    readonly onEvent: (event: CampaignEventRecord) => void;
  }): Promise<() => void>;
}
