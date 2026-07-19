import type { TownScale } from '../generation/GenerationOptions';
import type { Random } from '../rng/Random';
import type { World } from '../world/World';
import { DevelopmentLevel, IslandRole, type Island, type IslandOverride } from './Island';

const ISLAND_ROOTS = [
  'Payaw', 'Dandansoy', 'Malipayon', 'Banwa', 'Marapara', 'Bagacay', 'Talisay', 'Sibucao',
  'Tinagong', 'Baybay', 'Mabini', 'San Isidro', 'Santa Clara', 'Balete', 'Himaya', 'Kahilwayan',
] as const;
const ISLAND_SUFFIXES = ['Island', 'Isle', 'Pulo'] as const;

function viability(world: World, landmassId: number): number {
  const landmass = world.landmasses[landmassId];
  if (landmass === undefined) return 0;
  const areaScale = Math.min(1, Math.log2(landmass.area + 1) / 14);
  const buildableRatio = landmass.buildableArea / Math.max(1, landmass.area);
  const coastRatio = landmass.coastlineLength / Math.max(1, landmass.area);
  return Math.max(0, Math.min(1,
    areaScale * 0.31
    + buildableRatio * 0.34
    + landmass.freshwaterScore * 0.13
    + Math.min(1, coastRatio * 4) * 0.08
    + (1 - landmass.averageSlope) * 0.09
    + (1 - landmass.averageFloodRisk) * 0.05,
  ));
}

function roleFor(world: World, landmassId: number, rank: number, townScale: TownScale): IslandRole {
  const landmass = world.landmasses[landmassId];
  if (landmass === undefined) return IslandRole.Uninhabited;
  if (rank === 0) return IslandRole.PrimarySettlement;
  const buildableRatio = landmass.buildableArea / Math.max(1, landmass.area);
  const coastRatio = landmass.coastlineLength / Math.max(1, landmass.area);
  if (landmass.area < 120) return landmass.averageForestDensity > 0.58 ? IslandRole.StoryIsland : IslandRole.Uninhabited;
  if (landmass.area < 240) return landmass.averageForestDensity > 0.48 ? IslandRole.ProtectedNature : IslandRole.Uninhabited;

  // Regional archipelagos need actual secondary communities rather than a
  // collection of protected islands surrounding one overloaded primary town.
  // The highest-ranked viable islands are therefore reserved as satellite
  // communities before the more conservative ecological classification runs.
  const regionalShape = world.metadata.terrainShape === 'archipelago' || world.metadata.terrainShape === 'twin-islands';
  const developedSecondaryTarget = townScale === 'urban' ? 3 : townScale === 'semi-urban' ? 2 : 1;
  const viableRegionalSettlement = regionalShape
    && rank <= developedSecondaryTarget
    && landmass.area >= 360
    && landmass.buildableArea >= 24
    && buildableRatio >= 0.04;
  if (viableRegionalSettlement) {
    if (buildableRatio >= 0.28 && landmass.freshwaterScore >= 0.08) return IslandRole.SatelliteTown;
    if (coastRatio >= 0.12) return IslandRole.PortHub;
    return IslandRole.RuralVillage;
  }

  if (landmass.averageForestDensity > 0.7 && buildableRatio < 0.34) return IslandRole.ProtectedNature;
  if (landmass.area > 1200 && buildableRatio > 0.44 && landmass.freshwaterScore > 0.18) return IslandRole.SatelliteTown;
  if (coastRatio > 0.18 && buildableRatio > 0.32 && landmass.area > 260) return IslandRole.PortHub;
  if (landmass.averageMoisture > 0.52 && buildableRatio > 0.48) return IslandRole.Agricultural;
  if (landmass.area > 180 && buildableRatio > 0.3) return IslandRole.RuralVillage;
  return landmass.averageForestDensity > 0.55 ? IslandRole.ProtectedNature : IslandRole.Uninhabited;
}

function developmentFor(role: IslandRole, score: number): DevelopmentLevel {
  if (role === IslandRole.Uninhabited || role === IslandRole.ProtectedNature || role === IslandRole.StoryIsland) return DevelopmentLevel.Undeveloped;
  if (role === IslandRole.PrimarySettlement) return score >= 0.7 ? DevelopmentLevel.Urban : DevelopmentLevel.Town;
  if (role === IslandRole.SatelliteTown || role === IslandRole.PortHub) return score >= 0.58 ? DevelopmentLevel.Town : DevelopmentLevel.Village;
  if (role === IslandRole.RuralVillage || role === IslandRole.Agricultural || role === IslandRole.Industrial) return DevelopmentLevel.Village;
  return DevelopmentLevel.Hamlet;
}

function baseSettlementCount(role: IslandRole, development: DevelopmentLevel, area: number): number {
  if (development === DevelopmentLevel.Undeveloped) return 0;
  if (role === IslandRole.PrimarySettlement) return area > 12000 ? 3 : area > 5000 ? 2 : 1;
  if (role === IslandRole.SatelliteTown && area > 2500) return 2;
  if (role === IslandRole.PortHub && area > 1800) return 2;
  return 1;
}

function totalPopulation(scale: TownScale): number {
  switch (scale) {
    case 'rural': return 4_800;
    case 'semi-urban': return 22_000;
    case 'urban': return 78_000;
  }
  return 22_000;
}

function roleWeight(role: IslandRole): number {
  switch (role) {
    case IslandRole.PrimarySettlement: return 3.8;
    case IslandRole.SatelliteTown: return 1.8;
    case IslandRole.PortHub: return 1.45;
    case IslandRole.RuralVillage: return 0.9;
    case IslandRole.Agricultural: return 0.72;
    case IslandRole.Industrial: return 0.85;
    case IslandRole.ProtectedNature:
    case IslandRole.StoryIsland:
    case IslandRole.Uninhabited: return 0;
  }
  return 0;
}

function uniqueIslandName(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let suffix = 2;
  while (used.has(`${candidate} ${suffix}`)) suffix += 1;
  const value = `${candidate} ${suffix}`;
  used.add(value);
  return value;
}

function applyOverride(island: Island, override: IslandOverride | undefined): void {
  if (override === undefined) return;
  if (override.name?.trim()) island.name = override.name.trim();
  if (override.role !== undefined) island.role = override.role;
  if (override.developmentLevel !== undefined) island.developmentLevel = override.developmentLevel;
  if (override.populationWeight !== undefined && Number.isFinite(override.populationWeight)) island.populationWeight = Math.max(0, Math.min(10, override.populationWeight));
  if (override.settlementCount !== undefined && Number.isFinite(override.settlementCount)) island.settlementCountTarget = Math.max(0, Math.min(6, Math.round(override.settlementCount)));
  if (override.allowBridges !== undefined) island.allowBridges = override.allowBridges;
  if (override.allowPorts !== undefined) island.allowPorts = override.allowPorts;
  if (override.allowRoads !== undefined) island.allowRoads = override.allowRoads;
  if (override.allowStoryPoints !== undefined) island.allowStoryPoints = override.allowStoryPoints;
  if (override.preserveNature !== undefined) island.preserveNature = override.preserveNature;
  if (override.locked !== undefined) island.locked = override.locked;
  if (island.role === IslandRole.Uninhabited || island.role === IslandRole.ProtectedNature || island.role === IslandRole.StoryIsland) {
    island.developmentLevel = DevelopmentLevel.Undeveloped;
    island.settlementCountTarget = override.settlementCount === undefined ? 0 : island.settlementCountTarget;
  }
}


function applySatelliteSettlementTarget(
  world: World,
  satelliteSettlementCount: number,
  overrides: readonly IslandOverride[],
): void {
  const primary = world.islands.find((island) => island.role === IslandRole.PrimarySettlement) ?? world.islands[0];
  if (primary === undefined) return;
  const explicitCounts = new Set(
    overrides.filter((override) => override.settlementCount !== undefined).map((override) => override.key),
  );

  for (const island of world.islands) {
    if (explicitCounts.has(island.key)) continue;
    island.settlementCountTarget = island === primary ? 1 : 0;
  }

  let remaining = Math.max(0, Math.min(12, Math.round(satelliteSettlementCount)));
  const secondaryCandidates = world.islands
    .filter((island) => island !== primary && island.allowRoads && roleWeight(island.role) > 0)
    .sort((left, right) => right.viabilityScore - left.viabilityScore || left.id - right.id);
  const candidates = [...secondaryCandidates, primary];

  while (remaining > 0) {
    let allocatedThisPass = false;
    for (const island of candidates) {
      if (remaining <= 0) break;
      if (explicitCounts.has(island.key)) continue;
      const maximum = island === primary ? 13 : 3;
      if (island.settlementCountTarget >= maximum) continue;
      island.settlementCountTarget += 1;
      remaining -= 1;
      allocatedThisPass = true;
    }
    if (!allocatedThisPass) break;
  }
}

export function generateIslands(
  world: World,
  townScale: TownScale,
  random: Random,
  overrides: readonly IslandOverride[] = [],
  maximumIslandCount?: number,
  satelliteSettlementCount = 4,
): void {
  const minimumArea = Math.max(20, Math.floor(world.tiles.length * 0.00042));
  const candidates = world.landmasses
    .filter((landmass) => landmass.area >= minimumArea)
    .map((landmass) => ({ landmass, score: viability(world, landmass.id) }))
    .sort((left, right) => right.landmass.area - left.landmass.area || right.score - left.score || left.landmass.id - right.landmass.id)
    .slice(0, maximumIslandCount === undefined ? 18 : Math.max(1, Math.min(18, Math.round(maximumIslandCount))));

  if (candidates.length === 0) {
    const fallback = [...world.landmasses].sort((left, right) => right.area - left.area || left.id - right.id)[0];
    if (fallback !== undefined) candidates.push({ landmass: fallback, score: viability(world, fallback.id) });
  }

  const usedNames = new Set<string>();
  world.islands = candidates.map(({ landmass, score }, rank): Island => {
    const stream = random.fork(landmass.key);
    const role = roleFor(world, landmass.id, rank, townScale);
    const developmentLevel = developmentFor(role, score);
    const generatedName = rank === 0
      ? 'Payaw Island'
      : `${stream.pick(ISLAND_ROOTS)} ${stream.pick(ISLAND_SUFFIXES)}`;
    const island: Island = {
      id: rank,
      key: `island:${landmass.key}`,
      landmassId: landmass.id,
      name: generatedName,
      role,
      developmentLevel,
      viabilityScore: score,
      populationCapacity: Math.max(0, Math.round(landmass.buildableArea * (8 + score * 12))),
      allocatedPopulation: 0,
      populationWeight: 1,
      settlementCountTarget: baseSettlementCount(role, developmentLevel, landmass.area),
      settlementIds: [],
      bridgeIds: [],
      portIds: [],
      allowBridges: role !== IslandRole.ProtectedNature && role !== IslandRole.StoryIsland,
      allowPorts: landmass.coastlineLength > 8 && role !== IslandRole.ProtectedNature,
      allowRoads: developmentLevel !== DevelopmentLevel.Undeveloped,
      allowStoryPoints: role !== IslandRole.Industrial,
      preserveNature: role === IslandRole.ProtectedNature || role === IslandRole.StoryIsland,
      locked: false,
    };
    applyOverride(island, overrides.find((item) => item.key === island.key));
    island.name = uniqueIslandName(island.name, usedNames);
    return island;
  });

  const explicitPrimary = world.islands.find((island) => island.role === IslandRole.PrimarySettlement);
  const canonicalPrimary = explicitPrimary ?? world.islands[0];
  if (canonicalPrimary !== undefined) {
    canonicalPrimary.role = IslandRole.PrimarySettlement;
    if (canonicalPrimary.developmentLevel === DevelopmentLevel.Undeveloped) canonicalPrimary.developmentLevel = DevelopmentLevel.Town;
    canonicalPrimary.settlementCountTarget = Math.max(1, canonicalPrimary.settlementCountTarget);
    canonicalPrimary.allowRoads = true;
    for (const island of world.islands) {
      if (island !== canonicalPrimary && island.role === IslandRole.PrimarySettlement) {
        island.role = island.viabilityScore >= 0.5 ? IslandRole.SatelliteTown : IslandRole.RuralVillage;
      }
    }
  }

  applySatelliteSettlementTarget(world, satelliteSettlementCount, overrides);

  for (const tile of world.tiles) tile.islandId = null;
  for (const island of world.islands) {
    const landmass = world.landmasses[island.landmassId];
    if (landmass === undefined) continue;
    for (const index of landmass.tileIndices) {
      const tile = world.tiles[index];
      if (tile !== undefined) tile.islandId = island.id;
    }
  }

  const inhabitable = world.islands.filter((island) => roleWeight(island.role) > 0 && island.settlementCountTarget > 0);
  const budget = totalPopulation(townScale);
  const primary = inhabitable.find((island) => island.role === IslandRole.PrimarySettlement) ?? inhabitable[0];
  if (primary === undefined) return;
  const primaryShare = townScale === 'urban' ? 0.56 : townScale === 'semi-urban' ? 0.64 : 0.72;
  primary.allocatedPopulation = Math.min(primary.populationCapacity, Math.round(budget * primaryShare));
  let remaining = Math.max(0, budget - primary.allocatedPopulation);
  const others = inhabitable.filter((island) => island !== primary);
  const weights = others.map((island) => Math.max(0.001, Math.pow(island.viabilityScore, 1.25) * roleWeight(island.role) * island.populationWeight));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < others.length; index += 1) {
    const island = others[index];
    const weight = weights[index] ?? 0;
    if (island === undefined) continue;
    const allocation = totalWeight > 0 ? Math.round(remaining * weight / totalWeight) : 0;
    island.allocatedPopulation = Math.min(island.populationCapacity, allocation);
  }
  const allocated = world.islands.reduce((sum, island) => sum + island.allocatedPopulation, 0);
  if (allocated < budget) primary.allocatedPopulation = Math.min(primary.populationCapacity, primary.allocatedPopulation + (budget - allocated));
}
