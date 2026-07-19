import type { MaritimeConfig, RoadConfig } from '../config/GenerationConfig';
import type { GridPoint } from '../geography/Landmass';
import { findGridPath } from '../graph/Pathfinder';
import type { Random } from '../rng/Random';
import { IslandRole, type Island } from '../regional/Island';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { PortType, type CustomPortDefinition, type Port, type PortOverride } from './Port';
import { RoadType, type Road } from './Road';
import {
  MaritimeDanger,
  VesselClass,
  WaterRouteType,
  type CustomWaterRouteDefinition,
  type MaritimeEncounter,
  type WaterRoute,
  type WaterRouteOverride,
} from './WaterRoute';

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

interface RouteCandidate {
  readonly fromPortId: number;
  readonly toPortId: number;
  readonly tileIndices: readonly number[];
  readonly distance: number;
  readonly demand: number;
  readonly score: number;
  readonly bridgeExists: boolean;
}

class DisjointSet {
  private readonly parent: number[];

  public constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  public find(value: number): number {
    const parent = this.parent[value];
    if (parent === undefined || parent === value) return value;
    const root = this.find(parent);
    this.parent[value] = root;
    return root;
  }

  public union(left: number, right: number): void {
    const a = this.find(left);
    const b = this.find(right);
    if (a !== b) this.parent[b] = a;
  }
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
  if (island.role === IslandRole.PrimarySettlement && island.allocatedPopulation >= 6000) return PortType.FerryTerminal;
  if (island.allocatedPopulation >= 1800) return PortType.BarangayJetty;
  return PortType.FishingDock;
}

function defaultCapacity(type: PortType, population: number): number {
  const base = type === PortType.IndustrialPort ? 900
    : type === PortType.CommercialPort ? 720
      : type === PortType.FerryTerminal ? 480
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
      : type === PortType.FerryTerminal ? 'Ferry Terminal'
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
    routeIds: [],
    generated,
    locked: override?.locked ?? definition?.locked ?? false,
  };
}

function resetPortInfrastructure(world: World): void {
  const retainedRoads = world.roads.filter((road) => road.portId === null);
  const retainedRoadIds = new Set(retainedRoads.map((road) => road.id));
  world.roads = retainedRoads;
  world.ports = [];
  world.waterRoutes = [];
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

function computeWaterDistanceFromLand(world: World): Int32Array {
  const distance = new Int32Array(world.tiles.length);
  distance.fill(-1);
  const queue = new Int32Array(world.tiles.length);
  let write = 0;
  let read = 0;
  for (let index = 0; index < world.tiles.length; index += 1) {
    if (world.tiles[index]?.water === WaterType.Land) {
      distance[index] = 0;
      queue[write++] = index;
    }
  }
  while (read < write) {
    const index = queue[read++];
    if (index === undefined) continue;
    const x = index % world.width;
    const y = Math.floor(index / world.width);
    const nextDistance = (distance[index] ?? 0) + 1;
    for (const [dx, dy] of NEIGHBORS.slice(0, 4)) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.contains(nx, ny)) continue;
      const next = ny * world.width + nx;
      if ((distance[next] ?? -1) >= 0) continue;
      distance[next] = nextDistance;
      queue[write++] = next;
    }
  }
  return distance;
}

function vesselDraft(vessel: VesselClass): number {
  return vessel === VesselClass.CargoVessel ? 0.052 : vessel === VesselClass.Ferry ? 0.028 : 0.008;
}

function routeWaterPath(
  world: World,
  fromPort: Port,
  toPort: Port,
  vessel: VesselClass,
  config: MaritimeConfig,
  waterDistance: Int32Array,
): readonly number[] {
  const start = fromPort.waterTileIndex;
  const goal = toPort.waterTileIndex;
  const draft = vesselDraft(vessel);
  return findGridPath(world, {
    startIndex: start,
    goalIndex: goal,
    heuristicScale: 0.88,
    maximumVisited: Math.min(config.maximumPathVisits, world.tiles.length * 4),
    traversalCost: (_fromIndex, toIndex) => {
      const tile = world.tiles[toIndex];
      if (tile === undefined || tile.water !== WaterType.Ocean) return Number.POSITIVE_INFINITY;
      const endpoint = toIndex === start || toIndex === goal;
      if (!endpoint && tile.waterDepth < draft * 0.48) return Number.POSITIVE_INFINITY;
      const shallow = Math.max(0, draft - tile.waterDepth) / Math.max(0.001, draft);
      const exposure = clamp((waterDistance[toIndex] ?? 0) / 28, 0, 1);
      return 1 + shallow * config.shallowWaterPenalty + exposure * config.openWaterPenalty;
    },
  });
}

function bridgeExistsBetween(world: World, leftIslandId: number, rightIslandId: number): boolean {
  return world.bridges.some((bridge) => (
    bridge.fromIslandId === leftIslandId && bridge.toIslandId === rightIslandId
  ) || (
    bridge.fromIslandId === rightIslandId && bridge.toIslandId === leftIslandId
  ));
}

function routeKind(world: World, from: Port, to: Port): { readonly type: WaterRouteType; readonly vessel: VesselClass } {
  const fromIsland = world.islands[from.islandId];
  const toIsland = world.islands[to.islandId];
  const industrial = from.type === PortType.IndustrialPort || to.type === PortType.IndustrialPort
    || fromIsland?.role === IslandRole.Industrial || toIsland?.role === IslandRole.Industrial;
  if (industrial) return { type: WaterRouteType.CargoRoute, vessel: VesselClass.CargoVessel };
  const population = (fromIsland?.allocatedPopulation ?? 0) + (toIsland?.allocatedPopulation ?? 0);
  if (population < 1500 && from.type === PortType.FishingDock && to.type === PortType.FishingDock) {
    return { type: WaterRouteType.FishingRoute, vessel: VesselClass.SmallBoat };
  }
  return { type: WaterRouteType.PassengerFerry, vessel: VesselClass.Ferry };
}

function routeCandidate(
  world: World,
  fromPort: Port,
  toPort: Port,
  config: MaritimeConfig,
  waterDistance: Int32Array,
  forcedVessel?: VesselClass,
): RouteCandidate | undefined {
  if (fromPort.islandId === toPort.islandId) return undefined;
  const inferred = routeKind(world, fromPort, toPort);
  const vessel = forcedVessel ?? inferred.vessel;
  const tileIndices = routeWaterPath(world, fromPort, toPort, vessel, config, waterDistance);
  if (tileIndices.length < 2) return undefined;
  let distance = 0;
  for (let index = 1; index < tileIndices.length; index += 1) {
    const before = world.tiles[tileIndices[index - 1] ?? -1];
    const current = world.tiles[tileIndices[index] ?? -1];
    if (before !== undefined && current !== undefined) distance += Math.hypot(current.x - before.x, current.y - before.y);
  }
  const fromIsland = world.islands[fromPort.islandId];
  const toIsland = world.islands[toPort.islandId];
  const demand = Math.log1p(Math.max(1, fromIsland?.allocatedPopulation ?? 1))
    + Math.log1p(Math.max(1, toIsland?.allocatedPopulation ?? 1))
    + (fromIsland?.role === IslandRole.PrimarySettlement || toIsland?.role === IslandRole.PrimarySettlement ? 1.4 : 0)
    + (fromIsland?.role === IslandRole.PortHub || toIsland?.role === IslandRole.PortHub ? 0.9 : 0);
  const bridgeExists = bridgeExistsBetween(world, fromPort.islandId, toPort.islandId);
  return {
    fromPortId: fromPort.id,
    toPortId: toPort.id,
    tileIndices,
    distance,
    demand,
    bridgeExists,
    score: demand * config.routeDemandWeight - distance * config.routeDistanceWeight - (bridgeExists ? config.bridgeCompetitionPenalty : 0),
  };
}

function vesselSpeed(vessel: VesselClass, config: MaritimeConfig): number {
  return vessel === VesselClass.CargoVessel ? config.cargoSpeedKph
    : vessel === VesselClass.Ferry ? config.ferrySpeedKph : config.smallBoatSpeedKph;
}

function generatedRouteName(world: World, from: Port, to: Port, type: WaterRouteType): string {
  const a = shortIslandName(world.islands[from.islandId]?.name ?? from.name);
  const b = shortIslandName(world.islands[to.islandId]?.name ?? to.name);
  const suffix = type === WaterRouteType.CargoRoute ? 'Cargo Line'
    : type === WaterRouteType.FishingRoute ? 'Fishing Run'
      : type === WaterRouteType.CoastalRoute ? 'Coastal Route' : 'Ferry';
  return `${a}–${b} ${suffix}`;
}

function routeDanger(world: World, candidate: RouteCandidate, waterDistance: Int32Array): number {
  let exposure = 0;
  let shallow = 0;
  for (const index of candidate.tileIndices) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    exposure += clamp((waterDistance[index] ?? 0) / 24, 0, 1);
    shallow += 1 - clamp(tile.waterDepth / 0.09, 0, 1);
  }
  const count = Math.max(1, candidate.tileIndices.length);
  return clamp(candidate.distance / 90 * 0.38 + exposure / count * 0.38 + shallow / count * 0.24, 0, 1);
}

function encountersFor(random: Random, dangerRating: number): readonly MaritimeEncounter[] {
  const pool: readonly Omit<MaritimeEncounter, 'weight'>[] = [
    { danger: MaritimeDanger.Low, title: 'Floating shrine', description: 'A tiny candlelit shrine drifts against the current without sinking.' },
    { danger: MaritimeDanger.Moderate, title: 'Sudden fog', description: 'The islands vanish behind a wall of warm white fog.' },
    { danger: MaritimeDanger.Moderate, title: 'Engine cough', description: 'The engine dies as something heavy brushes beneath the hull.' },
    { danger: MaritimeDanger.High, title: 'Missing passenger', description: 'The manifest lists one more passenger than anyone remembers boarding.' },
    { danger: MaritimeDanger.High, title: 'Ghost vessel', description: 'An unlit ferry follows the route at the same speed, always just behind.' },
    { danger: MaritimeDanger.Severe, title: 'Black water', description: 'The sea turns opaque and every reflection shows a different sky.' },
    { danger: MaritimeDanger.Low, title: 'Fisherfolk warning', description: 'A passing banca signals that the usual channel is unsafe tonight.' },
    { danger: MaritimeDanger.Moderate, title: 'Cargo adrift', description: 'A sealed wooden crate bumps against the boat and whispers from inside.' },
  ];
  return random.shuffle(pool).slice(0, 5).map((entry, index) => ({
    ...entry,
    weight: Math.max(1, Math.round((index === 0 ? 4 : index === 1 ? 3 : 2) * (entry.danger === MaritimeDanger.Severe ? 0.7 + dangerRating : 1))),
  }));
}

function buildRoute(
  world: World,
  candidate: RouteCandidate,
  key: string,
  generated: boolean,
  definition: CustomWaterRouteDefinition | undefined,
  override: WaterRouteOverride | undefined,
  config: MaritimeConfig,
  random: Random,
  waterDistance: Int32Array,
): WaterRoute | undefined {
  if (override?.suppressed === true) return undefined;
  const from = world.ports[candidate.fromPortId];
  const to = world.ports[candidate.toPortId];
  if (from === undefined || to === undefined) return undefined;
  const inferred = routeKind(world, from, to);
  const type = override?.type ?? definition?.type ?? inferred.type;
  const vessel = override?.vesselClass ?? definition?.vesselClass ?? inferred.vessel;
  const distance = candidate.distance;
  const baseTravel = config.boardingMinutes + distance * config.tileSizeKilometers / Math.max(1, vesselSpeed(vessel, config)) * 60;
  const danger = routeDanger(world, candidate, waterDistance);
  return {
    id: world.waterRoutes.length,
    key,
    name: override?.name?.trim() || definition?.name.trim() || generatedRouteName(world, from, to, type),
    fromPortId: from.id,
    toPortId: to.id,
    type,
    vesselClass: vessel,
    tileIndices: [...candidate.tileIndices],
    centerline: candidate.tileIndices.map((index) => {
      const tile = world.tiles[index];
      return { x: (tile?.x ?? 0) + 0.5, y: (tile?.y ?? 0) + 0.5 };
    }),
    distance,
    estimatedTravelTimeMinutes: clamp(override?.estimatedTravelTimeMinutes ?? baseTravel, 2, 1440),
    dangerRating: clamp(override?.dangerRating ?? danger, 0, 1),
    encounters: encountersFor(random.fork(key), danger),
    generated,
    enabled: override?.enabled ?? definition?.enabled ?? true,
    locked: override?.locked ?? definition?.locked ?? false,
  };
}

function selectGeneratedCandidates(world: World, config: MaritimeConfig, waterDistance: Int32Array): readonly RouteCandidate[] {
  const candidates: RouteCandidate[] = [];
  for (let left = 0; left < world.ports.length; left += 1) {
    const from = world.ports[left];
    if (from === undefined) continue;
    for (let right = left + 1; right < world.ports.length; right += 1) {
      const to = world.ports[right];
      if (to === undefined) continue;
      const candidate = routeCandidate(world, from, to, config, waterDistance);
      if (candidate !== undefined) candidates.push(candidate);
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.distance - right.distance || left.fromPortId - right.fromPortId);
  const set = new DisjointSet(world.islands.length);
  for (const bridge of world.bridges) set.union(bridge.fromIslandId, bridge.toIslandId);
  const selected: RouteCandidate[] = [];
  for (const candidate of candidates) {
    if (selected.length >= config.maximumRoutes) break;
    const fromIsland = world.ports[candidate.fromPortId]?.islandId;
    const toIsland = world.ports[candidate.toPortId]?.islandId;
    if (fromIsland === undefined || toIsland === undefined) continue;
    if (set.find(fromIsland) === set.find(toIsland)) continue;
    selected.push(candidate);
    set.union(fromIsland, toIsland);
  }
  for (const candidate of candidates) {
    if (selected.length >= config.maximumRoutes + config.extraRouteConnections) break;
    if (selected.includes(candidate) || candidate.score < 1.5) continue;
    const duplicate = selected.some((item) => (
      item.fromPortId === candidate.fromPortId && item.toPortId === candidate.toPortId
    ) || (
      item.fromPortId === candidate.toPortId && item.toPortId === candidate.fromPortId
    ));
    if (!duplicate) selected.push(candidate);
  }
  return selected;
}

export function generateWaterRoutes(
  world: World,
  config: MaritimeConfig,
  random: Random,
  overrides: readonly WaterRouteOverride[],
  customDefinitions: readonly CustomWaterRouteDefinition[],
): void {
  world.waterRoutes = [];
  for (const port of world.ports) port.routeIds = [];
  const waterDistance = computeWaterDistanceFromLand(world);
  const overridesByKey = new Map(overrides.map((item) => [item.key, item]));
  const customPairs = new Set(customDefinitions.map((item) => {
    const a = item.fromPortKey < item.toPortKey ? item.fromPortKey : item.toPortKey;
    const b = item.fromPortKey < item.toPortKey ? item.toPortKey : item.fromPortKey;
    return `${a}::${b}`;
  }));

  let generatedIndex = 0;
  for (const candidate of selectGeneratedCandidates(world, config, waterDistance)) {
    const from = world.ports[candidate.fromPortId];
    const to = world.ports[candidate.toPortId];
    if (from === undefined || to === undefined) continue;
    const pair = from.key < to.key ? `${from.key}::${to.key}` : `${to.key}::${from.key}`;
    if (customPairs.has(pair)) continue;
    const key = `water-route:${pair}`;
    const route = buildRoute(world, candidate, key, true, undefined, overridesByKey.get(key), config, random.fork(`generated-${generatedIndex++}`), waterDistance);
    if (route === undefined) continue;
    world.waterRoutes.push(route);
    from.routeIds.push(route.id);
    to.routeIds.push(route.id);
  }

  for (const definition of customDefinitions) {
    const from = world.ports.find((item) => item.key === definition.fromPortKey);
    const to = world.ports.find((item) => item.key === definition.toPortKey);
    if (from === undefined || to === undefined || from.id === to.id) continue;
    const override = overridesByKey.get(definition.key);
    const vessel = override?.vesselClass ?? definition.vesselClass;
    const candidate = routeCandidate(world, from, to, config, waterDistance, vessel);
    if (candidate === undefined) continue;
    const route = buildRoute(world, candidate, definition.key, false, definition, override, config, random.fork(definition.key), waterDistance);
    if (route === undefined) continue;
    world.waterRoutes.push(route);
    from.routeIds.push(route.id);
    to.routeIds.push(route.id);
  }
}
