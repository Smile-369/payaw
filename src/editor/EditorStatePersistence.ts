import {
  DEFAULT_LABEL_DISPLAY_SETTINGS,
  type LabelDisplaySettings,
} from '../customization/Customization';
import {
  ClimatePreset,
  TerrainShape,
  TerrainSize,
  TownScale,
  type EntityNameOverride,
} from '../engine/generation/GenerationOptions';
import {
  AnchorProximityBand,
  AnchorRegionPreference,
  AnchorTerrainPreference,
  BUILT_IN_ANCHOR_TYPES,
  type AnchorRuleSettings,
  type BuiltInAnchorOverride,
  type CustomAnchorDefinition,
} from '../engine/settlement/Anchor';
import { ZoneType } from '../engine/zoning/Zone';
import {
  EncounterDanger,
  StoryObjectType,
  type CustomStoryPointDefinition,
  type StoryEncounterDefinition,
} from '../story/StoryObject';

const ANCHOR_STORAGE_KEY = 'payaw.anchor-rules.v2';
const PROFILE_STORAGE_KEY = 'payaw.generation-profile.v1';
const NAME_STORAGE_KEY = 'payaw.place-names.v1';
const LABEL_STORAGE_KEY = 'payaw.label-display.v1';
const CUSTOM_STORY_STORAGE_KEY = 'payaw.custom-story-points.v1';

export const MAX_CUSTOM_STORY_POINTS = 24;
export const MAX_CUSTOM_ANCHORS = 12;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StoredAnchorState {
  readonly customAnchors: readonly CustomAnchorDefinition[];
  readonly builtInOverrides: readonly BuiltInAnchorOverride[];
}

export interface StoredProfile {
  readonly terrainSize: TerrainSize;
  readonly townScale: TownScale;
  readonly terrainShape: TerrainShape;
  readonly climatePreset: ClimatePreset;
  readonly islandCount: number;
  readonly islandSpacingKilometers: number;
  readonly satelliteSettlementCount: number;
}

export interface StoredNameState {
  readonly roads: readonly EntityNameOverride[];
  readonly blocks: readonly EntityNameOverride[];
}

type NameStateByWorld = Readonly<Record<string, StoredNameState>>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
}

export function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

export function finiteSetting(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readJson<T>(
  storage: KeyValueStorage,
  key: string,
  fallback: () => T,
  normalize: (value: unknown) => T,
): T {
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback() : normalize(JSON.parse(raw) as unknown);
  } catch {
    return fallback();
  }
}

function writeJson(storage: KeyValueStorage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

function parseRuleSettings(value: unknown): AnchorRuleSettings | undefined {
  const item = asRecord(value);
  const zoneValues = Object.values(ZoneType);
  if (
    typeof item.name !== 'string'
    || item.name.trim().length === 0
    || !isEnumValue(Object.values(AnchorRegionPreference), item.region)
    || !isEnumValue(Object.values(AnchorTerrainPreference), item.terrain)
    || (item.targetAnchor !== null && !isEnumValue(BUILT_IN_ANCHOR_TYPES, item.targetAnchor))
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

export function normalizeAnchorState(value: unknown): StoredAnchorState {
  const root = asRecord(value);
  const customAnchors = Array.isArray(root.customAnchors)
    ? root.customAnchors.flatMap((candidate) => {
      const item = asRecord(candidate);
      const settings = parseRuleSettings(item);
      return settings === undefined || typeof item.id !== 'string'
        ? []
        : [{ id: item.id, ...settings }];
    }).slice(0, MAX_CUSTOM_ANCHORS)
    : [];
  const builtInSource = root.builtInOverrides ?? root.builtInAnchorOverrides;
  const builtInOverrides = Array.isArray(builtInSource)
    ? builtInSource.flatMap((candidate) => {
      const item = asRecord(candidate);
      const settings = parseRuleSettings(item);
      return settings === undefined || !isEnumValue(BUILT_IN_ANCHOR_TYPES, item.type)
        ? []
        : [{ type: item.type, ...settings }];
    })
    : [];
  return { customAnchors, builtInOverrides };
}

export function loadAnchorState(storage: KeyValueStorage = localStorage): StoredAnchorState {
  return readJson(
    storage,
    ANCHOR_STORAGE_KEY,
    () => ({ customAnchors: [], builtInOverrides: [] }),
    normalizeAnchorState,
  );
}

export function saveAnchorState(
  customAnchors: readonly CustomAnchorDefinition[],
  builtInOverrides: readonly BuiltInAnchorOverride[],
  storage: KeyValueStorage = localStorage,
): void {
  writeJson(storage, ANCHOR_STORAGE_KEY, { customAnchors, builtInOverrides });
}

export function normalizeLabelSettings(value: unknown): LabelDisplaySettings {
  const root = asRecord(value);
  const road = asRecord(root.road);
  const block = asRecord(root.block);
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

export function loadLabelSettings(storage: KeyValueStorage = localStorage): LabelDisplaySettings {
  return readJson(storage, LABEL_STORAGE_KEY, () => DEFAULT_LABEL_DISPLAY_SETTINGS, normalizeLabelSettings);
}

export function saveLabelSettings(
  settings: LabelDisplaySettings,
  storage: KeyValueStorage = localStorage,
): void {
  writeJson(storage, LABEL_STORAGE_KEY, settings);
}

export function defaultStoredProfile(): StoredProfile {
  return {
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    terrainShape: TerrainShape.SingleLargeIsland,
    climatePreset: ClimatePreset.TropicalMonsoon,
    islandCount: 5,
    islandSpacingKilometers: 4,
    satelliteSettlementCount: 0,
  };
}

function normalizeTerrainShape(value: unknown): TerrainShape | undefined {
  if (!isEnumValue(Object.values(TerrainShape), value)) return undefined;
  switch (value) {
    case TerrainShape.LegacyFullIsland: return TerrainShape.SingleLargeIsland;
    case TerrainShape.LegacyInland: return TerrainShape.InlandCoast;
    case TerrainShape.LegacyRiverDelta: return TerrainShape.Delta;
    case TerrainShape.LegacyAtoll: return TerrainShape.SingleMediumIsland;
    default: return value;
  }
}

export function normalizeStoredProfile(value: unknown): StoredProfile {
  const item = asRecord(value);
  const defaults = defaultStoredProfile();
  return {
    terrainSize: isEnumValue(Object.values(TerrainSize), item.terrainSize) ? item.terrainSize : defaults.terrainSize,
    townScale: isEnumValue(Object.values(TownScale), item.townScale) ? item.townScale : defaults.townScale,
    terrainShape: normalizeTerrainShape(item.terrainShape) ?? defaults.terrainShape,
    climatePreset: isEnumValue(Object.values(ClimatePreset), item.climatePreset) ? item.climatePreset : defaults.climatePreset,
    islandCount: Math.round(finiteSetting(item.islandCount ?? item.targetIslandCount, defaults.islandCount, 2, 12)),
    islandSpacingKilometers: finiteSetting(item.islandSpacingKilometers, defaults.islandSpacingKilometers, 0.5, 12),
    satelliteSettlementCount: 0,
  };
}

export function loadProfile(storage: KeyValueStorage = localStorage): StoredProfile {
  return readJson(storage, PROFILE_STORAGE_KEY, defaultStoredProfile, normalizeStoredProfile);
}

export function saveProfile(profile: StoredProfile, storage: KeyValueStorage = localStorage): void {
  writeJson(storage, PROFILE_STORAGE_KEY, profile);
}

function validEncounterDanger(value: unknown): value is EncounterDanger {
  return isEnumValue(Object.values(EncounterDanger), value);
}

export function normalizeEncounter(value: unknown, index: number): StoryEncounterDefinition | undefined {
  const item = asRecord(value);
  if (typeof item.title !== 'string' || item.title.trim().length === 0 || typeof item.description !== 'string') return undefined;
  return {
    id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `encounter-${index + 1}`,
    title: item.title.trim(),
    description: item.description.trim(),
    weight: finiteSetting(item.weight, 1, 0.05, 100),
    danger: validEncounterDanger(item.danger) ? item.danger : EncounterDanger.Low,
  };
}

export function parseEncounterLines(value: string): StoryEncounterDefinition[] {
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

export function formatEncounterLines(encounters: readonly StoryEncounterDefinition[]): string {
  return encounters
    .map((encounter) => `${encounter.weight} | ${encounter.danger} | ${encounter.title} | ${encounter.description}`)
    .join('\n');
}

export function normalizeCustomStoryDefinition(value: unknown): CustomStoryPointDefinition | undefined {
  const item = asRecord(value);
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
  const allowedZones = Array.isArray(item.allowedZones)
    ? item.allowedZones.filter((zone): zone is ZoneType => isEnumValue(zoneValues, zone))
    : [];
  const disallowedZones = Array.isArray(item.disallowedZones)
    ? item.disallowedZones.filter((zone): zone is ZoneType => isEnumValue(zoneValues, zone))
    : [];
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

export function loadCustomStoryDefinitions(
  storage: KeyValueStorage = localStorage,
): CustomStoryPointDefinition[] {
  return readJson(storage, CUSTOM_STORY_STORAGE_KEY, () => [], (value) => (
    Array.isArray(value)
      ? value.flatMap((item) => normalizeCustomStoryDefinition(item) ?? []).slice(0, MAX_CUSTOM_STORY_POINTS)
      : []
  ));
}

export function saveCustomStoryDefinitions(
  definitions: readonly CustomStoryPointDefinition[],
  storage: KeyValueStorage = localStorage,
): void {
  writeJson(storage, CUSTOM_STORY_STORAGE_KEY, definitions);
}

function loadAllNameStates(storage: KeyValueStorage): NameStateByWorld {
  return readJson(storage, NAME_STORAGE_KEY, () => ({}), (value) => (
    typeof value === 'object' && value !== null ? value as NameStateByWorld : {}
  ));
}

export function validNameOverrides(values: unknown): EntityNameOverride[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const item = asRecord(value);
    if (!Number.isInteger(item.id) || (item.id as number) < 0 || typeof item.name !== 'string' || item.name.trim().length === 0) return [];
    return [{ id: item.id as number, name: item.name.trim() }];
  });
}

export function loadNameState(
  signature: string,
  storage: KeyValueStorage = localStorage,
): StoredNameState {
  const stored = loadAllNameStates(storage)[signature];
  return {
    roads: validNameOverrides(stored?.roads),
    blocks: validNameOverrides(stored?.blocks),
  };
}

export function saveNameState(
  signature: string,
  state: StoredNameState,
  storage: KeyValueStorage = localStorage,
): void {
  writeJson(storage, NAME_STORAGE_KEY, { ...loadAllNameStates(storage), [signature]: state });
}
