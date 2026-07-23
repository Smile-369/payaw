import { BuildingType, type Building } from '../engine/buildings/Building';
import {
  NPCStatus,
  type CampaignDay,
  type NPC,
  type NPCRelationship,
  type NPCScheduleEntry,
  type NPCScheduleLocation,
} from '../engine/npc/NPC';
import type { World } from '../engine/world/World';
import type { AuthoringLayerState } from '../authoring/AuthoringLayer';

export const CAMPAIGN_DAYS: readonly CampaignDay[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

export const RESIDENTIAL_BUILDING_TYPES = new Set<BuildingType>([
  BuildingType.FilipinoHouse,
  BuildingType.NipaHut,
  BuildingType.TownHouse,
  BuildingType.BoardingHouse,
  BuildingType.Mansion,
  BuildingType.Condominium,
  BuildingType.Apartment,
  BuildingType.Subdivision,
  BuildingType.FarmHouse,
]);

export type LocationVisibility = 'gm-only' | 'players' | 'hidden';
export type VenueStatus = 'open' | 'closed' | 'closing-soon' | 'emergency-only' | 'evacuated' | 'abandoned';

export interface VenueHoursEntry {
  readonly day: CampaignDay;
  readonly openMinute: number;
  readonly closeMinute: number;
  readonly closed: boolean;
}

export interface AuthoredLocationRecord {
  readonly key: string;
  readonly name: string;
  readonly sourceRef: string;
  readonly locationType: string;
  readonly description: string;
  readonly playerDescription: string;
  readonly gmNotes: string;
  readonly ownerNpcKey: string | null;
  readonly tags: readonly string[];
  readonly visibility: LocationVisibility;
  readonly venueHours: readonly VenueHoursEntry[];
  readonly manualStatus: VenueStatus | null;
  readonly portraitAssetId: string | null;
}

export interface NPCProfileOverride {
  readonly npcKey: string;
  readonly name?: string;
  readonly age?: number;
  readonly occupation?: string;
  readonly personality?: string;
  readonly wish?: string;
  readonly fear?: string;
  readonly secret?: string;
  readonly rumor?: string;
  readonly status?: NPCStatus;
  readonly settlementId?: number;
  readonly homeBuildingId?: number | null;
  readonly allowNonResidentialHome?: boolean;
  readonly workplaceBuildingId?: number | null;
  readonly weeklySchedule?: readonly NPCScheduleEntry[];
  readonly relationships?: readonly NPCRelationship[];
  readonly portraitAssetId?: string | null;
  readonly portraitDataUrl?: string | null;
  readonly publicDescription?: string;
  readonly gmNotes?: string;
  readonly tags?: readonly string[];
}

export interface AuthoredNPCDefinition {
  readonly key: string;
  readonly name: string;
  readonly age: number;
  readonly occupation: string;
  readonly status: NPCStatus;
  readonly settlementId: number;
  readonly homeBuildingId: number | null;
  readonly allowNonResidentialHome: boolean;
  readonly workplaceBuildingId: number | null;
  readonly personality: string;
  readonly wish: string;
  readonly fear: string;
  readonly secret: string;
  readonly rumor: string;
  readonly weeklySchedule: readonly NPCScheduleEntry[];
  readonly relationships: readonly NPCRelationship[];
  readonly portraitAssetId: string | null;
  readonly portraitDataUrl: string | null;
  readonly publicDescription: string;
  readonly gmNotes: string;
  readonly tags: readonly string[];
}

export interface NPCTemporaryOverride {
  readonly id: string;
  readonly npcKey: string;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  readonly location: NPCScheduleLocation;
  readonly activity: string;
  readonly reason: string;
  readonly priority: number;
}

export interface NPCScenePlacement {
  readonly id: string;
  readonly sceneId: string;
  readonly npcKey: string;
  readonly location: NPCScheduleLocation;
  readonly activity: string;
  readonly visibleToPlayers: boolean;
}

export interface ScheduleTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly entries: readonly NPCScheduleEntry[];
}

export interface NPCLocationAuthoringState {
  readonly authoredNpcs: readonly AuthoredNPCDefinition[];
  readonly npcOverrides: readonly NPCProfileOverride[];
  readonly temporaryOverrides: readonly NPCTemporaryOverride[];
  readonly scenePlacements: readonly NPCScenePlacement[];
  readonly locations: readonly AuthoredLocationRecord[];
  readonly scheduleTemplates: readonly ScheduleTemplate[];
  readonly activeSceneId: string | null;
}

export const EMPTY_NPC_LOCATION_AUTHORING: NPCLocationAuthoringState = {
  authoredNpcs: [],
  npcOverrides: [],
  temporaryOverrides: [],
  scenePlacements: [],
  locations: [],
  scheduleTemplates: [],
  activeSceneId: null,
};

export interface CampaignLocationOption {
  readonly ref: string;
  readonly label: string;
  readonly kind: NPCScheduleLocation['kind'];
  readonly tileIndex: number;
  readonly residential: boolean;
}

export function isResidentialBuilding(building: Building | undefined): boolean {
  return building !== undefined && RESIDENTIAL_BUILDING_TYPES.has(building.type);
}

function buildingTileIndex(building: Building): number {
  return building.tileIndices[0] ?? building.entrance.roadTileIndex;
}

function buildingLabel(building: Building): string {
  return building.authoredName?.trim() || `${building.type.replaceAll('-', ' ')} #${building.id + 1}`;
}

export function collectCampaignLocations(world: World, authoringLayer: AuthoringLayerState): CampaignLocationOption[] {
  const result: CampaignLocationOption[] = [];
  for (const building of world.buildings) {
    result.push({
      ref: `building:${building.id}`,
      label: buildingLabel(building),
      kind: 'building',
      tileIndex: buildingTileIndex(building),
      residential: isResidentialBuilding(building),
    });
  }
  for (const anchor of world.anchors) {
    result.push({ ref: `anchor:${anchor.id}`, label: anchor.name, kind: 'anchor', tileIndex: anchor.tileIndex, residential: false });
  }
  for (const settlement of world.settlements) {
    result.push({ ref: `settlement:${settlement.key}`, label: settlement.name, kind: 'settlement', tileIndex: settlement.tileIndex, residential: false });
  }
  for (const feature of authoringLayer.features) {
    const point = feature.geometry.kind === 'point'
      ? feature.geometry.point
      : feature.geometry.kind === 'circle'
        ? feature.geometry.center
        : feature.geometry.points[0];
    if (point === undefined) continue;
    const x = Math.max(0, Math.min(world.width - 1, Math.round(point.x)));
    const y = Math.max(0, Math.min(world.height - 1, Math.round(point.y)));
    result.push({
      ref: `authored-feature:${feature.id}`,
      label: feature.name,
      kind: 'authored-feature',
      tileIndex: world.indexOf(x, y),
      residential: feature.category === 'building' && /house|home|apartment|residential|boarding/i.test(`${feature.name} ${feature.subtype} ${feature.tags.join(' ')}`),
    });
  }
  return result.sort((left, right) => left.label.localeCompare(right.label));
}

export function scheduleLocationFromRef(
  world: World,
  authoringLayer: AuthoringLayerState,
  ref: string,
  fallbackLabel = 'Custom location',
): NPCScheduleLocation | undefined {
  const option = collectCampaignLocations(world, authoringLayer).find((item) => item.ref === ref);
  if (option === undefined) return undefined;
  return { kind: option.kind, ref: option.ref, label: option.label || fallbackLabel, tileIndex: option.tileIndex };
}

export function validateNpcHome(world: World, homeBuildingId: number | null, allowNonResidentialHome: boolean): string | null {
  if (homeBuildingId === null) return null;
  const building = world.buildings.find((candidate) => candidate.id === homeBuildingId);
  if (building === undefined) return 'The selected home no longer exists.';
  if (!allowNonResidentialHome && !isResidentialBuilding(building)) return 'NPC homes must be residential unless the GM explicitly enables an unusual-residence override.';
  return null;
}

export function validateSchedule(entries: readonly NPCScheduleEntry[]): readonly string[] {
  const errors: string[] = [];
  for (const day of CAMPAIGN_DAYS) {
    const dayEntries = entries.filter((entry) => entry.day === day).sort((left, right) => left.startMinute - right.startMinute);
    for (let index = 0; index < dayEntries.length; index += 1) {
      const entry = dayEntries[index];
      if (entry === undefined) continue;
      if (!Number.isInteger(entry.startMinute) || !Number.isInteger(entry.endMinute) || entry.startMinute < 0 || entry.endMinute > 1440 || entry.startMinute >= entry.endMinute) {
        errors.push(`${day}: ${entry.activity || 'schedule block'} has an invalid time range.`);
      }
      const next = dayEntries[index + 1];
      if (next !== undefined && next.startMinute < entry.endMinute) errors.push(`${day}: ${entry.activity || 'schedule block'} overlaps ${next.activity || 'another block'}.`);
    }
  }
  return errors;
}

function homeLocation(world: World, npc: NPC): NPCScheduleLocation {
  const building = npc.homeBuildingId === null ? undefined : world.buildings.find((candidate) => candidate.id === npc.homeBuildingId);
  if (building !== undefined) return { kind: 'home', ref: `building:${building.id}`, label: buildingLabel(building), tileIndex: buildingTileIndex(building) };
  const settlement = world.settlements[npc.settlementId];
  return {
    kind: 'home',
    ref: settlement === undefined ? `custom:unassigned-home:${npc.key}` : `settlement:${settlement.key}`,
    label: settlement === undefined ? 'Home unassigned' : `${settlement.name} · home unassigned`,
    tileIndex: settlement?.tileIndex ?? npc.tileIndex,
  };
}

function applyProfileOverride(world: World, npc: NPC, override: NPCProfileOverride | undefined): NPC {
  if (override === undefined) return npc;
  const homeBuildingId = override.homeBuildingId === undefined ? npc.homeBuildingId : override.homeBuildingId;
  const homeError = validateNpcHome(world, homeBuildingId, override.allowNonResidentialHome === true);
  const safeHomeBuildingId = homeError === null ? homeBuildingId : npc.homeBuildingId;
  const candidate: NPC = {
    ...npc,
    ...(override.name === undefined ? {} : { name: override.name }),
    ...(override.age === undefined ? {} : { age: override.age }),
    ...(override.occupation === undefined ? {} : { occupation: override.occupation }),
    ...(override.personality === undefined ? {} : { personality: override.personality }),
    ...(override.wish === undefined ? {} : { wish: override.wish }),
    ...(override.fear === undefined ? {} : { fear: override.fear }),
    ...(override.secret === undefined ? {} : { secret: override.secret }),
    ...(override.rumor === undefined ? {} : { rumor: override.rumor }),
    ...(override.status === undefined ? {} : { status: override.status }),
    ...(override.settlementId === undefined ? {} : { settlementId: Math.max(0, Math.min(world.settlements.length - 1, override.settlementId)) }),
    ...(override.workplaceBuildingId === undefined ? {} : { workplaceBuildingId: override.workplaceBuildingId }),
    homeBuildingId: safeHomeBuildingId,
    ...(override.weeklySchedule === undefined ? {} : { weeklySchedule: override.weeklySchedule }),
    ...(override.relationships === undefined ? {} : { relationships: override.relationships }),
    ...(override.portraitAssetId === undefined ? {} : { portraitAssetId: override.portraitAssetId }),
    ...(override.portraitDataUrl === undefined ? {} : { portraitDataUrl: override.portraitDataUrl }),
    ...(override.publicDescription === undefined ? {} : { publicDescription: override.publicDescription }),
    ...(override.gmNotes === undefined ? {} : { gmNotes: override.gmNotes }),
    ...(override.tags === undefined ? {} : { tags: override.tags }),
  };
  const home = homeLocation(world, candidate);
  const first = candidate.weeklySchedule[0]?.location ?? home;
  const tile = world.tiles[first.tileIndex] ?? world.tiles[home.tileIndex];
  return tile === undefined ? candidate : { ...candidate, tileIndex: tile.y * world.width + tile.x, x: tile.x, y: tile.y };
}

function authoredNpcToNpc(world: World, definition: AuthoredNPCDefinition, id: number): NPC {
  const homeError = validateNpcHome(world, definition.homeBuildingId, definition.allowNonResidentialHome);
  const homeBuildingId = homeError === null ? definition.homeBuildingId : null;
  const settlement = world.settlements[definition.settlementId] ?? world.settlements[0];
  const homeBuilding = homeBuildingId === null ? undefined : world.buildings.find((building) => building.id === homeBuildingId);
  const tileIndex = homeBuilding === undefined ? settlement?.tileIndex ?? 0 : buildingTileIndex(homeBuilding);
  const tile = world.tiles[tileIndex] ?? world.tiles[0];
  return {
    id,
    key: definition.key,
    source: 'authored',
    name: definition.name,
    age: definition.age,
    occupation: definition.occupation,
    personality: definition.personality,
    wish: definition.wish,
    fear: definition.fear,
    secret: definition.secret,
    rumor: definition.rumor,
    status: definition.status,
    settlementId: settlement?.id ?? 0,
    zoneType: null,
    homeBuildingId,
    workplaceBuildingId: definition.workplaceBuildingId,
    tileIndex,
    x: tile?.x ?? 0,
    y: tile?.y ?? 0,
    weeklySchedule: definition.weeklySchedule,
    schedule: [],
    relationships: definition.relationships,
    portraitAssetId: definition.portraitAssetId,
    portraitDataUrl: definition.portraitDataUrl,
    publicDescription: definition.publicDescription,
    gmNotes: definition.gmNotes,
    tags: definition.tags,
  };
}

export function applyNpcLocationAuthoring(world: World, state: NPCLocationAuthoringState): NPC[] {
  const overrides = new Map(state.npcOverrides.map((override) => [override.npcKey, override]));
  const generated = world.npcs
    .filter((npc) => npc.source !== 'authored')
    .map((npc) => applyProfileOverride(world, npc, overrides.get(npc.key)));
  const usedKeys = new Set(generated.map((npc) => npc.key));
  const authored: NPC[] = [];
  for (const definition of state.authoredNpcs) {
    if (usedKeys.has(definition.key)) continue;
    authored.push(authoredNpcToNpc(world, definition, generated.length + authored.length));
    usedKeys.add(definition.key);
  }
  return [...generated, ...authored].map((npc, id) => ({ ...npc, id }));
}

function normalizeMinute(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1440, Math.round(number))) : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 64) : [];
}

function normalizeLocation(value: unknown): NPCScheduleLocation | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const kinds: readonly NPCScheduleLocation['kind'][] = ['home', 'workplace', 'building', 'anchor', 'settlement', 'authored-feature', 'custom'];
  if (!kinds.includes(item.kind as NPCScheduleLocation['kind']) || typeof item.ref !== 'string' || typeof item.label !== 'string' || !Number.isInteger(item.tileIndex)) return undefined;
  return { kind: item.kind as NPCScheduleLocation['kind'], ref: item.ref, label: item.label, tileIndex: item.tileIndex as number };
}

export function normalizeScheduleEntries(value: unknown): NPCScheduleEntry[] {
  if (!Array.isArray(value)) return [];
  const travelModes: readonly NPCScheduleEntry['travelMode'][] = ['walk', 'drive', 'public-transport', 'none'];
  const visibilityValues: readonly NPCScheduleEntry['visibility'][] = ['gm-only', 'revealable', 'public'];
  return value.flatMap((candidate, index) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    const location = normalizeLocation(item.location);
    if (!CAMPAIGN_DAYS.includes(item.day as CampaignDay) || location === undefined || typeof item.activity !== 'string') return [];
    const startMinute = normalizeMinute(item.startMinute, 8 * 60);
    const endMinute = normalizeMinute(item.endMinute, 9 * 60);
    if (endMinute <= startMinute) return [];
    return [{
      id: typeof item.id === 'string' && item.id.trim() ? item.id : `schedule-${index}`,
      day: item.day as CampaignDay,
      startMinute,
      endMinute,
      activity: item.activity.trim() || 'At location',
      location,
      travelMode: item.travelMode === 'ferry'
        ? 'public-transport'
        : travelModes.includes(item.travelMode as NPCScheduleEntry['travelMode'])
          ? item.travelMode as NPCScheduleEntry['travelMode']
          : 'none',
      visibility: visibilityValues.includes(item.visibility as NPCScheduleEntry['visibility']) ? item.visibility as NPCScheduleEntry['visibility'] : 'gm-only',
    }];
  }).slice(0, 1000);
}

function normalizeRelationships(value: unknown): NPCRelationship[] {
  if (!Array.isArray(value)) return [];
  const kinds: readonly NPCRelationship['kind'][] = ['family', 'friend', 'rival', 'coworker', 'neighbor', 'contact', 'romantic', 'custom'];
  return value.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    if (!Number.isInteger(item.npcId) || !kinds.includes(item.kind as NPCRelationship['kind'])) return [];
    return [{
      npcId: item.npcId as number,
      kind: item.kind as NPCRelationship['kind'],
      ...(typeof item.label === 'string' ? { label: item.label.slice(0, 120) } : {}),
      ...(typeof item.notes === 'string' ? { notes: item.notes.slice(0, 2000) } : {}),
      ...(typeof item.hidden === 'boolean' ? { hidden: item.hidden } : {}),
    }];
  }).slice(0, 200);
}

export function normalizeNpcLocationAuthoring(value: unknown): NPCLocationAuthoringState {
  if (typeof value !== 'object' || value === null) return structuredClone(EMPTY_NPC_LOCATION_AUTHORING);
  const root = value as Record<string, unknown>;
  const statusValues = Object.values(NPCStatus);
  const authoredNpcs: AuthoredNPCDefinition[] = Array.isArray(root.authoredNpcs) ? root.authoredNpcs.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.key !== 'string' || typeof item.name !== 'string' || !item.key.trim() || !item.name.trim()) return [];
    const status = statusValues.includes(item.status as NPCStatus) ? item.status as NPCStatus : NPCStatus.Alive;
    return [{
      key: item.key.trim(),
      name: item.name.trim(),
      age: Math.max(0, Math.min(130, Math.round(Number(item.age) || 30))),
      occupation: typeof item.occupation === 'string' ? item.occupation.slice(0, 160) : '',
      status,
      settlementId: Math.max(0, Math.round(Number(item.settlementId) || 0)),
      homeBuildingId: item.homeBuildingId === null ? null : Number.isInteger(item.homeBuildingId) ? item.homeBuildingId as number : null,
      allowNonResidentialHome: item.allowNonResidentialHome === true,
      workplaceBuildingId: item.workplaceBuildingId === null ? null : Number.isInteger(item.workplaceBuildingId) ? item.workplaceBuildingId as number : null,
      personality: typeof item.personality === 'string' ? item.personality.slice(0, 500) : '',
      wish: typeof item.wish === 'string' ? item.wish.slice(0, 1000) : '',
      fear: typeof item.fear === 'string' ? item.fear.slice(0, 1000) : '',
      secret: typeof item.secret === 'string' ? item.secret.slice(0, 2000) : '',
      rumor: typeof item.rumor === 'string' ? item.rumor.slice(0, 2000) : '',
      weeklySchedule: normalizeScheduleEntries(item.weeklySchedule),
      relationships: normalizeRelationships(item.relationships),
      portraitAssetId: typeof item.portraitAssetId === 'string' ? item.portraitAssetId : null,
      portraitDataUrl: typeof item.portraitDataUrl === 'string' && item.portraitDataUrl.startsWith('data:image/') ? item.portraitDataUrl : null,
      publicDescription: typeof item.publicDescription === 'string' ? item.publicDescription.slice(0, 4000) : '',
      gmNotes: typeof item.gmNotes === 'string' ? item.gmNotes.slice(0, 8000) : '',
      tags: normalizeStringArray(item.tags),
    }];
  }).slice(0, 500) : [];

  const npcOverrides: NPCProfileOverride[] = Array.isArray(root.npcOverrides) ? root.npcOverrides.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.npcKey !== 'string' || !item.npcKey.trim()) return [];
    const override: NPCProfileOverride = {
      npcKey: item.npcKey.trim(),
      ...(typeof item.name === 'string' ? { name: item.name.slice(0, 160) } : {}),
      ...(Number.isFinite(Number(item.age)) ? { age: Math.max(0, Math.min(130, Math.round(Number(item.age)))) } : {}),
      ...(typeof item.occupation === 'string' ? { occupation: item.occupation.slice(0, 160) } : {}),
      ...(typeof item.personality === 'string' ? { personality: item.personality.slice(0, 500) } : {}),
      ...(typeof item.wish === 'string' ? { wish: item.wish.slice(0, 1000) } : {}),
      ...(typeof item.fear === 'string' ? { fear: item.fear.slice(0, 1000) } : {}),
      ...(typeof item.secret === 'string' ? { secret: item.secret.slice(0, 2000) } : {}),
      ...(typeof item.rumor === 'string' ? { rumor: item.rumor.slice(0, 2000) } : {}),
      ...(statusValues.includes(item.status as NPCStatus) ? { status: item.status as NPCStatus } : {}),
      ...(Number.isFinite(Number(item.settlementId)) ? { settlementId: Math.max(0, Math.round(Number(item.settlementId))) } : {}),
      ...(item.homeBuildingId === null || Number.isInteger(item.homeBuildingId) ? { homeBuildingId: item.homeBuildingId as number | null } : {}),
      ...(typeof item.allowNonResidentialHome === 'boolean' ? { allowNonResidentialHome: item.allowNonResidentialHome } : {}),
      ...(item.workplaceBuildingId === null || Number.isInteger(item.workplaceBuildingId) ? { workplaceBuildingId: item.workplaceBuildingId as number | null } : {}),
      ...(Array.isArray(item.weeklySchedule) ? { weeklySchedule: normalizeScheduleEntries(item.weeklySchedule) } : {}),
      ...(Array.isArray(item.relationships) ? { relationships: normalizeRelationships(item.relationships) } : {}),
      ...(item.portraitAssetId === null || typeof item.portraitAssetId === 'string' ? { portraitAssetId: item.portraitAssetId as string | null } : {}),
      ...(item.portraitDataUrl === null || (typeof item.portraitDataUrl === 'string' && item.portraitDataUrl.startsWith('data:image/')) ? { portraitDataUrl: item.portraitDataUrl as string | null } : {}),
      ...(typeof item.publicDescription === 'string' ? { publicDescription: item.publicDescription.slice(0, 4000) } : {}),
      ...(typeof item.gmNotes === 'string' ? { gmNotes: item.gmNotes.slice(0, 8000) } : {}),
      ...(Array.isArray(item.tags) ? { tags: normalizeStringArray(item.tags) } : {}),
    };
    return [override];
  }).slice(0, 1000) : [];

  const temporaryOverrides: NPCTemporaryOverride[] = Array.isArray(root.temporaryOverrides) ? root.temporaryOverrides.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    const location = normalizeLocation(item.location);
    if (typeof item.id !== 'string' || typeof item.npcKey !== 'string' || location === undefined || !Number.isFinite(Number(item.startsAtMs)) || !Number.isFinite(Number(item.endsAtMs))) return [];
    return [{
      id: item.id,
      npcKey: item.npcKey,
      startsAtMs: Number(item.startsAtMs),
      endsAtMs: Number(item.endsAtMs),
      location,
      activity: typeof item.activity === 'string' ? item.activity.slice(0, 500) : 'Temporarily placed',
      reason: typeof item.reason === 'string' ? item.reason.slice(0, 1000) : '',
      priority: Math.round(Number(item.priority) || 0),
    }];
  }).slice(0, 1000) : [];

  const scenePlacements: NPCScenePlacement[] = Array.isArray(root.scenePlacements) ? root.scenePlacements.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    const location = normalizeLocation(item.location);
    if (typeof item.id !== 'string' || typeof item.sceneId !== 'string' || typeof item.npcKey !== 'string' || location === undefined) return [];
    return [{ id: item.id, sceneId: item.sceneId, npcKey: item.npcKey, location, activity: typeof item.activity === 'string' ? item.activity.slice(0, 500) : 'Present in scene', visibleToPlayers: item.visibleToPlayers !== false }];
  }).slice(0, 1000) : [];

  const locations: AuthoredLocationRecord[] = Array.isArray(root.locations) ? root.locations.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.key !== 'string' || typeof item.name !== 'string' || typeof item.sourceRef !== 'string') return [];
    const visibility: LocationVisibility = item.visibility === 'players' || item.visibility === 'hidden' ? item.visibility : 'gm-only';
    const manualStatuses: readonly VenueStatus[] = ['open', 'closed', 'closing-soon', 'emergency-only', 'evacuated', 'abandoned'];
    const venueHours: VenueHoursEntry[] = Array.isArray(item.venueHours) ? item.venueHours.flatMap((candidateHours) => {
      if (typeof candidateHours !== 'object' || candidateHours === null) return [];
      const hours = candidateHours as Record<string, unknown>;
      if (!CAMPAIGN_DAYS.includes(hours.day as CampaignDay)) return [];
      return [{ day: hours.day as CampaignDay, openMinute: normalizeMinute(hours.openMinute, 8 * 60), closeMinute: normalizeMinute(hours.closeMinute, 17 * 60), closed: hours.closed === true }];
    }) : [];
    return [{
      key: item.key,
      name: item.name.slice(0, 200),
      sourceRef: item.sourceRef,
      locationType: typeof item.locationType === 'string' ? item.locationType.slice(0, 120) : 'location',
      description: typeof item.description === 'string' ? item.description.slice(0, 8000) : '',
      playerDescription: typeof item.playerDescription === 'string' ? item.playerDescription.slice(0, 8000) : '',
      gmNotes: typeof item.gmNotes === 'string' ? item.gmNotes.slice(0, 12000) : '',
      ownerNpcKey: typeof item.ownerNpcKey === 'string' ? item.ownerNpcKey : null,
      tags: normalizeStringArray(item.tags),
      visibility,
      venueHours,
      manualStatus: manualStatuses.includes(item.manualStatus as VenueStatus) ? item.manualStatus as VenueStatus : null,
      portraitAssetId: typeof item.portraitAssetId === 'string' ? item.portraitAssetId : null,
    }];
  }).slice(0, 2000) : [];

  const scheduleTemplates: ScheduleTemplate[] = Array.isArray(root.scheduleTemplates) ? root.scheduleTemplates.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.name !== 'string') return [];
    return [{ id: item.id, name: item.name.slice(0, 160), description: typeof item.description === 'string' ? item.description.slice(0, 1000) : '', entries: normalizeScheduleEntries(item.entries) }];
  }).slice(0, 100) : [];

  return {
    authoredNpcs,
    npcOverrides,
    temporaryOverrides,
    scenePlacements,
    locations,
    scheduleTemplates,
    activeSceneId: typeof root.activeSceneId === 'string' ? root.activeSceneId : null,
  };
}

export function localCampaignDayAndMinute(timestampMs: number, timezone: string): { readonly day: CampaignDay; readonly minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = formatter.formatToParts(new Date(timestampMs));
  const weekday = (parts.find((part) => part.type === 'weekday')?.value ?? 'Monday').toLocaleLowerCase() as CampaignDay;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return { day: CAMPAIGN_DAYS.includes(weekday) ? weekday : 'monday', minute: hour * 60 + minute };
}

export interface ResolvedNpcPlacement {
  readonly location: NPCScheduleLocation;
  readonly activity: string;
  readonly source: 'scene' | 'override' | 'schedule' | 'home';
  readonly untilMs: number | null;
}

export function resolveNpcPlacement(
  world: World,
  npc: NPC,
  state: NPCLocationAuthoringState,
  timestampMs: number,
  timezone: string,
): ResolvedNpcPlacement {
  if (state.activeSceneId !== null) {
    const scene = [...state.scenePlacements].reverse().find((placement) => placement.sceneId === state.activeSceneId && placement.npcKey === npc.key);
    if (scene !== undefined) return { location: scene.location, activity: scene.activity, source: 'scene', untilMs: null };
  }
  const override = state.temporaryOverrides
    .filter((candidate) => candidate.npcKey === npc.key && candidate.startsAtMs <= timestampMs && timestampMs < candidate.endsAtMs)
    .sort((left, right) => right.priority - left.priority)[0];
  if (override !== undefined) return { location: override.location, activity: override.activity, source: 'override', untilMs: override.endsAtMs };
  const local = localCampaignDayAndMinute(timestampMs, timezone);
  const schedule = npc.weeklySchedule
    .filter((entry) => entry.day === local.day && entry.startMinute <= local.minute && local.minute < entry.endMinute)
    .sort((left, right) => right.startMinute - left.startMinute)[0];
  if (schedule !== undefined) return { location: schedule.location, activity: schedule.activity, source: 'schedule', untilMs: null };
  return { location: homeLocation(world, npc), activity: npc.homeBuildingId === null ? 'Home unassigned' : 'At home', source: 'home', untilMs: null };
}

export function venueStatusAt(record: AuthoredLocationRecord, timestampMs: number, timezone: string): VenueStatus {
  if (record.manualStatus !== null) return record.manualStatus;
  const local = localCampaignDayAndMinute(timestampMs, timezone);
  const hours = record.venueHours.find((entry) => entry.day === local.day);
  if (hours === undefined || hours.closed) return 'closed';
  if (local.minute < hours.openMinute || local.minute >= hours.closeMinute) return 'closed';
  return hours.closeMinute - local.minute <= 30 ? 'closing-soon' : 'open';
}
