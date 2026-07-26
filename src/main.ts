import { AssetRepository, loadImage, readFileAsDataUrl } from './customization/AssetRepository';
import {
  EMPTY_AUTHORING_LAYER,
  normalizeHexColor,
  type AuthoredMapFeature,
  type AuthoredSettlementDefinition,
  type GeneratedFeatureOverride,
  type AuthoringFeatureCategory,
  type AuthoringGeometry,
  type AuthoringLayerState,
  type AuthoringPoint,
  type AuthoringRealityLayer,
  type AuthoringVisibility,
  type SettlementAuthoringOverride,
  type SettlementKind,
  type TerrainTileOverride,
} from './authoring/AuthoringLayer';
import { transformAuthoringGeometry } from './authoring/AuthoringGeometry';
import {
  CAMPAIGN_DAYS,
  EMPTY_NPC_LOCATION_AUTHORING,
  applyNpcLocationAuthoring,
  collectCampaignLocations,
  isResidentialBuilding,
  normalizeNpcLocationAuthoring,
  scheduleLocationFromRef,
  resolveNpcPlacement,
  validateNpcHome,
  validateSchedule,
  venueStatusAt,
  type AuthoredLocationRecord,
  type AuthoredNPCDefinition,
  type NPCLocationAuthoringState,
  type NPCProfileOverride,
  type NPCScenePlacement,
  type NPCTemporaryOverride,
  type VenueHoursEntry,
} from './campaign/NPCLocationAuthoring';
import {
  createCampaign,
  normalizeCampaignState,
  type CampaignState,
} from './campaign/CampaignSystem';
import {
  createNpcJsonBundle,
  parseNpcJsonBundle,
  withSettlementNames,
  type NpcJsonBundle,
  type PortableNpcRecord,
} from './campaign/NpcJson';
import { CampaignStudio, type CampaignStudioOption } from './campaign/CampaignStudio';
import { GmPlayerPreview } from './player/GmPlayerPreview';
import { readNetcodeConfig } from './netcode/NetcodeConfig';
import {
  createDefaultPlayerViewState,
  normalizePlayerViewState,
  type PlayerViewState,
} from './player/PlayerViewState';
import {
  AssetTargetCategory,
  DEFAULT_LABEL_DISPLAY_SETTINGS,
  EMPTY_RENDER_CUSTOMIZATION,
  type ImportedImageAsset,
  type LabelDisplaySettings,
  type PlacedImage,
  type RuntimeImageAsset,
  type StoredMapCustomization,
} from './customization/Customization';
import { ASSET_CATEGORY_LABELS, assetTargetsFor, describeAssetTarget } from './customization/AssetTargets';
import { DEFAULT_GENERATION_CONFIG } from './engine/config/GenerationConfig';
import { GenerationPipeline } from './engine/generation/GenerationPipeline';
import { GenerationWorkerClient } from './browser/GenerationWorkerClient';
import { GenerationCancelledError, type GenerationProgress } from './engine/generation/GenerationScheduler';
import { InvalidPositionOverrideError } from './engine/generation/InvalidPositionOverrideError';
import { recoverPositionOverrides } from './engine/generation/PositionOverrideRecovery';
import {
  ClimatePreset,
  TerrainShape,
  TerrainSize,
  TownScale,
  type AnchorPositionOverride,
  type EntityNameOverride,
  type GenerationOptions,
  type SettlementPositionOverride,
  type StoryPositionOverride,
  type StoryRuleOverride,
  type ZoneOverride,
} from './engine/generation/GenerationOptions';
import { Camera } from './engine/renderer/Camera';
import { CanvasRenderer, rasterCacheLayersForStage } from './engine/renderer/CanvasRenderer';
import { RenderLayer } from './engine/renderer/Layers';
import { GM_MAP_VIEW_PRESETS } from './engine/renderer/MapViewPresets';
import {
  ANCHOR_LABELS,
  AnchorProximityBand,
  AnchorRegionPreference,
  AnchorTerrainPreference,
  BUILT_IN_ANCHOR_TYPES,
  type AnchorRuleSettings,
  type BuiltInAnchorOverride,
  type BuiltInAnchorType,
  type CustomAnchorDefinition,
} from './engine/settlement/Anchor';
import { createDefaultBuiltInAnchorDefinitions } from './engine/settlement/AnchorRules';
import { TerrainType, WaterType } from './engine/world/Tile';
import { SeededRandom } from './engine/rng/Random';
import { generateNPCPopulation } from './engine/npc/NPCGenerator';
import { NPCStatus, type CampaignDay, type NPC, type NPCRelationship, type NPCScheduleEntry, type NPCSchedulePeriod } from './engine/npc/NPC';
import { npcScheduleEntryForPeriod, npcSchedulePeriodForDate, npcSchedulePeriodForTimestamp } from './engine/time/WorldClock';
import { WorldSimulation } from './engine/simulation/WorldSimulation';
import { normalizeSimulationTimezone } from './engine/simulation/SimulationClock';
import { weatherLabel } from './engine/simulation/WeatherSystem';
import type {
  InfrastructureOperationalState,
  SimulationClockMode,
  SimulationSpeed,
  SimulationEvent,
  StoredSimulationState,
  WeatherCondition,
} from './engine/simulation/SimulationTypes';
import { DevelopmentLevel, IslandRole, type IslandOverride } from './engine/regional/Island';
import { findNearestValidSettlementTile } from './engine/regional/SettlementGenerator';
import { BRIDGE_TYPE_LABELS, BridgeType, type BridgeOverride, type CustomBridgeDefinition } from './engine/infrastructure/Bridge';
import { RoadType, type Road } from './engine/infrastructure/Road';
import type { Building } from './engine/buildings/Building';
import { PORT_TYPE_LABELS, PortType, type PortOverride, type CustomPortDefinition } from './engine/infrastructure/Port';
import { brushIndices, floodFillIndices, rectangleIndices, setZoneOverrides, smoothZoneOverrides, type ZoneTool } from './editor/ZoneEditor';
import { HistoryManager } from './editor/HistoryManager';
import {
  MAX_CUSTOM_ANCHORS,
  MAX_CUSTOM_STORY_POINTS,
  finiteSetting,
  formatEncounterLines,
  isEnumValue,
  loadAnchorState,
  loadCustomStoryDefinitions,
  loadLabelSettings,
  loadNameState,
  loadProfile,
  normalizeAnchorState,
  normalizeCustomStoryDefinition,
  normalizeEncounter,
  normalizeLabelSettings,
  normalizeStoredProfile,
  parseEncounterLines,
  saveAnchorState,
  saveCustomStoryDefinitions,
  saveLabelSettings,
  saveNameState,
  saveProfile,
  validNameOverrides,
  type StoredProfile,
} from './editor/EditorStatePersistence';
import { World } from './engine/world/World';
import { ZoneType } from './engine/zoning/Zone';
import { pickWeightedEncounter } from './story/EncounterGenerator';
import { StoryObjectSource, StoryObjectType, type CustomStoryPointDefinition, type StoryEncounterDefinition } from './story/StoryObject';
import {
  TrafficProfile,
  TravelMode,
  collectTravelLocations,
  findTravelLocation,
  formatTravelDuration,
  planTravel,
  planTravelAlternatives,
  pointTravelLocation,
  type TravelLocation,
  type TravelPlan,
} from './engine/travel/TravelPlanner';


const MAP_CUSTOMIZATION_STORAGE_KEY = 'payaw.map-customization.v2';
const SATELLITE_SETTLEMENT_COUNT = 0;
const WORKSPACE_STORAGE_KEY = 'payaw.workspace.v1';
const UI_THEME_STORAGE_KEY = 'payaw.ui-theme.v1';
const UI_LEFT_PANEL_STORAGE_KEY = 'payaw.ui-left-panel.v1';
const UI_STUDIO_DOCK_STORAGE_KEY = 'payaw.ui-studio-dock.v1';
const UI_STUDIO_TAB_STORAGE_KEY = 'payaw.ui-studio-tab.v1';
const UI_MINIMAP_STORAGE_KEY = 'payaw.ui-minimap.v1';
const SESSION_AUTOSAVE_STORAGE_KEY = 'payaw.session-autosave.v1';
const RECENT_PROJECTS_STORAGE_KEY = 'payaw.recent-projects.v1';
const CLOCK_FORMAT_STORAGE_KEY = 'payaw.clock-format.v1';

type MapCustomizationByWorld = Readonly<Record<string, StoredMapCustomization>>;

interface EditorSnapshot {
  readonly customAnchors: readonly CustomAnchorDefinition[];
  readonly builtInOverrides: readonly BuiltInAnchorOverride[];
  readonly customStoryPoints: readonly CustomStoryPointDefinition[];
  readonly roadNames: readonly EntityNameOverride[];
  readonly blockNames: readonly EntityNameOverride[];
  readonly labels: LabelDisplaySettings;
  readonly mapCustomization: StoredMapCustomization;
}


function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Required UI element not found: ${selector}`);
  return element;
}

function createCryptoSeed(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `payaw-${(values[0] ?? 0).toString(36)}-${(values[1] ?? 0).toString(36)}`;
}

function createRuleId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const values = new Uint32Array(3);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(36)).join('-');
}

function worldCustomizationPayload(customization: StoredMapCustomization): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...customization };
  delete payload.npcLocationAuthoring;
  return payload;
}

function createProjectPayload(
  world: World,
  customization: StoredMapCustomization,
  assets: readonly ImportedImageAsset[],
  labels: LabelDisplaySettings,
  customStoryPoints: readonly CustomStoryPointDefinition[],
): Record<string, unknown> {
  const profile: StoredProfile = {
    terrainSize: world.metadata.terrainSize,
    townScale: world.metadata.townScale,
    terrainShape: world.metadata.terrainShape,
    climatePreset: world.metadata.climatePreset,
    islandCount: world.metadata.targetIslandCount,
    islandSpacingKilometers: world.metadata.islandSpacingKilometers,
    satelliteSettlementCount: world.metadata.satelliteSettlementCount,
  };
  const authoring = {
    customAnchors,
    builtInAnchorOverrides: builtInOverrides,
    roadNames: roadNameOverrides,
    blockNames: blockNameOverrides,
    labelDisplay: labels,
    customStoryPoints,
    campaign: campaignState,
    playerView: playerViewState,
    simulation: simulation?.serialize(),
    customization: worldCustomizationPayload(customization),
    imageAssets: assets,
  };
  return {
    format: 'payaw-project',
    projectVersion: 2,
    metadata: {
      schemaVersion: world.metadata.schemaVersion,
      generationVersion: world.metadata.generationVersion,
      exportKind: 'compact-recipe',
    },
    project: { seed: world.seed, profile, authoring },
  };
}

function createHostedCampaignPayload(): Readonly<Record<string, unknown>> {
  const profile: StoredProfile = {
    terrainSize: world.metadata.terrainSize,
    townScale: world.metadata.townScale,
    terrainShape: world.metadata.terrainShape,
    climatePreset: world.metadata.climatePreset,
    islandCount: world.metadata.targetIslandCount,
    islandSpacingKilometers: world.metadata.islandSpacingKilometers,
    satelliteSettlementCount: world.metadata.satelliteSettlementCount,
  };
  const customization = currentMapCustomization();
  return {
    format: 'payaw-hosted-campaign',
    projectVersion: 1,
    metadata: {
      schemaVersion: 20,
      generationVersion: world.metadata.generationVersion,
    },
    project: {
      seed: world.seed,
      profile,
      authoring: {
        customAnchors,
        builtInAnchorOverrides: builtInOverrides,
        roadNames: roadNameOverrides,
        blockNames: blockNameOverrides,
        labelDisplay: labelSettings,
        customStoryPoints: customStoryDefinitions,
        npcRosterSize: world.npcs.length,
        npcLocationAuthoring,
        campaign: campaignState,
        playerView: playerViewState,
        simulation: simulation?.serialize(),
        customization,
      },
    },
    campaign: campaignState,
    playerView: playerViewState,
    checkpointedAt: new Date().toISOString(),
  };
}

function downloadWorld(
  world: World,
  customization: StoredMapCustomization,
  assets: readonly ImportedImageAsset[],
  labels: LabelDisplaySettings,
  customStoryPoints: readonly CustomStoryPointDefinition[],
): void {
  const json = JSON.stringify(createProjectPayload(world, customization, assets, labels, customStoryPoints), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${world.seed.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.world.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function emptyMapCustomization(): StoredMapCustomization {
  return {
    anchorPositions: [], settlementPositions: [], storyPositions: [], storyRules: [], zoneOverrides: [], placedImages: [],
    islandOverrides: [], bridgeOverrides: [], customBridges: [], portOverrides: [], customPorts: [],
    authoringLayer: structuredClone(EMPTY_AUTHORING_LAYER), npcLocationAuthoring: structuredClone(EMPTY_NPC_LOCATION_AUTHORING),
  };
}

const SETTLEMENT_KINDS: readonly SettlementKind[] = ['city', 'town', 'barangay', 'subdivision', 'neighborhood', 'village', 'sitio', 'district', 'compound', 'custom'];
const AUTHORING_CATEGORIES: readonly AuthoringFeatureCategory[] = ['terrain', 'river', 'road', 'building', 'district', 'landmark', 'infrastructure', 'natural', 'label', 'hidden-payaw'];
const AUTHORING_VISIBILITIES: readonly AuthoringVisibility[] = ['gm-only', 'players', 'hidden'];
const AUTHORING_REALITY_LAYERS: readonly AuthoringRealityLayer[] = ['normal', 'hidden-payaw'];

function normalizeAuthoringPoint(value: unknown): AuthoringPoint | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const x = Number(item.x);
  const y = Number(item.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

function normalizeAuthoringGeometry(value: unknown): AuthoringGeometry | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  if (item.kind === 'point') {
    const point = normalizeAuthoringPoint(item.point);
    return point === undefined ? undefined : { kind: 'point', point };
  }
  if (item.kind === 'circle') {
    const center = normalizeAuthoringPoint(item.center);
    const radius = Number(item.radius);
    return center === undefined || !Number.isFinite(radius) ? undefined : { kind: 'circle', center, radius: Math.max(0.5, Math.min(200, radius)) };
  }
  if (item.kind === 'polyline' || item.kind === 'polygon') {
    const points = Array.isArray(item.points) ? item.points.flatMap((point) => normalizeAuthoringPoint(point) ?? []).slice(0, 512) : [];
    const minimum = item.kind === 'polygon' ? 3 : 2;
    return points.length < minimum ? undefined : { kind: item.kind, points };
  }
  return undefined;
}

function normalizeAuthoringLayer(value: unknown): AuthoringLayerState {
  if (typeof value !== 'object' || value === null) return structuredClone(EMPTY_AUTHORING_LAYER);
  const item = value as Record<string, unknown>;
  const authoredSettlements: AuthoredSettlementDefinition[] = Array.isArray(item.authoredSettlements)
    ? item.authoredSettlements.flatMap((candidate) => {
      if (typeof candidate !== 'object' || candidate === null) return [];
      const settlement = candidate as Record<string, unknown>;
      const key = typeof settlement.key === 'string' ? settlement.key.trim() : '';
      const name = typeof settlement.name === 'string' ? settlement.name.trim() : '';
      const kind = SETTLEMENT_KINDS.includes(settlement.kind as SettlementKind) ? settlement.kind as SettlementKind : 'barangay';
      const x = Number(settlement.x);
      const y = Number(settlement.y);
      if (key.length === 0 || name.length === 0 || !Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [{
        key,
        name,
        kind,
        x,
        y,
        radius: Math.max(2, Math.min(100, Number(settlement.radius) || 10)),
        rotation: Number.isFinite(Number(settlement.rotation)) ? Number(settlement.rotation) : 0,
        populationTarget: Math.max(0, Math.min(500_000, Math.round(Number(settlement.populationTarget) || 500))),
        density: Math.max(0, Math.min(1, Number(settlement.density) || 0.55)),
        parentKey: typeof settlement.parentKey === 'string' ? settlement.parentKey : null,
        generateRoads: settlement.generateRoads !== false,
        generateBuildings: settlement.generateBuildings !== false,
        locked: settlement.locked === true,
        hidden: settlement.hidden === true,
        visibility: AUTHORING_VISIBILITIES.includes(settlement.visibility as AuthoringVisibility) ? settlement.visibility as AuthoringVisibility : 'players',
        notes: typeof settlement.notes === 'string' ? settlement.notes.slice(0, 4000) : '',
      }];
    }).slice(0, 128)
    : [];
  const settlementOverrides: SettlementAuthoringOverride[] = Array.isArray(item.settlementOverrides)
    ? item.settlementOverrides.flatMap((candidate) => {
      if (typeof candidate !== 'object' || candidate === null) return [];
      const override = candidate as Record<string, unknown>;
      const key = typeof override.key === 'string' ? override.key.trim() : '';
      if (key.length === 0) return [];
      return [{
        key,
        name: typeof override.name === 'string' ? override.name.slice(0, 100) : undefined,
        kind: SETTLEMENT_KINDS.includes(override.kind as SettlementKind) ? override.kind as SettlementKind : undefined,
        x: Number.isFinite(Number(override.x)) ? Number(override.x) : undefined,
        y: Number.isFinite(Number(override.y)) ? Number(override.y) : undefined,
        radius: Number.isFinite(Number(override.radius)) ? Math.max(2, Math.min(100, Number(override.radius))) : undefined,
        rotation: Number.isFinite(Number(override.rotation)) ? Number(override.rotation) : undefined,
        populationTarget: Number.isFinite(Number(override.populationTarget)) ? Math.max(0, Math.min(500_000, Math.round(Number(override.populationTarget)))) : undefined,
        density: Number.isFinite(Number(override.density)) ? Math.max(0, Math.min(1, Number(override.density))) : undefined,
        generateRoads: typeof override.generateRoads === 'boolean' ? override.generateRoads : undefined,
        generateBuildings: typeof override.generateBuildings === 'boolean' ? override.generateBuildings : undefined,
        parentKey: override.parentKey === null || typeof override.parentKey === 'string' ? override.parentKey as string | null : undefined,
        locked: typeof override.locked === 'boolean' ? override.locked : undefined,
        hidden: typeof override.hidden === 'boolean' ? override.hidden : undefined,
        visibility: AUTHORING_VISIBILITIES.includes(override.visibility as AuthoringVisibility) ? override.visibility as AuthoringVisibility : undefined,
        suppressed: typeof override.suppressed === 'boolean' ? override.suppressed : undefined,
        notes: typeof override.notes === 'string' ? override.notes.slice(0, 4000) : undefined,
      }];
    }).slice(0, 256)
    : [];
  const terrainOverrides: TerrainTileOverride[] = Array.isArray(item.terrainOverrides)
    ? item.terrainOverrides.flatMap((candidate) => {
      if (typeof candidate !== 'object' || candidate === null) return [];
      const override = candidate as Record<string, unknown>;
      const tileIndex = Number(override.tileIndex);
      if (!Number.isInteger(tileIndex) || tileIndex < 0) return [];
      return [{
        tileIndex,
        terrain: isEnumValue(Object.values(TerrainType), override.terrain) ? override.terrain : undefined,
        water: isEnumValue(Object.values(WaterType), override.water) ? override.water : undefined,
        elevation: Number.isFinite(Number(override.elevation)) ? Number(override.elevation) : undefined,
        elevationDelta: Number.isFinite(Number(override.elevationDelta)) ? Number(override.elevationDelta) : undefined,
        moisture: Number.isFinite(Number(override.moisture)) ? Number(override.moisture) : undefined,
        forestDensity: Number.isFinite(Number(override.forestDensity)) ? Number(override.forestDensity) : undefined,
        floodRisk: Number.isFinite(Number(override.floodRisk)) ? Number(override.floodRisk) : undefined,
        river: typeof override.river === 'boolean' ? override.river : undefined,
        locked: override.locked === true,
      }];
    }).slice(0, 50_000)
    : [];
  const generatedFeatureOverrides = Array.isArray(item.generatedFeatureOverrides)
    ? item.generatedFeatureOverrides.filter((candidate) => typeof candidate === 'object' && candidate !== null && typeof (candidate as { key?: unknown }).key === 'string').slice(0, 1024) as AuthoringLayerState['generatedFeatureOverrides']
    : [];
  const features: AuthoredMapFeature[] = Array.isArray(item.features)
    ? item.features.flatMap((candidate) => {
      if (typeof candidate !== 'object' || candidate === null) return [];
      const feature = candidate as Record<string, unknown>;
      const id = typeof feature.id === 'string' ? feature.id.trim() : '';
      const geometry = normalizeAuthoringGeometry(feature.geometry);
      if (id.length === 0 || geometry === undefined || !AUTHORING_CATEGORIES.includes(feature.category as AuthoringFeatureCategory)) return [];
      const createdAt = typeof feature.createdAt === 'string' ? feature.createdAt : new Date().toISOString();
      return [{
        id,
        name: typeof feature.name === 'string' ? feature.name.trim().slice(0, 120) : 'Authored feature',
        category: feature.category as AuthoringFeatureCategory,
        subtype: typeof feature.subtype === 'string' ? feature.subtype.trim().slice(0, 80) : 'custom',
        geometry,
        realityLayer: AUTHORING_REALITY_LAYERS.includes(feature.realityLayer as AuthoringRealityLayer) ? feature.realityLayer as AuthoringRealityLayer : 'normal',
        visibility: AUTHORING_VISIBILITIES.includes(feature.visibility as AuthoringVisibility) ? feature.visibility as AuthoringVisibility : 'gm-only',
        locked: feature.locked === true,
        hidden: feature.hidden === true,
        opacity: Math.max(0.08, Math.min(1, Number(feature.opacity) || 0.9)),
        lineWidth: Math.max(0.25, Math.min(12, Number(feature.lineWidth) || 2)),
        fillOpacity: Math.max(0, Math.min(0.8, Number(feature.fillOpacity) || 0.18)),
        color: normalizeHexColor(typeof feature.color === 'string' ? feature.color : null),
        rotation: Number.isFinite(Number(feature.rotation)) ? Number(feature.rotation) : 0,
        scale: Math.max(0.1, Math.min(20, Number(feature.scale) || 1)),
        aliases: Array.isArray(feature.aliases) ? feature.aliases.filter((alias): alias is string => typeof alias === 'string').map((alias) => alias.slice(0, 100)).slice(0, 12) : [],
        tags: Array.isArray(feature.tags) ? feature.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.slice(0, 60)).slice(0, 24) : [],
        notes: typeof feature.notes === 'string' ? feature.notes.slice(0, 8000) : '',
        createdAt,
        updatedAt: typeof feature.updatedAt === 'string' ? feature.updatedAt : createdAt,
      }];
    }).slice(0, 2000)
    : [];
  void terrainOverrides;
  void generatedFeatureOverrides;
  const pointAnchors = features.filter((feature) => feature.category === 'landmark' && feature.subtype === 'anchor-point' && feature.geometry.kind === 'point');
  return {
    authoredSettlements,
    settlementOverrides,
    terrainOverrides: [],
    generatedFeatureOverrides: [],
    features: pointAnchors,
  };
}


function loadAllMapCustomizations(): MapCustomizationByWorld {
  try {
    const raw = localStorage.getItem(MAP_CUSTOMIZATION_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed as MapCustomizationByWorld : {};
  } catch {
    return {};
  }
}

function normalizeMapCustomization(value: unknown): StoredMapCustomization {
  if (typeof value !== 'object' || value === null) return emptyMapCustomization();
  const stored = value as Partial<StoredMapCustomization>;
  const anchorPositions = Array.isArray(stored.anchorPositions)
    ? stored.anchorPositions.filter((item) => typeof item.key === 'string' && Number.isFinite(item.x) && Number.isFinite(item.y))
    : [];
  const settlementPositions = Array.isArray(stored.settlementPositions)
    ? stored.settlementPositions.filter((item) => typeof item.key === 'string' && Number.isFinite(item.x) && Number.isFinite(item.y) && (item.islandKey === undefined || typeof item.islandKey === 'string'))
    : [];
  const storyPositions = Array.isArray(stored.storyPositions)
    ? stored.storyPositions.filter((item) => Number.isInteger(item.id) && item.id >= 0 && (item.key === undefined || typeof item.key === 'string') && Number.isFinite(item.x) && Number.isFinite(item.y))
    : [];
  const storyRules = Array.isArray(stored.storyRules)
    ? stored.storyRules.filter((item) => (
      Number.isInteger(item.id)
      && item.id >= 0
      && (item.name === undefined || typeof item.name === 'string')
      && (item.preferredZone === null || isEnumValue(Object.values(ZoneType), item.preferredZone))
      && Array.isArray(item.allowedZones)
      && item.allowedZones.every((zone: unknown) => isEnumValue(Object.values(ZoneType), zone))
      && Array.isArray(item.disallowedZones)
      && item.disallowedZones.every((zone: unknown) => isEnumValue(Object.values(ZoneType), zone))
      && (item.key === undefined || typeof item.key === 'string')
      && (item.influenceRadius === undefined || Number.isFinite(item.influenceRadius))
      && (item.wish === undefined || typeof item.wish === 'string')
      && (item.manifestation === undefined || typeof item.manifestation === 'string')
      && (item.encounters === undefined || (Array.isArray(item.encounters) && item.encounters.every((encounter: unknown, index: number) => normalizeEncounter(encounter, index) !== undefined)))
      && (item.suppressed === undefined || typeof item.suppressed === 'boolean')
    ))
    : [];
  const zoneOverrides = Array.isArray(stored.zoneOverrides)
    ? stored.zoneOverrides.filter((item) => (
      Number.isInteger(item.tileIndex)
      && item.tileIndex >= 0
      && (item.zoneType === null || isEnumValue(Object.values(ZoneType), item.zoneType))
      && typeof item.locked === 'boolean'
    ))
    : [];
  const placedImages = Array.isArray(stored.placedImages)
    ? stored.placedImages.filter((item) => (
      typeof item.id === 'string'
      && typeof item.assetId === 'string'
      && typeof item.name === 'string'
      && Number.isFinite(item.x)
      && Number.isFinite(item.y)
      && Number.isFinite(item.width)
      && item.width > 0
      && Number.isFinite(item.height)
      && item.height > 0
      && Number.isFinite(item.rotation)
      && Number.isFinite(item.opacity)
      && Number.isFinite(item.zIndex)
    ))
    : [];
  const islandOverrides = Array.isArray(stored.islandOverrides)
    ? stored.islandOverrides.filter((item) => (
      typeof item.key === 'string'
      && (item.name === undefined || typeof item.name === 'string')
      && (item.role === undefined || isEnumValue(Object.values(IslandRole), item.role))
      && (item.developmentLevel === undefined || isEnumValue(Object.values(DevelopmentLevel), item.developmentLevel))
      && (item.populationWeight === undefined || Number.isFinite(item.populationWeight))
      && (item.settlementCount === undefined || Number.isFinite(item.settlementCount))
    ))
    : [];
  const validPoint = (value: unknown): value is { readonly x: number; readonly y: number } => (
    typeof value === 'object' && value !== null
    && Number.isFinite((value as { x?: unknown }).x)
    && Number.isFinite((value as { y?: unknown }).y)
  );
  const bridgeOverrides = Array.isArray(stored.bridgeOverrides)
    ? stored.bridgeOverrides.filter((item) => (
      typeof item.key === 'string'
      && (item.name === undefined || typeof item.name === 'string')
      && (item.type === undefined || isEnumValue(Object.values(BridgeType), item.type))
      && (item.roadClass === undefined || isEnumValue(Object.values(RoadType), item.roadClass))
      && (item.deckWidth === undefined || Number.isFinite(item.deckWidth))
      && (item.clearance === undefined || Number.isFinite(item.clearance))
      && (item.start === undefined || validPoint(item.start))
      && (item.end === undefined || validPoint(item.end))
      && (item.locked === undefined || typeof item.locked === 'boolean')
      && (item.suppressed === undefined || typeof item.suppressed === 'boolean')
    ))
    : [];
  const customBridges = Array.isArray(stored.customBridges)
    ? stored.customBridges.filter((item) => (
      typeof item.key === 'string'
      && typeof item.name === 'string'
      && typeof item.fromIslandKey === 'string'
      && typeof item.toIslandKey === 'string'
      && isEnumValue(Object.values(BridgeType), item.type)
      && isEnumValue(Object.values(RoadType), item.roadClass)
      && Number.isFinite(item.deckWidth)
      && Number.isFinite(item.clearance)
      && (item.start === undefined || validPoint(item.start))
      && (item.end === undefined || validPoint(item.end))
      && typeof item.locked === 'boolean'
    ))
    : [];
  const portOverrides = Array.isArray(stored.portOverrides)
    ? stored.portOverrides.filter((item) => (
      typeof item.key === 'string'
      && (item.name === undefined || typeof item.name === 'string')
      && (item.type === undefined || isEnumValue(Object.values(PortType), item.type))
      && (item.capacity === undefined || Number.isFinite(item.capacity))
      && (item.position === undefined || validPoint(item.position))
      && (item.locked === undefined || typeof item.locked === 'boolean')
      && (item.suppressed === undefined || typeof item.suppressed === 'boolean')
    )) : [];
  const customPorts = Array.isArray(stored.customPorts)
    ? stored.customPorts.filter((item) => (
      typeof item.key === 'string'
      && typeof item.name === 'string'
      && typeof item.islandKey === 'string'
      && isEnumValue(Object.values(PortType), item.type)
      && Number.isFinite(item.capacity)
      && (item.position === undefined || validPoint(item.position))
      && typeof item.locked === 'boolean'
    )) : [];
  const authoringLayer = normalizeAuthoringLayer(stored.authoringLayer);
  const npcLocationAuthoring = normalizeNpcLocationAuthoring(stored.npcLocationAuthoring);
  return { anchorPositions, settlementPositions, storyPositions, storyRules, zoneOverrides, placedImages, islandOverrides, bridgeOverrides, customBridges, portOverrides, customPorts, authoringLayer, npcLocationAuthoring };
}

function loadMapCustomization(signature: string): StoredMapCustomization {
  return normalizeMapCustomization(loadAllMapCustomizations()[signature]);
}

function saveMapCustomization(signature: string, state: StoredMapCustomization): void {
  const all = { ...loadAllMapCustomizations(), [signature]: state };
  localStorage.setItem(MAP_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(all));
}

function updateStats(container: HTMLElement, world: World): void {
  let minimumElevation = 1;
  let maximumElevation = 0;
  let landTiles = 0;
  let riverTiles = 0;
  let floodplainTiles = 0;
  let totalLandValue = 0;
  let totalAccessibility = 0;
  for (const tile of world.tiles) {
    minimumElevation = Math.min(minimumElevation, tile.elevation);
    maximumElevation = Math.max(maximumElevation, tile.elevation);
    if (tile.water === WaterType.Land) {
      landTiles += 1;
      totalLandValue += tile.landValue;
      totalAccessibility += tile.accessibility;
    }
    if (tile.river) riverTiles += 1;
    if (tile.floodRisk >= 0.35) floodplainTiles += 1;
  }
  const duration = Object.values(world.diagnostics.stageTimingsMs).reduce((sum, value) => sum + value, 0);
  const divisor = Math.max(1, landTiles);
  const rows: readonly [string, string][] = [
    ['Seed', world.seed],
    ['Profile', `${world.metadata.terrainSize} · ${world.metadata.townScale}`],
    ['Dimensions', `${world.width} × ${world.height} tiles · ${world.metadata.worldWidthKilometers.toFixed(0)} × ${world.metadata.worldHeightKilometers.toFixed(0)} km`],
    ['Tile scale', `${world.metadata.tileSizeMeters} m per tile`],
    ['Island profile', `${world.metadata.targetIslandCount} target · ${world.metadata.islandSpacingKilometers.toFixed(1)} km gap`],
    ['Land', `${((landTiles / world.tiles.length) * 100).toFixed(1)}%`],
    ['Landmasses', world.landmasses.length.toLocaleString()],
    ['Islands', world.islands.length.toLocaleString()],
    ['Communities', world.settlements.length.toLocaleString()],
    ['Regional population', world.islands.reduce((sum, island) => sum + island.allocatedPopulation, 0).toLocaleString()],
    ['Rivers', `${world.rivers.length} · ${riverTiles.toLocaleString()} tiles`],
    ['Floodplain', `${floodplainTiles.toLocaleString()} tiles`],
    ['Anchors', world.anchors.length.toLocaleString()],
    ['Roads', world.roads.length.toLocaleString()],
    ['Bridges', world.bridges.length.toLocaleString()],
    ['Ports', world.ports.length.toLocaleString()],
    ['Blocks', world.blocks.length.toLocaleString()],
    ['Zones', world.zones.length.toLocaleString()],
    ['Zone overrides', zoneOverrides.length.toLocaleString()],
    ['Buildings', world.buildings.length.toLocaleString()],
    ['Vegetation', world.vegetation.length.toLocaleString()],
    ['Story sites', world.storyObjects.length.toLocaleString()],
    ['NPCs', world.npcs.length.toLocaleString()],
    ['Story rule overrides', storyRuleOverrides.length.toLocaleString()],
    ['Imported assets', importedAssets.length.toLocaleString()],
    ['Placed images', placedImages.length.toLocaleString()],
    ['Accessibility', (totalAccessibility / divisor).toFixed(3)],
    ['Land value', (totalLandValue / divisor).toFixed(3)],
    ['Elevation', `${minimumElevation.toFixed(3)}–${maximumElevation.toFixed(3)}`],
    ['Generation', `${duration.toFixed(1)} ms`],
    ['Version', world.metadata.generationVersion],
  ];
  container.replaceChildren();
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    container.append(term, description);
  }
}

const canvas = requireElement<HTMLCanvasElement>('#world-canvas');
const seedInput = requireElement<HTMLInputElement>('#seed-input');
const terrainSizeSelect = requireElement<HTMLSelectElement>('#terrain-size');
const townScaleSelect = requireElement<HTMLSelectElement>('#town-scale');
const terrainShapeSelect = requireElement<HTMLSelectElement>('#terrain-shape');
const climatePresetSelect = requireElement<HTMLSelectElement>('#climate-preset');
const islandCountInput = requireElement<HTMLInputElement>('#island-count-input');
const islandSpacingInput = requireElement<HTMLInputElement>('#island-spacing-input');
const regionalScaleReadout = requireElement<HTMLElement>('#regional-scale-readout');
const profileHint = requireElement<HTMLElement>('#profile-hint');
const generateButton = requireElement<HTMLButtonElement>('#generate-button');
const cancelGenerationButton = requireElement<HTMLButtonElement>('#cancel-generation-button');
const generationProgress = requireElement<HTMLElement>('#generation-progress');
const generationProgressFill = requireElement<HTMLElement>('#generation-progress-fill');
const generationProgressStage = requireElement<HTMLElement>('#generation-progress-stage');
const generationProgressPercent = requireElement<HTMLElement>('#generation-progress-percent');
const perfGenerationTotal = requireElement<HTMLElement>('#perf-generation-total');
const perfSlowestStage = requireElement<HTMLElement>('#perf-slowest-stage');
const perfCacheTime = requireElement<HTMLElement>('#perf-cache-time');
const perfRenderTime = requireElement<HTMLElement>('#perf-render-time');
const perfVisibleBuildings = requireElement<HTMLElement>('#perf-visible-buildings');
const perfVisibleVegetation = requireElement<HTMLElement>('#perf-visible-vegetation');
const randomSeedButton = requireElement<HTMLButtonElement>('#random-seed-button');
const exportButton = requireElement<HTMLButtonElement>('#export-button');
const exportImageButton = requireElement<HTMLButtonElement>('#export-image-button');
const imageExportScale = requireElement<HTMLSelectElement>('#image-export-scale');
const imageExportPadding = requireElement<HTMLSelectElement>('#image-export-padding');
const exportCustomizationButton = requireElement<HTMLButtonElement>('#export-customization-button');
const customizationImportFile = requireElement<HTMLInputElement>('#customization-import-file');
const projectImportFile = requireElement<HTMLInputElement>('#project-import-file');
const projectJsonDropzone = requireElement<HTMLElement>('#project-json-dropzone');
const fitMapButton = requireElement<HTMLButtonElement>('#fit-map-button');
const viewPreset = requireElement<HTMLSelectElement>('#view-preset');
const statusMessage = requireElement<HTMLElement>('#generation-status');
const authoringCard = requireElement<HTMLElement>('#authoring-card');
const authoringModeBadge = requireElement<HTMLElement>('#authoring-mode-badge');
const authoringStatus = requireElement<HTMLElement>('#authoring-status');
const authoringSettlementName = requireElement<HTMLInputElement>('#authoring-settlement-name');
const authoringSettlementKind = requireElement<HTMLSelectElement>('#authoring-settlement-kind');
const authoringSettlementParent = requireElement<HTMLSelectElement>('#authoring-settlement-parent');
const authoringSettlementRadius = requireElement<HTMLInputElement>('#authoring-settlement-radius');
const authoringSettlementRotation = requireElement<HTMLInputElement>('#authoring-settlement-rotation');
const authoringSettlementPopulation = requireElement<HTMLInputElement>('#authoring-settlement-population');
const authoringSettlementDensity = requireElement<HTMLInputElement>('#authoring-settlement-density');
const authoringSettlementVisibility = requireElement<HTMLSelectElement>('#authoring-settlement-visibility');
const authoringSettlementNotes = requireElement<HTMLInputElement>('#authoring-settlement-notes');
const authoringSettlementRoads = requireElement<HTMLInputElement>('#authoring-settlement-roads');
const authoringSettlementBuildings = requireElement<HTMLInputElement>('#authoring-settlement-buildings');
const authoringPlaceSettlement = requireElement<HTMLButtonElement>('#authoring-place-settlement');
const authoringApplySettlement = requireElement<HTMLButtonElement>('#authoring-apply-settlement');
const authoringDuplicateSettlement = requireElement<HTMLButtonElement>('#authoring-duplicate-settlement');
const authoringSettlementList = requireElement<HTMLElement>('#authoring-settlement-list');
const settlementAnchorOnlyFields = [...document.querySelectorAll<HTMLElement>('[data-settlement-anchor-only]')];
const authoringFeatureName = requireElement<HTMLInputElement>('#authoring-feature-name');
const authoringFeatureCategory = requireElement<HTMLSelectElement>('#authoring-feature-category');
const authoringFeatureSubtype = requireElement<HTMLInputElement>('#authoring-feature-subtype');
const authoringFeatureReality = requireElement<HTMLSelectElement>('#authoring-feature-reality');
const authoringFeatureVisibility = requireElement<HTMLSelectElement>('#authoring-feature-visibility');
const authoringFeatureColor = requireElement<HTMLInputElement>('#authoring-feature-color');
const authoringFeatureLineWidth = requireElement<HTMLInputElement>('#authoring-feature-line-width');
const authoringFeatureFill = requireElement<HTMLInputElement>('#authoring-feature-fill');
const authoringFeatureScale = requireElement<HTMLInputElement>('#authoring-feature-scale');
const authoringFeatureRotation = requireElement<HTMLInputElement>('#authoring-feature-rotation');
const authoringFeatureOpacity = requireElement<HTMLInputElement>('#authoring-feature-opacity');
const authoringFeatureAliases = requireElement<HTMLInputElement>('#authoring-feature-aliases');
const authoringFeatureNotes = requireElement<HTMLTextAreaElement>('#authoring-feature-notes');
const authoringStartFeature = requireElement<HTMLButtonElement>('#authoring-start-feature');
const authoringFinishFeature = requireElement<HTMLButtonElement>('#authoring-finish-feature');
const authoringCancelFeature = requireElement<HTMLButtonElement>('#authoring-cancel-feature');
const authoringFeatureList = requireElement<HTMLElement>('#authoring-feature-list');
const authoringTerrainOperation = requireElement<HTMLSelectElement>('#authoring-terrain-operation');
const authoringTerrainSize = requireElement<HTMLInputElement>('#authoring-terrain-size');
const authoringTerrainStrength = requireElement<HTMLInputElement>('#authoring-terrain-strength');
const authoringTerrainType = requireElement<HTMLSelectElement>('#authoring-terrain-type');
const authoringClearTerrain = requireElement<HTMLButtonElement>('#authoring-clear-terrain');
const authoringLockTerrain = requireElement<HTMLButtonElement>('#authoring-lock-terrain');
const authoringShowAll = requireElement<HTMLButtonElement>('#authoring-show-all');
const authoringResetSelected = requireElement<HTMLButtonElement>('#authoring-reset-selected');
const authoringDeleteSelected = requireElement<HTMLButtonElement>('#authoring-delete-selected');
const mapTitle = requireElement<HTMLElement>('#map-title');
const mapSubtitle = requireElement<HTMLElement>('#map-subtitle');
const stats = requireElement<HTMLElement>('#world-stats');
const cursorReadout = requireElement<HTMLElement>('#cursor-readout');
const anchorForm = requireElement<HTMLFormElement>('#anchor-form');
const anchorFormTitle = requireElement<HTMLElement>('#anchor-form-title');
const anchorEditKey = requireElement<HTMLInputElement>('#anchor-edit-key');
const anchorCancelButton = requireElement<HTMLButtonElement>('#anchor-cancel-button');
const anchorSubmitButton = requireElement<HTMLButtonElement>('#anchor-submit-button');
const anchorName = requireElement<HTMLInputElement>('#anchor-name');
const anchorRegion = requireElement<HTMLSelectElement>('#anchor-region');
const anchorTerrain = requireElement<HTMLSelectElement>('#anchor-terrain');
const anchorTarget = requireElement<HTMLSelectElement>('#anchor-target');
const anchorProximity = requireElement<HTMLSelectElement>('#anchor-proximity');
const anchorZone = requireElement<HTMLSelectElement>('#anchor-zone');
const anchorRadius = requireElement<HTMLSelectElement>('#anchor-radius');
const anchorSpacing = requireElement<HTMLSelectElement>('#anchor-spacing');
const anchorList = requireElement<HTMLElement>('#anchor-list');
const anchorCount = requireElement<HTMLElement>('#anchor-count');
const roadNameForm = requireElement<HTMLFormElement>('#road-name-form');
const roadNameTarget = requireElement<HTMLSelectElement>('#road-name-target');
const roadNameInput = requireElement<HTMLInputElement>('#road-name-input');
const roadNameReset = requireElement<HTMLButtonElement>('#road-name-reset');
const blockNameForm = requireElement<HTMLFormElement>('#block-name-form');
const blockNameTarget = requireElement<HTMLSelectElement>('#block-name-target');
const blockNameInput = requireElement<HTMLInputElement>('#block-name-input');
const blockNameReset = requireElement<HTMLButtonElement>('#block-name-reset');
const roadLabelFontSize = requireElement<HTMLInputElement>('#road-label-font-size');
const roadLabelFontOutput = requireElement<HTMLOutputElement>('#road-label-font-output');
const roadLabelOpacity = requireElement<HTMLInputElement>('#road-label-opacity');
const roadLabelOpacityOutput = requireElement<HTMLOutputElement>('#road-label-opacity-output');
const roadLabelDensity = requireElement<HTMLInputElement>('#road-label-density');
const roadLabelDensityOutput = requireElement<HTMLOutputElement>('#road-label-density-output');
const roadLabelMainZoom = requireElement<HTMLSelectElement>('#road-label-main-zoom');
const roadLabelSecondaryZoom = requireElement<HTMLSelectElement>('#road-label-secondary-zoom');
const roadLabelLocalZoom = requireElement<HTMLSelectElement>('#road-label-local-zoom');
const roadLabelMain = requireElement<HTMLInputElement>('#road-label-main');
const roadLabelSecondary = requireElement<HTMLInputElement>('#road-label-secondary');
const roadLabelLocal = requireElement<HTMLInputElement>('#road-label-local');
const roadLabelRotate = requireElement<HTMLInputElement>('#road-label-rotate');
const roadLabelOutline = requireElement<HTMLInputElement>('#road-label-outline');
const roadLabelSummary = requireElement<HTMLElement>('#road-label-summary');
const blockLabelFontSize = requireElement<HTMLInputElement>('#block-label-font-size');
const blockLabelFontOutput = requireElement<HTMLOutputElement>('#block-label-font-output');
const blockLabelOpacity = requireElement<HTMLInputElement>('#block-label-opacity');
const blockLabelOpacityOutput = requireElement<HTMLOutputElement>('#block-label-opacity-output');
const blockLabelDensity = requireElement<HTMLInputElement>('#block-label-density');
const blockLabelDensityOutput = requireElement<HTMLOutputElement>('#block-label-density-output');
const blockLabelMinZoom = requireElement<HTMLSelectElement>('#block-label-min-zoom');
const blockLabelOutline = requireElement<HTMLInputElement>('#block-label-outline');
const blockLabelSummary = requireElement<HTMLElement>('#block-label-summary');
const labelAvoidCollisions = requireElement<HTMLInputElement>('#label-avoid-collisions');
const labelControlsReset = requireElement<HTMLButtonElement>('#label-controls-reset');
const storyList = requireElement<HTMLElement>('#story-list');
const worldStoryList = requireElement<HTMLElement>('#world-story-list');
const removedStoryCount = requireElement<HTMLElement>('#removed-story-count');
const restoreRemovedStoryPoints = requireElement<HTMLButtonElement>('#restore-removed-story-points');
const storyRuleForm = requireElement<HTMLFormElement>('#story-rule-form');
const storyRuleTarget = requireElement<HTMLSelectElement>('#story-rule-target');
const storyRuleName = requireElement<HTMLInputElement>('#story-rule-name');
const storyPreferredZone = requireElement<HTMLSelectElement>('#story-preferred-zone');
const storyInfluenceRadius = requireElement<HTMLInputElement>('#story-influence-radius');
const storyAllowedZones = requireElement<HTMLSelectElement>('#story-allowed-zones');
const storyDisallowedZones = requireElement<HTMLSelectElement>('#story-disallowed-zones');
const storyRuleReset = requireElement<HTMLButtonElement>('#story-rule-reset');
const storyRuleWish = requireElement<HTMLTextAreaElement>('#story-rule-wish');
const storyRuleManifestation = requireElement<HTMLTextAreaElement>('#story-rule-manifestation');
const storyRuleEncounters = requireElement<HTMLTextAreaElement>('#story-rule-encounters');
const customStoryForm = requireElement<HTMLFormElement>('#custom-story-form');
const customStoryFormTitle = requireElement<HTMLElement>('#custom-story-form-title');
const customStoryCancel = requireElement<HTMLButtonElement>('#custom-story-cancel');
const customStoryEditId = requireElement<HTMLInputElement>('#custom-story-edit-id');
const customStoryName = requireElement<HTMLInputElement>('#custom-story-name');
const customStoryType = requireElement<HTMLSelectElement>('#custom-story-type');
const customStoryRegion = requireElement<HTMLSelectElement>('#custom-story-region');
const customStoryTerrain = requireElement<HTMLSelectElement>('#custom-story-terrain');
const customStoryZone = requireElement<HTMLSelectElement>('#custom-story-zone');
const customStoryAllowedZones = requireElement<HTMLSelectElement>('#custom-story-allowed-zones');
const customStoryDisallowedZones = requireElement<HTMLSelectElement>('#custom-story-disallowed-zones');
const customStoryRadius = requireElement<HTMLInputElement>('#custom-story-radius');
const customStorySpacing = requireElement<HTMLInputElement>('#custom-story-spacing');
const customStoryWish = requireElement<HTMLTextAreaElement>('#custom-story-wish');
const customStoryManifestation = requireElement<HTMLTextAreaElement>('#custom-story-manifestation');
const customStoryEncounters = requireElement<HTMLTextAreaElement>('#custom-story-encounters');
const customStoryList = requireElement<HTMLElement>('#custom-story-list');
const customStoryCount = requireElement<HTMLElement>('#custom-story-count');
const npcCount = requireElement<HTMLElement>('#npc-count');
const npcRosterSize = requireElement<HTMLInputElement>('#npc-roster-size');
const npcSearch = requireElement<HTMLInputElement>('#npc-search');
const npcGenerateButton = requireElement<HTMLButtonElement>('#npc-generate-button');
const npcList = requireElement<HTMLElement>('#npc-list');
const npcCreateButton = requireElement<HTMLButtonElement>('#npc-create-button');
const npcExportSelected = requireElement<HTMLButtonElement>('#npc-export-selected');
const npcExportGroup = requireElement<HTMLButtonElement>('#npc-export-group');
const npcImportFile = requireElement<HTMLInputElement>('#npc-import-file');
const npcEditorHeading = requireElement<HTMLElement>('#npc-editor-heading');
const npcEditName = requireElement<HTMLInputElement>('#npc-edit-name');
const npcEditAge = requireElement<HTMLInputElement>('#npc-edit-age');
const npcEditStatus = requireElement<HTMLSelectElement>('#npc-edit-status');
const npcEditOccupation = requireElement<HTMLInputElement>('#npc-edit-occupation');
const npcEditSettlement = requireElement<HTMLSelectElement>('#npc-edit-settlement');
const npcEditHome = requireElement<HTMLSelectElement>('#npc-edit-home');
const npcEditUnusualHome = requireElement<HTMLInputElement>('#npc-edit-unusual-home');
const npcEditWorkplace = requireElement<HTMLSelectElement>('#npc-edit-workplace');
const npcEditPublicDescription = requireElement<HTMLTextAreaElement>('#npc-edit-public-description');
const npcEditPersonality = requireElement<HTMLTextAreaElement>('#npc-edit-personality');
const npcEditWish = requireElement<HTMLTextAreaElement>('#npc-edit-wish');
const npcEditFear = requireElement<HTMLTextAreaElement>('#npc-edit-fear');
const npcEditSecret = requireElement<HTMLTextAreaElement>('#npc-edit-secret');
const npcEditRumor = requireElement<HTMLTextAreaElement>('#npc-edit-rumor');
const npcEditTags = requireElement<HTMLInputElement>('#npc-edit-tags');
const npcEditNotes = requireElement<HTMLTextAreaElement>('#npc-edit-notes');
const npcEditPortrait = requireElement<HTMLInputElement>('#npc-edit-portrait');
const npcPortraitPreview = requireElement<HTMLElement>('#npc-portrait-preview');
const npcSaveButton = requireElement<HTMLButtonElement>('#npc-save-button');
const npcResetButton = requireElement<HTMLButtonElement>('#npc-reset-button');
const npcDeleteButton = requireElement<HTMLButtonElement>('#npc-delete-button');
const npcScheduleDayTabs = requireElement<HTMLElement>('#npc-schedule-day-tabs');
const npcScheduleStart = requireElement<HTMLInputElement>('#npc-schedule-start');
const npcScheduleEnd = requireElement<HTMLInputElement>('#npc-schedule-end');
const npcScheduleActivity = requireElement<HTMLInputElement>('#npc-schedule-activity');
const npcScheduleLocation = requireElement<HTMLSelectElement>('#npc-schedule-location');
const npcScheduleTravel = requireElement<HTMLSelectElement>('#npc-schedule-travel');
const npcScheduleVisibility = requireElement<HTMLSelectElement>('#npc-schedule-visibility');
const npcScheduleAdd = requireElement<HTMLButtonElement>('#npc-schedule-add');
const npcScheduleCopyWeekdays = requireElement<HTMLButtonElement>('#npc-schedule-copy-weekdays');
const npcScheduleClearDay = requireElement<HTMLButtonElement>('#npc-schedule-clear-day');
const npcScheduleList = requireElement<HTMLElement>('#npc-schedule-list');
const npcScheduleValidation = requireElement<HTMLElement>('#npc-schedule-validation');
const npcRelationshipTarget = requireElement<HTMLSelectElement>('#npc-relationship-target');
const npcRelationshipKind = requireElement<HTMLSelectElement>('#npc-relationship-kind');
const npcRelationshipHidden = requireElement<HTMLInputElement>('#npc-relationship-hidden');
const npcRelationshipLabel = requireElement<HTMLInputElement>('#npc-relationship-label');
const npcRelationshipAdd = requireElement<HTMLButtonElement>('#npc-relationship-add');
const npcRelationshipList = requireElement<HTMLElement>('#npc-relationship-list');
const npcOverrideLocation = requireElement<HTMLSelectElement>('#npc-override-location');
const npcOverrideActivity = requireElement<HTMLInputElement>('#npc-override-activity');
const npcOverrideDuration = requireElement<HTMLSelectElement>('#npc-override-duration');
const npcSceneId = requireElement<HTMLInputElement>('#npc-scene-id');
const npcOverrideReason = requireElement<HTMLInputElement>('#npc-override-reason');
const npcSceneVisible = requireElement<HTMLInputElement>('#npc-scene-visible');
const npcOverrideAdd = requireElement<HTMLButtonElement>('#npc-override-add');
const npcScenePlace = requireElement<HTMLButtonElement>('#npc-scene-place');
const npcPlacementClear = requireElement<HTMLButtonElement>('#npc-placement-clear');
const npcPlacementList = requireElement<HTMLElement>('#npc-placement-list');
const locationSource = requireElement<HTMLSelectElement>('#location-source');
const locationName = requireElement<HTMLInputElement>('#location-name');
const locationType = requireElement<HTMLInputElement>('#location-type');
const locationOwner = requireElement<HTMLSelectElement>('#location-owner');
const locationVisibility = requireElement<HTMLSelectElement>('#location-visibility');
const locationStatus = requireElement<HTMLSelectElement>('#location-status');
const locationTags = requireElement<HTMLInputElement>('#location-tags');
const locationDescription = requireElement<HTMLTextAreaElement>('#location-description');
const locationPlayerDescription = requireElement<HTMLTextAreaElement>('#location-player-description');
const locationNotes = requireElement<HTMLTextAreaElement>('#location-notes');
const locationSave = requireElement<HTMLButtonElement>('#location-save');
const locationDelete = requireElement<HTMLButtonElement>('#location-delete');
const locationHoursDay = requireElement<HTMLSelectElement>('#location-hours-day');
const locationHoursOpen = requireElement<HTMLInputElement>('#location-hours-open');
const locationHoursClose = requireElement<HTMLInputElement>('#location-hours-close');
const locationHoursClosed = requireElement<HTMLInputElement>('#location-hours-closed');
const locationHoursSave = requireElement<HTMLButtonElement>('#location-hours-save');
const locationHoursList = requireElement<HTMLElement>('#location-hours-list');
const locationList = requireElement<HTMLElement>('#location-list');
const npcViewToggleButton = requireElement<HTMLButtonElement>('#npc-view-toggle-button');
const realtimeClock = requireElement<HTMLElement>('#realtime-clock');
const realtimeClockTime = requireElement<HTMLElement>('#realtime-clock-time');
const realtimeClockDate = requireElement<HTMLElement>('#realtime-clock-date');
const realtimeClockPeriod = requireElement<HTMLElement>('#realtime-clock-period');
const realtimeClockMode = requireElement<HTMLElement>('#realtime-clock-mode');
const simulationClockMode = requireElement<HTMLSelectElement>('#simulation-clock-mode');
const simulationSpeed = requireElement<HTMLSelectElement>('#simulation-speed');
const simulationDatetime = requireElement<HTMLInputElement>('#simulation-datetime');
const simulationApplyTime = requireElement<HTMLButtonElement>('#simulation-apply-time');
const simulationAdvance15 = requireElement<HTMLButtonElement>('#simulation-advance-15');
const simulationAdvanceHour = requireElement<HTMLButtonElement>('#simulation-advance-hour');
const simulationAdvanceDay = requireElement<HTMLButtonElement>('#simulation-advance-day');
const simulationWeather = requireElement<HTMLSelectElement>('#simulation-weather');
const simulationNowSummary = requireElement<HTMLElement>('#simulation-now-summary');
const simulationTimezoneSummary = requireElement<HTMLElement>('#simulation-timezone-summary');
const simulationPeriodSummary = requireElement<HTMLElement>('#simulation-period-summary');
const simulationWeatherSummary = requireElement<HTMLElement>('#simulation-weather-summary');
const simulationTrafficSummary = requireElement<HTMLElement>('#simulation-traffic-summary');
const simulationInfrastructureSummary = requireElement<HTMLElement>('#simulation-infrastructure-summary');
const simulationVenueSummary = requireElement<HTMLElement>('#simulation-venue-summary');
const simulationNpcSummary = requireElement<HTMLElement>('#simulation-npc-summary');
const simulationSupernaturalSummary = requireElement<HTMLElement>('#simulation-supernatural-summary');
const simulationEventLog = requireElement<HTMLElement>('#simulation-event-log');
const simulationEventFilter = requireElement<HTMLSelectElement>('#simulation-event-filter');
const simulationEventClear = requireElement<HTMLButtonElement>('#simulation-event-clear');
const simulationLiveBadge = requireElement<HTMLElement>('#simulation-live-badge');
const simulationInfrastructureKind = requireElement<HTMLSelectElement>('#simulation-infrastructure-kind');
const simulationInfrastructureTarget = requireElement<HTMLSelectElement>('#simulation-infrastructure-target');
const simulationInfrastructureStatus = requireElement<HTMLSelectElement>('#simulation-infrastructure-status');
const simulationInfrastructureApply = requireElement<HTMLButtonElement>('#simulation-infrastructure-apply');
const simulationInfrastructureClear = requireElement<HTMLButtonElement>('#simulation-infrastructure-clear');
const viewportShell = requireElement<HTMLElement>('.viewport-shell');
const toolbarEditButton = requireElement<HTMLButtonElement>('#toolbar-edit-button');
const undoButton = requireElement<HTMLButtonElement>('#undo-button');
const redoButton = requireElement<HTMLButtonElement>('#redo-button');
const editModeButton = requireElement<HTMLButtonElement>('#edit-mode-button');
const resetObjectPositionsButton = requireElement<HTMLButtonElement>('#reset-object-positions');
const assetForm = requireElement<HTMLFormElement>('#asset-form');
const assetFiles = requireElement<HTMLInputElement>('#asset-files');
const assetTargetCategory = requireElement<HTMLSelectElement>('#asset-target-category');
const assetTargetType = requireElement<HTMLSelectElement>('#asset-target-type');
const assetList = requireElement<HTMLElement>('#asset-list');
const assetCount = requireElement<HTMLElement>('#asset-count');
const placedImageList = requireElement<HTMLElement>('#placed-image-list');
const zoneEditModeButton = requireElement<HTMLButtonElement>('#zone-edit-mode-button');
const zoneToolSelect = requireElement<HTMLSelectElement>('#zone-tool');
const zonePaintType = requireElement<HTMLSelectElement>('#zone-paint-type');
const zoneBrushSize = requireElement<HTMLInputElement>('#zone-brush-size');
const zoneBrushOutput = requireElement<HTMLOutputElement>('#zone-brush-output');
const zoneDisplayMode = requireElement<HTMLSelectElement>('#zone-display-mode');
const zoneLockNew = requireElement<HTMLInputElement>('#zone-lock-new');
const zoneResetAll = requireElement<HTMLButtonElement>('#zone-reset-all');
const zoneOverrideCount = requireElement<HTMLElement>('#zone-override-count');
const zoneEditorStatus = requireElement<HTMLElement>('#zone-editor-status');
const workspaceEditorButton = requireElement<HTMLButtonElement>('#workspace-editor-button');
const workspaceDmButton = requireElement<HTMLButtonElement>('#workspace-dm-button');
const editorWorkspace = requireElement<HTMLElement>('#editor-workspace');
const dmWorkspace = requireElement<HTMLElement>('#dm-workspace');
const workspaceKicker = requireElement<HTMLElement>('#workspace-kicker');
const workspaceTitle = requireElement<HTMLElement>('#workspace-title');
const workspaceDescription = requireElement<HTMLElement>('#workspace-description');
const mapWorkspaceBadge = requireElement<HTMLElement>('#map-workspace-badge');
const dmViewPreset = requireElement<HTMLSelectElement>('#dm-view-preset');
const dmStorySearch = requireElement<HTMLInputElement>('#dm-story-search');
const dmRandomEncounterButton = requireElement<HTMLButtonElement>('#dm-random-encounter-button');
const dmRandomEncounterResult = requireElement<HTMLElement>('#dm-random-encounter-result');
const dmStoryTotal = requireElement<HTMLElement>('#dm-story-total');
const dmCustomTotal = requireElement<HTMLElement>('#dm-custom-total');
const dmSessionLog = requireElement<HTMLElement>('#dm-session-log');
const dmClearLog = requireElement<HTMLButtonElement>('#dm-clear-log');
const bridgeCount = requireElement<HTMLElement>('#bridge-count');
const bridgeSummary = requireElement<HTMLElement>('#bridge-summary');
const bridgeList = requireElement<HTMLElement>('#bridge-list');
const bridgeForm = requireElement<HTMLFormElement>('#bridge-form');
const bridgeName = requireElement<HTMLInputElement>('#bridge-name');
const bridgeFromIsland = requireElement<HTMLSelectElement>('#bridge-from-island');
const bridgeToIsland = requireElement<HTMLSelectElement>('#bridge-to-island');
const bridgeType = requireElement<HTMLSelectElement>('#bridge-type');
const bridgeRoadClass = requireElement<HTMLSelectElement>('#bridge-road-class');
const bridgeWidth = requireElement<HTMLInputElement>('#bridge-width');
const bridgeClearance = requireElement<HTMLInputElement>('#bridge-clearance');
const bridgeResetAll = requireElement<HTMLButtonElement>('#bridge-reset-all');
const portCount = requireElement<HTMLElement>('#port-count');
const portSummary = requireElement<HTMLElement>('#port-summary');
const portList = requireElement<HTMLElement>('#port-list');
const portForm = requireElement<HTMLFormElement>('#port-form');
const portName = requireElement<HTMLInputElement>('#port-name');
const portIsland = requireElement<HTMLSelectElement>('#port-island');
const portType = requireElement<HTMLSelectElement>('#port-type');
const portCapacity = requireElement<HTMLInputElement>('#port-capacity');
const portResetAll = requireElement<HTMLButtonElement>('#port-reset-all');
const travelFromLocation = requireElement<HTMLSelectElement>('#travel-from-location');
const travelToLocation = requireElement<HTMLSelectElement>('#travel-to-location');
const travelMode = requireElement<HTMLSelectElement>('#travel-mode');
const travelTraffic = requireElement<HTMLSelectElement>('#travel-traffic');
const travelCalculate = requireElement<HTMLButtonElement>('#travel-calculate');
const travelReverse = requireElement<HTMLButtonElement>('#travel-reverse');
const travelClear = requireElement<HTMLButtonElement>('#travel-clear');
const travelPickFrom = requireElement<HTMLButtonElement>('#travel-pick-from');
const travelPickTo = requireElement<HTMLButtonElement>('#travel-pick-to');
const travelAlternatives = requireElement<HTMLElement>('#travel-alternatives');
const travelResult = requireElement<HTMLElement>('#travel-result');
const toggleLeftPanelButton = requireElement<HTMLButtonElement>('#toggle-left-panel-button');
const toggleStudioDockButton = requireElement<HTMLButtonElement>('#toggle-studio-dock-button');
const closeStudioDockButton = requireElement<HTMLButtonElement>('#close-studio-dock-button');
const commandPaletteButton = requireElement<HTMLButtonElement>('#command-palette-button');
const studioTabInspector = requireElement<HTMLButtonElement>('#studio-tab-inspector');
const studioTabLayers = requireElement<HTMLButtonElement>('#studio-tab-layers');
const studioTabProject = requireElement<HTMLButtonElement>('#studio-tab-project');
const studioInspectorPanel = requireElement<HTMLElement>('#studio-inspector-panel');
const studioLayersPanel = requireElement<HTMLElement>('#studio-layers-panel');
const studioProjectPanel = requireElement<HTMLElement>('#studio-project-panel');
const inspectorContent = requireElement<HTMLElement>('#inspector-content');
const focusSelectionButton = requireElement<HTMLButtonElement>('#focus-selection-button');
const studioLayerList = requireElement<HTMLElement>('#studio-layer-list');
const layerSearchInput = requireElement<HTMLInputElement>('#layer-search-input');
const layersAllButton = requireElement<HTMLButtonElement>('#layers-all-button');
const layersNoneButton = requireElement<HTMLButtonElement>('#layers-none-button');
const studioThemeSelect = requireElement<HTMLSelectElement>('#studio-theme-select');
const studioSaveButton = requireElement<HTMLButtonElement>('#studio-save-button');
const studioOpenButton = requireElement<HTMLButtonElement>('#studio-open-button');
const studioExportImageButton = requireElement<HTMLButtonElement>('#studio-export-image-button');
const restoreSessionButton = requireElement<HTMLButtonElement>('#restore-session-button');
const autosaveIndicator = requireElement<HTMLElement>('#autosave-indicator');
const sessionRecoveryCopy = requireElement<HTMLElement>('#session-recovery-copy');
const recentProjectList = requireElement<HTMLElement>('#recent-project-list');
const clearRecentProjectsButton = requireElement<HTMLButtonElement>('#clear-recent-projects-button');
const minimapPanel = requireElement<HTMLElement>('#minimap-panel');
const minimapCanvas = requireElement<HTMLCanvasElement>('#minimap-canvas');
const minimapCollapseButton = requireElement<HTMLButtonElement>('#minimap-collapse-button');
const statusSeed = requireElement<HTMLElement>('#status-seed');
const statusLayout = requireElement<HTMLElement>('#status-layout');
const statusZoom = requireElement<HTMLElement>('#status-zoom');
const statusSelection = requireElement<HTMLElement>('#status-selection');
const statusGeneration = requireElement<HTMLElement>('#status-generation');
const toastStack = requireElement<HTMLElement>('#toast-stack');
const commandPaletteBackdrop = requireElement<HTMLElement>('#command-palette-backdrop');
const commandPaletteInput = requireElement<HTMLInputElement>('#command-palette-input');
const commandPaletteResults = requireElement<HTMLElement>('#command-palette-results');

const layerElements: Readonly<Record<RenderLayer, HTMLInputElement>> = {
  [RenderLayer.Terrain]: requireElement<HTMLInputElement>('#terrain-layer'),
  [RenderLayer.Elevation]: requireElement<HTMLInputElement>('#elevation-layer'),
  [RenderLayer.Moisture]: requireElement<HTMLInputElement>('#moisture-layer'),
  [RenderLayer.Temperature]: requireElement<HTMLInputElement>('#temperature-layer'),
  [RenderLayer.Accessibility]: requireElement<HTMLInputElement>('#accessibility-layer'),
  [RenderLayer.LandValue]: requireElement<HTMLInputElement>('#land-value-layer'),
  [RenderLayer.Zones]: requireElement<HTMLInputElement>('#zone-layer'),
  [RenderLayer.Floodplains]: requireElement<HTMLInputElement>('#floodplain-layer'),
  [RenderLayer.Rivers]: requireElement<HTMLInputElement>('#river-layer'),
  [RenderLayer.Islands]: requireElement<HTMLInputElement>('#island-layer'),
  [RenderLayer.IslandLabels]: requireElement<HTMLInputElement>('#island-label-layer'),
  [RenderLayer.Settlements]: requireElement<HTMLInputElement>('#settlement-layer'),
  [RenderLayer.Blocks]: requireElement<HTMLInputElement>('#block-layer'),
  [RenderLayer.BlockLabels]: requireElement<HTMLInputElement>('#block-label-layer'),
  [RenderLayer.Roads]: requireElement<HTMLInputElement>('#road-layer'),
  [RenderLayer.Bridges]: requireElement<HTMLInputElement>('#bridge-layer'),
  [RenderLayer.BridgeLabels]: requireElement<HTMLInputElement>('#bridge-label-layer'),
  [RenderLayer.Ports]: requireElement<HTMLInputElement>('#port-layer'),
  [RenderLayer.PortLabels]: requireElement<HTMLInputElement>('#port-label-layer'),
  [RenderLayer.RoadLabels]: requireElement<HTMLInputElement>('#road-label-layer'),
  [RenderLayer.Buildings]: requireElement<HTMLInputElement>('#building-layer'),
  [RenderLayer.CustomImages]: requireElement<HTMLInputElement>('#custom-image-layer'),
  [RenderLayer.Vegetation]: requireElement<HTMLInputElement>('#vegetation-layer'),
  [RenderLayer.Anchors]: requireElement<HTMLInputElement>('#anchor-layer'),
  [RenderLayer.Story]: requireElement<HTMLInputElement>('#story-layer'),
  [RenderLayer.NPCs]: requireElement<HTMLInputElement>('#npc-layer'),
  [RenderLayer.Authoring]: requireElement<HTMLInputElement>('#authoring-layer'),
  [RenderLayer.HiddenPayaw]: requireElement<HTMLInputElement>('#hidden-payaw-layer'),
  [RenderLayer.LiveInfrastructure]: requireElement<HTMLInputElement>('#live-infrastructure-layer'),
  [RenderLayer.VenueStatus]: requireElement<HTMLInputElement>('#venue-status-layer'),
  [RenderLayer.SettlementActivity]: requireElement<HTMLInputElement>('#settlement-activity-layer'),
  [RenderLayer.SupernaturalActivity]: requireElement<HTMLInputElement>('#supernatural-activity-layer'),
  [RenderLayer.Travel]: requireElement<HTMLInputElement>('#travel-path-layer'),
  [RenderLayer.Grid]: requireElement<HTMLInputElement>('#grid-layer'),
};

const REGION_LABELS: Readonly<Record<AnchorRegionPreference, string>> = {
  [AnchorRegionPreference.Anywhere]: 'anywhere',
  [AnchorRegionPreference.TownCenter]: 'town center',
  [AnchorRegionPreference.North]: 'north',
  [AnchorRegionPreference.South]: 'south',
  [AnchorRegionPreference.East]: 'east',
  [AnchorRegionPreference.West]: 'west',
};

const TERRAIN_LABELS: Readonly<Record<AnchorTerrainPreference, string>> = {
  [AnchorTerrainPreference.SafeLand]: 'safe land',
  [AnchorTerrainPreference.FlatLand]: 'flat land',
  [AnchorTerrainPreference.Coast]: 'coast',
  [AnchorTerrainPreference.River]: 'river',
  [AnchorTerrainPreference.ForestEdge]: 'forest edge',
  [AnchorTerrainPreference.Farmland]: 'farmland',
  [AnchorTerrainPreference.HighGround]: 'high ground',
  [AnchorTerrainPreference.DryLand]: 'dry land',
};

const pipeline = new GenerationPipeline();
const generationWorker = new GenerationWorkerClient(pipeline);
const renderer = new CanvasRenderer(canvas);
const camera = new Camera();
const assetRepository = new AssetRepository();
const defaultBuiltIns = createDefaultBuiltInAnchorDefinitions(DEFAULT_GENERATION_CONFIG.anchors);
const profile = loadProfile();
terrainSizeSelect.value = profile.terrainSize;
townScaleSelect.value = profile.townScale;
terrainShapeSelect.value = profile.terrainShape;
climatePresetSelect.value = profile.climatePreset;
islandCountInput.value = String(profile.islandCount);
islandSpacingInput.value = String(profile.islandSpacingKilometers);
const storedAnchors = loadAnchorState();
let customAnchors = [...storedAnchors.customAnchors];
let builtInOverrides = [...storedAnchors.builtInOverrides];
let customStoryDefinitions = loadCustomStoryDefinitions();
let roadNameOverrides: EntityNameOverride[] = [];
let blockNameOverrides: EntityNameOverride[] = [];
let labelSettings: LabelDisplaySettings = loadLabelSettings();
let anchorPositionOverrides: AnchorPositionOverride[] = [];
let settlementPositionOverrides: SettlementPositionOverride[] = [];
let storyPositionOverrides: StoryPositionOverride[] = [];
let storyRuleOverrides: StoryRuleOverride[] = [];
let zoneOverrides: ZoneOverride[] = [];
let islandOverrides: IslandOverride[] = [];
let bridgeOverrides: BridgeOverride[] = [];
let customBridges: CustomBridgeDefinition[] = [];
let portOverrides: PortOverride[] = [];
let customPorts: CustomPortDefinition[] = [];
let placedImages: PlacedImage[] = [];
let authoringLayer: AuthoringLayerState = structuredClone(EMPTY_AUTHORING_LAYER);
let npcLocationAuthoring: NPCLocationAuthoringState = structuredClone(EMPTY_NPC_LOCATION_AUTHORING);
let campaignState: CampaignState = createCampaign('world:pending', 'Hidden Payaw');
let campaignStudio: CampaignStudio | null = null;
let pendingImportedCampaign: CampaignState | null = null;
let playerViewState: PlayerViewState = createDefaultPlayerViewState(6);
let pendingImportedPlayerView: PlayerViewState | null = null;
let playerPreview: GmPlayerPreview | null = null;
let selectedNpcKey: string | null = null;
let selectedNpcScheduleDay: CampaignDay = 'monday';
let selectedLocationRef: string | null = null;
let pendingNpcPortraitDataUrl: string | null = null;
let importedAssets: ImportedImageAsset[] = [];
let runtimeImageAssets: RuntimeImageAsset[] = [];
let world: World;
let simulation: WorldSimulation | null = null;
let pendingImportedSimulation: Partial<StoredSimulationState> | undefined;
let activeNpcSchedulePeriod: NPCSchedulePeriod = npcSchedulePeriodForDate(new Date());
let lastRealtimeClockSecond = -1;
let clockDisplayFormat: '12h' | '24h' = localStorage.getItem(CLOCK_FORMAT_STORAGE_KEY) === '24h' ? '24h' : '12h';
let activeWorldSignature = '';
let activeGenerationController: AbortController | null = null;
let generationSequence = 0;
let renderRequested = true;
let dragging = false;
let editMode = false;
let zoneEditMode = false;
let zoneStrokeActive = false;
let zoneStrokeStart: { x: number; y: number } | null = null;
let zoneStrokeIndices = new Set<number>();
let zoneBrushPreview: number[] = [];
let lastPointerX = 0;
let lastPointerY = 0;
let dragPreview: { kind: 'anchor' | 'settlement' | 'story' | 'authored-feature'; key: string; x: number; y: number } | null = null;
let activeAuthoringFeatureId: string | null = null;
let activeAuthoringSettlementKey: string | null = null;
let pendingSettlementPlacement: AuthoredSettlementDefinition | null = null;
let pendingPointAnchorPlacement = false;
let authoringDraftPoints: AuthoringPoint[] = [];
let authoringTool: 'select' | 'anchor' | 'point' | 'polyline' | 'polygon' | 'terrain-brush' = 'select';
let authoringTerrainStroke = new Set<number>();
let authoringTerrainStrokeActive = false;
let authoredFeatureOriginal: AuthoredMapFeature | null = null;
let authoredFeatureHistorySnapshot: EditorSnapshot | null = null;
let authoredFeaturePointerStart: AuthoringPoint | null = null;
let draggedImageId: string | null = null;
let draggedImageOffsetX = 0;
let draggedImageOffsetY = 0;
let draggedImageOriginal: PlacedImage | null = null;
let draggedImageHistorySnapshot: EditorSnapshot | null = null;
const history = new HistoryManager<EditorSnapshot>(64);
let restoringHistory = false;
type WorkspaceMode = 'editor' | 'dm';
interface DmSessionEntry {
  readonly time: string;
  readonly site: string;
  readonly title: string;
  readonly danger: string;
}
let activeWorkspace: WorkspaceMode = localStorage.getItem(WORKSPACE_STORAGE_KEY) === 'editor' ? 'editor' : 'dm';
let dmSessionEntries: DmSessionEntry[] = [];
type StudioTab = 'inspector' | 'layers' | 'project';
type UiTheme = 'dark' | 'light' | 'contrast';
interface InspectorSelection {
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly subtitle: string;
}
interface RecentProjectEntry {
  readonly seed: string;
  readonly terrainSize: TerrainSize;
  readonly townScale: TownScale;
  readonly terrainShape: TerrainShape;
  readonly climatePreset: ClimatePreset;
  readonly islandCount: number;
  readonly islandSpacingKilometers: number;
  readonly satelliteSettlementCount: number;
  readonly updatedAt: string;
}
interface CommandDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly shortcut?: string;
  readonly run: () => void | Promise<void>;
}
let activeStudioTab: StudioTab = (localStorage.getItem(UI_STUDIO_TAB_STORAGE_KEY) as StudioTab | null) ?? 'inspector';
let selectedInspectorItem: InspectorSelection | null = null;
let pointerTravel = 0;
let activeCommandIndex = 0;
let filteredCommands: CommandDefinition[] = [];
let autosaveTimer: number | null = null;
let minimapBase: HTMLCanvasElement | null = null;
let activeTravelPlan: TravelPlan | null = null;
let activeTravelAlternatives: readonly TravelPlan[] = [];
let activeTravelNormalDuration: number | null = null;
let travelPickTarget: 'from' | 'to' | null = null;
const customTravelLocations = new Map<string, TravelLocation>();

function updateAssetTargetOptions(): void {
  const category = assetTargetCategory.value as AssetTargetCategory;
  const targets = assetTargetsFor(category);
  assetTargetType.replaceChildren();
  if (targets.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No procedural target';
    assetTargetType.append(option);
    assetTargetType.disabled = true;
    return;
  }
  assetTargetType.disabled = false;
  for (const target of targets) {
    const option = document.createElement('option');
    option.value = target.value;
    option.textContent = target.label;
    assetTargetType.append(option);
  }
}

updateAssetTargetOptions();

function setAuthoringStatus(message: string, tone: 'neutral' | 'warning' | 'danger' = 'neutral'): void {
  authoringStatus.textContent = message;
  if (tone === 'neutral') delete authoringStatus.dataset.tone;
  else authoringStatus.dataset.tone = tone;
}

function authoringFeatureCenter(feature: AuthoredMapFeature): AuthoringPoint {
  const geometry = transformAuthoringGeometry(feature.geometry, feature.rotation, feature.scale);
  if (geometry.kind === 'point') return geometry.point;
  if (geometry.kind === 'circle') return geometry.center;
  if (geometry.points.length === 0) return { x: 0, y: 0 };
  return {
    x: geometry.points.reduce((sum, point) => sum + point.x, 0) / geometry.points.length,
    y: geometry.points.reduce((sum, point) => sum + point.y, 0) / geometry.points.length,
  };
}

function translateGeometry(geometry: AuthoringGeometry, deltaX: number, deltaY: number): AuthoringGeometry {
  const move = (point: AuthoringPoint): AuthoringPoint => ({ x: point.x + deltaX, y: point.y + deltaY });
  if (geometry.kind === 'point') return { kind: 'point', point: move(geometry.point) };
  if (geometry.kind === 'circle') return { kind: 'circle', center: move(geometry.center), radius: geometry.radius };
  return { kind: geometry.kind, points: geometry.points.map(move) };
}

function updateAuthoringSelectionActions(): void {
  const selectedFeature = activeAuthoringFeatureId === null
    ? undefined
    : authoringLayer.features.find((feature) => feature.id === activeAuthoringFeatureId);
  const hasFeature = selectedFeature !== undefined;
  const hasSettlement = activeAuthoringSettlementKey !== null;
  authoringResetSelected.disabled = !hasFeature && !hasSettlement;
  authoringDeleteSelected.disabled = !hasFeature && !hasSettlement;
  authoringDuplicateSettlement.disabled = !hasSettlement && !isPointAnchorFeature(selectedFeature);
}

function setAuthoringTool(tool: typeof authoringTool): void {
  if (tool !== 'select') {
    if (editMode) setEditMode(false);
    if (zoneEditMode) setZoneEditMode(false);
  }
  authoringTool = tool;
  authoringModeBadge.textContent = tool.replace('-', ' ').toLocaleUpperCase();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-authoring-tool]')) {
    button.classList.toggle('active', button.dataset.authoringTool === tool);
  }
  canvas.classList.remove('authoring-crosshair', 'authoring-drawing', 'authoring-terrain', 'authoring-select');
  canvas.classList.add(tool === 'terrain-brush' ? 'authoring-terrain' : tool === 'select' ? 'authoring-select' : tool === 'anchor' || tool === 'point' ? 'authoring-crosshair' : 'authoring-drawing');
  if (tool !== 'polyline' && tool !== 'polygon') authoringDraftPoints = [];
  authoringFinishFeature.disabled = !(tool === 'polyline' || tool === 'polygon') || authoringDraftPoints.length < (tool === 'polygon' ? 3 : 2);
  authoringCancelFeature.disabled = tool === 'select' && pendingSettlementPlacement === null && !pendingPointAnchorPlacement && authoringDraftPoints.length === 0;
  if (tool === 'select') setAuthoringStatus('Select or move point anchors and community settlements on the map.');
  else if (tool === 'anchor') {
    const anchorType = selectedAuthoringAnchorType();
    const moving = anchorType === 'point'
      ? activeAuthoringFeatureId !== null && isPointAnchorFeature(authoringLayer.features.find((feature) => feature.id === activeAuthoringFeatureId))
      : activeAuthoringSettlementKey !== null && pendingSettlementPlacement === null;
    setAuthoringStatus(moving
      ? `Click the map to move the selected ${anchorType === 'point' ? 'anchor point' : 'community anchor'}.`
      : `Click the map to place the new ${anchorType === 'point' ? 'anchor point' : 'community anchor'}. Placement warnings will not block you.`);
  }
  else if (tool === 'point') setAuthoringStatus('Click the map to place the authored feature.');
  else if (tool === 'polyline') setAuthoringStatus('Click to add path vertices, then Finish shape.');
  else if (tool === 'polygon') setAuthoringStatus('Click around the area boundary, then Finish shape.');
  else setAuthoringStatus('Drag the brush over the map. Changes commit when you release the pointer.');
  syncRendererCustomization();
}

function upsertSettlementAuthoringOverride(next: SettlementAuthoringOverride): void {
  authoringLayer = {
    ...authoringLayer,
    settlementOverrides: [...authoringLayer.settlementOverrides.filter((item) => item.key !== next.key), next],
  };
}

function removeSettlementAuthoringOverride(key: string): void {
  authoringLayer = { ...authoringLayer, settlementOverrides: authoringLayer.settlementOverrides.filter((item) => item.key !== key) };
}

type AuthoringAnchorType = 'point' | SettlementKind;

function selectedAuthoringAnchorType(): AuthoringAnchorType {
  const value = authoringSettlementKind.value;
  return value === 'point' || SETTLEMENT_KINDS.includes(value as SettlementKind)
    ? value as AuthoringAnchorType
    : 'point';
}

function isSettlementAnchorType(value: AuthoringAnchorType): value is SettlementKind {
  return value !== 'point';
}

type PointAnchorFeature = AuthoredMapFeature & {
  readonly subtype: 'anchor-point';
  readonly geometry: { readonly kind: 'point'; readonly point: AuthoringPoint };
};

function isPointAnchorFeature(feature: AuthoredMapFeature | undefined): feature is PointAnchorFeature {
  return feature !== undefined
    && feature.category === 'landmark'
    && feature.subtype === 'anchor-point'
    && feature.geometry.kind === 'point';
}

function updateAuthoringAnchorTypeUi(): void {
  const settlement = isSettlementAnchorType(selectedAuthoringAnchorType());
  for (const field of settlementAnchorOnlyFields) field.hidden = !settlement;
  authoringPlaceSettlement.textContent = settlement ? 'Place settlement anchor' : 'Place point anchor';
  const selectedPoint = activeAuthoringFeatureId === null
    ? undefined
    : authoringLayer.features.find((feature) => feature.id === activeAuthoringFeatureId);
  authoringApplySettlement.disabled = settlement ? activeAuthoringSettlementKey === null : !isPointAnchorFeature(selectedPoint);
  updateAuthoringSelectionActions();
}

function pointAnchorFromForm(x: number, y: number, nameSuffix = ''): AuthoredMapFeature {
  const now = new Date().toISOString();
  const visibility = authoringSettlementVisibility.value as AuthoringVisibility;
  return {
    id: createRuleId(),
    name: `${authoringSettlementName.value.trim() || 'New Anchor'}${nameSuffix}`,
    category: 'landmark',
    subtype: 'anchor-point',
    geometry: { kind: 'point', point: { x, y } },
    realityLayer: 'normal',
    visibility,
    locked: false,
    hidden: visibility === 'hidden',
    opacity: 1,
    lineWidth: 2,
    fillOpacity: 0.2,
    color: '#f2c05e',
    rotation: 0,
    scale: 1,
    aliases: [],
    tags: ['anchor-point'],
    notes: authoringSettlementNotes.value.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

function settlementFormValues(): Omit<AuthoredSettlementDefinition, 'key' | 'x' | 'y'> {
  return {
    name: authoringSettlementName.value.trim() || 'New Community',
    kind: authoringSettlementKind.value as SettlementKind,
    radius: Math.max(2, Math.min(100, Number(authoringSettlementRadius.value) || 10)),
    rotation: Math.max(-180, Math.min(180, Number(authoringSettlementRotation.value) || 0)) * Math.PI / 180,
    populationTarget: Math.max(0, Math.min(500_000, Math.round(Number(authoringSettlementPopulation.value) || 0))),
    density: Math.max(0, Math.min(1, Number(authoringSettlementDensity.value) || 0.55)),
    parentKey: authoringSettlementParent.value || null,
    generateRoads: authoringSettlementRoads.checked,
    generateBuildings: authoringSettlementBuildings.checked,
    locked: false,
    hidden: authoringSettlementVisibility.value === 'hidden',
    visibility: authoringSettlementVisibility.value as AuthoringVisibility,
    notes: authoringSettlementNotes.value.trim(),
  };
}

function populateSettlementParentOptions(): void {
  const selected = authoringSettlementParent.value;
  authoringSettlementParent.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'None';
  authoringSettlementParent.append(none);
  if (world !== undefined) {
    for (const settlement of world.settlements) {
      if (settlement.key === activeAuthoringSettlementKey) continue;
      const option = document.createElement('option');
      option.value = settlement.key;
      option.textContent = settlement.name;
      authoringSettlementParent.append(option);
    }
  }
  authoringSettlementParent.value = [...authoringSettlementParent.options].some((option) => option.value === selected) ? selected : '';
}

function loadSettlementIntoForm(key: string): void {
  const settlement = world.settlements.find((item) => item.key === key);
  if (settlement === undefined) return;
  activeAuthoringSettlementKey = key;
  activeAuthoringFeatureId = null;
  pendingSettlementPlacement = null;
  authoringSettlementName.value = settlement.name;
  authoringSettlementKind.value = settlement.kind ?? (settlement.isPrimary ? 'city' : 'barangay');
  updateAuthoringAnchorTypeUi();
  authoringSettlementRadius.value = String(Math.round(settlement.influenceRadius));
  authoringSettlementRotation.value = String(Math.round((settlement.rotation ?? 0) * 180 / Math.PI));
  authoringSettlementPopulation.value = String(settlement.populationTarget);
  authoringSettlementDensity.value = String(settlement.density ?? 0.55);
  authoringSettlementVisibility.value = settlement.visibility ?? (settlement.hidden === true ? 'hidden' : 'players');
  authoringSettlementNotes.value = settlement.notes ?? '';
  authoringSettlementRoads.checked = settlement.generateRoads !== false;
  authoringSettlementBuildings.checked = settlement.generateBuildings !== false;
  populateSettlementParentOptions();
  authoringSettlementParent.value = settlement.parentKey ?? '';
  updateAuthoringSelectionActions();
  renderAuthoringLists();
  syncRendererCustomization();
  setAuthoringStatus(`Selected ${settlement.name}. Edit its properties, move it on the map, lock it, hide it, or reset it.`);
}

function loadPointAnchorIntoForm(id: string): void {
  const feature = authoringLayer.features.find((item) => item.id === id);
  if (!isPointAnchorFeature(feature)) return;
  activeAuthoringFeatureId = id;
  activeAuthoringSettlementKey = null;
  pendingPointAnchorPlacement = false;
  pendingSettlementPlacement = null;
  authoringSettlementKind.value = 'point';
  authoringSettlementName.value = feature.name;
  authoringSettlementVisibility.value = feature.visibility;
  authoringSettlementNotes.value = feature.notes;
  updateAuthoringAnchorTypeUi();
  updateAuthoringSelectionActions();
  renderAuthoringLists();
  syncRendererCustomization();
  setAuthoringStatus(`Selected ${feature.name}. Edit its anchor details, move it, duplicate it, hide it, or delete it.`);
}

function loadFeatureIntoForm(id: string): void {
  const feature = authoringLayer.features.find((item) => item.id === id);
  if (feature === undefined) return;
  activeAuthoringFeatureId = id;
  activeAuthoringSettlementKey = null;
  authoringFeatureName.value = feature.name;
  authoringFeatureCategory.value = feature.category;
  authoringFeatureSubtype.value = feature.subtype;
  authoringFeatureReality.value = feature.realityLayer;
  authoringFeatureVisibility.value = feature.visibility;
  authoringFeatureColor.value = feature.color ?? '#d1aa72';
  authoringFeatureLineWidth.value = String(feature.lineWidth);
  authoringFeatureFill.value = String(feature.fillOpacity);
  authoringFeatureScale.value = String(feature.scale);
  authoringFeatureRotation.value = String(Math.round(feature.rotation * 180 / Math.PI));
  authoringFeatureOpacity.value = String(feature.opacity);
  authoringFeatureAliases.value = feature.aliases.join(', ');
  authoringFeatureNotes.value = feature.notes;
  authoringStartFeature.textContent = 'Apply feature details';
  updateAuthoringSelectionActions();
  renderAuthoringLists();
  syncRendererCustomization();
  setAuthoringStatus(`Selected ${feature.name}. Drag it in Select mode or apply revised metadata.`);
}

function authoredFeatureFromGeometry(geometry: AuthoringGeometry): AuthoredMapFeature {
  const now = new Date().toISOString();
  const category = authoringFeatureCategory.value as AuthoringFeatureCategory;
  const realityLayer = category === 'hidden-payaw' ? 'hidden-payaw' : authoringFeatureReality.value as AuthoringRealityLayer;
  return {
    id: createRuleId(),
    name: authoringFeatureName.value.trim() || 'Authored feature',
    category,
    subtype: authoringFeatureSubtype.value.trim() || 'custom',
    geometry,
    realityLayer,
    visibility: authoringFeatureVisibility.value as AuthoringVisibility,
    locked: false,
    hidden: authoringFeatureVisibility.value === 'hidden',
    opacity: Math.max(0.1, Math.min(1, Number(authoringFeatureOpacity.value) || 0.92)),
    lineWidth: Math.max(0.5, Number(authoringFeatureLineWidth.value) || 2),
    fillOpacity: Math.max(0, Math.min(0.7, Number(authoringFeatureFill.value) || 0)),
    color: normalizeHexColor(authoringFeatureColor.value),
    rotation: Math.max(-180, Math.min(180, Number(authoringFeatureRotation.value) || 0)) * Math.PI / 180,
    scale: Math.max(0.25, Math.min(8, Number(authoringFeatureScale.value) || 1)),
    aliases: authoringFeatureAliases.value.split(',').map((value) => value.trim()).filter(Boolean),
    tags: [],
    notes: authoringFeatureNotes.value.trim(),
    createdAt: now,
    updatedAt: now,
  };
}


function generatedSourceTag(entityType: 'road' | 'building', entityId: number): string {
  return `generated-source:${entityType}:${entityId}`;
}

function generatedSourceForFeature(feature: AuthoredMapFeature): { entityType: 'road' | 'building'; entityId: number } | null {
  for (const tag of feature.tags) {
    const match = /^generated-source:(road|building):(\d+)$/.exec(tag);
    if (match === null) continue;
    const entityId = Number(match[2]);
    if (Number.isInteger(entityId)) return { entityType: match[1] as 'road' | 'building', entityId };
  }
  return null;
}

function replacementFeature(
  name: string,
  category: 'road' | 'building',
  subtype: string,
  geometry: AuthoringGeometry,
  entityId: number,
): AuthoredMapFeature {
  const now = new Date().toISOString();
  return {
    id: createRuleId(),
    name,
    category,
    subtype,
    geometry,
    realityLayer: 'normal',
    visibility: 'players',
    locked: false,
    hidden: false,
    opacity: 0.94,
    lineWidth: category === 'road' ? 2 : 1.2,
    fillOpacity: category === 'building' ? 0.48 : 0,
    color: category === 'road' ? '#d1aa72' : '#d9c8a7',
    rotation: 0,
    scale: 1,
    aliases: [],
    tags: [generatedSourceTag(category, entityId)],
    notes: `Authored replacement for generated ${category} #${entityId}. Reset this feature to restore the generated original.`,
    createdAt: now,
    updatedAt: now,
  };
}

function suppressGeneratedFeature(override: GeneratedFeatureOverride): void {
  authoringLayer = {
    ...authoringLayer,
    generatedFeatureOverrides: [
      ...authoringLayer.generatedFeatureOverrides.filter((item) => !(item.entityType === override.entityType && item.entityId === override.entityId)),
      override,
    ],
  };
}

function adoptGeneratedRoad(road: Road): void {
  if (road.source === 'authored' || road.path.length < 2 || road.bridgeId !== null || road.portId !== null) return;
  const sourceId = road.generatedId ?? road.id;
  const points = road.path.flatMap((tileIndex, index) => {
    const tile = world.tiles[tileIndex];
    if (tile === undefined) return [];
    const keep = index === 0 || index === road.path.length - 1 || index % 3 === 0;
    return keep ? [{ x: tile.x, y: tile.y }] : [];
  });
  if (points.length < 2) return;
  const snapshot = captureEditorSnapshot();
  const feature = replacementFeature(road.name || `Road ${sourceId + 1}`, 'road', road.type, { kind: 'polyline', points }, sourceId);
  suppressGeneratedFeature({ key: `generated-road:${sourceId}`, entityType: 'road', entityId: sourceId, suppressed: true, locked: false });
  authoringLayer = { ...authoringLayer, features: [...authoringLayer.features, feature] };
  activeAuthoringFeatureId = feature.id;
  persistMapCustomization();
  if (regenerateFrom('road-network', `Converted ${feature.name} into an authored road.`)) recordHistory(snapshot, `adopt road ${sourceId}`);
  loadFeatureIntoForm(feature.id);
}

function adoptGeneratedBuilding(building: Building): void {
  if (building.footprint.length < 3) return;
  const sourceId = building.generatedId ?? building.id;
  const snapshot = captureEditorSnapshot();
  const name = building.authoredName ?? building.type.replaceAll('-', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
  const feature = replacementFeature(name, 'building', building.type, { kind: 'polygon', points: building.footprint.map((point) => ({ x: point.x, y: point.y })) }, sourceId);
  suppressGeneratedFeature({ key: `generated-building:${sourceId}`, entityType: 'building', entityId: sourceId, suppressed: true, locked: false });
  authoringLayer = { ...authoringLayer, features: [...authoringLayer.features, feature] };
  activeAuthoringFeatureId = feature.id;
  persistMapCustomization();
  if (regenerateFrom('buildings', `Converted building #${sourceId} into an authored building.`)) recordHistory(snapshot, `adopt building ${sourceId}`);
  loadFeatureIntoForm(feature.id);
}

function featureRegenerationStage(feature: AuthoredMapFeature): string | null {
  if (feature.category === 'river') return 'terrain';
  if (feature.category === 'road') return 'road-network';
  if (feature.category === 'building') return 'buildings';
  return null;
}

function commitAuthoredFeature(feature: AuthoredMapFeature, label: string, snapshot: EditorSnapshot): void {
  authoringLayer = { ...authoringLayer, features: [...authoringLayer.features, feature] };
  persistMapCustomization();
  activeAuthoringFeatureId = feature.id;
  activeAuthoringSettlementKey = null;
  authoringDraftPoints = [];
  const stage = featureRegenerationStage(feature);
  if (stage !== null) regenerateFrom(stage, `Added ${feature.name}.`);
  else {
    syncRendererCustomization();
    renderAuthoringLists();
    scheduleAutosave();
  }
  recordHistory(snapshot, label);
  loadFeatureIntoForm(feature.id);
}

function finishAuthoredFeature(): void {
  const minimum = authoringTool === 'polygon' ? 3 : 2;
  if ((authoringTool !== 'polyline' && authoringTool !== 'polygon') || authoringDraftPoints.length < minimum) {
    setAuthoringStatus(`Add at least ${minimum} points before finishing.`, 'warning');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const geometry: AuthoringGeometry = authoringTool === 'polygon'
    ? { kind: 'polygon', points: [...authoringDraftPoints] }
    : { kind: 'polyline', points: [...authoringDraftPoints] };
  const feature = authoredFeatureFromGeometry(geometry);
  commitAuthoredFeature(feature, `draw ${feature.category}`, snapshot);
  setAuthoringTool('select');
}

function applyFeatureDetails(): void {
  if (activeAuthoringFeatureId === null) {
    const category = authoringFeatureCategory.value as AuthoringFeatureCategory;
    const inferred: typeof authoringTool = category === 'road' || category === 'river'
      ? 'polyline'
      : category === 'district' || category === 'terrain' || category === 'building'
        ? 'polygon'
        : 'point';
    setAuthoringTool(inferred);
    return;
  }
  const existing = authoringLayer.features.find((item) => item.id === activeAuthoringFeatureId);
  if (existing === undefined) return;
  const snapshot = captureEditorSnapshot();
  const category = authoringFeatureCategory.value as AuthoringFeatureCategory;
  const updated: AuthoredMapFeature = {
    ...existing,
    name: authoringFeatureName.value.trim() || existing.name,
    category,
    subtype: authoringFeatureSubtype.value.trim() || 'custom',
    realityLayer: category === 'hidden-payaw' ? 'hidden-payaw' : authoringFeatureReality.value as AuthoringRealityLayer,
    visibility: authoringFeatureVisibility.value as AuthoringVisibility,
    hidden: authoringFeatureVisibility.value === 'hidden',
    color: normalizeHexColor(authoringFeatureColor.value),
    lineWidth: Math.max(0.5, Number(authoringFeatureLineWidth.value) || 2),
    fillOpacity: Math.max(0, Math.min(0.7, Number(authoringFeatureFill.value) || 0)),
    opacity: Math.max(0.1, Math.min(1, Number(authoringFeatureOpacity.value) || existing.opacity)),
    rotation: Math.max(-180, Math.min(180, Number(authoringFeatureRotation.value) || 0)) * Math.PI / 180,
    scale: Math.max(0.25, Math.min(8, Number(authoringFeatureScale.value) || 1)),
    aliases: authoringFeatureAliases.value.split(',').map((value) => value.trim()).filter(Boolean),
    notes: authoringFeatureNotes.value.trim(),
    updatedAt: new Date().toISOString(),
  };
  authoringLayer = { ...authoringLayer, features: authoringLayer.features.map((item) => item.id === updated.id ? updated : item) };
  persistMapCustomization();
  const oldStage = featureRegenerationStage(existing);
  const newStage = featureRegenerationStage(updated);
  const stage = oldStage === 'terrain' || newStage === 'terrain' ? 'terrain' : oldStage === 'road-network' || newStage === 'road-network' ? 'road-network' : null;
  if (stage !== null) regenerateFrom(stage, `Updated ${updated.name}.`);
  else { syncRendererCustomization(); renderAuthoringLists(); }
  recordHistory(snapshot, `edit ${updated.name}`);
  setAuthoringStatus(`Updated ${updated.name}.`);
}

function geometryDistance(feature: AuthoredMapFeature, x: number, y: number): number {
  const geometry = transformAuthoringGeometry(feature.geometry, feature.rotation, feature.scale);
  if (geometry.kind === 'point') return Math.hypot(x - geometry.point.x, y - geometry.point.y);
  if (geometry.kind === 'circle') return Math.abs(Math.hypot(x - geometry.center.x, y - geometry.center.y) - geometry.radius);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < geometry.points.length - 1; index += 1) {
    const a = geometry.points[index];
    const b = geometry.points[index + 1];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  if (geometry.kind === 'polygon') {
    const first = geometry.points[0];
    const last = geometry.points[geometry.points.length - 1];
    if (first !== undefined && last !== undefined) {
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - last.x) * dx + (y - last.y) * dy) / lengthSquared));
      best = Math.min(best, Math.hypot(x - (last.x + dx * t), y - (last.y + dy * t)));
    }
  }
  return best;
}

function hitAuthoredFeature(x: number, y: number): AuthoredMapFeature | undefined {
  const threshold = Math.max(1.2, 9 / Math.max(1, camera.zoom));
  return [...authoringLayer.features].reverse().find((feature) => !feature.hidden && geometryDistance(feature, x, y) <= threshold);
}

function duplicateAuthoredFeature(feature: AuthoredMapFeature): void {
  const snapshot = captureEditorSnapshot();
  const now = new Date().toISOString();
  const duplicate: AuthoredMapFeature = {
    ...feature,
    id: createRuleId(),
    name: `${feature.name} Copy`,
    geometry: translateGeometry(feature.geometry, 2, 2),
    locked: false,
    hidden: false,
    tags: feature.tags.filter((tag) => !tag.startsWith('generated-source:')),
    createdAt: now,
    updatedAt: now,
  };
  authoringLayer = { ...authoringLayer, features: [...authoringLayer.features, duplicate] };
  activeAuthoringFeatureId = duplicate.id;
  activeAuthoringSettlementKey = null;
  persistMapCustomization();
  const stage = featureRegenerationStage(duplicate);
  if (stage !== null) regenerateFrom(stage, `Duplicated ${feature.name}.`);
  else { renderAuthoringLists(); syncRendererCustomization(); scheduleAutosave(); }
  recordHistory(snapshot, `duplicate ${feature.name}`);
  loadFeatureIntoForm(duplicate.id);
}

function renderAuthoringLists(): void {
  populateSettlementParentOptions();
  authoringSettlementList.replaceChildren();
  for (const feature of authoringLayer.features.filter(isPointAnchorFeature)) {
    const item = document.createElement('article');
    item.className = 'authoring-item';
    item.dataset.selected = String(activeAuthoringFeatureId === feature.id);
    item.dataset.hidden = String(feature.hidden);
    const copy = document.createElement('div');
    copy.className = 'authoring-item-copy';
    const title = document.createElement('strong');
    title.textContent = feature.name;
    const detail = document.createElement('small');
    detail.textContent = `Authored · point of interest${feature.locked ? ' · locked' : ''}`;
    copy.append(title, detail);
    const actions = document.createElement('div');
    actions.className = 'authoring-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => loadPointAnchorIntoForm(feature.id));
    const focus = document.createElement('button');
    focus.type = 'button'; focus.textContent = 'Focus'; focus.addEventListener('click', () => { const center = authoringFeatureCenter(feature); focusMapPoint(center.x, center.y); });
    const duplicate = document.createElement('button');
    duplicate.type = 'button'; duplicate.textContent = 'Duplicate'; duplicate.addEventListener('click', () => { loadPointAnchorIntoForm(feature.id); beginSettlementPlacement(true); });
    const lock = document.createElement('button');
    lock.type = 'button'; lock.textContent = feature.locked ? 'Unlock' : 'Lock';
    lock.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      authoringLayer = { ...authoringLayer, features: authoringLayer.features.map((candidate) => candidate.id === feature.id ? { ...candidate, locked: !candidate.locked, updatedAt: new Date().toISOString() } : candidate) };
      persistMapCustomization(); renderAuthoringLists(); syncRendererCustomization(); recordHistory(snapshot, `${feature.locked ? 'unlock' : 'lock'} anchor point`);
    });
    const hide = document.createElement('button');
    hide.type = 'button'; hide.textContent = feature.hidden ? 'Show' : 'Hide';
    hide.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      authoringLayer = { ...authoringLayer, features: authoringLayer.features.map((candidate) => candidate.id === feature.id ? { ...candidate, hidden: !candidate.hidden, visibility: candidate.hidden ? 'players' : 'hidden', updatedAt: new Date().toISOString() } : candidate) };
      persistMapCustomization(); renderAuthoringLists(); syncRendererCustomization(); recordHistory(snapshot, `${feature.hidden ? 'show' : 'hide'} anchor point`);
    });
    actions.append(edit, focus, duplicate, lock, hide);
    item.append(copy, actions);
    authoringSettlementList.append(item);
  }
  if (world !== undefined) {
    for (const settlement of world.settlements) {
      const item = document.createElement('article');
      item.className = 'authoring-item';
      item.dataset.selected = String(activeAuthoringSettlementKey === settlement.key);
      item.dataset.hidden = String(settlement.hidden === true);
      const copy = document.createElement('div');
      copy.className = 'authoring-item-copy';
      const title = document.createElement('strong');
      title.textContent = settlement.name;
      const detail = document.createElement('small');
      detail.textContent = `${settlement.source === 'authored' ? 'Authored' : 'Generated'} · ${(settlement.kind ?? settlement.type).replaceAll('-', ' ')} · ${Math.round(settlement.influenceRadius)} tile radius${settlement.locked === true ? ' · locked' : ''}`;
      copy.append(title, detail);
      const actions = document.createElement('div');
      actions.className = 'authoring-item-actions';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => loadSettlementIntoForm(settlement.key));
      const focus = document.createElement('button');
      focus.type = 'button'; focus.textContent = 'Focus'; focus.addEventListener('click', () => focusMapPoint(settlement.x, settlement.y));
      const lock = document.createElement('button');
      lock.type = 'button'; lock.textContent = settlement.locked === true ? 'Unlock' : 'Lock';
      lock.addEventListener('click', () => {
        const snapshot = captureEditorSnapshot();
        const existing = authoringLayer.settlementOverrides.find((override) => override.key === settlement.key);
        upsertSettlementAuthoringOverride({ ...existing, key: settlement.key, locked: settlement.locked !== true });
        persistMapCustomization();
        if (regenerateFrom('settlements', `${settlement.locked === true ? 'Unlocked' : 'Locked'} ${settlement.name}.`)) recordHistory(snapshot, `${settlement.locked === true ? 'unlock' : 'lock'} settlement`);
      });
      const hide = document.createElement('button');
      hide.type = 'button'; hide.textContent = settlement.hidden === true ? 'Show' : 'Hide';
      hide.addEventListener('click', () => {
        const snapshot = captureEditorSnapshot();
        const existing = authoringLayer.settlementOverrides.find((override) => override.key === settlement.key);
        upsertSettlementAuthoringOverride({ ...existing, key: settlement.key, hidden: settlement.hidden !== true, visibility: settlement.hidden === true ? 'players' : 'hidden' });
        persistMapCustomization();
        if (regenerateFrom('settlements', `${settlement.hidden === true ? 'Showed' : 'Hid'} ${settlement.name}.`)) recordHistory(snapshot, `${settlement.hidden === true ? 'show' : 'hide'} settlement`);
      });
      actions.append(edit, focus, lock, hide);
      item.append(copy, actions);
      authoringSettlementList.append(item);
    }
  }

  authoringFeatureList.replaceChildren();
  for (const feature of authoringLayer.features.filter((candidate) => !isPointAnchorFeature(candidate))) {
    const item = document.createElement('article');
    item.className = 'authoring-item';
    item.dataset.selected = String(activeAuthoringFeatureId === feature.id);
    item.dataset.hidden = String(feature.hidden);
    const copy = document.createElement('div');
    copy.className = 'authoring-item-copy';
    const title = document.createElement('strong');
    title.textContent = feature.name;
    const detail = document.createElement('small');
    detail.textContent = `${feature.category.replaceAll('-', ' ')} · ${feature.subtype.replaceAll('-', ' ')} · ${feature.geometry.kind}${feature.locked ? ' · locked' : ''}`;
    copy.append(title, detail);
    const actions = document.createElement('div');
    actions.className = 'authoring-item-actions';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => loadFeatureIntoForm(feature.id));
    const focus = document.createElement('button');
    focus.type = 'button'; focus.textContent = 'Focus'; focus.addEventListener('click', () => { const center = authoringFeatureCenter(feature); focusMapPoint(center.x, center.y); });
    const duplicate = document.createElement('button');
    duplicate.type = 'button'; duplicate.textContent = 'Duplicate'; duplicate.addEventListener('click', () => duplicateAuthoredFeature(feature));
    const lock = document.createElement('button');
    lock.type = 'button'; lock.textContent = feature.locked ? 'Unlock' : 'Lock';
    lock.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      authoringLayer = { ...authoringLayer, features: authoringLayer.features.map((itemFeature) => itemFeature.id === feature.id ? { ...itemFeature, locked: !itemFeature.locked, updatedAt: new Date().toISOString() } : itemFeature) };
      persistMapCustomization(); renderAuthoringLists(); syncRendererCustomization(); recordHistory(snapshot, `${feature.locked ? 'unlock' : 'lock'} feature`);
    });
    const hide = document.createElement('button');
    hide.type = 'button'; hide.textContent = feature.hidden ? 'Show' : 'Hide';
    hide.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      const updated = { ...feature, hidden: !feature.hidden, updatedAt: new Date().toISOString() };
      authoringLayer = { ...authoringLayer, features: authoringLayer.features.map((itemFeature) => itemFeature.id === feature.id ? updated : itemFeature) };
      persistMapCustomization();
      const stage = featureRegenerationStage(feature);
      if (stage !== null) regenerateFrom(stage, `${updated.hidden ? 'Hid' : 'Showed'} ${feature.name}.`);
      else { renderAuthoringLists(); syncRendererCustomization(); }
      recordHistory(snapshot, `${updated.hidden ? 'hide' : 'show'} feature`);
    });
    actions.append(edit, focus, duplicate, lock, hide);
    item.append(copy, actions);
    authoringFeatureList.append(item);
  }
  updateAuthoringSelectionActions();
}

function commitAnchorDetails(): void {
  const anchorType = selectedAuthoringAnchorType();
  if (anchorType === 'point') {
    const feature = activeAuthoringFeatureId === null
      ? undefined
      : authoringLayer.features.find((candidate) => candidate.id === activeAuthoringFeatureId);
    if (!isPointAnchorFeature(feature)) {
      setAuthoringStatus('Select a point anchor first, or choose Place point anchor to create one.', 'warning');
      return;
    }
    const snapshot = captureEditorSnapshot();
    const visibility = authoringSettlementVisibility.value as AuthoringVisibility;
    const updated: AuthoredMapFeature = {
      ...feature,
      name: authoringSettlementName.value.trim() || feature.name,
      visibility,
      hidden: visibility === 'hidden',
      notes: authoringSettlementNotes.value.trim(),
      updatedAt: new Date().toISOString(),
    };
    authoringLayer = {
      ...authoringLayer,
      features: authoringLayer.features.map((candidate) => candidate.id === updated.id ? updated : candidate),
    };
    persistMapCustomization();
    renderAuthoringLists();
    syncRendererCustomization();
    recordHistory(snapshot, `edit anchor point ${feature.name}`);
    setAuthoringStatus(`Updated ${updated.name}.`, 'neutral');
    return;
  }

  if (activeAuthoringSettlementKey === null) {
    setAuthoringStatus('Select a settlement anchor first, or choose Place settlement anchor to create one.', 'warning');
    return;
  }
  const settlement = world.settlements.find((item) => item.key === activeAuthoringSettlementKey);
  if (settlement === undefined) return;
  const snapshot = captureEditorSnapshot();
  const values = settlementFormValues();
  const existing = authoringLayer.settlementOverrides.find((override) => override.key === settlement.key);
  upsertSettlementAuthoringOverride({
    ...existing,
    key: settlement.key,
    name: values.name,
    kind: values.kind,
    radius: values.radius,
    rotation: values.rotation,
    populationTarget: values.populationTarget,
    density: values.density,
    generateRoads: values.generateRoads,
    generateBuildings: values.generateBuildings,
    parentKey: values.parentKey,
    visibility: values.visibility,
    hidden: values.hidden,
    notes: values.notes,
  });
  if (settlement.source === 'authored') {
    authoringLayer = {
      ...authoringLayer,
      authoredSettlements: authoringLayer.authoredSettlements.map((item) => item.key === settlement.key
        ? { ...item, rotation: values.rotation, populationTarget: values.populationTarget, density: values.density, generateRoads: values.generateRoads, generateBuildings: values.generateBuildings }
        : item),
    };
  }
  persistMapCustomization();
  if (regenerateFrom('settlements', `Updated ${values.name}.`)) recordHistory(snapshot, `edit settlement anchor ${settlement.name}`);
}

function beginSettlementPlacement(duplicate = false): void {
  const anchorType = selectedAuthoringAnchorType();
  if (anchorType === 'point') {
    const selectedFeature = activeAuthoringFeatureId === null
      ? undefined
      : authoringLayer.features.find((feature) => feature.id === activeAuthoringFeatureId);
    if (isPointAnchorFeature(selectedFeature) && !duplicate) {
      pendingPointAnchorPlacement = false;
      setAuthoringTool('anchor');
      return;
    }
    pendingPointAnchorPlacement = true;
    pendingSettlementPlacement = null;
    if (!duplicate) activeAuthoringFeatureId = null;
    activeAuthoringSettlementKey = null;
    setAuthoringTool('anchor');
    return;
  }

  const values = settlementFormValues();
  if (activeAuthoringSettlementKey !== null && !duplicate) {
    pendingSettlementPlacement = null;
    pendingPointAnchorPlacement = false;
    setAuthoringTool('anchor');
    return;
  }
  let x = world.width / 2;
  let y = world.height / 2;
  if (duplicate && activeAuthoringSettlementKey !== null) {
    const source = world.settlements.find((item) => item.key === activeAuthoringSettlementKey);
    if (source !== undefined) { x = source.x + 3; y = source.y + 3; }
  }
  pendingSettlementPlacement = {
    key: `settlement:authored:${createRuleId()}`,
    ...values,
    name: duplicate ? `${values.name} Copy` : values.name,
    x,
    y,
  };
  pendingPointAnchorPlacement = false;
  activeAuthoringSettlementKey = null;
  activeAuthoringFeatureId = null;
  setAuthoringTool('anchor');
}

function placePendingAnchor(x: number, y: number): void {
  const anchorType = selectedAuthoringAnchorType();
  if (anchorType === 'point') {
    const selectedFeature = activeAuthoringFeatureId === null
      ? undefined
      : authoringLayer.features.find((feature) => feature.id === activeAuthoringFeatureId);
    if (!pendingPointAnchorPlacement && isPointAnchorFeature(selectedFeature)) {
      if (selectedFeature.locked) {
        setAuthoringStatus(`${selectedFeature.name} is locked. Unlock it before moving.`, 'warning');
        setAuthoringTool('select');
        return;
      }
      const snapshot = captureEditorSnapshot();
      const updated: AuthoredMapFeature = {
        ...selectedFeature,
        geometry: { kind: 'point', point: { x, y } },
        updatedAt: new Date().toISOString(),
      };
      authoringLayer = { ...authoringLayer, features: authoringLayer.features.map((feature) => feature.id === updated.id ? updated : feature) };
      persistMapCustomization();
      renderAuthoringLists();
      syncRendererCustomization();
      recordHistory(snapshot, `move anchor point ${selectedFeature.name}`);
      setAuthoringTool('select');
      loadPointAnchorIntoForm(updated.id);
      return;
    }
    const snapshot = captureEditorSnapshot();
    const feature = pointAnchorFromForm(x, y, pendingPointAnchorPlacement && selectedFeature !== undefined ? ' Copy' : '');
    authoringLayer = { ...authoringLayer, features: [...authoringLayer.features, feature] };
    pendingPointAnchorPlacement = false;
    activeAuthoringFeatureId = feature.id;
    activeAuthoringSettlementKey = null;
    persistMapCustomization();
    renderAuthoringLists();
    syncRendererCustomization();
    recordHistory(snapshot, `create anchor point ${feature.name}`);
    setAuthoringTool('select');
    loadPointAnchorIntoForm(feature.id);
    return;
  }

  if (pendingSettlementPlacement === null) {
    if (activeAuthoringSettlementKey !== null) commitSettlementMove(activeAuthoringSettlementKey, x, y);
    setAuthoringTool('select');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const definition: AuthoredSettlementDefinition = { ...pendingSettlementPlacement, x: Math.round(x), y: Math.round(y) };
  authoringLayer = { ...authoringLayer, authoredSettlements: [...authoringLayer.authoredSettlements, definition] };
  pendingSettlementPlacement = null;
  activeAuthoringSettlementKey = definition.key;
  persistMapCustomization();
  if (regenerateFrom('settlements', `Created ${definition.name}.`)) recordHistory(snapshot, `create ${definition.kind} anchor`);
  setAuthoringTool('select');
  loadSettlementIntoForm(definition.key);
}


function commitAuthoringTerrain(indices: readonly number[]): void {
  if (indices.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const operation = authoringTerrainOperation.value;
  const strength = Math.max(0.01, Number(authoringTerrainStrength.value) || 0.08);
  const byIndex = new Map(authoringLayer.terrainOverrides.map((override) => [override.tileIndex, override]));
  for (const tileIndex of indices) {
    const current = byIndex.get(tileIndex) ?? { tileIndex, locked: false };
    if (current.locked && operation !== 'restore') continue;
    if (operation === 'restore') {
      byIndex.delete(tileIndex);
      continue;
    }
    if (operation === 'raise') byIndex.set(tileIndex, { ...current, elevationDelta: (current.elevationDelta ?? 0) + strength });
    else if (operation === 'lower') byIndex.set(tileIndex, { ...current, elevationDelta: (current.elevationDelta ?? 0) - strength });
    else if (operation === 'flatten') byIndex.set(tileIndex, { ...current, elevation: strength, elevationDelta: 0 });
    else if (operation === 'smooth') {
      const tile = world.tiles[tileIndex];
      if (tile === undefined) continue;
      const neighbors = [world.getTile(tile.x - 1, tile.y), world.getTile(tile.x + 1, tile.y), world.getTile(tile.x, tile.y - 1), world.getTile(tile.x, tile.y + 1)].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined);
      const average = neighbors.length === 0 ? tile.elevation : neighbors.reduce((sum, candidate) => sum + candidate.elevation, 0) / neighbors.length;
      const blend = Math.max(0.01, Math.min(1, strength));
      byIndex.set(tileIndex, { ...current, elevation: tile.elevation + (average - tile.elevation) * blend, elevationDelta: 0 });
    }
    else if (operation === 'river') byIndex.set(tileIndex, { ...current, river: true });
    else if (operation === 'erase-river') byIndex.set(tileIndex, { ...current, river: false });
    else {
      const terrain = authoringTerrainType.value as TerrainType;
      const water = terrain === TerrainType.DeepWater || terrain === TerrainType.ShallowWater ? WaterType.Ocean : terrain === TerrainType.Lake ? WaterType.Lake : WaterType.Land;
      byIndex.set(tileIndex, {
        ...current, terrain, water, river: terrain === TerrainType.RiverChannel ? true : current.river,
        forestDensity: terrain === TerrainType.Forest ? Math.max(current.forestDensity ?? 0, 0.85) : current.forestDensity,
        floodRisk: terrain === TerrainType.Floodplain ? Math.max(current.floodRisk ?? 0, 0.8) : current.floodRisk,
      });
    }
  }
  authoringLayer = { ...authoringLayer, terrainOverrides: [...byIndex.values()].sort((left, right) => left.tileIndex - right.tileIndex) };
  persistMapCustomization();
  if (regenerateFrom('terrain', `Applied ${operation.replace('-', ' ')} terrain authoring.`)) recordHistory(snapshot, `${operation} terrain`);
}

function resetAuthoringSelection(deleteSelection: boolean): void {
  if (activeAuthoringFeatureId !== null) {
    const feature = authoringLayer.features.find((item) => item.id === activeAuthoringFeatureId);
    if (feature === undefined) return;
    const snapshot = captureEditorSnapshot();
    const generatedSource = generatedSourceForFeature(feature);
    authoringLayer = { ...authoringLayer, features: authoringLayer.features.filter((item) => item.id !== feature.id) };
    if (!deleteSelection && generatedSource !== null) {
      authoringLayer = {
        ...authoringLayer,
        generatedFeatureOverrides: authoringLayer.generatedFeatureOverrides.filter((item) => !(item.entityType === generatedSource.entityType && item.entityId === generatedSource.entityId)),
      };
    }
    activeAuthoringFeatureId = null;
    persistMapCustomization();
    const stage = featureRegenerationStage(feature);
    if (stage !== null) regenerateFrom(stage, `${deleteSelection ? 'Deleted' : 'Reset'} ${feature.name}.`);
    else { renderAuthoringLists(); syncRendererCustomization(); }
    recordHistory(snapshot, `${deleteSelection ? 'delete' : 'reset'} feature`);
    authoringStartFeature.textContent = 'Draw with selected tool';
    return;
  }
  if (activeAuthoringSettlementKey === null) return;
  const settlement = world.settlements.find((item) => item.key === activeAuthoringSettlementKey);
  if (settlement === undefined) return;
  const snapshot = captureEditorSnapshot();
  if (settlement.source === 'authored') {
    authoringLayer = {
      ...authoringLayer,
      authoredSettlements: authoringLayer.authoredSettlements.filter((item) => item.key !== settlement.key),
      settlementOverrides: authoringLayer.settlementOverrides.filter((item) => item.key !== settlement.key),
    };
  } else if (deleteSelection) {
    const existing = authoringLayer.settlementOverrides.find((override) => override.key === settlement.key);
    upsertSettlementAuthoringOverride({ ...existing, key: settlement.key, suppressed: true });
  } else {
    removeSettlementAuthoringOverride(settlement.key);
    settlementPositionOverrides = settlementPositionOverrides.filter((item) => item.key !== settlement.key);
  }
  activeAuthoringSettlementKey = null;
  persistMapCustomization();
  if (regenerateFrom('settlements', `${deleteSelection ? 'Removed' : 'Reset'} ${settlement.name}.`)) recordHistory(snapshot, `${deleteSelection ? 'remove' : 'reset'} settlement`);
}

function handleAuthoringMapClick(x: number, y: number): boolean {
  if (authoringTool === 'anchor') { placePendingAnchor(x, y); return true; }
  if (authoringTool === 'point') {
    const snapshot = captureEditorSnapshot();
    const feature = authoredFeatureFromGeometry({ kind: 'point', point: { x, y } });
    commitAuthoredFeature(feature, `place ${feature.category}`, snapshot);
    setAuthoringTool('select');
    return true;
  }
  if (authoringTool === 'polyline' || authoringTool === 'polygon') {
    authoringDraftPoints = [...authoringDraftPoints, { x, y }];
    authoringFinishFeature.disabled = authoringDraftPoints.length < (authoringTool === 'polygon' ? 3 : 2);
    authoringCancelFeature.disabled = false;
    setAuthoringStatus(`${authoringDraftPoints.length} point${authoringDraftPoints.length === 1 ? '' : 's'} added. Continue or finish the shape.`);
    syncRendererCustomization();
    return true;
  }
  if (authoringTool === 'select') {
    const feature = hitAuthoredFeature(x, y);
    if (feature !== undefined) {
      if (isPointAnchorFeature(feature)) loadPointAnchorIntoForm(feature.id);
      else loadFeatureIntoForm(feature.id);
      return true;
    }
    const settlement = [...world.settlements].reverse().find((item) => Math.hypot(x - item.x, y - item.y) <= Math.max(1.4, 10 / Math.max(1, camera.zoom)));
    if (settlement !== undefined) { loadSettlementIntoForm(settlement.key); return true; }
  }
  return false;
}

function initializeAuthoringUi(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-authoring-tool]')) {
    button.addEventListener('click', () => setAuthoringTool(button.dataset.authoringTool as typeof authoringTool));
  }
  authoringPlaceSettlement.addEventListener('click', () => beginSettlementPlacement(false));
  authoringApplySettlement.addEventListener('click', commitAnchorDetails);
  authoringDuplicateSettlement.addEventListener('click', () => beginSettlementPlacement(true));
  authoringSettlementKind.addEventListener('change', () => {
    pendingSettlementPlacement = null;
    pendingPointAnchorPlacement = false;
    activeAuthoringSettlementKey = null;
    activeAuthoringFeatureId = null;
    updateAuthoringAnchorTypeUi();
    renderAuthoringLists();
    setAuthoringTool('select');
  });
  authoringStartFeature.addEventListener('click', applyFeatureDetails);
  authoringFinishFeature.addEventListener('click', finishAuthoredFeature);
  authoringCancelFeature.addEventListener('click', () => {
    pendingSettlementPlacement = null;
    pendingPointAnchorPlacement = false;
    authoringDraftPoints = [];
    authoringStartFeature.textContent = activeAuthoringFeatureId === null ? 'Draw with selected tool' : 'Apply feature details';
    setAuthoringTool('select');
  });
  authoringClearTerrain.addEventListener('click', () => {
    if (authoringLayer.terrainOverrides.length === 0) return;
    const snapshot = captureEditorSnapshot();
    authoringLayer = { ...authoringLayer, terrainOverrides: [] };
    persistMapCustomization();
    if (regenerateFrom('terrain', 'Cleared terrain overrides.')) recordHistory(snapshot, 'clear terrain overrides');
  });
  authoringLockTerrain.addEventListener('click', () => {
    const snapshot = captureEditorSnapshot();
    const lock = authoringLayer.terrainOverrides.some((override) => !override.locked);
    authoringLayer = { ...authoringLayer, terrainOverrides: authoringLayer.terrainOverrides.map((override) => ({ ...override, locked: lock })) };
    persistMapCustomization(); renderAuthoringLists(); syncRendererCustomization(); recordHistory(snapshot, `${lock ? 'lock' : 'unlock'} terrain overrides`);
    setAuthoringStatus(`${lock ? 'Locked' : 'Unlocked'} all terrain overrides.`);
  });
  authoringShowAll.addEventListener('click', () => {
    const snapshot = captureEditorSnapshot();
    authoringLayer = {
      ...authoringLayer,
      features: authoringLayer.features.map((feature) => ({ ...feature, hidden: false })),
      settlementOverrides: authoringLayer.settlementOverrides.map((override) => ({ ...override, hidden: false, visibility: override.visibility === 'hidden' ? 'gm-only' : override.visibility })),
    };
    persistMapCustomization();
    if (regenerateFrom('settlements', 'Revealed authored world features.')) recordHistory(snapshot, 'show authored world');
  });
  authoringResetSelected.addEventListener('click', () => resetAuthoringSelection(false));
  authoringDeleteSelected.addEventListener('click', () => resetAuthoringSelection(true));
  authoringFeatureCategory.addEventListener('change', () => {
    const category = authoringFeatureCategory.value as AuthoringFeatureCategory;
    if (category === 'hidden-payaw') authoringFeatureReality.value = 'hidden-payaw';
    if (category === 'river') authoringFeatureColor.value = '#4ba4cf';
    else if (category === 'natural') authoringFeatureColor.value = '#6cb778';
    else if (category === 'landmark') authoringFeatureColor.value = '#f2c05e';
    else if (category === 'district') authoringFeatureColor.value = '#73c7b0';
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-open-authoring]')) {
    button.addEventListener('click', () => {
      setWorkspace('editor');
      authoringCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  updateAuthoringAnchorTypeUi();
  setAuthoringTool('select');
}

function selectedTerrainSize(): TerrainSize {
  return terrainSizeSelect.value as TerrainSize;
}

function selectedTownScale(): TownScale {
  return townScaleSelect.value as TownScale;
}

function selectedTerrainShape(): TerrainShape { return terrainShapeSelect.value as TerrainShape; }
function selectedClimatePreset(): ClimatePreset { return climatePresetSelect.value as ClimatePreset; }
function selectedIslandCount(): number { return Math.max(2, Math.min(12, Math.round(Number(islandCountInput.value) || 5))); }
function selectedIslandSpacing(): number { return Math.max(0.5, Math.min(12, Number(islandSpacingInput.value) || 4)); }
function worldSignature(): string {
  return `${seedInput.value.trim()}|${selectedTerrainSize()}|${selectedTownScale()}|${selectedTerrainShape()}|${selectedClimatePreset()}|${selectedIslandCount()}|${selectedIslandSpacing().toFixed(2)}|${SATELLITE_SETTLEMENT_COUNT}`;
}

function generationOptions(
  candidateCustom: readonly CustomAnchorDefinition[] = customAnchors,
  candidateBuiltIns: readonly BuiltInAnchorOverride[] = builtInOverrides,
  candidateAnchorPositions: readonly AnchorPositionOverride[] = anchorPositionOverrides,
  candidateSettlementPositions: readonly SettlementPositionOverride[] = settlementPositionOverrides,
  candidateStoryPositions: readonly StoryPositionOverride[] = storyPositionOverrides,
): GenerationOptions {
  return {
    customAnchors: candidateCustom,
    builtInAnchorOverrides: candidateBuiltIns,
    terrainSize: selectedTerrainSize(),
    townScale: selectedTownScale(),
    terrainShape: selectedTerrainShape(),
    climatePreset: selectedClimatePreset(),
    islandCount: selectedIslandCount(),
    islandSpacingKilometers: selectedIslandSpacing(),
    satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT,
    roadNameOverrides,
    blockNameOverrides,
    anchorPositionOverrides: candidateAnchorPositions,
    settlementPositionOverrides: candidateSettlementPositions,
    authoredSettlements: authoringLayer.authoredSettlements,
    settlementAuthoringOverrides: authoringLayer.settlementOverrides,
    terrainOverrides: authoringLayer.terrainOverrides,
    generatedFeatureOverrides: authoringLayer.generatedFeatureOverrides,
    authoredFeatures: authoringLayer.features,
    storyPositionOverrides: candidateStoryPositions,
    storyRuleOverrides,
    zoneOverrides,
    customStoryPoints: customStoryDefinitions,
    islandOverrides,
    bridgeOverrides,
    customBridges,
    portOverrides,
    customPorts,
  };
}

function currentMapCustomization(): StoredMapCustomization {
  return {
    anchorPositions: anchorPositionOverrides,
    settlementPositions: settlementPositionOverrides,
    storyPositions: storyPositionOverrides,
    storyRules: storyRuleOverrides,
    zoneOverrides,
    placedImages,
    islandOverrides,
    bridgeOverrides,
    customBridges,
    portOverrides,
    customPorts,
    authoringLayer,
    npcLocationAuthoring,
  };
}

function persistMapCustomization(): void {
  if (activeWorldSignature.length === 0) return;
  saveMapCustomization(activeWorldSignature, currentMapCustomization());
}


function captureEditorSnapshot(): EditorSnapshot {
  return structuredClone({
    customAnchors,
    builtInOverrides,
    customStoryPoints: customStoryDefinitions,
    roadNames: roadNameOverrides,
    blockNames: blockNameOverrides,
    labels: labelSettings,
    mapCustomization: currentMapCustomization(),
  });
}

function updateHistoryButtons(): void {
  undoButton.disabled = !history.canUndo;
  redoButton.disabled = !history.canRedo;
  undoButton.title = history.undoLabel === undefined ? 'Undo (Ctrl/Cmd+Z)' : `Undo ${history.undoLabel} (Ctrl/Cmd+Z)`;
  redoButton.title = history.redoLabel === undefined ? 'Redo (Ctrl/Cmd+Shift+Z)' : `Redo ${history.redoLabel} (Ctrl/Cmd+Shift+Z)`;
}

function recordHistory(previous: EditorSnapshot, label: string): void {
  if (restoringHistory) return;
  history.record(previous, label);
  updateHistoryButtons();
  scheduleAutosave();
}

function persistAllEditorState(): void {
  saveAnchorState(customAnchors, builtInOverrides);
  saveCustomStoryDefinitions(customStoryDefinitions);
  saveLabelSettings(labelSettings);
  persistMapCustomization();
  persistNames();
}

function restoreEditorSnapshot(snapshot: EditorSnapshot, label: string): void {
  restoringHistory = true;
  customAnchors = [...snapshot.customAnchors];
  builtInOverrides = [...snapshot.builtInOverrides];
  customStoryDefinitions = [...snapshot.customStoryPoints];
  roadNameOverrides = [...snapshot.roadNames];
  blockNameOverrides = [...snapshot.blockNames];
  labelSettings = structuredClone(snapshot.labels);
  anchorPositionOverrides = [...snapshot.mapCustomization.anchorPositions];
  settlementPositionOverrides = [...snapshot.mapCustomization.settlementPositions];
  storyPositionOverrides = [...snapshot.mapCustomization.storyPositions];
  storyRuleOverrides = [...snapshot.mapCustomization.storyRules];
  zoneOverrides = [...snapshot.mapCustomization.zoneOverrides];
  placedImages = [...snapshot.mapCustomization.placedImages];
  islandOverrides = [...snapshot.mapCustomization.islandOverrides];
  bridgeOverrides = [...snapshot.mapCustomization.bridgeOverrides];
  customBridges = [...snapshot.mapCustomization.customBridges];
  portOverrides = [...snapshot.mapCustomization.portOverrides];
  customPorts = [...snapshot.mapCustomization.customPorts];
  authoringLayer = structuredClone(snapshot.mapCustomization.authoringLayer);
  npcLocationAuthoring = structuredClone(snapshot.mapCustomization.npcLocationAuthoring);
  persistAllEditorState();
  applyLabelSettingsToControls(labelSettings);
  generate(customAnchors, builtInOverrides, false, false);
  restoringHistory = false;
  updateHistoryButtons();
  setStatus(label, 'success');
}

function undo(): void {
  const entry = history.undo(captureEditorSnapshot());
  if (entry === undefined) return;
  restoreEditorSnapshot(entry.state, `Undid ${entry.label}.`);
}

function redo(): void {
  const entry = history.redo(captureEditorSnapshot());
  if (entry === undefined) return;
  restoreEditorSnapshot(entry.state, `Redid ${entry.label}.`);
}

function syncRendererCustomization(): void {
  renderer.setCustomization({
    ...EMPTY_RENDER_CUSTOMIZATION,
    imageAssets: runtimeImageAssets,
    placedImages,
    editMode,
    dragPreview,
    labels: labelSettings,
    zoneDisplayMode: zoneDisplayMode.value as 'final' | 'generated' | 'overrides',
    zoneBrushPreview,
    travelPath: activeTravelPlan?.reachable === true
      ? { segments: activeTravelPlan.segments.map((segment) => ({ mode: segment.mode, tileIndices: segment.tileIndices })) }
      : null,
    authoringLayer,
    activeAuthoringFeatureId,
    authoringDraftPoints,
  });
  requestRender();
}

function requestRender(): void {
  renderRequested = true;
}



async function exportVisibleMapImage(): Promise<void> {
  exportImageButton.disabled = true;
  setStatus('Rendering full-world PNG…', 'working');
  try {
    const blob = await renderer.exportPng(world, {
      pixelsPerTile: Number(imageExportScale.value),
      padding: Number(imageExportPadding.value),
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSeed = world.seed.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.download = `${safeSeed}-${world.metadata.terrainShape}-${world.metadata.climatePreset}.png`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${(blob.size / 1024 / 1024).toFixed(2)} MB PNG using the visible map layers.`, 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    exportImageButton.disabled = false;
  }
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function readLabelSettingsFromControls(): LabelDisplaySettings {
  return normalizeLabelSettings({
    road: {
      visible: layerElements[RenderLayer.RoadLabels].checked,
      fontSizePx: Number(roadLabelFontSize.value),
      opacity: Number(roadLabelOpacity.value) / 100,
      density: Number(roadLabelDensity.value) / 100,
      showMain: roadLabelMain.checked,
      showSecondary: roadLabelSecondary.checked,
      showLocal: roadLabelLocal.checked,
      mainMinZoom: Number(roadLabelMainZoom.value),
      secondaryMinZoom: Number(roadLabelSecondaryZoom.value),
      localMinZoom: Number(roadLabelLocalZoom.value),
      rotateAlongRoad: roadLabelRotate.checked,
      outline: roadLabelOutline.checked,
    },
    block: {
      visible: layerElements[RenderLayer.BlockLabels].checked,
      fontSizePx: Number(blockLabelFontSize.value),
      opacity: Number(blockLabelOpacity.value) / 100,
      density: Number(blockLabelDensity.value) / 100,
      minZoom: Number(blockLabelMinZoom.value),
      outline: blockLabelOutline.checked,
    },
    avoidCollisions: labelAvoidCollisions.checked,
  });
}

function updateLabelControlOutputs(): void {
  roadLabelFontOutput.value = `${labelSettings.road.fontSizePx.toFixed(0)} px`;
  roadLabelOpacityOutput.value = percentage(labelSettings.road.opacity);
  roadLabelDensityOutput.value = percentage(labelSettings.road.density);
  roadLabelSummary.textContent = `${labelSettings.road.fontSizePx.toFixed(0)} px · ${percentage(labelSettings.road.density)}`;
  blockLabelFontOutput.value = `${labelSettings.block.fontSizePx.toFixed(0)} px`;
  blockLabelOpacityOutput.value = percentage(labelSettings.block.opacity);
  blockLabelDensityOutput.value = percentage(labelSettings.block.density);
  blockLabelSummary.textContent = `${labelSettings.block.fontSizePx.toFixed(0)} px · ${percentage(labelSettings.block.density)}`;
}

function applyLabelSettingsToControls(settings: LabelDisplaySettings): void {
  layerElements[RenderLayer.RoadLabels].checked = settings.road.visible;
  layerElements[RenderLayer.BlockLabels].checked = settings.block.visible;
  renderer.layers.setVisible(RenderLayer.RoadLabels, settings.road.visible);
  renderer.layers.setVisible(RenderLayer.BlockLabels, settings.block.visible);
  roadLabelFontSize.value = String(settings.road.fontSizePx);
  roadLabelOpacity.value = String(Math.round(settings.road.opacity * 100));
  roadLabelDensity.value = String(Math.round(settings.road.density * 100));
  roadLabelMainZoom.value = String(settings.road.mainMinZoom);
  roadLabelSecondaryZoom.value = String(settings.road.secondaryMinZoom);
  roadLabelLocalZoom.value = String(settings.road.localMinZoom);
  roadLabelMain.checked = settings.road.showMain;
  roadLabelSecondary.checked = settings.road.showSecondary;
  roadLabelLocal.checked = settings.road.showLocal;
  roadLabelRotate.checked = settings.road.rotateAlongRoad;
  roadLabelOutline.checked = settings.road.outline;
  blockLabelFontSize.value = String(settings.block.fontSizePx);
  blockLabelOpacity.value = String(Math.round(settings.block.opacity * 100));
  blockLabelDensity.value = String(Math.round(settings.block.density * 100));
  blockLabelMinZoom.value = String(settings.block.minZoom);
  blockLabelOutline.checked = settings.block.outline;
  labelAvoidCollisions.checked = settings.avoidCollisions;
  updateLabelControlOutputs();
}

function commitLabelControls(): void {
  labelSettings = readLabelSettingsFromControls();
  saveLabelSettings(labelSettings);
  updateLabelControlOutputs();
  viewPreset.value = 'custom';
  syncRendererCustomization();
}

function showToast(message: string, state: 'success' | 'warning' | 'error'): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.state = state;
  toast.textContent = message;
  toastStack.append(toast);
  window.setTimeout(() => toast.remove(), state === 'error' ? 7000 : 4200);
  while (toastStack.childElementCount > 4) toastStack.firstElementChild?.remove();
}

function setStatus(message: string, state: 'success' | 'warning' | 'error' | 'working' | 'idle' = 'idle'): void {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
  if (state === 'success' || state === 'warning' || state === 'error') showToast(message, state);
}

function setTheme(theme: UiTheme): void {
  document.documentElement.dataset.theme = theme;
  studioThemeSelect.value = theme;
  localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  requestRender();
}

function setLeftPanel(open: boolean): void {
  document.body.dataset.leftPanel = open ? 'open' : 'closed';
  toggleLeftPanelButton.setAttribute('aria-pressed', String(open));
  localStorage.setItem(UI_LEFT_PANEL_STORAGE_KEY, open ? 'open' : 'closed');
  window.setTimeout(fitCamera, 190);
}

function setStudioDock(open: boolean): void {
  document.body.dataset.studioDock = open ? 'open' : 'closed';
  toggleStudioDockButton.setAttribute('aria-pressed', String(open));
  localStorage.setItem(UI_STUDIO_DOCK_STORAGE_KEY, open ? 'open' : 'closed');
  window.setTimeout(fitCamera, 190);
}

function setStudioTab(tab: StudioTab, openDock = true): void {
  activeStudioTab = tab;
  localStorage.setItem(UI_STUDIO_TAB_STORAGE_KEY, tab);
  const buttons: Readonly<Record<StudioTab, HTMLButtonElement>> = {
    inspector: studioTabInspector,
    layers: studioTabLayers,
    project: studioTabProject,
  };
  const panels: Readonly<Record<StudioTab, HTMLElement>> = {
    inspector: studioInspectorPanel,
    layers: studioLayersPanel,
    project: studioProjectPanel,
  };
  for (const key of Object.keys(buttons) as StudioTab[]) {
    buttons[key].setAttribute('aria-selected', String(key === tab));
    panels[key].hidden = key !== tab;
  }
  if (openDock) setStudioDock(true);
}

const STUDIO_LAYER_GROUPS: readonly {
  readonly title: string;
  readonly layers: readonly { readonly layer: RenderLayer; readonly label: string }[];
}[] = [
  { title: 'Base', layers: [
    { layer: RenderLayer.Terrain, label: 'Terrain' },
    { layer: RenderLayer.Elevation, label: 'Elevation' },
    { layer: RenderLayer.Moisture, label: 'Moisture' },
    { layer: RenderLayer.Temperature, label: 'Temperature' },
  ] },
  { title: 'Planning', layers: [
    { layer: RenderLayer.Accessibility, label: 'Accessibility' },
    { layer: RenderLayer.LandValue, label: 'Land value' },
    { layer: RenderLayer.Zones, label: 'Zones' },
    { layer: RenderLayer.Blocks, label: 'Blocks' },
    { layer: RenderLayer.BlockLabels, label: 'Block labels' },
  ] },
  { title: 'Region', layers: [
    { layer: RenderLayer.Floodplains, label: 'Flood risk' },
    { layer: RenderLayer.Rivers, label: 'Rivers' },
    { layer: RenderLayer.Islands, label: 'Island boundaries' },
    { layer: RenderLayer.IslandLabels, label: 'Island labels' },
    { layer: RenderLayer.Settlements, label: 'Settlements' },
  ] },
  { title: 'Infrastructure', layers: [
    { layer: RenderLayer.Roads, label: 'Roads' },
    { layer: RenderLayer.RoadLabels, label: 'Road labels' },
    { layer: RenderLayer.Bridges, label: 'Bridges' },
    { layer: RenderLayer.BridgeLabels, label: 'Bridge labels' },
    { layer: RenderLayer.Ports, label: 'Ports' },
    { layer: RenderLayer.PortLabels, label: 'Port labels' },
  ] },
  { title: 'Live world', layers: [
    { layer: RenderLayer.LiveInfrastructure, label: 'Infrastructure status' },
    { layer: RenderLayer.VenueStatus, label: 'Venue status' },
    { layer: RenderLayer.SettlementActivity, label: 'Settlement activity' },
    { layer: RenderLayer.SupernaturalActivity, label: 'Supernatural activity' },
    { layer: RenderLayer.NPCs, label: 'NPCs' },
    { layer: RenderLayer.Travel, label: 'Travel route' },
  ] },
  { title: 'World objects', layers: [
    { layer: RenderLayer.Buildings, label: 'Buildings' },
    { layer: RenderLayer.Vegetation, label: 'Vegetation' },
    { layer: RenderLayer.CustomImages, label: 'Custom images' },
    { layer: RenderLayer.Anchors, label: 'Anchors' },
    { layer: RenderLayer.Story, label: 'Story sites' },
    { layer: RenderLayer.Grid, label: 'Grid' },
  ] },
];

function renderStudioLayerManager(): void {
  studioLayerList.replaceChildren();
  for (const groupDefinition of STUDIO_LAYER_GROUPS) {
    const group = document.createElement('section');
    group.className = 'studio-layer-group';
    const title = document.createElement('strong');
    title.textContent = groupDefinition.title;
    group.append(title);
    for (const item of groupDefinition.layers) {
      const row = document.createElement('label');
      row.className = 'studio-layer-row';
      row.dataset.search = `${groupDefinition.title} ${item.label}`.toLocaleLowerCase();
      const label = document.createElement('span');
      label.textContent = item.label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = layerElements[item.layer].checked;
      input.dataset.layer = item.layer;
      input.addEventListener('change', () => {
        layerElements[item.layer].checked = input.checked;
        layerElements[item.layer].dispatchEvent(new Event('change'));
      });
      layerElements[item.layer].addEventListener('change', () => { input.checked = layerElements[item.layer].checked; });
      row.append(label, input);
      group.append(row);
    }
    studioLayerList.append(group);
  }
}

function filterStudioLayers(): void {
  const query = layerSearchInput.value.trim().toLocaleLowerCase();
  for (const row of studioLayerList.querySelectorAll<HTMLElement>('.studio-layer-row')) {
    row.dataset.filtered = String(query.length > 0 && !(row.dataset.search ?? '').includes(query));
  }
}

function syncStudioLayerManager(): void {
  for (const input of studioLayerList.querySelectorAll<HTMLInputElement>('input[data-layer]')) {
    const layer = input.dataset.layer as RenderLayer;
    input.checked = layerElements[layer].checked;
  }
}

function setAllStudioLayers(visible: boolean): void {
  for (const layer of Object.values(RenderLayer)) setLayer(layer, visible || layer === RenderLayer.Terrain);
  viewPreset.value = 'custom';
  syncStudioLayerManager();
  requestRender();
}

function terrainMinimapColor(terrain: string, water: WaterType): string {
  if (water === WaterType.Ocean) return terrain === 'shallow-water' ? '#406b74' : '#254650';
  if (water === WaterType.Lake) return '#3e7180';
  switch (terrain) {
    case 'beach': return '#b7a777';
    case 'river-channel': return '#4a7881';
    case 'delta': return '#67816a';
    case 'floodplain': return '#758d6a';
    case 'forest': return '#355c3d';
    case 'hill': return '#776f55';
    case 'mountain': return '#716b62';
    default: return '#66805d';
  }
}

function rebuildMinimapBase(): void {
  if (world === undefined) return;
  const base = document.createElement('canvas');
  base.width = minimapCanvas.width;
  base.height = minimapCanvas.height;
  const context = base.getContext('2d');
  if (context === null) return;
  const cellWidth = base.width / world.width;
  const cellHeight = base.height / world.height;
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const tile = world.getTile(x, y);
      if (tile === undefined) continue;
      context.fillStyle = terrainMinimapColor(tile.terrain, tile.water);
      context.fillRect(Math.floor(x * cellWidth), Math.floor(y * cellHeight), Math.ceil(cellWidth + .2), Math.ceil(cellHeight + .2));
    }
  }
  minimapBase = base;
  renderMinimap();
}

function renderMinimap(): void {
  if (world === undefined || minimapBase === null || minimapPanel.dataset.collapsed === 'true') return;
  const context = minimapCanvas.getContext('2d');
  if (context === null) return;
  context.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  context.drawImage(minimapBase, 0, 0);
  const left = Math.max(0, -camera.x / camera.zoom);
  const top = Math.max(0, -camera.y / camera.zoom);
  const right = Math.min(world.width, (canvas.clientWidth - camera.x) / camera.zoom);
  const bottom = Math.min(world.height, (canvas.clientHeight - camera.y) / camera.zoom);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1.5;
  context.strokeRect(
    left / world.width * minimapCanvas.width,
    top / world.height * minimapCanvas.height,
    Math.max(3, (right - left) / world.width * minimapCanvas.width),
    Math.max(3, (bottom - top) / world.height * minimapCanvas.height),
  );
  if (selectedInspectorItem !== null) {
    context.fillStyle = '#f0d68a';
    context.beginPath();
    context.arc(
      (selectedInspectorItem.x + .5) / world.width * minimapCanvas.width,
      (selectedInspectorItem.y + .5) / world.height * minimapCanvas.height,
      3,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function updateStatusBar(): void {
  if (world === undefined) return;
  statusSeed.textContent = `Seed: ${world.seed}`;
  statusLayout.textContent = `Layout: ${world.metadata.terrainShape}`;
  statusZoom.textContent = `Zoom: ${Math.round(camera.zoom * 100)}%`;
  statusSelection.textContent = `Selected: ${selectedInspectorItem?.title ?? 'none'}`;
  const total = Object.values(world.diagnostics.stageTimingsMs).reduce((sum, value) => sum + value, 0);
  statusGeneration.textContent = activeGenerationController === null ? `Generation: ${total.toFixed(0)} ms` : 'Generation: running';
}

function renderInspector(): void {
  focusSelectionButton.disabled = selectedInspectorItem === null;
  if (selectedInspectorItem === null || world === undefined) {
    inspectorContent.className = 'inspector-empty';
    inspectorContent.innerHTML = '<strong>Nothing selected</strong><p>Click the map to inspect terrain, roads, districts, settlements, anchors, story sites, and NPCs.</p>';
    updateStatusBar();
    return;
  }
  const tile = world.getTile(selectedInspectorItem.x, selectedInspectorItem.y);
  if (tile === undefined) return;
  const island = tile.islandId === null ? undefined : world.islands[tile.islandId];
  const settlement = tile.settlementId === null ? undefined : world.settlements[tile.settlementId];
  const road = tile.roadId === null ? undefined : world.roads[tile.roadId];
  const block = tile.blockId === null ? undefined : world.blocks[tile.blockId];
  const building = tile.buildingId === null ? undefined : world.buildings[tile.buildingId];
  const anchor = world.anchors.find((item) => item.tileIndex === selectedInspectorItem?.tileIndex);
  const story = world.storyObjects.find((item) => item.tileIndex === selectedInspectorItem?.tileIndex);
  const npc = world.npcs.find((item) => item.tileIndex === selectedInspectorItem?.tileIndex);
  const tags = [tile.river ? 'River' : '', tile.coast ? 'Coast' : '', tile.bridge ? 'Bridge' : '', tile.hasZoneOverride ? 'Zone override' : ''].filter(Boolean);
  inspectorContent.className = 'inspector-card';
  inspectorContent.replaceChildren();
  const header = document.createElement('header');
  const title = document.createElement('strong');
  title.textContent = selectedInspectorItem.title;
  const subtitle = document.createElement('span');
  subtitle.textContent = selectedInspectorItem.subtitle;
  header.append(title, subtitle);
  const list = document.createElement('dl');
  list.className = 'inspector-grid';
  const rows: readonly [string, string][] = [
    ['Coordinates', `${tile.x}, ${tile.y}`],
    ['Terrain', tile.terrain],
    ['Elevation', tile.elevation.toFixed(3)],
    ['Slope', tile.slope.toFixed(3)],
    ['Moisture', tile.moisture.toFixed(2)],
    ['Flood risk', `${Math.round(tile.floodRisk * 100)}%`],
    ['Zone', tile.zoneType ?? 'none'],
    ['Island', island?.name ?? 'none'],
    ['Settlement', settlement?.name ?? 'none'],
    ['Road', road?.name ?? 'none'],
    ['Block', block?.name ?? 'none'],
    ['Building', building === undefined ? 'none' : `#${building.id}`],
    ['Anchor', anchor?.name ?? 'none'],
    ['Story site', story?.name ?? 'none'],
    ['NPC', npc === undefined ? 'none' : `${npc.name} · ${npc.occupation} · ${npc.status}`],
  ];
  for (const [name, value] of rows) {
    const term = document.createElement('dt'); term.textContent = name;
    const description = document.createElement('dd'); description.textContent = value;
    list.append(term, description);
  }
  const tagContainer = document.createElement('div');
  tagContainer.className = 'inspector-tags';
  for (const tag of tags) { const span = document.createElement('span'); span.textContent = tag; tagContainer.append(span); }
  const actions = document.createElement('div');
  actions.className = 'button-row inspector-actions';
  if (road !== undefined && road.source !== 'authored' && road.bridgeId === null && road.portId === null) {
    const adopt = document.createElement('button');
    adopt.type = 'button';
    adopt.textContent = 'Adopt road into authoring';
    adopt.addEventListener('click', () => adoptGeneratedRoad(road));
    actions.append(adopt);
  }
  if (building !== undefined && building.source !== 'authored') {
    const adopt = document.createElement('button');
    adopt.type = 'button';
    adopt.textContent = 'Adopt building into authoring';
    adopt.addEventListener('click', () => adoptGeneratedBuilding(building));
    actions.append(adopt);
  }
  inspectorContent.append(header, list, tagContainer);
  if (actions.childElementCount > 0) inspectorContent.append(actions);
  updateStatusBar();
  renderMinimap();
}

function inspectMapPosition(worldX: number, worldY: number): void {
  const x = Math.floor(worldX);
  const y = Math.floor(worldY);
  const tile = world.getTile(x, y);
  if (tile === undefined) return;
  const index = y * world.width + x;
  const story = world.storyObjects.find((item) => item.tileIndex === index);
  const npc = world.npcs.find((item) => item.tileIndex === index);
  const anchor = world.anchors.find((item) => item.tileIndex === index);
  const settlement = tile.settlementId === null ? undefined : world.settlements[tile.settlementId];
  const road = tile.roadId === null ? undefined : world.roads[tile.roadId];
  const block = tile.blockId === null ? undefined : world.blocks[tile.blockId];
  const title = npc?.name ?? story?.name ?? anchor?.name ?? settlement?.name ?? road?.name ?? block?.name ?? `${tile.terrain} tile`;
  const subtitle = npc !== undefined ? 'NPC' : story !== undefined ? 'Story site' : anchor !== undefined ? 'Anchor' : settlement !== undefined ? 'Settlement' : road !== undefined ? 'Road' : block !== undefined ? 'Block' : 'Terrain';
  selectedInspectorItem = { tileIndex: index, x, y, title, subtitle };
  renderInspector();
  setStudioTab('inspector');
}

function focusSelection(): void {
  if (selectedInspectorItem === null) { fitCamera(); return; }
  camera.focus(selectedInspectorItem.x, selectedInspectorItem.y, canvas.clientWidth, canvas.clientHeight, Math.max(7, camera.zoom));
  requestRender();
}

function createAutosavePayload(): Record<string, unknown> {
  const profile: StoredProfile = {
    terrainSize: selectedTerrainSize(), townScale: selectedTownScale(), terrainShape: selectedTerrainShape(),
    climatePreset: selectedClimatePreset(), islandCount: selectedIslandCount(),
    islandSpacingKilometers: selectedIslandSpacing(), satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT,
  };
  return {
    format: 'payaw-project',
    projectVersion: 1,
    metadata: { schemaVersion: 20 },
    project: {
      seed: world.seed,
      profile,
      authoring: {
        customAnchors,
        builtInAnchorOverrides: builtInOverrides,
        roadNames: roadNameOverrides,
        blockNames: blockNameOverrides,
        labelDisplay: labelSettings,
        customStoryPoints: customStoryDefinitions,
        npcRosterSize: world.npcs.length,
        npcLocationAuthoring,
        campaign: campaignState,
        playerView: playerViewState,
        simulation: simulation?.serialize(),
        customization: currentMapCustomization(),
        imageAssets: [],
      },
    },
    campaign: campaignState,
    playerView: playerViewState,
    customization: { ...currentMapCustomization(), labelDisplay: labelSettings, customStoryPoints: customStoryDefinitions, npcRosterSize: world.npcs.length, imageAssets: [] },
    autosavedAt: new Date().toISOString(),
  };
}

function updateRecoveryUi(): void {
  const raw = localStorage.getItem(SESSION_AUTOSAVE_STORAGE_KEY);
  if (raw === null) {
    restoreSessionButton.disabled = true;
    sessionRecoveryCopy.textContent = 'No recoverable session yet.';
    return;
  }
  try {
    const parsed = JSON.parse(raw) as { autosavedAt?: string; project?: { seed?: string } };
    const date = parsed.autosavedAt === undefined ? 'unknown time' : new Date(parsed.autosavedAt).toLocaleString();
    restoreSessionButton.disabled = false;
    sessionRecoveryCopy.textContent = `Recover ${parsed.project?.seed ?? 'the last world'} saved ${date}.`;
  } catch {
    restoreSessionButton.disabled = true;
    sessionRecoveryCopy.textContent = 'The recovery snapshot is invalid.';
  }
}

function scheduleAutosave(): void {
  if (world === undefined) return;
  document.dispatchEvent(new CustomEvent('payaw:project-state-changed'));
  if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
  autosaveIndicator.dataset.state = 'saving';
  autosaveIndicator.textContent = 'Saving…';
  autosaveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(SESSION_AUTOSAVE_STORAGE_KEY, JSON.stringify(createAutosavePayload()));
      autosaveIndicator.dataset.state = 'saved';
      autosaveIndicator.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      updateRecoveryUi();
    } catch (error) {
      autosaveIndicator.dataset.state = 'error';
      autosaveIndicator.textContent = 'Autosave failed';
      console.warn('PAYAW autosave failed', error);
    }
    autosaveTimer = null;
  }, 900);
}

async function restoreAutosave(): Promise<void> {
  const raw = localStorage.getItem(SESSION_AUTOSAVE_STORAGE_KEY);
  if (raw === null) return;
  const file = new File([raw], 'payaw-autosave.json', { type: 'application/json' });
  await importPayawJsonFile(file);
  showToast('Restored the last autosaved PAYAW session.', 'success');
}

function loadRecentProjects(): RecentProjectEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const candidate = item as Partial<RecentProjectEntry>;
      if (typeof candidate.seed !== 'string' || !isEnumValue(Object.values(TerrainSize), candidate.terrainSize) || !isEnumValue(Object.values(TownScale), candidate.townScale) || !isEnumValue(Object.values(TerrainShape), candidate.terrainShape) || !isEnumValue(Object.values(ClimatePreset), candidate.climatePreset)) return [];
      return [{
        seed: candidate.seed,
        terrainSize: candidate.terrainSize,
        townScale: candidate.townScale,
        terrainShape: candidate.terrainShape,
        climatePreset: candidate.climatePreset,
        islandCount: Number(candidate.islandCount) || 5,
        islandSpacingKilometers: Number(candidate.islandSpacingKilometers) || 4,
        satelliteSettlementCount: 0,
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
      }];
    }).slice(0, 8);
  } catch { return []; }
}

function renderRecentProjects(): void {
  const entries = loadRecentProjects();
  recentProjectList.replaceChildren();
  if (entries.length === 0) {
    const empty = document.createElement('div'); empty.className = 'recent-project-empty'; empty.textContent = 'Generated and imported worlds will appear here.'; recentProjectList.append(empty); return;
  }
  for (const entry of entries) {
    const row = document.createElement('article'); row.className = 'recent-project-item';
    const copy = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = entry.seed;
    const subtitle = document.createElement('small'); subtitle.textContent = `${entry.terrainShape} · ${new Date(entry.updatedAt).toLocaleString()}`;
    copy.append(title, subtitle);
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Open';
    button.addEventListener('click', () => {
      seedInput.value = entry.seed; terrainSizeSelect.value = entry.terrainSize; townScaleSelect.value = entry.townScale;
      terrainShapeSelect.value = entry.terrainShape; climatePresetSelect.value = entry.climatePreset;
      islandCountInput.value = String(entry.islandCount); islandSpacingInput.value = String(entry.islandSpacingKilometers);
      updateProfileHint();
      void generateResponsive(customAnchors, builtInOverrides, true, true);
    });
    row.append(copy, button); recentProjectList.append(row);
  }
}

function recordRecentProject(): void {
  if (world === undefined) return;
  const entry: RecentProjectEntry = {
    seed: world.seed,
    terrainSize: selectedTerrainSize(), townScale: selectedTownScale(), terrainShape: selectedTerrainShape(),
    climatePreset: selectedClimatePreset(), islandCount: selectedIslandCount(), islandSpacingKilometers: selectedIslandSpacing(),
    satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT, updatedAt: new Date().toISOString(),
  };
  const entries = [entry, ...loadRecentProjects().filter((item) => item.seed !== entry.seed || item.terrainShape !== entry.terrainShape)].slice(0, 8);
  localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(entries));
  renderRecentProjects();
}

function commandDefinitions(): CommandDefinition[] {
  return [
    { id: 'generate', label: 'Generate world', description: 'Regenerate using the current profile', shortcut: 'G', run: () => { void generateResponsive(customAnchors, builtInOverrides, true, true); } },
    { id: 'random-seed', label: 'Generate random world', description: 'Create a new random seed and generate', run: () => { seedInput.value = createCryptoSeed(); void generateResponsive(customAnchors, builtInOverrides, true, true); } },
    { id: 'save-json', label: 'Save compact World JSON', description: 'Export the reproducible world recipe without generated caches or NPC records', shortcut: 'Ctrl+S', run: () => downloadWorld(world, currentMapCustomization(), importedAssets, labelSettings, customStoryDefinitions) },
    { id: 'open-json', label: 'Open project JSON', description: 'Import a PAYAW project or override file', shortcut: 'Ctrl+O', run: () => projectImportFile.click() },
    { id: 'export-png', label: 'Export map PNG', description: 'Render the visible layer configuration', run: () => { void exportVisibleMapImage(); } },
    { id: 'fit', label: 'Fit entire world', description: 'Fit the regional map into the viewport', shortcut: 'F', run: fitCamera },
    { id: 'focus', label: 'Focus selection', description: 'Center the selected map object', run: focusSelection },
    { id: 'editor', label: 'Switch to World Editor', description: 'Open authoring controls', run: () => setWorkspace('editor') },
    { id: 'dm', label: 'Switch to DM Mode', description: 'Open the session workspace', run: () => setWorkspace('dm') },
    { id: 'inspector', label: 'Open Inspector', description: 'Inspect the selected tile or object', run: () => setStudioTab('inspector') },
    { id: 'layers', label: 'Open Layer Manager', description: 'Toggle map visibility layers', run: () => setStudioTab('layers') },
    { id: 'project', label: 'Open Project panel', description: 'Autosave, recent worlds, and theme', run: () => setStudioTab('project') },
    { id: 'toggle-left', label: 'Toggle authoring panel', description: 'Show or hide the left workspace', shortcut: 'Ctrl+[', run: () => setLeftPanel(document.body.dataset.leftPanel !== 'closed' ? false : true) },
    { id: 'toggle-right', label: 'Toggle Studio Dock', description: 'Show or hide inspector, layers, and project', shortcut: 'Ctrl+]', run: () => setStudioDock(document.body.dataset.studioDock !== 'closed' ? false : true) },
    { id: 'dark', label: 'Use dark appearance', description: 'Switch the interface theme', run: () => setTheme('dark') },
    { id: 'light', label: 'Use light appearance', description: 'Switch the interface theme', run: () => setTheme('light') },
    { id: 'contrast', label: 'Use high-contrast appearance', description: 'Switch the interface theme', run: () => setTheme('contrast') },
  ];
}

function renderCommandPalette(): void {
  const query = commandPaletteInput.value.trim().toLocaleLowerCase();
  filteredCommands = commandDefinitions().filter((command) => `${command.label} ${command.description}`.toLocaleLowerCase().includes(query));
  activeCommandIndex = Math.max(0, Math.min(activeCommandIndex, filteredCommands.length - 1));
  commandPaletteResults.replaceChildren();
  if (filteredCommands.length === 0) {
    const empty = document.createElement('div'); empty.className = 'command-empty'; empty.textContent = 'No matching commands.'; commandPaletteResults.append(empty); return;
  }
  filteredCommands.forEach((command, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'command-result'; button.dataset.active = String(index === activeCommandIndex);
    const copy = document.createElement('span'); const label = document.createElement('strong'); label.textContent = command.label; const description = document.createElement('small'); description.textContent = command.description; copy.append(label, description); button.append(copy);
    if (command.shortcut !== undefined) { const shortcut = document.createElement('kbd'); shortcut.textContent = command.shortcut; button.append(shortcut); }
    button.addEventListener('click', () => { closeCommandPalette(); void command.run(); });
    commandPaletteResults.append(button);
  });
  commandPaletteResults.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
}

function openCommandPalette(): void {
  commandPaletteBackdrop.dataset.open = 'true'; commandPaletteBackdrop.setAttribute('aria-hidden', 'false'); commandPaletteInput.value = ''; activeCommandIndex = 0; renderCommandPalette(); window.setTimeout(() => commandPaletteInput.focus(), 0);
}
function closeCommandPalette(): void { commandPaletteBackdrop.dataset.open = 'false'; commandPaletteBackdrop.setAttribute('aria-hidden', 'true'); }
function runActiveCommand(): void { const command = filteredCommands[activeCommandIndex]; if (command === undefined) return; closeCommandPalette(); void command.run(); }

const GENERATION_STAGE_LABELS: Readonly<Record<string, string>> = {
  terrain: 'Elevation',
  'mountain-structure': 'Mountain structure',
  'thermal-erosion': 'Thermal erosion',
  coastline: 'Coastline',
  slope: 'Terrain slopes',
  climate: 'Climate',
  'hydraulic-erosion': 'Hydraulic erosion',
  'eroded-coastline': 'Eroded coastline',
  'eroded-slope': 'Eroded slopes',
  'terrain-hydrology': 'Hydrology',
  'final-coastline': 'Final coastline',
  'delta-drainage-repair': 'Drainage repair',
  'final-slope': 'Final slopes',
  'terrain-classification': 'Terrain classification',
  landmasses: 'Landmass detection',
  islands: 'Island planning',
  settlements: 'Settlements',
  'anchor-placement': 'Anchors',
  'road-network': 'Road network',
  bridges: 'Bridges',
  ports: 'Ports',
  accessibility: 'Accessibility',
  blocks: 'Blocks',
  'land-value': 'Land value',
  zoning: 'Zoning',
  'zone-overrides': 'Zone overrides',
  'place-naming': 'Place names',
  buildings: 'Buildings',
  vegetation: 'Vegetation',
  'story-layer': 'Story layer',
};

function setGenerationRunning(running: boolean): void {
  generateButton.disabled = running;
  randomSeedButton.disabled = running;
  cancelGenerationButton.hidden = !running;
  generationProgress.hidden = !running;
  if (!running) {
    generationProgressFill.style.width = '0%';
    generationProgressPercent.textContent = '0%';
  }
}

function updateGenerationProgress(progress: GenerationProgress): void {
  const completedStages = progress.stageIndex + 1;
  const percent = Math.round(completedStages / Math.max(1, progress.stageCount) * 100);
  generationProgressFill.style.width = `${percent}%`;
  generationProgressPercent.textContent = `${percent}%`;
  generationProgressStage.textContent = `${GENERATION_STAGE_LABELS[progress.stageId] ?? progress.stageId} · ${progress.stageDurationMs.toFixed(0)} ms`;
}

function updatePerformancePanel(): void {
  if (world === undefined) return;
  const stageEntries = Object.entries(world.diagnostics.stageTimingsMs);
  const total = stageEntries.reduce((sum, [, duration]) => sum + duration, 0);
  const slowest = [...stageEntries].sort((left, right) => right[1] - left[1])[0];
  const rendererDiagnostics = renderer.getDiagnostics();
  perfGenerationTotal.textContent = `${total.toFixed(0)} ms`;
  perfSlowestStage.textContent = slowest === undefined
    ? '—'
    : `${GENERATION_STAGE_LABELS[slowest[0]] ?? slowest[0]} · ${slowest[1].toFixed(0)} ms`;
  perfCacheTime.textContent = `${rendererDiagnostics.cacheBuildMs.toFixed(1)} ms`;
  perfRenderTime.textContent = `${rendererDiagnostics.lastRenderMs.toFixed(1)} ms`;
  perfVisibleBuildings.textContent = rendererDiagnostics.visibleBuildings.toLocaleString();
  perfVisibleVegetation.textContent = rendererDiagnostics.visibleVegetation.toLocaleString();
}

function fitCamera(): void {
  camera.fit(world.width, world.height, canvas.clientWidth, canvas.clientHeight);
  requestRender();
}

function updateProfileHint(): void {
  const terrain = selectedTerrainSize();
  const town = selectedTownScale();
  const shape = selectedTerrainShape();
  const terrainText = terrain === TerrainSize.Small ? 'compact 256×192 terrain' : terrain === TerrainSize.Medium ? 'expanded 320×240 terrain' : 'regional 384×288 terrain';
  const townText = town === TownScale.Rural ? 'sparse roads and low building occupancy' : town === TownScale.SemiUrban ? 'balanced roads, blocks, and buildings' : 'dense roads, tighter blocks, and high occupancy';
  const shapeText = terrainShapeSelect.selectedOptions[0]?.textContent ?? shape;
  const climateText = climatePresetSelect.selectedOptions[0]?.textContent ?? selectedClimatePreset();
  const dimensions: readonly [number, number] = terrain === TerrainSize.Small ? [256, 192] : terrain === TerrainSize.Medium ? [320, 240] : [384, 288];
  const widthKilometers = (dimensions[0] * 0.125).toFixed(0);
  const heightKilometers = (dimensions[1] * 0.125).toFixed(0);
  const archipelago = shape === TerrainShape.Archipelago;
  const twin = shape === TerrainShape.TwinIslands;
  islandCountInput.disabled = !archipelago;
  islandSpacingInput.disabled = !(archipelago || twin);
  if (twin) islandCountInput.value = '2';
  const islandText = archipelago
    ? ` ${selectedIslandCount()} major islands with approximately ${selectedIslandSpacing().toFixed(1)} km minimum gaps.`
    : twin ? ` Two major islands with approximately ${selectedIslandSpacing().toFixed(1)} km minimum separation.` : '';
  profileHint.textContent = `${shapeText}, ${climateText.toLowerCase()}, ${terrainText}, with ${townText}.${islandText} Communities are placed later as movable anchor points.`;
  regionalScaleReadout.textContent = `Metro-scale region: ${widthKilometers} × ${heightKilometers} km · 125 m per tile`;
}

function updateMapHeader(): void {
  mapTitle.textContent = world.seed;
  mapSubtitle.textContent = `${world.metadata.terrainShape} · ${world.metadata.climatePreset} · ${world.metadata.terrainSize} terrain · ${world.metadata.townScale} town · ${world.islands.length} islands · ${world.bridges.length} bridges · ${world.ports.length} ports · ${world.storyObjects.length} story sites`;
}

function mergedBuiltInDefinition(type: BuiltInAnchorType): BuiltInAnchorOverride {
  const override = builtInOverrides.find((definition) => definition.type === type);
  const fallback = defaultBuiltIns.find((definition) => definition.type === type);
  if (override !== undefined) return override;
  if (fallback === undefined) throw new Error(`Missing built-in definition for ${type}.`);
  return fallback;
}

function ruleSummary(settings: AnchorRuleSettings): string {
  const parts = [TERRAIN_LABELS[settings.terrain], REGION_LABELS[settings.region]];
  if (settings.zoneType !== null) parts.push(`${settings.zoneType} zone`);
  if (settings.targetAnchor !== null && settings.proximity !== AnchorProximityBand.None) {
    parts.push(`${settings.proximity} ${ANCHOR_LABELS[settings.targetAnchor]}`);
  }
  return parts.join(' · ');
}

function focusMapPoint(x: number, y: number): void {
  camera.focus(x, y, canvas.clientWidth, canvas.clientHeight, 9);
  requestRender();
}

function focusAnchor(key: string): void {
  const anchor = world.anchors.find((candidate) => candidate.key === key);
  if (anchor !== undefined) focusMapPoint(anchor.x, anchor.y);
}

function resetAnchorForm(): void {
  anchorForm.reset();
  anchorEditKey.value = '';
  anchorFormTitle.textContent = 'Add custom anchor';
  anchorSubmitButton.textContent = 'Add anchor and regenerate';
  anchorCancelButton.hidden = true;
  anchorRadius.value = '5';
  anchorSpacing.value = '12';
  anchorZone.value = ZoneType.Residential;
  anchorTarget.value = '';
  anchorProximity.value = AnchorProximityBand.None;
  anchorProximity.disabled = true;
}

function populateAnchorForm(key: string, settings: AnchorRuleSettings): void {
  anchorEditKey.value = key;
  anchorFormTitle.textContent = key.startsWith('builtin:') ? `Edit ${settings.name}` : `Edit custom anchor`;
  anchorSubmitButton.textContent = 'Save rules and regenerate';
  anchorCancelButton.hidden = false;
  anchorName.value = settings.name;
  anchorRegion.value = settings.region;
  anchorTerrain.value = settings.terrain;
  anchorTarget.value = settings.targetAnchor ?? '';
  anchorProximity.disabled = settings.targetAnchor === null;
  anchorProximity.value = settings.targetAnchor === null ? AnchorProximityBand.None : settings.proximity;
  anchorZone.value = settings.zoneType ?? '';
  anchorRadius.value = String(settings.radius);
  anchorSpacing.value = String(settings.minimumDistance);
  anchorName.focus();
}

function editAnchor(key: string): void {
  if (key.startsWith('builtin:')) {
    const type = key.slice('builtin:'.length) as BuiltInAnchorType;
    populateAnchorForm(key, mergedBuiltInDefinition(type));
    return;
  }
  const id = key.slice('custom:'.length);
  const definition = customAnchors.find((candidate) => candidate.id === id);
  if (definition !== undefined) populateAnchorForm(key, definition);
}

function renderAnchorList(): void {
  anchorCount.textContent = String(BUILT_IN_ANCHOR_TYPES.length + customAnchors.length);
  anchorList.replaceChildren();
  for (const type of BUILT_IN_ANCHOR_TYPES) {
    const definition = mergedBuiltInDefinition(type);
    const edited = builtInOverrides.some((candidate) => candidate.type === type);
    anchorList.append(createAnchorListItem(`builtin:${type}`, definition, 'Built-in', edited));
  }
  for (const definition of customAnchors) {
    anchorList.append(createAnchorListItem(`custom:${definition.id}`, definition, 'Custom', true));
  }
}

function createAnchorListItem(key: string, settings: AnchorRuleSettings, sourceLabel: string, changed: boolean): HTMLElement {
  const item = document.createElement('article');
  item.className = 'anchor-item';
  const description = document.createElement('div');
  const titleRow = document.createElement('div');
  titleRow.className = 'anchor-title-row';
  const title = document.createElement('strong');
  title.textContent = settings.name;
  const moved = anchorPositionOverrides.some((position) => position.key === key.replace('builtin:', ''));
  const badge = document.createElement('span');
  badge.className = moved ? 'mini-badge object-moved-badge' : 'mini-badge';
  badge.textContent = [sourceLabel, changed ? 'edited' : '', moved ? 'moved' : ''].filter((value) => value.length > 0).join(' · ');
  titleRow.append(title, badge);
  const summary = document.createElement('p');
  summary.textContent = ruleSummary(settings);
  description.append(titleRow, summary);
  const actions = document.createElement('div');
  actions.className = 'anchor-actions';
  const focus = document.createElement('button');
  focus.type = 'button';
  focus.textContent = 'Focus';
  focus.addEventListener('click', () => focusAnchor(key.replace('builtin:', '')));
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => editAnchor(key));
  actions.append(focus, edit);
  if (moved) {
    const resetPosition = document.createElement('button');
    resetPosition.type = 'button';
    resetPosition.textContent = 'Reset pos.';
    resetPosition.addEventListener('click', () => resetAnchorPosition(key.replace('builtin:', '')));
    actions.append(resetPosition);
  }
  if (key.startsWith('builtin:') && changed) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => resetBuiltInAnchor(key.slice('builtin:'.length) as BuiltInAnchorType));
    actions.append(reset);
  }
  if (key.startsWith('custom:')) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeCustomAnchor(key.slice('custom:'.length)));
    actions.append(remove);
  }
  item.append(description, actions);
  return item;
}

function randomUnit(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 0) / 4_294_967_296;
}


function setWorkspace(mode: WorkspaceMode, applyDefaultView = true): void {
  activeWorkspace = mode;
  const editorActive = mode === 'editor';
  editorWorkspace.hidden = !editorActive;
  dmWorkspace.hidden = editorActive;
  workspaceEditorButton.setAttribute('aria-selected', String(editorActive));
  workspaceDmButton.setAttribute('aria-selected', String(!editorActive));
  workspaceKicker.textContent = editorActive ? 'WORLD' : 'CAMPAIGN';
  workspaceTitle.textContent = editorActive ? 'Build and inspect the world' : 'Prepare and run the campaign';
  workspaceDescription.textContent = editorActive
    ? 'Generation, layers, anchors, labels, story points, NPCs, and regional transport.'
    : 'Dashboard, Scene Director, timeline, reveals, messages, assets, notes, and session tools.';
  mapWorkspaceBadge.textContent = editorActive ? 'WORLD' : 'CAMPAIGN';
  viewportShell.dataset.workspace = mode;
  for (const button of document.querySelectorAll<HTMLElement>('[data-open-authoring]')) button.hidden = !editorActive;
  localStorage.setItem(WORKSPACE_STORAGE_KEY, mode);
  if (!editorActive) {
    setEditMode(false);
    setZoneEditMode(false);
    if (applyDefaultView) {
      dmViewPreset.value = 'story';
      applyViewPreset('story');
    }
  }
}

function updateDmStoryCounts(): void {
  dmStoryTotal.textContent = String(world.storyObjects.length);
  dmCustomTotal.textContent = String(world.storyObjects.filter((item) => item.source === StoryObjectSource.Custom).length);
  const removed = storyRuleOverrides.filter((rule) => rule.suppressed === true).length;
  removedStoryCount.textContent = String(removed);
  restoreRemovedStoryPoints.disabled = removed === 0;
}

function suppressStoryPoint(item: World['storyObjects'][number]): void {
  const snapshot = captureEditorSnapshot();
  const existing = storyRuleFor(item.id, item.key);
  const next: StoryRuleOverride = {
    id: item.id,
    key: item.key,
    ...(existing?.name !== undefined ? { name: existing.name } : { name: item.name }),
    preferredZone: existing?.preferredZone ?? item.preferredZone,
    allowedZones: existing?.allowedZones ?? item.allowedZones,
    disallowedZones: existing?.disallowedZones ?? item.disallowedZones,
    influenceRadius: existing?.influenceRadius ?? item.influenceRadius,
    ...(existing?.wish !== undefined ? { wish: existing.wish } : {}),
    ...(existing?.manifestation !== undefined ? { manifestation: existing.manifestation } : {}),
    ...(existing?.encounters !== undefined ? { encounters: existing.encounters } : {}),
    suppressed: true,
  };
  const previous = storyRuleOverrides;
  storyRuleOverrides = [
    ...storyRuleOverrides.filter((candidate) => candidate.key !== item.key && !(candidate.key === undefined && candidate.id === item.id)),
    next,
  ].sort((left, right) => left.id - right.id || (left.key ?? '').localeCompare(right.key ?? ''));
  persistMapCustomization();
  if (regenerateFrom('story-layer', `Removed ${item.name} from the campaign map.`)) {
    recordHistory(snapshot, `remove story point ${item.name}`);
    return;
  }
  storyRuleOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', `Could not remove ${item.name}; restored the previous story map.`);
}

function restoreAllSuppressedStoryPoints(): void {
  const suppressed = storyRuleOverrides.filter((rule) => rule.suppressed === true);
  if (suppressed.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previous = storyRuleOverrides;
  storyRuleOverrides = storyRuleOverrides.filter((rule) => rule.suppressed !== true);
  persistMapCustomization();
  if (regenerateFrom('story-layer', `Restored ${suppressed.length} removed story point${suppressed.length === 1 ? '' : 's'}.`)) {
    recordHistory(snapshot, 'restore removed story points');
    return;
  }
  storyRuleOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', 'Could not restore removed story points; restored the previous story map.');
}

function filterDmStoryCards(): void {
  const query = dmStorySearch.value.trim().toLocaleLowerCase();
  for (const card of Array.from(storyList.querySelectorAll<HTMLElement>('.story-item'))) {
    const searchText = card.dataset.storySearch ?? '';
    card.dataset.filtered = String(query.length > 0 && !searchText.includes(query));
  }
}

function renderDmSessionLog(): void {
  dmSessionLog.replaceChildren();
  if (dmSessionEntries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'Encounter rolls will appear here.';
    dmSessionLog.append(empty);
    return;
  }
  for (const entry of dmSessionEntries) {
    const row = document.createElement('article');
    row.className = 'dm-log-entry';
    const time = document.createElement('time');
    time.textContent = entry.time;
    const copy = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${entry.site} — ${entry.title}`;
    const detail = document.createElement('div');
    detail.textContent = entry.danger;
    copy.append(strong, detail);
    row.append(time, copy);
    dmSessionLog.append(row);
  }
}

function showDmEncounter(
  story: World['storyObjects'][number],
  encounter: StoryEncounterDefinition | undefined,
  target: HTMLElement = dmRandomEncounterResult,
): void {
  target.replaceChildren();
  if (encounter === undefined) {
    const empty = document.createElement('span');
    empty.textContent = `${story.name} has no encounter entries.`;
    target.append(empty);
    return;
  }
  const source = document.createElement('span');
  source.className = 'story-source';
  source.textContent = story.name;
  const title = document.createElement('strong');
  title.textContent = encounter.title;
  const danger = document.createElement('span');
  danger.className = 'danger-badge';
  danger.textContent = encounter.danger;
  const description = document.createElement('p');
  description.textContent = encounter.description;
  target.append(source, title, danger, description);
  dmSessionEntries = [{
    time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    site: story.name,
    title: encounter.title,
    danger: encounter.danger,
  }, ...dmSessionEntries].slice(0, 12);
  renderDmSessionLog();
}

function rollDmEncounter(story?: World['storyObjects'][number], target?: HTMLElement): void {
  const candidates = story === undefined
    ? world.storyObjects.filter((item) => item.encounters.length > 0)
    : [story];
  if (candidates.length === 0) {
    dmRandomEncounterResult.innerHTML = '<span>No story encounters are available.</span>';
    return;
  }
  const selected = candidates[Math.min(candidates.length - 1, Math.floor(randomUnit() * candidates.length))];
  if (selected === undefined) return;
  const encounter = pickWeightedEncounter(selected.encounters, randomUnit());
  showDmEncounter(selected, encounter, target);
}

function createStoryListCard(item: World['storyObjects'][number]): HTMLElement {
    const card = document.createElement('article');
    card.className = 'story-item';
    const heading = document.createElement('div');
    heading.className = 'story-heading';
    const title = document.createElement('strong');
    title.textContent = item.name;
    const source = document.createElement('span');
    source.className = 'count-badge';
    source.textContent = item.source === StoryObjectSource.Custom ? 'custom' : 'generated';
    card.dataset.storySearch = [item.name, item.wish, item.manifestation, item.zoneType ?? '', item.preferredZone ?? '', item.type]
      .join(' ')
      .toLocaleLowerCase();
    const actions = document.createElement('div');
    actions.className = 'anchor-actions';
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    focus.addEventListener('click', () => focusMapPoint(item.x, item.y));
    const roll = document.createElement('button');
    roll.type = 'button';
    roll.textContent = 'Roll';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ms21-story-remove-button';
    remove.textContent = 'Remove';
    remove.title = 'Remove this story point non-destructively. Undo or Restore removed can bring it back.';
    remove.addEventListener('click', () => suppressStoryPoint(item));
    actions.append(focus, roll, remove);
    heading.append(title, source, actions);
    const wish = document.createElement('p');
    const wishLabel = document.createElement('span');
    wishLabel.textContent = 'Wish';
    wish.append(wishLabel, ` ${item.wish}`);
    const manifestation = document.createElement('p');
    const manifestationLabel = document.createElement('span');
    manifestationLabel.textContent = 'Manifestation';
    manifestation.append(manifestationLabel, ` ${item.manifestation}`);
    const zoning = document.createElement('p');
    const preferred = item.preferredZone === null ? 'none' : item.preferredZone;
    const zoningLabel = document.createElement('span');
    zoningLabel.textContent = 'Zone';
    zoning.append(zoningLabel, ` ${item.zoneType ?? 'none'} · preferred ${preferred}`);
    const encounterResult = document.createElement('div');
    encounterResult.className = 'encounter-result';
    encounterResult.hidden = true;
    roll.addEventListener('click', () => {
      rollDmEncounter(item, encounterResult);
      encounterResult.hidden = false;
    });
    card.append(heading, wish, manifestation, zoning, encounterResult);
    return card;
}

function renderStoryList(): void {
  storyList.replaceChildren();
  worldStoryList.replaceChildren();
  for (const item of world.storyObjects) {
    storyList.append(createStoryListCard(item));
    worldStoryList.append(createStoryListCard(item));
  }
  updateDmStoryCounts();
  filterDmStoryCards();
}

function selectedZoneValues(select: HTMLSelectElement): ZoneType[] {
  return Array.from(select.selectedOptions).map((option) => option.value as ZoneType);
}

function setSelectedZoneValues(select: HTMLSelectElement, values: readonly ZoneType[]): void {
  const selected = new Set(values);
  for (const option of Array.from(select.options)) option.selected = selected.has(option.value as ZoneType);
}

function storyRuleFor(id: number, key: string): StoryRuleOverride | undefined {
  return storyRuleOverrides.find((rule) => rule.key === key) ?? storyRuleOverrides.find((rule) => rule.key === undefined && rule.id === id);
}

function storyFromEditorSelection(): World['storyObjects'][number] | undefined {
  const key = storyRuleTarget.value;
  return world.storyObjects.find((item) => item.key === key) ?? world.storyObjects[Number(key)];
}

function renderStoryRuleEditor(): void {
  const previousKey = storyRuleTarget.value;
  storyRuleTarget.replaceChildren();
  for (const item of world.storyObjects) {
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = `${item.name} · ${item.zoneType ?? 'no zone'}`;
    storyRuleTarget.append(option);
  }
  storyRuleTarget.value = world.storyObjects.some((item) => item.key === previousKey)
    ? previousKey
    : world.storyObjects[0]?.key ?? '';
  syncStoryRuleEditor();
}

function syncStoryRuleEditor(): void {
  const item = storyFromEditorSelection();
  if (item === undefined) return;
  const rule = storyRuleFor(item.id, item.key);
  storyRuleName.value = rule?.name ?? item.name;
  storyPreferredZone.value = rule?.preferredZone ?? '';
  storyInfluenceRadius.value = String(rule?.influenceRadius ?? item.influenceRadius);
  setSelectedZoneValues(storyAllowedZones, rule?.allowedZones ?? item.allowedZones);
  setSelectedZoneValues(storyDisallowedZones, rule?.disallowedZones ?? item.disallowedZones);
  storyRuleWish.value = rule?.wish ?? item.wish;
  storyRuleManifestation.value = rule?.manifestation ?? item.manifestation;
  storyRuleEncounters.value = formatEncounterLines(rule?.encounters ?? item.encounters);
}

function resetCustomStoryForm(): void {
  customStoryForm.reset();
  customStoryEditId.value = '';
  customStoryFormTitle.textContent = 'Add story point';
  customStoryCancel.hidden = true;
  customStoryType.value = StoryObjectType.HauntedHouse;
  customStoryRegion.value = AnchorRegionPreference.Anywhere;
  customStoryTerrain.value = AnchorTerrainPreference.SafeLand;
  setSelectedZoneValues(customStoryAllowedZones, []);
  setSelectedZoneValues(customStoryDisallowedZones, []);
  customStoryRadius.value = '10';
  customStorySpacing.value = '12';
}

function populateCustomStoryForm(definition: CustomStoryPointDefinition): void {
  customStoryEditId.value = definition.id;
  customStoryFormTitle.textContent = `Edit ${definition.name}`;
  customStoryCancel.hidden = false;
  customStoryName.value = definition.name;
  customStoryType.value = definition.type;
  customStoryRegion.value = definition.region;
  customStoryTerrain.value = definition.terrain;
  customStoryZone.value = definition.preferredZone ?? '';
  setSelectedZoneValues(customStoryAllowedZones, definition.allowedZones);
  setSelectedZoneValues(customStoryDisallowedZones, definition.disallowedZones);
  customStoryRadius.value = String(definition.influenceRadius);
  customStorySpacing.value = String(definition.minimumDistance);
  customStoryWish.value = definition.wish ?? '';
  customStoryManifestation.value = definition.manifestation ?? '';
  customStoryEncounters.value = formatEncounterLines(definition.encounters);
}

function readCustomStoryDefinition(existingId?: string): CustomStoryPointDefinition {
  return {
    id: existingId ?? createRuleId(),
    name: customStoryName.value.trim(),
    type: customStoryType.value as StoryObjectType,
    region: customStoryRegion.value as AnchorRegionPreference,
    terrain: customStoryTerrain.value as AnchorTerrainPreference,
    preferredZone: customStoryZone.value.length === 0 ? null : customStoryZone.value as ZoneType,
    allowedZones: selectedZoneValues(customStoryAllowedZones),
    disallowedZones: selectedZoneValues(customStoryDisallowedZones).filter((zone) => !selectedZoneValues(customStoryAllowedZones).includes(zone)),
    influenceRadius: Math.max(2, Math.min(40, Number(customStoryRadius.value) || 10)),
    minimumDistance: Math.max(4, Math.min(80, Number(customStorySpacing.value) || 12)),
    ...(customStoryWish.value.trim().length > 0 ? { wish: customStoryWish.value.trim() } : {}),
    ...(customStoryManifestation.value.trim().length > 0 ? { manifestation: customStoryManifestation.value.trim() } : {}),
    encounters: parseEncounterLines(customStoryEncounters.value),
  };
}

function renderCustomStoryList(): void {
  customStoryCount.textContent = String(customStoryDefinitions.length);
  customStoryList.replaceChildren();
  if (customStoryDefinitions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'No custom story points yet.';
    customStoryList.append(empty);
    return;
  }
  for (const definition of customStoryDefinitions) {
    const card = document.createElement('article');
    card.className = 'story-item';
    const heading = document.createElement('div');
    heading.className = 'story-heading';
    const title = document.createElement('strong');
    title.textContent = definition.name;
    const actions = document.createElement('div');
    actions.className = 'anchor-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => populateCustomStoryForm(definition));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      const previous = captureEditorSnapshot();
      customStoryDefinitions = customStoryDefinitions.filter((item) => item.id !== definition.id);
      storyPositionOverrides = storyPositionOverrides.filter((item) => item.key !== `custom-story:${definition.id}`);
      storyRuleOverrides = storyRuleOverrides.filter((item) => item.key !== `custom-story:${definition.id}`);
      saveCustomStoryDefinitions(customStoryDefinitions);
      persistMapCustomization();
      if (regenerateFrom('story-layer', `Removed ${definition.name}.`)) {
        recordHistory(previous, `remove story point ${definition.name}`);
        resetCustomStoryForm();
      }
    });
    actions.append(edit, remove);
    heading.append(title, actions);
    const details = document.createElement('p');
    const type = document.createElement('span');
    type.textContent = definition.type;
    details.append(
      type,
      ` ${REGION_LABELS[definition.region]} · ${TERRAIN_LABELS[definition.terrain]} · ${definition.encounters.length || 'generated'} encounters`,
    );
    card.append(heading, details);
    customStoryList.append(card);
  }
}


function travelLocationLabel(location: TravelLocation): string {
  const prefix = location.kind === 'story' ? 'Story'
    : location.kind === 'anchor' ? 'Landmark'
      : location.kind === 'settlement' ? 'Settlement'
        : location.kind === 'port' ? 'Port'
          : location.kind === 'npc' ? 'NPC' : 'Point';
  return `${prefix} · ${location.label}`;
}

function populateTravelSelect(select: HTMLSelectElement, locations: readonly TravelLocation[], preferred?: string): void {
  const previous = preferred ?? select.value;
  select.replaceChildren();
  for (const location of locations) {
    const option = document.createElement('option');
    option.value = location.id;
    option.textContent = travelLocationLabel(location);
    select.append(option);
  }
  if (locations.some((location) => location.id === previous)) select.value = previous;
}

function availableTravelLocations(): readonly TravelLocation[] {
  return [...collectTravelLocations(world), ...customTravelLocations.values()]
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));
}

function resolveTravelLocation(id: string): TravelLocation | undefined {
  return customTravelLocations.get(id) ?? findTravelLocation(world, id);
}

function refreshTravelLocationControls(): void {
  const locations = availableTravelLocations();
  const fromBefore = travelFromLocation.value;
  const toBefore = travelToLocation.value;
  populateTravelSelect(travelFromLocation, locations, fromBefore);
  populateTravelSelect(travelToLocation, locations, toBefore);
  if (travelToLocation.value === travelFromLocation.value && locations.length > 1) travelToLocation.value = locations[1]?.id ?? travelToLocation.value;
}

function focusTravelPlan(plan: TravelPlan): void {
  const indices = plan.segments.flatMap((segment) => [...segment.tileIndices]);
  if (indices.length === 0) return;
  const points = indices.flatMap((index) => world.tiles[index] ?? []);
  if (points.length === 0) return;
  const minimumX = Math.min(...points.map((tile) => tile.x));
  const maximumX = Math.max(...points.map((tile) => tile.x));
  const minimumY = Math.min(...points.map((tile) => tile.y));
  const maximumY = Math.max(...points.map((tile) => tile.y));
  const rectangle = canvas.getBoundingClientRect();
  const width = Math.max(6, maximumX - minimumX + 8);
  const height = Math.max(6, maximumY - minimumY + 8);
  camera.zoom = Math.max(0.5, Math.min(18, Math.min(rectangle.width / width, rectangle.height / height)));
  camera.x = rectangle.width * 0.5 - (minimumX + maximumX + 1) * 0.5 * camera.zoom;
  camera.y = rectangle.height * 0.5 - (minimumY + maximumY + 1) * 0.5 * camera.zoom;
  requestRender();
}

function travelSegmentIcon(mode: TravelPlan['segments'][number]['mode']): string {
  if (mode === 'walk') return 'W';
  if (mode === 'drive') return 'C';
  if (mode === 'public-transport') return 'J';
  return 'F';
}

function renderTravelPlanResult(plan: TravelPlan | null): void {
  travelResult.replaceChildren();
  if (plan === null) {
    const empty = document.createElement('span');
    empty.textContent = 'Select two locations and calculate a journey.';
    travelResult.append(empty);
    return;
  }
  if (!plan.reachable) {
    const strong = document.createElement('strong');
    strong.textContent = 'No connected route found.';
    const warning = document.createElement('p');
    warning.className = 'travel-warning';
    warning.textContent = plan.warnings[0] ?? 'Try another travel mode.';
    travelResult.append(strong, warning);
    return;
  }
  const summary = document.createElement('div');
  summary.className = 'travel-result-summary';
  const items: readonly [string, string][] = activeTravelNormalDuration !== null && plan.contextRevision !== undefined
    ? [
      ['Current conditions', formatTravelDuration(plan.durationMinutes)],
      ['Normal estimate', formatTravelDuration(activeTravelNormalDuration)],
      ['Distance', `${plan.distanceKilometers.toFixed(1)} km`],
      ['Segments', String(plan.segments.length)],
    ]
    : [
      ['Travel time', formatTravelDuration(plan.durationMinutes)],
      ['Distance', `${plan.distanceKilometers.toFixed(1)} km`],
      ['Segments', String(plan.segments.length)],
    ];
  for (const [label, value] of items) {
    const item = document.createElement('div');
    const span = document.createElement('span'); span.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = value;
    item.append(span, strong); summary.append(item);
  }
  const heading = document.createElement('strong');
  heading.textContent = `${plan.from.label} → ${plan.to.label}`;
  const segments = document.createElement('div');
  segments.className = 'travel-segments';
  for (const segment of plan.segments) {
    const row = document.createElement('div'); row.className = 'travel-segment';
    const icon = document.createElement('span'); icon.className = 'travel-segment-icon'; icon.textContent = travelSegmentIcon(segment.mode);
    const copy = document.createElement('div');
    const instruction = document.createElement('strong'); instruction.textContent = segment.instruction;
    const detail = document.createElement('small'); detail.textContent = `${segment.distanceKilometers.toFixed(1)} km · ${formatTravelDuration(segment.durationMinutes)}`;
    copy.append(instruction, document.createElement('br'), detail);
    const duration = document.createElement('strong'); duration.textContent = formatTravelDuration(segment.durationMinutes);
    row.append(icon, copy, duration); segments.append(row);
  }
  const warning = document.createElement('p'); warning.className = 'travel-warning'; warning.textContent = plan.warnings[0] ?? '';
  const focus = document.createElement('button'); focus.type = 'button'; focus.textContent = 'Focus route on map'; focus.addEventListener('click', () => focusTravelPlan(plan));
  travelResult.append(summary, heading, segments, focus, warning);
}


function renderTravelAlternatives(plans: readonly TravelPlan[]): void {
  travelAlternatives.replaceChildren();
  if (plans.length <= 1) return;
  const heading = document.createElement('strong'); heading.textContent = 'Alternate paths';
  travelAlternatives.append(heading);
  plans.forEach((plan, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = index === 0 ? 'active' : '';
    button.textContent = `${index === 0 ? 'Fastest' : `Route ${index + 1}`} · ${formatTravelDuration(plan.durationMinutes)} · ${plan.distanceKilometers.toFixed(1)} km`;
    button.addEventListener('click', () => {
      for (const item of travelAlternatives.querySelectorAll('button')) item.classList.remove('active');
      button.classList.add('active');
      showTravelPlan(plan, false);
    });
    travelAlternatives.append(button);
  });
}

function showTravelPlan(plan: TravelPlan, updateAlternatives = true): void {
  activeTravelPlan = plan;
  travelFromLocation.value = plan.from.id;
  travelToLocation.value = plan.to.id;
  travelMode.value = plan.requestedMode;
  travelTraffic.value = plan.contextRevision === undefined ? plan.trafficProfile : 'live';
  renderTravelPlanResult(plan);
  if (updateAlternatives) renderTravelAlternatives(activeTravelAlternatives);
  syncRendererCustomization();
  if (plan.reachable) setStatus(`${plan.from.label} to ${plan.to.label}: ${formatTravelDuration(plan.durationMinutes)} over ${plan.distanceKilometers.toFixed(1)} km.`, 'success');
  else setStatus('No connected travel route was found for that mode.', 'warning');
}


function setTravelPickTarget(target: 'from' | 'to' | null): void {
  travelPickTarget = target;
  travelPickFrom.dataset.active = String(target === 'from');
  travelPickTo.dataset.active = String(target === 'to');
  canvas.classList.toggle('travel-pick-mode', target !== null);
  if (target !== null) setStatus(`Click the map to set Point ${target === 'from' ? 'A' : 'B'}.`, 'working');
}

function setTravelPointFromMap(x: number, y: number): boolean {
  if (travelPickTarget === null) return false;
  const label = travelPickTarget === 'from' ? 'Point A' : 'Point B';
  const location = pointTravelLocation(world, x, y, label);
  if (location === undefined) {
    setStatus('Choose a point inside the generated world.', 'error');
    return true;
  }
  customTravelLocations.set(location.id, location);
  refreshTravelLocationControls();
  if (travelPickTarget === 'from') travelFromLocation.value = location.id;
  else travelToLocation.value = location.id;
  setStatus(`${label} set at ${location.x}, ${location.y}.`, 'success');
  setTravelPickTarget(null);
  return true;
}

function calculateTravelPlanner(): void {
  const from = resolveTravelLocation(travelFromLocation.value);
  const to = resolveTravelLocation(travelToLocation.value);
  if (from === undefined || to === undefined) {
    setStatus('Choose two valid locations.', 'error');
    return;
  }
  if (from.id === to.id) {
    setStatus('Choose two different locations.', 'error');
    return;
  }
  const liveConditions = travelTraffic.value === 'live';
  const trafficProfile = liveConditions ? TrafficProfile.Normal : travelTraffic.value as TrafficProfile;
  const mode = travelMode.value as TravelMode;
  const context = liveConditions ? simulation?.travelContext() : undefined;
  activeTravelNormalDuration = null;
  if (liveConditions) {
    const normalPlan = planTravel(world, from, to, { mode, trafficProfile: TrafficProfile.Normal });
    if (normalPlan.reachable) activeTravelNormalDuration = normalPlan.durationMinutes;
  }
  activeTravelAlternatives = planTravelAlternatives(world, from, to, {
    mode,
    trafficProfile,
    context,
  }, 3);
  showTravelPlan(activeTravelAlternatives[0] ?? planTravel(world, from, to, { mode, trafficProfile, context }));
}

function updateZoneEditorUi(): void {
  zoneOverrideCount.textContent = String(zoneOverrides.length);
  zoneBrushOutput.value = `${zoneBrushSize.value} tile${zoneBrushSize.value === '1' ? '' : 's'}`;
  zoneEditModeButton.textContent = zoneEditMode ? 'On' : 'Off';
  zoneEditModeButton.dataset.active = String(zoneEditMode);
  canvas.classList.toggle('zone-edit-mode', zoneEditMode);
  zoneEditorStatus.textContent = zoneEditMode
    ? `${zoneToolSelect.selectedOptions[0]?.textContent ?? 'Zone'} tool active · ${zoneOverrides.length} override tiles.`
    : `${zoneOverrides.length} override tiles · turn on Zone editing to paint.`;
}

function setZoneEditMode(enabled: boolean): void {
  if (enabled && authoringTool !== 'select') setAuthoringTool('select');
  zoneEditMode = enabled;
  if (enabled) setEditMode(false);
  zoneStrokeActive = false;
  zoneStrokeStart = null;
  zoneStrokeIndices.clear();
  zoneBrushPreview = [];
  updateZoneEditorUi();
  syncRendererCustomization();
}

function zoneTypeFromControl(): ZoneType | null {
  return zonePaintType.value.length === 0 ? null : zonePaintType.value as ZoneType;
}

function persistAndRegenerateZoneOverrides(
  previous: readonly ZoneOverride[],
  snapshot: EditorSnapshot,
  message: string,
): void {
  persistMapCustomization();
  if (!regenerateFrom('zone-overrides', message)) {
    zoneOverrides = [...previous];
    persistMapCustomization();
    regenerateFrom('zone-overrides', 'Restored previous zoning.');
    return;
  }
  recordHistory(snapshot, 'edit zoning');
  updateZoneEditorUi();
}

function commitZoneIndices(indices: readonly number[], tool: ZoneTool): void {
  if (indices.length === 0) return;
  if (tool === 'eyedropper') {
    const tile = world.tiles[indices[0] ?? -1];
    zonePaintType.value = tile?.zoneType ?? '';
    setStatus(`Picked ${tile?.zoneType ?? 'no zone'}.`, 'success');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previous = [...zoneOverrides];
  if (tool === 'smooth') {
    zoneOverrides = smoothZoneOverrides(world, zoneOverrides, indices);
  } else {
    const mode = tool === 'erase' ? 'erase' : tool === 'lock' ? 'lock' : tool === 'unlock' ? 'unlock' : 'paint';
    zoneOverrides = setZoneOverrides(zoneOverrides, indices, zoneTypeFromControl(), zoneLockNew.checked, mode);
  }
  persistAndRegenerateZoneOverrides(previous, snapshot, `Applied ${tool} to ${indices.length} zone tile${indices.length === 1 ? '' : 's'}.`);
}

function exportCustomization(): void {
  const payload = {
    format: 'payaw-world-overrides',
    version: 1,
    worldSignature: activeWorldSignature,
    customization: worldCustomizationPayload(currentMapCustomization()),
    roadNames: roadNameOverrides,
    blockNames: blockNameOverrides,
    labelDisplay: labelSettings,
    customStoryPoints: customStoryDefinitions,
    islandOverrides,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${world.seed.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.payaw-overrides.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importCustomizationFile(file: File): Promise<void> {
  const parsed = JSON.parse(await file.text()) as {
    customization?: StoredMapCustomization;
    roadNames?: EntityNameOverride[];
    blockNames?: EntityNameOverride[];
    labelDisplay?: LabelDisplaySettings;
    customStoryPoints?: CustomStoryPointDefinition[];
  };
  if (parsed.customization === undefined) throw new Error('The file does not contain PAYAW customization data.');
  const snapshot = captureEditorSnapshot();
  const normalized = normalizeMapCustomization(parsed.customization);
  anchorPositionOverrides = [...normalized.anchorPositions];
  settlementPositionOverrides = [...normalized.settlementPositions];
  storyPositionOverrides = [...normalized.storyPositions];
  storyRuleOverrides = [...normalized.storyRules];
  zoneOverrides = [...normalized.zoneOverrides];
  placedImages = [...normalized.placedImages];
  islandOverrides = [...normalized.islandOverrides];
  bridgeOverrides = [...normalized.bridgeOverrides];
  customBridges = [...normalized.customBridges];
  portOverrides = [...normalized.portOverrides];
  customPorts = [...normalized.customPorts];
  authoringLayer = structuredClone(normalized.authoringLayer);
  npcLocationAuthoring = structuredClone(normalized.npcLocationAuthoring);
  roadNameOverrides = validNameOverrides(parsed.roadNames);
  blockNameOverrides = validNameOverrides(parsed.blockNames);
  if (Array.isArray(parsed.customStoryPoints)) {
    customStoryDefinitions = parsed.customStoryPoints.flatMap((value) => normalizeCustomStoryDefinition(value) ?? []).slice(0, MAX_CUSTOM_STORY_POINTS);
    saveCustomStoryDefinitions(customStoryDefinitions);
  }
  if (parsed.labelDisplay !== undefined) {
    labelSettings = normalizeLabelSettings(parsed.labelDisplay);
    saveLabelSettings(labelSettings);
    applyLabelSettingsToControls(labelSettings);
  }
  persistMapCustomization();
  persistNames();
  generate(customAnchors, builtInOverrides, false);
  recordHistory(snapshot, 'import overrides');
  setStatus('Imported PAYAW overrides.', 'success');
}

function normalizeImportedAsset(value: unknown): ImportedImageAsset | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'string'
    || typeof item.name !== 'string'
    || typeof item.mimeType !== 'string'
    || !item.mimeType.startsWith('image/')
    || typeof item.dataUrl !== 'string'
    || !item.dataUrl.startsWith('data:image/')
    || !isEnumValue(Object.values(AssetTargetCategory), item.targetCategory)
    || !(item.targetType === null || typeof item.targetType === 'string')
  ) return undefined;
  return {
    id: item.id,
    name: item.name.trim() || 'Imported image',
    mimeType: item.mimeType,
    dataUrl: item.dataUrl,
    targetCategory: item.targetCategory,
    targetType: item.targetType,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
  };
}

async function importPayawJsonFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
    throw new Error('Select a JSON file exported by PAYAW.');
  }
  if (file.size >256 * 1024 * 1024) throw new Error('PAYAW JSON is larger than the 256 MB import limit.');
  const parsed: unknown = JSON.parse(await file.text());
  if (typeof parsed !== 'object' || parsed === null) throw new Error('The selected file is not a PAYAW JSON object.');
  const root = parsed as Record<string, unknown>;
  if (root.format === 'payaw-npcs') {
    await importNpcJsonFile(file);
    return;
  }
  if (root.format === 'payaw-world-overrides') {
    await importCustomizationFile(file);
    return;
  }
  if (root.format === 'payaw-project' || typeof root.project === 'object' || typeof root.seed === 'string') {
    await importProjectFile(file);
    return;
  }
  throw new Error('Unsupported JSON. Import a PAYAW project/world export or PAYAW overrides file.');
}


function normalizeStoredSimulation(value: unknown): Partial<StoredSimulationState> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const timeValue = typeof item.time === 'object' && item.time !== null ? item.time as Record<string, unknown> : {};
  const mode = timeValue.mode === 'campaign' || timeValue.mode === 'manual' ? timeValue.mode : 'realtime';
  const rawSpeed = Number(timeValue.speed);
  const speed: SimulationSpeed = rawSpeed === 0 || rawSpeed === 5 || rawSpeed === 15 || rawSpeed === 60 ? rawSpeed : 1;
  const campaignTimestampMs = Number.isFinite(Number(timeValue.campaignTimestampMs))
    ? Number(timeValue.campaignTimestampMs)
    : Date.now();
  const timezone = normalizeSimulationTimezone(timeValue.timezone);
  const weatherValues: readonly WeatherCondition[] = ['clear', 'cloudy', 'rain', 'heavy-rain', 'thunderstorm', 'typhoon'];
  const weatherOverride = weatherValues.includes(item.weatherOverride as WeatherCondition)
    ? item.weatherOverride as WeatherCondition
    : null;
  const normalizeStatuses = (candidate: unknown): Readonly<Record<number, InfrastructureOperationalState>> => {
    if (typeof candidate !== 'object' || candidate === null) return {};
    const valid: readonly InfrastructureOperationalState[] = ['open', 'restricted', 'closed', 'flooded', 'damaged', 'under-repair'];
    const result: Record<number, InfrastructureOperationalState> = {};
    for (const [key, status] of Object.entries(candidate as Record<string, unknown>)) {
      const id = Number(key);
      if (Number.isInteger(id) && id >= 0 && valid.includes(status as InfrastructureOperationalState)) result[id] = status as InfrastructureOperationalState;
    }
    return result;
  };
  const validCategories: readonly SimulationEvent['category'][] = ['time', 'weather', 'traffic', 'infrastructure', 'venue', 'npc', 'supernatural'];
  const validSeverities: readonly SimulationEvent['severity'][] = ['info', 'warning', 'critical'];
  const eventLog: SimulationEvent[] = Array.isArray(item.eventLog) ? item.eventLog.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const event = candidate as Partial<SimulationEvent>;
    if (
      typeof event.id !== 'string'
      || !Number.isFinite(event.timestampMs)
      || !validCategories.includes(event.category as SimulationEvent['category'])
      || !validSeverities.includes(event.severity as SimulationEvent['severity'])
      || typeof event.message !== 'string'
      || event.message.trim().length === 0
    ) return [];
    return [{
      id: event.id,
      timestampMs: event.timestampMs as number,
      category: event.category as SimulationEvent['category'],
      severity: event.severity as SimulationEvent['severity'],
      message: event.message.trim(),
    }];
  }).slice(0, 120) : [];
  return {
    time: { mode, speed: mode === 'manual' ? 0 : speed, campaignTimestampMs, timezone },
    weatherOverride,
    manualRoadStatusById: normalizeStatuses(item.manualRoadStatusById),
    manualBridgeStatusById: normalizeStatuses(item.manualBridgeStatusById),
    manualPortStatusById: normalizeStatuses(item.manualPortStatusById),
    eventLog,
  };
}

async function importProjectPayload(parsed: unknown, sourceLabel: string): Promise<void> {
  if (typeof parsed !== 'object' || parsed === null) throw new Error('The selected file is not a PAYAW JSON object.');
  const root = parsed as Record<string, unknown>;
  const metadata = typeof root.metadata === 'object' && root.metadata !== null ? root.metadata as Record<string, unknown> : {};
  const schemaVersion = typeof metadata.schemaVersion === 'number' ? metadata.schemaVersion : 8;
  if (schemaVersion > 20) throw new Error(`This project uses schema ${schemaVersion}, but this editor supports up to schema 20.`);

  const project = typeof root.project === 'object' && root.project !== null ? root.project as Record<string, unknown> : {};
  const authoring = typeof project.authoring === 'object' && project.authoring !== null
    ? project.authoring as Record<string, unknown>
    : {};
  const seed = typeof project.seed === 'string' ? project.seed : typeof root.seed === 'string' ? root.seed : '';
  if (seed.trim().length === 0) throw new Error('The project JSON does not contain a valid world seed.');
  const profile = normalizeStoredProfile(project.profile ?? metadata);
  const customizationSource = authoring.customization ?? root.customization;
  let customization = normalizeMapCustomization(customizationSource);
  if (authoring.npcLocationAuthoring !== undefined) customization = { ...customization, npcLocationAuthoring: normalizeNpcLocationAuthoring(authoring.npcLocationAuthoring) };
  const anchorState = normalizeAnchorState({
    customAnchors: authoring.customAnchors,
    builtInAnchorOverrides: authoring.builtInAnchorOverrides,
  });
  const importedRoadNames = validNameOverrides(authoring.roadNames);
  const importedBlockNames = validNameOverrides(authoring.blockNames);
  const labelSource = authoring.labelDisplay
    ?? (typeof root.customization === 'object' && root.customization !== null
      ? (root.customization as Record<string, unknown>).labelDisplay
      : undefined);
  const storySource = authoring.customStoryPoints
    ?? (typeof root.customization === 'object' && root.customization !== null
      ? (root.customization as Record<string, unknown>).customStoryPoints
      : undefined);
  const importedStories = Array.isArray(storySource)
    ? storySource.flatMap((value) => normalizeCustomStoryDefinition(value) ?? []).slice(0, MAX_CUSTOM_STORY_POINTS)
    : [];
  const importedNpcRosterSize = Math.round(finiteSetting(authoring.npcRosterSize, 0, 0, 200));
  pendingImportedSimulation = normalizeStoredSimulation(authoring.simulation);
  pendingImportedCampaign = normalizeCampaignState(authoring.campaign ?? root.campaign, `world:${seed.trim()}`);
  const importedPlayerViewSource = authoring.playerView ?? root.playerView;
  const importedPlayerCount = typeof importedPlayerViewSource === 'object' && importedPlayerViewSource !== null
    && Array.isArray((importedPlayerViewSource as Record<string, unknown>).players)
    ? (importedPlayerViewSource as { readonly players: readonly unknown[] }).players.length
    : 6;
  pendingImportedPlayerView = normalizePlayerViewState(importedPlayerViewSource, importedPlayerCount);
  const assetSource = authoring.imageAssets
    ?? (typeof root.customization === 'object' && root.customization !== null
      ? (root.customization as Record<string, unknown>).imageAssets
      : undefined);
  const assets = Array.isArray(assetSource)
    ? assetSource.flatMap((value) => normalizeImportedAsset(value) ?? []).slice(0, 256)
    : [];

  seedInput.value = seed.trim();
  terrainSizeSelect.value = profile.terrainSize;
  townScaleSelect.value = profile.townScale;
  terrainShapeSelect.value = profile.terrainShape;
  climatePresetSelect.value = profile.climatePreset;
  islandCountInput.value = String(profile.islandCount);
  islandSpacingInput.value = String(profile.islandSpacingKilometers);
    updateProfileHint();

  customAnchors = [...anchorState.customAnchors];
  builtInOverrides = [...anchorState.builtInOverrides];
  customStoryDefinitions = importedStories;
  labelSettings = normalizeLabelSettings(labelSource);
  applyLabelSettingsToControls(labelSettings);
  roadNameOverrides = importedRoadNames;
  blockNameOverrides = importedBlockNames;

  const signature = worldSignature();
  saveProfile(profile);
  saveAnchorState(customAnchors, builtInOverrides);
  saveCustomStoryDefinitions(customStoryDefinitions);
  saveLabelSettings(labelSettings);
  saveNameState(signature, { roads: roadNameOverrides, blocks: blockNameOverrides });
  saveMapCustomization(signature, customization);
  for (const asset of assets) await assetRepository.put(asset);
  await refreshAssetLibrary();

  if (!await generateResponsive(customAnchors, builtInOverrides, true, true)) {
    throw new Error(statusMessage.textContent ?? 'The imported PAYAW project could not be generated.');
  }
  if (importedNpcRosterSize > 0 && importedNpcRosterSize !== world.npcs.length) {
    world.npcs = generateNPCPopulation(world, new SeededRandom(world.seed).fork(`npc-import-${importedNpcRosterSize}`), importedNpcRosterSize);
    renderNPCList();
    refreshTravelLocationControls();
    requestRender();
  }
  if (pendingImportedCampaign !== null) {
    campaignState = normalizeCampaignState(pendingImportedCampaign, currentCampaignWorldRef());
    pendingImportedCampaign = null;
    campaignStudio?.replaceState(campaignState);
    const campaignTimestamp = Date.parse(campaignState.runState.campaignTime);
    if (Number.isFinite(campaignTimestamp)) simulation?.setTimestamp(campaignTimestamp);
    simulation?.setWeatherOverride(campaignState.runState.weatherOverride === 'auto' ? null : campaignState.runState.weatherOverride as WeatherCondition);
  }
  if (pendingImportedPlayerView !== null) {
    playerViewState = pendingImportedPlayerView;
    pendingImportedPlayerView = null;
  }
  campaignStudio?.refreshExternalReferences();
  playerPreview?.refresh();
  setStatus(`Imported ${sourceLabel}${assets.length > 0 ? ` with ${assets.length} embedded asset${assets.length === 1 ? '' : 's'}` : ''}.`, 'success');
}

async function loadHostedAuthorityDocument(value: Readonly<Record<string, unknown>>): Promise<void> {
  const project = typeof value.project === 'object' && value.project !== null
    ? value.project as Record<string, unknown>
    : null;
  if (project !== null && typeof project.seed === 'string' && project.seed.trim().length > 0) {
    await importProjectPayload(value, 'hosted campaign state');
    return;
  }

  const campaignSource = value.campaign;
  const playerViewSource = value.playerView;
  if (typeof campaignSource !== 'object' || campaignSource === null) {
    throw new Error('The hosted campaign authority does not contain a campaign state or world recipe.');
  }
  campaignState = normalizeCampaignState(campaignSource, currentCampaignWorldRef());
  campaignStudio?.replaceState(campaignState);
  const campaignTimestamp = Date.parse(campaignState.runState.campaignTime);
  if (Number.isFinite(campaignTimestamp)) simulation?.setTimestamp(campaignTimestamp);
  simulation?.setWeatherOverride(campaignState.runState.weatherOverride === 'auto'
    ? null
    : campaignState.runState.weatherOverride as WeatherCondition);

  const playerCount = typeof playerViewSource === 'object' && playerViewSource !== null
    && Array.isArray((playerViewSource as Record<string, unknown>).players)
    ? (playerViewSource as { readonly players: readonly unknown[] }).players.length
    : playerViewState.players.length || 6;
  playerViewState = normalizePlayerViewState(playerViewSource, playerCount);
  campaignStudio?.refreshExternalReferences();
  playerPreview?.refresh();
  setStatus('Loaded hosted campaign state. This older snapshot did not contain a world recipe, so the current local map was retained.', 'success');
}

async function importProjectFile(file: File): Promise<void> {
  if (file.size > 256 * 1024 * 1024) throw new Error('Project JSON is larger than the 256 MB import limit.');
  const parsed: unknown = JSON.parse(await file.text());
  await importProjectPayload(parsed, 'PAYAW project JSON');
}

function appendAssetCategoryOptions(select: HTMLSelectElement, selected: AssetTargetCategory): void {
  select.replaceChildren();
  for (const category of Object.values(AssetTargetCategory)) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = ASSET_CATEGORY_LABELS[category];
    select.append(option);
  }
  select.value = selected;
}

function appendAssetTargetOptions(select: HTMLSelectElement, category: AssetTargetCategory, selected: string | null): void {
  select.replaceChildren();
  const targets = assetTargetsFor(category);
  if (targets.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No procedural target';
    select.append(option);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const target of targets) {
    const option = document.createElement('option');
    option.value = target.value;
    option.textContent = target.label;
    select.append(option);
  }
  select.value = selected !== null && targets.some((target) => target.value === selected) ? selected : targets[0]?.value ?? '';
}

function runtimeAsset(assetId: string): RuntimeImageAsset | undefined {
  return runtimeImageAssets.find((asset) => asset.definition.id === assetId);
}

function createPlacedImage(asset: RuntimeImageAsset, x: number, y: number): PlacedImage {
  const aspect = asset.image.naturalWidth / Math.max(1, asset.image.naturalHeight);
  const baseWidth = 8;
  return {
    id: createRuleId(),
    assetId: asset.definition.id,
    name: asset.definition.name,
    x,
    y,
    width: baseWidth,
    height: Math.max(1, baseWidth / Math.max(0.15, aspect)),
    rotation: 0,
    opacity: 1,
    zIndex: placedImages.length === 0 ? 0 : Math.max(...placedImages.map((item) => item.zIndex)) + 1,
  };
}

function placeAssetAt(assetId: string, x: number, y: number): void {
  const asset = runtimeAsset(assetId);
  if (asset === undefined) {
    setStatus('That image asset is not available.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  placedImages = [...placedImages, createPlacedImage(asset, x, y)];
  persistMapCustomization();
  renderPlacedImageList();
  syncRendererCustomization();
  recordHistory(snapshot, `place image ${asset.definition.name}`);
  setStatus(`Placed ${asset.definition.name}. Turn on Edit to move it.`, 'success');
}

function updatePlacedImage(id: string, update: (item: PlacedImage) => PlacedImage, persist = true): void {
  placedImages = placedImages.map((item) => item.id === id ? update(item) : item);
  if (persist) {
    persistMapCustomization();
    renderPlacedImageList();
  }
  syncRendererCustomization();
}

function removePlacedImage(id: string): void {
  const snapshot = captureEditorSnapshot();
  const placement = placedImages.find((item) => item.id === id);
  placedImages = placedImages.filter((item) => item.id !== id);
  persistMapCustomization();
  renderPlacedImageList();
  syncRendererCustomization();
  recordHistory(snapshot, `remove image ${placement?.name ?? id}`);
}

function renderAssetList(): void {
  assetCount.textContent = String(importedAssets.length);
  assetList.replaceChildren();
  if (importedAssets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'asset-empty';
    empty.textContent = 'No imported assets yet.';
    assetList.append(empty);
    return;
  }

  for (const definition of importedAssets) {
    const item = document.createElement('article');
    item.className = 'asset-item';
    item.draggable = true;
    item.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('application/x-payaw-asset-id', definition.id);
      if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'copy';
    });

    const preview = document.createElement('div');
    preview.className = 'asset-preview';
    const image = document.createElement('img');
    image.src = definition.dataUrl;
    image.alt = '';
    preview.append(image);

    const content = document.createElement('div');
    content.className = 'asset-content';
    const titleRow = document.createElement('div');
    titleRow.className = 'asset-title-row';
    const title = document.createElement('strong');
    title.textContent = definition.name;
    const type = document.createElement('span');
    type.textContent = describeAssetTarget(definition.targetCategory, definition.targetType);
    titleRow.append(title, type);

    const controls = document.createElement('div');
    controls.className = 'asset-controls';
    const categorySelect = document.createElement('select');
    categorySelect.setAttribute('aria-label', `Asset category for ${definition.name}`);
    appendAssetCategoryOptions(categorySelect, definition.targetCategory);
    const targetSelect = document.createElement('select');
    targetSelect.setAttribute('aria-label', `Procedural target for ${definition.name}`);
    appendAssetTargetOptions(targetSelect, definition.targetCategory, definition.targetType);
    const saveAssignment = (): void => {
      const category = categorySelect.value as AssetTargetCategory;
      const targetType = category === AssetTargetCategory.Map || targetSelect.value.length === 0 ? null : targetSelect.value;
      const { buildingType: _legacyBuildingType, ...withoutLegacy } = definition;
      const next: ImportedImageAsset = { ...withoutLegacy, targetCategory: category, targetType };
      void assetRepository.put(next).then(refreshAssetLibrary).catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : String(error), 'error');
      });
    };
    categorySelect.addEventListener('change', () => {
      appendAssetTargetOptions(targetSelect, categorySelect.value as AssetTargetCategory, null);
      saveAssignment();
    });
    targetSelect.addEventListener('change', saveAssignment);
    const place = document.createElement('button');
    place.type = 'button';
    place.textContent = 'Place';
    place.addEventListener('click', () => {
      const center = camera.screenToWorld(canvas.clientWidth * 0.5, canvas.clientHeight * 0.5);
      placeAssetAt(definition.id, center.x, center.y);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      void assetRepository.delete(definition.id).then(() => {
        placedImages = placedImages.filter((placement) => placement.assetId !== definition.id);
        persistMapCustomization();
        return refreshAssetLibrary();
      }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
    });
    controls.append(categorySelect, targetSelect, place, remove);
    content.append(titleRow, controls);
    item.append(preview, content);
    assetList.append(item);
  }
}

function renderPlacedImageList(): void {
  placedImageList.replaceChildren();
  if (placedImages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'asset-empty';
    empty.textContent = 'Drop an image onto the map or place one from the asset library.';
    placedImageList.append(empty);
    return;
  }

  for (const placement of placedImages) {
    const definition = importedAssets.find((asset) => asset.id === placement.assetId);
    if (definition === undefined) continue;
    const item = document.createElement('article');
    item.className = 'placed-image-item';
    const preview = document.createElement('div');
    preview.className = 'asset-preview';
    const image = document.createElement('img');
    image.src = definition.dataUrl;
    image.alt = '';
    preview.append(image);

    const content = document.createElement('div');
    content.className = 'placed-image-content';
    const titleRow = document.createElement('div');
    titleRow.className = 'asset-title-row';
    const title = document.createElement('strong');
    title.textContent = placement.name;
    const coordinate = document.createElement('span');
    coordinate.textContent = `${placement.x.toFixed(1)}, ${placement.y.toFixed(1)}`;
    titleRow.append(title, coordinate);

    const controls = document.createElement('div');
    controls.className = 'placed-image-controls';
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Size';
    const size = document.createElement('input');
    size.type = 'range';
    size.min = '2';
    size.max = '32';
    size.step = '0.5';
    size.value = String(placement.width);
    let sizeHistorySnapshot: EditorSnapshot | null = null;
    const beginSizeEdit = (): void => { sizeHistorySnapshot ??= captureEditorSnapshot(); };
    size.addEventListener('pointerdown', beginSizeEdit);
    size.addEventListener('keydown', beginSizeEdit);
    size.addEventListener('input', () => {
      beginSizeEdit();
      const asset = runtimeAsset(placement.assetId);
      const aspect = asset === undefined ? placement.width / Math.max(0.1, placement.height) : asset.image.naturalWidth / Math.max(1, asset.image.naturalHeight);
      updatePlacedImage(placement.id, (current) => ({
        ...current,
        width: Number(size.value),
        height: Math.max(0.5, Number(size.value) / Math.max(0.15, aspect)),
      }), false);
    });
    size.addEventListener('change', () => {
      persistMapCustomization();
      if (sizeHistorySnapshot !== null) recordHistory(sizeHistorySnapshot, `resize image ${placement.name}`);
      sizeHistorySnapshot = null;
    });
    sizeLabel.append(size);

    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = 'Opacity';
    const opacity = document.createElement('input');
    opacity.type = 'range';
    opacity.min = '0.1';
    opacity.max = '1';
    opacity.step = '0.05';
    opacity.value = String(placement.opacity);
    let opacityHistorySnapshot: EditorSnapshot | null = null;
    const beginOpacityEdit = (): void => { opacityHistorySnapshot ??= captureEditorSnapshot(); };
    opacity.addEventListener('pointerdown', beginOpacityEdit);
    opacity.addEventListener('keydown', beginOpacityEdit);
    opacity.addEventListener('input', () => {
      beginOpacityEdit();
      updatePlacedImage(placement.id, (current) => ({ ...current, opacity: Number(opacity.value) }), false);
    });
    opacity.addEventListener('change', () => {
      persistMapCustomization();
      if (opacityHistorySnapshot !== null) recordHistory(opacityHistorySnapshot, `change opacity for ${placement.name}`);
      opacityHistorySnapshot = null;
    });
    opacityLabel.append(opacity);
    controls.append(sizeLabel, opacityLabel);

    const actions = document.createElement('div');
    actions.className = 'placed-image-actions';
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    focus.addEventListener('click', () => focusMapPoint(placement.x, placement.y));
    const rotate = document.createElement('button');
    rotate.type = 'button';
    rotate.textContent = 'Rotate';
    rotate.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      updatePlacedImage(placement.id, (current) => ({ ...current, rotation: current.rotation + Math.PI / 2 }));
      recordHistory(snapshot, `rotate image ${placement.name}`);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removePlacedImage(placement.id));
    actions.append(focus, rotate, remove);

    content.append(titleRow, controls, actions);
    item.append(preview, content);
    placedImageList.append(item);
  }
}

async function refreshAssetLibrary(): Promise<void> {
  importedAssets = await assetRepository.list();
  const loaded = await Promise.all(importedAssets.map(async (definition) => {
    try {
      return { definition, image: await loadImage(definition.dataUrl) } satisfies RuntimeImageAsset;
    } catch {
      return undefined;
    }
  }));
  runtimeImageAssets = loaded.filter((asset): asset is RuntimeImageAsset => asset !== undefined);
  renderAssetList();
  renderPlacedImageList();
  syncRendererCustomization();
  updateStats(stats, world);
}

async function importAssetFiles(
  files: readonly File[],
  targetCategory: AssetTargetCategory,
  targetType: string | null,
): Promise<RuntimeImageAsset[]> {
  const imported: RuntimeImageAsset[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 16 * 1024 * 1024) {
      throw new Error(`${file.name} is larger than the 16 MB per-image limit.`);
    }
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const definition: ImportedImageAsset = {
      id: createRuleId(),
      name: file.name.replace(/\.[^.]+$/, '') || 'Imported image',
      mimeType: file.type,
      dataUrl,
      targetCategory,
      targetType,
      createdAt: new Date().toISOString(),
    };
    await assetRepository.put(definition);
    imported.push({ definition, image });
  }
  await refreshAssetLibrary();
  return imported;
}


function formatPopulation(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function replaceBridgeOverride(next: BridgeOverride): void {
  bridgeOverrides = [...bridgeOverrides.filter((item) => item.key !== next.key), next]
    .sort((left, right) => left.key.localeCompare(right.key));
}

function refreshBridgeIslandOptions(): void {
  const previousFrom = bridgeFromIsland.value;
  const previousTo = bridgeToIsland.value;
  bridgeFromIsland.replaceChildren();
  bridgeToIsland.replaceChildren();
  for (const island of world.islands) {
    const label = `${island.name} · ${formatPopulation(island.allocatedPopulation)} people`;
    for (const select of [bridgeFromIsland, bridgeToIsland]) {
      const option = document.createElement('option');
      option.value = island.key;
      option.textContent = label;
      option.disabled = !island.allowBridges;
      select.append(option);
    }
  }
  bridgeFromIsland.value = world.islands.some((island) => island.key === previousFrom) ? previousFrom : world.islands[0]?.key ?? '';
  const defaultTo = world.islands.find((island) => island.key !== bridgeFromIsland.value && island.allowBridges)?.key ?? '';
  bridgeToIsland.value = world.islands.some((island) => island.key === previousTo && island.key !== bridgeFromIsland.value) ? previousTo : defaultTo;
  const disabled = world.islands.filter((island) => island.allowBridges).length < 2;
  bridgeFromIsland.disabled = disabled;
  bridgeToIsland.disabled = disabled;
}

function renderBridgeList(): void {
  bridgeCount.textContent = String(world.bridges.length);
  refreshBridgeIslandOptions();
  const totalLength = world.bridges.reduce((sum, bridge) => sum + bridge.length, 0);
  const generatedCount = world.bridges.filter((bridge) => bridge.generated).length;
  bridgeSummary.replaceChildren();
  for (const [label, value] of [
    ['Bridges', String(world.bridges.length)],
    ['Generated', String(generatedCount)],
    ['Custom', String(world.bridges.length - generatedCount)],
    ['Combined span', `${totalLength.toFixed(1)} tiles`],
  ] as const) {
    const item = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = value;
    item.append(strong, ` ${label.toLocaleLowerCase()}`);
    bridgeSummary.append(item);
  }

  bridgeList.replaceChildren();
  if (world.bridges.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = world.islands.length < 2
      ? 'This terrain has no separate islands to bridge.'
      : 'No crossing met the current span, island-policy, and approach constraints. You can add a custom bridge or enable bridges in an island plan.';
    bridgeList.append(empty);
    return;
  }

  for (const bridge of world.bridges) {
    const from = world.islands[bridge.fromIslandId];
    const to = world.islands[bridge.toIslandId];
    if (from === undefined || to === undefined) continue;
    const card = document.createElement('article');
    card.className = 'bridge-item';
    const heading = document.createElement('div');
    heading.className = 'bridge-item-heading';
    const title = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = bridge.name;
    const details = document.createElement('small');
    details.textContent = `${BRIDGE_TYPE_LABELS[bridge.type]} · ${bridge.length.toFixed(1)} tiles · ${bridge.approachRoadIds.length} approach road${bridge.approachRoadIds.length === 1 ? '' : 's'}`;
    const route = document.createElement('span');
    route.className = 'bridge-route-chip';
    route.textContent = `${from.name} → ${to.name} · ${bridge.generated ? 'generated' : 'custom'}`;
    title.append(name, details, route);
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    const midpoint = bridge.centerline[Math.floor(bridge.centerline.length * 0.5)];
    focus.addEventListener('click', () => focusMapPoint(midpoint?.x ?? bridge.start.x, midpoint?.y ?? bridge.start.y));
    heading.append(title, focus);

    const grid = document.createElement('div');
    grid.className = 'bridge-editor-grid';
    const field = (labelText: string, control: HTMLElement): HTMLLabelElement => {
      const label = document.createElement('label');
      label.className = 'form-field';
      const text = document.createElement('span');
      text.textContent = labelText;
      label.append(text, control);
      return label;
    };
    const nameInput = document.createElement('input');
    nameInput.value = bridge.name;
    nameInput.maxLength = 56;
    const typeSelect = document.createElement('select');
    for (const value of Object.values(BridgeType)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = BRIDGE_TYPE_LABELS[value];
      typeSelect.append(option);
    }
    typeSelect.value = bridge.type;
    const roadSelect = document.createElement('select');
    for (const value of Object.values(RoadType)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value.replaceAll('-', ' ');
      roadSelect.append(option);
    }
    roadSelect.value = bridge.roadClass;
    const widthInput = document.createElement('input');
    widthInput.type = 'number'; widthInput.min = '0.4'; widthInput.max = '3.5'; widthInput.step = '0.05'; widthInput.value = String(bridge.deckWidth);
    const clearanceInput = document.createElement('input');
    clearanceInput.type = 'number'; clearanceInput.min = '0'; clearanceInput.max = '40'; clearanceInput.step = '0.5'; clearanceInput.value = String(bridge.clearance);
    const startX = document.createElement('input'); startX.type = 'number'; startX.step = '0.5'; startX.value = bridge.start.x.toFixed(1);
    const startY = document.createElement('input'); startY.type = 'number'; startY.step = '0.5'; startY.value = bridge.start.y.toFixed(1);
    const endX = document.createElement('input'); endX.type = 'number'; endX.step = '0.5'; endX.value = bridge.end.x.toFixed(1);
    const endY = document.createElement('input'); endY.type = 'number'; endY.step = '0.5'; endY.value = bridge.end.y.toFixed(1);
    grid.append(field('Bridge name', nameInput), field('Type', typeSelect), field('Road class', roadSelect), field('Deck width', widthInput), field('Clearance', clearanceInput), field('Start X', startX), field('Start Y', startY), field('End X', endX), field('End Y', endY));

    const lockLabel = document.createElement('label');
    lockLabel.className = 'check-row';
    const lockInput = document.createElement('input');
    lockInput.type = 'checkbox'; lockInput.checked = bridge.locked;
    const lockText = document.createElement('span'); lockText.textContent = 'Lock authored bridge settings';
    lockLabel.append(lockInput, lockText);

    const actions = document.createElement('div');
    actions.className = 'button-row';
    const apply = document.createElement('button');
    apply.type = 'button'; apply.className = 'primary'; apply.textContent = 'Apply bridge';
    apply.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      const previous = [...bridgeOverrides];
      replaceBridgeOverride({
        key: bridge.key,
        name: nameInput.value.trim() || bridge.name,
        type: typeSelect.value as BridgeType,
        roadClass: roadSelect.value as RoadType,
        deckWidth: Number(widthInput.value),
        clearance: Number(clearanceInput.value),
        start: { x: Number(startX.value), y: Number(startY.value) },
        end: { x: Number(endX.value), y: Number(endY.value) },
        locked: lockInput.checked,
      });
      persistMapCustomization();
      if (regenerateFrom('bridges', `Updated ${nameInput.value.trim() || bridge.name}.`)) {
        recordHistory(snapshot, `edit bridge ${bridge.name}`);
        return;
      }
      bridgeOverrides = previous;
      persistMapCustomization();
      regenerateFrom('bridges', 'Restored the previous bridge network.');
    });
    const reset = document.createElement('button');
    reset.type = 'button'; reset.textContent = 'Reset edits';
    reset.disabled = !bridgeOverrides.some((item) => item.key === bridge.key);
    reset.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      bridgeOverrides = bridgeOverrides.filter((item) => item.key !== bridge.key);
      persistMapCustomization();
      if (regenerateFrom('bridges', `Reset ${bridge.name}.`)) recordHistory(snapshot, `reset bridge ${bridge.name}`);
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'danger'; remove.textContent = bridge.generated ? 'Suppress generated bridge' : 'Delete custom bridge';
    remove.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      if (bridge.generated) replaceBridgeOverride({ key: bridge.key, suppressed: true });
      else {
        customBridges = customBridges.filter((item) => item.key !== bridge.key);
        bridgeOverrides = bridgeOverrides.filter((item) => item.key !== bridge.key);
      }
      persistMapCustomization();
      if (regenerateFrom('bridges', `${bridge.generated ? 'Suppressed' : 'Deleted'} ${bridge.name}.`)) recordHistory(snapshot, `${bridge.generated ? 'suppress' : 'delete'} bridge ${bridge.name}`);
    });
    actions.append(apply, reset, remove);
    card.append(heading, grid, lockLabel, actions);
    bridgeList.append(card);
  }
}

function replacePortOverride(next: PortOverride): void {
  portOverrides = [...portOverrides.filter((item) => item.key !== next.key), next]
    .sort((left, right) => left.key.localeCompare(right.key));
}

function refreshPortIslandOptions(): void {
  const previous = portIsland.value;
  portIsland.replaceChildren();
  for (const island of world.islands) {
    const option = document.createElement('option');
    option.value = island.key;
    option.textContent = `${island.name} · ${formatPopulation(island.allocatedPopulation)} people`;
    option.disabled = !island.allowPorts;
    portIsland.append(option);
  }
  const fallback = world.islands.find((island) => island.allowPorts)?.key ?? '';
  portIsland.value = world.islands.some((island) => island.key === previous && island.allowPorts) ? previous : fallback;
  portIsland.disabled = fallback.length === 0;
}

function maritimeField(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'form-field';
  const text = document.createElement('span');
  text.textContent = labelText;
  label.append(text, control);
  return label;
}

function renderPortList(): void {
  portCount.textContent = String(world.ports.length);
  refreshPortIslandOptions();
  const generatedCount = world.ports.filter((port) => port.generated).length;
  const totalCapacity = world.ports.reduce((sum, port) => sum + port.capacity, 0);
  portSummary.replaceChildren();
  for (const [label, value] of [
    ['Ports', String(world.ports.length)],
    ['Generated', String(generatedCount)],
    ['Custom', String(world.ports.length - generatedCount)],
    ['Capacity', totalCapacity.toLocaleString()],
  ] as const) {
    const item = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = value;
    item.append(strong, ` ${label.toLocaleLowerCase()}`);
    portSummary.append(item);
  }

  portList.replaceChildren();
  if (world.ports.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'No island currently has a valid port site. Enable ports in an island plan or add a custom port to a suitable coast.';
    portList.append(empty);
    return;
  }

  for (const port of world.ports) {
    const island = world.islands[port.islandId];
    const card = document.createElement('article');
    card.className = 'port-item';
    const heading = document.createElement('div');
    heading.className = 'maritime-item-heading';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = port.name;
    const detail = document.createElement('small');
    detail.textContent = `${PORT_TYPE_LABELS[port.type]} · capacity ${port.capacity.toLocaleString()}`;
    const chip = document.createElement('span');
    chip.className = 'maritime-route-chip';
    chip.textContent = `${island?.name ?? 'Unknown island'} · ${port.generated ? 'generated' : 'custom'} · depth ${port.waterDepth.toFixed(3)}`;
    copy.append(title, detail, chip);
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    focus.addEventListener('click', () => focusMapPoint(port.position.x, port.position.y));
    heading.append(copy, focus);

    const grid = document.createElement('div');
    grid.className = 'maritime-editor-grid';
    const nameInput = document.createElement('input');
    nameInput.value = port.name;
    nameInput.maxLength = 56;
    const typeSelect = document.createElement('select');
    for (const value of Object.values(PortType)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = PORT_TYPE_LABELS[value];
      typeSelect.append(option);
    }
    typeSelect.value = port.type;
    const capacityInput = document.createElement('input');
    capacityInput.type = 'number';
    capacityInput.min = '20';
    capacityInput.max = '5000';
    capacityInput.step = '10';
    capacityInput.value = String(port.capacity);
    const xInput = document.createElement('input');
    xInput.type = 'number'; xInput.step = '0.5'; xInput.value = port.position.x.toFixed(1);
    const yInput = document.createElement('input');
    yInput.type = 'number'; yInput.step = '0.5'; yInput.value = port.position.y.toFixed(1);
    grid.append(
      maritimeField('Port name', nameInput),
      maritimeField('Type', typeSelect),
      maritimeField('Capacity', capacityInput),
      maritimeField('Coast X', xInput),
      maritimeField('Coast Y', yInput),
    );

    const lockLabel = document.createElement('label');
    lockLabel.className = 'check-row';
    const lockInput = document.createElement('input');
    lockInput.type = 'checkbox'; lockInput.checked = port.locked;
    const lockText = document.createElement('span');
    lockText.textContent = 'Lock authored port settings';
    lockLabel.append(lockInput, lockText);

    const actions = document.createElement('div');
    actions.className = 'button-row';
    const apply = document.createElement('button');
    apply.type = 'button'; apply.className = 'primary'; apply.textContent = 'Apply port';
    apply.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      const previous = [...portOverrides];
      replacePortOverride({
        key: port.key,
        name: nameInput.value.trim() || port.name,
        type: typeSelect.value as PortType,
        capacity: Number(capacityInput.value),
        position: { x: Number(xInput.value), y: Number(yInput.value) },
        locked: lockInput.checked,
      });
      persistMapCustomization();
      if (regenerateFrom('ports', `Updated ${nameInput.value.trim() || port.name}.`)) {
        recordHistory(snapshot, `edit port ${port.name}`);
        return;
      }
      portOverrides = previous;
      persistMapCustomization();
      regenerateFrom('ports', 'Restored the previous port network.');
    });
    const reset = document.createElement('button');
    reset.type = 'button'; reset.textContent = 'Reset edits';
    reset.disabled = !portOverrides.some((item) => item.key === port.key);
    reset.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      portOverrides = portOverrides.filter((item) => item.key !== port.key);
      persistMapCustomization();
      if (regenerateFrom('ports', `Reset ${port.name}.`)) recordHistory(snapshot, `reset port ${port.name}`);
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'danger';
    remove.textContent = port.generated ? 'Suppress generated port' : 'Delete custom port';
    remove.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      if (port.generated) replacePortOverride({ key: port.key, suppressed: true });
      else {
        customPorts = customPorts.filter((item) => item.key !== port.key);
        portOverrides = portOverrides.filter((item) => item.key !== port.key);
      }
      persistMapCustomization();
      if (regenerateFrom('ports', `${port.generated ? 'Suppressed' : 'Deleted'} ${port.name}.`)) {
        recordHistory(snapshot, `${port.generated ? 'suppress' : 'delete'} port ${port.name}`);
      }
    });
    actions.append(apply, reset, remove);
    card.append(heading, grid, lockLabel, actions);
    portList.append(card);
  }
}

// Kept only to read legacy projects safely. The Milestone 21 shell retires
// these authoring editors and no longer performs their expensive list renders.
void renderBridgeList;
void renderPortList;

function renderNameEditors(): void {
  const selectedRoad = Number(roadNameTarget.value);
  roadNameTarget.replaceChildren();
  for (const road of world.roads) {
    const option = document.createElement('option');
    option.value = String(road.id);
    option.textContent = `#${road.id} · ${road.name} · ${road.type}`;
    roadNameTarget.append(option);
  }
  roadNameTarget.value = world.roads[selectedRoad] === undefined ? '0' : String(selectedRoad);
  syncRoadNameInput();

  const selectedBlock = Number(blockNameTarget.value);
  blockNameTarget.replaceChildren();
  for (const block of world.blocks) {
    const option = document.createElement('option');
    option.value = String(block.id);
    const zone = block.zoneId === null ? 'unassigned' : world.zones[block.zoneId]?.type ?? 'unassigned';
    option.textContent = `#${block.id} · ${block.name} · ${zone}`;
    blockNameTarget.append(option);
  }
  blockNameTarget.value = world.blocks[selectedBlock] === undefined ? '0' : String(selectedBlock);
  syncBlockNameInput();
}

function syncRoadNameInput(): void {
  roadNameInput.value = world.roads[Number(roadNameTarget.value)]?.name ?? '';
}

function syncBlockNameInput(): void {
  blockNameInput.value = world.blocks[Number(blockNameTarget.value)]?.name ?? '';
}



function currentNpcScheduleEntry(npc: NPC) {
  return npcScheduleEntryForPeriod(npc, activeNpcSchedulePeriod);
}

function syncNpcViewToggle(): void {
  const visible = layerElements[RenderLayer.NPCs].checked;
  npcViewToggleButton.textContent = visible ? 'NPCs: shown' : 'NPCs: hidden';
  npcViewToggleButton.setAttribute('aria-pressed', String(visible));
  npcViewToggleButton.dataset.active = String(visible);
}

function toggleNpcView(): void {
  const checkbox = layerElements[RenderLayer.NPCs];
  checkbox.checked = !checkbox.checked;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
}

function zonedDateParts(timestampMs: number, timezone: string): Readonly<Record<string, number>> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestampMs));
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function datetimeLocalValue(timestampMs: number, timezone: string): string {
  const parts = zonedDateParts(timestampMs, timezone);
  const pad = (value: number | undefined): string => String(value ?? 0).padStart(2, '0');
  return `${parts.year ?? 1970}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function timestampFromZonedLocal(value: string, timezone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return Number.NaN;
  const desired = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]), second: 0,
  };
  let guess = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedDateParts(guess, timezone);
    const actualUtc = Date.UTC(actual.year ?? 1970, (actual.month ?? 1) - 1, actual.day ?? 1, actual.hour ?? 0, actual.minute ?? 0, actual.second ?? 0);
    const desiredUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, 0);
    const correction = desiredUtc - actualUtc;
    guess += correction;
    if (Math.abs(correction) < 1000) break;
  }
  return guess;
}

function renderInfrastructureTargets(): void {
  const selected = simulationInfrastructureTarget.value;
  const kind = simulationInfrastructureKind.value as 'road' | 'bridge' | 'port';
  const state = simulation?.state().infrastructure;
  const items = kind === 'road'
    ? world.roads.map((item) => ({ id: item.id, label: item.name, status: state?.roadStatusById[item.id] ?? 'open', manual: state?.manualRoadStatusById[item.id] }))
    : kind === 'bridge'
      ? world.bridges.map((item) => ({ id: item.id, label: item.name, status: state?.bridgeStatusById[item.id] ?? 'open', manual: state?.manualBridgeStatusById[item.id] }))
      : world.ports.map((item) => ({ id: item.id, label: item.name, status: state?.portStatusById[item.id] ?? 'open', manual: state?.manualPortStatusById[item.id] }));
  simulationInfrastructureTarget.replaceChildren();
  for (const item of items) {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = `${item.label} · ${item.status.replace('-', ' ')}${item.manual === undefined ? '' : ' · manual'}`;
    simulationInfrastructureTarget.append(option);
  }
  if (items.some((item) => String(item.id) === selected)) simulationInfrastructureTarget.value = selected;
  const selectedItem = items.find((item) => String(item.id) === simulationInfrastructureTarget.value) ?? items[0];
  if (selectedItem !== undefined) simulationInfrastructureStatus.value = selectedItem.manual ?? selectedItem.status;
  simulationInfrastructureTarget.disabled = items.length === 0;
  simulationInfrastructureApply.disabled = items.length === 0;
  simulationInfrastructureClear.disabled = items.length === 0 || selectedItem?.manual === undefined;
}

function setSimulationHealth(kind: string, state: 'good' | 'warning' | 'critical' | 'neutral'): void {
  const card = document.querySelector<HTMLElement>(`[data-simulation-health="${kind}"]`);
  if (card !== null) card.dataset.state = state;
}

function simulationEventIcon(category: SimulationEvent['category']): string {
  if (category === 'weather') return '≋';
  if (category === 'traffic') return '⇄';
  if (category === 'infrastructure') return '⌁';
  if (category === 'venue') return '⌂';
  if (category === 'npc') return '●';
  if (category === 'supernatural') return '◉';
  return '◷';
}

function renderSimulationPanel(): void {
  if (simulation === null) return;
  const state = simulation.state();
  renderer.setSimulationState(state);
  simulationClockMode.value = state.time.mode;
  simulationSpeed.value = String(state.time.speed);
  simulationSpeed.disabled = state.time.mode === 'realtime';
  simulationLiveBadge.textContent = state.time.mode === 'realtime'
    ? 'LIVE'
    : state.time.mode === 'campaign'
      ? `${state.time.speed}×`
      : 'PAUSED';
  simulationLiveBadge.dataset.mode = state.time.mode;
  const displayDate = new Date(state.time.campaignTimestampMs);
  simulationTimezoneSummary.textContent = state.time.timezone.toLocaleUpperCase();
  simulationNowSummary.textContent = new Intl.DateTimeFormat(undefined, {
    timeZone: state.time.timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: clockDisplayFormat === '12h',
  }).format(displayDate);
  const currentPeriod = npcSchedulePeriodForTimestamp(state.time.campaignTimestampMs, state.time.timezone);
  simulationPeriodSummary.textContent = `${currentPeriod.toLocaleUpperCase()} PERIOD · ${state.time.mode === 'realtime' ? 'synced to real time' : state.time.mode === 'campaign' ? `campaign running at ${state.time.speed}×` : 'manual clock paused'}`;
  if (document.activeElement !== simulationDatetime) simulationDatetime.value = datetimeLocalValue(state.time.campaignTimestampMs, state.time.timezone);
  const stored = simulation.serialize();
  simulationWeather.value = stored.weatherOverride ?? 'auto';
  simulationWeatherSummary.textContent = `${weatherLabel(state.weather.condition)} · ${Math.round(state.weather.windKph)} km/h`;
  setSimulationHealth('weather', state.weather.condition === 'typhoon' ? 'critical' : state.weather.intensity >= 0.65 ? 'warning' : 'good');
  simulationTrafficSummary.textContent = `${state.settlements.profileLabel} · ${state.settlements.aggregateTrafficMultiplier.toFixed(2)}×`;
  setSimulationHealth('traffic', state.settlements.aggregateTrafficMultiplier > 1.45 ? 'warning' : 'good');

  const infrastructureStatuses = [
    ...Object.values(state.infrastructure.roadStatusById),
    ...Object.values(state.infrastructure.bridgeStatusById),
    ...Object.values(state.infrastructure.portStatusById),
  ];
  const unavailable = infrastructureStatuses.filter((status) => status === 'closed' || status === 'flooded' || status === 'damaged').length;
  const restricted = infrastructureStatuses.filter((status) => status === 'restricted' || status === 'under-repair').length;
  simulationInfrastructureSummary.textContent = unavailable + restricted === 0 ? 'All links open' : `${unavailable} unavailable · ${restricted} restricted`;
  setSimulationHealth('infrastructure', unavailable > 0 ? 'critical' : restricted > 0 ? 'warning' : 'good');

  const venueStatuses = Object.values(state.venues.anchorStatusById);
  const openVenues = venueStatuses.filter((status) => status === 'open' || status === 'closing-soon').length;
  const emergencyVenues = venueStatuses.filter((status) => status === 'emergency-only' || status === 'evacuated').length;
  simulationVenueSummary.textContent = `${openVenues}/${venueStatuses.length} operating${emergencyVenues > 0 ? ` · ${emergencyVenues} emergency` : ''}`;
  setSimulationHealth('venues', emergencyVenues > 0 ? 'critical' : openVenues < venueStatuses.length * 0.5 ? 'warning' : 'good');

  const npcEntries = Object.values(state.npcs.entriesByNpcId);
  const travelling = npcEntries.filter((entry) => entry.state === 'travelling').length;
  const disrupted = npcEntries.filter((entry) => entry.state === 'delayed' || entry.state === 'unable').length;
  simulationNpcSummary.textContent = disrupted > 0 ? `${disrupted} disrupted · ${travelling} moving` : `${travelling} travelling · on schedule`;
  setSimulationHealth('npcs', disrupted > 0 ? 'warning' : 'good');

  simulationSupernaturalSummary.textContent = state.supernatural.level === 'dormant'
    ? 'Dormant'
    : `${state.supernatural.level.charAt(0).toUpperCase()}${state.supernatural.level.slice(1)}${state.supernatural.witchingHour ? ' · 3 AM' : ''}`;
  setSimulationHealth('supernatural', state.supernatural.level === 'peak' ? 'critical' : state.supernatural.active ? 'warning' : 'good');

  const filter = simulationEventFilter.value;
  const visibleEvents = state.eventLog.filter((event) => filter === 'all' || event.category === filter || event.severity === filter).slice(0, 36);
  simulationEventLog.replaceChildren();
  if (visibleEvents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'simulation-event-empty';
    const icon = document.createElement('span'); icon.textContent = '◷';
    const copy = document.createElement('div');
    const strong = document.createElement('strong'); strong.textContent = state.eventLog.length === 0 ? 'No events recorded' : 'No events match this filter';
    const small = document.createElement('small'); small.textContent = state.eventLog.length === 0 ? 'Weather, time, closures, venues, and NPC disruptions will appear here.' : 'Choose another event category to view the timeline.';
    copy.append(strong, small); empty.append(icon, copy); simulationEventLog.append(empty);
  } else {
    for (const event of visibleEvents) {
      const row = document.createElement('article');
      row.className = 'simulation-event';
      row.dataset.severity = event.severity;
      const icon = document.createElement('span'); icon.className = 'simulation-event-icon'; icon.textContent = simulationEventIcon(event.category);
      const copy = document.createElement('div'); copy.className = 'simulation-event-copy';
      const meta = document.createElement('div');
      const category = document.createElement('span'); category.className = 'simulation-event-category'; category.textContent = event.category;
      const time = document.createElement('time');
      time.dateTime = new Date(event.timestampMs).toISOString();
      time.textContent = new Intl.DateTimeFormat(undefined, { timeZone: state.time.timezone, hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(event.timestampMs));
      meta.append(category, time);
      const message = document.createElement('p'); message.textContent = event.message;
      copy.append(meta, message); row.append(icon, copy); simulationEventLog.append(row);
    }
  }
  simulationEventClear.disabled = state.eventLog.length === 0;
  renderInfrastructureTargets();
  requestRender();
}

function updateRealtimeClock(now = new Date()): void {
  const secondKey = Math.floor(now.getTime() / 1000);
  if (secondKey === lastRealtimeClockSecond) return;
  lastRealtimeClockSecond = secondKey;
  if (simulation === null) return;
  const beforeRevision = simulation.state().revision;
  const state = simulation.tick(now.getTime());
  const timestamp = simulation.currentTimestamp(now.getTime());
  const displayDate = new Date(timestamp);
  const timeText = new Intl.DateTimeFormat(undefined, {
    timeZone: state.time.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: clockDisplayFormat === '12h',
  }).format(displayDate);
  const dateText = new Intl.DateTimeFormat(undefined, {
    timeZone: state.time.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(displayDate);
  realtimeClockTime.textContent = timeText;
  realtimeClockDate.textContent = dateText;
  const period = npcSchedulePeriodForTimestamp(timestamp, state.time.timezone);
  realtimeClockPeriod.textContent = period.toLocaleUpperCase();
  realtimeClockMode.textContent = state.time.mode === 'realtime' ? 'REAL' : state.time.mode === 'campaign' ? `${state.time.speed}×` : 'PAUSED';
  realtimeClock.dataset.period = period;
  realtimeClock.dataset.mode = state.time.mode;
  realtimeClock.title = `World time (${state.time.mode}). Click to switch 12/24-hour display.`;
  if (state.revision !== beforeRevision) {
    activeNpcSchedulePeriod = period;
    renderNPCList();
    refreshTravelLocationControls();
    renderSimulationPanel();
    renderInspector();
    requestRender();
    if (activeTravelPlan?.contextRevision !== undefined && travelTraffic.value === 'live') calculateTravelPlanner();
  }
}

function parseTagList(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 64);
}

function minuteFromTimeInput(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function minuteAsTime(value: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(value)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function campaignLocationOptions() {
  return collectCampaignLocations(world, authoringLayer);
}

function selectedNpc(): NPC | undefined {
  return selectedNpcKey === null ? undefined : world.npcs.find((npc) => npc.key === selectedNpcKey);
}

function selectedAuthoredLocation(): AuthoredLocationRecord | undefined {
  const sourceRef = selectedLocationRef ?? locationSource.value;
  return npcLocationAuthoring.locations.find((record) => record.sourceRef === sourceRef);
}

function replaceSelectOptions(
  select: HTMLSelectElement,
  options: readonly { readonly value: string; readonly label: string }[],
  preferredValue?: string,
): void {
  const previous = preferredValue ?? select.value;
  select.replaceChildren(...options.map(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
  if (options.some((option) => option.value === previous)) select.value = previous;
}

function updateNpcAuthoringState(next: NPCLocationAuthoringState, message?: string): void {
  npcLocationAuthoring = normalizeNpcLocationAuthoring(next);
  const selectedKey = selectedNpcKey;
  world.npcs = applyNpcLocationAuthoring(world, npcLocationAuthoring);
  simulation?.replaceWorld(world);
  simulation?.setNpcLocationAuthoring(npcLocationAuthoring);
  simulation?.tick(Date.now(), true);
  selectedNpcKey = selectedKey !== null && world.npcs.some((npc) => npc.key === selectedKey) ? selectedKey : null;
  persistMapCustomization();
  renderNPCList();
  renderNpcLocationAuthoringUi();
  refreshTravelLocationControls();
  campaignStudio?.refreshExternalReferences();
  updateStats(stats, world);
  requestRender();
  scheduleAutosave();
  if (message !== undefined) setStatus(message, 'success');
}

function updateSelectedNpcSchedule(entries: readonly NPCScheduleEntry[], message?: string): void {
  const npc = selectedNpc();
  if (npc === undefined) return;
  if (npc.source === 'authored') {
    updateNpcAuthoringState({
      ...npcLocationAuthoring,
      authoredNpcs: npcLocationAuthoring.authoredNpcs.map((definition) => definition.key === npc.key ? { ...definition, weeklySchedule: entries } : definition),
    }, message);
    return;
  }
  const existing = npcLocationAuthoring.npcOverrides.find((override) => override.npcKey === npc.key);
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    npcOverrides: [
      ...npcLocationAuthoring.npcOverrides.filter((override) => override.npcKey !== npc.key),
      { ...(existing ?? { npcKey: npc.key }), weeklySchedule: entries },
    ],
  }, message);
}

function updateSelectedNpcRelationships(relationships: readonly NPCRelationship[], message?: string): void {
  const npc = selectedNpc();
  if (npc === undefined) return;
  if (npc.source === 'authored') {
    updateNpcAuthoringState({
      ...npcLocationAuthoring,
      authoredNpcs: npcLocationAuthoring.authoredNpcs.map((definition) => definition.key === npc.key ? { ...definition, relationships } : definition),
    }, message);
    return;
  }
  const existing = npcLocationAuthoring.npcOverrides.find((override) => override.npcKey === npc.key);
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    npcOverrides: [
      ...npcLocationAuthoring.npcOverrides.filter((override) => override.npcKey !== npc.key),
      { ...(existing ?? { npcKey: npc.key }), relationships },
    ],
  }, message);
}

function nearestSettlementForTile(tileIndex: number) {
  const tile = world.tiles[tileIndex];
  if (tile === undefined) return world.settlements[0];
  return [...world.settlements].sort((left, right) => Math.hypot(left.x - tile.x, left.y - tile.y) - Math.hypot(right.x - tile.x, right.y - tile.y))[0];
}

function buildingCampaignLabel(buildingId: number): string {
  const location = campaignLocationOptions().find((candidate) => candidate.ref === `building:${buildingId}`);
  const community = location === undefined ? undefined : nearestSettlementForTile(location.tileIndex);
  const buildingLabel = location?.label ?? `Building #${buildingId + 1}`;
  return community === undefined ? buildingLabel : `${community.name} · ${buildingLabel}`;
}

function renderNpcSelectors(npc: NPC | undefined): void {
  const preferredSettlement = npcEditSettlement.value || String(npc?.settlementId ?? 0);
  replaceSelectOptions(npcEditSettlement, world.settlements.map((settlement) => ({ value: String(settlement.id), label: settlement.name })), preferredSettlement);
  const selectedSettlement = world.settlements.find((settlement) => String(settlement.id) === npcEditSettlement.value);
  const distanceToSelected = (buildingId: number): number => {
    const option = campaignLocationOptions().find((candidate) => candidate.ref === `building:${buildingId}`);
    const tile = option === undefined ? undefined : world.tiles[option.tileIndex];
    return selectedSettlement === undefined || tile === undefined ? Number.POSITIVE_INFINITY : Math.hypot(tile.x - selectedSettlement.x, tile.y - selectedSettlement.y);
  };

  const homeOptions = world.buildings
    .filter((building) => npcEditUnusualHome.checked || isResidentialBuilding(building))
    .sort((left, right) => distanceToSelected(left.id) - distanceToSelected(right.id) || buildingCampaignLabel(left.id).localeCompare(buildingCampaignLabel(right.id)))
    .map((building) => ({ value: String(building.id), label: buildingCampaignLabel(building.id) }));
  replaceSelectOptions(npcEditHome, [{ value: '', label: 'Home unassigned — choose a residential building' }, ...homeOptions], npc?.homeBuildingId === null || npc === undefined ? '' : String(npc.homeBuildingId));

  const workplaceOptions = world.buildings
    .sort((left, right) => distanceToSelected(left.id) - distanceToSelected(right.id) || buildingCampaignLabel(left.id).localeCompare(buildingCampaignLabel(right.id)))
    .map((building) => ({ value: String(building.id), label: buildingCampaignLabel(building.id) }));
  replaceSelectOptions(npcEditWorkplace, [{ value: '', label: 'No workplace assigned' }, ...workplaceOptions], npc?.workplaceBuildingId === null || npc === undefined ? '' : String(npc.workplaceBuildingId));

  const locations = campaignLocationOptions().map((location) => ({ value: location.ref, label: location.label }));
  replaceSelectOptions(npcScheduleLocation, locations);
  replaceSelectOptions(npcOverrideLocation, locations);

  replaceSelectOptions(npcRelationshipTarget, world.npcs
    .filter((candidate) => candidate.key !== npc?.key)
    .map((candidate) => ({ value: String(candidate.id), label: candidate.name })));
}

function renderNpcPortrait(npc: NPC | undefined): void {
  npcPortraitPreview.replaceChildren();
  const source = pendingNpcPortraitDataUrl ?? npc?.portraitDataUrl ?? null;
  if (source === null) {
    const placeholder = document.createElement('span');
    placeholder.textContent = npc === undefined ? 'No NPC selected' : npc.name.slice(0, 1).toLocaleUpperCase();
    npcPortraitPreview.append(placeholder);
    return;
  }
  const image = document.createElement('img');
  image.src = source;
  image.alt = npc === undefined ? 'NPC portrait preview' : `${npc.name} portrait`;
  npcPortraitPreview.append(image);
}

function renderNpcScheduleEditor(npc: NPC | undefined): void {
  npcScheduleDayTabs.replaceChildren();
  for (const day of CAMPAIGN_DAYS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day.slice(0, 3).toLocaleUpperCase();
    button.dataset.active = String(day === selectedNpcScheduleDay);
    button.addEventListener('click', () => {
      selectedNpcScheduleDay = day;
      renderNpcScheduleEditor(selectedNpc());
    });
    npcScheduleDayTabs.append(button);
  }

  npcScheduleList.replaceChildren();
  const entries = (npc?.weeklySchedule ?? [])
    .filter((entry) => entry.day === selectedNpcScheduleDay)
    .sort((left, right) => left.startMinute - right.startMinute);
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text empty-authoring-state';
    empty.textContent = npc === undefined ? 'Select an NPC to edit a schedule.' : 'No blocks on this day. Schedule gaps resolve to the residential home.';
    npcScheduleList.append(empty);
  }
  for (const entry of entries) {
    const row = document.createElement('article');
    row.className = 'schedule-entry';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${minuteAsTime(entry.startMinute)}–${minuteAsTime(entry.endMinute)} · ${entry.activity}`;
    const meta = document.createElement('small');
    meta.textContent = `${entry.location.label} · ${entry.travelMode.replace('-', ' ')} · ${entry.visibility.replace('-', ' ')}`;
    copy.append(title, meta);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => updateSelectedNpcSchedule((npc?.weeklySchedule ?? []).filter((candidate) => candidate.id !== entry.id), 'Removed schedule block.'));
    row.append(copy, remove);
    npcScheduleList.append(row);
  }

  const errors = validateSchedule(npc?.weeklySchedule ?? []);
  npcScheduleValidation.dataset.valid = String(errors.length === 0);
  npcScheduleValidation.textContent = errors.length === 0
    ? npc === undefined ? '' : 'Schedule valid. Unscheduled time resolves to home.'
    : errors.join(' ');
}

function renderNpcRelationships(npc: NPC | undefined): void {
  npcRelationshipList.replaceChildren();
  if (npc === undefined || npc.relationships.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text empty-authoring-state';
    empty.textContent = npc === undefined ? 'Select an NPC to edit relationships.' : 'No authored relationships.';
    npcRelationshipList.append(empty);
    return;
  }
  for (let index = 0; index < npc.relationships.length; index += 1) {
    const relationship = npc.relationships[index];
    if (relationship === undefined) continue;
    const target = world.npcs.find((candidate) => candidate.id === relationship.npcId);
    const row = document.createElement('article');
    row.className = 'relationship-entry';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${target?.name ?? 'Missing NPC'} · ${relationship.kind}`;
    const meta = document.createElement('small');
    meta.textContent = [relationship.label, relationship.hidden ? 'GM only' : 'visible'].filter(Boolean).join(' · ');
    copy.append(title, meta);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => updateSelectedNpcRelationships(npc.relationships.filter((_, candidateIndex) => candidateIndex !== index), 'Removed relationship.'));
    row.append(copy, remove);
    npcRelationshipList.append(row);
  }
}

function renderNpcPlacements(npc: NPC | undefined): void {
  npcPlacementList.replaceChildren();
  if (npc === undefined) {
    const empty = document.createElement('p');
    empty.className = 'helper-text empty-authoring-state';
    empty.textContent = 'Select an NPC to place them in a scene or temporarily override their routine.';
    npcPlacementList.append(empty);
    return;
  }
  const timestamp = simulation?.state().time.campaignTimestampMs ?? Date.now();
  const timezone = simulation?.state().time.timezone ?? 'Asia/Manila';
  const resolved = resolveNpcPlacement(world, npc, npcLocationAuthoring, timestamp, timezone);
  const now = document.createElement('article');
  now.className = 'placement-entry placement-current';
  const nowCopy = document.createElement('div');
  const nowTitle = document.createElement('strong');
  nowTitle.textContent = `Now: ${resolved.location.label}`;
  const nowMeta = document.createElement('small');
  nowMeta.textContent = `${resolved.activity} · source: ${resolved.source}`;
  nowCopy.append(nowTitle, nowMeta);
  const focus = document.createElement('button');
  focus.type = 'button';
  focus.textContent = 'Focus';
  focus.addEventListener('click', () => {
    const tile = world.tiles[resolved.location.tileIndex];
    if (tile !== undefined) focusMapPoint(tile.x, tile.y);
  });
  now.append(nowCopy, focus);
  npcPlacementList.append(now);

  const temporary = npcLocationAuthoring.temporaryOverrides.filter((override) => override.npcKey === npc.key);
  const scenes = npcLocationAuthoring.scenePlacements.filter((placement) => placement.npcKey === npc.key);
  for (const placement of [...temporary, ...scenes]) {
    const isTemporary = 'startsAtMs' in placement;
    const row = document.createElement('article');
    row.className = 'placement-entry';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${isTemporary ? 'Temporary' : `Scene ${placement.sceneId}`} · ${placement.location.label}`;
    const meta = document.createElement('small');
    meta.textContent = isTemporary
      ? `${placement.activity} · until ${new Date(placement.endsAtMs).toLocaleString()}`
      : `${placement.activity}${placement.sceneId === npcLocationAuthoring.activeSceneId ? ' · active' : ''}`;
    copy.append(title, meta);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => updateNpcAuthoringState({
      ...npcLocationAuthoring,
      temporaryOverrides: isTemporary ? npcLocationAuthoring.temporaryOverrides.filter((candidate) => candidate.id !== placement.id) : npcLocationAuthoring.temporaryOverrides,
      scenePlacements: isTemporary ? npcLocationAuthoring.scenePlacements : npcLocationAuthoring.scenePlacements.filter((candidate) => candidate.id !== placement.id),
    }, 'Removed NPC placement.'));
    row.append(copy, remove);
    npcPlacementList.append(row);
  }
}

function renderNpcEditor(): void {
  const npc = selectedNpc();
  const controls: Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement> = [
    npcEditName, npcEditAge, npcEditStatus, npcEditOccupation, npcEditSettlement, npcEditHome, npcEditUnusualHome,
    npcEditWorkplace, npcEditPublicDescription, npcEditPersonality, npcEditWish, npcEditFear, npcEditSecret, npcEditRumor,
    npcEditTags, npcEditNotes, npcEditPortrait, npcSaveButton, npcScheduleStart, npcScheduleEnd, npcScheduleActivity,
    npcScheduleLocation, npcScheduleTravel, npcScheduleVisibility, npcScheduleAdd, npcScheduleCopyWeekdays,
    npcScheduleClearDay, npcRelationshipTarget, npcRelationshipKind, npcRelationshipHidden, npcRelationshipLabel,
    npcRelationshipAdd, npcOverrideLocation, npcOverrideActivity, npcOverrideDuration, npcSceneId, npcOverrideReason,
    npcSceneVisible, npcOverrideAdd, npcScenePlace, npcPlacementClear,
  ];
  controls.forEach((control) => { control.disabled = npc === undefined; });
  npcResetButton.disabled = npc === undefined || npc.source === 'authored';
  npcDeleteButton.disabled = npc === undefined || npc.source !== 'authored';

  if (npc === undefined) {
    npcEditorHeading.textContent = 'Select an NPC or create one.';
    npcEditName.value = '';
    npcEditAge.value = '30';
    npcEditStatus.value = NPCStatus.Alive;
    npcEditOccupation.value = '';
    npcEditPublicDescription.value = '';
    npcEditPersonality.value = '';
    npcEditWish.value = '';
    npcEditFear.value = '';
    npcEditSecret.value = '';
    npcEditRumor.value = '';
    npcEditTags.value = '';
    npcEditNotes.value = '';
    renderNpcSelectors(undefined);
    renderNpcPortrait(undefined);
    renderNpcScheduleEditor(undefined);
    renderNpcRelationships(undefined);
    renderNpcPlacements(undefined);
    return;
  }

  npcEditorHeading.textContent = `${npc.source === 'authored' ? 'Authored NPC' : 'Generated suggestion'} · ${npc.name}`;
  npcEditName.value = npc.name;
  npcEditAge.value = String(npc.age);
  npcEditStatus.value = npc.status;
  npcEditOccupation.value = npc.occupation;
  npcEditUnusualHome.checked = npcLocationAuthoring.authoredNpcs.find((definition) => definition.key === npc.key)?.allowNonResidentialHome
    ?? npcLocationAuthoring.npcOverrides.find((override) => override.npcKey === npc.key)?.allowNonResidentialHome
    ?? false;
  renderNpcSelectors(npc);
  npcEditSettlement.value = String(npc.settlementId);
  npcEditHome.value = npc.homeBuildingId === null ? '' : String(npc.homeBuildingId);
  npcEditWorkplace.value = npc.workplaceBuildingId === null ? '' : String(npc.workplaceBuildingId);
  npcEditPublicDescription.value = npc.publicDescription ?? '';
  npcEditPersonality.value = npc.personality;
  npcEditWish.value = npc.wish;
  npcEditFear.value = npc.fear;
  npcEditSecret.value = npc.secret;
  npcEditRumor.value = npc.rumor;
  npcEditTags.value = (npc.tags ?? []).join(', ');
  npcEditNotes.value = npc.gmNotes ?? '';
  renderNpcPortrait(npc);
  renderNpcScheduleEditor(npc);
  renderNpcRelationships(npc);
  renderNpcPlacements(npc);
}

function renderLocationEditor(): void {
  const options = campaignLocationOptions();
  if (selectedLocationRef === null || !options.some((option) => option.ref === selectedLocationRef)) selectedLocationRef = options[0]?.ref ?? null;
  replaceSelectOptions(locationSource, options.map((option) => ({ value: option.ref, label: option.label })), selectedLocationRef ?? '');
  locationSource.disabled = options.length === 0;
  const record = selectedAuthoredLocation();
  const source = options.find((option) => option.ref === selectedLocationRef);

  locationName.value = record?.name ?? source?.label ?? '';
  locationType.value = record?.locationType ?? (source?.kind ?? 'location');
  locationVisibility.value = record?.visibility ?? 'gm-only';
  locationStatus.value = record?.manualStatus ?? '';
  locationTags.value = record?.tags.join(', ') ?? '';
  locationDescription.value = record?.description ?? '';
  locationPlayerDescription.value = record?.playerDescription ?? '';
  locationNotes.value = record?.gmNotes ?? '';
  replaceSelectOptions(locationOwner, [{ value: '', label: 'No owner assigned' }, ...world.npcs.map((npc) => ({ value: npc.key, label: npc.name }))], record?.ownerNpcKey ?? '');
  locationDelete.disabled = record === undefined;
  locationSave.disabled = source === undefined;
  locationHoursSave.disabled = source === undefined;

  locationHoursList.replaceChildren();
  for (const day of CAMPAIGN_DAYS) {
    const hours = record?.venueHours.find((entry) => entry.day === day);
    const row = document.createElement('article');
    row.className = 'venue-hours-entry';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = day.charAt(0).toLocaleUpperCase() + day.slice(1);
    const meta = document.createElement('small');
    meta.textContent = hours === undefined ? 'No hours authored' : hours.closed ? 'Closed all day' : `${minuteAsTime(hours.openMinute)}–${minuteAsTime(hours.closeMinute)}`;
    copy.append(title, meta);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      locationHoursDay.value = day;
      locationHoursOpen.value = minuteAsTime(hours?.openMinute ?? 8 * 60);
      locationHoursClose.value = minuteAsTime(hours?.closeMinute ?? 17 * 60);
      locationHoursClosed.checked = hours?.closed ?? false;
    });
    row.append(copy, edit);
    locationHoursList.append(row);
  }

  locationList.replaceChildren();
  if (npcLocationAuthoring.locations.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text empty-authoring-state';
    empty.textContent = 'No authored locations yet. Select a map source and save it as a campaign location.';
    locationList.append(empty);
  }
  const timestamp = simulation?.state().time.campaignTimestampMs ?? Date.now();
  const timezone = simulation?.state().time.timezone ?? 'Asia/Manila';
  for (const location of npcLocationAuthoring.locations) {
    const row = document.createElement('article');
    row.className = 'location-entry';
    row.dataset.selected = String(location.sourceRef === selectedLocationRef);
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = location.name;
    const meta = document.createElement('small');
    meta.textContent = `${location.locationType} · ${location.visibility.replace('-', ' ')} · ${venueStatusAt(location, timestamp, timezone).replace('-', ' ')}`;
    copy.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'compact-buttons';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => { selectedLocationRef = location.sourceRef; renderLocationEditor(); });
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    focus.addEventListener('click', () => {
      const option = options.find((candidate) => candidate.ref === location.sourceRef);
      const tile = option === undefined ? undefined : world.tiles[option.tileIndex];
      if (tile !== undefined) focusMapPoint(tile.x, tile.y);
    });
    actions.append(edit, focus);
    row.append(copy, actions);
    locationList.append(row);
  }
}

function renderNpcLocationAuthoringUi(): void {
  renderNpcEditor();
  renderLocationEditor();
}

function selectNpcForEditing(key: string): void {
  selectedNpcKey = key;
  pendingNpcPortraitDataUrl = null;
  renderNPCList();
  renderNpcLocationAuthoringUi();
}

function saveSelectedNpc(): void {
  const npc = selectedNpc();
  if (npc === undefined) return;
  const homeBuildingId = npcEditHome.value === '' ? null : Number(npcEditHome.value);
  const allowNonResidentialHome = npcEditUnusualHome.checked;
  const homeError = validateNpcHome(world, homeBuildingId, allowNonResidentialHome);
  if (homeError !== null) {
    setStatus(homeError, 'error');
    return;
  }
  const age = Math.max(0, Math.min(130, Math.round(Number(npcEditAge.value) || 0)));
  const settlementId = Math.max(0, Math.round(Number(npcEditSettlement.value) || 0));
  const workplaceBuildingId = npcEditWorkplace.value === '' ? null : Number(npcEditWorkplace.value);
  const portraitDataUrl = pendingNpcPortraitDataUrl ?? npc.portraitDataUrl ?? null;
  const shared = {
    name: npcEditName.value.trim() || 'Unnamed NPC',
    age,
    occupation: npcEditOccupation.value.trim(),
    status: npcEditStatus.value as NPCStatus,
    settlementId,
    homeBuildingId,
    allowNonResidentialHome,
    workplaceBuildingId,
    personality: npcEditPersonality.value.trim(),
    wish: npcEditWish.value.trim(),
    fear: npcEditFear.value.trim(),
    secret: npcEditSecret.value.trim(),
    rumor: npcEditRumor.value.trim(),
    weeklySchedule: npc.weeklySchedule,
    relationships: npc.relationships,
    portraitAssetId: npc.portraitAssetId ?? null,
    portraitDataUrl,
    publicDescription: npcEditPublicDescription.value.trim(),
    gmNotes: npcEditNotes.value.trim(),
    tags: parseTagList(npcEditTags.value),
  };
  pendingNpcPortraitDataUrl = null;
  if (npc.source === 'authored') {
    const definition: AuthoredNPCDefinition = { key: npc.key, ...shared };
    updateNpcAuthoringState({
      ...npcLocationAuthoring,
      authoredNpcs: [...npcLocationAuthoring.authoredNpcs.filter((candidate) => candidate.key !== npc.key), definition],
    }, `Saved ${shared.name}.`);
    return;
  }
  const override: NPCProfileOverride = { npcKey: npc.key, ...shared };
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    npcOverrides: [...npcLocationAuthoring.npcOverrides.filter((candidate) => candidate.npcKey !== npc.key), override],
  }, `Saved ${shared.name}.`);
}

function createAuthoredNpc(): void {
  const firstHome = world.buildings.find(isResidentialBuilding);
  const key = `npc:authored:${createRuleId()}`;
  const definition: AuthoredNPCDefinition = {
    key,
    name: 'New NPC',
    age: 30,
    occupation: '',
    status: NPCStatus.Alive,
    settlementId: world.settlements[0]?.id ?? 0,
    homeBuildingId: firstHome?.id ?? null,
    allowNonResidentialHome: false,
    workplaceBuildingId: null,
    personality: '',
    wish: '',
    fear: '',
    secret: '',
    rumor: '',
    weeklySchedule: [],
    relationships: [],
    portraitAssetId: null,
    portraitDataUrl: null,
    publicDescription: '',
    gmNotes: '',
    tags: [],
  };
  selectedNpcKey = key;
  updateNpcAuthoringState({ ...npcLocationAuthoring, authoredNpcs: [...npcLocationAuthoring.authoredNpcs, definition] }, 'Created a new authored NPC.');
}

function saveLocationRecord(hoursOverride?: readonly VenueHoursEntry[]): void {
  const sourceRef = selectedLocationRef ?? locationSource.value;
  const source = campaignLocationOptions().find((option) => option.ref === sourceRef);
  if (source === undefined) {
    setStatus('Choose a map source for the location.', 'error');
    return;
  }
  const existing = npcLocationAuthoring.locations.find((record) => record.sourceRef === sourceRef);
  const record: AuthoredLocationRecord = {
    key: existing?.key ?? `location:${createRuleId()}`,
    name: locationName.value.trim() || source.label,
    sourceRef,
    locationType: locationType.value.trim() || 'location',
    description: locationDescription.value.trim(),
    playerDescription: locationPlayerDescription.value.trim(),
    gmNotes: locationNotes.value.trim(),
    ownerNpcKey: locationOwner.value || null,
    tags: parseTagList(locationTags.value),
    visibility: locationVisibility.value as AuthoredLocationRecord['visibility'],
    venueHours: hoursOverride ?? existing?.venueHours ?? [],
    manualStatus: locationStatus.value === '' ? null : locationStatus.value as AuthoredLocationRecord['manualStatus'],
    portraitAssetId: existing?.portraitAssetId ?? null,
  };
  selectedLocationRef = sourceRef;
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    locations: [...npcLocationAuthoring.locations.filter((candidate) => candidate.sourceRef !== sourceRef), record],
  }, `Saved ${record.name}.`);
}

function npcStatusLabel(status: NPCStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function npcSettlement(npc: NPC): string {
  return world.settlements[npc.settlementId]?.name ?? 'Unknown settlement';
}

function filteredNpcs(): readonly NPC[] {
  const query = npcSearch.value.trim().toLocaleLowerCase();
  return world.npcs.filter((npc) => [npc.name, npc.occupation, npc.personality, npcSettlement(npc), npc.status, ...(npc.tags ?? [])]
    .join(' ').toLocaleLowerCase().includes(query));
}

function allowNonResidentialHomeForNpc(key: string): boolean {
  const authored = npcLocationAuthoring.authoredNpcs.find((npc) => npc.key === key);
  if (authored !== undefined) return authored.allowNonResidentialHome;
  return npcLocationAuthoring.npcOverrides.find((npc) => npc.npcKey === key)?.allowNonResidentialHome === true;
}

function downloadNpcJson(npcs: readonly NPC[], name: string): void {
  if (npcs.length === 0) {
    setStatus('No NPCs are available for export.', 'warning');
    return;
  }
  const bundle = withSettlementNames(
    createNpcJsonBundle(
      npcs,
      world.npcs,
      { seed: world.seed, generationVersion: world.metadata.generationVersion },
      name,
      allowNonResidentialHomeForNpc,
    ),
    (settlementId) => world.settlements.find((settlement) => settlement.id === settlementId)?.name ?? '',
  );
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = bundle.name.replaceAll(/[^a-zA-Z0-9_-]/g, '_') || (bundle.kind === 'npc' ? 'npc' : 'npc-group');
  link.download = `${safeName}.${bundle.kind === 'npc' ? 'npc' : 'npc-group'}.json`;
  link.click();
  URL.revokeObjectURL(url);
  const omittedCount = Math.max(0, npcs.length - bundle.npcs.length);
  setStatus(
    `Exported ${bundle.npcs.length} NPC${bundle.npcs.length === 1 ? '' : 's'} separately from the world.${omittedCount === 0 ? '' : ` The ${omittedCount} records above the 500-NPC portability limit were omitted.`}`,
    omittedCount === 0 ? 'success' : 'warning',
  );
}

function importedNpcSettlementId(record: PortableNpcRecord, sameWorld: boolean): number {
  const byName = record.settlementName.length === 0
    ? undefined
    : world.settlements.find((settlement) => settlement.name.toLocaleLowerCase() === record.settlementName.toLocaleLowerCase());
  if (byName !== undefined) return byName.id;
  if (sameWorld && world.settlements.some((settlement) => settlement.id === record.settlementId)) return record.settlementId;
  return world.settlements[0]?.id ?? 0;
}

function importedNpcHomeId(record: PortableNpcRecord, sameWorld: boolean): number | null {
  if (!sameWorld || record.homeBuildingId === null) return null;
  return validateNpcHome(world, record.homeBuildingId, record.allowNonResidentialHome) === null ? record.homeBuildingId : null;
}

function importedNpcWorkplaceId(record: PortableNpcRecord, sameWorld: boolean): number | null {
  if (!sameWorld || record.workplaceBuildingId === null) return null;
  return world.buildings.some((building) => building.id === record.workplaceBuildingId) ? record.workplaceBuildingId : null;
}

function importedNpcSchedule(
  record: PortableNpcRecord,
  settlementId: number,
  homeBuildingId: number | null,
  sameWorld: boolean,
): readonly NPCScheduleEntry[] {
  const settlement = world.settlements.find((candidate) => candidate.id === settlementId) ?? world.settlements[0];
  const home = homeBuildingId === null
    ? undefined
    : scheduleLocationFromRef(world, authoringLayer, `building:${homeBuildingId}`, 'Imported NPC home');
  const fallbackTileIndex = home?.tileIndex ?? settlement?.tileIndex ?? 0;
  return record.weeklySchedule.map((entry) => {
    const resolved = sameWorld
      ? scheduleLocationFromRef(world, authoringLayer, entry.location.ref, entry.location.label)
      : undefined;
    return {
      ...entry,
      id: `schedule:${createRuleId()}`,
      location: resolved ?? {
        kind: 'custom',
        ref: `custom:imported:${createRuleId()}`,
        label: entry.location.label || 'Imported location',
        tileIndex: fallbackTileIndex,
      },
    };
  });
}

function authoredDefinitionsFromNpcBundle(bundle: NpcJsonBundle): readonly AuthoredNPCDefinition[] {
  const availableSlots = Math.max(0, 500 - npcLocationAuthoring.authoredNpcs.length);
  if (availableSlots === 0) throw new Error('This world already has the maximum of 500 authored NPCs.');
  const records = bundle.npcs.slice(0, availableSlots);
  const sameWorld = bundle.sourceWorld.seed === world.seed
    && bundle.sourceWorld.generationVersion === world.metadata.generationVersion;
  const baseNpcId = world.npcs.length;
  const prepared = records.map((record, index) => {
    const settlementId = importedNpcSettlementId(record, sameWorld);
    const homeBuildingId = importedNpcHomeId(record, sameWorld);
    return {
      record,
      key: `npc:imported:${createRuleId()}`,
      npcId: baseNpcId + index,
      settlementId,
      homeBuildingId,
      workplaceBuildingId: importedNpcWorkplaceId(record, sameWorld),
      weeklySchedule: importedNpcSchedule(record, settlementId, homeBuildingId, sameWorld),
    };
  });
  const importedIdBySourceKey = new Map<string, number>();
  for (const item of prepared) {
    if (item.record.sourceKey.length > 0 && !importedIdBySourceKey.has(item.record.sourceKey)) {
      importedIdBySourceKey.set(item.record.sourceKey, item.npcId);
    }
  }
  const existingIdByKey = new Map(world.npcs.map((npc) => [npc.key, npc.id]));
  return prepared.map((item): AuthoredNPCDefinition => ({
    key: item.key,
    name: item.record.name,
    age: item.record.age,
    occupation: item.record.occupation,
    status: item.record.status,
    settlementId: item.settlementId,
    homeBuildingId: item.homeBuildingId,
    allowNonResidentialHome: item.record.allowNonResidentialHome && item.homeBuildingId !== null,
    workplaceBuildingId: item.workplaceBuildingId,
    personality: item.record.personality,
    wish: item.record.wish,
    fear: item.record.fear,
    secret: item.record.secret,
    rumor: item.record.rumor,
    weeklySchedule: item.weeklySchedule,
    relationships: item.record.relationships.flatMap((relationship) => {
      const targetId = importedIdBySourceKey.get(relationship.npcKey) ?? existingIdByKey.get(relationship.npcKey);
      if (targetId === undefined || targetId === item.npcId) return [];
      return [{
        npcId: targetId,
        kind: relationship.kind,
        ...(relationship.label === null ? {} : { label: relationship.label }),
        ...(relationship.notes === null ? {} : { notes: relationship.notes }),
        hidden: relationship.hidden,
      }];
    }),
    portraitAssetId: null,
    portraitDataUrl: item.record.portraitDataUrl,
    publicDescription: item.record.publicDescription,
    gmNotes: item.record.gmNotes,
    tags: item.record.tags,
  }));
}

async function importNpcJsonFile(file: File): Promise<void> {
  if (!file.name.toLocaleLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
    throw new Error('Select a PAYAW NPC JSON file.');
  }
  if (file.size > 64 * 1024 * 1024) throw new Error('NPC JSON is larger than the 64 MB import limit.');
  const bundle = parseNpcJsonBundle(JSON.parse(await file.text()) as unknown);
  const definitions = authoredDefinitionsFromNpcBundle(bundle);
  selectedNpcKey = definitions[0]?.key ?? null;
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    authoredNpcs: [...npcLocationAuthoring.authoredNpcs, ...definitions],
  }, `Imported ${definitions.length} NPC${definitions.length === 1 ? '' : 's'} from ${bundle.kind === 'npc' ? 'an NPC file' : 'an NPC group'}.`);
}

function renderNPCList(): void {
  npcCount.textContent = String(world.npcs.length);
  npcRosterSize.value = String(world.npcs.length);
  npcList.replaceChildren();
  const filtered = filteredNpcs();
  npcExportSelected.disabled = selectedNpc() === undefined;
  npcExportGroup.disabled = filtered.length === 0;
  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = world.npcs.length === 0 ? 'No NPCs have been generated.' : 'No NPC matches this search.';
    npcList.append(empty);
    return;
  }
  for (const npc of filtered.slice(0, 120)) {
    const card = document.createElement('article');
    card.className = 'npc-card';
    const heading = document.createElement('div');
    heading.className = 'npc-card-heading';
    const copy = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = npc.name;
    const currentEntry = currentNpcScheduleEntry(npc);
    const dynamic = simulation?.state().npcs.entriesByNpcId[npc.id];
    const currentActivity = dynamic?.activity ?? currentEntry?.locationLabel ?? 'Unknown location';
    const movementLabel = dynamic !== undefined && dynamic.state !== 'at-location' ? ` · ${dynamic.state.replace('-', ' ')}` : '';
    const meta = document.createElement('small'); meta.textContent = `${npc.age} · ${npc.occupation} · ${npcSettlement(npc)} · ${currentActivity}${movementLabel}`;
    copy.append(title, meta);
    const status = document.createElement('span'); status.className = `npc-status npc-status-${npc.status}`; status.textContent = npcStatusLabel(npc.status);
    const actions = document.createElement('div'); actions.className = 'npc-card-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = selectedNpcKey === npc.key ? 'Editing' : 'Edit'; edit.addEventListener('click', () => selectNpcForEditing(npc.key));
    const focus = document.createElement('button'); focus.type = 'button'; focus.textContent = 'Focus'; focus.addEventListener('click', () => focusMapPoint(npc.x, npc.y));
    actions.append(edit, focus);
    heading.append(copy, status, actions);
    card.dataset.selected = String(selectedNpcKey === npc.key);
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = npc.personality;
    const body = document.createElement('div'); body.className = 'npc-card-body';
    for (const [label, value] of [['Wish', npc.wish], ['Fear', npc.fear], ['Secret', npc.secret], ['Rumor', npc.rumor]] as const) {
      const row = document.createElement('p'); const strong = document.createElement('strong'); strong.textContent = `${label}: `; row.append(strong, value); body.append(row);
    }
    const schedule = document.createElement('p');
    const scheduleStrong = document.createElement('strong'); scheduleStrong.textContent = 'Weekly schedule: ';
    const dayCount = new Set(npc.weeklySchedule.map((entry) => entry.day)).size;
    schedule.append(scheduleStrong, npc.weeklySchedule.length === 0 ? 'No authored blocks; defaults to home.' : `${npc.weeklySchedule.length} blocks across ${dayCount} day${dayCount === 1 ? '' : 's'}.`);
    body.append(schedule);
    const routeButtons = document.createElement('div'); routeButtons.className = 'button-row compact-buttons';
    const asFrom = document.createElement('button'); asFrom.type = 'button'; asFrom.textContent = 'Use as Point A'; asFrom.addEventListener('click', () => { refreshTravelLocationControls(); travelFromLocation.value = `npc:${npc.key}`; setWorkspace('dm'); });
    const asTo = document.createElement('button'); asTo.type = 'button'; asTo.textContent = 'Use as Point B'; asTo.addEventListener('click', () => { refreshTravelLocationControls(); travelToLocation.value = `npc:${npc.key}`; setWorkspace('dm'); });
    routeButtons.append(asFrom, asTo); body.append(routeButtons);
    details.append(summary, body);
    card.append(heading, details);
    npcList.append(card);
  }
}

function regenerateNpcRoster(): void {
  const requested = Math.max(1, Math.min(200, Math.round(Number(npcRosterSize.value) || 36)));
  const generated = generateNPCPopulation(world, new SeededRandom(world.seed).fork(`npc-ui-${requested}`), requested);
  world.npcs = applyNpcLocationAuthoring({ ...world, npcs: generated } as World, npcLocationAuthoring);
  simulation?.replaceWorld(world);
  simulation?.setNpcLocationAuthoring(npcLocationAuthoring);
  simulation?.tick(Date.now(), true);
  renderNPCList();
  refreshTravelLocationControls();
  campaignStudio?.refreshExternalReferences();
  requestRender();
  updateStats(stats, world);
  scheduleAutosave();
  setStatus(`Generated ${world.npcs.length} NPCs.`, 'success');
}

function refreshWorldUi(fitAfter = false, regeneratedFromStage?: string): void {
  if (pendingImportedSimulation !== undefined || simulation === null) {
    simulation = new WorldSimulation(world, pendingImportedSimulation);
    pendingImportedSimulation = undefined;
  } else {
    simulation.replaceWorld(world);
  }
  simulation.setNpcLocationAuthoring(npcLocationAuthoring);
  const simulationState = simulation.tick(Date.now(), true);
  activeNpcSchedulePeriod = npcSchedulePeriodForTimestamp(simulationState.time.campaignTimestampMs, simulationState.time.timezone);
  if (regeneratedFromStage === undefined) renderer.rebuildCache(world);
  else renderer.rebuildCache(world, rasterCacheLayersForStage(regeneratedFromStage));
  syncRendererCustomization();
  updateStats(stats, world);
  updateMapHeader();
  renderAnchorList();
  renderStoryList();
  renderStoryRuleEditor();
  renderCustomStoryList();
  renderNPCList();
  renderSimulationPanel();
  activeTravelPlan = null;
  activeTravelAlternatives = [];
  activeTravelNormalDuration = null;
  customTravelLocations.clear();
  travelPickTarget = null;
  refreshTravelLocationControls();
  renderTravelPlanResult(null);
  updateZoneEditorUi();
  renderPlacedImageList();
  renderAuthoringLists();
  updatePerformancePanel();
  campaignStudio?.ensureWorldReference(currentCampaignWorldRef());
  campaignStudio?.refreshExternalReferences();
  playerPreview?.refresh();
  if (regeneratedFromStage === undefined) {
    rebuildMinimapBase();
    recordRecentProject();
  }
  renderInspector();
  scheduleAutosave();
  if (fitAfter) fitCamera();
}

function generate(
  candidateCustom: readonly CustomAnchorDefinition[] = customAnchors,
  candidateBuiltIns: readonly BuiltInAnchorOverride[] = builtInOverrides,
  fitAfter = true,
  clearEditorHistory = false,
): boolean {
  setStatus('Generating terrain, town, and story layer…', 'working');
  const signature = worldSignature();
  const names = loadNameState(signature);
  let mapCustomization = loadMapCustomization(signature);
  const recoveredOverrides: string[] = [];

  try {
    let nextWorld: World | undefined;
    const maximumAttempts = mapCustomization.anchorPositions.length + mapCustomization.settlementPositions.length + mapCustomization.storyPositions.length + 1;

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      try {
        nextWorld = pipeline.generate(seedInput.value, {
          ...generationOptions(
            candidateCustom,
            candidateBuiltIns,
            mapCustomization.anchorPositions,
            mapCustomization.settlementPositions,
            mapCustomization.storyPositions,
          ),
          roadNameOverrides: names.roads,
          blockNameOverrides: names.blocks,
          storyRuleOverrides: mapCustomization.storyRules,
          zoneOverrides: mapCustomization.zoneOverrides,
          islandOverrides: mapCustomization.islandOverrides,
          bridgeOverrides: mapCustomization.bridgeOverrides,
          customBridges: mapCustomization.customBridges,
          portOverrides: mapCustomization.portOverrides,
          customPorts: mapCustomization.customPorts,
          authoredSettlements: mapCustomization.authoringLayer.authoredSettlements,
          settlementAuthoringOverrides: mapCustomization.authoringLayer.settlementOverrides,
          terrainOverrides: mapCustomization.authoringLayer.terrainOverrides,
          generatedFeatureOverrides: mapCustomization.authoringLayer.generatedFeatureOverrides,
          authoredFeatures: mapCustomization.authoringLayer.features,
        });
        break;
      } catch (error) {
        if (!(error instanceof InvalidPositionOverrideError)) throw error;
        const recovered = recoverPositionOverrides(
          mapCustomization.anchorPositions,
          mapCustomization.settlementPositions,
          mapCustomization.storyPositions,
          error,
        );
        if (!recovered.removed) throw error;
        mapCustomization = {
          ...mapCustomization,
          anchorPositions: recovered.anchorPositions,
          settlementPositions: recovered.settlementPositions,
          storyPositions: recovered.storyPositions,
        };
        recoveredOverrides.push(`${error.kind} “${error.displayName}”`);
      }
    }

    if (nextWorld === undefined) {
      throw new Error('World generation could not recover from its saved position overrides. Reset moved objects and try again.');
    }

    world = nextWorld;
    activeWorldSignature = signature;
    roadNameOverrides = [...names.roads];
    blockNameOverrides = [...names.blocks];
    anchorPositionOverrides = [...mapCustomization.anchorPositions];
    settlementPositionOverrides = [...mapCustomization.settlementPositions];
    storyPositionOverrides = [...mapCustomization.storyPositions];
    storyRuleOverrides = [...mapCustomization.storyRules];
    zoneOverrides = [...mapCustomization.zoneOverrides];
    placedImages = [...mapCustomization.placedImages];
    islandOverrides = [...mapCustomization.islandOverrides];
    bridgeOverrides = [...mapCustomization.bridgeOverrides];
    customBridges = [...mapCustomization.customBridges];
    portOverrides = [...mapCustomization.portOverrides];
    customPorts = [...mapCustomization.customPorts];
    authoringLayer = structuredClone(mapCustomization.authoringLayer);
    npcLocationAuthoring = structuredClone(mapCustomization.npcLocationAuthoring);
    world.npcs = applyNpcLocationAuthoring(world, npcLocationAuthoring);

    // Persist the repaired state so the same stale override cannot block the
    // next load. Only invalid position records are removed; names, zoning,
    // assets, transport authoring, and every valid moved object are preserved.
    if (recoveredOverrides.length > 0) saveMapCustomization(signature, mapCustomization);

    refreshWorldUi(fitAfter);
    saveProfile({ terrainSize: selectedTerrainSize(), townScale: selectedTownScale(), terrainShape: selectedTerrainShape(), climatePreset: selectedClimatePreset(), islandCount: selectedIslandCount(), islandSpacingKilometers: selectedIslandSpacing(), satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT });
    if (clearEditorHistory) { history.clear(); updateHistoryButtons(); }
    const duration = Object.values(world.diagnostics.stageTimingsMs).reduce((sum, value) => sum + value, 0);
    const recoveryMessage = recoveredOverrides.length === 0
      ? ''
      : ` Reset ${recoveredOverrides.length} stale saved position${recoveredOverrides.length === 1 ? '' : 's'}: ${recoveredOverrides.join(', ')}.`;
    setStatus(`Generated ${world.width}×${world.height} world in ${duration.toFixed(0)} ms.${recoveryMessage}`, recoveredOverrides.length === 0 ? 'success' : 'warning');
    return true;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
    return false;
  }
}

async function generateResponsive(
  candidateCustom: readonly CustomAnchorDefinition[] = customAnchors,
  candidateBuiltIns: readonly BuiltInAnchorOverride[] = builtInOverrides,
  fitAfter = true,
  clearEditorHistory = false,
): Promise<boolean> {
  activeGenerationController?.abort();
  const controller = new AbortController();
  activeGenerationController = controller;
  const runId = ++generationSequence;
  setGenerationRunning(true);
  setStatus('Generating deterministic world in scheduled stages…', 'working');
  generationProgressStage.textContent = 'Preparing generation…';

  const signature = worldSignature();
  const names = loadNameState(signature);
  let mapCustomization = loadMapCustomization(signature);
  const recoveredOverrides: string[] = [];

  try {
    let nextWorld: World | undefined;
    const maximumAttempts = mapCustomization.anchorPositions.length + mapCustomization.settlementPositions.length + mapCustomization.storyPositions.length + 1;

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      try {
        nextWorld = await generationWorker.generate(seedInput.value, {
          ...generationOptions(
            candidateCustom,
            candidateBuiltIns,
            mapCustomization.anchorPositions,
            mapCustomization.settlementPositions,
            mapCustomization.storyPositions,
          ),
          roadNameOverrides: names.roads,
          blockNameOverrides: names.blocks,
          storyRuleOverrides: mapCustomization.storyRules,
          zoneOverrides: mapCustomization.zoneOverrides,
          islandOverrides: mapCustomization.islandOverrides,
          bridgeOverrides: mapCustomization.bridgeOverrides,
          customBridges: mapCustomization.customBridges,
          portOverrides: mapCustomization.portOverrides,
          customPorts: mapCustomization.customPorts,
          authoredSettlements: mapCustomization.authoringLayer.authoredSettlements,
          settlementAuthoringOverrides: mapCustomization.authoringLayer.settlementOverrides,
          terrainOverrides: mapCustomization.authoringLayer.terrainOverrides,
          generatedFeatureOverrides: mapCustomization.authoringLayer.generatedFeatureOverrides,
          authoredFeatures: mapCustomization.authoringLayer.features,
        }, {
          signal: controller.signal,
          onProgress: updateGenerationProgress,
          yieldBetweenStages: true,
        });
        break;
      } catch (error) {
        if (error instanceof GenerationCancelledError) throw error;
        if (!(error instanceof InvalidPositionOverrideError)) throw error;
        const recovered = recoverPositionOverrides(
          mapCustomization.anchorPositions,
          mapCustomization.settlementPositions,
          mapCustomization.storyPositions,
          error,
        );
        if (!recovered.removed) throw error;
        mapCustomization = {
          ...mapCustomization,
          anchorPositions: recovered.anchorPositions,
          settlementPositions: recovered.settlementPositions,
          storyPositions: recovered.storyPositions,
        };
        recoveredOverrides.push(`${error.kind} “${error.displayName}”`);
        generationProgressStage.textContent = `Recovering stale ${error.kind} position…`;
      }
    }

    if (runId !== generationSequence || controller.signal.aborted) throw new GenerationCancelledError();
    if (nextWorld === undefined) {
      throw new Error('World generation could not recover from its saved position overrides. Reset moved objects and try again.');
    }

    world = nextWorld;
    activeWorldSignature = signature;
    roadNameOverrides = [...names.roads];
    blockNameOverrides = [...names.blocks];
    anchorPositionOverrides = [...mapCustomization.anchorPositions];
    settlementPositionOverrides = [...mapCustomization.settlementPositions];
    storyPositionOverrides = [...mapCustomization.storyPositions];
    storyRuleOverrides = [...mapCustomization.storyRules];
    zoneOverrides = [...mapCustomization.zoneOverrides];
    placedImages = [...mapCustomization.placedImages];
    islandOverrides = [...mapCustomization.islandOverrides];
    bridgeOverrides = [...mapCustomization.bridgeOverrides];
    customBridges = [...mapCustomization.customBridges];
    portOverrides = [...mapCustomization.portOverrides];
    customPorts = [...mapCustomization.customPorts];
    authoringLayer = structuredClone(mapCustomization.authoringLayer);
    npcLocationAuthoring = structuredClone(mapCustomization.npcLocationAuthoring);
    world.npcs = applyNpcLocationAuthoring(world, npcLocationAuthoring);

    if (recoveredOverrides.length > 0) saveMapCustomization(signature, mapCustomization);
    refreshWorldUi(fitAfter);
    saveProfile({
      terrainSize: selectedTerrainSize(),
      townScale: selectedTownScale(),
      terrainShape: selectedTerrainShape(),
      climatePreset: selectedClimatePreset(),
      islandCount: selectedIslandCount(),
      islandSpacingKilometers: selectedIslandSpacing(),
      satelliteSettlementCount: SATELLITE_SETTLEMENT_COUNT,
    });
    if (clearEditorHistory) { history.clear(); updateHistoryButtons(); }
    const duration = Object.values(world.diagnostics.stageTimingsMs).reduce((sum, value) => sum + value, 0);
    const recoveryMessage = recoveredOverrides.length === 0
      ? ''
      : ` Reset ${recoveredOverrides.length} stale saved position${recoveredOverrides.length === 1 ? '' : 's'}: ${recoveredOverrides.join(', ')}.`;
    setStatus(`Generated ${world.width}×${world.height} world in ${duration.toFixed(0)} ms without locking the editor between stages.${recoveryMessage}`, recoveredOverrides.length === 0 ? 'success' : 'warning');
    return true;
  } catch (error) {
    if (error instanceof GenerationCancelledError) {
      setStatus('Generation cancelled. The previous world remains active.', 'warning');
      return false;
    }
    setStatus(error instanceof Error ? error.message : String(error), 'error');
    return false;
  } finally {
    if (runId === generationSequence) {
      activeGenerationController = null;
      setGenerationRunning(false);
    }
  }
}

function regenerateFrom(stageId: string, successMessage: string): boolean {
  setStatus('Updating authored world…', 'working');
  try {
    pipeline.regenerateFrom(world, stageId, generationOptions());
    refreshWorldUi(false, stageId);
    const duration = Object.entries(world.diagnostics.stageTimingsMs)
      .filter(([id]) => id === stageId || id === 'story-layer' || id === 'buildings' || id === 'vegetation')
      .reduce((sum, [, value]) => sum + value, 0);
    setStatus(`${successMessage} (${duration.toFixed(0)} ms partial regeneration)`, 'success');
    return true;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
    return false;
  }
}

function readAnchorSettings(): AnchorRuleSettings {
  const target = anchorTarget.value.length === 0 ? null : anchorTarget.value as BuiltInAnchorType;
  return {
    name: anchorName.value.trim(),
    region: anchorRegion.value as AnchorRegionPreference,
    terrain: anchorTerrain.value as AnchorTerrainPreference,
    targetAnchor: target,
    proximity: target === null ? AnchorProximityBand.None : anchorProximity.value as AnchorProximityBand,
    radius: Number(anchorRadius.value),
    minimumDistance: Number(anchorSpacing.value),
    zoneType: anchorZone.value.length === 0 ? null : anchorZone.value as ZoneType,
  };
}

function replaceAnchorPosition(values: readonly AnchorPositionOverride[], key: string, x: number, y: number): AnchorPositionOverride[] {
  return [...values.filter((value) => value.key !== key), { key, x, y }].sort((left, right) => left.key.localeCompare(right.key));
}


function replaceStoryPosition(values: readonly StoryPositionOverride[], key: string, id: number, x: number, y: number): StoryPositionOverride[] {
  return [
    ...values.filter((value) => value.key !== key && !(value.key === undefined && value.id === id)),
    { id, key, x, y },
  ].sort((left, right) => left.id - right.id || (left.key ?? '').localeCompare(right.key ?? ''));
}

function resetAnchorPosition(key: string): void {
  const snapshot = captureEditorSnapshot();
  const previous = anchorPositionOverrides;
  anchorPositionOverrides = anchorPositionOverrides.filter((position) => position.key !== key);
  persistMapCustomization();
  if (regenerateFrom('anchor-placement', 'Reset anchor position.')) {
    recordHistory(snapshot, 'reset anchor position');
    return;
  }
  anchorPositionOverrides = previous;
  persistMapCustomization();
  regenerateFrom('anchor-placement', 'Restored anchor position.');
}

function resetAllObjectPositions(): void {
  if (anchorPositionOverrides.length === 0 && settlementPositionOverrides.length === 0 && storyPositionOverrides.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previousAnchors = anchorPositionOverrides;
  const previousSettlements = settlementPositionOverrides;
  const previousStories = storyPositionOverrides;
  anchorPositionOverrides = [];
  settlementPositionOverrides = [];
  storyPositionOverrides = [];
  persistMapCustomization();
  if (regenerateFrom('settlements', 'Reset moved anchors, community anchors, and story sites.')) {
    recordHistory(snapshot, 'reset moved objects');
    return;
  }
  anchorPositionOverrides = previousAnchors;
  settlementPositionOverrides = previousSettlements;
  storyPositionOverrides = previousStories;
  persistMapCustomization();
  regenerateFrom('settlements', 'Restored moved objects.');
}

function resetBuiltInAnchor(type: BuiltInAnchorType): void {
  const snapshot = captureEditorSnapshot();
  const candidate = builtInOverrides.filter((definition) => definition.type !== type);
  if (!generate(customAnchors, candidate, false)) return;
  builtInOverrides = candidate;
  saveAnchorState(customAnchors, builtInOverrides);
  recordHistory(snapshot, `reset ${ANCHOR_LABELS[type]} rules`);
  resetAnchorForm();
  renderAnchorList();
}

function removeCustomAnchor(id: string): void {
  const definition = customAnchors.find((item) => item.id === id);
  const snapshot = captureEditorSnapshot();
  const candidate = customAnchors.filter((item) => item.id !== id);
  if (!generate(candidate, builtInOverrides, false)) return;
  customAnchors = candidate;
  saveAnchorState(customAnchors, builtInOverrides);
  recordHistory(snapshot, `remove anchor ${definition?.name ?? id}`);
  resetAnchorForm();
  renderAnchorList();
}

function replaceNameOverride(values: readonly EntityNameOverride[], id: number, name: string): EntityNameOverride[] {
  return [...values.filter((value) => value.id !== id), { id, name }].sort((left, right) => left.id - right.id);
}

function removeNameOverride(values: readonly EntityNameOverride[], id: number): EntityNameOverride[] {
  return values.filter((value) => value.id !== id);
}

function persistNames(): void {
  saveNameState(activeWorldSignature, { roads: roadNameOverrides, blocks: blockNameOverrides });
}

function setLayer(layer: RenderLayer, visible: boolean): void {
  renderer.layers.setVisible(layer, visible);
  layerElements[layer].checked = visible;
  if (layer === RenderLayer.RoadLabels) {
    labelSettings = { ...labelSettings, road: { ...labelSettings.road, visible } };
    saveLabelSettings(labelSettings);
  } else if (layer === RenderLayer.BlockLabels) {
    labelSettings = { ...labelSettings, block: { ...labelSettings.block, visible } };
    saveLabelSettings(labelSettings);
  }
  if (layer === RenderLayer.NPCs) {
    for (const peer of document.querySelectorAll<HTMLInputElement>('[data-layer-target="npc-layer"]')) peer.checked = visible;
    syncNpcViewToggle();
  }
}

function applyViewPreset(name: string): void {
  const visible = GM_MAP_VIEW_PRESETS[name];
  if (visible === undefined) return;
  const selected = new Set(visible);
  for (const layer of Object.values(RenderLayer)) setLayer(layer, selected.has(layer));
  syncStudioLayerManager();
  requestRender();
}

function setEditMode(enabled: boolean): void {
  if (enabled && authoringTool !== 'select') setAuthoringTool('select');
  if (enabled && zoneEditMode) setZoneEditMode(false);
  editMode = enabled;
  editModeButton.textContent = enabled ? 'On' : 'Off';
  editModeButton.dataset.active = String(enabled);
  toolbarEditButton.textContent = enabled ? 'Edit: on' : 'Edit: off';
  toolbarEditButton.dataset.active = String(enabled);
  canvas.classList.toggle('edit-mode', enabled);
  if (!enabled) {
    dragPreview = null;
    draggedImageId = null;
    canvas.classList.remove('entity-dragging');
  }
  syncRendererCustomization();
}

function worldPositionFromPointer(event: PointerEvent | DragEvent): { x: number; y: number } {
  const rectangle = canvas.getBoundingClientRect();
  return camera.screenToWorld(event.clientX - rectangle.left, event.clientY - rectangle.top);
}

function pointInsidePlacement(x: number, y: number, placement: PlacedImage): boolean {
  const cosine = Math.cos(-placement.rotation);
  const sine = Math.sin(-placement.rotation);
  const deltaX = x - placement.x;
  const deltaY = y - placement.y;
  const localX = deltaX * cosine - deltaY * sine;
  const localY = deltaX * sine + deltaY * cosine;
  return Math.abs(localX) <= placement.width * 0.5 && Math.abs(localY) <= placement.height * 0.5;
}

function hitMovableObject(x: number, y: number): { kind: 'anchor' | 'settlement' | 'story' | 'image'; key: string } | null {
  const markerRadius = Math.max(1.4, 10 / Math.max(1, camera.zoom));
  for (const item of world.storyObjects) {
    if (Math.hypot(x - (item.x + 0.5), y - (item.y + 0.5)) <= markerRadius) {
      return { kind: 'story', key: item.key };
    }
  }
  for (const anchor of world.anchors) {
    if (Math.hypot(x - (anchor.x + 0.5), y - (anchor.y + 0.5)) <= markerRadius) {
      return { kind: 'anchor', key: anchor.key };
    }
  }
  for (const settlement of world.settlements) {
    if (settlement.isPrimary) continue;
    if (Math.hypot(x - (settlement.x + 0.5), y - (settlement.y + 0.5)) <= markerRadius) {
      return { kind: 'settlement', key: settlement.key };
    }
  }
  const reversed = [...placedImages].sort((left, right) => right.zIndex - left.zIndex);
  for (const placement of reversed) {
    if (pointInsidePlacement(x, y, placement)) return { kind: 'image', key: placement.id };
  }
  return null;
}

function nearestDryTile(x: number, y: number, maximumRadius = 14): { x: number; y: number } | undefined {
  const centerX = Math.round(x);
  const centerY = Math.round(y);
  let best: { x: number; y: number; distance: number } | undefined;
  for (let offsetY = -maximumRadius; offsetY <= maximumRadius; offsetY += 1) {
    for (let offsetX = -maximumRadius; offsetX <= maximumRadius; offsetX += 1) {
      const tile = world.getTile(centerX + offsetX, centerY + offsetY);
      if (tile === undefined || tile.water !== WaterType.Land || tile.river) continue;
      const distance = Math.hypot(tile.x - x, tile.y - y);
      if (best === undefined || distance < best.distance) best = { x: tile.x, y: tile.y, distance };
    }
  }
  return best;
}

function commitAnchorMove(key: string, x: number, y: number): void {
  const tile = nearestDryTile(x, y);
  if (tile === undefined) {
    setStatus('Drop anchors on dry land.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previous = anchorPositionOverrides;
  anchorPositionOverrides = replaceAnchorPosition(anchorPositionOverrides, key, tile.x, tile.y);
  persistMapCustomization();
  if (regenerateFrom('anchor-placement', 'Moved anchor and rebuilt connected town systems.')) {
    recordHistory(snapshot, 'move anchor');
    return;
  }
  const error = statusMessage.textContent ?? 'The anchor could not be moved there.';
  anchorPositionOverrides = previous;
  persistMapCustomization();
  regenerateFrom('anchor-placement', 'Restored previous anchor position.');
  setStatus(`${error} The previous position was restored.`, 'error');
}

function commitSettlementMove(key: string, x: number, y: number): void {
  const settlement = world.settlements.find((item) => item.key === key);
  if (settlement === undefined || settlement.isPrimary) return;
  const tile = findNearestValidSettlementTile(world, key, x, y);
  if (tile === undefined) {
    setStatus('The selected community anchor is locked or the destination is outside the map.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previousLayer = authoringLayer;
  const previousSettlementPositions = settlementPositionOverrides;
  const existing = authoringLayer.settlementOverrides.find((override) => override.key === key);
  upsertSettlementAuthoringOverride({ ...existing, key, x: tile.x, y: tile.y });
  // Keep the legacy position override in sync so older save readers retain the
  // destination island identity while Milestone 18 uses the authoring layer.
  settlementPositionOverrides = [
    ...settlementPositionOverrides.filter((position) => position.key !== key),
    { key, x: tile.x, y: tile.y, islandKey: tile.islandKey },
  ];
  persistMapCustomization();
  const warning = tile.warning === undefined ? '' : ` Warning: ${tile.warning}.`;
  if (regenerateFrom('settlements', `Moved ${settlement.name}.${warning}`)) {
    recordHistory(snapshot, `move settlement ${settlement.name}`);
    return;
  }
  const error = statusMessage.textContent ?? 'The community anchor could not be moved there.';
  authoringLayer = previousLayer;
  settlementPositionOverrides = previousSettlementPositions;
  persistMapCustomization();
  regenerateFrom('settlements', 'Restored previous settlement position.');
  setStatus(`${error} The previous position was restored.`, 'error');
}

function commitStoryMove(key: string, id: number, x: number, y: number): void {
  const tile = nearestDryTile(x, y);
  if (tile === undefined) {
    setStatus('Drop story locations on dry land.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previous = storyPositionOverrides;
  storyPositionOverrides = replaceStoryPosition(storyPositionOverrides, key, id, tile.x, tile.y);
  persistMapCustomization();
  if (regenerateFrom('story-layer', 'Moved story location.')) {
    recordHistory(snapshot, 'move story point');
    return;
  }
  const error = statusMessage.textContent ?? 'The story location could not be moved there.';
  storyPositionOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', 'Restored previous story position.');
  setStatus(`${error} The previous position was restored.`, 'error');
}

async function handleCanvasDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  viewportShell.dataset.dropActive = 'false';
  const position = worldPositionFromPointer(event);
  const existingAssetId = event.dataTransfer?.getData('application/x-payaw-asset-id') ?? '';
  if (existingAssetId.length > 0) {
    placeAssetAt(existingAssetId, position.x, position.y);
    setLayer(RenderLayer.CustomImages, true);
    return;
  }

  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
  if (files.length === 0) return;
  const snapshot = captureEditorSnapshot();
  setStatus(`Importing ${files.length} image${files.length === 1 ? '' : 's'}…`, 'working');
  try {
    const imported = await importAssetFiles(files, AssetTargetCategory.Map, null);
    imported.forEach((asset, index) => {
      placedImages = [...placedImages, createPlacedImage(asset, position.x + index * 1.5, position.y + index * 1.5)];
    });
    persistMapCustomization();
    setLayer(RenderLayer.CustomImages, true);
    renderPlacedImageList();
    syncRendererCustomization();
    recordHistory(snapshot, `place ${imported.length} dropped image${imported.length === 1 ? '' : 's'}`);
    setStatus(`Imported and placed ${imported.length} image${imported.length === 1 ? '' : 's'}.`, 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

function animationFrame(): void {
  updateRealtimeClock();
  if (renderRequested) {
    renderer.render(world, camera);
    renderRequested = false;
    updatePerformancePanel();
  }
  renderMinimap();
  updateStatusBar();
  window.requestAnimationFrame(animationFrame);
}

const storedTheme = localStorage.getItem(UI_THEME_STORAGE_KEY);
setTheme(storedTheme === 'dark' || storedTheme === 'contrast' ? storedTheme : 'light');
setLeftPanel(localStorage.getItem(UI_LEFT_PANEL_STORAGE_KEY) !== 'closed');
setStudioDock(localStorage.getItem(UI_STUDIO_DOCK_STORAGE_KEY) === 'open');
setStudioTab(activeStudioTab === 'layers' || activeStudioTab === 'project' ? activeStudioTab : 'inspector', false);
minimapPanel.dataset.collapsed = localStorage.getItem(UI_MINIMAP_STORAGE_KEY) === 'collapsed' ? 'true' : 'false';
minimapCollapseButton.textContent = minimapPanel.dataset.collapsed === 'true' ? '+' : '−';
renderStudioLayerManager();
renderRecentProjects();
updateRecoveryUi();
applyLabelSettingsToControls(labelSettings);
updateProfileHint();
syncNpcViewToggle();
updateRealtimeClock();

npcGenerateButton.addEventListener('click', regenerateNpcRoster);
npcSearch.addEventListener('input', renderNPCList);
npcViewToggleButton.addEventListener('click', toggleNpcView);
npcCreateButton.addEventListener('click', createAuthoredNpc);
npcExportSelected.addEventListener('click', () => {
  const npc = selectedNpc();
  if (npc === undefined) {
    setStatus('Select an NPC before exporting it.', 'warning');
    return;
  }
  downloadNpcJson([npc], npc.name);
});
npcExportGroup.addEventListener('click', () => {
  const npcs = filteredNpcs();
  const query = npcSearch.value.trim();
  downloadNpcJson(npcs, query.length > 0 ? `${query} NPCs` : `${world.seed} NPC roster`);
});
npcImportFile.addEventListener('change', () => {
  const file = npcImportFile.files?.[0];
  if (file === undefined) return;
  setStatus('Validating NPC JSON…', 'working');
  void importNpcJsonFile(file).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
  npcImportFile.value = '';
});
npcSaveButton.addEventListener('click', saveSelectedNpc);
npcEditUnusualHome.addEventListener('change', () => renderNpcSelectors(selectedNpc()));
npcEditSettlement.addEventListener('change', () => renderNpcSelectors(selectedNpc()));
npcEditHome.addEventListener('change', () => {
  if (npcEditHome.value === '') return;
  const option = campaignLocationOptions().find((candidate) => candidate.ref === `building:${npcEditHome.value}`);
  const community = option === undefined ? undefined : nearestSettlementForTile(option.tileIndex);
  if (community !== undefined) npcEditSettlement.value = String(community.id);
});
npcEditPortrait.addEventListener('change', async () => {
  const file = npcEditPortrait.files?.[0];
  if (file === undefined) return;
  if (!file.type.startsWith('image/')) {
    setStatus('Choose an image file for the NPC portrait.', 'error');
    npcEditPortrait.value = '';
    return;
  }
  try {
    pendingNpcPortraitDataUrl = await readFileAsDataUrl(file);
    renderNpcPortrait(selectedNpc());
    setStatus('Portrait ready. Save the NPC to keep it.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
});
npcResetButton.addEventListener('click', () => {
  const npc = selectedNpc();
  if (npc === undefined || npc.source === 'authored') return;
  const existing = npcLocationAuthoring.npcOverrides.find((override) => override.npcKey === npc.key);
  if (existing === undefined) {
    setStatus(`${npc.name} already uses generated defaults.`, 'warning');
    return;
  }
  pendingNpcPortraitDataUrl = null;
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    npcOverrides: npcLocationAuthoring.npcOverrides.filter((override) => override.npcKey !== npc.key),
  }, `Restored generated fields for ${npc.name}.`);
});
npcDeleteButton.addEventListener('click', () => {
  const npc = selectedNpc();
  if (npc === undefined || npc.source !== 'authored') return;
  selectedNpcKey = null;
  pendingNpcPortraitDataUrl = null;
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    authoredNpcs: npcLocationAuthoring.authoredNpcs.filter((definition) => definition.key !== npc.key),
    temporaryOverrides: npcLocationAuthoring.temporaryOverrides.filter((override) => override.npcKey !== npc.key),
    scenePlacements: npcLocationAuthoring.scenePlacements.filter((placement) => placement.npcKey !== npc.key),
    locations: npcLocationAuthoring.locations.map((location) => location.ownerNpcKey === npc.key ? { ...location, ownerNpcKey: null } : location),
  }, `Deleted authored NPC ${npc.name}.`);
});
npcScheduleAdd.addEventListener('click', () => {
  const npc = selectedNpc();
  if (npc === undefined) return;
  const startMinute = minuteFromTimeInput(npcScheduleStart.value);
  const endMinute = minuteFromTimeInput(npcScheduleEnd.value);
  const location = scheduleLocationFromRef(world, authoringLayer, npcScheduleLocation.value);
  if (startMinute === null || endMinute === null || endMinute <= startMinute) {
    setStatus('Schedule blocks need a valid start time before the end time.', 'error');
    return;
  }
  if (location === undefined) {
    setStatus('Choose a valid schedule location.', 'error');
    return;
  }
  const entry: NPCScheduleEntry = {
    id: `schedule:${createRuleId()}`,
    day: selectedNpcScheduleDay,
    startMinute,
    endMinute,
    activity: npcScheduleActivity.value.trim() || 'At location',
    location,
    travelMode: npcScheduleTravel.value as NPCScheduleEntry['travelMode'],
    visibility: npcScheduleVisibility.value as NPCScheduleEntry['visibility'],
  };
  const next = [...npc.weeklySchedule, entry];
  const errors = validateSchedule(next);
  if (errors.length > 0) {
    setStatus(errors[0] ?? 'That schedule block conflicts with another block.', 'error');
    return;
  }
  updateSelectedNpcSchedule(next, `Added ${entry.activity} to ${selectedNpcScheduleDay}.`);
});
npcScheduleCopyWeekdays.addEventListener('click', () => {
  const npc = selectedNpc();
  if (npc === undefined) return;
  const source = npc.weeklySchedule.filter((entry) => entry.day === selectedNpcScheduleDay);
  if (source.length === 0) {
    setStatus('The selected day has no schedule blocks to copy.', 'warning');
    return;
  }
  const weekdays: readonly CampaignDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const retained = npc.weeklySchedule.filter((entry) => !weekdays.includes(entry.day));
  const copied = weekdays.flatMap((day) => source.map((entry) => ({ ...entry, id: `schedule:${createRuleId()}`, day })));
  updateSelectedNpcSchedule([...retained, ...copied], `Copied ${selectedNpcScheduleDay} to weekdays.`);
});
npcScheduleClearDay.addEventListener('click', () => {
  const npc = selectedNpc();
  if (npc === undefined) return;
  updateSelectedNpcSchedule(npc.weeklySchedule.filter((entry) => entry.day !== selectedNpcScheduleDay), `Cleared ${selectedNpcScheduleDay}.`);
});
npcRelationshipAdd.addEventListener('click', () => {
  const npc = selectedNpc();
  const targetId = Number(npcRelationshipTarget.value);
  if (npc === undefined || !Number.isInteger(targetId) || targetId === npc.id) {
    setStatus('Choose another NPC for the relationship.', 'error');
    return;
  }
  const relationship = {
    npcId: targetId,
    kind: npcRelationshipKind.value as NPCRelationship['kind'],
    ...(npcRelationshipLabel.value.trim() ? { label: npcRelationshipLabel.value.trim() } : {}),
    hidden: npcRelationshipHidden.checked,
  };
  const next = [...npc.relationships.filter((item) => !(item.npcId === targetId && item.kind === relationship.kind)), relationship];
  npcRelationshipLabel.value = '';
  updateSelectedNpcRelationships(next, 'Saved NPC relationship.');
});
npcOverrideAdd.addEventListener('click', () => {
  const npc = selectedNpc();
  const location = scheduleLocationFromRef(world, authoringLayer, npcOverrideLocation.value);
  if (npc === undefined || location === undefined) {
    setStatus('Choose an NPC and a valid temporary location.', 'error');
    return;
  }
  const startsAtMs = simulation?.state().time.campaignTimestampMs ?? Date.now();
  const durationMinutes = Math.max(1, Number(npcOverrideDuration.value) || 60);
  const override: NPCTemporaryOverride = {
    id: `npc-override:${createRuleId()}`,
    npcKey: npc.key,
    startsAtMs,
    endsAtMs: startsAtMs + durationMinutes * 60_000,
    location,
    activity: npcOverrideActivity.value.trim() || 'Temporarily present',
    reason: npcOverrideReason.value.trim(),
    priority: 100,
  };
  updateNpcAuthoringState({ ...npcLocationAuthoring, temporaryOverrides: [...npcLocationAuthoring.temporaryOverrides, override] }, `Temporarily placed ${npc.name} at ${location.label}.`);
});
npcScenePlace.addEventListener('click', () => {
  const npc = selectedNpc();
  const location = scheduleLocationFromRef(world, authoringLayer, npcOverrideLocation.value);
  if (npc === undefined || location === undefined) {
    setStatus('Choose an NPC and a valid scene location.', 'error');
    return;
  }
  const sceneId = npcSceneId.value.trim() || npcLocationAuthoring.activeSceneId || 'scene-1';
  const placement: NPCScenePlacement = {
    id: `npc-scene:${createRuleId()}`,
    sceneId,
    npcKey: npc.key,
    location,
    activity: npcOverrideActivity.value.trim() || 'Present in scene',
    visibleToPlayers: npcSceneVisible.checked,
  };
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    activeSceneId: sceneId,
    scenePlacements: [...npcLocationAuthoring.scenePlacements.filter((candidate) => !(candidate.sceneId === sceneId && candidate.npcKey === npc.key)), placement],
  }, `Placed ${npc.name} in ${sceneId}.`);
});
npcPlacementClear.addEventListener('click', () => {
  const npc = selectedNpc();
  if (npc === undefined) return;
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    temporaryOverrides: npcLocationAuthoring.temporaryOverrides.filter((override) => override.npcKey !== npc.key),
    scenePlacements: npcLocationAuthoring.scenePlacements.filter((placement) => placement.npcKey !== npc.key),
  }, `Cleared live placements for ${npc.name}.`);
});
locationSource.addEventListener('change', () => {
  selectedLocationRef = locationSource.value || null;
  renderLocationEditor();
});
locationSave.addEventListener('click', () => saveLocationRecord());
locationDelete.addEventListener('click', () => {
  const record = selectedAuthoredLocation();
  if (record === undefined) return;
  updateNpcAuthoringState({
    ...npcLocationAuthoring,
    locations: npcLocationAuthoring.locations.filter((candidate) => candidate.sourceRef !== record.sourceRef),
  }, `Removed the authored record for ${record.name}.`);
});
locationHoursClosed.addEventListener('change', () => {
  locationHoursOpen.disabled = locationHoursClosed.checked;
  locationHoursClose.disabled = locationHoursClosed.checked;
});
locationHoursSave.addEventListener('click', () => {
  const record = selectedAuthoredLocation();
  const day = locationHoursDay.value as CampaignDay;
  const openMinute = minuteFromTimeInput(locationHoursOpen.value);
  const closeMinute = minuteFromTimeInput(locationHoursClose.value);
  if (!locationHoursClosed.checked && (openMinute === null || closeMinute === null || closeMinute <= openMinute)) {
    setStatus('Venue hours need a valid opening time before the closing time.', 'error');
    return;
  }
  const entry: VenueHoursEntry = {
    day,
    openMinute: openMinute ?? 8 * 60,
    closeMinute: closeMinute ?? 17 * 60,
    closed: locationHoursClosed.checked,
  };
  const hours = [...(record?.venueHours ?? []).filter((candidate) => candidate.day !== day), entry];
  saveLocationRecord(hours);
});
realtimeClock.addEventListener('click', () => {
  clockDisplayFormat = clockDisplayFormat === '12h' ? '24h' : '12h';
  localStorage.setItem(CLOCK_FORMAT_STORAGE_KEY, clockDisplayFormat);
  lastRealtimeClockSecond = -1;
  updateRealtimeClock();
});
simulationClockMode.addEventListener('change', () => {
  simulation?.setClockMode(simulationClockMode.value as SimulationClockMode);
  lastRealtimeClockSecond = -1;
  renderSimulationPanel();
  scheduleAutosave();
});
simulationSpeed.addEventListener('change', () => {
  simulation?.setSpeed(Number(simulationSpeed.value) as SimulationSpeed);
  lastRealtimeClockSecond = -1;
  renderSimulationPanel();
  scheduleAutosave();
});
simulationApplyTime.addEventListener('click', () => {
  const timezone = simulation?.state().time.timezone ?? 'Asia/Manila';
  const timestamp = timestampFromZonedLocal(simulationDatetime.value, timezone);
  if (!Number.isFinite(timestamp)) {
    setStatus('Choose a valid campaign date and time.', 'error');
    return;
  }
  simulation?.setTimestamp(timestamp);
  simulation?.setClockMode(simulationClockMode.value as SimulationClockMode);
  lastRealtimeClockSecond = -1;
  renderSimulationPanel();
  scheduleAutosave();
  setStatus('Applied the world date and time.', 'success');
});
simulationAdvance15.addEventListener('click', () => { simulation?.advanceMinutes(15); lastRealtimeClockSecond = -1; renderSimulationPanel(); scheduleAutosave(); });
simulationAdvanceHour.addEventListener('click', () => { simulation?.advanceMinutes(60); lastRealtimeClockSecond = -1; renderSimulationPanel(); scheduleAutosave(); });
simulationAdvanceDay.addEventListener('click', () => { simulation?.advanceMinutes(1440); lastRealtimeClockSecond = -1; renderSimulationPanel(); scheduleAutosave(); });
simulationWeather.addEventListener('change', () => {
  const value = simulationWeather.value;
  simulation?.setWeatherOverride(value === 'auto' ? null : value as WeatherCondition);
  lastRealtimeClockSecond = -1;
  renderSimulationPanel();
  scheduleAutosave();
  if (activeTravelPlan?.contextRevision !== undefined) calculateTravelPlanner();
});
simulationInfrastructureKind.addEventListener('change', renderInfrastructureTargets);
simulationInfrastructureTarget.addEventListener('change', renderInfrastructureTargets);
simulationEventFilter.addEventListener('change', renderSimulationPanel);
simulationEventClear.addEventListener('click', () => {
  simulation?.clearEventLog();
  renderSimulationPanel();
  scheduleAutosave();
  setStatus('Cleared the simulation event timeline.', 'success');
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-simulation-preset]')) {
  button.addEventListener('click', () => {
    if (simulation === null) return;
    const preset = button.dataset.simulationPreset;
    const state = simulation.state();
    if (preset === 'typhoon') {
      simulation.setWeatherOverride('typhoon');
      simulationWeather.value = 'typhoon';
      setStatus('Applied the typhoon scenario.', 'success');
    } else {
      const currentLocal = datetimeLocalValue(state.time.campaignTimestampMs, state.time.timezone);
      const date = currentLocal.slice(0, 10);
      const localTime = preset === 'morning' ? '08:00' : preset === 'rush' ? '18:00' : '03:00';
      const timestamp = timestampFromZonedLocal(`${date}T${localTime}`, state.time.timezone);
      simulation.setTimestamp(timestamp);
      simulation.setClockMode('manual');
      simulationClockMode.value = 'manual';
      setStatus(`Applied the ${preset === 'rush' ? 'evening rush' : preset === 'witching' ? '3 AM manifestation' : 'morning'} scenario.`, 'success');
    }
    lastRealtimeClockSecond = -1;
    renderSimulationPanel();
    scheduleAutosave();
    if (activeTravelPlan?.contextRevision !== undefined) calculateTravelPlanner();
  });
}
simulationInfrastructureApply.addEventListener('click', () => {
  const id = Number(simulationInfrastructureTarget.value);
  if (!Number.isInteger(id)) return;
  simulation?.setInfrastructureOverride(
    simulationInfrastructureKind.value as 'road' | 'bridge' | 'port',
    id,
    simulationInfrastructureStatus.value as InfrastructureOperationalState,
  );
  lastRealtimeClockSecond = -1;
  renderSimulationPanel();
  scheduleAutosave();
  if (activeTravelPlan?.contextRevision !== undefined) calculateTravelPlanner();
});
simulationInfrastructureClear.addEventListener('click', () => {
  const id = Number(simulationInfrastructureTarget.value);
  if (!Number.isInteger(id)) return;
  simulation?.setInfrastructureOverride(
    simulationInfrastructureKind.value as 'road' | 'bridge' | 'port',
    id,
    null,
  );
  lastRealtimeClockSecond = -1;
  renderSimulationPanel();
  scheduleAutosave();
  if (activeTravelPlan?.contextRevision !== undefined) calculateTravelPlanner();
});
travelPickFrom.addEventListener('click', () => setTravelPickTarget(travelPickTarget === 'from' ? null : 'from'));
travelPickTo.addEventListener('click', () => setTravelPickTarget(travelPickTarget === 'to' ? null : 'to'));
travelCalculate.addEventListener('click', calculateTravelPlanner);
travelReverse.addEventListener('click', () => {
  const previous = travelFromLocation.value;
  travelFromLocation.value = travelToLocation.value;
  travelToLocation.value = previous;
  calculateTravelPlanner();
});
travelClear.addEventListener('click', () => {
  activeTravelPlan = null;
  activeTravelAlternatives = [];
  activeTravelNormalDuration = null;
  customTravelLocations.clear();
  setTravelPickTarget(null);
  refreshTravelLocationControls();
  travelAlternatives.replaceChildren();
  renderTravelPlanResult(null);
  syncRendererCustomization();
  setStatus('Cleared the displayed travel route.', 'success');
});
travelMode.addEventListener('change', () => { if (activeTravelPlan !== null) calculateTravelPlanner(); });
travelTraffic.addEventListener('change', () => { if (activeTravelPlan !== null) calculateTravelPlanner(); });

function currentCampaignWorldRef(): string {
  return `world:${activeWorldSignature.length > 0 ? activeWorldSignature : world?.seed ?? seedInput.value.trim()}`;
}

function campaignNpcOptions(): readonly CampaignStudioOption[] {
  if (world === undefined) return [];
  return world.npcs.map((npc) => ({ id: npc.key, label: npc.name, subtitle: npc.occupation }));
}

function campaignStudioLocationOptions(): readonly CampaignStudioOption[] {
  if (world === undefined) return [];
  return collectCampaignLocations(world, authoringLayer).filter((location) => location.kind !== 'building').map((location) => ({
    id: location.ref,
    label: location.label,
    subtitle: location.kind.replaceAll('-', ' '),
  }));
}

function campaignCharacterOptions(): readonly CampaignStudioOption[] {
  return playerViewState.players
    .filter((player) => player.active)
    .map((player) => {
      const character = playerViewState.characters.find((candidate) => candidate.id === player.characterId);
      return { id: player.characterId, label: character?.name ?? player.displayName, subtitle: player.displayName };
    });
}

function campaignAssetOptions(): readonly CampaignStudioOption[] {
  return importedAssets.map((asset) => ({ id: asset.id, label: asset.name, subtitle: asset.mimeType }));
}

function focusCampaignLocation(locationRef: string): void {
  if (world === undefined) return;
  const location = collectCampaignLocations(world, authoringLayer).find((candidate) => candidate.ref === locationRef);
  if (location === undefined) {
    showToast('That campaign location is no longer available on the current world.', 'warning');
    return;
  }
  const tile = world.tiles[location.tileIndex];
  if (tile !== undefined) focusMapPoint(tile.x, tile.y);
}

function syncCampaignScenePlacement(scene: import('./campaign/CampaignSystem').CampaignScene | null): void {
  if (world === undefined) return;
  const campaignPlacementPrefix = 'campaign-scene:';
  const retained = npcLocationAuthoring.scenePlacements.filter((placement) => !placement.id.startsWith(campaignPlacementPrefix));
  const additions: NPCScenePlacement[] = [];
  if (scene !== null && scene.locationRef !== null) {
    const location = scheduleLocationFromRef(world, authoringLayer, scene.locationRef, scene.name);
    if (location !== undefined) {
      for (const participant of scene.participants) {
        if (participant.type !== 'npc') continue;
        additions.push({
          id: `${campaignPlacementPrefix}${scene.id}:${participant.id}`,
          sceneId: scene.id,
          npcKey: participant.id,
          location,
          activity: `Present in ${scene.name}`,
          visibleToPlayers: !participant.hidden,
        });
      }
    }
  }
  const next = normalizeNpcLocationAuthoring({
    ...npcLocationAuthoring,
    activeSceneId: scene?.id ?? null,
    scenePlacements: [...retained, ...additions],
  });
  const beforeKey = JSON.stringify({ activeSceneId: npcLocationAuthoring.activeSceneId, placements: npcLocationAuthoring.scenePlacements.filter((placement) => placement.id.startsWith(campaignPlacementPrefix)) });
  const afterKey = JSON.stringify({ activeSceneId: next.activeSceneId, placements: next.scenePlacements.filter((placement) => placement.id.startsWith(campaignPlacementPrefix)) });
  if (beforeKey === afterKey) return;
  npcLocationAuthoring = next;
  world.npcs = applyNpcLocationAuthoring(world, npcLocationAuthoring);
  simulation?.setNpcLocationAuthoring(npcLocationAuthoring);
  renderNPCList();
  requestRender();
}

function createCampaignStudio(): CampaignStudio {
  return new CampaignStudio(campaignState, {
    hostingEnabled: readNetcodeConfig().enabled,
    getWorldRef: currentCampaignWorldRef,
    getNpcOptions: campaignNpcOptions,
    getLocationOptions: campaignStudioLocationOptions,
    getCharacterOptions: campaignCharacterOptions,
    getAssetOptions: campaignAssetOptions,
    getExternalAssetIds: () => new Set(importedAssets.map((asset) => asset.id)),
    onChange: (state) => {
      campaignState = state;
      scheduleAutosave();
      playerPreview?.refresh();
      document.dispatchEvent(new CustomEvent('payaw:campaign-state-changed'));
    },
    onTimeChange: (timestamp, timezone) => {
      const value = Date.parse(timestamp);
      if (Number.isFinite(value)) {
        simulation?.setClockMode('manual');
        simulation?.setTimestamp(value);
        simulation?.setTimezone(timezone);
      }
      renderSimulationPanel();
      requestRender();
    },
    onWeatherChange: (weather) => {
      simulation?.setWeatherOverride(weather === 'auto' ? null : weather as WeatherCondition);
      renderSimulationPanel();
      requestRender();
    },
    onActiveSceneChange: syncCampaignScenePlacement,
    onFocusLocation: focusCampaignLocation,
    notify: (message, kind = 'success') => showToast(message, kind),
  });
}

function syncSimulationToCampaignClock(): void {
  const timestamp = Date.parse(campaignState.runState.campaignTime);
  if (!Number.isFinite(timestamp) || simulation === null) return;
  simulation.setClockMode('manual');
  simulation.setTimestamp(timestamp);
  simulation.setTimezone(campaignState.runState.timezone);
}

if (!generate(customAnchors, builtInOverrides, true, true)) throw new Error('The initial PAYAW world could not be generated.');
campaignState = normalizeCampaignState(campaignState, currentCampaignWorldRef());
campaignStudio = createCampaignStudio();
campaignStudio.refreshExternalReferences();
playerViewState = normalizePlayerViewState(playerViewState, playerViewState.players.length || 6);
playerPreview = new GmPlayerPreview({
  getContext: () => ({ campaign: campaignState, world, authoringLayer, npcLocationAuthoring, generationOptions: generationOptions() }),
  getState: () => playerViewState,
  setState: (state) => {
    playerViewState = state;
    campaignStudio?.refreshExternalReferences();
    scheduleAutosave();
    document.dispatchEvent(new CustomEvent('payaw:player-state-changed'));
  },
  notify: (message, kind = 'success') => showToast(message, kind),
});
let netcodePanelLoaded = false;
function loadNetcodePanel(): void {
  if (netcodePanelLoaded) return;
  netcodePanelLoaded = true;
  void import('./netcode/GmNetcodePanel').then(({ GmNetcodePanel }) => {
    new GmNetcodePanel({
      getContext: () => ({ campaign: campaignState, world, authoringLayer, npcLocationAuthoring, generationOptions: generationOptions() }),
      getState: () => playerViewState,
      getAuthorityDocument: () => createHostedCampaignPayload(),
      loadAuthorityDocument: async (authorityDocument) => {
        await loadHostedAuthorityDocument(authorityDocument);
        scheduleAutosave();
        document.dispatchEvent(new CustomEvent('payaw:project-state-changed'));
      },
      getAssetData: (assetId) => {
        const asset = importedAssets.find((candidate) => candidate.id === assetId);
        return asset === undefined ? null : { dataUrl: asset.dataUrl, mimeType: asset.mimeType };
      },
      notify: (message, kind = 'success') => showToast(message, kind),
    });
  }).catch((error: unknown) => showToast(error instanceof Error ? error.message : String(error), 'error'));
}
document.addEventListener('payaw:panel-change', (event) => {
  const detail = (event as CustomEvent<{ readonly workspace?: string; readonly key?: string }>).detail;
  if (detail.workspace === 'dm' && detail.key === 'players') loadNetcodePanel();
});
if (readNetcodeConfig().enabled) loadNetcodePanel();
syncSimulationToCampaignClock();
initializeAuthoringUi();
renderAuthoringLists();
updateHistoryButtons();
setEditMode(false);
setZoneEditMode(false);
setWorkspace(activeWorkspace, activeWorkspace === 'dm');
if (activeWorkspace === 'dm') workspaceDmButton.click();
else workspaceEditorButton.click();
renderDmSessionLog();
renderAssetList();
void refreshAssetLibrary().catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : String(error), 'error');
});
window.requestAnimationFrame(animationFrame);

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const editingText = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLocaleLowerCase();
  if (commandPaletteBackdrop.dataset.open === 'true') {
    if (event.key === 'Escape') { event.preventDefault(); closeCommandPalette(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); activeCommandIndex = Math.min(filteredCommands.length - 1, activeCommandIndex + 1); renderCommandPalette(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); activeCommandIndex = Math.max(0, activeCommandIndex - 1); renderCommandPalette(); }
    else if (event.key === 'Enter') { event.preventDefault(); runActiveCommand(); }
    return;
  }
  if (modifier && !event.altKey && key === 'p') { event.preventDefault(); openCommandPalette(); return; }
  if (modifier && !event.altKey && key === 's') { event.preventDefault(); downloadWorld(world, currentMapCustomization(), importedAssets, labelSettings, customStoryDefinitions); return; }
  if (modifier && !event.altKey && key === 'o') { event.preventDefault(); projectImportFile.click(); return; }
  if (modifier && !event.altKey && event.key === '[') { event.preventDefault(); setLeftPanel(document.body.dataset.leftPanel === 'closed'); return; }
  if (modifier && !event.altKey && event.key === ']') { event.preventDefault(); setStudioDock(document.body.dataset.studioDock === 'closed'); return; }
  if (editingText) return;
  if (modifier && !event.altKey && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
  else if (modifier && !event.altKey && key === 'y') { event.preventDefault(); redo(); }
  else if (!modifier && key === 'f') { event.preventDefault(); if (selectedInspectorItem === null) fitCamera(); else focusSelection(); }
  else if (!modifier && key === 'g') { event.preventDefault(); void generateResponsive(customAnchors, builtInOverrides, true, true); }
  else if (!modifier && key === 'n') { event.preventDefault(); toggleNpcView(); }
  else if (event.key === 'Escape') { selectedInspectorItem = null; renderInspector(); }
});
window.addEventListener('resize', fitCamera);
toggleLeftPanelButton.addEventListener('click', () => setLeftPanel(document.body.dataset.leftPanel === 'closed'));
toggleStudioDockButton.addEventListener('click', () => setStudioDock(document.body.dataset.studioDock === 'closed'));
closeStudioDockButton.addEventListener('click', () => setStudioDock(false));
commandPaletteButton.addEventListener('click', openCommandPalette);
studioTabInspector.addEventListener('click', () => setStudioTab('inspector'));
studioTabLayers.addEventListener('click', () => setStudioTab('layers'));
studioTabProject.addEventListener('click', () => setStudioTab('project'));
focusSelectionButton.addEventListener('click', focusSelection);
layerSearchInput.addEventListener('input', filterStudioLayers);
layersAllButton.addEventListener('click', () => setAllStudioLayers(true));
layersNoneButton.addEventListener('click', () => setAllStudioLayers(false));
for (const control of document.querySelectorAll<HTMLInputElement>('[data-layer-target]')) {
  const targetId = control.dataset.layerTarget;
  const target = targetId === undefined ? null : document.getElementById(targetId) as HTMLInputElement | null;
  if (target === null) continue;
  control.checked = target.checked;
  control.addEventListener('change', () => {
    target.checked = control.checked;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    for (const peer of document.querySelectorAll<HTMLInputElement>(`[data-layer-target="${targetId}"]`)) peer.checked = target.checked;
  });
  target.addEventListener('change', () => {
    for (const peer of document.querySelectorAll<HTMLInputElement>(`[data-layer-target="${targetId}"]`)) peer.checked = target.checked;
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-open-workspace="dm"]')) button.addEventListener('click', () => setWorkspace('dm'));
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-open-panel="npc"]')) button.addEventListener('click', () => {
  setWorkspace('editor');
  document.querySelector('.npc-studio-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
studioThemeSelect.addEventListener('change', () => setTheme(studioThemeSelect.value as UiTheme));
studioSaveButton.addEventListener('click', () => downloadWorld(world, currentMapCustomization(), importedAssets, labelSettings, customStoryDefinitions));
studioOpenButton.addEventListener('click', () => projectImportFile.click());
studioExportImageButton.addEventListener('click', () => { void exportVisibleMapImage(); });
restoreSessionButton.addEventListener('click', () => { void restoreAutosave().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error), 'error')); });
clearRecentProjectsButton.addEventListener('click', () => { localStorage.removeItem(RECENT_PROJECTS_STORAGE_KEY); renderRecentProjects(); setStatus('Cleared recent worlds.', 'success'); });
minimapCollapseButton.addEventListener('click', () => {
  const collapsed = minimapPanel.dataset.collapsed !== 'true';
  minimapPanel.dataset.collapsed = String(collapsed);
  minimapCollapseButton.textContent = collapsed ? '+' : '−';
  localStorage.setItem(UI_MINIMAP_STORAGE_KEY, collapsed ? 'collapsed' : 'open');
  if (!collapsed) renderMinimap();
});
minimapCanvas.addEventListener('click', (event) => {
  const rectangle = minimapCanvas.getBoundingClientRect();
  const x = (event.clientX - rectangle.left) / rectangle.width * world.width;
  const y = (event.clientY - rectangle.top) / rectangle.height * world.height;
  camera.focus(x, y, canvas.clientWidth, canvas.clientHeight, camera.zoom);
  requestRender();
});
commandPaletteBackdrop.addEventListener('click', (event) => { if (event.target === commandPaletteBackdrop) closeCommandPalette(); });
commandPaletteInput.addEventListener('input', () => { activeCommandIndex = 0; renderCommandPalette(); });
window.setInterval(scheduleAutosave, 30_000);
window.addEventListener('beforeunload', () => {
  if (world === undefined) return;
  try { localStorage.setItem(SESSION_AUTOSAVE_STORAGE_KEY, JSON.stringify(createAutosavePayload())); } catch { /* best effort */ }
});
workspaceEditorButton.addEventListener('click', () => setWorkspace('editor'));
workspaceDmButton.addEventListener('click', () => setWorkspace('dm'));
dmViewPreset.addEventListener('change', () => {
  applyViewPreset(dmViewPreset.value);
  viewPreset.value = dmViewPreset.value;
});
dmStorySearch.addEventListener('input', filterDmStoryCards);
restoreRemovedStoryPoints.addEventListener('click', restoreAllSuppressedStoryPoints);
dmRandomEncounterButton.addEventListener('click', () => rollDmEncounter());
dmClearLog.addEventListener('click', () => {
  dmSessionEntries = [];
  renderDmSessionLog();
});
generateButton.addEventListener('click', () => { void generateResponsive(customAnchors, builtInOverrides, true, true); });
cancelGenerationButton.addEventListener('click', () => activeGenerationController?.abort());
seedInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void generateResponsive(customAnchors, builtInOverrides, true, true);
});
randomSeedButton.addEventListener('click', () => {
  seedInput.value = createCryptoSeed();
  void generateResponsive(customAnchors, builtInOverrides, true, true);
});
terrainSizeSelect.addEventListener('change', updateProfileHint);
townScaleSelect.addEventListener('change', updateProfileHint);
terrainShapeSelect.addEventListener('change', updateProfileHint);
climatePresetSelect.addEventListener('change', updateProfileHint);
islandCountInput.addEventListener('input', updateProfileHint);
islandSpacingInput.addEventListener('input', updateProfileHint);
exportButton.addEventListener('click', () => downloadWorld(world, currentMapCustomization(), importedAssets, labelSettings, customStoryDefinitions));
exportImageButton.addEventListener('click', () => { void exportVisibleMapImage(); });
undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);
exportCustomizationButton.addEventListener('click', exportCustomization);
customizationImportFile.addEventListener('change', () => {
  const file = customizationImportFile.files?.[0];
  if (file === undefined) return;
  void importCustomizationFile(file).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
  customizationImportFile.value = '';
});
projectImportFile.addEventListener('change', () => {
  const file = projectImportFile.files?.[0];
  if (file === undefined) return;
  setStatus('Validating PAYAW JSON…', 'working');
  void importPayawJsonFile(file).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
  projectImportFile.value = '';
});
projectJsonDropzone.addEventListener('dragenter', (event) => {
  event.preventDefault();
  projectJsonDropzone.dataset.dragging = 'true';
});
projectJsonDropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
  projectJsonDropzone.dataset.dragging = 'true';
});
projectJsonDropzone.addEventListener('dragleave', (event) => {
  if (event.relatedTarget instanceof Node && projectJsonDropzone.contains(event.relatedTarget)) return;
  delete projectJsonDropzone.dataset.dragging;
});
projectJsonDropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  delete projectJsonDropzone.dataset.dragging;
  const file = [...(event.dataTransfer?.files ?? [])].find((candidate) => candidate.name.toLowerCase().endsWith('.json') || candidate.type === 'application/json');
  if (file === undefined) {
    setStatus('Drop a PAYAW JSON file.', 'error');
    return;
  }
  setStatus('Validating dropped PAYAW JSON…', 'working');
  void importPayawJsonFile(file).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
});
fitMapButton.addEventListener('click', fitCamera);
viewPreset.addEventListener('change', () => {
  applyViewPreset(viewPreset.value);
  if (viewPreset.value !== 'custom') dmViewPreset.value = viewPreset.value;
});
const labelRangeControls = [
  roadLabelFontSize,
  roadLabelOpacity,
  roadLabelDensity,
  blockLabelFontSize,
  blockLabelOpacity,
  blockLabelDensity,
];
for (const control of labelRangeControls) {
  let snapshot: EditorSnapshot | null = null;
  control.addEventListener('focus', () => { snapshot = captureEditorSnapshot(); });
  control.addEventListener('pointerdown', () => { snapshot = captureEditorSnapshot(); });
  control.addEventListener('input', commitLabelControls);
  control.addEventListener('change', () => {
    commitLabelControls();
    if (snapshot !== null) recordHistory(snapshot, 'change label display');
    snapshot = null;
  });
}
const labelChangeControls: readonly (HTMLInputElement | HTMLSelectElement)[] = [
  roadLabelMainZoom,
  roadLabelSecondaryZoom,
  roadLabelLocalZoom,
  roadLabelMain,
  roadLabelSecondary,
  roadLabelLocal,
  roadLabelRotate,
  roadLabelOutline,
  blockLabelMinZoom,
  blockLabelOutline,
  labelAvoidCollisions,
];
for (const control of labelChangeControls) control.addEventListener('change', () => {
  const snapshot = captureEditorSnapshot();
  commitLabelControls();
  recordHistory(snapshot, 'change label display');
});
labelControlsReset.addEventListener('click', () => {
  const snapshot = captureEditorSnapshot();
  labelSettings = DEFAULT_LABEL_DISPLAY_SETTINGS;
  saveLabelSettings(labelSettings);
  applyLabelSettingsToControls(labelSettings);
  syncRendererCustomization();
  recordHistory(snapshot, 'reset label controls');
  setStatus('Label controls reset to defaults.', 'success');
});
editModeButton.addEventListener('click', () => { if (!editMode) setZoneEditMode(false); setEditMode(!editMode); });
toolbarEditButton.addEventListener('click', () => { if (!editMode) setZoneEditMode(false); setEditMode(!editMode); });
resetObjectPositionsButton.addEventListener('click', resetAllObjectPositions);
assetTargetCategory.addEventListener('change', updateAssetTargetOptions);
assetForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const files = Array.from(assetFiles.files ?? []);
  if (files.length === 0) {
    setStatus('Choose at least one image file.', 'error');
    return;
  }
  const category = assetTargetCategory.value as AssetTargetCategory;
  const targetType = category === AssetTargetCategory.Map || assetTargetType.value.length === 0 ? null : assetTargetType.value;
  setStatus(`Importing ${files.length} asset${files.length === 1 ? '' : 's'}…`, 'working');
  void importAssetFiles(files, category, targetType).then((assets) => {
    assetFiles.value = '';
    setStatus(`Imported ${assets.length} asset${assets.length === 1 ? '' : 's'} for ${describeAssetTarget(category, targetType)}.`, 'success');
  }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
});

customStoryCancel.addEventListener('click', resetCustomStoryForm);
customStoryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = customStoryName.value.trim();
  if (name.length === 0) {
    setStatus('Enter a story point name.', 'error');
    return;
  }
  const editingId = customStoryEditId.value;
  if (editingId.length === 0 && customStoryDefinitions.length >= MAX_CUSTOM_STORY_POINTS) {
    setStatus(`The editor supports up to ${MAX_CUSTOM_STORY_POINTS} custom story points.`, 'error');
    return;
  }
  if (customStoryDefinitions.some((item) => item.id !== editingId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    setStatus('Story point names must be unique.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const previous = customStoryDefinitions;
  const definition = readCustomStoryDefinition(editingId.length === 0 ? undefined : editingId);
  customStoryDefinitions = editingId.length === 0
    ? [...customStoryDefinitions, definition]
    : customStoryDefinitions.map((item) => item.id === editingId ? definition : item);
  saveCustomStoryDefinitions(customStoryDefinitions);
  if (regenerateFrom('story-layer', `${editingId.length === 0 ? 'Added' : 'Updated'} ${definition.name}.`)) {
    recordHistory(snapshot, `${editingId.length === 0 ? 'add' : 'edit'} story point ${definition.name}`);
    resetCustomStoryForm();
    return;
  }
  customStoryDefinitions = previous;
  saveCustomStoryDefinitions(customStoryDefinitions);
  regenerateFrom('story-layer', 'Restored previous story points.');
});

storyRuleTarget.addEventListener('change', syncStoryRuleEditor);
storyRuleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const item = storyFromEditorSelection();
  if (item === undefined) return;
  const snapshot = captureEditorSnapshot();
  const allowedZones = selectedZoneValues(storyAllowedZones);
  const disallowedZones = selectedZoneValues(storyDisallowedZones).filter((zone) => !allowedZones.includes(zone));
  const customName = storyRuleName.value.trim();
  const encounters = parseEncounterLines(storyRuleEncounters.value);
  const rule: StoryRuleOverride = {
    id: item.id,
    key: item.key,
    ...(customName.length > 0 ? { name: customName } : {}),
    preferredZone: storyPreferredZone.value.length === 0 ? null : storyPreferredZone.value as ZoneType,
    allowedZones,
    disallowedZones,
    influenceRadius: Math.max(2, Math.min(40, Number(storyInfluenceRadius.value) || 10)),
    ...(storyRuleWish.value.trim().length > 0 ? { wish: storyRuleWish.value.trim() } : {}),
    ...(storyRuleManifestation.value.trim().length > 0 ? { manifestation: storyRuleManifestation.value.trim() } : {}),
    ...(encounters.length > 0 ? { encounters } : {}),
    ...(storyRuleFor(item.id, item.key)?.suppressed === true ? { suppressed: true } : {}),
  };
  const previous = storyRuleOverrides;
  storyRuleOverrides = [
    ...storyRuleOverrides.filter((candidate) => candidate.key !== item.key && !(candidate.key === undefined && candidate.id === item.id)),
    rule,
  ].sort((left, right) => left.id - right.id || (left.key ?? '').localeCompare(right.key ?? ''));
  persistMapCustomization();
  if (regenerateFrom('story-layer', 'Story rules and encounter table updated.')) {
    recordHistory(snapshot, `edit story point ${item.name}`);
    return;
  }
  storyRuleOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', 'Restored previous story rules.');
});
storyRuleReset.addEventListener('click', () => {
  const item = storyFromEditorSelection();
  if (item === undefined) return;
  const snapshot = captureEditorSnapshot();
  const previous = storyRuleOverrides;
  storyRuleOverrides = storyRuleOverrides.filter((candidate) => candidate.key !== item.key && !(candidate.key === undefined && candidate.id === item.id));
  persistMapCustomization();
  if (regenerateFrom('story-layer', 'Story rules reset to generated defaults.')) {
    recordHistory(snapshot, `reset story rules for ${item.name}`);
    return;
  }
  storyRuleOverrides = previous;
  persistMapCustomization();
  regenerateFrom('story-layer', 'Restored previous story rules.');
});

zoneEditModeButton.addEventListener('click', () => setZoneEditMode(!zoneEditMode));
zoneBrushSize.addEventListener('input', () => { updateZoneEditorUi(); syncRendererCustomization(); });
zoneToolSelect.addEventListener('change', updateZoneEditorUi);
zoneDisplayMode.addEventListener('change', () => { setLayer(RenderLayer.Zones, true); syncRendererCustomization(); });
zoneResetAll.addEventListener('click', () => {
  if (zoneOverrides.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previous = [...zoneOverrides];
  zoneOverrides = [];
  persistAndRegenerateZoneOverrides(previous, snapshot, 'Reset all zone overrides.');
});

bridgeFromIsland.addEventListener('change', () => {
  if (bridgeToIsland.value === bridgeFromIsland.value) {
    bridgeToIsland.value = world.islands.find((island) => island.key !== bridgeFromIsland.value && island.allowBridges)?.key ?? '';
  }
});

bridgeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (bridgeFromIsland.value.length === 0 || bridgeToIsland.value.length === 0 || bridgeFromIsland.value === bridgeToIsland.value) {
    setStatus('Choose two different bridge-enabled islands.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const definition: CustomBridgeDefinition = {
    key: `bridge:custom:${createRuleId()}`,
    name: bridgeName.value.trim(),
    fromIslandKey: bridgeFromIsland.value,
    toIslandKey: bridgeToIsland.value,
    type: bridgeType.value as BridgeType,
    roadClass: bridgeRoadClass.value as RoadType,
    deckWidth: Number(bridgeWidth.value),
    clearance: Number(bridgeClearance.value),
    locked: false,
  };
  const previous = [...customBridges];
  customBridges = [...customBridges, definition];
  persistMapCustomization();
  if (!regenerateFrom('bridges', `Added ${definition.name}.`) || !world.bridges.some((bridge) => bridge.key === definition.key)) {
    customBridges = previous;
    persistMapCustomization();
    regenerateFrom('bridges', 'Restored the previous bridge network.');
    setStatus('No valid coast-to-coast crossing was found for that island pair. Try another pair or draw a manual crossing as an authored infrastructure feature.', 'error');
    return;
  }
  bridgeName.value = '';
  recordHistory(snapshot, `add bridge ${definition.name}`);
});

bridgeResetAll.addEventListener('click', () => {
  if (bridgeOverrides.length === 0 && customBridges.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previousOverrides = [...bridgeOverrides];
  const previousCustom = [...customBridges];
  bridgeOverrides = [];
  customBridges = [];
  persistMapCustomization();
  if (regenerateFrom('bridges', 'Reset bridge authoring to generated defaults.')) {
    recordHistory(snapshot, 'reset bridge authoring');
    return;
  }
  bridgeOverrides = previousOverrides;
  customBridges = previousCustom;
  persistMapCustomization();
  regenerateFrom('bridges', 'Restored previous bridge authoring.');
});

portForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (portIsland.value.length === 0) {
    setStatus('Choose a port-enabled island.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const definition: CustomPortDefinition = {
    key: `port:custom:${createRuleId()}`,
    name: portName.value.trim(),
    islandKey: portIsland.value,
    type: portType.value as PortType,
    capacity: Math.max(20, Math.min(5000, Number(portCapacity.value) || 300)),
    locked: true,
  };
  const previous = [...customPorts];
  customPorts = [...customPorts, definition];
  persistMapCustomization();
  if (!regenerateFrom('ports', `Added ${definition.name}.`) || !world.ports.some((port) => port.key === definition.key)) {
    customPorts = previous;
    persistMapCustomization();
    regenerateFrom('ports', 'Restored the previous port network.');
    setStatus('No valid coastline site was found on that island. Try another coastline or place a manual dock as an authored infrastructure feature.', 'error');
    return;
  }
  portName.value = '';
  recordHistory(snapshot, `add port ${definition.name}`);
});

portResetAll.addEventListener('click', () => {
  if (portOverrides.length === 0 && customPorts.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previousOverrides = [...portOverrides];
  const previousCustom = [...customPorts];
  portOverrides = [];
  customPorts = [];
  persistMapCustomization();
  if (regenerateFrom('ports', 'Reset port authoring to generated defaults.')) {
    recordHistory(snapshot, 'reset port authoring');
    return;
  }
  portOverrides = previousOverrides;
  customPorts = previousCustom;
  persistMapCustomization();
  regenerateFrom('ports', 'Restored previous port authoring.');
});

let canvasDragDepth = 0;
canvas.addEventListener('dragenter', (event) => {
  event.preventDefault();
  canvasDragDepth += 1;
  viewportShell.dataset.dropActive = 'true';
});
canvas.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
  viewportShell.dataset.dropActive = 'true';
});
canvas.addEventListener('dragleave', () => {
  canvasDragDepth = Math.max(0, canvasDragDepth - 1);
  if (canvasDragDepth === 0) viewportShell.dataset.dropActive = 'false';
});
canvas.addEventListener('drop', (event) => {
  canvasDragDepth = 0;
  void handleCanvasDrop(event);
});

for (const layer of Object.values(RenderLayer)) {
  const checkbox = layerElements[layer];
  checkbox.addEventListener('change', () => {
    renderer.layers.setVisible(layer, checkbox.checked);
    if (layer === RenderLayer.RoadLabels || layer === RenderLayer.BlockLabels) {
      labelSettings = readLabelSettingsFromControls();
      saveLabelSettings(labelSettings);
      updateLabelControlOutputs();
      syncRendererCustomization();
    }
    if (layer === RenderLayer.NPCs) syncNpcViewToggle();
    viewPreset.value = 'custom';
    requestRender();
  });
}

anchorTarget.addEventListener('change', () => {
  const hasTarget = anchorTarget.value.length > 0;
  anchorProximity.disabled = !hasTarget;
  anchorProximity.value = hasTarget ? AnchorProximityBand.Near : AnchorProximityBand.None;
});
anchorCancelButton.addEventListener('click', resetAnchorForm);
anchorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const settings = readAnchorSettings();
  if (settings.name.length === 0) {
    setStatus('Enter an anchor name.', 'error');
    return;
  }
  const editing = anchorEditKey.value;
  const existingNames = [
    ...BUILT_IN_ANCHOR_TYPES.map((type) => ({ key: `builtin:${type}`, name: mergedBuiltInDefinition(type).name })),
    ...customAnchors.map((definition) => ({ key: `custom:${definition.id}`, name: definition.name })),
  ];
  if (existingNames.some((item) => item.key !== editing && item.name.toLocaleLowerCase() === settings.name.toLocaleLowerCase())) {
    setStatus('Anchor names must be unique.', 'error');
    return;
  }

  const snapshot = captureEditorSnapshot();
  if (editing.startsWith('builtin:')) {
    const type = editing.slice('builtin:'.length) as BuiltInAnchorType;
    const candidate = [...builtInOverrides.filter((definition) => definition.type !== type), { type, ...settings }];
    if (!generate(customAnchors, candidate, false)) return;
    builtInOverrides = candidate;
  } else if (editing.startsWith('custom:')) {
    const id = editing.slice('custom:'.length);
    const candidate = customAnchors.map((definition) => definition.id === id ? { id, ...settings } : definition);
    if (!generate(candidate, builtInOverrides, false)) return;
    customAnchors = candidate;
  } else {
    if (customAnchors.length >= MAX_CUSTOM_ANCHORS) {
      setStatus(`The editor supports up to ${MAX_CUSTOM_ANCHORS} custom anchors.`, 'error');
      return;
    }
    const candidate = [...customAnchors, { id: createRuleId(), ...settings }];
    if (!generate(candidate, builtInOverrides, false)) return;
    customAnchors = candidate;
  }
  saveAnchorState(customAnchors, builtInOverrides);
  recordHistory(snapshot, editing.length === 0 ? 'add custom anchor' : 'edit anchor rules');
  resetAnchorForm();
  renderAnchorList();
});

roadNameTarget.addEventListener('change', syncRoadNameInput);
blockNameTarget.addEventListener('change', syncBlockNameInput);
roadNameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = Number(roadNameTarget.value);
  const name = roadNameInput.value.trim();
  const road = world.roads[id];
  if (road === undefined || name.length === 0) return;
  const snapshot = captureEditorSnapshot();
  roadNameOverrides = replaceNameOverride(roadNameOverrides, id, name);
  road.name = name;
  persistNames();
  renderNameEditors();
  requestRender();
  recordHistory(snapshot, `rename road ${road.name}`);
  setStatus(`Renamed road #${id}.`, 'success');
});
roadNameReset.addEventListener('click', () => {
  const snapshot = captureEditorSnapshot();
  const id = Number(roadNameTarget.value);
  roadNameOverrides = removeNameOverride(roadNameOverrides, id);
  persistNames();
  if (regenerateFrom('place-naming', `Reset road #${id} name.`)) recordHistory(snapshot, 'reset road name');
});
blockNameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = Number(blockNameTarget.value);
  const name = blockNameInput.value.trim();
  const block = world.blocks[id];
  if (block === undefined || name.length === 0) return;
  const snapshot = captureEditorSnapshot();
  blockNameOverrides = replaceNameOverride(blockNameOverrides, id, name);
  block.name = name;
  persistNames();
  renderNameEditors();
  requestRender();
  recordHistory(snapshot, `rename block ${block.name}`);
  setStatus(`Renamed block #${id}.`, 'success');
});
blockNameReset.addEventListener('click', () => {
  const snapshot = captureEditorSnapshot();
  const id = Number(blockNameTarget.value);
  blockNameOverrides = removeNameOverride(blockNameOverrides, id);
  persistNames();
  if (regenerateFrom('place-naming', `Reset block #${id} name.`)) recordHistory(snapshot, 'reset block name');
});

function beginAuthoringTerrainStroke(event: PointerEvent, position: AuthoringPoint): void {
  const x = Math.floor(position.x);
  const y = Math.floor(position.y);
  if (!world.contains(x, y)) return;
  authoringTerrainStrokeActive = true;
  authoringTerrainStroke.clear();
  const indices = brushIndices(world, position.x, position.y, Number(authoringTerrainSize.value));
  for (const index of indices) authoringTerrainStroke.add(index);
  zoneBrushPreview = [...authoringTerrainStroke];
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('entity-dragging');
  syncRendererCustomization();
}

function endAuthoringTerrainStroke(event: PointerEvent, cancelled = false): void {
  if (!authoringTerrainStrokeActive) return;
  authoringTerrainStrokeActive = false;
  const indices = [...authoringTerrainStroke];
  authoringTerrainStroke.clear();
  zoneBrushPreview = [];
  canvas.classList.remove('entity-dragging');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  syncRendererCustomization();
  if (!cancelled) commitAuthoringTerrain(indices);
}

function beginAuthoredFeatureDrag(event: PointerEvent, feature: AuthoredMapFeature, position: AuthoringPoint): void {
  loadFeatureIntoForm(feature.id);
  if (feature.locked) {
    setAuthoringStatus(`${feature.name} is locked. Unlock it in the anchor list before moving it.`, 'warning');
    return;
  }
  authoredFeatureOriginal = structuredClone(feature);
  authoredFeatureHistorySnapshot = captureEditorSnapshot();
  authoredFeaturePointerStart = position;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('entity-dragging');
}

function endAuthoredFeatureDrag(event: PointerEvent, cancelled = false): void {
  if (authoredFeatureOriginal === null) return;
  const original = authoredFeatureOriginal;
  const snapshot = authoredFeatureHistorySnapshot;
  authoredFeatureOriginal = null;
  authoredFeatureHistorySnapshot = null;
  authoredFeaturePointerStart = null;
  canvas.classList.remove('entity-dragging');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

  if (cancelled || pointerTravel <= 1) {
    authoringLayer = {
      ...authoringLayer,
      features: authoringLayer.features.map((feature) => feature.id === original.id ? original : feature),
    };
    renderAuthoringLists();
    syncRendererCustomization();
    return;
  }

  persistMapCustomization();
  const updated = authoringLayer.features.find((feature) => feature.id === original.id);
  const stage = updated === undefined ? null : featureRegenerationStage(updated);
  if (stage !== null) regenerateFrom(stage, `Moved ${updated?.name ?? original.name}.`);
  else {
    renderAuthoringLists();
    syncRendererCustomization();
    setStatus(`Moved ${updated?.name ?? original.name}.`, 'success');
  }
  if (snapshot !== null) recordHistory(snapshot, `move authored ${original.category}`);
}

canvas.addEventListener('pointerdown', (event) => {
  pointerTravel = 0;
  const position = worldPositionFromPointer(event);
  if (authoringTool === 'terrain-brush') {
    beginAuthoringTerrainStroke(event, position);
    return;
  }
  if (zoneEditMode) {
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    if (!world.contains(x, y)) return;
    const tileIndex = y * world.width + x;
    const tool = zoneToolSelect.value as ZoneTool;
    if (tool === 'fill') {
      commitZoneIndices(floodFillIndices(world, tileIndex), tool);
      return;
    }
    if (tool === 'eyedropper') {
      commitZoneIndices([tileIndex], tool);
      return;
    }
    zoneStrokeActive = true;
    zoneStrokeStart = { x: position.x, y: position.y };
    zoneStrokeIndices.clear();
    const indices = tool === 'rectangle'
      ? rectangleIndices(world, position.x, position.y, position.x, position.y)
      : brushIndices(world, position.x, position.y, Number(zoneBrushSize.value));
    for (const index of indices) zoneStrokeIndices.add(index);
    zoneBrushPreview = [...zoneStrokeIndices];
    canvas.setPointerCapture(event.pointerId);
    syncRendererCustomization();
    return;
  }
  if (authoringTool === 'select') {
    const feature = hitAuthoredFeature(position.x, position.y);
    if (feature !== undefined) {
      beginAuthoredFeatureDrag(event, feature, position);
      return;
    }
    const markerRadius = Math.max(1.4, 10 / Math.max(1, camera.zoom));
    const settlement = [...world.settlements].reverse().find((candidate) => !candidate.isPrimary
      && candidate.hidden !== true
      && Math.hypot(position.x - (candidate.x + 0.5), position.y - (candidate.y + 0.5)) <= markerRadius);
    if (settlement !== undefined) {
      loadSettlementIntoForm(settlement.key);
      if (settlement.locked === true) {
        setAuthoringStatus(`${settlement.name} is locked. Unlock it before moving this community anchor.`, 'warning');
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('entity-dragging');
      dragPreview = { kind: 'settlement', key: settlement.key, x: settlement.x, y: settlement.y };
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      syncRendererCustomization();
      return;
    }
  }
  if (editMode) {
    const target = hitMovableObject(position.x, position.y);
    if (target !== null) {
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('entity-dragging');
      if (target.kind === 'image') {
        const placement = placedImages.find((item) => item.id === target.key);
        if (placement !== undefined) {
          draggedImageId = placement.id;
          draggedImageOriginal = placement;
          draggedImageHistorySnapshot = captureEditorSnapshot();
          draggedImageOffsetX = position.x - placement.x;
          draggedImageOffsetY = position.y - placement.y;
        }
      } else {
        const settlement = target.kind === 'settlement'
          ? world.settlements.find((item) => item.key === target.key)
          : undefined;
        dragPreview = {
          kind: target.kind,
          key: target.key,
          x: settlement?.x ?? position.x - 0.5,
          y: settlement?.y ?? position.y - 0.5,
        };
      }
      syncRendererCustomization();
      return;
    }
  }

  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  const position = worldPositionFromPointer(event);
  const tile = world.getTile(Math.floor(position.x), Math.floor(position.y));
  if (tile === undefined) {
    cursorReadout.textContent = 'x — · y —';
  } else {
    const index = tile.y * world.width + tile.x;
    const anchor = world.anchors.find((candidate) => candidate.tileIndex === index);
    const story = world.storyObjects.find((candidate) => candidate.tileIndex === index);
    const road = tile.roadId === null ? undefined : world.roads[tile.roadId];
    const block = tile.blockId === null ? undefined : world.blocks[tile.blockId];
    const customImage = [...placedImages].reverse().find((placement) => pointInsidePlacement(position.x, position.y, placement));
    const island = tile.islandId === null ? undefined : world.islands[tile.islandId];
    const settlement = tile.settlementId === null ? undefined : world.settlements[tile.settlementId];
    cursorReadout.textContent = [
      `x ${tile.x}`, `y ${tile.y}`, `h ${tile.elevation.toFixed(3)}`,
      tile.river ? `river ${tile.riverWidth.toFixed(2)}w` : '',
      road === undefined ? '' : road.name,
      block === undefined ? '' : block.name,
      anchor === undefined ? '' : `anchor ${anchor.name}`,
      story === undefined ? '' : `story ${story.name}`,
      customImage === undefined ? '' : `image ${customImage.name}`,
      island === undefined ? '' : `island ${island.name}`,
      settlement === undefined ? '' : `community ${settlement.name}`,
      tile.zoneType ?? '', tile.terrain,
    ].filter((value) => value.length > 0).join(' · ');
  }

  if (zoneEditMode) {
    const tool = zoneToolSelect.value as ZoneTool;
    if (zoneStrokeActive && zoneStrokeStart !== null) {
      const indices = tool === 'rectangle'
        ? rectangleIndices(world, zoneStrokeStart.x, zoneStrokeStart.y, position.x, position.y)
        : brushIndices(world, position.x, position.y, Number(zoneBrushSize.value));
      if (tool === 'rectangle') zoneStrokeIndices = new Set(indices);
      else for (const index of indices) zoneStrokeIndices.add(index);
      zoneBrushPreview = [...zoneStrokeIndices];
    } else if (tool !== 'fill' && tool !== 'eyedropper') {
      zoneBrushPreview = brushIndices(world, position.x, position.y, Number(zoneBrushSize.value));
    } else {
      const x = Math.floor(position.x);
      const y = Math.floor(position.y);
      zoneBrushPreview = world.contains(x, y) ? [y * world.width + x] : [];
    }
    syncRendererCustomization();
    return;
  }

  if (authoringTool === 'terrain-brush') {
    const indices = brushIndices(world, position.x, position.y, Number(authoringTerrainSize.value));
    if (authoringTerrainStrokeActive) {
      for (const index of indices) authoringTerrainStroke.add(index);
      zoneBrushPreview = [...authoringTerrainStroke];
    } else {
      zoneBrushPreview = indices;
    }
    syncRendererCustomization();
    return;
  }

  if (authoredFeatureOriginal !== null && authoredFeaturePointerStart !== null) {
    pointerTravel += Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    const deltaX = position.x - authoredFeaturePointerStart.x;
    const deltaY = position.y - authoredFeaturePointerStart.y;
    const translated = {
      ...authoredFeatureOriginal,
      geometry: translateGeometry(authoredFeatureOriginal.geometry, deltaX, deltaY),
      updatedAt: new Date().toISOString(),
    };
    authoringLayer = {
      ...authoringLayer,
      features: authoringLayer.features.map((feature) => feature.id === translated.id ? translated : feature),
    };
    syncRendererCustomization();
    return;
  }

  if (dragPreview !== null) {
    pointerTravel += Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    if (dragPreview.kind === 'settlement') {
      const constrained = findNearestValidSettlementTile(world, dragPreview.key, position.x - 0.5, position.y - 0.5, 8);
      if (constrained !== undefined) {
        dragPreview = { ...dragPreview, x: constrained.x, y: constrained.y };
        canvas.classList.remove('entity-drag-invalid');
      } else {
        canvas.classList.add('entity-drag-invalid');
      }
    } else {
      dragPreview = { ...dragPreview, x: position.x - 0.5, y: position.y - 0.5 };
    }
    syncRendererCustomization();
    return;
  }
  if (draggedImageId !== null) {
    placedImages = placedImages.map((placement) => placement.id === draggedImageId
      ? { ...placement, x: position.x - draggedImageOffsetX, y: position.y - draggedImageOffsetY }
      : placement);
    syncRendererCustomization();
    return;
  }
  if (!dragging) return;
  pointerTravel += Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
  camera.pan(event.clientX - lastPointerX, event.clientY - lastPointerY);
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  requestRender();
});

function endPointerInteraction(event: PointerEvent, cancelled = false): void {
  const preview = dragPreview;
  const imageId = draggedImageId;
  dragPreview = null;
  draggedImageId = null;
  dragging = false;
  canvas.classList.remove('dragging', 'entity-dragging', 'entity-drag-invalid');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

  if (cancelled && imageId !== null && draggedImageOriginal !== null) {
    placedImages = placedImages.map((placement) => placement.id === imageId ? draggedImageOriginal as PlacedImage : placement);
  }
  const originalImage = draggedImageOriginal;
  draggedImageOriginal = null;
  const imageHistorySnapshot = draggedImageHistorySnapshot;
  draggedImageHistorySnapshot = null;
  syncRendererCustomization();

  if (cancelled) return;
  if (preview?.kind === 'anchor') {
    commitAnchorMove(preview.key, preview.x, preview.y);
  } else if (preview?.kind === 'settlement') {
    commitSettlementMove(preview.key, preview.x, preview.y);
  } else if (preview?.kind === 'story') {
    const story = world.storyObjects.find((item) => item.key === preview.key);
    if (story !== undefined) commitStoryMove(story.key, story.id, preview.x, preview.y);
  } else if (imageId !== null && originalImage !== null) {
    persistMapCustomization();
    renderPlacedImageList();
    updateStats(stats, world);
    if (imageHistorySnapshot !== null) recordHistory(imageHistorySnapshot, 'move map image');
    setStatus('Moved map image.', 'success');
  }
}

function endZoneStroke(event: PointerEvent, cancelled = false): void {
  if (!zoneStrokeActive) return;
  zoneStrokeActive = false;
  zoneStrokeStart = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  const indices = [...zoneStrokeIndices];
  zoneStrokeIndices.clear();
  zoneBrushPreview = [];
  syncRendererCustomization();
  if (!cancelled) commitZoneIndices(indices, zoneToolSelect.value as ZoneTool);
}

canvas.addEventListener('pointerup', (event) => {
  if (authoringTerrainStrokeActive) endAuthoringTerrainStroke(event);
  else if (authoredFeatureOriginal !== null) endAuthoredFeatureDrag(event);
  else if (zoneEditMode && zoneStrokeActive) endZoneStroke(event);
  else endPointerInteraction(event);
});
canvas.addEventListener('pointercancel', (event) => {
  if (authoringTerrainStrokeActive) endAuthoringTerrainStroke(event, true);
  else if (authoredFeatureOriginal !== null) endAuthoredFeatureDrag(event, true);
  else if (zoneEditMode && zoneStrokeActive) endZoneStroke(event, true);
  else endPointerInteraction(event, true);
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const rectangle = canvas.getBoundingClientRect();
  camera.zoomAt(event.clientX - rectangle.left, event.clientY - rectangle.top, Math.exp(-event.deltaY * 0.0015));
  requestRender();
}, { passive: false });
canvas.addEventListener('dblclick', (event) => {
  if (authoringTool === 'polyline' || authoringTool === 'polygon' || authoringTool === 'anchor' || authoringTool === 'point') {
    event.preventDefault();
    return;
  }
  fitCamera();
});
canvas.addEventListener('click', (event) => {
  if (pointerTravel > 5 || editMode || zoneEditMode || authoringTerrainStrokeActive || authoredFeatureOriginal !== null || dragPreview !== null || draggedImageId !== null) return;
  const rectangle = canvas.getBoundingClientRect();
  const position = camera.screenToWorld(event.clientX - rectangle.left, event.clientY - rectangle.top);
  if (authoringTool !== 'select' && handleAuthoringMapClick(position.x, position.y)) return;
  if (setTravelPointFromMap(position.x, position.y)) return;
  inspectMapPosition(position.x, position.y);
});
