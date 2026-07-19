import type { AccessibilityConfig } from '../config/GenerationConfig';
import { RoadType } from '../infrastructure/Road';
import { MinPriorityQueue } from '../math/MinPriorityQueue';
import { AnchorType } from '../settlement/Anchor';
import { WaterType } from '../world/Tile';
import type { World } from '../world/World';

const CARDINAL_DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const TRAVEL_DIRECTIONS: readonly (readonly [number, number, boolean])[] = [
  [-1, 0, false],
  [1, 0, false],
  [0, -1, false],
  [0, 1, false],
  [-1, -1, true],
  [1, -1, true],
  [-1, 1, true],
  [1, 1, true],
];

function anchorStartCost(type: AnchorType): number {
  switch (type) {
    case AnchorType.TownPlaza:
      return 0;
    case AnchorType.Market:
      return 3;
    case AnchorType.Church:
      return 6;
    case AnchorType.Hospital:
      return 7;
    case AnchorType.School:
      return 9;
    case AnchorType.Port:
      return 16;
    case AnchorType.Airport:
      return 22;
    case AnchorType.RiceFields:
      return 24;
    case AnchorType.Hacienda:
      return 26;
    case AnchorType.Custom:
      return 12;
  }
}

function computeRoadClasses(world: World): Uint8Array {
  const classes = new Uint8Array(world.tiles.length);
  for (const road of world.roads) {
    const roadClass = road.type === RoadType.Main ? 1 : road.type === RoadType.Secondary ? 2 : 3;
    for (const index of road.path) {
      const previous = classes[index];
      if (previous === undefined || previous === 0 || roadClass < previous) {
        classes[index] = roadClass;
      }
    }
  }
  return classes;
}

function computeRoadDistances(world: World, maximumDistance: number): Int32Array {
  const distances = new Int32Array(world.tiles.length);
  distances.fill(-1);
  const queue: number[] = [];

  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (tile?.road === true) {
      distances[index] = 0;
      queue.push(index);
    }
  }

  for (let offset = 0; offset < queue.length; offset += 1) {
    const currentIndex = queue[offset];
    if (currentIndex === undefined) continue;
    const currentDistance = distances[currentIndex];
    if (currentDistance === undefined || currentDistance < 0 || currentDistance >= maximumDistance) continue;
    const x = currentIndex % world.width;
    const y = Math.floor(currentIndex / world.width);

    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.contains(nx, ny)) continue;
      const nextIndex = ny * world.width + nx;
      const nextTile = world.tiles[nextIndex];
      if ((nextTile?.water !== WaterType.Land && nextTile?.bridge !== true) || distances[nextIndex] !== -1) continue;
      distances[nextIndex] = currentDistance + 1;
      queue.push(nextIndex);
    }
  }

  return distances;
}

function travelCost(
  world: World,
  roadClasses: Uint8Array,
  index: number,
  config: AccessibilityConfig,
): number {
  const tile = world.tiles[index];
  if (tile === undefined || (tile.water !== WaterType.Land && !tile.bridge)) return Number.POSITIVE_INFINITY;

  const roadClass = roadClasses[index];
  const base = roadClass === 1
    ? config.mainRoadCost
    : roadClass === 2
      ? config.secondaryRoadCost
      : roadClass === 3
        ? config.localRoadCost
        : config.offRoadCost;
  return base + tile.slope * config.slopeWeight + tile.floodRisk * config.floodRiskWeight;
}

function computeServiceCosts(
  world: World,
  roadClasses: Uint8Array,
  config: AccessibilityConfig,
): Float64Array {
  const costs = new Float64Array(world.tiles.length);
  costs.fill(Number.POSITIVE_INFINITY);
  const queue = new MinPriorityQueue();

  for (const anchor of world.anchors) {
    const startCost = anchorStartCost(anchor.type);
    const known = costs[anchor.tileIndex];
    if (known === undefined || startCost < known) {
      costs[anchor.tileIndex] = startCost;
      queue.push({ index: anchor.tileIndex, priority: startCost });
    }
  }

  for (const settlement of world.settlements) {
    const startCost = settlement.isPrimary ? 0 : settlement.type === 'town' || settlement.type === 'city' ? 5 : 11;
    const known = costs[settlement.tileIndex];
    if (known === undefined || startCost < known) {
      costs[settlement.tileIndex] = startCost;
      queue.push({ index: settlement.tileIndex, priority: startCost });
    }
  }

  while (queue.size > 0) {
    const entry = queue.pop();
    if (entry === undefined) break;
    const currentCost = costs[entry.index];
    if (currentCost === undefined || entry.priority > currentCost) continue;
    const x = entry.index % world.width;
    const y = Math.floor(entry.index / world.width);

    for (const [dx, dy, diagonal] of TRAVEL_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.contains(nx, ny)) continue;
      const nextIndex = ny * world.width + nx;
      const baseCost = travelCost(world, roadClasses, nextIndex, config);
      if (!Number.isFinite(baseCost)) continue;
      const nextCost = currentCost + baseCost * (diagonal ? config.diagonalCost : 1);
      const knownCost = costs[nextIndex];
      if (knownCost !== undefined && nextCost >= knownCost) continue;
      costs[nextIndex] = nextCost;
      queue.push({ index: nextIndex, priority: nextCost });
    }
  }

  return costs;
}

export function calculateAccessibility(world: World, config: AccessibilityConfig): void {
  const roadClasses = computeRoadClasses(world);
  const roadDistances = computeRoadDistances(world, config.maximumRoadDistance);
  const serviceCosts = computeServiceCosts(world, roadClasses, config);

  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    if (tile.water !== WaterType.Land) {
      tile.roadDistance = -1;
      tile.accessibility = 0;
      continue;
    }

    const roadDistance = roadDistances[index] ?? -1;
    const effectiveRoadDistance = roadDistance < 0 ? config.maximumRoadDistance + 1 : roadDistance;
    const serviceCost = serviceCosts[index] ?? Number.POSITIVE_INFINITY;
    const serviceScore = Number.isFinite(serviceCost)
      ? Math.exp(-serviceCost / config.serviceCostScale)
      : 0;
    const roadScore = Math.exp(-effectiveRoadDistance / config.roadDistanceScale);
    tile.roadDistance = roadDistance;
    tile.accessibility = Math.min(
      1,
      Math.max(0, serviceScore * config.serviceWeight + roadScore * config.roadProximityWeight),
    );
  }
}
