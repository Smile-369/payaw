import type { BuiltInAnchorOverride, CustomAnchorDefinition } from '../settlement/Anchor';
import type { ZoneType } from '../zoning/Zone';
import type { CustomStoryPointDefinition, StoryEncounterDefinition } from '../../story/StoryObject';
import type { IslandOverride } from '../regional/Island';
import type { BridgeOverride, CustomBridgeDefinition } from '../infrastructure/Bridge';

export enum TerrainSize {
  Small = 'small',
  Medium = 'medium',
  Large = 'large',
}

export enum TownScale {
  Rural = 'rural',
  SemiUrban = 'semi-urban',
  Urban = 'urban',
}

export enum TerrainShape {
  FullIsland = 'full-island',
  Archipelago = 'archipelago',
  TwinIslands = 'twin-islands',
  Peninsula = 'peninsula',
  Inland = 'inland',
  RiverDelta = 'river-delta',
  Atoll = 'atoll',
}

export enum ClimatePreset {
  TropicalRainforest = 'tropical-rainforest',
  TropicalMonsoon = 'tropical-monsoon',
  TropicalSavanna = 'tropical-savanna',
  Temperate = 'temperate',
  Mediterranean = 'mediterranean',
  Boreal = 'boreal',
}

export interface EntityNameOverride {
  readonly id: number;
  readonly name: string;
}

export interface AnchorPositionOverride {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

export interface StoryPositionOverride {
  readonly id: number;
  readonly key?: string;
  readonly x: number;
  readonly y: number;
}

/** A manual zoning instruction. null means explicitly clear zoning on the tile. */
export interface ZoneOverride {
  readonly tileIndex: number;
  readonly zoneType: ZoneType | null;
  readonly locked: boolean;
}

/** Placement and presentation rules for one deterministic story object id. */
export interface StoryRuleOverride {
  readonly id: number;
  readonly key?: string;
  readonly name?: string;
  readonly preferredZone: ZoneType | null;
  readonly allowedZones: readonly ZoneType[];
  readonly disallowedZones: readonly ZoneType[];
  readonly influenceRadius?: number;
  readonly wish?: string;
  readonly manifestation?: string;
  readonly encounters?: readonly StoryEncounterDefinition[];
}

export interface GenerationOptions {
  readonly customAnchors?: readonly CustomAnchorDefinition[];
  readonly builtInAnchorOverrides?: readonly BuiltInAnchorOverride[];
  readonly terrainSize?: TerrainSize;
  readonly townScale?: TownScale;
  readonly terrainShape?: TerrainShape;
  readonly climatePreset?: ClimatePreset;
  readonly roadNameOverrides?: readonly EntityNameOverride[];
  readonly blockNameOverrides?: readonly EntityNameOverride[];
  readonly anchorPositionOverrides?: readonly AnchorPositionOverride[];
  readonly storyPositionOverrides?: readonly StoryPositionOverride[];
  readonly storyRuleOverrides?: readonly StoryRuleOverride[];
  readonly zoneOverrides?: readonly ZoneOverride[];
  readonly customStoryPoints?: readonly CustomStoryPointDefinition[];
  readonly islandOverrides?: readonly IslandOverride[];
  readonly bridgeOverrides?: readonly BridgeOverride[];
  readonly customBridges?: readonly CustomBridgeDefinition[];
}

export interface ResolvedGenerationOptions {
  readonly customAnchors: readonly CustomAnchorDefinition[];
  readonly builtInAnchorOverrides: readonly BuiltInAnchorOverride[];
  readonly terrainSize: TerrainSize;
  readonly townScale: TownScale;
  readonly terrainShape: TerrainShape;
  readonly climatePreset: ClimatePreset;
  readonly roadNameOverrides: readonly EntityNameOverride[];
  readonly blockNameOverrides: readonly EntityNameOverride[];
  readonly anchorPositionOverrides: readonly AnchorPositionOverride[];
  readonly storyPositionOverrides: readonly StoryPositionOverride[];
  readonly storyRuleOverrides: readonly StoryRuleOverride[];
  readonly zoneOverrides: readonly ZoneOverride[];
  readonly customStoryPoints: readonly CustomStoryPointDefinition[];
  readonly islandOverrides: readonly IslandOverride[];
  readonly bridgeOverrides: readonly BridgeOverride[];
  readonly customBridges: readonly CustomBridgeDefinition[];
}

export const DEFAULT_GENERATION_OPTIONS: ResolvedGenerationOptions = {
  customAnchors: [],
  builtInAnchorOverrides: [],
  terrainSize: TerrainSize.Small,
  townScale: TownScale.SemiUrban,
  terrainShape: TerrainShape.FullIsland,
  climatePreset: ClimatePreset.TropicalMonsoon,
  roadNameOverrides: [],
  blockNameOverrides: [],
  anchorPositionOverrides: [],
  storyPositionOverrides: [],
  storyRuleOverrides: [],
  zoneOverrides: [],
  customStoryPoints: [],
  islandOverrides: [],
  bridgeOverrides: [],
  customBridges: [],
};

export function resolveGenerationOptions(options: GenerationOptions = {}): ResolvedGenerationOptions {
  return {
    customAnchors: options.customAnchors ?? DEFAULT_GENERATION_OPTIONS.customAnchors,
    builtInAnchorOverrides: options.builtInAnchorOverrides ?? DEFAULT_GENERATION_OPTIONS.builtInAnchorOverrides,
    terrainSize: options.terrainSize ?? DEFAULT_GENERATION_OPTIONS.terrainSize,
    townScale: options.townScale ?? DEFAULT_GENERATION_OPTIONS.townScale,
    terrainShape: options.terrainShape ?? DEFAULT_GENERATION_OPTIONS.terrainShape,
    climatePreset: options.climatePreset ?? DEFAULT_GENERATION_OPTIONS.climatePreset,
    roadNameOverrides: options.roadNameOverrides ?? DEFAULT_GENERATION_OPTIONS.roadNameOverrides,
    blockNameOverrides: options.blockNameOverrides ?? DEFAULT_GENERATION_OPTIONS.blockNameOverrides,
    anchorPositionOverrides: options.anchorPositionOverrides ?? DEFAULT_GENERATION_OPTIONS.anchorPositionOverrides,
    storyPositionOverrides: options.storyPositionOverrides ?? DEFAULT_GENERATION_OPTIONS.storyPositionOverrides,
    storyRuleOverrides: options.storyRuleOverrides ?? DEFAULT_GENERATION_OPTIONS.storyRuleOverrides,
    zoneOverrides: options.zoneOverrides ?? DEFAULT_GENERATION_OPTIONS.zoneOverrides,
    customStoryPoints: options.customStoryPoints ?? DEFAULT_GENERATION_OPTIONS.customStoryPoints,
    islandOverrides: options.islandOverrides ?? DEFAULT_GENERATION_OPTIONS.islandOverrides,
    bridgeOverrides: options.bridgeOverrides ?? DEFAULT_GENERATION_OPTIONS.bridgeOverrides,
    customBridges: options.customBridges ?? DEFAULT_GENERATION_OPTIONS.customBridges,
  };
}
