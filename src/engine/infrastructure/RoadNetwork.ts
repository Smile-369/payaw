import type { RoadConfig } from '../config/GenerationConfig';
import { minimumSpanningTree, type GraphEdge } from '../graph/Graph';
import { findGridPath } from '../graph/Pathfinder';
import type { Random } from '../rng/Random';
import { AnchorType, type Anchor } from '../settlement/Anchor';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { RoadType, type Road } from './Road';

function anchorDistance(left: Anchor, right: Anchor): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function buildAnchorEdges(anchors: readonly Anchor[]): readonly GraphEdge<number>[] {
  const edges: GraphEdge<number>[] = [];
  for (let leftIndex = 0; leftIndex < anchors.length; leftIndex += 1) {
    const left = anchors[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < anchors.length; rightIndex += 1) {
      const right = anchors[rightIndex];
      if (right === undefined) continue;
      edges.push({ from: left.id, to: right.id, weight: anchorDistance(left, right) });
    }
  }
  return edges;
}

function edgeKey(edge: GraphEdge<number>): string {
  return edge.from < edge.to ? `${edge.from}:${edge.to}` : `${edge.to}:${edge.from}`;
}

function chooseAnchorConnections(
  anchors: readonly Anchor[],
  config: RoadConfig,
): readonly GraphEdge<number>[] {
  const allEdges = buildAnchorEdges(anchors);
  const selected = [...minimumSpanningTree(anchors.map((anchor) => anchor.id), allEdges)];
  const selectedKeys = new Set(selected.map(edgeKey));
  const plaza = anchors.find((anchor) => anchor.type === AnchorType.TownPlaza);
  const extras = [...allEdges]
    .filter((edge) => !selectedKeys.has(edgeKey(edge)))
    .sort((left, right) => {
      const leftPlazaBias = plaza !== undefined && (left.from === plaza.id || left.to === plaza.id) ? -18 : 0;
      const rightPlazaBias = plaza !== undefined && (right.from === plaza.id || right.to === plaza.id) ? -18 : 0;
      return (left.weight + leftPlazaBias) - (right.weight + rightPlazaBias) || edgeKey(left).localeCompare(edgeKey(right));
    });

  for (const edge of extras.slice(0, config.extraAnchorConnections)) {
    selected.push(edge);
    selectedKeys.add(edgeKey(edge));
  }

  // Every anchor should have at least two independent graph connections when the
  // settlement has enough anchors. This creates real forks and alternate approaches
  // instead of a tree where peripheral landmarks have only one road in or out.
  if (anchors.length >= 3) {
    const degree = new Map<number, number>();
    for (const anchor of anchors) degree.set(anchor.id, 0);
    for (const edge of selected) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    }
    for (const anchor of anchors) {
      while ((degree.get(anchor.id) ?? 0) < 2) {
        const candidate = allEdges
          .filter((edge) => (edge.from === anchor.id || edge.to === anchor.id) && !selectedKeys.has(edgeKey(edge)))
          .sort((left, right) => left.weight - right.weight || edgeKey(left).localeCompare(edgeKey(right)))[0];
        if (candidate === undefined) break;
        selected.push(candidate);
        selectedKeys.add(edgeKey(candidate));
        degree.set(candidate.from, (degree.get(candidate.from) ?? 0) + 1);
        degree.set(candidate.to, (degree.get(candidate.to) ?? 0) + 1);
      }
    }
  }
  return selected;
}

function baseTerrainCost(world: World, config: RoadConfig, toIndex: number): number {
  const tile = world.tiles[toIndex];
  if (tile === undefined || tile.water !== WaterType.Land) return Number.POSITIVE_INFINITY;

  let cost = 1
    + tile.slope * config.slopeWeight
    + Math.max(0, tile.elevation - 0.48) * config.elevationWeight
    + tile.floodRisk * config.floodplainPenalty;
  if (tile.terrain === TerrainType.Mountain) cost += config.mountainPenalty;
  if (tile.terrain === TerrainType.Forest) cost += config.forestPenalty;
  if (tile.river) cost += config.riverCrossingPenalty + tile.riverWidth * 2;
  return cost;
}

function traversalCost(world: World, config: RoadConfig, _fromIndex: number, toIndex: number): number {
  const tile = world.tiles[toIndex];
  const cost = baseTerrainCost(world, config, toIndex);
  if (!Number.isFinite(cost) || tile === undefined) return Number.POSITIVE_INFINITY;
  return tile.road ? cost * config.existingRoadDiscount : cost;
}

function localTraversalCost(
  world: World,
  config: RoadConfig,
  startIndex: number,
  goalIndex: number,
  _fromIndex: number,
  toIndex: number,
): number {
  const tile = world.tiles[toIndex];
  if (tile === undefined) return Number.POSITIVE_INFINITY;
  if (tile.road && toIndex !== startIndex && toIndex !== goalIndex) return Number.POSITIVE_INFINITY;
  return baseTerrainCost(world, config, toIndex);
}

function commitRoad(world: World, road: Road): void {
  for (const index of road.path) {
    const tile = world.tiles[index];
    if (tile === undefined) throw new Error('Road path referenced an invalid tile.');
    tile.road = true;
    tile.roadId ??= road.id;
    if (tile.river) tile.bridge = true;
  }
  world.roads.push(road);
}

function createRoad(
  world: World,
  type: RoadType,
  path: readonly number[],
  connectsAnchorIds: readonly number[],
  connectsSettlementIds: readonly number[] = [],
): Road {
  const bridgeTiles = path.filter((index) => world.tiles[index]?.river === true);
  return {
    id: world.roads.length,
    generatedId: world.roads.length,
    source: 'generated',
    name: '',
    type,
    path: [...path],
    bridgeTiles,
    connectsAnchorIds: [...connectsAnchorIds],
    connectsSettlementIds: [...connectsSettlementIds],
    length: path.length,
    bridgeId: null,
    portId: null,
  };
}

function routeAnchorConnections(world: World, config: RoadConfig): void {
  const anchorById = new Map(world.anchors.map((anchor) => [anchor.id, anchor]));
  for (const edge of chooseAnchorConnections(world.anchors, config)) {
    const from = anchorById.get(edge.from);
    const to = anchorById.get(edge.to);
    if (from === undefined || to === undefined) throw new Error('Road graph referenced an unknown anchor.');
    const path = findGridPath(world, {
      startIndex: from.tileIndex,
      goalIndex: to.tileIndex,
      traversalCost: (fromIndex, toIndex) => traversalCost(world, config, fromIndex, toIndex),
      maximumVisited: config.maximumPathVisits,
    });
    if (path.length === 0) {
      throw new Error(`Could not route a road between ${from.type} and ${to.type}.`);
    }
    commitRoad(world, createRoad(world, RoadType.Main, path, [from.id, to.id]));
  }
}

function secondaryTarget(world: World, startIndex: number, config: RoadConfig, random: Random): number | undefined {
  const start = world.tiles[startIndex];
  if (start === undefined) return undefined;
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const angle = random.float(0, Math.PI * 2);
    const distance = random.float(config.secondaryMinimumLength, config.secondaryTargetRadius);
    const x = Math.round(start.x + Math.cos(angle) * distance);
    const y = Math.round(start.y + Math.sin(angle) * distance);
    const tile = world.getTile(x, y);
    if (
      tile !== undefined
      && tile.water === WaterType.Land
      && !tile.road
      && tile.terrain !== TerrainType.Mountain
      && tile.slope < 0.2
      && tile.floodRisk < 0.72
    ) {
      return world.indexOf(x, y);
    }
  }
  return undefined;
}

function growSecondaryRoads(world: World, config: RoadConfig, random: Random): void {
  const mainRoadTiles = world.tiles
    .map((tile, index) => ({ tile, index }))
    .filter(({ tile }) => tile.road && !tile.bridge)
    .map(({ index }) => index);
  if (mainRoadTiles.length === 0) return;

  const starts = random.shuffle(mainRoadTiles);
  let generated = 0;
  for (const startIndex of starts) {
    if (generated >= config.secondaryRoadCount) break;
    const target = secondaryTarget(world, startIndex, config, random.fork(`secondary-${generated}-${startIndex}`));
    if (target === undefined) continue;
    let path = findGridPath(world, {
      startIndex,
      goalIndex: target,
      traversalCost: (fromIndex, toIndex) => traversalCost(world, config, fromIndex, toIndex),
      maximumVisited: Math.floor(config.maximumPathVisits * 0.35),
    });
    if (path.length < config.secondaryMinimumLength) continue;
    if (path.length > config.secondaryMaximumLength) {
      path = path.slice(0, config.secondaryMaximumLength);
    }
    commitRoad(world, createRoad(world, RoadType.Secondary, path, []));
    generated += 1;
  }
}

function localRoadCandidates(world: World, config: RoadConfig): readonly number[] {
  const plaza = world.anchors.find((anchor) => anchor.type === AnchorType.TownPlaza);
  if (plaza === undefined) return [];
  return world.tiles
    .map((tile, index) => ({ tile, index }))
    .filter(({ tile }) => (
      tile.road
      && !tile.bridge
      && tile.roadId !== null
      && Math.hypot(tile.x - plaza.x, tile.y - plaza.y) <= config.localTownRadius
    ))
    .map(({ index }) => index);
}

function chooseLocalGoal(
  world: World,
  candidates: readonly number[],
  startIndex: number,
  config: RoadConfig,
  random: Random,
): number | undefined {
  const start = world.tiles[startIndex];
  if (start === undefined) return undefined;
  const minimum = config.localPairMinimumDistance;
  const maximum = config.localPairMaximumDistance;
  const targetDistance = (minimum + maximum) * 0.5;
  const goals = candidates
    .filter((index) => {
      const tile = world.tiles[index];
      if (tile === undefined || tile.roadId === start.roadId) return false;
      const separation = Math.hypot(tile.x - start.x, tile.y - start.y);
      return separation >= minimum && separation <= maximum;
    })
    .sort((leftIndex, rightIndex) => {
      const left = world.tiles[leftIndex];
      const right = world.tiles[rightIndex];
      if (left === undefined || right === undefined) return leftIndex - rightIndex;
      const leftScore = Math.abs(Math.hypot(left.x - start.x, left.y - start.y) - targetDistance);
      const rightScore = Math.abs(Math.hypot(right.x - start.x, right.y - start.y) - targetDistance);
      return leftScore - rightScore || leftIndex - rightIndex;
    });
  if (goals.length === 0) return undefined;
  const shortlist = goals.slice(0, Math.min(24, goals.length));
  return random.pick(shortlist);
}

function growLocalConnectorRoads(world: World, config: RoadConfig, random: Random): void {
  const candidates = localRoadCandidates(world, config);
  if (candidates.length < 2) return;
  const usedPairs = new Set<string>();
  const starts = random.shuffle(candidates);
  let generated = 0;
  let attempts = 0;
  const maximumAttempts = Math.max(80, config.localRoadCount * 18);

  while (generated < config.localRoadCount && attempts < maximumAttempts) {
    const startIndex = starts[attempts % starts.length];
    attempts += 1;
    if (startIndex === undefined) continue;
    const goalIndex = chooseLocalGoal(
      world,
      candidates,
      startIndex,
      config,
      random.fork(`local-goal-${attempts}-${startIndex}`),
    );
    if (goalIndex === undefined) continue;
    const pairKey = startIndex < goalIndex ? `${startIndex}:${goalIndex}` : `${goalIndex}:${startIndex}`;
    if (usedPairs.has(pairKey)) continue;
    usedPairs.add(pairKey);

    const path = findGridPath(world, {
      startIndex,
      goalIndex,
      traversalCost: (fromIndex, toIndex) => localTraversalCost(
        world,
        config,
        startIndex,
        goalIndex,
        fromIndex,
        toIndex,
      ),
      maximumVisited: Math.min(18000, Math.floor(config.maximumPathVisits * 0.16)),
    });
    if (path.length < config.localMinimumLength || path.length > config.localMaximumLength) continue;
    commitRoad(world, createRoad(world, RoadType.Local, path, []));
    generated += 1;
  }
}


function settlementTarget(
  world: World,
  settlementIndex: number,
  distance: number,
  random: Random,
): number | undefined {
  const settlement = world.settlements[settlementIndex];
  if (settlement === undefined) return undefined;
  const island = world.islands[settlement.islandId];
  if (island === undefined) return undefined;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const angle = random.float(0, Math.PI * 2);
    const radius = random.float(distance * 0.62, distance);
    const x = Math.round(settlement.x + Math.cos(angle) * radius);
    const y = Math.round(settlement.y + Math.sin(angle) * radius);
    const tile = world.getTile(x, y);
    if (
      tile !== undefined
      && tile.islandId === island.id
      && tile.water === WaterType.Land
      && !tile.river
      && tile.terrain !== TerrainType.Mountain
      && tile.slope < 0.24
      && tile.floodRisk < 0.78
    ) return world.indexOf(x, y);
  }
  return undefined;
}

function connectIslandSettlements(world: World, config: RoadConfig): void {
  for (const island of world.islands) {
    if (!island.allowRoads || island.settlementIds.length < 2) continue;
    const settlements = island.settlementIds
      .map((id) => world.settlements[id])
      .filter((value): value is NonNullable<typeof value> => value !== undefined && value.generateRoads !== false && value.hidden !== true)
      .sort((left, right) => right.populationTarget - left.populationTarget || left.id - right.id);
    const connected = new Set<number>([settlements[0]?.id ?? -1]);
    while (connected.size < settlements.length) {
      let best: { from: NonNullable<typeof settlements[number]>; to: NonNullable<typeof settlements[number]>; distance: number } | undefined;
      for (const from of settlements) {
        if (!connected.has(from.id)) continue;
        for (const to of settlements) {
          if (connected.has(to.id)) continue;
          const distance = Math.hypot(to.x - from.x, to.y - from.y);
          if (best === undefined || distance < best.distance || (distance === best.distance && to.id < best.to.id)) best = { from, to, distance };
        }
      }
      if (best === undefined) break;
      const path = findGridPath(world, {
        startIndex: best.from.tileIndex,
        goalIndex: best.to.tileIndex,
        traversalCost: (fromIndex, toIndex) => traversalCost(world, config, fromIndex, toIndex),
        maximumVisited: config.maximumPathVisits,
      });
      if (path.length > 0) {
        const road = createRoad(world, RoadType.Main, path, [], [best.from.id, best.to.id]);
        commitRoad(world, road);
        best.from.roadIds.push(road.id);
        best.to.roadIds.push(road.id);
      }
      connected.add(best.to.id);
    }
  }
}

function growSettlementBackbones(world: World, config: RoadConfig, random: Random): void {
  for (const settlement of world.settlements) {
    if (settlement.generateRoads === false || settlement.hidden === true) continue;
    const island = world.islands[settlement.islandId];
    if (island === undefined || !island.allowRoads) continue;
    const spokeCount = settlement.isPrimary ? 2 : settlement.populationTarget >= 2500 ? 2 : 1;
    for (let spoke = 0; spoke < spokeCount; spoke += 1) {
      const target = settlementTarget(world, settlement.id, Math.max(8, Math.min(22, settlement.influenceRadius * 0.85)), random.fork(`${settlement.key}:${spoke}`));
      if (target === undefined) continue;
      const path = findGridPath(world, {
        startIndex: settlement.tileIndex,
        goalIndex: target,
        traversalCost: (fromIndex, toIndex) => traversalCost(world, config, fromIndex, toIndex),
        maximumVisited: Math.min(config.maximumPathVisits, 24_000),
      });
      if (path.length < 5) continue;
      const road = createRoad(world, settlement.isPrimary ? RoadType.Secondary : RoadType.Local, path, [], [settlement.id]);
      commitRoad(world, road);
      settlement.roadIds.push(road.id);
    }
  }
}

function validateAnchorConnectivity(world: World): void {
  const roadTiles = new Set<number>();
  for (const road of world.roads) {
    for (const index of road.path) roadTiles.add(index);
  }
  const first = world.anchors[0];
  if (first === undefined || !roadTiles.has(first.tileIndex)) {
    throw new Error('Road validation could not find the first anchor on the network.');
  }

  const visited = new Set<number>([first.tileIndex]);
  const queue = [first.tileIndex];
  const directions: readonly (readonly [number, number])[] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  for (let offset = 0; offset < queue.length; offset += 1) {
    const index = queue[offset];
    if (index === undefined) continue;
    const x = index % world.width;
    const y = Math.floor(index / world.width);
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.contains(nx, ny)) continue;
      const next = ny * world.width + nx;
      if (roadTiles.has(next) && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  for (const anchor of world.anchors) {
    if (!visited.has(anchor.tileIndex)) {
      throw new Error(`Anchor ${anchor.type} is disconnected from the road network.`);
    }
  }
}

export function generateRoadNetwork(world: World, config: RoadConfig, random: Random): void {
  world.roads = [];
  for (const tile of world.tiles) {
    tile.road = false;
    tile.roadId = null;
    tile.bridge = false;
  }
  routeAnchorConnections(world, config);
  connectIslandSettlements(world, config);
  growSettlementBackbones(world, config, random.fork('settlement-backbones'));
  growSecondaryRoads(world, config, random.fork('secondary-roads'));
  growLocalConnectorRoads(world, config, random.fork('local-roads'));
  validateAnchorConnectivity(world);
}
