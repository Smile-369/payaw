import {
  EMPTY_AUTHORING_LAYER,
  normalizeHexColor,
  type AuthoredMapFeature,
  type AuthoredSettlementDefinition,
  type AuthoringFeatureCategory,
  type AuthoringGeometry,
  type AuthoringLayerState,
  type AuthoringPoint,
  type AuthoringRealityLayer,
  type AuthoringVisibility,
  type SettlementAuthoringOverride,
  type SettlementKind,
  type TerrainTileOverride,
} from '../authoring/AuthoringLayer';
import { EMPTY_NPC_LOCATION_AUTHORING, normalizeNpcLocationAuthoring } from '../campaign/NPCLocationAuthoring';
import { DevelopmentLevel, IslandRole } from '../engine/regional/Island';
import { BridgeType } from '../engine/infrastructure/Bridge';
import { RoadType } from '../engine/infrastructure/Road';
import { PortType } from '../engine/infrastructure/Port';
import { TerrainType, WaterType } from '../engine/world/Tile';
import { ZoneType } from '../engine/zoning/Zone';
import { isEnumValue, normalizeEncounter } from '../editor/EditorStatePersistence';
import type { StoredMapCustomization } from './Customization';

const MAP_CUSTOMIZATION_STORAGE_KEY = 'payaw.map-customization.v2';

type MapCustomizationByWorld = Readonly<Record<string, StoredMapCustomization>>;

export function emptyMapCustomization(): StoredMapCustomization {
  return {
    anchorPositions: [], settlementPositions: [], storyPositions: [], storyRules: [], zoneOverrides: [], placedImages: [],
    islandOverrides: [], bridgeOverrides: [], customBridges: [], portOverrides: [], customPorts: [],
    authoringLayer: structuredClone(EMPTY_AUTHORING_LAYER), npcLocationAuthoring: structuredClone(EMPTY_NPC_LOCATION_AUTHORING),
  };
}

export const SETTLEMENT_KINDS: readonly SettlementKind[] = ['city', 'town', 'barangay', 'subdivision', 'neighborhood', 'village', 'sitio', 'district', 'compound', 'custom'];
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

export function normalizeMapCustomization(value: unknown): StoredMapCustomization {
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

export function loadMapCustomization(signature: string): StoredMapCustomization {
  return normalizeMapCustomization(loadAllMapCustomizations()[signature]);
}

export function saveMapCustomization(signature: string, state: StoredMapCustomization): void {
  const all = { ...loadAllMapCustomizations(), [signature]: state };
  localStorage.setItem(MAP_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(all));
}

