import { findGridPath } from '../graph/Pathfinder';
import { RoadType } from '../infrastructure/Road';
import type { World } from '../world/World';
import { TerrainType, WaterType } from '../world/Tile';

export enum TravelMode {
  Walk = 'walk',
  Drive = 'drive',
  PublicTransport = 'public-transport',
}

export enum TrafficProfile {
  Quiet = 'quiet',
  Normal = 'normal',
  RushHour = 'rush-hour',
  Storm = 'storm',
}

export type TravelLocationKind = 'story' | 'anchor' | 'settlement' | 'port' | 'npc' | 'point';
export type TravelSegmentMode = 'walk' | 'drive' | 'public-transport' | 'boat';

export interface TravelLocation {
  readonly id: string;
  readonly label: string;
  readonly kind: TravelLocationKind;
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
}

export interface TravelSegment {
  readonly mode: TravelSegmentMode;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly distanceKilometers: number;
  readonly durationMinutes: number;
  readonly tileIndices: readonly number[];
  readonly instruction: string;
}

export interface TravelPlan {
  readonly from: TravelLocation;
  readonly to: TravelLocation;
  readonly requestedMode: TravelMode;
  readonly trafficProfile: TrafficProfile;
  readonly reachable: boolean;
  readonly distanceKilometers: number;
  readonly durationMinutes: number;
  readonly segments: readonly TravelSegment[];
  readonly warnings: readonly string[];
  readonly contextRevision?: number | undefined;
}

export interface TravelContext {
  readonly timestampMs: number;
  readonly revision: number;
  readonly trafficByRoadId: ReadonlyMap<number, number>;
  readonly closedRoadIds: ReadonlySet<number>;
  readonly restrictedRoadIds: ReadonlySet<number>;
  readonly closedBridgeIds: ReadonlySet<number>;
  readonly restrictedBridgeIds: ReadonlySet<number>;
  readonly roadSpeedMultiplier: number;
  readonly walkingSpeedMultiplier: number;
  readonly reasons: readonly string[];
}

export interface TravelPlanOptions {
  readonly mode: TravelMode;
  readonly trafficProfile?: TrafficProfile;
  readonly context?: TravelContext | undefined;
}

interface RoadTileData {
  readonly indices: readonly number[];
  readonly typeByIndex: ReadonlyMap<number, RoadType>;
  readonly roadIdByIndex: ReadonlyMap<number, number>;
  readonly bridgeIdByIndex: ReadonlyMap<number, number>;
}

interface Journey {
  readonly segments: readonly TravelSegment[];
  readonly durationMinutes: number;
  readonly distanceKilometers: number;
}

const ROAD_PRIORITY: Readonly<Record<RoadType, number>> = {
  [RoadType.Main]: 3,
  [RoadType.Secondary]: 2,
  [RoadType.Local]: 1,
};

const TRAFFIC_MULTIPLIER: Readonly<Record<TrafficProfile, number>> = {
  [TrafficProfile.Quiet]: 0.88,
  [TrafficProfile.Normal]: 1,
  [TrafficProfile.RushHour]: 1.48,
  [TrafficProfile.Storm]: 1.72,
};

function tileDistance(world: World, leftIndex: number, rightIndex: number): number {
  const left = world.tiles[leftIndex];
  const right = world.tiles[rightIndex];
  if (left === undefined || right === undefined) return 0;
  return Math.hypot(right.x - left.x, right.y - left.y) * world.metadata.tileSizeMeters / 1000;
}

function pathDistance(world: World, path: readonly number[]): number {
  let distance = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous !== undefined && current !== undefined) distance += tileDistance(world, previous, current);
  }
  return distance;
}

function roadTileData(world: World): RoadTileData {
  const typeByIndex = new Map<number, RoadType>();
  const roadIdByIndex = new Map<number, number>();
  const bridgeIdByIndex = new Map<number, number>();
  for (const bridge of world.bridges) {
    for (const index of bridge.deckTileIndices) bridgeIdByIndex.set(index, bridge.id);
  }
  for (const road of world.roads) {
    for (const index of [...road.path, ...road.bridgeTiles]) {
      const existing = typeByIndex.get(index);
      if (existing === undefined || ROAD_PRIORITY[road.type] > ROAD_PRIORITY[existing]) {
        typeByIndex.set(index, road.type);
        roadIdByIndex.set(index, road.id);
      }
      if (road.bridgeId !== null) bridgeIdByIndex.set(index, road.bridgeId);
    }
  }
  return {
    indices: [...typeByIndex.keys()].sort((left, right) => left - right),
    typeByIndex,
    roadIdByIndex,
    bridgeIdByIndex,
  };
}

function nearestRoadIndex(world: World, locationIndex: number, roads: RoadTileData): number | undefined {
  const origin = world.tiles[locationIndex];
  if (origin === undefined) return undefined;
  let bestIndex: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const index of roads.indices) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    if (origin.islandId !== null && tile.islandId !== null && origin.islandId !== tile.islandId && !tile.bridge) continue;
    const distance = Math.hypot(tile.x - origin.x, tile.y - origin.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function walkingSpeedKph(terrain: TerrainType, onRoad: boolean): number {
  if (onRoad) return 5;
  switch (terrain) {
    case TerrainType.Beach:
    case TerrainType.Floodplain:
    case TerrainType.Delta:
      return 3;
    case TerrainType.Hill:
      return 2.7;
    case TerrainType.Mountain:
      return 1.65;
    case TerrainType.Forest:
      return 2.35;
    default:
      return 3.7;
  }
}

function findWalkingPath(world: World, startIndex: number, goalIndex: number, context?: TravelContext): readonly number[] {
  return findGridPath(world, {
    startIndex,
    goalIndex,
    heuristicScale: 0.04,
    maximumVisited: Math.min(world.tiles.length, 180_000),
    traversalCost: (_fromIndex, toIndex) => {
      const tile = world.tiles[toIndex];
      if (tile === undefined || (tile.water !== WaterType.Land && !tile.bridge)) return Number.POSITIVE_INFINITY;
      if (tile.bridge) {
        const bridge = world.bridges.find((item) => item.deckTileIndices.includes(toIndex));
        if (bridge !== undefined && context?.closedBridgeIds.has(bridge.id) === true) return Number.POSITIVE_INFINITY;
      }
      const bridge = tile.bridge ? world.bridges.find((item) => item.deckTileIndices.includes(toIndex)) : undefined;
      const bridgeRestriction = bridge !== undefined && context?.restrictedBridgeIds.has(bridge.id) === true ? 1.4 : 1;
      const speed = walkingSpeedKph(tile.terrain, tile.road || tile.bridge) * (context?.walkingSpeedMultiplier ?? 1);
      const baseMinutes = world.metadata.tileSizeMeters / 1000 / Math.max(0.5, speed) * 60;
      return baseMinutes * (1 + tile.slope * 3.5 + tile.floodRisk * 0.45) * bridgeRestriction;
    },
  });
}

function roadSpeedKph(type: RoadType | undefined, mode: TravelSegmentMode, bridge: boolean): number {
  if (mode === 'public-transport') {
    if (bridge) return 18;
    if (type === RoadType.Main) return 25;
    if (type === RoadType.Secondary) return 19;
    return 14;
  }
  if (bridge) return 28;
  if (type === RoadType.Main) return 52;
  if (type === RoadType.Secondary) return 36;
  return 22;
}

function findRoadPath(
  world: World,
  startIndex: number,
  goalIndex: number,
  roads: RoadTileData,
  mode: 'drive' | 'public-transport',
  traffic: TrafficProfile,
  penalizedIndices: ReadonlySet<number> = new Set<number>(),
  context?: TravelContext,
): readonly number[] {
  const multiplier = TRAFFIC_MULTIPLIER[traffic];
  return findGridPath(world, {
    startIndex,
    goalIndex,
    heuristicScale: 0.03,
    maximumVisited: Math.min(world.tiles.length, 180_000),
    traversalCost: (_fromIndex, toIndex) => {
      const tile = world.tiles[toIndex];
      const roadType = roads.typeByIndex.get(toIndex);
      if (tile === undefined || (roadType === undefined && !tile.bridge)) return Number.POSITIVE_INFINITY;
      const roadId = roads.roadIdByIndex.get(toIndex);
      const bridgeId = roads.bridgeIdByIndex.get(toIndex);
      if (roadId !== undefined && context?.closedRoadIds.has(roadId) === true) return Number.POSITIVE_INFINITY;
      if (bridgeId !== undefined && context?.closedBridgeIds.has(bridgeId) === true) return Number.POSITIVE_INFINITY;
      const baseSpeed = roadSpeedKph(roadType, mode, tile.bridge);
      const liveTraffic = roadId === undefined ? 1 : context?.trafficByRoadId.get(roadId) ?? 1;
      const restrictedRoad = roadId !== undefined && context?.restrictedRoadIds.has(roadId) === true ? 1.45 : 1;
      const restrictedBridge = bridgeId !== undefined && context?.restrictedBridgeIds.has(bridgeId) === true ? 1.6 : 1;
      const weatherSpeed = context?.roadSpeedMultiplier ?? 1;
      const speed = Math.max(2, baseSpeed * weatherSpeed / Math.max(0.25, liveTraffic));
      const alternatePenalty = penalizedIndices.has(toIndex) ? 5.5 : 1;
      return world.metadata.tileSizeMeters / 1000 / speed * 60 * multiplier * alternatePenalty * restrictedRoad * restrictedBridge;
    },
  });
}

function segmentForPath(
  world: World,
  mode: TravelSegmentMode,
  fromLabel: string,
  toLabel: string,
  path: readonly number[],
  durationMinutes: number,
  instruction: string,
): TravelSegment {
  return {
    mode,
    fromLabel,
    toLabel,
    distanceKilometers: pathDistance(world, path),
    durationMinutes,
    tileIndices: path,
    instruction,
  };
}

function walkingJourney(world: World, from: TravelLocation, to: TravelLocation, context?: TravelContext): Journey | undefined {
  const path = findWalkingPath(world, from.tileIndex, to.tileIndex, context);
  if (path.length === 0) return undefined;
  let duration = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous === undefined || current === undefined) continue;
    const tile = world.tiles[current];
    if (tile === undefined) continue;
    const speed = walkingSpeedKph(tile.terrain, tile.road || tile.bridge) * (context?.walkingSpeedMultiplier ?? 1);
    const bridge = tile.bridge ? world.bridges.find((item) => item.deckTileIndices.includes(current)) : undefined;
    const restrictedBridge = bridge !== undefined && context?.restrictedBridgeIds.has(bridge.id) === true ? 1.4 : 1;
    duration += tileDistance(world, previous, current) / Math.max(0.5, speed) * 60
      * (1 + tile.slope * 3.5 + tile.floodRisk * 0.45) * restrictedBridge;
  }
  const segment = segmentForPath(world, 'walk', from.label, to.label, path, duration, `Walk from ${from.label} to ${to.label}.`);
  return { segments: [segment], durationMinutes: duration, distanceKilometers: segment.distanceKilometers };
}

function roadJourney(
  world: World,
  from: TravelLocation,
  to: TravelLocation,
  roads: RoadTileData,
  mode: 'drive' | 'public-transport',
  traffic: TrafficProfile,
  penalizedIndices: ReadonlySet<number> = new Set<number>(),
  context?: TravelContext,
): Journey | undefined {
  const startRoad = nearestRoadIndex(world, from.tileIndex, roads);
  const endRoad = nearestRoadIndex(world, to.tileIndex, roads);
  if (startRoad === undefined || endRoad === undefined) return undefined;

  const accessPath = findWalkingPath(world, from.tileIndex, startRoad, context);
  const exitPath = findWalkingPath(world, endRoad, to.tileIndex, context);
  const roadPath = findRoadPath(world, startRoad, endRoad, roads, mode, traffic, penalizedIndices, context);
  if (accessPath.length === 0 || exitPath.length === 0 || roadPath.length === 0) return undefined;

  const segments: TravelSegment[] = [];
  let duration = 0;
  let distance = 0;
  const accessDistance = pathDistance(world, accessPath);
  if (accessDistance > 0.001) {
    const accessDuration = accessDistance / Math.max(0.5, 4.5 * (context?.walkingSpeedMultiplier ?? 1)) * 60;
    segments.push(segmentForPath(world, 'walk', from.label, 'nearest road', accessPath, accessDuration, `Walk ${accessDistance.toFixed(1)} km to the road.`));
    duration += accessDuration;
    distance += accessDistance;
  }

  let roadDuration = 0;
  for (let index = 1; index < roadPath.length; index += 1) {
    const previous = roadPath[index - 1];
    const current = roadPath[index];
    if (previous === undefined || current === undefined) continue;
    const tile = world.tiles[current];
    if (tile === undefined) continue;
    const roadId = roads.roadIdByIndex.get(current);
    const liveTraffic = roadId === undefined ? 1 : context?.trafficByRoadId.get(roadId) ?? 1;
    const bridgeId = roads.bridgeIdByIndex.get(current);
    const restrictedRoad = roadId !== undefined && context?.restrictedRoadIds.has(roadId) === true ? 1.45 : 1;
    const restrictedBridge = bridgeId !== undefined && context?.restrictedBridgeIds.has(bridgeId) === true ? 1.6 : 1;
    const speed = Math.max(2, roadSpeedKph(roads.typeByIndex.get(current), mode, tile.bridge) * (context?.roadSpeedMultiplier ?? 1) / Math.max(0.25, liveTraffic));
    roadDuration += tileDistance(world, previous, current) / speed * 60 * TRAFFIC_MULTIPLIER[traffic] * restrictedRoad * restrictedBridge;
  }
  if (mode === 'public-transport') roadDuration += traffic === TrafficProfile.RushHour ? 12 : traffic === TrafficProfile.Storm ? 16 : 8;
  const roadSegment = segmentForPath(
    world,
    mode,
    'road access',
    'road exit',
    roadPath,
    roadDuration,
    mode === 'drive' ? 'Drive along the generated road network.' : 'Take a jeepney/tricycle estimate along the generated road network.',
  );
  segments.push(roadSegment);
  duration += roadDuration;
  distance += roadSegment.distanceKilometers;

  const exitDistance = pathDistance(world, exitPath);
  if (exitDistance > 0.001) {
    const exitDuration = exitDistance / Math.max(0.5, 4.5 * (context?.walkingSpeedMultiplier ?? 1)) * 60;
    segments.push(segmentForPath(world, 'walk', 'road exit', to.label, exitPath, exitDuration, `Walk ${exitDistance.toFixed(1)} km to ${to.label}.`));
    duration += exitDuration;
    distance += exitDistance;
  }

  return { segments, durationMinutes: duration, distanceKilometers: distance };
}

function nearestPortOnIsland(world: World, location: TravelLocation, islandId: number) {
  const origin = world.tiles[location.tileIndex];
  if (origin === undefined) return undefined;
  return world.ports
    .filter((port) => port.islandId === islandId)
    .sort((left, right) => (
      Math.hypot(left.position.x - origin.x, left.position.y - origin.y)
      - Math.hypot(right.position.x - origin.x, right.position.y - origin.y)
      || left.id - right.id
    ))[0];
}

function portLocation(port: World['ports'][number]): TravelLocation {
  return {
    id: `port:${port.key}`,
    label: port.name,
    kind: 'port',
    tileIndex: port.tileIndex,
    x: port.position.x,
    y: port.position.y,
  };
}

function waterPath(world: World, startIndex: number, goalIndex: number): readonly number[] {
  return findGridPath(world, {
    startIndex,
    goalIndex,
    heuristicScale: 0.8,
    maximumVisited: Math.min(world.tiles.length, 180_000),
    traversalCost: (_fromIndex, toIndex) => (
      world.tiles[toIndex]?.water === WaterType.Ocean ? 1 : Number.POSITIVE_INFINITY
    ),
  });
}

function accessJourney(
  world: World,
  from: TravelLocation,
  to: TravelLocation,
  roads: RoadTileData,
  traffic: TrafficProfile,
  context?: TravelContext,
): Journey | undefined {
  if (from.tileIndex === to.tileIndex) return { segments: [], durationMinutes: 0, distanceKilometers: 0 };
  return roadJourney(world, from, to, roads, 'public-transport', traffic, new Set<number>(), context)
    ?? walkingJourney(world, from, to, context);
}

function maritimeJourney(
  world: World,
  from: TravelLocation,
  to: TravelLocation,
  roads: RoadTileData,
  traffic: TrafficProfile,
  context?: TravelContext,
): Journey | undefined {
  const fromIslandId = world.tiles[from.tileIndex]?.islandId;
  const toIslandId = world.tiles[to.tileIndex]?.islandId;
  if (fromIslandId === null || fromIslandId === undefined || toIslandId === null || toIslandId === undefined || fromIslandId === toIslandId) {
    return undefined;
  }
  const fromPort = nearestPortOnIsland(world, from, fromIslandId);
  const toPort = nearestPortOnIsland(world, to, toIslandId);
  if (fromPort === undefined || toPort === undefined) return undefined;
  const crossing = waterPath(world, fromPort.waterTileIndex, toPort.waterTileIndex);
  if (crossing.length < 2) return undefined;

  const fromPortLocation = portLocation(fromPort);
  const toPortLocation = portLocation(toPort);
  const departure = accessJourney(world, from, fromPortLocation, roads, traffic, context);
  const arrival = accessJourney(world, toPortLocation, to, roads, traffic, context);
  if (departure === undefined || arrival === undefined) return undefined;

  const crossingDistance = pathDistance(world, crossing);
  const boatSpeed = traffic === TrafficProfile.Storm ? 11 : 18;
  const boardingMinutes = traffic === TrafficProfile.Storm ? 16 : traffic === TrafficProfile.RushHour ? 12 : 8;
  const crossingDuration = boardingMinutes + crossingDistance / boatSpeed * 60;
  const boat = segmentForPath(
    world,
    'boat',
    fromPort.name,
    toPort.name,
    crossing,
    crossingDuration,
    `Take a passenger boat from ${fromPort.name} to ${toPort.name}.`,
  );
  return {
    segments: [...departure.segments, boat, ...arrival.segments],
    durationMinutes: departure.durationMinutes + crossingDuration + arrival.durationMinutes,
    distanceKilometers: departure.distanceKilometers + crossingDistance + arrival.distanceKilometers,
  };
}

export function collectTravelLocations(world: World): readonly TravelLocation[] {
  const locations: TravelLocation[] = [];
  for (const item of world.storyObjects) locations.push({ id: `story:${item.key}`, label: item.name, kind: 'story', tileIndex: item.tileIndex, x: item.x, y: item.y });
  for (const anchor of world.anchors) locations.push({ id: `anchor:${anchor.key}`, label: anchor.name, kind: 'anchor', tileIndex: anchor.tileIndex, x: anchor.x, y: anchor.y });
  for (const settlement of world.settlements) locations.push({ id: `settlement:${settlement.key}`, label: settlement.name, kind: 'settlement', tileIndex: settlement.tileIndex, x: settlement.x, y: settlement.y });
  for (const port of world.ports) locations.push({ id: `port:${port.key}`, label: port.name, kind: 'port', tileIndex: port.tileIndex, x: port.position.x, y: port.position.y });
  for (const npc of world.npcs) locations.push({ id: `npc:${npc.key}`, label: npc.name, kind: 'npc', tileIndex: npc.tileIndex, x: npc.x, y: npc.y });
  return locations.sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));
}

export function findTravelLocation(world: World, id: string): TravelLocation | undefined {
  return collectTravelLocations(world).find((location) => location.id === id);
}

export function planTravel(world: World, from: TravelLocation, to: TravelLocation, options: TravelPlanOptions): TravelPlan {
  const trafficProfile = options.trafficProfile ?? TrafficProfile.Normal;
  const roads = roadTileData(world);
  const journey = options.mode === TravelMode.Walk
    ? walkingJourney(world, from, to, options.context)
    : options.mode === TravelMode.Drive
      ? roadJourney(world, from, to, roads, 'drive', trafficProfile, new Set<number>(), options.context)
      : roadJourney(world, from, to, roads, 'public-transport', trafficProfile, new Set<number>(), options.context)
        ?? maritimeJourney(world, from, to, roads, trafficProfile, options.context);
  if (journey === undefined) {
    return {
      from,
      to,
      requestedMode: options.mode,
      trafficProfile,
      reachable: false,
      distanceKilometers: 0,
      durationMinutes: 0,
      segments: [],
      warnings: ['No connected route was found for the selected travel mode. Remote islands require passenger-boat access and the Public transport mode.'],
      contextRevision: options.context?.revision,
    };
  }
  const usesBoat = journey.segments.some((segment) => segment.mode === 'boat');
  return {
    from,
    to,
    requestedMode: options.mode,
    trafficProfile,
    reachable: true,
    distanceKilometers: journey.distanceKilometers,
    durationMinutes: journey.durationMinutes,
    segments: journey.segments,
    warnings: options.context === undefined
      ? [usesBoat
        ? 'Passenger-boat time includes jetty access, boarding, and the generated open-water crossing.'
        : 'Travel time is a campaign estimate based on 125 m tiles, generated road classes, terrain, and the selected traffic profile.']
      : ['Live world conditions applied.', ...options.context.reasons],
    contextRevision: options.context?.revision,
  };
}



function planSignature(plan: TravelPlan): string {
  return plan.segments.map((segment) => `${segment.mode}:${segment.tileIndices.filter((_, index) => index % 5 === 0).join('.')}`).join('|');
}

function roadTilesForPenalty(plan: TravelPlan): Set<number> {
  const result = new Set<number>();
  for (const segment of plan.segments) {
    if (segment.mode !== 'drive' && segment.mode !== 'public-transport') continue;
    for (let index = 2; index < segment.tileIndices.length - 2; index += 3) {
      const tileIndex = segment.tileIndices[index];
      if (tileIndex !== undefined) result.add(tileIndex);
    }
  }
  return result;
}

/**
 * Returns the fastest route followed by genuinely different road alternatives.
 * Alternatives are found by progressively penalizing tiles used by earlier routes,
 * so forks and secondary approaches can be surfaced without mutating the world.
 */
export function planTravelAlternatives(
  world: World,
  from: TravelLocation,
  to: TravelLocation,
  options: TravelPlanOptions,
  limit = 3,
): readonly TravelPlan[] {
  const maximum = Math.max(1, Math.min(5, Math.round(limit)));
  const primary = planTravel(world, from, to, options);
  if (!primary.reachable || maximum === 1 || (options.mode !== TravelMode.Drive && options.mode !== TravelMode.PublicTransport)) return [primary];

  const roads = roadTileData(world);
  const trafficProfile = options.trafficProfile ?? TrafficProfile.Normal;
  const plans: TravelPlan[] = [primary];
  const signatures = new Set<string>([planSignature(primary)]);
  const penalized = roadTilesForPenalty(primary);

  for (let attempt = 0; attempt < maximum * 3 && plans.length < maximum; attempt += 1) {
    const journey = roadJourney(
      world,
      from,
      to,
      roads,
      options.mode === TravelMode.Drive ? 'drive' : 'public-transport',
      trafficProfile,
      penalized,
      options.context,
    );
    if (journey === undefined) break;
    const plan: TravelPlan = {
      from,
      to,
      requestedMode: options.mode,
      trafficProfile,
      reachable: true,
      distanceKilometers: journey.distanceKilometers,
      durationMinutes: journey.durationMinutes,
      segments: journey.segments,
      warnings: options.context === undefined
        ? ['Alternate route generated from a different fork or approach in the road network.']
        : ['Alternate live route generated from a different fork or approach.', ...options.context.reasons],
      contextRevision: options.context?.revision,
    };
    const signature = planSignature(plan);
    for (const index of roadTilesForPenalty(plan)) penalized.add(index);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    plans.push(plan);
  }
  return plans.sort((left, right) => left.durationMinutes - right.durationMinutes || left.distanceKilometers - right.distanceKilometers);
}

export function pointTravelLocation(world: World, x: number, y: number, label: string): TravelLocation | undefined {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const tile = world.getTile(tileX, tileY);
  if (tile === undefined) return undefined;
  return {
    id: `point:${tileX}:${tileY}`,
    label,
    kind: 'point',
    tileIndex: world.indexOf(tileX, tileY),
    x: tileX,
    y: tileY,
  };
}

export function formatTravelDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours === 0) return `${remainder} min`;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}
