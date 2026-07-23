import type { Block } from '../blocks/Block';
import type { BuildingConfig } from '../config/GenerationConfig';
import type { Random } from '../rng/Random';
import type { Anchor } from '../settlement/Anchor';
import { WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { ZoneType } from '../zoning/Zone';
import { BuildingCondition, type Building, type BuildingEntrance } from './Building';
import { templateForAnchor, templatesForZone, type BuildingTemplate } from './BuildingTemplates';

const CARDINAL_DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

interface FrontageCandidate {
  readonly tileIndex: number;
  readonly roadTileIndex: number;
  readonly roadDx: number;
  readonly roadDy: number;
}

interface FootprintCandidate {
  readonly tileIndices: readonly number[];
  readonly footprint: readonly { x: number; y: number }[];
  readonly entrance: BuildingEntrance;
  readonly rotation: 0 | 90 | 180 | 270;
}

function rotationFromRoadDirection(dx: number, dy: number): 0 | 90 | 180 | 270 {
  if (dy < 0) return 0;
  if (dx > 0) return 90;
  if (dy > 0) return 180;
  return 270;
}

function blockZone(world: World, block: Block): ZoneType | undefined {
  const zoneId = block.zoneId;
  if (zoneId !== null) return world.zones[zoneId]?.type;
  for (const index of block.tileIndices) {
    const zone = world.tiles[index]?.zoneType;
    if (zone !== undefined && zone !== null) return zone;
  }
  return undefined;
}

function collectFrontage(world: World, block: Block): readonly FrontageCandidate[] {
  const blockTiles = new Set(block.tileIndices);
  const candidates: FrontageCandidate[] = [];
  for (const tileIndex of block.tileIndices) {
    const tile = world.tiles[tileIndex];
    if (tile === undefined) continue;
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (!world.contains(nx, ny)) continue;
      const roadTileIndex = ny * world.width + nx;
      const neighbor = world.tiles[roadTileIndex];
      if (neighbor?.road !== true || blockTiles.has(roadTileIndex)) continue;
      candidates.push({ tileIndex, roadTileIndex, roadDx: dx, roadDy: dy });
    }
  }
  return candidates;
}

function chooseWeightedTemplate(templates: readonly BuildingTemplate[], random: Random): BuildingTemplate | undefined {
  const total = templates.reduce((sum, template) => sum + template.weight, 0);
  if (total <= 0) return undefined;
  let cursor = random.float(0, total);
  for (const template of templates) {
    cursor -= template.weight;
    if (cursor <= 0) return template;
  }
  return templates[templates.length - 1];
}

function occupancyTarget(zone: ZoneType, config: BuildingConfig): number {
  switch (zone) {
    case ZoneType.Residential: return config.occupancyTargetResidential;
    case ZoneType.Commercial: return config.occupancyTargetCommercial;
    case ZoneType.Industrial: return config.occupancyTargetIndustrial;
    case ZoneType.Institutional: return config.occupancyTargetInstitutional;
    case ZoneType.Government: return config.occupancyTargetGovernment;
    case ZoneType.Agricultural: return 0.31;
    case ZoneType.Forest: return 0;
    case ZoneType.Mixed: return (config.occupancyTargetResidential + config.occupancyTargetCommercial) * 0.5;
  }
}

function footprintFor(
  world: World,
  block: Block,
  frontage: FrontageCandidate,
  width: number,
  depth: number,
  config: BuildingConfig,
  relaxed = false,
): FootprintCandidate | undefined {
  const frontageTile = world.tiles[frontage.tileIndex];
  const roadTile = world.tiles[frontage.roadTileIndex];
  if (frontageTile === undefined || roadTile === undefined) return undefined;
  const blockSet = new Set(block.tileIndices);
  const inwardX = -frontage.roadDx;
  const inwardY = -frontage.roadDy;
  const lateralX = inwardY;
  const lateralY = -inwardX;
  const half = Math.floor(width / 2);
  const tileIndices: number[] = [];

  for (let d = 0; d < depth; d += 1) {
    for (let w = 0; w < width; w += 1) {
      const lateralOffset = w - half;
      const x = frontageTile.x + inwardX * d + lateralX * lateralOffset;
      const y = frontageTile.y + inwardY * d + lateralY * lateralOffset;
      if (!world.contains(x, y)) return undefined;
      const index = y * world.width + x;
      const tile = world.tiles[index];
      if (
        tile === undefined
        || !blockSet.has(index)
        || tile.water !== WaterType.Land
        || tile.road
        || tile.river
        || tile.buildingId !== null
        || tile.slope > config.maximumSlope * (relaxed ? 2.4 : 1)
        || tile.floodRisk > Math.min(1, config.maximumFloodRisk + (relaxed ? 0.3 : 0))
      ) return undefined;
      tileIndices.push(index);
    }
  }

  const xs = tileIndices.map((index) => world.tiles[index]?.x ?? 0);
  const ys = tileIndices.map((index) => world.tiles[index]?.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) + 1;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys) + 1;
  return {
    tileIndices,
    footprint: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    entrance: {
      x: frontageTile.x + 0.5 + frontage.roadDx * 0.48,
      y: frontageTile.y + 0.5 + frontage.roadDy * 0.48,
      roadTileIndex: frontage.roadTileIndex,
    },
    rotation: rotationFromRoadDirection(frontage.roadDx, frontage.roadDy),
  };
}


interface DirectedBoundaryEdge {
  readonly start: { x: number; y: number };
  readonly end: { x: number; y: number };
}

function pointKey(point: { x: number; y: number }): string {
  return `${point.x},${point.y}`;
}

function polygonArea(points: readonly { x: number; y: number }[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    area += current.x * next.y - next.x * current.y;
  }
  return area * 0.5;
}

function traceFootprintBoundary(world: World, tileIndices: readonly number[]): readonly { x: number; y: number }[] {
  const mask = new Set(tileIndices);
  const edges: DirectedBoundaryEdge[] = [];
  for (const index of tileIndices) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    const { x, y } = tile;
    const top = y === 0 ? -1 : index - world.width;
    const right = x + 1 >= world.width ? -1 : index + 1;
    const bottom = y + 1 >= world.height ? -1 : index + world.width;
    const left = x === 0 ? -1 : index - 1;
    if (top < 0 || !mask.has(top)) edges.push({ start: { x, y }, end: { x: x + 1, y } });
    if (right < 0 || !mask.has(right)) edges.push({ start: { x: x + 1, y }, end: { x: x + 1, y: y + 1 } });
    if (bottom < 0 || !mask.has(bottom)) edges.push({ start: { x: x + 1, y: y + 1 }, end: { x, y: y + 1 } });
    if (left < 0 || !mask.has(left)) edges.push({ start: { x, y: y + 1 }, end: { x, y } });
  }

  const outgoing = new Map<string, number[]>();
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    if (edge === undefined) continue;
    const entries = outgoing.get(pointKey(edge.start)) ?? [];
    entries.push(index);
    outgoing.set(pointKey(edge.start), entries);
  }
  const visited = new Uint8Array(edges.length);
  const loops: { x: number; y: number }[][] = [];
  for (let startIndex = 0; startIndex < edges.length; startIndex += 1) {
    if (visited[startIndex] === 1) continue;
    const start = edges[startIndex];
    if (start === undefined) continue;
    const loop = [start.start];
    let edgeIndex = startIndex;
    for (let guard = 0; guard <= edges.length; guard += 1) {
      const edge = edges[edgeIndex];
      if (edge === undefined || visited[edgeIndex] === 1) break;
      visited[edgeIndex] = 1;
      loop.push(edge.end);
      if (pointKey(edge.end) === pointKey(start.start)) break;
      const next = (outgoing.get(pointKey(edge.end)) ?? []).find((candidate) => visited[candidate] === 0);
      if (next === undefined) break;
      edgeIndex = next;
    }
    const last = loop.at(-1);
    if (loop.length >= 4 && last !== undefined && pointKey(last) === pointKey(loop[0] ?? last)) {
      loop.pop();
      loops.push(loop);
    }
  }
  return loops.sort((left, right) => Math.abs(polygonArea(right)) - Math.abs(polygonArea(left)))[0] ?? [];
}

function irregularAnchorFootprint(
  world: World,
  block: Block,
  frontage: FrontageCandidate,
  template: BuildingTemplate,
  config: BuildingConfig,
): FootprintCandidate | undefined {
  const blockSet = new Set(block.tileIndices);
  const targetArea = Math.max(8, template.minimumWidth * Math.max(config.minimumLotDepth, template.minimumDepth));
  const selected: number[] = [];
  const visited = new Set<number>();
  const queue = [frontage.tileIndex];
  visited.add(frontage.tileIndex);

  for (let offset = 0; offset < queue.length && selected.length < targetArea; offset += 1) {
    const index = queue[offset];
    if (index === undefined) continue;
    const tile = world.tiles[index];
    if (
      tile === undefined
      || !blockSet.has(index)
      || tile.water !== WaterType.Land
      || tile.road
      || tile.river
      || tile.buildingId !== null
      || tile.slope > config.maximumSlope * 2.8
      || tile.floodRisk > Math.min(1, config.maximumFloodRisk + 0.35)
    ) continue;
    selected.push(index);
    const neighbors: number[] = [];
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (!world.contains(nx, ny)) continue;
      const neighborIndex = ny * world.width + nx;
      if (!visited.has(neighborIndex) && blockSet.has(neighborIndex)) neighbors.push(neighborIndex);
    }
    neighbors.sort((left, right) => {
      const leftTile = world.tiles[left];
      const rightTile = world.tiles[right];
      if (leftTile === undefined || rightTile === undefined) return left - right;
      const leftInward = -(leftTile.x - (world.tiles[frontage.tileIndex]?.x ?? leftTile.x)) * frontage.roadDx
        - (leftTile.y - (world.tiles[frontage.tileIndex]?.y ?? leftTile.y)) * frontage.roadDy;
      const rightInward = -(rightTile.x - (world.tiles[frontage.tileIndex]?.x ?? rightTile.x)) * frontage.roadDx
        - (rightTile.y - (world.tiles[frontage.tileIndex]?.y ?? rightTile.y)) * frontage.roadDy;
      return rightInward - leftInward || left - right;
    });
    for (const neighbor of neighbors) {
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  if (selected.length < Math.min(4, targetArea)) return undefined;
  const boundary = traceFootprintBoundary(world, selected);
  if (boundary.length < 4) return undefined;
  const frontageTile = world.tiles[frontage.tileIndex];
  if (frontageTile === undefined) return undefined;
  return {
    tileIndices: selected,
    footprint: boundary,
    entrance: {
      x: frontageTile.x + 0.5 + frontage.roadDx * 0.48,
      y: frontageTile.y + 0.5 + frontage.roadDy * 0.48,
      roadTileIndex: frontage.roadTileIndex,
    },
    rotation: rotationFromRoadDirection(frontage.roadDx, frontage.roadDy),
  };
}

function conditionFor(block: Block, random: Random): BuildingCondition {
  const value = block.averageLandValue + random.float(-0.18, 0.18);
  if (value > 0.72) return BuildingCondition.New;
  if (value > 0.42) return BuildingCondition.Maintained;
  if (value > 0.22) return BuildingCondition.Weathered;
  return BuildingCondition.Dilapidated;
}

function createBuilding(
  world: World,
  block: Block,
  template: BuildingTemplate,
  candidate: FootprintCandidate,
  random: Random,
  anchor: Anchor | undefined,
): Building {
  const id = world.buildings.length;
  const stories = random.int(template.minimumStories, template.maximumStories);
  const building: Building = {
    id,
    generatedId: id,
    type: template.type,
    templateId: template.id,
    blockId: block.id,
    zoneId: block.zoneId,
    tileIndices: candidate.tileIndices,
    footprint: candidate.footprint,
    entrance: candidate.entrance,
    rotation: candidate.rotation,
    stories,
    condition: conditionFor(block, random),
    anchorId: anchor?.id ?? null,
  };
  for (const index of candidate.tileIndices) {
    const tile = world.tiles[index];
    if (tile !== undefined) tile.buildingId = id;
  }
  world.buildings.push(building);
  return building;
}

function tryPlaceTemplate(
  world: World,
  block: Block,
  template: BuildingTemplate,
  frontage: readonly FrontageCandidate[],
  config: BuildingConfig,
  random: Random,
  anchor?: Anchor,
): Building | undefined {
  const shuffled = random.shuffle(frontage);
  const minimumDepth = Math.max(config.minimumLotDepth, template.minimumDepth);
  for (const candidate of shuffled) {
    const widths = anchor === undefined
      ? [random.int(template.minimumWidth, template.maximumWidth), template.minimumWidth]
      : Array.from({ length: template.maximumWidth - template.minimumWidth + 1 }, (_, index) => template.minimumWidth + index);
    const depths = anchor === undefined
      ? [random.int(minimumDepth, template.maximumDepth), minimumDepth]
      : Array.from({ length: template.maximumDepth - minimumDepth + 1 }, (_, index) => minimumDepth + index);
    for (const width of [...new Set(widths)]) {
      for (const depth of [...new Set(depths)]) {
        const footprint = footprintFor(world, block, candidate, width, depth, config, anchor !== undefined);
        if (footprint !== undefined) return createBuilding(world, block, template, footprint, random, anchor);
      }
    }
  }
  if (anchor !== undefined) {
    for (const candidate of shuffled) {
      const footprint = irregularAnchorFootprint(world, block, candidate, template, config);
      if (footprint !== undefined) return createBuilding(world, block, template, footprint, random, anchor);
    }
  }
  return undefined;
}

function nearestEligibleBlocks(world: World, anchor: Anchor, template: BuildingTemplate, radius: number): readonly Block[] {
  const compare = (left: Block, right: Block): number => {
    const leftDistance = Math.hypot(left.centroid.x - anchor.x, left.centroid.y - anchor.y);
    const rightDistance = Math.hypot(right.centroid.x - anchor.x, right.centroid.y - anchor.y);
    const leftLocal = leftDistance <= radius ? 0 : 1;
    const rightLocal = rightDistance <= radius ? 0 : 1;
    return leftLocal - rightLocal || leftDistance - rightDistance || right.area - left.area || left.id - right.id;
  };
  const preferred = world.blocks
    .filter((block) => {
      const zone = blockZone(world, block);
      return zone !== undefined && template.allowedZones.includes(zone);
    })
    .sort(compare);
  const preferredIds = new Set(preferred.map((block) => block.id));
  const zoningExceptions = world.blocks.filter((block) => !preferredIds.has(block.id)).sort(compare);
  return [...preferred, ...zoningExceptions];
}

function placeAnchorBuildings(world: World, config: BuildingConfig, random: Random): void {
  for (const anchor of world.anchors) {
    const template = templateForAnchor(anchor.type);
    if (template === undefined) continue;
    const blocks = nearestEligibleBlocks(world, anchor, template, config.anchorSearchRadius);
    for (const block of blocks) {
      const frontage = collectFrontage(world, block);
      const building = tryPlaceTemplate(world, block, template, frontage, config, random.fork(`anchor-${anchor.id}`), anchor);
      if (building !== undefined) break;
    }
  }
}

function placeBlockBuildings(world: World, config: BuildingConfig, random: Random): void {
  for (const block of world.blocks) {
    const zone = blockZone(world, block);
    if (zone === undefined || zone === ZoneType.Forest) continue;
    const templates = templatesForZone(zone);
    if (templates.length === 0) continue;
    const frontage = collectFrontage(world, block);
    if (frontage.length === 0) continue;
    const targetTiles = Math.floor(block.area * occupancyTarget(zone, config));
    let occupiedTiles = block.tileIndices.reduce(
      (sum, index) => sum + (world.tiles[index]?.buildingId === null ? 0 : 1),
      0,
    );
    const blockRandom = random.fork(`block-${block.id}`);

    for (let attempt = 0; attempt < config.maximumBuildingsPerBlock; attempt += 1) {
      if (occupiedTiles >= targetTiles) break;
      const template = chooseWeightedTemplate(templates, blockRandom.fork(`template-${attempt}`));
      if (template === undefined) break;
      const building = tryPlaceTemplate(
        world,
        block,
        template,
        frontage,
        config,
        blockRandom.fork(`building-${attempt}`),
      );
      if (building !== undefined) occupiedTiles += building.tileIndices.length;
    }
  }
}

export function generateBuildings(world: World, config: BuildingConfig, random: Random): void {
  world.buildings = [];
  for (const tile of world.tiles) tile.buildingId = null;
  placeAnchorBuildings(world, config, random.fork('anchor-buildings'));
  placeBlockBuildings(world, config, random.fork('block-buildings'));
}
