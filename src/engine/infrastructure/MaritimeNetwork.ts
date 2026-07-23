import type { MaritimeConfig, RoadConfig } from '../config/GenerationConfig';
import type { GridPoint } from '../geography/Landmass';
import { findGridPath } from '../graph/Pathfinder';
import type { Random } from '../rng/Random';
import { IslandRole, type Island } from '../regional/Island';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { PortType, type CustomPortDefinition, type Port, type PortOverride } from './Port';
import { RoadType, type Road } from './Road';

const NEIGHBORS: readonly (readonly [number, number])[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

interface PortCandidate {
  readonly islandId: number;
  readonly tileIndex: number;
  readonly waterTileIndex: number;
  readonly score: number;
  readonly waterDepth: number;
  readonly shelteredScore: number;
  readonly roadAccessDistance: number;
  readonly settlementId: number | null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function sampleIndices(indices: readonly number[], maximum: number): readonly number[] {
  if (indices.length <= maximum) return indices;
  const step = Math.max(1, Math.ceil(indices.length / maximum));
  return indices.filter((_, index) => index % step === 0).slice(0, maximum);
}

function nearestAdjacentOcean(world: World, tileIndex: number): number | undefined {
  const tile = world.tiles[tileIndex];
  if (tile === undefined) return undefined;
  let best: number | undefined;
  let bestDepth = -1;
  for (const [dx, dy] of NEIGHBORS) {
    const neighbor = world.getTile(tile.x + dx, tile.y + dy);
    if (neighbor === undefined || neighbor.water !== WaterType.Ocean) continue;
    const index = world.indexOf(neighbor.x, neighbor.y);
    if (neighbor.waterDepth > bestDepth || (neighbor.waterDepth === bestDepth && (best === undefined || index < best))) {
      best = index;
      bestDepth = neighbor.waterDepth;
    }
  }
  return best;
}

function roadTilesForIsland(world: World, islandId: number): readonly number[] {
  const result = new Set<number>();
  for (const road of world.roads) {
    for (const index of road.path) {
      if (world.tiles[index]?.islandId === islandId) result.add(index);
    }
  }
  return [...result];
}

function distanceToIndices(world: World, tileIndex: number, indices: readonly number[]): number {
  const tile = world.tiles[tileIndex];
  if (tile === undefined || indices.length === 0) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const index of indices) {
    const other = world.tiles[index];
    if (other !== undefined) best = Math.min(best, Math.hypot(other.x - tile.x, other.y - tile.y));
  }
  return best;
}

function nearestSettlement(world: World, island: Island, tileIndex: number): { readonly id: number | null; readonly distance: number } {
  const tile = world.tiles[tileIndex];
  if (tile === undefined) return { id: null, distance: Number.POSITIVE_INFINITY };
  let id: number | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const settlementId of island.settlementIds) {
    const settlement = world.settlements[settlementId];
    if (settlement === undefined) continue;
    const candidate = Math.hypot(settlement.x - tile.x, settlement.y - tile.y);
    if (candidate < distance || (candidate === distance && (id === null || settlement.id < id))) {
      id = settlement.id;
      distance = candidate;
    }
  }
  return { id, distance };
}

function shelterScore(world: World, waterTileIndex: number): number {
  const water = world.tiles[waterTileIndex];
  if (water === undefined) return 0;
  let landNeighbors = 0;
  let oceanNeighbors = 0;
  let depth = 0;
  for (const [dx, dy] of NEIGHBORS) {
    const neighbor = world.getTile(water.x + dx, water.y + dy);
    if (neighbor?.water === WaterType.Land) landNeighbors += 1;
    if (neighbor?.water === WaterType.Ocean) {
      oceanNeighbors += 1;
      depth += neighbor.waterDepth;
    }
  }
  const enclosure = landNeighbors / NEIGHBORS.length;
  const averageDepth = oceanNeighbors === 0 ? water.waterDepth : depth / oceanNeighbors;
  return clamp(enclosure * 1.35 + (1 - clamp(averageDepth / 0.14, 0, 1)) * 0.28, 0, 1);
}

function scorePortCandidate(
  world: World,
  island: Island,
  tileIndex: number,
  waterTileIndex: number,
  config: MaritimeConfig,
  roadTiles: readonly number[],
): PortCandidate | undefined {
  const tile = world.tiles[tileIndex];
  const water = world.tiles[waterTileIndex];
  if (tile === undefined || water === undefined || tile.islandId !== island.id || !tile.coast) return undefined;
  if (tile.terrain === TerrainType.Mountain || tile.slope > 0.34 || water.waterDepth < config.minimumPortWaterDepth * 0.45) return undefined;
  const roadDistance = distanceToIndices(world, tileIndex, roadTiles);
  const nearest = nearestSettlement(world, island, tileIndex);
  const accessDistance = Number.isFinite(roadDistance) ? roadDistance : nearest.distance;
  if (!Number.isFinite(accessDistance) || accessDistance > config.maximumPortRoadDistance * 1.8) return undefined;
  const sheltered = shelterScore(world, waterTileIndex);
  const flatness = 1 - clamp(tile.slope / 0.34, 0, 1);
  const depthScore = clamp(water.waterDepth / 0.12, 0, 1);
  const roleBonus = island.role === IslandRole.PortHub ? 3.5
    : island.role === IslandRole.Industrial ? 2.2
      : island.role === IslandRole.PrimarySettlement ? 1.5 : 0;
  const score = depthScore * config.portDepthWeight
    + sheltered * config.portShelterWeight
    + flatness * config.portFlatnessWeight
    - accessDistance * config.portRoadAccessWeight
    - tile.floodRisk * config.portFloodPenalty
    + Math.log1p(Math.max(0, island.allocatedPopulation)) * 0.12
    + roleBonus;
  return {
    islandId: island.id,
    tileIndex,
    waterTileIndex,
    score,
    waterDepth: water.waterDepth,
    shelteredScore: sheltered,
    roadAccessDistance: accessDistance,
    settlementId: nearest.id,
  };
}

function nearestCoastCandidate(
  world: World,
  island: Island,
  config: MaritimeConfig,
  position?: GridPoint,
): PortCandidate | undefined {
  const landmass = world.landmasses[island.landmassId];
  if (landmass === undefined) return undefined;
  const roadTiles = roadTilesForIsland(world, island.id);
  const coast = position === undefined
    ? sampleIndices(landmass.coastlineTileIndices, config.maximumCoastSamples)
    : [...landmass.coastlineTileIndices].sort((leftIndex, rightIndex) => {
      const left = world.tiles[leftIndex];
      const right = world.tiles[rightIndex];
      if (left === undefined || right === undefined) return leftIndex - rightIndex;
      return Math.hypot(left.x + 0.5 - position.x, left.y + 0.5 - position.y)
        - Math.hypot(right.x + 0.5 - position.x, right.y + 0.5 - position.y)
        || leftIndex - rightIndex;
    }).slice(0, Math.min(24, landmass.coastlineTileIndices.length));
  let best: PortCandidate | undefined;
  for (const tileIndex of coast) {
    const waterTileIndex = nearestAdjacentOcean(world, tileIndex);
    if (waterTileIndex === undefined) continue;
    const candidate = scorePortCandidate(world, island, tileIndex, waterTileIndex, config, roadTiles);
    if (candidate === undefined) continue;
    const positionPenalty = position === undefined ? 0 : (() => {
      const tile = world.tiles[tileIndex];
      return tile === undefined ? 1000 : Math.hypot(tile.x + 0.5 - position.x, tile.y + 0.5 - position.y) * 0.5;
    })();
    const adjusted = { ...candidate, score: candidate.score - positionPenalty };
    if (best === undefined || adjusted.score > best.score || (adjusted.score === best.score && adjusted.tileIndex < best.tileIndex)) best = adjusted;
  }
  return best;
}

function defaultPortType(island: Island): PortType {
  if (island.role === IslandRole.Industrial) return PortType.IndustrialPort;
  if (island.role === IslandRole.PortHub) return PortType.CommercialPort;
  if (island.role === IslandRole.PrimarySettlement && island.allocatedPopulation >= 6000) return PortType.BarangayJetty;
  if (island.allocatedPopulation >= 1800) return PortType.BarangayJetty;
  return PortType.FishingDock;
}

function defaultCapacity(type: PortType, population: number): number {
  const base = type === PortType.IndustrialPort ? 900
    : type === PortType.CommercialPort ? 720
      : type === PortType.Marina ? 220
        : type === PortType.BarangayJetty ? 160 : 80;
  return Math.round(base + Math.sqrt(Math.max(0, population)) * 2.2);
}

function shortIslandName(name: string): string {
  return name.replace(/\b(Island|Isla)\b/gi, '').replace(/\s+/g, ' ').trim() || name;
}

function generatedPortName(island: Island, type: PortType): string {
  const suffix = type === PortType.FishingDock ? 'Fishing Dock'
    : type === PortType.BarangayJetty ? 'Jetty'
      : type === PortType.IndustrialPort ? 'Industrial Port'
        : type === PortType.Marina ? 'Marina' : 'Port';
  return `${shortIslandName(island.name)} ${suffix}`;
}

function approachTraversalCost(world: World, islandId: number, _fromIndex: number, toIndex: number): number {
  const tile = world.tiles[toIndex];
  if (tile === undefined || tile.water !== WaterType.Land || tile.islandId !== islandId) return Number.POSITIVE_INFINITY;
  if (tile.terrain === TerrainType.Mountain) return Number.POSITIVE_INFINITY;
  let cost = 1 + tile.slope * 12 + tile.floodRisk * 4;
  if (tile.terrain === TerrainType.Forest) cost += 2.4;
  if (tile.river) cost += 7 + tile.riverWidth * 2;
  if (tile.road) cost *= 0.36;
  return cost;
}

function createAccessRoad(world: World, port: Port, roadConfig: RoadConfig): number | null {
  const current = world.tiles[port.tileIndex];
  if (current === undefined) return null;
  if (current.roadId !== null) return current.roadId;
  const candidates = roadTilesForIsland(world, port.islandId);
  let targetIndex: number | undefined;
  if (candidates.length > 0) {
    targetIndex = [...candidates].sort((leftIndex, rightIndex) => {
      const left = world.tiles[leftIndex];
      const right = world.tiles[rightIndex];
      if (left === undefined || right === undefined) return leftIndex - rightIndex;
      return Math.hypot(left.x - current.x, left.y - current.y) - Math.hypot(right.x - current.x, right.y - current.y) || leftIndex - rightIndex;
    })[0];
  }
  if (targetIndex === undefined && port.settlementId !== null) targetIndex = world.settlements[port.settlementId]?.tileIndex;
  if (targetIndex === undefined || targetIndex === port.tileIndex) return current.roadId;
  const path = findGridPath(world, {
    startIndex: port.tileIndex,
    goalIndex: targetIndex,
    traversalCost: (fromIndex, toIndex) => approachTraversalCost(world, port.islandId, fromIndex, toIndex),
    maximumVisited: Math.min(36_000, roadConfig.maximumPathVisits),
  });
  if (path.length < 2) return null;
  const road: Road = {
    id: world.roads.length,
    name: '',
    type: port.type === PortType.CommercialPort || port.type === PortType.IndustrialPort ? RoadType.Secondary : RoadType.Local,
    path: [...path],
    bridgeTiles: path.filter((index) => world.tiles[index]?.river === true),
    connectsAnchorIds: [],
    connectsSettlementIds: port.settlementId === null ? [] : [port.settlementId],
    length: path.length,
    bridgeId: null,
    portId: port.id,
  };
  for (const index of path) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    tile.road = true;
    tile.roadId ??= road.id;
    if (tile.river) tile.bridge = true;
  }
  world.roads.push(road);
  if (port.settlementId !== null) world.settlements[port.settlementId]?.roadIds.push(road.id);
  return road.id;
}

function buildPort(
  world: World,
  island: Island,
  candidate: PortCandidate,
  key: string,
  generated: boolean,
  definition: CustomPortDefinition | undefined,
  override: PortOverride | undefined,
): Port | undefined {
  if (override?.suppressed === true) return undefined;
  const type = override?.type ?? definition?.type ?? defaultPortType(island);
  const tile = world.tiles[candidate.tileIndex];
  const water = world.tiles[candidate.waterTileIndex];
  if (tile === undefined || water === undefined) return undefined;
  return {
    id: world.ports.length,
    key,
    name: override?.name?.trim() || definition?.name.trim() || generatedPortName(island, type),
    islandId: island.id,
    settlementId: candidate.settlementId,
    position: { x: tile.x + 0.5, y: tile.y + 0.5 },
    tileIndex: candidate.tileIndex,
    waterPosition: { x: water.x + 0.5, y: water.y + 0.5 },
    waterTileIndex: candidate.waterTileIndex,
    type,
    capacity: clamp(Math.round(override?.capacity ?? definition?.capacity ?? defaultCapacity(type, island.allocatedPopulation)), 20, 5000),
    waterDepth: candidate.waterDepth,
    shelteredScore: candidate.shelteredScore,
    roadAccessDistance: candidate.roadAccessDistance,
    accessRoadId: null,
    generated,
    locked: override?.locked ?? definition?.locked ?? false,
  };
}

function resetPortInfrastructure(world: World): void {
  const retainedRoads = world.roads.filter((road) => road.portId === null);
  const retainedRoadIds = new Set(retainedRoads.map((road) => road.id));
  world.roads = retainedRoads;
  world.ports = [];
  for (const island of world.islands) island.portIds = [];
  for (const settlement of world.settlements) settlement.roadIds = settlement.roadIds.filter((id) => retainedRoadIds.has(id));
  for (const tile of world.tiles) {
    tile.road = false;
    tile.roadId = null;
    tile.bridge = false;
  }
  for (const road of retainedRoads) {
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

export function generatePorts(
  world: World,
  config: MaritimeConfig,
  roadConfig: RoadConfig,
  _random: Random,
  overrides: readonly PortOverride[],
  customDefinitions: readonly CustomPortDefinition[],
): void {
  resetPortInfrastructure(world);
  const overridesByKey = new Map(overrides.map((item) => [item.key, item]));

  for (const island of world.islands) {
    if (!island.allowPorts || island.settlementIds.length === 0 || island.allocatedPopulation <= 0) continue;
    const key = `port:${island.key}:0`;
    const override = overridesByKey.get(key);
    const candidate = nearestCoastCandidate(world, island, config, override?.position);
    if (candidate === undefined) continue;
    const port = buildPort(world, island, candidate, key, true, undefined, override);
    if (port === undefined) continue;
    world.ports.push(port);
    island.portIds.push(port.id);
  }

  for (const definition of customDefinitions) {
    const island = world.islands.find((item) => item.key === definition.islandKey);
    if (island === undefined || !island.allowPorts) continue;
    const override = overridesByKey.get(definition.key);
    const candidate = nearestCoastCandidate(world, island, config, override?.position ?? definition.position);
    if (candidate === undefined) continue;
    const port = buildPort(world, island, candidate, definition.key, false, definition, override);
    if (port === undefined) continue;
    world.ports.push(port);
    island.portIds.push(port.id);
  }

  for (const port of world.ports) port.accessRoadId = createAccessRoad(world, port, roadConfig);
}
