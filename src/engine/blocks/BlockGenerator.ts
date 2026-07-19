import type { Block, GridPoint } from './Block';
import type { BlockConfig } from '../config/GenerationConfig';
import { AnchorType, type Anchor } from '../settlement/Anchor';
import { TerrainType, WaterType } from '../world/Tile';
import type { World } from '../world/World';

interface DirectedEdge {
  readonly start: GridPoint;
  readonly end: GridPoint;
}

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const CORE_ANCHORS = new Set<AnchorType>([
  AnchorType.TownPlaza,
  AnchorType.Church,
  AnchorType.Market,
  AnchorType.School,
  AnchorType.Hospital,
]);

function distanceToClosestAnchor(tileX: number, tileY: number, anchors: readonly Anchor[]): number {
  let closest = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    closest = Math.min(closest, Math.hypot(anchor.x - tileX, anchor.y - tileY));
  }
  return closest;
}

function buildCandidateMask(world: World, config: BlockConfig): Uint8Array {
  const mask = new Uint8Array(world.tiles.length);
  const coreAnchors = world.anchors.filter((anchor) => CORE_ANCHORS.has(anchor.type));
  const portAnchors = world.anchors.filter((anchor) => anchor.type === AnchorType.Port);
  const airportAnchors = world.anchors.filter((anchor) => anchor.type === AnchorType.Airport);
  const settlements = world.settlements;

  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (
      tile === undefined
      || tile.water !== WaterType.Land
      || tile.road
      || tile.river
      || tile.terrain === TerrainType.Mountain
      || tile.slope > config.maximumSlope
      || tile.floodRisk > config.maximumFloodRisk
      || tile.roadDistance < 1
      || tile.roadDistance > config.maximumRoadDistance
    ) {
      continue;
    }

    const coreDistance = distanceToClosestAnchor(tile.x, tile.y, coreAnchors);
    const portDistance = distanceToClosestAnchor(tile.x, tile.y, portAnchors);
    const airportDistance = distanceToClosestAnchor(tile.x, tile.y, airportAnchors);
    const withinSettlement = settlements.some((settlement) => (
      world.tiles[index]?.islandId === settlement.islandId
      && Math.hypot(tile.x - settlement.x, tile.y - settlement.y) <= settlement.influenceRadius
    ));
    if (
      coreDistance <= config.urbanAnchorRadius
      || portDistance <= config.portAnchorRadius
      || airportDistance <= config.airportAnchorRadius
      || withinSettlement
    ) {
      mask[index] = 1;
    }
  }

  return mask;
}

function collectComponents(world: World, mask: Uint8Array): readonly number[][] {
  const visited = new Uint8Array(mask.length);
  const components: number[][] = [];

  for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
    if (mask[startIndex] !== 1 || visited[startIndex] === 1) continue;
    const component: number[] = [];
    const queue = [startIndex];
    visited[startIndex] = 1;

    for (let offset = 0; offset < queue.length; offset += 1) {
      const currentIndex = queue[offset];
      if (currentIndex === undefined) continue;
      component.push(currentIndex);
      const x = currentIndex % world.width;
      const y = Math.floor(currentIndex / world.width);

      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!world.contains(nx, ny)) continue;
        const nextIndex = ny * world.width + nx;
        if (mask[nextIndex] !== 1 || visited[nextIndex] === 1) continue;
        visited[nextIndex] = 1;
        queue.push(nextIndex);
      }
    }

    components.push(component);
  }

  return components;
}

function pointKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function addBoundaryEdges(world: World, componentMask: Uint8Array, index: number, edges: DirectedEdge[]): void {
  const tile = world.tiles[index];
  if (tile === undefined) return;
  const { x, y } = tile;
  const top = y === 0 ? -1 : index - world.width;
  const right = x + 1 >= world.width ? -1 : index + 1;
  const bottom = y + 1 >= world.height ? -1 : index + world.width;
  const left = x === 0 ? -1 : index - 1;

  if (top < 0 || componentMask[top] !== 1) {
    edges.push({ start: { x, y }, end: { x: x + 1, y } });
  }
  if (right < 0 || componentMask[right] !== 1) {
    edges.push({ start: { x: x + 1, y }, end: { x: x + 1, y: y + 1 } });
  }
  if (bottom < 0 || componentMask[bottom] !== 1) {
    edges.push({ start: { x: x + 1, y: y + 1 }, end: { x, y: y + 1 } });
  }
  if (left < 0 || componentMask[left] !== 1) {
    edges.push({ start: { x, y: y + 1 }, end: { x, y } });
  }
}

function simplifyOrthogonalLoop(points: readonly GridPoint[]): readonly GridPoint[] {
  if (points.length <= 3) return points;
  const simplified: GridPoint[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index + points.length - 1) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (previous === undefined || current === undefined || next === undefined) continue;
    const sameX = previous.x === current.x && current.x === next.x;
    const sameY = previous.y === current.y && current.y === next.y;
    if (!sameX && !sameY) simplified.push(current);
  }

  return simplified.length >= 3 ? simplified : points;
}

function polygonArea(points: readonly GridPoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    area += current.x * next.y - next.x * current.y;
  }
  return area * 0.5;
}

function polygonPerimeter(points: readonly GridPoint[]): number {
  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    perimeter += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return perimeter;
}

function traceBoundaryLoops(world: World, component: readonly number[]): readonly (readonly GridPoint[])[] {
  const componentMask = new Uint8Array(world.tiles.length);
  for (const index of component) componentMask[index] = 1;
  const edges: DirectedEdge[] = [];
  for (const index of component) addBoundaryEdges(world, componentMask, index, edges);

  const outgoing = new Map<string, number[]>();
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    if (edge === undefined) continue;
    const key = pointKey(edge.start);
    const entries = outgoing.get(key) ?? [];
    entries.push(index);
    outgoing.set(key, entries);
  }
  for (const entries of outgoing.values()) entries.sort((left, right) => left - right);

  const visited = new Uint8Array(edges.length);
  const loops: (readonly GridPoint[])[] = [];
  for (let startEdgeIndex = 0; startEdgeIndex < edges.length; startEdgeIndex += 1) {
    if (visited[startEdgeIndex] === 1) continue;
    const startEdge = edges[startEdgeIndex];
    if (startEdge === undefined) continue;
    const loop: GridPoint[] = [startEdge.start];
    let edgeIndex = startEdgeIndex;
    let guard = 0;

    while (guard <= edges.length) {
      const edge = edges[edgeIndex];
      if (edge === undefined || visited[edgeIndex] === 1) break;
      visited[edgeIndex] = 1;
      loop.push(edge.end);
      if (pointKey(edge.end) === pointKey(startEdge.start)) break;
      const candidates = outgoing.get(pointKey(edge.end)) ?? [];
      const nextEdge = candidates.find((candidate) => visited[candidate] === 0);
      if (nextEdge === undefined) break;
      edgeIndex = nextEdge;
      guard += 1;
    }

    const last = loop.at(-1);
    if (loop.length >= 4 && last !== undefined && pointKey(last) === pointKey(loop[0] ?? last)) {
      loop.pop();
      loops.push(simplifyOrthogonalLoop(loop));
    }
  }

  return loops.sort((left, right) => Math.abs(polygonArea(right)) - Math.abs(polygonArea(left)));
}

function calculateRoadFrontage(world: World, componentMask: Uint8Array, component: readonly number[]): number {
  let frontage = 0;
  for (const index of component) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    for (const [dx, dy] of DIRECTIONS) {
      const nx: number = tile.x + dx;
      const ny: number = tile.y + dy;
      if (!world.contains(nx, ny)) continue;
      const nextIndex = ny * world.width + nx;
      if (componentMask[nextIndex] !== 1 && world.tiles[nextIndex]?.road === true) frontage += 1;
    }
  }
  return frontage;
}

function createBlock(world: World, id: number, component: readonly number[]): Block | undefined {
  const loops = traceBoundaryLoops(world, component);
  const boundary = loops[0];
  if (boundary === undefined || boundary.length < 3) return undefined;
  const componentMask = new Uint8Array(world.tiles.length);
  let centroidX = 0;
  let centroidY = 0;
  let accessibility = 0;
  for (const index of component) {
    componentMask[index] = 1;
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    centroidX += tile.x + 0.5;
    centroidY += tile.y + 0.5;
    accessibility += tile.accessibility;
  }
  const divisor = Math.max(1, component.length);

  return {
    id,
    name: '',
    tileIndices: [...component].sort((left, right) => left - right),
    boundary,
    holes: loops.slice(1),
    centroid: { x: centroidX / divisor, y: centroidY / divisor },
    area: component.length,
    perimeter: loops.reduce((sum, loop) => sum + polygonPerimeter(loop), 0),
    roadFrontage: calculateRoadFrontage(world, componentMask, component),
    averageAccessibility: accessibility / divisor,
    averageLandValue: 0,
    zoneId: null,
  };
}

export function generateBlocks(world: World, config: BlockConfig): void {
  world.blocks = [];
  for (const tile of world.tiles) tile.blockId = null;

  const mask = buildCandidateMask(world, config);
  const components = collectComponents(world, mask)
    .filter((component) => component.length >= config.minimumArea && component.length <= config.maximumArea)
    .sort((left, right) => (left[0] ?? 0) - (right[0] ?? 0));

  for (const component of components) {
    const provisional = createBlock(world, world.blocks.length, component);
    if (provisional === undefined || provisional.roadFrontage < config.minimumRoadFrontage) continue;
    const block: Block = { ...provisional, id: world.blocks.length };
    world.blocks.push(block);
    for (const index of block.tileIndices) {
      const tile = world.tiles[index];
      if (tile !== undefined) tile.blockId = block.id;
    }
  }
}
