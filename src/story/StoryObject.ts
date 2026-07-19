import type { AnchorRegionPreference, AnchorTerrainPreference } from '../engine/settlement/Anchor';
import type { ZoneType } from '../engine/zoning/Zone';

export enum StoryObjectType {
  BaleteTree = 'balete-tree',
  OldSchool = 'old-school',
  AbandonedCinema = 'abandoned-cinema',
  OldCemetery = 'old-cemetery',
  HauntedHouse = 'haunted-house',
  Shrine = 'shrine',
  Ruins = 'ruins',
  ForestHaunt = 'forest-haunt',
  WatersideHaunt = 'waterside-haunt',
  Custom = 'custom',
}

export enum StoryObjectSource {
  BuiltIn = 'built-in',
  Custom = 'custom',
}

export enum EncounterDanger {
  Omen = 'omen',
  Low = 'low',
  Moderate = 'moderate',
  Severe = 'severe',
}

export interface StoryEncounterDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly weight: number;
  readonly danger: EncounterDanger;
}

/** A story landmark authored entirely through the browser UI. */
export interface CustomStoryPointDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: StoryObjectType;
  readonly region: AnchorRegionPreference;
  readonly terrain: AnchorTerrainPreference;
  readonly preferredZone: ZoneType | null;
  readonly allowedZones: readonly ZoneType[];
  readonly disallowedZones: readonly ZoneType[];
  readonly influenceRadius: number;
  readonly minimumDistance: number;
  readonly wish?: string;
  readonly manifestation?: string;
  readonly encounters: readonly StoryEncounterDefinition[];
}

export interface StoryObject {
  readonly id: number;
  readonly key: string;
  readonly source: StoryObjectSource;
  readonly customDefinitionId: string | null;
  readonly type: StoryObjectType;
  readonly name: string;
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
  readonly influenceRadius: number;
  readonly placementScore: number;
  readonly linkedBuildingId: number | null;
  readonly zoneType: ZoneType | null;
  readonly preferredZone: ZoneType | null;
  readonly allowedZones: readonly ZoneType[];
  readonly disallowedZones: readonly ZoneType[];
  readonly wish: string;
  readonly manifestation: string;
  readonly encounters: readonly StoryEncounterDefinition[];
}
