import './styles.css';

import { AssetRepository, loadImage, readFileAsDataUrl } from './customization/AssetRepository';
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
  type StoryPositionOverride,
  type StoryRuleOverride,
  type ZoneOverride,
} from './engine/generation/GenerationOptions';
import { Camera } from './engine/renderer/Camera';
import { CanvasRenderer } from './engine/renderer/CanvasRenderer';
import { RenderLayer } from './engine/renderer/Layers';
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
import { WaterType } from './engine/world/Tile';
import { DevelopmentLevel, ISLAND_ROLE_LABELS, IslandRole, type IslandOverride } from './engine/regional/Island';
import { BRIDGE_TYPE_LABELS, BridgeType, type BridgeOverride, type CustomBridgeDefinition } from './engine/infrastructure/Bridge';
import { RoadType } from './engine/infrastructure/Road';
import { PORT_TYPE_LABELS, PortType, type PortOverride, type CustomPortDefinition } from './engine/infrastructure/Port';
import { MaritimeDanger, VESSEL_CLASS_LABELS, VesselClass, WATER_ROUTE_TYPE_LABELS, WaterRouteType, type WaterRouteOverride, type CustomWaterRouteDefinition, type MaritimeEncounter } from './engine/infrastructure/WaterRoute';
import { brushIndices, floodFillIndices, rectangleIndices, setZoneOverrides, smoothZoneOverrides, type ZoneTool } from './editor/ZoneEditor';
import { HistoryManager } from './editor/HistoryManager';
import type { World } from './engine/world/World';
import { ZoneType } from './engine/zoning/Zone';
import { pickWeightedEncounter } from './story/EncounterGenerator';
import { EncounterDanger, StoryObjectSource, StoryObjectType, type CustomStoryPointDefinition, type StoryEncounterDefinition } from './story/StoryObject';

const ANCHOR_STORAGE_KEY = 'payaw.anchor-rules.v2';
const PROFILE_STORAGE_KEY = 'payaw.generation-profile.v1';
const NAME_STORAGE_KEY = 'payaw.place-names.v1';
const MAP_CUSTOMIZATION_STORAGE_KEY = 'payaw.map-customization.v2';
const LABEL_STORAGE_KEY = 'payaw.label-display.v1';
const MAX_CUSTOM_ANCHORS = 12;
const CUSTOM_STORY_STORAGE_KEY = 'payaw.custom-story-points.v1';
const MAX_CUSTOM_STORY_POINTS = 24;
const WORKSPACE_STORAGE_KEY = 'payaw.workspace.v1';

interface StoredAnchorState {
  readonly customAnchors: readonly CustomAnchorDefinition[];
  readonly builtInOverrides: readonly BuiltInAnchorOverride[];
}

interface StoredProfile {
  readonly terrainSize: TerrainSize;
  readonly townScale: TownScale;
  readonly terrainShape: TerrainShape;
  readonly climatePreset: ClimatePreset;
}

interface StoredNameState {
  readonly roads: readonly EntityNameOverride[];
  readonly blocks: readonly EntityNameOverride[];
}

type NameStateByWorld = Readonly<Record<string, StoredNameState>>;
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

function downloadWorld(
  world: World,
  customization: StoredMapCustomization,
  assets: readonly ImportedImageAsset[],
  labels: LabelDisplaySettings,
  customStoryPoints: readonly CustomStoryPointDefinition[],
): void {
  const json = JSON.stringify({
    ...world.toJSON(),
    customization: {
      ...customization,
      imageAssets: assets,
      labelDisplay: labels,
      customStoryPoints,
    },
  }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${world.seed.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.world.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function parseRuleSettings(value: unknown): AnchorRuleSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Partial<AnchorRuleSettings>;
  const builtInTargets = [...BUILT_IN_ANCHOR_TYPES];
  const zoneValues = Object.values(ZoneType);
  if (
    typeof item.name !== 'string'
    || item.name.trim().length === 0
    || !isEnumValue(Object.values(AnchorRegionPreference), item.region)
    || !isEnumValue(Object.values(AnchorTerrainPreference), item.terrain)
    || (item.targetAnchor !== null && !isEnumValue(builtInTargets, item.targetAnchor))
    || !isEnumValue(Object.values(AnchorProximityBand), item.proximity)
    || typeof item.radius !== 'number'
    || !Number.isFinite(item.radius)
    || typeof item.minimumDistance !== 'number'
    || !Number.isFinite(item.minimumDistance)
    || (item.zoneType !== null && !isEnumValue(zoneValues, item.zoneType))
  ) return undefined;
  return {
    name: item.name.trim(),
    region: item.region,
    terrain: item.terrain,
    targetAnchor: item.targetAnchor,
    proximity: item.proximity,
    radius: item.radius,
    minimumDistance: item.minimumDistance,
    zoneType: item.zoneType,
  };
}

function loadAnchorState(): StoredAnchorState {
  try {
    const raw = localStorage.getItem(ANCHOR_STORAGE_KEY);
    if (raw === null) return { customAnchors: [], builtInOverrides: [] };
    const parsed = JSON.parse(raw) as { customAnchors?: unknown; builtInOverrides?: unknown };
    const customAnchors = Array.isArray(parsed.customAnchors)
      ? parsed.customAnchors.flatMap((value) => {
        const settings = parseRuleSettings(value);
        const id = typeof (value as { id?: unknown })?.id === 'string' ? (value as { id: string }).id : undefined;
        return settings === undefined || id === undefined ? [] : [{ id, ...settings }];
      }).slice(0, MAX_CUSTOM_ANCHORS)
      : [];
    const builtInOverrides = Array.isArray(parsed.builtInOverrides)
      ? parsed.builtInOverrides.flatMap((value) => {
        const settings = parseRuleSettings(value);
        const type = (value as { type?: unknown })?.type;
        return settings === undefined || !isEnumValue(BUILT_IN_ANCHOR_TYPES, type)
          ? []
          : [{ type, ...settings }];
      })
      : [];
    return { customAnchors, builtInOverrides };
  } catch {
    return { customAnchors: [], builtInOverrides: [] };
  }
}

function saveAnchorState(customAnchors: readonly CustomAnchorDefinition[], builtInOverrides: readonly BuiltInAnchorOverride[]): void {
  localStorage.setItem(ANCHOR_STORAGE_KEY, JSON.stringify({ customAnchors, builtInOverrides }));
}

function finiteSetting(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeLabelSettings(value: unknown): LabelDisplaySettings {
  const root = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const road = typeof root.road === 'object' && root.road !== null ? root.road as Record<string, unknown> : {};
  const block = typeof root.block === 'object' && root.block !== null ? root.block as Record<string, unknown> : {};
  const defaults = DEFAULT_LABEL_DISPLAY_SETTINGS;
  return {
    road: {
      visible: booleanSetting(road.visible, defaults.road.visible),
      fontSizePx: finiteSetting(road.fontSizePx, defaults.road.fontSizePx, 4, 24),
      opacity: finiteSetting(road.opacity, defaults.road.opacity, 0, 1),
      density: finiteSetting(road.density, defaults.road.density, 0, 1),
      showMain: booleanSetting(road.showMain, defaults.road.showMain),
      showSecondary: booleanSetting(road.showSecondary, defaults.road.showSecondary),
      showLocal: booleanSetting(road.showLocal, defaults.road.showLocal),
      mainMinZoom: finiteSetting(road.mainMinZoom, defaults.road.mainMinZoom, 0.5, 12),
      secondaryMinZoom: finiteSetting(road.secondaryMinZoom, defaults.road.secondaryMinZoom, 0.5, 12),
      localMinZoom: finiteSetting(road.localMinZoom, defaults.road.localMinZoom, 0.5, 12),
      rotateAlongRoad: booleanSetting(road.rotateAlongRoad, defaults.road.rotateAlongRoad),
      outline: booleanSetting(road.outline, defaults.road.outline),
    },
    block: {
      visible: booleanSetting(block.visible, defaults.block.visible),
      fontSizePx: finiteSetting(block.fontSizePx, defaults.block.fontSizePx, 4, 24),
      opacity: finiteSetting(block.opacity, defaults.block.opacity, 0, 1),
      density: finiteSetting(block.density, defaults.block.density, 0, 1),
      minZoom: finiteSetting(block.minZoom, defaults.block.minZoom, 0.5, 12),
      outline: booleanSetting(block.outline, defaults.block.outline),
    },
    avoidCollisions: booleanSetting(root.avoidCollisions, defaults.avoidCollisions),
  };
}

function loadLabelSettings(): LabelDisplaySettings {
  try {
    const raw = localStorage.getItem(LABEL_STORAGE_KEY);
    return raw === null ? DEFAULT_LABEL_DISPLAY_SETTINGS : normalizeLabelSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_LABEL_DISPLAY_SETTINGS;
  }
}

function saveLabelSettings(settings: LabelDisplaySettings): void {
  localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(settings));
}

function loadProfile(): StoredProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw === null) return { terrainSize: TerrainSize.Small, townScale: TownScale.SemiUrban, terrainShape: TerrainShape.FullIsland, climatePreset: ClimatePreset.TropicalMonsoon };
    const value = JSON.parse(raw) as Partial<StoredProfile>;
    return {
      terrainSize: isEnumValue(Object.values(TerrainSize), value.terrainSize) ? value.terrainSize : TerrainSize.Small,
      townScale: isEnumValue(Object.values(TownScale), value.townScale) ? value.townScale : TownScale.SemiUrban,
      terrainShape: isEnumValue(Object.values(TerrainShape), value.terrainShape) ? value.terrainShape : TerrainShape.FullIsland,
      climatePreset: isEnumValue(Object.values(ClimatePreset), value.climatePreset) ? value.climatePreset : ClimatePreset.TropicalMonsoon,
    };
  } catch {
    return { terrainSize: TerrainSize.Small, townScale: TownScale.SemiUrban, terrainShape: TerrainShape.FullIsland, climatePreset: ClimatePreset.TropicalMonsoon };
  }
}

function saveProfile(profile: StoredProfile): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}


function validEncounterDanger(value: unknown): value is EncounterDanger {
  return typeof value === 'string' && Object.values(EncounterDanger).includes(value as EncounterDanger);
}

function normalizeEncounter(value: unknown, index: number): StoryEncounterDefinition | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Partial<StoryEncounterDefinition>;
  if (typeof item.title !== 'string' || item.title.trim().length === 0 || typeof item.description !== 'string') return undefined;
  return {
    id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `encounter-${index + 1}`,
    title: item.title.trim(),
    description: item.description.trim(),
    weight: finiteSetting(item.weight, 1, 0.05, 100),
    danger: validEncounterDanger(item.danger) ? item.danger : EncounterDanger.Low,
  };
}

function parseEncounterLines(value: string): StoryEncounterDefinition[] {
  return value.split(/\r?\n/).flatMap((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return [];
    const [weightText = '1', dangerText = EncounterDanger.Low, titleText = 'Encounter', ...descriptionParts] = trimmed.split('|').map((part) => part.trim());
    const weight = finiteSetting(Number(weightText), 1, 0.05, 100);
    const danger = validEncounterDanger(dangerText) ? dangerText : EncounterDanger.Low;
    const title = titleText.length > 0 ? titleText : `Encounter ${index + 1}`;
    const description = descriptionParts.join(' | ').trim() || 'Something strange happens at the story point.';
    return [{ id: `authored-${index + 1}`, title, description, weight, danger }];
  });
}

function formatEncounterLines(encounters: readonly StoryEncounterDefinition[]): string {
  return encounters.map((encounter) => `${encounter.weight} | ${encounter.danger} | ${encounter.title} | ${encounter.description}`).join('\n');
}

function normalizeCustomStoryDefinition(value: unknown): CustomStoryPointDefinition | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Partial<CustomStoryPointDefinition>;
  const zoneValues = Object.values(ZoneType);
  if (
    typeof item.id !== 'string'
    || typeof item.name !== 'string'
    || item.name.trim().length === 0
    || !isEnumValue(Object.values(StoryObjectType), item.type)
    || !isEnumValue(Object.values(AnchorRegionPreference), item.region)
    || !isEnumValue(Object.values(AnchorTerrainPreference), item.terrain)
    || (item.preferredZone !== null && item.preferredZone !== undefined && !isEnumValue(zoneValues, item.preferredZone))
  ) return undefined;
  const allowedZones = Array.isArray(item.allowedZones) ? item.allowedZones.filter((zone): zone is ZoneType => isEnumValue(zoneValues, zone)) : [];
  const disallowedZones = Array.isArray(item.disallowedZones) ? item.disallowedZones.filter((zone): zone is ZoneType => isEnumValue(zoneValues, zone)) : [];
  const encounters = Array.isArray(item.encounters)
    ? item.encounters.flatMap((encounter, index) => normalizeEncounter(encounter, index) ?? [])
    : [];
  return {
    id: item.id,
    name: item.name.trim(),
    type: item.type,
    region: item.region,
    terrain: item.terrain,
    preferredZone: item.preferredZone ?? null,
    allowedZones,
    disallowedZones: disallowedZones.filter((zone) => !allowedZones.includes(zone)),
    influenceRadius: finiteSetting(item.influenceRadius, 10, 2, 40),
    minimumDistance: finiteSetting(item.minimumDistance, 12, 4, 80),
    ...(typeof item.wish === 'string' && item.wish.trim().length > 0 ? { wish: item.wish.trim() } : {}),
    ...(typeof item.manifestation === 'string' && item.manifestation.trim().length > 0 ? { manifestation: item.manifestation.trim() } : {}),
    encounters,
  };
}

function loadCustomStoryDefinitions(): CustomStoryPointDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORY_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.flatMap((value) => normalizeCustomStoryDefinition(value) ?? []).slice(0, MAX_CUSTOM_STORY_POINTS)
      : [];
  } catch {
    return [];
  }
}

function saveCustomStoryDefinitions(definitions: readonly CustomStoryPointDefinition[]): void {
  localStorage.setItem(CUSTOM_STORY_STORAGE_KEY, JSON.stringify(definitions));
}

function loadAllNameStates(): NameStateByWorld {
  try {
    const raw = localStorage.getItem(NAME_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed as NameStateByWorld : {};
  } catch {
    return {};
  }
}

function validNameOverrides(values: readonly EntityNameOverride[] | undefined): EntityNameOverride[] {
  return (values ?? []).filter((value) => Number.isInteger(value.id) && value.id >= 0 && value.name.trim().length > 0);
}

function loadNameState(signature: string): StoredNameState {
  const stored = loadAllNameStates()[signature];
  return {
    roads: validNameOverrides(stored?.roads),
    blocks: validNameOverrides(stored?.blocks),
  };
}

function saveNameState(signature: string, state: StoredNameState): void {
  const all = { ...loadAllNameStates(), [signature]: state };
  localStorage.setItem(NAME_STORAGE_KEY, JSON.stringify(all));
}

function emptyMapCustomization(): StoredMapCustomization {
  return { anchorPositions: [], storyPositions: [], storyRules: [], zoneOverrides: [], placedImages: [], islandOverrides: [], bridgeOverrides: [], customBridges: [], portOverrides: [], customPorts: [], waterRouteOverrides: [], customWaterRoutes: [] };
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

function loadMapCustomization(signature: string): StoredMapCustomization {
  const stored = loadAllMapCustomizations()[signature];
  if (stored === undefined) return emptyMapCustomization();
  const anchorPositions = Array.isArray(stored.anchorPositions)
    ? stored.anchorPositions.filter((item) => typeof item.key === 'string' && Number.isFinite(item.x) && Number.isFinite(item.y))
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
  const waterRouteOverrides = Array.isArray(stored.waterRouteOverrides)
    ? stored.waterRouteOverrides.filter((item) => (
      typeof item.key === 'string'
      && (item.name === undefined || typeof item.name === 'string')
      && (item.type === undefined || isEnumValue(Object.values(WaterRouteType), item.type))
      && (item.vesselClass === undefined || isEnumValue(Object.values(VesselClass), item.vesselClass))
      && (item.estimatedTravelTimeMinutes === undefined || Number.isFinite(item.estimatedTravelTimeMinutes))
      && (item.dangerRating === undefined || Number.isFinite(item.dangerRating))
      && (item.enabled === undefined || typeof item.enabled === 'boolean')
      && (item.locked === undefined || typeof item.locked === 'boolean')
      && (item.suppressed === undefined || typeof item.suppressed === 'boolean')
    )) : [];
  const customWaterRoutes = Array.isArray(stored.customWaterRoutes)
    ? stored.customWaterRoutes.filter((item) => (
      typeof item.key === 'string'
      && typeof item.name === 'string'
      && typeof item.fromPortKey === 'string'
      && typeof item.toPortKey === 'string'
      && isEnumValue(Object.values(WaterRouteType), item.type)
      && isEnumValue(Object.values(VesselClass), item.vesselClass)
      && typeof item.enabled === 'boolean'
      && typeof item.locked === 'boolean'
    )) : [];
  return { anchorPositions, storyPositions, storyRules, zoneOverrides, placedImages, islandOverrides, bridgeOverrides, customBridges, portOverrides, customPorts, waterRouteOverrides, customWaterRoutes };
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
    ['Dimensions', `${world.width} × ${world.height}`],
    ['Land', `${((landTiles / world.tiles.length) * 100).toFixed(1)}%`],
    ['Landmasses', world.landmasses.length.toLocaleString()],
    ['Islands', world.islands.length.toLocaleString()],
    ['Settlements', world.settlements.length.toLocaleString()],
    ['Regional population', world.islands.reduce((sum, island) => sum + island.allocatedPopulation, 0).toLocaleString()],
    ['Rivers', `${world.rivers.length} · ${riverTiles.toLocaleString()} tiles`],
    ['Floodplain', `${floodplainTiles.toLocaleString()} tiles`],
    ['Anchors', world.anchors.length.toLocaleString()],
    ['Roads', world.roads.length.toLocaleString()],
    ['Bridges', world.bridges.length.toLocaleString()],
    ['Ports', world.ports.length.toLocaleString()],
    ['Water routes', world.waterRoutes.length.toLocaleString()],
    ['Maritime travel', `${world.waterRoutes.filter((route) => route.enabled).reduce((sum, route) => sum + route.estimatedTravelTimeMinutes, 0).toFixed(0)} total min`],
    ['Blocks', world.blocks.length.toLocaleString()],
    ['Zones', world.zones.length.toLocaleString()],
    ['Zone overrides', zoneOverrides.length.toLocaleString()],
    ['Buildings', world.buildings.length.toLocaleString()],
    ['Vegetation', world.vegetation.length.toLocaleString()],
    ['Story sites', world.storyObjects.length.toLocaleString()],
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
const profileHint = requireElement<HTMLElement>('#profile-hint');
const generateButton = requireElement<HTMLButtonElement>('#generate-button');
const randomSeedButton = requireElement<HTMLButtonElement>('#random-seed-button');
const exportButton = requireElement<HTMLButtonElement>('#export-button');
const exportImageButton = requireElement<HTMLButtonElement>('#export-image-button');
const imageExportScale = requireElement<HTMLSelectElement>('#image-export-scale');
const imageExportPadding = requireElement<HTMLSelectElement>('#image-export-padding');
const exportCustomizationButton = requireElement<HTMLButtonElement>('#export-customization-button');
const customizationImportFile = requireElement<HTMLInputElement>('#customization-import-file');
const fitMapButton = requireElement<HTMLButtonElement>('#fit-map-button');
const viewPreset = requireElement<HTMLSelectElement>('#view-preset');
const statusMessage = requireElement<HTMLElement>('#generation-status');
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
const islandCount = requireElement<HTMLElement>('#island-count');
const islandList = requireElement<HTMLElement>('#island-list');
const regionalSummary = requireElement<HTMLElement>('#regional-summary');
const islandResetAll = requireElement<HTMLButtonElement>('#island-reset-all');
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
const waterRouteCount = requireElement<HTMLElement>('#water-route-count');
const waterRouteSummary = requireElement<HTMLElement>('#water-route-summary');
const waterRouteList = requireElement<HTMLElement>('#water-route-list');
const waterRouteForm = requireElement<HTMLFormElement>('#water-route-form');
const waterRouteName = requireElement<HTMLInputElement>('#water-route-name');
const waterRouteFromPort = requireElement<HTMLSelectElement>('#water-route-from-port');
const waterRouteToPort = requireElement<HTMLSelectElement>('#water-route-to-port');
const waterRouteType = requireElement<HTMLSelectElement>('#water-route-type');
const waterRouteVessel = requireElement<HTMLSelectElement>('#water-route-vessel');
const waterRouteResetAll = requireElement<HTMLButtonElement>('#water-route-reset-all');
const dmMaritimeList = requireElement<HTMLElement>('#dm-maritime-list');
const dmMaritimeResult = requireElement<HTMLElement>('#dm-maritime-result');

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
  [RenderLayer.WaterRoutes]: requireElement<HTMLInputElement>('#water-route-layer'),
  [RenderLayer.WaterRouteLabels]: requireElement<HTMLInputElement>('#water-route-label-layer'),
  [RenderLayer.RoadLabels]: requireElement<HTMLInputElement>('#road-label-layer'),
  [RenderLayer.Buildings]: requireElement<HTMLInputElement>('#building-layer'),
  [RenderLayer.CustomImages]: requireElement<HTMLInputElement>('#custom-image-layer'),
  [RenderLayer.Vegetation]: requireElement<HTMLInputElement>('#vegetation-layer'),
  [RenderLayer.Anchors]: requireElement<HTMLInputElement>('#anchor-layer'),
  [RenderLayer.Story]: requireElement<HTMLInputElement>('#story-layer'),
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

const VIEW_PRESETS: Readonly<Record<string, readonly RenderLayer[]>> = {
  town: [RenderLayer.Terrain, RenderLayer.Islands, RenderLayer.IslandLabels, RenderLayer.Settlements, RenderLayer.Zones, RenderLayer.Blocks, RenderLayer.BlockLabels, RenderLayer.Rivers, RenderLayer.Roads, RenderLayer.Bridges, RenderLayer.BridgeLabels, RenderLayer.Ports, RenderLayer.PortLabels, RenderLayer.WaterRoutes, RenderLayer.WaterRouteLabels, RenderLayer.RoadLabels, RenderLayer.Buildings, RenderLayer.CustomImages, RenderLayer.Vegetation, RenderLayer.Anchors, RenderLayer.Story],
  story: [RenderLayer.Terrain, RenderLayer.Islands, RenderLayer.IslandLabels, RenderLayer.Settlements, RenderLayer.Rivers, RenderLayer.Roads, RenderLayer.Bridges, RenderLayer.BridgeLabels, RenderLayer.Ports, RenderLayer.PortLabels, RenderLayer.WaterRoutes, RenderLayer.WaterRouteLabels, RenderLayer.RoadLabels, RenderLayer.Buildings, RenderLayer.CustomImages, RenderLayer.Vegetation, RenderLayer.Anchors, RenderLayer.Story],
  terrain: [RenderLayer.Terrain, RenderLayer.Elevation, RenderLayer.Rivers, RenderLayer.Islands, RenderLayer.IslandLabels, RenderLayer.Bridges, RenderLayer.Ports, RenderLayer.WaterRoutes],
  hydrology: [RenderLayer.Terrain, RenderLayer.Floodplains, RenderLayer.Rivers, RenderLayer.Islands, RenderLayer.Bridges, RenderLayer.Ports, RenderLayer.WaterRoutes],
  planning: [RenderLayer.Terrain, RenderLayer.Islands, RenderLayer.IslandLabels, RenderLayer.Settlements, RenderLayer.Accessibility, RenderLayer.LandValue, RenderLayer.Zones, RenderLayer.Blocks, RenderLayer.BlockLabels, RenderLayer.Roads, RenderLayer.Bridges, RenderLayer.BridgeLabels, RenderLayer.Ports, RenderLayer.PortLabels, RenderLayer.WaterRoutes, RenderLayer.WaterRouteLabels, RenderLayer.RoadLabels, RenderLayer.Anchors],
};

const pipeline = new GenerationPipeline();
const renderer = new CanvasRenderer(canvas);
const camera = new Camera();
const assetRepository = new AssetRepository();
const defaultBuiltIns = createDefaultBuiltInAnchorDefinitions(DEFAULT_GENERATION_CONFIG.anchors);
const profile = loadProfile();
terrainSizeSelect.value = profile.terrainSize;
townScaleSelect.value = profile.townScale;
terrainShapeSelect.value = profile.terrainShape;
climatePresetSelect.value = profile.climatePreset;
const storedAnchors = loadAnchorState();
let customAnchors = [...storedAnchors.customAnchors];
let builtInOverrides = [...storedAnchors.builtInOverrides];
let customStoryDefinitions = loadCustomStoryDefinitions();
let roadNameOverrides: EntityNameOverride[] = [];
let blockNameOverrides: EntityNameOverride[] = [];
let labelSettings: LabelDisplaySettings = loadLabelSettings();
let anchorPositionOverrides: AnchorPositionOverride[] = [];
let storyPositionOverrides: StoryPositionOverride[] = [];
let storyRuleOverrides: StoryRuleOverride[] = [];
let zoneOverrides: ZoneOverride[] = [];
let islandOverrides: IslandOverride[] = [];
let bridgeOverrides: BridgeOverride[] = [];
let customBridges: CustomBridgeDefinition[] = [];
let portOverrides: PortOverride[] = [];
let customPorts: CustomPortDefinition[] = [];
let waterRouteOverrides: WaterRouteOverride[] = [];
let customWaterRoutes: CustomWaterRouteDefinition[] = [];
let placedImages: PlacedImage[] = [];
let importedAssets: ImportedImageAsset[] = [];
let runtimeImageAssets: RuntimeImageAsset[] = [];
let world: World;
let activeWorldSignature = '';
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
let dragPreview: { kind: 'anchor' | 'story'; key: string; x: number; y: number } | null = null;
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
let activeWorkspace: WorkspaceMode = localStorage.getItem(WORKSPACE_STORAGE_KEY) === 'dm' ? 'dm' : 'editor';
let dmSessionEntries: DmSessionEntry[] = [];

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

function selectedTerrainSize(): TerrainSize {
  return terrainSizeSelect.value as TerrainSize;
}

function selectedTownScale(): TownScale {
  return townScaleSelect.value as TownScale;
}

function selectedTerrainShape(): TerrainShape { return terrainShapeSelect.value as TerrainShape; }
function selectedClimatePreset(): ClimatePreset { return climatePresetSelect.value as ClimatePreset; }

function worldSignature(): string {
  return `${seedInput.value.trim()}|${selectedTerrainSize()}|${selectedTownScale()}|${selectedTerrainShape()}|${selectedClimatePreset()}`;
}

function generationOptions(
  candidateCustom: readonly CustomAnchorDefinition[] = customAnchors,
  candidateBuiltIns: readonly BuiltInAnchorOverride[] = builtInOverrides,
  candidateAnchorPositions: readonly AnchorPositionOverride[] = anchorPositionOverrides,
  candidateStoryPositions: readonly StoryPositionOverride[] = storyPositionOverrides,
): GenerationOptions {
  return {
    customAnchors: candidateCustom,
    builtInAnchorOverrides: candidateBuiltIns,
    terrainSize: selectedTerrainSize(),
    townScale: selectedTownScale(),
    terrainShape: selectedTerrainShape(),
    climatePreset: selectedClimatePreset(),
    roadNameOverrides,
    blockNameOverrides,
    anchorPositionOverrides: candidateAnchorPositions,
    storyPositionOverrides: candidateStoryPositions,
    storyRuleOverrides,
    zoneOverrides,
    customStoryPoints: customStoryDefinitions,
    islandOverrides,
    bridgeOverrides,
    customBridges,
    portOverrides,
    customPorts,
    waterRouteOverrides,
    customWaterRoutes,
  };
}

function currentMapCustomization(): StoredMapCustomization {
  return {
    anchorPositions: anchorPositionOverrides,
    storyPositions: storyPositionOverrides,
    storyRules: storyRuleOverrides,
    zoneOverrides,
    placedImages,
    islandOverrides,
    bridgeOverrides,
    customBridges,
    portOverrides,
    customPorts,
    waterRouteOverrides,
    customWaterRoutes,
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
  storyPositionOverrides = [...snapshot.mapCustomization.storyPositions];
  storyRuleOverrides = [...snapshot.mapCustomization.storyRules];
  zoneOverrides = [...snapshot.mapCustomization.zoneOverrides];
  placedImages = [...snapshot.mapCustomization.placedImages];
  islandOverrides = [...snapshot.mapCustomization.islandOverrides];
  bridgeOverrides = [...snapshot.mapCustomization.bridgeOverrides];
  customBridges = [...snapshot.mapCustomization.customBridges];
  portOverrides = [...snapshot.mapCustomization.portOverrides];
  customPorts = [...snapshot.mapCustomization.customPorts];
  waterRouteOverrides = [...snapshot.mapCustomization.waterRouteOverrides];
  customWaterRoutes = [...snapshot.mapCustomization.customWaterRoutes];
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

function setStatus(message: string, state: 'success' | 'warning' | 'error' | 'working' | 'idle' = 'idle'): void {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

function fitCamera(): void {
  camera.fit(world.width, world.height, canvas.clientWidth, canvas.clientHeight);
  requestRender();
}

function updateProfileHint(): void {
  const terrain = selectedTerrainSize();
  const town = selectedTownScale();
  const terrainText = terrain === TerrainSize.Small ? 'compact 256×192 terrain' : terrain === TerrainSize.Medium ? 'expanded 320×240 terrain' : 'regional 384×288 terrain';
  const townText = town === TownScale.Rural ? 'sparse roads and low building occupancy' : town === TownScale.SemiUrban ? 'balanced roads, blocks, and buildings' : 'dense roads, tighter blocks, and high occupancy';
  const shapeText = terrainShapeSelect.selectedOptions[0]?.textContent ?? selectedTerrainShape();
  const climateText = climatePresetSelect.selectedOptions[0]?.textContent ?? selectedClimatePreset();
  profileHint.textContent = `${shapeText}, ${climateText.toLowerCase()}, ${terrainText}, with ${townText}.`;
}

function updateMapHeader(): void {
  mapTitle.textContent = world.seed;
  mapSubtitle.textContent = `${world.metadata.terrainShape} · ${world.metadata.climatePreset} · ${world.metadata.terrainSize} terrain · ${world.metadata.townScale} town · ${world.islands.length} islands · ${world.bridges.length} bridges · ${world.ports.length} ports · ${world.waterRoutes.length} water routes · ${world.storyObjects.length} story sites`;
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
  workspaceKicker.textContent = editorActive ? 'World Editor' : 'DM Mode';
  workspaceTitle.textContent = editorActive ? 'Build the world' : 'Run the session';
  workspaceDescription.textContent = editorActive
    ? 'Generation, layout, zoning, assets, labels, and story authoring.'
    : 'Story-site reference, encounter rolls, and a distraction-free session map.';
  mapWorkspaceBadge.textContent = editorActive ? 'EDITOR' : 'DM MODE';
  viewportShell.dataset.workspace = mode;
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

function renderStoryList(): void {
  storyList.replaceChildren();
  for (const item of world.storyObjects) {
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
    actions.append(focus, roll);
    heading.append(title, source, actions);
    const wish = document.createElement('p');
    wish.innerHTML = `<span>Wish</span> ${item.wish}`;
    const manifestation = document.createElement('p');
    manifestation.innerHTML = `<span>Manifestation</span> ${item.manifestation}`;
    const zoning = document.createElement('p');
    const preferred = item.preferredZone === null ? 'none' : item.preferredZone;
    zoning.innerHTML = `<span>Zone</span> ${item.zoneType ?? 'none'} · preferred ${preferred}`;
    const encounterResult = document.createElement('div');
    encounterResult.className = 'encounter-result';
    encounterResult.hidden = true;
    roll.addEventListener('click', () => {
      rollDmEncounter(item, encounterResult);
      encounterResult.hidden = false;
    });
    card.append(heading, wish, manifestation, zoning, encounterResult);
    storyList.append(card);
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
    details.innerHTML = `<span>${definition.type}</span> ${REGION_LABELS[definition.region]} · ${TERRAIN_LABELS[definition.terrain]} · ${definition.encounters.length || 'generated'} encounters`;
    card.append(heading, details);
    customStoryList.append(card);
  }
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
    customization: currentMapCustomization(),
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
  const temporaryKey = `__import__${Date.now()}`;
  saveMapCustomization(temporaryKey, parsed.customization);
  const normalized = loadMapCustomization(temporaryKey);
  const all = { ...loadAllMapCustomizations() } as Record<string, StoredMapCustomization>;
  delete all[temporaryKey];
  localStorage.setItem(MAP_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(all));
  anchorPositionOverrides = [...normalized.anchorPositions];
  storyPositionOverrides = [...normalized.storyPositions];
  storyRuleOverrides = [...normalized.storyRules];
  zoneOverrides = [...normalized.zoneOverrides];
  placedImages = [...normalized.placedImages];
  islandOverrides = [...normalized.islandOverrides];
  bridgeOverrides = [...normalized.bridgeOverrides];
  customBridges = [...normalized.customBridges];
  portOverrides = [...normalized.portOverrides];
  customPorts = [...normalized.customPorts];
  waterRouteOverrides = [...normalized.waterRouteOverrides];
  customWaterRoutes = [...normalized.customWaterRoutes];
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

function replaceIslandOverride(next: IslandOverride): void {
  islandOverrides = [...islandOverrides.filter((item) => item.key !== next.key), next]
    .sort((left, right) => left.key.localeCompare(right.key));
}

function renderIslandList(): void {
  islandCount.textContent = String(world.islands.length);
  const totalPopulation = world.islands.reduce((sum, island) => sum + island.allocatedPopulation, 0);
  const inhabited = world.islands.filter((island) => island.settlementIds.length > 0).length;
  regionalSummary.replaceChildren();
  for (const [label, value] of [
    ['Islands', String(world.islands.length)],
    ['Inhabited', String(inhabited)],
    ['Settlements', String(world.settlements.length)],
    ['Population', formatPopulation(totalPopulation)],
  ] as const) {
    const item = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = value;
    item.append(strong, ` ${label.toLocaleLowerCase()}`);
    regionalSummary.append(item);
  }

  islandList.replaceChildren();
  if (world.islands.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'No viable islands were detected.';
    islandList.append(empty);
    return;
  }

  for (const island of world.islands) {
    const landmass = world.landmasses[island.landmassId];
    if (landmass === undefined) continue;
    const card = document.createElement('article');
    card.className = 'island-item';

    const heading = document.createElement('div');
    heading.className = 'island-item-heading';
    const title = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = island.name;
    const details = document.createElement('small');
    details.textContent = `${ISLAND_ROLE_LABELS[island.role]} · ${formatPopulation(island.allocatedPopulation)} people · ${island.settlementIds.length} settlement${island.settlementIds.length === 1 ? '' : 's'} · ${landmass.area} tiles`;
    title.append(name, details);
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    focus.addEventListener('click', () => focusMapPoint(landmass.centroid.x, landmass.centroid.y));
    heading.append(title, focus);

    const grid = document.createElement('div');
    grid.className = 'island-editor-grid';
    const makeField = (labelText: string, control: HTMLElement): HTMLLabelElement => {
      const label = document.createElement('label');
      label.className = 'form-field';
      const span = document.createElement('span');
      span.textContent = labelText;
      label.append(span, control);
      return label;
    };

    const nameInput = document.createElement('input');
    nameInput.value = island.name;
    nameInput.maxLength = 48;
    grid.append(makeField('Island name', nameInput));

    const roleSelect = document.createElement('select');
    for (const role of Object.values(IslandRole)) {
      const option = document.createElement('option');
      option.value = role;
      option.textContent = ISLAND_ROLE_LABELS[role];
      roleSelect.append(option);
    }
    roleSelect.value = island.role;
    grid.append(makeField('Role', roleSelect));

    const developmentSelect = document.createElement('select');
    for (const level of Object.values(DevelopmentLevel)) {
      const option = document.createElement('option');
      option.value = level;
      option.textContent = level.replaceAll('-', ' ');
      developmentSelect.append(option);
    }
    developmentSelect.value = island.developmentLevel;
    grid.append(makeField('Development', developmentSelect));

    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.min = '0';
    weightInput.max = '10';
    weightInput.step = '0.25';
    weightInput.value = String(island.populationWeight);
    grid.append(makeField('Population weight', weightInput));

    const settlementInput = document.createElement('input');
    settlementInput.type = 'number';
    settlementInput.min = '0';
    settlementInput.max = '6';
    settlementInput.step = '1';
    settlementInput.value = String(island.settlementCountTarget);
    grid.append(makeField('Settlement count', settlementInput));

    const flags = document.createElement('div');
    flags.className = 'island-flags';
    const checkboxes: Array<[string, HTMLInputElement]> = [];
    const addFlag = (labelText: string, checked: boolean): HTMLInputElement => {
      const label = document.createElement('label');
      label.className = 'check-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      const span = document.createElement('span');
      span.textContent = labelText;
      label.append(input, span);
      flags.append(label);
      checkboxes.push([labelText, input]);
      return input;
    };
    const roads = addFlag('Allow roads', island.allowRoads);
    const ports = addFlag('Allow ports', island.allowPorts);
    const bridges = addFlag('Allow future bridges', island.allowBridges);
    const story = addFlag('Allow story points', island.allowStoryPoints);
    const preserve = addFlag('Preserve nature', island.preserveNature);
    const locked = addFlag('Lock island plan', island.locked);

    const actions = document.createElement('div');
    actions.className = 'button-row';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'primary';
    save.textContent = 'Apply island plan';
    save.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      const previous = [...islandOverrides];
      replaceIslandOverride({
        key: island.key,
        name: nameInput.value.trim() || island.name,
        role: roleSelect.value as IslandRole,
        developmentLevel: developmentSelect.value as DevelopmentLevel,
        populationWeight: Number(weightInput.value),
        settlementCount: Number(settlementInput.value),
        allowRoads: roads.checked,
        allowPorts: ports.checked,
        allowBridges: bridges.checked,
        allowStoryPoints: story.checked,
        preserveNature: preserve.checked,
        locked: locked.checked,
      });
      persistMapCustomization();
      if (!regenerateFrom('islands', `Updated ${nameInput.value.trim() || island.name}.`)) {
        islandOverrides = previous;
        persistMapCustomization();
        regenerateFrom('islands', 'Restored the previous island plan.');
        return;
      }
      recordHistory(snapshot, `edit island ${island.name}`);
    });
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset island';
    reset.disabled = !islandOverrides.some((item) => item.key === island.key);
    reset.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      islandOverrides = islandOverrides.filter((item) => item.key !== island.key);
      persistMapCustomization();
      if (regenerateFrom('islands', `Reset ${island.name}.`)) recordHistory(snapshot, `reset island ${island.name}`);
    });
    actions.append(save, reset);
    card.append(heading, grid, flags, actions);
    islandList.append(card);
  }
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

function replaceWaterRouteOverride(next: WaterRouteOverride): void {
  waterRouteOverrides = [...waterRouteOverrides.filter((item) => item.key !== next.key), next]
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

function refreshWaterRoutePortOptions(): void {
  const previousFrom = waterRouteFromPort.value;
  const previousTo = waterRouteToPort.value;
  waterRouteFromPort.replaceChildren();
  waterRouteToPort.replaceChildren();
  for (const port of world.ports) {
    const island = world.islands[port.islandId];
    const label = `${port.name} · ${island?.name ?? 'Unknown island'}`;
    for (const select of [waterRouteFromPort, waterRouteToPort]) {
      const option = document.createElement('option');
      option.value = port.key;
      option.textContent = label;
      select.append(option);
    }
  }
  const fallbackFrom = world.ports[0]?.key ?? '';
  waterRouteFromPort.value = world.ports.some((port) => port.key === previousFrom) ? previousFrom : fallbackFrom;
  const fallbackTo = world.ports.find((port) => port.key !== waterRouteFromPort.value)?.key ?? '';
  waterRouteToPort.value = world.ports.some((port) => port.key === previousTo && port.key !== waterRouteFromPort.value) ? previousTo : fallbackTo;
  const disabled = world.ports.length < 2;
  waterRouteFromPort.disabled = disabled;
  waterRouteToPort.disabled = disabled;
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
  refreshWaterRoutePortOptions();
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
    detail.textContent = `${PORT_TYPE_LABELS[port.type]} · capacity ${port.capacity.toLocaleString()} · ${port.routeIds.length} route${port.routeIds.length === 1 ? '' : 's'}`;
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
        customWaterRoutes = customWaterRoutes.filter((route) => route.fromPortKey !== port.key && route.toPortKey !== port.key);
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

function routeDangerLevel(rating: number): MaritimeDanger {
  if (rating >= 0.82) return MaritimeDanger.Severe;
  if (rating >= 0.58) return MaritimeDanger.High;
  if (rating >= 0.3) return MaritimeDanger.Moderate;
  return MaritimeDanger.Low;
}

function routeMidpoint(route: World['waterRoutes'][number]): { readonly x: number; readonly y: number } {
  const point = route.centerline[Math.floor(route.centerline.length * 0.5)];
  return point ?? world.ports[route.fromPortId]?.waterPosition ?? { x: world.width * 0.5, y: world.height * 0.5 };
}

function pickMaritimeEncounter(entries: readonly MaritimeEncounter[]): MaritimeEncounter | undefined {
  if (entries.length === 0) return undefined;
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return entries[0];
  let cursor = randomUnit() * total;
  for (const entry of entries) {
    cursor -= Math.max(0, entry.weight);
    if (cursor <= 0) return entry;
  }
  return entries[entries.length - 1];
}

function showMaritimeEncounter(route: World['waterRoutes'][number], encounter: MaritimeEncounter | undefined): void {
  dmMaritimeResult.replaceChildren();
  const from = world.ports[route.fromPortId];
  const to = world.ports[route.toPortId];
  const source = document.createElement('span');
  source.className = 'story-source';
  source.textContent = `${route.name} · ${Math.round(route.estimatedTravelTimeMinutes)} min`;
  if (encounter === undefined) {
    const empty = document.createElement('span');
    empty.textContent = 'This route has no maritime encounter entries.';
    dmMaritimeResult.append(source, empty);
    return;
  }
  const title = document.createElement('strong');
  title.textContent = encounter.title;
  const danger = document.createElement('span');
  danger.className = 'danger-badge';
  danger.textContent = encounter.danger;
  const description = document.createElement('p');
  description.textContent = encounter.description;
  const itinerary = document.createElement('small');
  itinerary.textContent = `${from?.name ?? 'Origin'} → ${to?.name ?? 'Destination'} · ${VESSEL_CLASS_LABELS[route.vesselClass]}`;
  dmMaritimeResult.append(source, title, danger, description, itinerary);
  dmSessionEntries = [{
    time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    site: route.name,
    title: encounter.title,
    danger: encounter.danger,
  }, ...dmSessionEntries].slice(0, 12);
  renderDmSessionLog();
}

function renderDmMaritimeList(): void {
  dmMaritimeList.replaceChildren();
  const enabledRoutes = world.waterRoutes.filter((route) => route.enabled);
  if (enabledRoutes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = 'No active water routes are available in this world.';
    dmMaritimeList.append(empty);
    return;
  }
  for (const route of enabledRoutes) {
    const from = world.ports[route.fromPortId];
    const to = world.ports[route.toPortId];
    const card = document.createElement('article');
    card.className = 'dm-maritime-route';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = route.name;
    const detail = document.createElement('small');
    detail.textContent = `${from?.name ?? 'Origin'} → ${to?.name ?? 'Destination'} · ${Math.round(route.estimatedTravelTimeMinutes)} min · ${routeDangerLevel(route.dangerRating)} danger`;
    copy.append(title, detail);
    const actions = document.createElement('div');
    actions.className = 'button-row compact-buttons';
    const focus = document.createElement('button');
    focus.type = 'button'; focus.textContent = 'Focus';
    focus.addEventListener('click', () => {
      const point = routeMidpoint(route);
      focusMapPoint(point.x, point.y);
    });
    const roll = document.createElement('button');
    roll.type = 'button'; roll.className = 'primary'; roll.textContent = 'Roll encounter';
    roll.addEventListener('click', () => showMaritimeEncounter(route, pickMaritimeEncounter(route.encounters)));
    actions.append(focus, roll);
    card.append(copy, actions);
    dmMaritimeList.append(card);
  }
}

function renderWaterRouteList(): void {
  waterRouteCount.textContent = String(world.waterRoutes.length);
  refreshWaterRoutePortOptions();
  const enabledCount = world.waterRoutes.filter((route) => route.enabled).length;
  const totalMinutes = world.waterRoutes.filter((route) => route.enabled).reduce((sum, route) => sum + route.estimatedTravelTimeMinutes, 0);
  const averageDanger = world.waterRoutes.length === 0 ? 0 : world.waterRoutes.reduce((sum, route) => sum + route.dangerRating, 0) / world.waterRoutes.length;
  waterRouteSummary.replaceChildren();
  for (const [label, value] of [
    ['Routes', String(world.waterRoutes.length)],
    ['Active', String(enabledCount)],
    ['Combined travel', `${Math.round(totalMinutes)} min`],
    ['Average danger', `${Math.round(averageDanger * 100)}%`],
  ] as const) {
    const item = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = value;
    item.append(strong, ` ${label.toLocaleLowerCase()}`);
    waterRouteSummary.append(item);
  }

  waterRouteList.replaceChildren();
  if (world.waterRoutes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = world.ports.length < 2 ? 'At least two valid ports are required.' : 'No navigable port pair met the current vessel, depth, and demand constraints.';
    waterRouteList.append(empty);
    renderDmMaritimeList();
    return;
  }

  for (const route of world.waterRoutes) {
    const from = world.ports[route.fromPortId];
    const to = world.ports[route.toPortId];
    const card = document.createElement('article');
    card.className = 'water-route-item';
    const heading = document.createElement('div');
    heading.className = 'maritime-item-heading';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = route.name;
    const details = document.createElement('small');
    details.textContent = `${WATER_ROUTE_TYPE_LABELS[route.type]} · ${VESSEL_CLASS_LABELS[route.vesselClass]} · ${Math.round(route.estimatedTravelTimeMinutes)} min`;
    const chip = document.createElement('span');
    chip.className = 'maritime-route-chip';
    chip.textContent = `${from?.name ?? 'Origin'} → ${to?.name ?? 'Destination'} · ${routeDangerLevel(route.dangerRating)} danger · ${route.generated ? 'generated' : 'custom'}`;
    copy.append(title, details, chip);
    const focus = document.createElement('button');
    focus.type = 'button'; focus.textContent = 'Focus';
    focus.addEventListener('click', () => {
      const point = routeMidpoint(route);
      focusMapPoint(point.x, point.y);
    });
    heading.append(copy, focus);

    const grid = document.createElement('div');
    grid.className = 'maritime-editor-grid';
    const nameInput = document.createElement('input');
    nameInput.value = route.name; nameInput.maxLength = 64;
    const typeSelect = document.createElement('select');
    for (const value of Object.values(WaterRouteType)) {
      const option = document.createElement('option'); option.value = value; option.textContent = WATER_ROUTE_TYPE_LABELS[value]; typeSelect.append(option);
    }
    typeSelect.value = route.type;
    const vesselSelect = document.createElement('select');
    for (const value of Object.values(VesselClass)) {
      const option = document.createElement('option'); option.value = value; option.textContent = VESSEL_CLASS_LABELS[value]; vesselSelect.append(option);
    }
    vesselSelect.value = route.vesselClass;
    const travelInput = document.createElement('input');
    travelInput.type = 'number'; travelInput.min = '2'; travelInput.max = '1440'; travelInput.step = '1'; travelInput.value = String(Math.round(route.estimatedTravelTimeMinutes));
    const dangerInput = document.createElement('input');
    dangerInput.type = 'number'; dangerInput.min = '0'; dangerInput.max = '1'; dangerInput.step = '0.05'; dangerInput.value = route.dangerRating.toFixed(2);
    grid.append(
      maritimeField('Route name', nameInput),
      maritimeField('Type', typeSelect),
      maritimeField('Vessel', vesselSelect),
      maritimeField('Travel minutes', travelInput),
      maritimeField('Danger 0–1', dangerInput),
    );

    const flags = document.createElement('div');
    flags.className = 'check-grid';
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'check-row';
    const enabledInput = document.createElement('input'); enabledInput.type = 'checkbox'; enabledInput.checked = route.enabled;
    const enabledText = document.createElement('span'); enabledText.textContent = 'Route active'; enabledLabel.append(enabledInput, enabledText);
    const lockLabel = document.createElement('label');
    lockLabel.className = 'check-row';
    const lockInput = document.createElement('input'); lockInput.type = 'checkbox'; lockInput.checked = route.locked;
    const lockText = document.createElement('span'); lockText.textContent = 'Lock authored route'; lockLabel.append(lockInput, lockText);
    flags.append(enabledLabel, lockLabel);

    const actions = document.createElement('div');
    actions.className = 'button-row';
    const apply = document.createElement('button');
    apply.type = 'button'; apply.className = 'primary'; apply.textContent = 'Apply route';
    apply.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      const previous = [...waterRouteOverrides];
      replaceWaterRouteOverride({
        key: route.key,
        name: nameInput.value.trim() || route.name,
        type: typeSelect.value as WaterRouteType,
        vesselClass: vesselSelect.value as VesselClass,
        estimatedTravelTimeMinutes: Number(travelInput.value),
        dangerRating: Number(dangerInput.value),
        enabled: enabledInput.checked,
        locked: lockInput.checked,
      });
      persistMapCustomization();
      if (regenerateFrom('water-routes', `Updated ${nameInput.value.trim() || route.name}.`)) {
        recordHistory(snapshot, `edit water route ${route.name}`);
        return;
      }
      waterRouteOverrides = previous;
      persistMapCustomization();
      regenerateFrom('water-routes', 'Restored the previous water-route network.');
    });
    const roll = document.createElement('button');
    roll.type = 'button'; roll.textContent = 'Roll encounter';
    roll.addEventListener('click', () => showMaritimeEncounter(route, pickMaritimeEncounter(route.encounters)));
    const reset = document.createElement('button');
    reset.type = 'button'; reset.textContent = 'Reset edits';
    reset.disabled = !waterRouteOverrides.some((item) => item.key === route.key);
    reset.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      waterRouteOverrides = waterRouteOverrides.filter((item) => item.key !== route.key);
      persistMapCustomization();
      if (regenerateFrom('water-routes', `Reset ${route.name}.`)) recordHistory(snapshot, `reset water route ${route.name}`);
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'danger'; remove.textContent = route.generated ? 'Suppress generated route' : 'Delete custom route';
    remove.addEventListener('click', () => {
      const snapshot = captureEditorSnapshot();
      if (route.generated) replaceWaterRouteOverride({ key: route.key, suppressed: true });
      else {
        customWaterRoutes = customWaterRoutes.filter((item) => item.key !== route.key);
        waterRouteOverrides = waterRouteOverrides.filter((item) => item.key !== route.key);
      }
      persistMapCustomization();
      if (regenerateFrom('water-routes', `${route.generated ? 'Suppressed' : 'Deleted'} ${route.name}.`)) {
        recordHistory(snapshot, `${route.generated ? 'suppress' : 'delete'} water route ${route.name}`);
      }
    });
    actions.append(apply, roll, reset, remove);
    card.append(heading, grid, flags, actions);
    waterRouteList.append(card);
  }
  renderDmMaritimeList();
}

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

function refreshWorldUi(fitAfter = false): void {
  renderer.rebuildCache(world);
  syncRendererCustomization();
  updateStats(stats, world);
  updateMapHeader();
  renderIslandList();
  renderBridgeList();
  renderPortList();
  renderWaterRouteList();
  renderAnchorList();
  renderNameEditors();
  renderStoryList();
  renderStoryRuleEditor();
  renderCustomStoryList();
  updateZoneEditorUi();
  renderPlacedImageList();
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
    const maximumAttempts = mapCustomization.anchorPositions.length + mapCustomization.storyPositions.length + 1;

    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      try {
        nextWorld = pipeline.generate(seedInput.value, {
          ...generationOptions(
            candidateCustom,
            candidateBuiltIns,
            mapCustomization.anchorPositions,
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
          waterRouteOverrides: mapCustomization.waterRouteOverrides,
          customWaterRoutes: mapCustomization.customWaterRoutes,
        });
        break;
      } catch (error) {
        if (!(error instanceof InvalidPositionOverrideError)) throw error;
        const recovered = recoverPositionOverrides(
          mapCustomization.anchorPositions,
          mapCustomization.storyPositions,
          error,
        );
        if (!recovered.removed) throw error;
        mapCustomization = {
          ...mapCustomization,
          anchorPositions: recovered.anchorPositions,
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
    storyPositionOverrides = [...mapCustomization.storyPositions];
    storyRuleOverrides = [...mapCustomization.storyRules];
    zoneOverrides = [...mapCustomization.zoneOverrides];
    placedImages = [...mapCustomization.placedImages];
    islandOverrides = [...mapCustomization.islandOverrides];
    bridgeOverrides = [...mapCustomization.bridgeOverrides];
    customBridges = [...mapCustomization.customBridges];
    portOverrides = [...mapCustomization.portOverrides];
    customPorts = [...mapCustomization.customPorts];
    waterRouteOverrides = [...mapCustomization.waterRouteOverrides];
    customWaterRoutes = [...mapCustomization.customWaterRoutes];

    // Persist the repaired state so the same stale override cannot block the
    // next load. Only invalid position records are removed; names, zoning,
    // assets, transport authoring, and every valid moved object are preserved.
    if (recoveredOverrides.length > 0) saveMapCustomization(signature, mapCustomization);

    refreshWorldUi(fitAfter);
    saveProfile({ terrainSize: selectedTerrainSize(), townScale: selectedTownScale(), terrainShape: selectedTerrainShape(), climatePreset: selectedClimatePreset() });
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

function regenerateFrom(stageId: string, successMessage: string): boolean {
  setStatus('Updating authored world…', 'working');
  try {
    pipeline.regenerateFrom(world, stageId, generationOptions());
    refreshWorldUi(false);
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
  if (anchorPositionOverrides.length === 0 && storyPositionOverrides.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previousAnchors = anchorPositionOverrides;
  const previousStories = storyPositionOverrides;
  anchorPositionOverrides = [];
  storyPositionOverrides = [];
  persistMapCustomization();
  if (regenerateFrom('anchor-placement', 'Reset moved anchors and story sites.')) {
    recordHistory(snapshot, 'reset moved objects');
    return;
  }
  anchorPositionOverrides = previousAnchors;
  storyPositionOverrides = previousStories;
  persistMapCustomization();
  regenerateFrom('anchor-placement', 'Restored moved objects.');
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
}

function applyViewPreset(name: string): void {
  const visible = VIEW_PRESETS[name];
  if (visible === undefined) return;
  const selected = new Set(visible);
  for (const layer of Object.values(RenderLayer)) setLayer(layer, selected.has(layer));
  requestRender();
}

function setEditMode(enabled: boolean): void {
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

function hitMovableObject(x: number, y: number): { kind: 'anchor' | 'story' | 'image'; key: string } | null {
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
  if (renderRequested) {
    renderer.render(world, camera);
    renderRequested = false;
  }
  window.requestAnimationFrame(animationFrame);
}

applyLabelSettingsToControls(labelSettings);
updateProfileHint();
if (!generate(customAnchors, builtInOverrides, true, true)) throw new Error('The initial PAYAW world could not be generated.');
updateHistoryButtons();
setEditMode(false);
setZoneEditMode(false);
setWorkspace(activeWorkspace, activeWorkspace === 'dm');
renderDmSessionLog();
renderAssetList();
void refreshAssetLibrary().catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : String(error), 'error');
});
window.requestAnimationFrame(animationFrame);

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  if (event.key.toLocaleLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
  } else if (event.key.toLocaleLowerCase() === 'y') {
    event.preventDefault();
    redo();
  }
});
window.addEventListener('resize', fitCamera);
workspaceEditorButton.addEventListener('click', () => setWorkspace('editor'));
workspaceDmButton.addEventListener('click', () => setWorkspace('dm'));
dmViewPreset.addEventListener('change', () => {
  applyViewPreset(dmViewPreset.value);
  viewPreset.value = dmViewPreset.value;
});
dmStorySearch.addEventListener('input', filterDmStoryCards);
dmRandomEncounterButton.addEventListener('click', () => rollDmEncounter());
dmClearLog.addEventListener('click', () => {
  dmSessionEntries = [];
  renderDmSessionLog();
});
generateButton.addEventListener('click', () => generate(customAnchors, builtInOverrides, true, true));
seedInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') generate(customAnchors, builtInOverrides, true, true);
});
randomSeedButton.addEventListener('click', () => {
  seedInput.value = createCryptoSeed();
  generate(customAnchors, builtInOverrides, true, true);
});
terrainSizeSelect.addEventListener('change', updateProfileHint);
townScaleSelect.addEventListener('change', updateProfileHint);
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

islandResetAll.addEventListener('click', () => {
  if (islandOverrides.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previous = [...islandOverrides];
  islandOverrides = [];
  persistMapCustomization();
  if (regenerateFrom('islands', 'Reset all island plans.')) {
    recordHistory(snapshot, 'reset all island plans');
    return;
  }
  islandOverrides = previous;
  persistMapCustomization();
  regenerateFrom('islands', 'Restored previous island plans.');
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
    setStatus('No valid coast-to-coast crossing was found for that island pair. Try another pair or enable bridges in the island editor.', 'error');
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
    setStatus('No valid coastline site was found on that island. Try another island or enable ports in its island plan.', 'error');
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
  const previousRouteCustom = [...customWaterRoutes];
  portOverrides = [];
  customPorts = [];
  customWaterRoutes = customWaterRoutes.filter((route) => !route.fromPortKey.startsWith('port:custom:') && !route.toPortKey.startsWith('port:custom:'));
  persistMapCustomization();
  if (regenerateFrom('ports', 'Reset port authoring to generated defaults.')) {
    recordHistory(snapshot, 'reset port authoring');
    return;
  }
  portOverrides = previousOverrides;
  customPorts = previousCustom;
  customWaterRoutes = previousRouteCustom;
  persistMapCustomization();
  regenerateFrom('ports', 'Restored previous port authoring.');
});

waterRouteFromPort.addEventListener('change', () => {
  if (waterRouteToPort.value === waterRouteFromPort.value) {
    waterRouteToPort.value = world.ports.find((port) => port.key !== waterRouteFromPort.value)?.key ?? '';
  }
});

waterRouteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (waterRouteFromPort.value.length === 0 || waterRouteToPort.value.length === 0 || waterRouteFromPort.value === waterRouteToPort.value) {
    setStatus('Choose two different ports.', 'error');
    return;
  }
  const snapshot = captureEditorSnapshot();
  const definition: CustomWaterRouteDefinition = {
    key: `water-route:custom:${createRuleId()}`,
    name: waterRouteName.value.trim(),
    fromPortKey: waterRouteFromPort.value,
    toPortKey: waterRouteToPort.value,
    type: waterRouteType.value as WaterRouteType,
    vesselClass: waterRouteVessel.value as VesselClass,
    enabled: true,
    locked: true,
  };
  const previous = [...customWaterRoutes];
  customWaterRoutes = [...customWaterRoutes, definition];
  persistMapCustomization();
  if (!regenerateFrom('water-routes', `Added ${definition.name}.`) || !world.waterRoutes.some((route) => route.key === definition.key)) {
    customWaterRoutes = previous;
    persistMapCustomization();
    regenerateFrom('water-routes', 'Restored the previous water-route network.');
    setStatus('No navigable ocean path was found for that vessel. Try another port pair or a smaller vessel.', 'error');
    return;
  }
  waterRouteName.value = '';
  recordHistory(snapshot, `add water route ${definition.name}`);
});

waterRouteResetAll.addEventListener('click', () => {
  if (waterRouteOverrides.length === 0 && customWaterRoutes.length === 0) return;
  const snapshot = captureEditorSnapshot();
  const previousOverrides = [...waterRouteOverrides];
  const previousCustom = [...customWaterRoutes];
  waterRouteOverrides = [];
  customWaterRoutes = [];
  persistMapCustomization();
  if (regenerateFrom('water-routes', 'Reset water routes to generated defaults.')) {
    recordHistory(snapshot, 'reset water-route authoring');
    return;
  }
  waterRouteOverrides = previousOverrides;
  customWaterRoutes = previousCustom;
  persistMapCustomization();
  regenerateFrom('water-routes', 'Restored previous water-route authoring.');
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

canvas.addEventListener('pointerdown', (event) => {
  const position = worldPositionFromPointer(event);
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
        dragPreview = {
          kind: target.kind,
          key: target.key,
          x: position.x - 0.5,
          y: position.y - 0.5,
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
      settlement === undefined ? '' : `settlement ${settlement.name}`,
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

  if (dragPreview !== null) {
    dragPreview = { ...dragPreview, x: position.x - 0.5, y: position.y - 0.5 };
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
  canvas.classList.remove('dragging', 'entity-dragging');
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
  if (zoneEditMode && zoneStrokeActive) endZoneStroke(event);
  else endPointerInteraction(event);
});
canvas.addEventListener('pointercancel', (event) => {
  if (zoneEditMode && zoneStrokeActive) endZoneStroke(event, true);
  else endPointerInteraction(event, true);
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const rectangle = canvas.getBoundingClientRect();
  camera.zoomAt(event.clientX - rectangle.left, event.clientY - rectangle.top, Math.exp(-event.deltaY * 0.0015));
  requestRender();
}, { passive: false });
canvas.addEventListener('dblclick', fitCamera);
