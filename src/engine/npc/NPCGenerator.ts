import { BuildingType, type Building } from '../buildings/Building';
import type { Random } from '../rng/Random';
import type { Settlement } from '../regional/Settlement';
import type { World } from '../world/World';
import { ZoneType } from '../zoning/Zone';
import {
  CAMPAIGN_DAYS,
  RESIDENTIAL_BUILDING_TYPES,
} from '../../campaign/NPCLocationAuthoring';
import {
  NPCStatus,
  type NPC,
  type NPCRelationship,
  type NPCScheduleEntry,
  type NPCScheduleLocation,
  type NPCStorySuggestions,
} from './NPC';

const FIRST_NAMES = [
  'Angel', 'Andrea', 'Bebang', 'Benjie', 'Boyet', 'Carla', 'Carmela', 'Dante', 'Diego', 'Edna',
  'Elena', 'Emil', 'Fe', 'Gino', 'Inday', 'Isko', 'Jessa', 'Jun', 'Lani', 'Lito', 'Maribel', 'Maya',
  'Nena', 'Nestor', 'Nico', 'Noel', 'Pilar', 'Rafi', 'Ramon', 'Rina', 'Rogelio', 'Rosa', 'Teresita',
  'Toto', 'Victor', 'Wilson',
] as const;
const LAST_NAMES = [
  'Abad', 'Alcantara', 'Araneta', 'Bautista', 'Caballero', 'De la Cruz', 'Espinosa', 'Flores',
  'Gamboa', 'Gonzaga', 'Javellana', 'Lacson', 'Lopez', 'Magbanua', 'Montelibano', 'Panganiban',
  'Ramos', 'Salazar', 'Santos', 'Sevilla', 'Villanueva', 'Yulo',
] as const;
const PERSONALITIES = [
  'warm but evasive', 'blunt and practical', 'quietly observant', 'restless and ambitious',
  'superstitious but kind', 'charming and unreliable', 'patient and meticulous', 'protective of neighbors',
  'jovial under pressure', 'formal and guarded', 'curious to a fault', 'tired but dependable',
] as const;
const WISHES = [
  'to leave town without abandoning family', 'to be remembered after death', 'to repay an old debt',
  'to recover something lost in childhood', 'to keep the barangay safe', 'to become wealthy enough to stop worrying',
  'to hear from someone who disappeared', 'to undo one terrible decision', 'to find a place where nobody knows them',
] as const;
const FEARS = [
  'deep floodwater', 'being forgotten', 'the balete trees after dark', 'losing their home', 'public shame',
  'a family secret becoming known', 'crossing an empty road at 3 AM', 'hearing their own voice from another room',
] as const;
const SECRETS = [
  'They keep a key to a building that officially has no entrance.',
  'They have received messages from an account belonging to a dead person.',
  'They changed a barangay record to protect someone.',
  'They know which road vanishes during heavy rain.',
  'They made an offering at the balete and believe it was accepted.',
  'They saw someone return home before that person actually arrived.',
] as const;
const RUMORS = [
  'The old cinema lights turn on whenever someone goes missing.',
  'A jeepney follows the highway after midnight but never stops twice at the same place.',
  'The river carries voices toward the sea before a storm.',
  'One house in the district has a different number every morning.',
  'The town plaza clock loses a minute whenever malas gathers.',
] as const;

const OCCUPATIONS: Readonly<Partial<Record<BuildingType, string>>> = {
  [BuildingType.SariSariStore]: 'sari-sari store owner',
  [BuildingType.ConvenienceStore]: 'store clerk',
  [BuildingType.Mall]: 'mall employee',
  [BuildingType.Cinema]: 'cinema attendant',
  [BuildingType.Restaurant]: 'cook',
  [BuildingType.Cafe]: 'café worker',
  [BuildingType.Hotel]: 'hotel receptionist',
  [BuildingType.OfficeBuilding]: 'office worker',
  [BuildingType.GasStation]: 'gas station attendant',
  [BuildingType.School]: 'teacher',
  [BuildingType.Hospital]: 'health worker',
  [BuildingType.Church]: 'church caretaker',
  [BuildingType.RiceField]: 'rice farmer',
  [BuildingType.Warehouse]: 'warehouse worker',
  [BuildingType.Factory]: 'factory worker',
  [BuildingType.FishingVillage]: 'fisher',
  [BuildingType.BarangayHall]: 'barangay staff',
  [BuildingType.PublicMarket]: 'market vendor',
  [BuildingType.AirportTerminal]: 'airport staff',
  [BuildingType.PortFacility]: 'port worker',
};

function buildingCenter(world: World, building: Building): { tileIndex: number; x: number; y: number } {
  const tileIndex = building.tileIndices[0] ?? building.entrance.roadTileIndex;
  const tile = world.tiles[tileIndex] ?? world.tiles[building.entrance.roadTileIndex];
  return { tileIndex: tile === undefined ? 0 : world.indexOf(tile.x, tile.y), x: tile?.x ?? 0, y: tile?.y ?? 0 };
}

function buildingsNearSettlement(world: World, settlement: Settlement): Building[] {
  const radius = Math.max(12, settlement.influenceRadius * 1.25);
  return world.buildings.filter((building) => {
    const point = buildingCenter(world, building);
    return Math.hypot(point.x - settlement.x, point.y - settlement.y) <= radius;
  });
}

function zoneForBuilding(world: World, building: Building | undefined): ZoneType | null {
  if (building?.zoneId === null || building?.zoneId === undefined) return null;
  return world.zones[building.zoneId]?.type ?? null;
}

function occupationFor(building: Building | undefined, zone: ZoneType | null, random: Random): string {
  const explicit = building === undefined ? undefined : OCCUPATIONS[building.type];
  if (explicit !== undefined) return explicit;
  switch (zone) {
    case ZoneType.Agricultural: return random.pick(['farmer', 'farmhand', 'produce trader']);
    case ZoneType.Commercial: return random.pick(['shopkeeper', 'sales clerk', 'delivery rider']);
    case ZoneType.Government: return random.pick(['municipal employee', 'barangay staff', 'records clerk']);
    case ZoneType.Industrial: return random.pick(['machine operator', 'mechanic', 'warehouse worker']);
    case ZoneType.Institutional: return random.pick(['teacher', 'student', 'health worker']);
    default: return random.pick(['driver', 'vendor', 'repair technician', 'construction worker', 'unemployed']);
  }
}

function uniqueName(random: Random, used: Set<string>): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const name = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
    if (!used.has(name)) { used.add(name); return name; }
  }
  const fallback = `Resident ${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function location(kind: NPCScheduleLocation['kind'], ref: string, label: string, tileIndex: number): NPCScheduleLocation {
  return { kind, ref, label, tileIndex };
}

function scheduleEntry(
  id: string,
  day: NPCScheduleEntry['day'],
  startMinute: number,
  endMinute: number,
  activity: string,
  destination: NPCScheduleLocation,
  travelMode: NPCScheduleEntry['travelMode'],
): NPCScheduleEntry {
  return { id, day, startMinute, endMinute, activity, location: destination, travelMode, visibility: 'gm-only' };
}

function createWeeklySchedule(
  npcKey: string,
  homeBuilding: Building | undefined,
  homeTileIndex: number,
  workplaceBuilding: Building | undefined,
  workplaceTileIndex: number | undefined,
  occupation: string,
): NPCScheduleEntry[] {
  const home = homeBuilding === undefined
    ? location('home', `custom:unassigned-home:${npcKey}`, 'Home unassigned', homeTileIndex)
    : location('home', `building:${homeBuilding.id}`, homeBuilding.authoredName ?? 'Home', homeTileIndex);
  const work = workplaceBuilding === undefined || workplaceTileIndex === undefined
    ? home
    : location('workplace', `building:${workplaceBuilding.id}`, workplaceBuilding.authoredName ?? occupation, workplaceTileIndex);
  const entries: NPCScheduleEntry[] = [];
  for (const day of CAMPAIGN_DAYS) {
    const weekend = day === 'saturday' || day === 'sunday';
    if (!weekend && workplaceBuilding !== undefined) {
      entries.push(scheduleEntry(`${npcKey}-${day}-home-am`, day, 0, 7 * 60 + 30, 'At home', home, 'none'));
      entries.push(scheduleEntry(`${npcKey}-${day}-work`, day, 8 * 60, 17 * 60, occupation || 'Working', work, 'public-transport'));
      entries.push(scheduleEntry(`${npcKey}-${day}-home-pm`, day, 18 * 60, 24 * 60, 'At home', home, 'none'));
    } else {
      entries.push(scheduleEntry(`${npcKey}-${day}-home`, day, 0, 24 * 60, 'At home', home, 'none'));
    }
  }
  return entries;
}

function legacySchedule(homeTileIndex: number, workTileIndex: number, workLabel: string) {
  return [
    { period: 'morning' as const, locationLabel: 'Home', tileIndex: homeTileIndex },
    { period: 'day' as const, locationLabel: workLabel, tileIndex: workTileIndex },
    { period: 'evening' as const, locationLabel: 'Home', tileIndex: homeTileIndex },
    { period: 'night' as const, locationLabel: 'Home', tileIndex: homeTileIndex },
  ];
}

function desiredCount(world: World): number {
  const settlementBase = world.settlements.reduce((sum, settlement) => sum + (settlement.isPrimary ? 10 : 5), 0);
  return Math.max(12, Math.min(72, settlementBase));
}

export function generateNPCPopulation(world: World, random: Random, count = desiredCount(world)): NPC[] {
  if (world.settlements.length === 0) return [];
  const usedNames = new Set<string>();
  const npcs: NPC[] = [];
  const weightedSettlements = world.settlements.flatMap((settlement) => Array.from({ length: settlement.isPrimary ? 3 : 1 }, () => settlement));
  const buildingPools = new Map<number, { homes: Building[]; workplaces: Building[] }>();
  for (const settlement of world.settlements) {
    const nearby = buildingsNearSettlement(world, settlement);
    buildingPools.set(settlement.id, {
      homes: nearby.filter((building) => RESIDENTIAL_BUILDING_TYPES.has(building.type)),
      workplaces: nearby.filter((building) => !RESIDENTIAL_BUILDING_TYPES.has(building.type)),
    });
  }

  for (let id = 0; id < Math.max(0, Math.min(200, Math.round(count))); id += 1) {
    const npcRandom = random.fork(`npc-${id}`);
    const settlement = weightedSettlements[id % weightedSettlements.length] ?? world.settlements[0];
    if (settlement === undefined) break;
    const pool = buildingPools.get(settlement.id) ?? { homes: [], workplaces: [] };
    const homeBuilding = pool.homes.length > 0 ? npcRandom.pick(pool.homes) : undefined;
    const workplaceBuilding = pool.workplaces.length > 0 ? npcRandom.pick(pool.workplaces) : undefined;
    const home = homeBuilding === undefined
      ? { tileIndex: settlement.tileIndex, x: settlement.x, y: settlement.y }
      : buildingCenter(world, homeBuilding);
    const workplace = workplaceBuilding === undefined ? undefined : buildingCenter(world, workplaceBuilding);
    const zoneType = zoneForBuilding(world, workplaceBuilding) ?? zoneForBuilding(world, homeBuilding);
    const occupation = occupationFor(workplaceBuilding, zoneType, npcRandom);
    const key = `npc-${id}`;
    const suggestions: NPCStorySuggestions = {
      personality: npcRandom.pick(PERSONALITIES),
      wish: npcRandom.pick(WISHES),
      fear: npcRandom.pick(FEARS),
      secret: npcRandom.pick(SECRETS),
      rumor: npcRandom.pick(RUMORS),
    };
    npcs.push({
      id,
      key,
      source: 'generated',
      name: uniqueName(npcRandom, usedNames),
      age: npcRandom.int(16, 78),
      occupation,
      personality: suggestions.personality,
      wish: '',
      fear: '',
      secret: '',
      rumor: '',
      generatedSuggestions: suggestions,
      status: NPCStatus.Alive,
      settlementId: settlement.id,
      zoneType,
      homeBuildingId: homeBuilding?.id ?? null,
      workplaceBuildingId: workplaceBuilding?.id ?? null,
      tileIndex: workplace?.tileIndex ?? home.tileIndex,
      x: workplace?.x ?? home.x,
      y: workplace?.y ?? home.y,
      weeklySchedule: createWeeklySchedule(key, homeBuilding, home.tileIndex, workplaceBuilding, workplace?.tileIndex, occupation),
      schedule: legacySchedule(home.tileIndex, workplace?.tileIndex ?? home.tileIndex, workplaceBuilding === undefined ? 'Home' : occupation),
      relationships: [],
      portraitAssetId: null,
      portraitDataUrl: null,
      publicDescription: '',
      gmNotes: '',
      tags: [],
    });
  }

  return npcs.map((npc) => {
    const candidates = npcs.filter((other) => other.id !== npc.id);
    const relationRandom = random.fork(`npc-relations-${npc.id}`);
    const relationships: NPCRelationship[] = [];
    for (let index = 0; index < Math.min(candidates.length, relationRandom.int(1, 4)); index += 1) {
      const other = relationRandom.pick(candidates);
      if (relationships.some((entry) => entry.npcId === other.id)) continue;
      relationships.push({ npcId: other.id, kind: relationRandom.pick(['family', 'friend', 'rival', 'coworker', 'neighbor'] as const) });
    }
    return { ...npc, relationships };
  });
}
