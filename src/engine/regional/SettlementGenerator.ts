import type { SettlementPositionOverride } from '../generation/GenerationOptions';
import { InvalidPositionOverrideError } from '../generation/InvalidPositionOverrideError';
import type { Random } from '../rng/Random';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { DevelopmentLevel, IslandRole, type Island } from './Island';
import { SettlementType, type Settlement } from './Settlement';

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
  island: Island,
  key: string,
  name: string,
  override: SettlementPositionOverride | undefined,
  placed: readonly Settlement[],
): number | undefined {
  if (override === undefined) return undefined;
  const x = Math.round(override.x);
  const y = Math.round(override.y);
  const tile = world.getTile(x, y);
  if (tile === undefined) throw new InvalidPositionOverrideError('settlement', key, name, 'is outside the current map.');
  if (tile.islandId !== island.id || tile.landmassId !== island.landmassId) {
    throw new InvalidPositionOverrideError('settlement', key, name, 'must remain on its assigned island.');
  }
  if (tile.water !== WaterType.Land || tile.river) {
    throw new InvalidPositionOverrideError('settlement', key, name, 'must be on dry land.');
  }
  if (tile.terrain === TerrainType.Mountain || tile.slope > 0.38) {
    throw new InvalidPositionOverrideError('settlement', key, name, 'is too steep for a settlement center.');
  }
  if (tile.floodRisk > 0.92) {
    throw new InvalidPositionOverrideError('settlement', key, name, 'is too flood-prone for a settlement center.');
  }
  const nearest = placed.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...placed.map((settlement) => Math.hypot(tile.x - settlement.x, tile.y - settlement.y)));
  if (nearest < 6) {
    throw new InvalidPositionOverrideError('settlement', key, name, 'is too close to another settlement center.');
  }
  return tile.y * world.width + tile.x;
}

export function generateSettlements(
  world: World,
  random: Random,
  positionOverrides: readonly SettlementPositionOverride[] = [],
): void {
  world.settlements = [];
  for (const island of world.islands) island.settlementIds = [];
  for (const tile of world.tiles) tile.settlementId = null;

  const overrideByKey = new Map(positionOverrides.map((override) => [override.key, override]));
  const primaryIsland = world.islands.find((island) => island.role === IslandRole.PrimarySettlement) ?? world.islands[0];
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
      // The main Poblacion remains governed by the Town Plaza anchor. All other
      // settlement centers can be moved non-destructively through overrides.
      const manual = isPrimary
        ? undefined
        : manualCenterIndex(world, island, key, name, overrideByKey.get(key), islandSettlements);
      const centerIndex = manual ?? selectCenter(world, island, islandSettlements, random.fork(`${island.key}:${ordinal}`), ordinal);
      if (centerIndex === undefined) continue;
      const tile = world.tiles[centerIndex];
      if (tile === undefined) continue;
      const population = Math.max(80, Math.round(island.allocatedPopulation * (populationWeights[ordinal] ?? 0) / totalWeight));
      const type = settlementType(island, ordinal);
      const settlement: Settlement = {
        id: world.settlements.length,
        key,
        islandId: island.id,
        name,
        type,
        x: tile.x,
        y: tile.y,
        tileIndex: centerIndex,
        influenceRadius: influenceRadius(type, population),
        populationTarget: population,
        isPrimary,
        roadIds: [],
      };
      world.settlements.push(settlement);
      islandSettlements.push(settlement);
      island.settlementIds.push(settlement.id);
    }
  }

  for (const island of world.islands) {
    const settlements = island.settlementIds.map((id) => world.settlements[id]).filter((value): value is Settlement => value !== undefined);
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
