import type { BridgeConfig, RoadConfig } from '../config/GenerationConfig';
import type { GridPoint } from '../geography/Landmass';
import { findGridPath } from '../graph/Pathfinder';
import type { Random } from '../rng/Random';
import { IslandRole, type Island } from '../regional/Island';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { BridgeType, type Bridge, type BridgeOverride, type CustomBridgeDefinition } from './Bridge';
import { RoadType, type Road } from './Road';

interface BridgeCandidate {
  readonly fromIslandId: number;
  readonly toIslandId: number;
  readonly startTileIndex: number;
  readonly endTileIndex: number;
  readonly path: readonly number[];
  readonly length: number;
  readonly averageDepth: number;
  readonly approachDistance: number;
  readonly cost: number;
  readonly benefit: number;
  readonly score: number;
}

class DisjointSet {
  private readonly parent: number[];

  public constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  public find(value: number): number {
    const parent = this.parent[value];
    if (parent === undefined) return value;
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent[value] = root;
    return root;
  }

  public union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent[rightRoot] = leftRoot;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function bridgePairKey(left: Island, right: Island): string {
  return left.key < right.key ? `${left.key}::${right.key}` : `${right.key}::${left.key}`;
}

function lineTileIndices(world: World, startIndex: number, endIndex: number): readonly number[] {
  const start = world.tiles[startIndex];
  const end = world.tiles[endIndex];
  if (start === undefined || end === undefined) return [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 1.5));
  const result: number[] = [];
  let previous = -1;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = Math.round(start.x + dx * t);
    const y = Math.round(start.y + dy * t);
    if (!world.contains(x, y)) return [];
    const index = y * world.width + x;
    if (index !== previous) result.push(index);
    previous = index;
  }
  return result;
}

function sampleCoastline(indices: readonly number[], maximumPoints: number): readonly number[] {
  if (indices.length <= maximumPoints) return indices;
  const step = Math.max(1, Math.ceil(indices.length / maximumPoints));
  return indices.filter((_, index) => index % step === 0).slice(0, maximumPoints);
}

function roadTileIndicesForIsland(world: World, islandId: number): readonly number[] {
  const result = new Set<number>();
  for (const road of world.roads) {
    if (road.bridgeId !== null) continue;
    for (const index of road.path) {
      if (world.tiles[index]?.islandId === islandId) result.add(index);
    }
  }
  return [...result];
}

function nearestRoadDistance(world: World, islandId: number, tileIndex: number): number {
  const tile = world.tiles[tileIndex];
  if (tile === undefined) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const roadIndex of roadTileIndicesForIsland(world, islandId)) {
    const roadTile = world.tiles[roadIndex];
    if (roadTile === undefined) continue;
    best = Math.min(best, Math.hypot(roadTile.x - tile.x, roadTile.y - tile.y));
  }
  if (Number.isFinite(best)) return best;
  const island = world.islands[islandId];
  if (island === undefined) return best;
  for (const settlementId of island.settlementIds) {
    const settlement = world.settlements[settlementId];
    if (settlement !== undefined) best = Math.min(best, Math.hypot(settlement.x - tile.x, settlement.y - tile.y));
  }
  return best;
}

function candidateFromEndpoints(
  world: World,
  config: BridgeConfig,
  fromIsland: Island,
  toIsland: Island,
  startTileIndex: number,
  endTileIndex: number,
  hardMaximumSpan = config.maximumSpan,
): BridgeCandidate | undefined {
  const start = world.tiles[startTileIndex];
  const end = world.tiles[endTileIndex];
  if (start === undefined || end === undefined) return undefined;
  if (start.islandId !== fromIsland.id || end.islandId !== toIsland.id) return undefined;
  const directDistance = Math.hypot(end.x - start.x, end.y - start.y);
  if (directDistance < config.minimumSpan || directDistance > hardMaximumSpan) return undefined;
  const path = lineTileIndices(world, startTileIndex, endTileIndex);
  if (path.length < 3) return undefined;

  let waterTiles = 0;
  let depthSum = 0;
  for (let offset = 1; offset < path.length - 1; offset += 1) {
    const tile = world.tiles[path[offset] ?? -1];
    if (tile === undefined) return undefined;
    if (tile.water === WaterType.Land) return undefined;
    if (tile.islandId !== null && tile.islandId !== fromIsland.id && tile.islandId !== toIsland.id) return undefined;
    waterTiles += 1;
    depthSum += tile.waterDepth;
  }
  if (waterTiles < Math.max(2, Math.floor(path.length * 0.48))) return undefined;

  const averageDepth = depthSum / Math.max(1, waterTiles);
  const approachDistance = nearestRoadDistance(world, fromIsland.id, startTileIndex)
    + nearestRoadDistance(world, toIsland.id, endTileIndex);
  if (!Number.isFinite(approachDistance)) return undefined;

  const fromLandmass = world.landmasses[fromIsland.landmassId];
  const toLandmass = world.landmasses[toIsland.landmassId];
  if (fromLandmass === undefined || toLandmass === undefined) return undefined;
  const towardOtherX = end.x - start.x;
  const towardOtherY = end.y - start.y;
  const outwardA = (start.x - fromLandmass.centroid.x) * towardOtherX + (start.y - fromLandmass.centroid.y) * towardOtherY;
  const outwardB = (end.x - toLandmass.centroid.x) * -towardOtherX + (end.y - toLandmass.centroid.y) * -towardOtherY;
  const facingPenalty = (outwardA < 0 ? config.badShorelineAnglePenalty : 0)
    + (outwardB < 0 ? config.badShorelineAnglePenalty : 0);

  const population = Math.max(1, fromIsland.allocatedPopulation) + Math.max(1, toIsland.allocatedPopulation);
  const roleBonus = (fromIsland.role === IslandRole.PrimarySettlement || toIsland.role === IslandRole.PrimarySettlement ? 1.1 : 0)
    + (fromIsland.role === IslandRole.PortHub || toIsland.role === IslandRole.PortHub ? 0.5 : 0);
  const benefit = Math.log1p(population) * config.populationBenefitWeight + roleBonus * config.roleBenefitWeight;
  const cost = directDistance * config.spanCostWeight
    + averageDepth * config.depthCostWeight
    + (start.slope + end.slope) * config.approachSlopeCostWeight
    + approachDistance * config.approachRoadCostWeight
    + facingPenalty;
  return {
    fromIslandId: fromIsland.id,
    toIslandId: toIsland.id,
    startTileIndex,
    endTileIndex,
    path,
    length: directDistance,
    averageDepth,
    approachDistance,
    cost,
    benefit,
    score: benefit - cost,
  };
}

function bestCandidateForPair(
  world: World,
  config: BridgeConfig,
  fromIsland: Island,
  toIsland: Island,
  hardMaximumSpan = config.maximumSpan,
  forcedStart?: GridPoint,
  forcedEnd?: GridPoint,
): BridgeCandidate | undefined {
  const fromLandmass = world.landmasses[fromIsland.landmassId];
  const toLandmass = world.landmasses[toIsland.landmassId];
  if (fromLandmass === undefined || toLandmass === undefined) return undefined;

  const nearestCoast = (island: Island, point: GridPoint | undefined): number | undefined => {
    if (point === undefined) return undefined;
    const landmass = world.landmasses[island.landmassId];
    if (landmass === undefined) return undefined;
    return [...landmass.coastlineTileIndices].sort((leftIndex, rightIndex) => {
      const left = world.tiles[leftIndex];
      const right = world.tiles[rightIndex];
      if (left === undefined || right === undefined) return leftIndex - rightIndex;
      return Math.hypot(left.x + 0.5 - point.x, left.y + 0.5 - point.y)
        - Math.hypot(right.x + 0.5 - point.x, right.y + 0.5 - point.y)
        || leftIndex - rightIndex;
    })[0];
  };

  const forcedStartIndex = nearestCoast(fromIsland, forcedStart);
  const forcedEndIndex = nearestCoast(toIsland, forcedEnd);
  if (forcedStartIndex !== undefined && forcedEndIndex !== undefined) {
    return candidateFromEndpoints(world, config, fromIsland, toIsland, forcedStartIndex, forcedEndIndex, hardMaximumSpan);
  }

  const fromCoast = forcedStartIndex === undefined
    ? sampleCoastline(fromLandmass.coastlineTileIndices, config.maximumCoastSamples)
    : [forcedStartIndex];
  const toCoast = forcedEndIndex === undefined
    ? sampleCoastline(toLandmass.coastlineTileIndices, config.maximumCoastSamples)
    : [forcedEndIndex];
  let best: BridgeCandidate | undefined;
  for (const startIndex of fromCoast) {
    const start = world.tiles[startIndex];
    if (start === undefined) continue;
    for (const endIndex of toCoast) {
      const end = world.tiles[endIndex];
      if (end === undefined) continue;
      const roughDistance = Math.hypot(end.x - start.x, end.y - start.y);
      if (roughDistance > hardMaximumSpan || roughDistance < config.minimumSpan) continue;
      const candidate = candidateFromEndpoints(world, config, fromIsland, toIsland, startIndex, endIndex, hardMaximumSpan);
      if (candidate === undefined) continue;
      if (best === undefined || candidate.score > best.score || (candidate.score === best.score && candidate.startTileIndex < best.startTileIndex)) best = candidate;
    }
  }
  return best;
}

function selectAutomaticCandidates(world: World, config: BridgeConfig): readonly BridgeCandidate[] {
  const eligible = world.islands.filter((island) => (
    island.allowBridges
    && island.allowRoads
    && island.settlementIds.length > 0
    && island.allocatedPopulation > 0
  ));
  if (eligible.length < 2) return [];
  const candidates: BridgeCandidate[] = [];
  for (let left = 0; left < eligible.length; left += 1) {
    const from = eligible[left];
    if (from === undefined) continue;
    for (let right = left + 1; right < eligible.length; right += 1) {
      const to = eligible[right];
      if (to === undefined) continue;
      const candidate = bestCandidateForPair(world, config, from, to);
      if (candidate !== undefined) candidates.push(candidate);
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.length - right.length || left.startTileIndex - right.startTileIndex);

  const selected: BridgeCandidate[] = [];
  const set = new DisjointSet(world.islands.length);
  for (const candidate of candidates) {
    if (selected.length >= config.maximumBridges) break;
    if (set.find(candidate.fromIslandId) === set.find(candidate.toIslandId)) continue;
    selected.push(candidate);
    set.union(candidate.fromIslandId, candidate.toIslandId);
  }

  for (const candidate of candidates) {
    if (selected.length >= config.maximumBridges + config.extraBridgeConnections) break;
    if (selected.includes(candidate) || candidate.score < config.minimumExtraConnectionScore) continue;
    const duplicatePair = selected.some((item) => (
      item.fromIslandId === candidate.fromIslandId && item.toIslandId === candidate.toIslandId
    ) || (
      item.fromIslandId === candidate.toIslandId && item.toIslandId === candidate.fromIslandId
    ));
    if (!duplicatePair) selected.push(candidate);
  }
  return selected;
}

function bridgeTypeFor(candidate: BridgeCandidate, world: World): BridgeType {
  const combinedPopulation = (world.islands[candidate.fromIslandId]?.allocatedPopulation ?? 0)
    + (world.islands[candidate.toIslandId]?.allocatedPopulation ?? 0);
  if (candidate.length <= 8 && candidate.averageDepth <= 0.055) return BridgeType.Causeway;
  if (combinedPopulation < 900 && candidate.length <= 14) return BridgeType.Footbridge;
  if (candidate.length <= 18) return BridgeType.LocalBridge;
  if (candidate.length <= 34 && combinedPopulation >= 6500) return BridgeType.HighwayBridge;
  return BridgeType.LongSpanBridge;
}

function roadClassFor(type: BridgeType): RoadType {
  return type === BridgeType.HighwayBridge || type === BridgeType.LongSpanBridge ? RoadType.Main : RoadType.Secondary;
}

function defaultDeckWidth(type: BridgeType): number {
  switch (type) {
    case BridgeType.Footbridge: return 0.65;
    case BridgeType.Causeway: return 1.05;
    case BridgeType.LocalBridge: return 1.15;
    case BridgeType.HighwayBridge: return 1.65;
    case BridgeType.LongSpanBridge: return 1.45;
  }
}

function supportsFor(world: World, candidate: BridgeCandidate, spacing: number): readonly GridPoint[] {
  const points: GridPoint[] = [];
  for (let offset = spacing; offset < candidate.path.length - 1; offset += spacing) {
    const tile = world.tiles[candidate.path[offset] ?? -1];
    if (tile !== undefined && tile.water !== WaterType.Land) points.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
  }
  return points;
}

function shortIslandName(name: string): string {
  return name.replace(/\b(Island|Isla)\b/gi, '').replace(/\s+/g, ' ').trim() || name;
}

function generatedBridgeName(world: World, candidate: BridgeCandidate): string {
  const from = world.islands[candidate.fromIslandId]?.name ?? 'North';
  const to = world.islands[candidate.toIslandId]?.name ?? 'South';
  return `${shortIslandName(from)}–${shortIslandName(to)} Bridge`;
}

function buildBridge(
  world: World,
  candidate: BridgeCandidate,
  key: string,
  generated: boolean,
  definition: CustomBridgeDefinition | undefined,
  override: BridgeOverride | undefined,
  config: BridgeConfig,
): Bridge | undefined {
  if (override?.suppressed === true) return undefined;
  const inferredType = bridgeTypeFor(candidate, world);
  const type = override?.type ?? definition?.type ?? inferredType;
  const roadClass = override?.roadClass ?? definition?.roadClass ?? roadClassFor(type);
  const startTile = world.tiles[candidate.startTileIndex];
  const endTile = world.tiles[candidate.endTileIndex];
  if (startTile === undefined || endTile === undefined) return undefined;
  const deckTileIndices = candidate.path.filter((index) => world.tiles[index]?.water !== WaterType.Land);
  return {
    id: world.bridges.length,
    key,
    name: override?.name?.trim() || definition?.name.trim() || generatedBridgeName(world, candidate),
    fromIslandId: candidate.fromIslandId,
    toIslandId: candidate.toIslandId,
    start: { x: startTile.x + 0.5, y: startTile.y + 0.5 },
    end: { x: endTile.x + 0.5, y: endTile.y + 0.5 },
    startTileIndex: candidate.startTileIndex,
    endTileIndex: candidate.endTileIndex,
    centerline: candidate.path.map((index) => {
      const tile = world.tiles[index];
      return { x: (tile?.x ?? 0) + 0.5, y: (tile?.y ?? 0) + 0.5 };
    }),
    deckTileIndices,
    type,
    roadClass,
    length: candidate.length,
    deckWidth: clamp(override?.deckWidth ?? definition?.deckWidth ?? defaultDeckWidth(type), 0.4, 3.5),
    clearance: clamp(override?.clearance ?? definition?.clearance ?? Math.max(2, candidate.averageDepth * 60), 0, 40),
    approachRoadIds: [],
    deckRoadId: null,
    supportPoints: supportsFor(world, candidate, Math.max(4, Math.round(config.supportSpacing))),
    generated,
    locked: override?.locked ?? definition?.locked ?? false,
  };
}

function bridgeApproachCost(world: World, islandId: number, toIndex: number, config: RoadConfig): number {
  const tile = world.tiles[toIndex];
  if (tile === undefined || tile.water !== WaterType.Land || tile.islandId !== islandId) return Number.POSITIVE_INFINITY;
  let cost = 1 + tile.slope * config.slopeWeight + tile.floodRisk * config.floodplainPenalty;
  if (tile.terrain === TerrainType.Mountain) cost += config.mountainPenalty;
  if (tile.terrain === TerrainType.Forest) cost += config.forestPenalty;
  if (tile.river) cost += config.riverCrossingPenalty;
  if (tile.road) cost *= config.existingRoadDiscount;
  return cost;
}

function nearestRoadOrSettlement(world: World, islandId: number, endpointIndex: number): number | undefined {
  const endpoint = world.tiles[endpointIndex];
  if (endpoint === undefined) return undefined;
  let bestIndex: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const road of world.roads) {
    if (road.bridgeId !== null) continue;
    for (const index of road.path) {
      const tile = world.tiles[index];
      if (tile?.islandId !== islandId) continue;
      const distance = Math.hypot(tile.x - endpoint.x, tile.y - endpoint.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
  }
  if (bestIndex !== undefined) return bestIndex;
  const island = world.islands[islandId];
  for (const settlementId of island?.settlementIds ?? []) {
    const settlement = world.settlements[settlementId];
    if (settlement === undefined) continue;
    const distance = Math.hypot(settlement.x - endpoint.x, settlement.y - endpoint.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = settlement.tileIndex;
    }
  }
  return bestIndex;
}

function makeRoad(world: World, type: RoadType, path: readonly number[], bridgeId: number, bridgeTiles: readonly number[] = []): Road {
  return {
    id: world.roads.length,
    name: '',
    type,
    path: [...path],
    bridgeTiles: [...bridgeTiles],
    connectsAnchorIds: [],
    connectsSettlementIds: [],
    length: path.length,
    bridgeId,
    portId: null,
  };
}

function commitRoad(world: World, road: Road): void {
  for (const index of road.path) {
    const tile = world.tiles[index];
    if (tile === undefined) throw new Error('Bridge road referenced an invalid tile.');
    tile.road = true;
    tile.roadId ??= road.id;
  }
  for (const index of road.bridgeTiles) {
    const tile = world.tiles[index];
    if (tile !== undefined) tile.bridge = true;
  }
  world.roads.push(road);
}

function routeApproach(world: World, bridge: Bridge, islandId: number, endpointIndex: number, roadConfig: RoadConfig): number | undefined {
  const target = nearestRoadOrSettlement(world, islandId, endpointIndex);
  if (target === undefined) return undefined;
  const path = findGridPath(world, {
    startIndex: endpointIndex,
    goalIndex: target,
    traversalCost: (_from, to) => bridgeApproachCost(world, islandId, to, roadConfig),
    maximumVisited: Math.min(roadConfig.maximumPathVisits, 30_000),
  });
  if (path.length === 0) return undefined;
  if (path.length === 1 && world.tiles[endpointIndex]?.road === true) return undefined;
  const road = makeRoad(world, bridge.roadClass, path, bridge.id);
  commitRoad(world, road);
  return road.id;
}

function commitBridge(world: World, bridge: Bridge, roadConfig: RoadConfig): void {
  world.bridges.push(bridge);
  const fromIsland = world.islands[bridge.fromIslandId];
  const toIsland = world.islands[bridge.toIslandId];
  fromIsland?.bridgeIds.push(bridge.id);
  toIsland?.bridgeIds.push(bridge.id);

  const fromApproach = routeApproach(world, bridge, bridge.fromIslandId, bridge.startTileIndex, roadConfig);
  const toApproach = routeApproach(world, bridge, bridge.toIslandId, bridge.endTileIndex, roadConfig);
  if (fromApproach !== undefined) bridge.approachRoadIds.push(fromApproach);
  if (toApproach !== undefined) bridge.approachRoadIds.push(toApproach);

  const deckRoad = makeRoad(world, bridge.roadClass, bridge.centerline.map((point) => {
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    return y * world.width + x;
  }), bridge.id, bridge.deckTileIndices);
  commitRoad(world, deckRoad);
  bridge.deckRoadId = deckRoad.id;
}

function resetBridgeInfrastructure(world: World): void {
  const baseRoads = world.roads.filter((road) => road.bridgeId === null && road.portId === null);
  world.roads = baseRoads;
  world.bridges = [];
  world.ports = [];
  world.waterRoutes = [];
  for (const island of world.islands) { island.bridgeIds = []; island.portIds = []; }
  const retainedRoadIds = new Set(baseRoads.map((road) => road.id));
  for (const settlement of world.settlements) settlement.roadIds = settlement.roadIds.filter((id) => retainedRoadIds.has(id));
  for (const tile of world.tiles) {
    tile.road = false;
    tile.roadId = null;
    tile.bridge = false;
  }
  for (const road of baseRoads) {
    for (const index of road.path) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      tile.road = true;
      tile.roadId ??= road.id;
    }
    for (const index of road.bridgeTiles) {
      const tile = world.tiles[index];
      if (tile !== undefined) tile.bridge = true;
    }
  }
}

function validateBridges(world: World): void {
  for (const bridge of world.bridges) {
    const start = world.tiles[bridge.startTileIndex];
    const end = world.tiles[bridge.endTileIndex];
    if (start?.islandId !== bridge.fromIslandId || end?.islandId !== bridge.toIslandId) {
      throw new Error(`${bridge.name} has invalid island endpoints.`);
    }
    if (bridge.fromIslandId === bridge.toIslandId) throw new Error(`${bridge.name} connects an island to itself.`);
    if (bridge.deckTileIndices.length === 0) throw new Error(`${bridge.name} does not cross water.`);
    if (bridge.deckRoadId === null || world.roads[bridge.deckRoadId]?.bridgeId !== bridge.id) {
      throw new Error(`${bridge.name} is missing its deck road.`);
    }
    for (const index of bridge.deckTileIndices) {
      const tile = world.tiles[index];
      if (tile === undefined || tile.water === WaterType.Land || !tile.bridge || !tile.road) {
        throw new Error(`${bridge.name} contains an invalid bridge deck tile.`);
      }
    }
  }
}

export function generateBridgeNetwork(
  world: World,
  config: BridgeConfig,
  roadConfig: RoadConfig,
  _random: Random,
  overrides: readonly BridgeOverride[],
  customDefinitions: readonly CustomBridgeDefinition[],
): void {
  resetBridgeInfrastructure(world);
  const overrideByKey = new Map(overrides.map((override) => [override.key, override]));
  const usedPairs = new Set<string>();

  for (const definition of customDefinitions) {
    const fromIsland = world.islands.find((island) => island.key === definition.fromIslandKey);
    const toIsland = world.islands.find((island) => island.key === definition.toIslandKey);
    if (fromIsland === undefined || toIsland === undefined || fromIsland.id === toIsland.id) continue;
    const override = overrideByKey.get(definition.key);
    const candidate = bestCandidateForPair(
      world,
      config,
      fromIsland,
      toIsland,
      config.maximumManualSpan,
      override?.start ?? definition.start,
      override?.end ?? definition.end,
    );
    if (candidate === undefined) continue;
    const bridge = buildBridge(world, candidate, definition.key, false, definition, override, config);
    if (bridge === undefined) continue;
    commitBridge(world, bridge, roadConfig);
    usedPairs.add(bridgePairKey(fromIsland, toIsland));
  }

  const automatic = selectAutomaticCandidates(world, config);
  for (const candidate of automatic) {
    const fromIsland = world.islands[candidate.fromIslandId];
    const toIsland = world.islands[candidate.toIslandId];
    if (fromIsland === undefined || toIsland === undefined) continue;
    const pairKey = bridgePairKey(fromIsland, toIsland);
    if (usedPairs.has(pairKey)) continue;
    const key = `bridge:auto:${pairKey}`;
    const override = overrideByKey.get(key);
    let effectiveCandidate = candidate;
    if (override?.start !== undefined || override?.end !== undefined) {
      const adjusted = bestCandidateForPair(world, config, fromIsland, toIsland, config.maximumManualSpan, override.start, override.end);
      if (adjusted !== undefined) effectiveCandidate = adjusted;
    }
    const bridge = buildBridge(world, effectiveCandidate, key, true, undefined, override, config);
    if (bridge === undefined) continue;
    commitBridge(world, bridge, roadConfig);
    usedPairs.add(pairKey);
  }

  validateBridges(world);
}
