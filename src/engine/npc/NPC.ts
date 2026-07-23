import type { ZoneType } from '../zoning/Zone';

export enum NPCStatus {
  Alive = 'alive',
  Missing = 'missing',
  Injured = 'injured',
  Possessed = 'possessed',
  Dead = 'dead',
}

/** Legacy four-period schedule retained only for schema 18 import compatibility. */
export type NPCSchedulePeriod = 'morning' | 'day' | 'evening' | 'night';

/** Legacy schedule record retained for older project files. */
export interface LegacyNPCScheduleEntry {
  readonly period: NPCSchedulePeriod;
  readonly locationLabel: string;
  readonly tileIndex: number;
}

export type CampaignDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type NPCScheduleLocationKind =
  | 'home'
  | 'workplace'
  | 'building'
  | 'anchor'
  | 'settlement'
  | 'authored-feature'
  | 'custom';

export interface NPCScheduleLocation {
  readonly kind: NPCScheduleLocationKind;
  /** Stable reference such as building:12, anchor:3, settlement:settlement-1, or authored-feature:uuid. */
  readonly ref: string;
  readonly label: string;
  readonly tileIndex: number;
}

/**
 * Author-editable schedule block. Minutes use local campaign time and may not
 * overlap another block on the same day. The GM is free to leave gaps; gaps
 * resolve to the NPC's residential home.
 */
export interface NPCScheduleEntry {
  readonly id: string;
  readonly day: CampaignDay;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly activity: string;
  readonly location: NPCScheduleLocation;
  readonly travelMode: 'walk' | 'drive' | 'public-transport' | 'none';
  readonly visibility: 'gm-only' | 'revealable' | 'public';
}

export interface NPCRelationship {
  readonly npcId: number;
  readonly kind: 'family' | 'friend' | 'rival' | 'coworker' | 'neighbor' | 'contact' | 'romantic' | 'custom';
  readonly label?: string;
  readonly notes?: string;
  readonly hidden?: boolean;
}

export interface NPCStorySuggestions {
  readonly personality: string;
  readonly wish: string;
  readonly fear: string;
  readonly secret: string;
  readonly rumor: string;
}

export interface NPC {
  readonly id: number;
  readonly key: string;
  readonly source?: 'generated' | 'authored';
  readonly name: string;
  readonly age: number;
  readonly occupation: string;
  readonly personality: string;
  readonly wish: string;
  readonly fear: string;
  readonly secret: string;
  readonly rumor: string;
  readonly generatedSuggestions?: NPCStorySuggestions;
  readonly status: NPCStatus;
  readonly settlementId: number;
  readonly zoneType: ZoneType | null;
  readonly homeBuildingId: number | null;
  readonly workplaceBuildingId: number | null;
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
  /** Full authored weekly schedule used by Milestone 19 and later. */
  readonly weeklySchedule: readonly NPCScheduleEntry[];
  /** Schema 18 compatibility schedule. New editors should not modify this. */
  readonly schedule: readonly LegacyNPCScheduleEntry[];
  readonly relationships: readonly NPCRelationship[];
  readonly portraitAssetId?: string | null;
  readonly portraitDataUrl?: string | null;
  readonly publicDescription?: string;
  readonly gmNotes?: string;
  readonly tags?: readonly string[];
}
