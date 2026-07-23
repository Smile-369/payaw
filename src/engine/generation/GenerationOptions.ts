import type { AuthoredMapFeature, AuthoredSettlementDefinition, GeneratedFeatureOverride, SettlementAuthoringOverride, TerrainTileOverride } from '../../authoring/AuthoringLayer';
import type { BuiltInAnchorOverride, CustomAnchorDefinition } from '../settlement/Anchor';
import type { ZoneType } from '../zoning/Zone';
import type { CustomStoryPointDefinition, StoryEncounterDefinition } from '../../story/StoryObject';
import type { IslandOverride } from '../regional/Island';
import type { BridgeOverride, CustomBridgeDefinition } from '../infrastructure/Bridge';
import type { PortOverride, CustomPortDefinition } from '../infrastructure/Port';

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
  SingleSmallIsland = 'single-small-island',
  SingleMediumIsland = 'single-medium-island',
  SingleLargeIsland = 'single-large-island',
  Archipelago = 'archipelago',
  TwinIslands = 'twin-islands',
  Peninsula = 'peninsula',
  InlandCoast = 'inland-coast',
  Delta = 'delta',
  /** Legacy values retained so older project JSON can still be imported. */
  LegacyFullIsland = 'full-island',
  LegacyInland = 'inland',
  LegacyRiverDelta = 'river-delta',
  LegacyAtoll = 'atoll',
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

/** Manual position for a generated regional settlement. */
export interface SettlementPositionOverride {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** Stable destination island identity. Older files may omit this and infer it from x/y. */
  readonly islandKey?: string;
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
  /** Non-destructive removal used by the GM story-point editor. */
  readonly suppressed?: boolean;
}

export interface GenerationOptions {
  readonly customAnchors?: readonly CustomAnchorDefinition[];
  readonly builtInAnchorOverrides?: readonly BuiltInAnchorOverride[];
  readonly terrainSize?: TerrainSize;
  readonly townScale?: TownScale;
  readonly terrainShape?: TerrainShape;
  readonly climatePreset?: ClimatePreset;
  readonly islandCount?: number;
  readonly islandSpacingKilometers?: number;
  readonly satelliteSettlementCount?: number;
  readonly roadNameOverrides?: readonly EntityNameOverride[];
  readonly blockNameOverrides?: readonly EntityNameOverride[];
  readonly anchorPositionOverrides?: readonly AnchorPositionOverride[];
  readonly storyPositionOverrides?: readonly StoryPositionOverride[];
  readonly settlementPositionOverrides?: readonly SettlementPositionOverride[];
  readonly authoredSettlements?: readonly AuthoredSettlementDefinition[];
  readonly settlementAuthoringOverrides?: readonly SettlementAuthoringOverride[];
  readonly terrainOverrides?: readonly TerrainTileOverride[];
  readonly generatedFeatureOverrides?: readonly GeneratedFeatureOverride[];
  readonly authoredFeatures?: readonly AuthoredMapFeature[];
  readonly storyRuleOverrides?: readonly StoryRuleOverride[];
  readonly zoneOverrides?: readonly ZoneOverride[];
  readonly customStoryPoints?: readonly CustomStoryPointDefinition[];
  readonly islandOverrides?: readonly IslandOverride[];
  readonly bridgeOverrides?: readonly BridgeOverride[];
  readonly customBridges?: readonly CustomBridgeDefinition[];
  readonly portOverrides?: readonly PortOverride[];
  readonly customPorts?: readonly CustomPortDefinition[];
}

export interface ResolvedGenerationOptions {
  readonly customAnchors: readonly CustomAnchorDefinition[];
  readonly builtInAnchorOverrides: readonly BuiltInAnchorOverride[];
  readonly terrainSize: TerrainSize;
  readonly townScale: TownScale;
  readonly terrainShape: TerrainShape;
  readonly climatePreset: ClimatePreset;
  readonly islandCount: number;
  readonly islandSpacingKilometers: number;
  readonly satelliteSettlementCount: number;
  readonly roadNameOverrides: readonly EntityNameOverride[];
  readonly blockNameOverrides: readonly EntityNameOverride[];
  readonly anchorPositionOverrides: readonly AnchorPositionOverride[];
  readonly storyPositionOverrides: readonly StoryPositionOverride[];
  readonly settlementPositionOverrides: readonly SettlementPositionOverride[];
  readonly authoredSettlements: readonly AuthoredSettlementDefinition[];
  readonly settlementAuthoringOverrides: readonly SettlementAuthoringOverride[];
  readonly terrainOverrides: readonly TerrainTileOverride[];
  readonly generatedFeatureOverrides: readonly GeneratedFeatureOverride[];
  readonly authoredFeatures: readonly AuthoredMapFeature[];
  readonly storyRuleOverrides: readonly StoryRuleOverride[];
  readonly zoneOverrides: readonly ZoneOverride[];
  readonly customStoryPoints: readonly CustomStoryPointDefinition[];
  readonly islandOverrides: readonly IslandOverride[];
  readonly bridgeOverrides: readonly BridgeOverride[];
  readonly customBridges: readonly CustomBridgeDefinition[];
  readonly portOverrides: readonly PortOverride[];
  readonly customPorts: readonly CustomPortDefinition[];
}

export const DEFAULT_GENERATION_OPTIONS: ResolvedGenerationOptions = {
  customAnchors: [],
  builtInAnchorOverrides: [],
  terrainSize: TerrainSize.Small,
  townScale: TownScale.SemiUrban,
  terrainShape: TerrainShape.SingleLargeIsland,
  climatePreset: ClimatePreset.TropicalMonsoon,
  islandCount: 5,
  islandSpacingKilometers: 4,
  satelliteSettlementCount: 4,
  roadNameOverrides: [],
  blockNameOverrides: [],
  anchorPositionOverrides: [],
  storyPositionOverrides: [],
  settlementPositionOverrides: [],
  authoredSettlements: [],
  settlementAuthoringOverrides: [],
  terrainOverrides: [],
  generatedFeatureOverrides: [],
  authoredFeatures: [],
  storyRuleOverrides: [],
  zoneOverrides: [],
  customStoryPoints: [],
  islandOverrides: [],
  bridgeOverrides: [],
  customBridges: [],
  portOverrides: [],
  customPorts: [],
};

export function resolveGenerationOptions(options: GenerationOptions = {}): ResolvedGenerationOptions {
  return {
    customAnchors: options.customAnchors ?? DEFAULT_GENERATION_OPTIONS.customAnchors,
    builtInAnchorOverrides: options.builtInAnchorOverrides ?? DEFAULT_GENERATION_OPTIONS.builtInAnchorOverrides,
    terrainSize: options.terrainSize ?? DEFAULT_GENERATION_OPTIONS.terrainSize,
    townScale: options.townScale ?? DEFAULT_GENERATION_OPTIONS.townScale,
    terrainShape: options.terrainShape ?? DEFAULT_GENERATION_OPTIONS.terrainShape,
    climatePreset: options.climatePreset ?? DEFAULT_GENERATION_OPTIONS.climatePreset,
    islandCount: Math.max(1, Math.min(12, Math.round(options.islandCount ?? DEFAULT_GENERATION_OPTIONS.islandCount))),
    islandSpacingKilometers: Math.max(0.5, Math.min(12, options.islandSpacingKilometers ?? DEFAULT_GENERATION_OPTIONS.islandSpacingKilometers)),
    satelliteSettlementCount: Math.max(0, Math.min(12, Math.round(options.satelliteSettlementCount ?? DEFAULT_GENERATION_OPTIONS.satelliteSettlementCount))),
    roadNameOverrides: options.roadNameOverrides ?? DEFAULT_GENERATION_OPTIONS.roadNameOverrides,
    blockNameOverrides: options.blockNameOverrides ?? DEFAULT_GENERATION_OPTIONS.blockNameOverrides,
    anchorPositionOverrides: options.anchorPositionOverrides ?? DEFAULT_GENERATION_OPTIONS.anchorPositionOverrides,
    storyPositionOverrides: options.storyPositionOverrides ?? DEFAULT_GENERATION_OPTIONS.storyPositionOverrides,
    settlementPositionOverrides: options.settlementPositionOverrides ?? DEFAULT_GENERATION_OPTIONS.settlementPositionOverrides,
    authoredSettlements: options.authoredSettlements ?? DEFAULT_GENERATION_OPTIONS.authoredSettlements,
    settlementAuthoringOverrides: options.settlementAuthoringOverrides ?? DEFAULT_GENERATION_OPTIONS.settlementAuthoringOverrides,
    terrainOverrides: options.terrainOverrides ?? DEFAULT_GENERATION_OPTIONS.terrainOverrides,
    generatedFeatureOverrides: options.generatedFeatureOverrides ?? DEFAULT_GENERATION_OPTIONS.generatedFeatureOverrides,
    authoredFeatures: options.authoredFeatures ?? DEFAULT_GENERATION_OPTIONS.authoredFeatures,
    storyRuleOverrides: options.storyRuleOverrides ?? DEFAULT_GENERATION_OPTIONS.storyRuleOverrides,
    zoneOverrides: options.zoneOverrides ?? DEFAULT_GENERATION_OPTIONS.zoneOverrides,
    customStoryPoints: options.customStoryPoints ?? DEFAULT_GENERATION_OPTIONS.customStoryPoints,
    islandOverrides: options.islandOverrides ?? DEFAULT_GENERATION_OPTIONS.islandOverrides,
    bridgeOverrides: options.bridgeOverrides ?? DEFAULT_GENERATION_OPTIONS.bridgeOverrides,
    customBridges: options.customBridges ?? DEFAULT_GENERATION_OPTIONS.customBridges,
    portOverrides: options.portOverrides ?? DEFAULT_GENERATION_OPTIONS.portOverrides,
    customPorts: options.customPorts ?? DEFAULT_GENERATION_OPTIONS.customPorts,
  };
}
