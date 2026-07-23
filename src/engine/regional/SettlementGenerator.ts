import type {
  AuthoredSettlementDefinition,
  SettlementAuthoringOverride,
  SettlementKind,
} from '../../authoring/AuthoringLayer';
import type { SettlementPositionOverride } from '../generation/GenerationOptions';
import { InvalidPositionOverrideError } from '../generation/InvalidPositionOverrideError';
import type { Random } from '../rng/Random';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { DevelopmentLevel, IslandRole, type Island } from './Island';
import { SettlementType, type Settlement } from './Settlement';

export interface SettlementPlacementCandidate {
  readonly x: number;
  readonly y: number;
  readonly islandId: number;
  readonly islandKey: string;
  readonly warning?: string | undefined;
}

function nearestIsland(world: World, x: number, y: number, fallback: Island): Island {
  const exact = world.getTile(x, y)?.islandId;
  if (exact !== null && exact !== undefined) return world.islands[exact] ?? fallback;
  let best = fallback;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const island of world.islands) {
    const landmass = world.landmasses[island.landmassId];
    if (landmass === undefined) continue;
    const distance = Math.hypot(landmass.centroid.x - x, landmass.centroid.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = island;
    }
  }
  return best;
}

/**
 * Returns the exact in-bounds authored destination for a generated settlement.
 * Milestone 18 deliberately treats terrain rules as warnings rather than hard
 * blockers: a GM may place a community on a floodplain, reclaimed coast, or an
 * impossible Hidden Payaw location. Generation systems that require dry land
 * simply skip their optional output at that destination.
 */
export function findNearestValidSettlementTile(
  world: World,
  settlementKey: string,
  x: number,
  y: number,
  _maximumRadius = 18,
): SettlementPlacementCandidate | undefined {
  const settlement = world.settlements.find((item) => item.key === settlementKey);
  if (settlement === undefined || settlement.isPrimary || settlement.locked === true) return undefined;
  const tile = world.getTile(Math.round(x), Math.round(y));
  if (tile === undefined) return undefined;
  const fallback = world.islands[settlement.islandId] ?? world.islands[0];
  if (fallback === undefined) return undefined;
  const island = nearestIsland(world, tile.x, tile.y, fallback);
  const warnings: string[] = [];
  if (tile.water !== WaterType.Land) warnings.push('water');
  if (tile.river) warnings.push('river channel');
  if (tile.terrain === TerrainType.Mountain || tile.slope > 0.38) warnings.push('steep terrain');
  if (tile.floodRisk > 0.82) warnings.push('flood risk');
  return {
    x: tile.x,
    y: tile.y,
    islandId: island.id,
    islandKey: island.key,
    warning: warnings.length === 0 ? undefined : warnings.join(', '),
  };
}

const BARANGAY_ROOTS = [
  'Balete', 'Baybay', 'Bagong Silang', 'Malipayon', 'San Roque', 'San Isidro', 'Mabini', 'Himaya',
  'Tinagong', 'Talisay', 'Acacia', 'Kahilwayan', 'Poblacion', 'Marapara', 'Dapdap', 'Sibucao',
] as const;

function settlementType(island: Island, index: number): SettlementType {
  if (island.role === IslandRole.PrimarySettlement) return index === 0
    ? (island.developmentLevel === DevelopmentLevel.Urban ? SettlementType.City : SettlementType.Town)
    : SettlementType.Village;
  if (island.role === IslandRole.SatelliteTown) return index === 0 ? SettlementType.Town : SettlementType.Village;
  if (island.role === IslandRole.PortHub) return SettlementType.PortCommunity;
  if (island.role === IslandRole.Agricultural) return SettlementType.AgriculturalCommunity;
  if (island.role === IslandRole.Industrial) return SettlementType.IndustrialDistrict;
  if (island.role === IslandRole.RuralVillage) return SettlementType.Village;
  return SettlementType.Hamlet;
}

function typeFromKind(kind: SettlementKind): SettlementType {
  if (kind === 'city') return SettlementType.City;
  if (kind === 'town' || kind === 'barangay' || kind === 'subdivision' || kind === 'district') return SettlementType.Town;
  if (kind === 'village' || kind === 'neighborhood') return SettlementType.Village;
  return SettlementType.Hamlet;
}

function kindFromType(type: SettlementType): SettlementKind {
  if (type === SettlementType.City) return 'city';
  if (type === SettlementType.Town) return 'town';
  if (type === SettlementType.Village) return 'village';
  if (type === SettlementType.IndustrialDistrict) return 'district';
  return 'barangay';
}

function influenceRadius(type: SettlementType, population: number): number {
  const populationRadius = Math.sqrt(Math.max(1, population)) * 0.105;
  const base = type === SettlementType.City ? 20 : type === SettlementType.Town ? 15 : type === SettlementType.Village ? 10 : 8;
  return Math.max(7, Math.min(34, base + populationRadius));
}

function candidateScore(world: World, island: Island, index: number, placed: readonly Settlement[], candidateIndex: number): number {
  const tile = world.tiles[candidateIndex];
  const landmass = world.landmasses[island.landmassId];
  if (tile === undefined || landmass === undefined || tile.water !== WaterType.Land || tile.river || tile.terrain === TerrainType.Mountain) return Number.NEGATIVE_INFINITY;
  if (tile.slope > 0.25 || tile.floodRisk > 0.82) return Number.NEGATIVE_INFINITY;
  const separation = placed.length === 0 ? 999 : Math.min(...placed.map((settlement) => Math.hypot(tile.x - settlement.x, tile.y - settlement.y)));
  if (separation < 12) return Number.NEGATIVE_INFINITY;
  const centerDistance = Math.hypot(tile.x + 0.5 - landmass.centroid.x, tile.y + 0.5 - landmass.centroid.y);
  const centerScale = Math.max(1, Math.hypot(landmass.bounds.maxX - landmass.bounds.minX, landmass.bounds.maxY - landmass.bounds.minY));
  const flatness = 1 - Math.min(1, tile.slope / 0.25);
  const dryness = 1 - tile.floodRisk;
  const coastPreference = island.role === IslandRole.PortHub || island.role === IslandRole.RuralVillage
    ? Math.exp(-Math.max(0, tile.coastDistance - 2) / 8)
    : 1 - Math.exp(-tile.coastDistance / 8);
  const farmland = tile.terrain === TerrainType.Plain || tile.terrain === TerrainType.Floodplain ? 1 : 0.4;
  const roleBias = island.role === IslandRole.Agricultural ? farmland : island.role === IslandRole.ProtectedNature ? tile.forestDensity : 0.5;
  return flatness * 0.31
    + dryness * 0.23
    + (1 - Math.min(1, centerDistance / centerScale)) * 0.19
    + coastPreference * 0.12
    + roleBias * 0.1
    + Math.min(1, separation / 45) * 0.05
    + index * 0.00001;
}

function selectCenter(world: World, island: Island, placed: readonly Settlement[], random: Random, ordinal: number): number | undefined {
  const landmass = world.landmasses[island.landmassId];
  if (landmass === undefined) return undefined;
  const ranked = landmass.tileIndices
    .map((tileIndex) => ({ tileIndex, score: candidateScore(world, island, ordinal, placed, tileIndex) + random.fork(String(tileIndex)).float(0, 0.012) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => right.score - left.score || left.tileIndex - right.tileIndex);
  return ranked[0]?.tileIndex;
}

function settlementName(island: Island, ordinal: number, random: Random, primary: boolean): string {
  if (primary) return `${island.name.replace(/\s+(Island|Isle|Pulo)$/i, '')} Poblacion`;
  return `Barangay ${random.fork(`name-${ordinal}`).pick(BARANGAY_ROOTS)}`;
}

function manualCenterIndex(
  world: World,
  sourceIsland: Island,
  key: string,
  name: string,
  override: SettlementPositionOverride | undefined,
): { readonly centerIndex: number; readonly targetIsland: Island } | undefined {
  if (override === undefined) return undefined;
  const x = Math.round(override.x);
  const y = Math.round(override.y);
  const tile = world.getTile(x, y);
  if (tile === undefined) throw new InvalidPositionOverrideError('settlement', key, name, 'is outside the current map.');
  const targetIsland = nearestIsland(world, x, y, sourceIsland);
  return { centerIndex: tile.y * world.width + tile.x, targetIsland };
}

function applyGeneratedOverride(
  base: Settlement,
  override: SettlementAuthoringOverride | undefined,
): Settlement | null {
  if (override?.suppressed === true) return null;
  const kind = override?.kind ?? base.kind ?? kindFromType(base.type);
  return {
    ...base,
    name: override?.name?.trim() || base.name,
    type: override?.kind === undefined ? base.type : typeFromKind(kind),
    x: override?.x ?? base.x,
    y: override?.y ?? base.y,
    tileIndex: base.tileIndex,
    influenceRadius: Math.max(2, override?.radius ?? base.influenceRadius),
    source: 'generated',
    kind,
    parentKey: override?.parentKey ?? base.parentKey ?? null,
    rotation: override?.rotation ?? base.rotation ?? 0,
    populationTarget: Math.max(0, Math.round(override?.populationTarget ?? base.populationTarget)),
    density: Math.max(0, Math.min(1, override?.density ?? base.density ?? 0.65)),
    generateRoads: override?.generateRoads ?? base.generateRoads ?? true,
    generateBuildings: override?.generateBuildings ?? base.generateBuildings ?? true,
    locked: override?.locked ?? base.locked ?? false,
    hidden: override?.hidden ?? base.hidden ?? false,
    visibility: override?.visibility ?? base.visibility ?? 'players',
    notes: override?.notes ?? base.notes ?? '',
  };
}

function appendAuthoredSettlements(
  world: World,
  definitions: readonly AuthoredSettlementDefinition[],
  overrides: ReadonlyMap<string, SettlementAuthoringOverride>,
): void {
  const fallbackIsland = world.islands[0];
  if (fallbackIsland === undefined) return;
  for (const definition of definitions) {
    const override = overrides.get(definition.key);
    if (override?.suppressed === true) continue;
    const x = Math.max(0, Math.min(world.width - 1, Math.round(override?.x ?? definition.x)));
    const y = Math.max(0, Math.min(world.height - 1, Math.round(override?.y ?? definition.y)));
    const tile = world.getTileOrThrow(x, y);
    const island = nearestIsland(world, x, y, fallbackIsland);
    const kind = override?.kind ?? definition.kind;
    const settlement: Settlement = {
      id: world.settlements.length,
      key: definition.key,
      islandId: island.id,
      name: override?.name?.trim() || definition.name,
      type: typeFromKind(kind),
      x,
      y,
      tileIndex: world.indexOf(x, y),
      influenceRadius: Math.max(2, override?.radius ?? definition.radius),
      populationTarget: Math.max(0, Math.round(override?.populationTarget ?? definition.populationTarget)),
      isPrimary: false,
      source: 'authored',
      kind,
      parentKey: override?.parentKey ?? definition.parentKey,
      rotation: override?.rotation ?? definition.rotation,
      density: Math.max(0, Math.min(1, override?.density ?? definition.density)),
      locked: override?.locked ?? definition.locked,
      hidden: override?.hidden ?? definition.hidden,
      visibility: override?.visibility ?? definition.visibility,
      notes: override?.notes ?? definition.notes,
      generateRoads: override?.generateRoads ?? definition.generateRoads,
      generateBuildings: override?.generateBuildings ?? definition.generateBuildings,
      roadIds: [],
    };
    world.settlements.push(settlement);
    island.settlementIds.push(settlement.id);
    if (tile.water === WaterType.Land && tile.islandId === island.id && island.developmentLevel === DevelopmentLevel.Undeveloped) {
      island.developmentLevel = DevelopmentLevel.Village;
    }
    if (settlement.generateRoads !== false) island.allowRoads = true;
  }
}

export function generateSettlements(
  world: World,
  random: Random,
  positionOverrides: readonly SettlementPositionOverride[] = [],
  authoredDefinitions: readonly AuthoredSettlementDefinition[] = [],
  authoringOverrides: readonly SettlementAuthoringOverride[] = [],
): void {
  world.settlements = [];
  for (const island of world.islands) island.settlementIds = [];
  for (const tile of world.tiles) tile.settlementId = null;

  const overrideByKey = new Map(positionOverrides.map((override) => [override.key, override]));
  const authoringByKey = new Map(authoringOverrides.map((override) => [override.key, override]));
  const primaryIsland = world.islands.find((island) => island.role === IslandRole.PrimarySettlement) ?? world.islands[0];
  const placedSettlements: Settlement[] = [];
  for (const island of world.islands) {
    if (!island.allowRoads || island.settlementCountTarget <= 0 || island.allocatedPopulation <= 0) continue;
    const count = Math.max(1, island.settlementCountTarget);
    const populationWeights = Array.from({ length: count }, (_, index) => index === 0 ? 1.8 : 1 / (index + 0.5));
    const totalWeight = populationWeights.reduce((sum, value) => sum + value, 0);
    const islandSettlements: Settlement[] = [];

    for (let ordinal = 0; ordinal < count; ordinal += 1) {
      const isPrimary = island === primaryIsland && ordinal === 0;
      const key = `settlement:${island.key}:${ordinal}`;
      const name = settlementName(island, ordinal, random.fork(`${island.key}:settlement-name`), isPrimary);
      const authored = authoringByKey.get(key);
      if (authored?.suppressed === true) continue;
      const manualPosition: SettlementPositionOverride | undefined = authored?.x !== undefined && authored.y !== undefined
        ? { key, x: authored.x, y: authored.y }
        : overrideByKey.get(key);
      const manual = isPrimary ? undefined : manualCenterIndex(world, island, key, name, manualPosition);
      const centerIndex = manual?.centerIndex ?? selectCenter(world, island, islandSettlements, random.fork(`${island.key}:${ordinal}`), ordinal);
      const targetIsland = manual?.targetIsland ?? island;
      if (centerIndex === undefined) continue;
      const tile = world.tiles[centerIndex];
      if (tile === undefined) continue;
      const population = Math.max(80, Math.round(island.allocatedPopulation * (populationWeights[ordinal] ?? 0) / totalWeight));
      const type = settlementType(island, ordinal);
      const base: Settlement = {
        id: world.settlements.length,
        key,
        islandId: targetIsland.id,
        name,
        type,
        x: tile.x,
        y: tile.y,
        tileIndex: centerIndex,
        influenceRadius: influenceRadius(type, population),
        populationTarget: population,
        isPrimary,
        source: 'generated',
        kind: kindFromType(type),
        parentKey: null,
        rotation: 0,
        density: 0.65,
        locked: false,
        hidden: false,
        visibility: 'players',
        notes: '',
        generateRoads: true,
        generateBuildings: true,
        roadIds: [],
      };
      const settlement = applyGeneratedOverride(base, authored);
      if (settlement === null) continue;
      settlement.tileIndex = world.indexOf(Math.max(0, Math.min(world.width - 1, Math.round(settlement.x))), Math.max(0, Math.min(world.height - 1, Math.round(settlement.y))));
      world.settlements.push(settlement);
      placedSettlements.push(settlement);
      if (targetIsland === island) islandSettlements.push(settlement);
      targetIsland.settlementIds.push(settlement.id);
      if (settlement.generateRoads !== false) targetIsland.allowRoads = true;
    }
  }

  appendAuthoredSettlements(world, authoredDefinitions, authoringByKey);

  for (const island of world.islands) {
    island.allocatedPopulation = island.settlementIds.reduce((sum, id) => sum + (world.settlements[id]?.populationTarget ?? 0), 0);
  }

  for (const island of world.islands) {
    const settlements = island.settlementIds.map((id) => world.settlements[id]).filter((value): value is Settlement => value !== undefined && value.hidden !== true);
    if (settlements.length === 0) continue;
    const landmass = world.landmasses[island.landmassId];
    if (landmass === undefined) continue;
    for (const index of landmass.tileIndices) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      const nearest = [...settlements]
        .map((settlement) => ({ settlement, distance: Math.hypot(tile.x - settlement.x, tile.y - settlement.y) }))
        .filter((entry) => entry.distance <= entry.settlement.influenceRadius)
        .sort((left, right) => left.distance - right.distance || left.settlement.id - right.settlement.id)[0]?.settlement;
      if (nearest !== undefined) tile.settlementId = nearest.id;
    }
  }
}

export function alignPrimarySettlementToPlaza(world: World): void {
  const primary = world.settlements.find((settlement) => settlement.isPrimary);
  const plaza = world.anchors.find((anchor) => anchor.type === 'town-plaza');
  if (primary === undefined || plaza === undefined || primary.islandId !== world.tiles[plaza.tileIndex]?.islandId) return;
  primary.x = plaza.x;
  primary.y = plaza.y;
  primary.tileIndex = plaza.tileIndex;
}
