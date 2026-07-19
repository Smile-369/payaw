import type { HydrologyConfig, TerrainConfig } from '../config/GenerationConfig';
import { MinPriorityQueue } from '../math/MinPriorityQueue';
import { clamp, clamp01 } from '../math/Scalar';
import type { Random } from '../rng/Random';
import { RiverCourse, WaterType } from '../world/Tile';
import type { World } from '../world/World';
import { RiverTerminus, type River, type RiverSample } from './River';

const NEIGHBOR_DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],             [1, 0],
  [-1, 1],  [0, 1],    [1, 1],
];

const CARDINAL_DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
];

interface DrainageField {
  readonly filledElevation: Float64Array;
  readonly flowTo: Int32Array;
  readonly accumulation: Float64Array;
}

interface SourceCandidate {
  readonly index: number;
  readonly score: number;
}

interface ChannelGeometry {
  readonly width: number;
  readonly depth: number;
}

function isBoundaryTile(world: World, index: number): boolean {
  const tile = world.tiles[index];
  return tile !== undefined
    && (tile.x === 0 || tile.y === 0 || tile.x === world.width - 1 || tile.y === world.height - 1);
}

/** Returns one existing ocean path from the river mouth to the map boundary. */
function findProtectedOceanOutlet(world: World, startIndex: number): ReadonlySet<number> {
  const start = world.tiles[startIndex];
  if (start?.water !== WaterType.Ocean) return new Set<number>();
  const previous = new Int32Array(world.tiles.length);
  previous.fill(-2);
  previous[startIndex] = -1;
  const queue: number[] = [startIndex];
  let target = -1;

  for (let offset = 0; offset < queue.length; offset += 1) {
    const currentIndex = queue[offset];
    if (currentIndex === undefined) continue;
    if (isBoundaryTile(world, currentIndex)) {
      target = currentIndex;
      break;
    }
    const current = world.tiles[currentIndex];
    if (current === undefined) continue;
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!world.contains(nx, ny)) continue;
      const neighborIndex = ny * world.width + nx;
      if ((previous[neighborIndex] ?? -2) !== -2) continue;
      const neighbor = world.tiles[neighborIndex];
      if (neighbor?.water !== WaterType.Ocean) continue;
      previous[neighborIndex] = currentIndex;
      queue.push(neighborIndex);
    }
  }

  if (target < 0) return new Set<number>([startIndex]);
  const path = new Set<number>();
  let current = target;
  while (current >= 0) {
    path.add(current);
    current = previous[current] ?? -1;
  }
  return path;
}

function buildDrainageField(world: World, config: HydrologyConfig): DrainageField {
  const filledElevation = new Float64Array(world.tiles.length);
  filledElevation.fill(Number.POSITIVE_INFINITY);
  const flowTo = new Int32Array(world.tiles.length);
  flowTo.fill(-1);
  const visited = new Uint8Array(world.tiles.length);
  const frontier = new MinPriorityQueue();
  let outletCount = 0;

  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (tile?.water !== WaterType.Ocean) continue;
    outletCount += 1;
    visited[index] = 1;
    filledElevation[index] = tile.elevation;
    frontier.push({ index, priority: tile.elevation });
  }

  if (outletCount === 0) throw new Error('Hydrology requires ocean-connected outlet tiles.');

  while (frontier.size > 0) {
    const current = frontier.pop();
    if (current === undefined) break;
    const currentX = current.index % world.width;
    const currentY = Math.floor(current.index / world.width);

    for (const [dx, dy] of NEIGHBOR_DIRECTIONS) {
      const nx = currentX + dx;
      const ny = currentY + dy;
      if (!world.contains(nx, ny)) continue;
      const neighborIndex = ny * world.width + nx;
      if (visited[neighborIndex] === 1) continue;
      const neighbor = world.tiles[neighborIndex];
      if (neighbor === undefined) throw new Error('Drainage encountered an invalid tile.');
      visited[neighborIndex] = 1;
      const distance = dx === 0 || dy === 0 ? 1 : Math.SQRT2;
      const filled = Math.max(neighbor.elevation, current.priority + config.flowEpsilon * distance);
      filledElevation[neighborIndex] = filled;
      flowTo[neighborIndex] = current.index;
      frontier.push({ index: neighborIndex, priority: filled });
    }
  }

  const accumulation = new Float64Array(world.tiles.length);
  const orderedIndices: number[] = [];
  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (tile === undefined) throw new Error('Runoff initialization encountered an invalid tile.');
    if (tile.water === WaterType.Ocean) continue;
    const elevationRain = Math.max(0, tile.elevation - 0.52) * 0.7;
    accumulation[index] = config.baseRunoff + tile.moisture * config.moistureRunoff + elevationRain;
    orderedIndices.push(index);
  }

  orderedIndices.sort((left, right) => {
    const difference = (filledElevation[right] ?? 0) - (filledElevation[left] ?? 0);
    return difference === 0 ? right - left : difference;
  });
  for (const index of orderedIndices) {
    const downstream = flowTo[index];
    if (downstream === undefined || downstream < 0) continue;
    accumulation[downstream] = (accumulation[downstream] ?? 0) + (accumulation[index] ?? 0);
  }

  return { filledElevation, flowTo, accumulation };
}

function commitDrainageField(world: World, field: DrainageField): void {
  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    const flowTo = field.flowTo[index];
    const accumulation = field.accumulation[index];
    if (tile === undefined || flowTo === undefined || accumulation === undefined) {
      throw new Error('Drainage field could not be committed.');
    }
    tile.flowTo = flowTo;
    tile.flowAccumulation = accumulation;
    tile.discharge = accumulation;
    tile.river = false;
    tile.riverId = null;
    tile.riverCourse = RiverCourse.None;
    tile.riverWidth = 0;
    tile.riverDepth = 0;
    tile.floodRisk = 0;
    tile.delta = false;
  }
}

function traceFlow(world: World, sourceIndex: number): readonly number[] {
  const path: number[] = [];
  const visited = new Set<number>();
  let currentIndex = sourceIndex;
  for (let step = 0; step < world.tiles.length; step += 1) {
    if (visited.has(currentIndex)) break;
    visited.add(currentIndex);
    const tile = world.tiles[currentIndex];
    if (tile === undefined) break;
    path.push(currentIndex);
    if (tile.water === WaterType.Ocean || tile.flowTo < 0) break;
    currentIndex = tile.flowTo;
  }
  return path;
}

function createSourceCandidates(world: World, config: HydrologyConfig, random: Random): readonly SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  let maximumCoastDistance = 1;
  for (const tile of world.tiles) maximumCoastDistance = Math.max(maximumCoastDistance, tile.coastDistance);
  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (
      tile === undefined
      || tile.water !== WaterType.Land
      || tile.elevation < config.sourceMinElevation
      || tile.moisture < config.sourceMinMoisture
      || tile.coastDistance < config.sourceMinCoastDistance
      || tile.flowTo < 0
    ) continue;
    const score = tile.elevation * 0.43
      + tile.moisture * 0.23
      + tile.coastDistance / maximumCoastDistance * 0.18
      + clamp01(tile.slope * 1.8) * 0.1
      + random.next() * 0.06;
    candidates.push({ index, score });
  }
  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  return candidates;
}

function isFarEnoughFromSources(
  world: World,
  candidateIndex: number,
  selectedSources: readonly number[],
  minimumDistance: number,
): boolean {
  const candidate = world.tiles[candidateIndex];
  if (candidate === undefined) return false;
  const threshold = minimumDistance * minimumDistance;
  return selectedSources.every((sourceIndex) => {
    const source = world.tiles[sourceIndex];
    if (source === undefined) return true;
    const dx = candidate.x - source.x;
    const dy = candidate.y - source.y;
    return dx * dx + dy * dy >= threshold;
  });
}

function channelGeometry(discharge: number, config: HydrologyConfig): ChannelGeometry {
  const normalized = Math.max(0.05, discharge / config.dischargeNormalization);
  return {
    width: clamp(
      config.widthCoefficient * Math.pow(normalized, config.widthExponent),
      config.minimumRiverWidth,
      config.maximumRiverWidth,
    ),
    depth: clamp(
      config.depthCoefficient * Math.pow(normalized, config.depthExponent),
      config.minimumRiverDepth,
      config.maximumRiverDepth,
    ),
  };
}

function classifyCourse(world: World, path: readonly number[], offset: number): RiverCourse {
  const tile = world.tiles[path[offset] ?? -1];
  const progress = offset / Math.max(1, path.length - 1);
  if (tile?.water === WaterType.Ocean || tile?.coastDistance !== undefined && tile.coastDistance <= 3) {
    return RiverCourse.Delta;
  }
  if (progress < 0.3 && (tile?.slope ?? 0) > 0.055) return RiverCourse.Upper;
  if (progress < 0.74) return RiverCourse.Middle;
  return RiverCourse.Lower;
}

function createCenterline(
  world: World,
  path: readonly number[],
  field: DrainageField,
  config: HydrologyConfig,
  random: Random,
): readonly RiverSample[] {
  const phase = random.float(0, Math.PI * 2);
  const samples: RiverSample[] = [];

  for (let offset = 0; offset < path.length; offset += 1) {
    const index = path[offset];
    if (index === undefined) continue;
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    const previous = world.tiles[path[Math.max(0, offset - 1)] ?? index] ?? tile;
    const next = world.tiles[path[Math.min(path.length - 1, offset + 1)] ?? index] ?? tile;
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const tangentLength = Math.max(0.0001, Math.hypot(tangentX, tangentY));
    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;
    const course = classifyCourse(world, path, offset);
    const geometry = channelGeometry(field.accumulation[index] ?? 0, config);
    const courseFactor = course === RiverCourse.Upper
      ? 0.18
      : course === RiverCourse.Middle
        ? 1
        : course === RiverCourse.Lower
          ? 0.64
          : 0.2;
    const wave = Math.sin(offset * config.meanderNoiseScale + phase)
      + Math.sin(offset * config.meanderNoiseScale * 0.41 + phase * 1.7) * 0.42;
    const jitter = random.float(-0.18, 0.18);
    const offsetAmount = clamp(
      (wave + jitter) * config.meanderStrength * courseFactor,
      -Math.max(0.25, geometry.width * 0.34),
      Math.max(0.25, geometry.width * 0.34),
    );
    samples.push({
      tileIndex: index,
      x: tile.x + 0.5 + normalX * offsetAmount,
      y: tile.y + 0.5 + normalY * offsetAmount,
      discharge: field.accumulation[index] ?? 0,
      width: geometry.width,
      depth: geometry.depth,
      course,
    });
  }

  return samples;
}

function carveChannel(world: World, riverId: number, centerline: readonly RiverSample[], config: HydrologyConfig): void {
  for (let offset = 0; offset < centerline.length; offset += 1) {
    const sample = centerline[offset];
    if (sample === undefined) continue;
    const previous = centerline[Math.max(0, offset - 1)] ?? sample;
    const next = centerline[Math.min(centerline.length - 1, offset + 1)] ?? sample;
    const ax = sample.x - previous.x;
    const ay = sample.y - previous.y;
    const bx = next.x - sample.x;
    const by = next.y - sample.y;
    const cross = ax * by - ay * bx;
    const curvature = clamp(cross, -1, 1);
    const lateralExpansion = sample.course === RiverCourse.Middle
      ? 1 + Math.abs(curvature) * config.lateralErosionStrength
      : 1;
    const radius = Math.max(0.52, sample.width * 0.5 * lateralExpansion);
    const minX = Math.floor(sample.x - radius - 1);
    const maxX = Math.ceil(sample.x + radius + 1);
    const minY = Math.floor(sample.y - radius - 1);
    const maxY = Math.ceil(sample.y + radius + 1);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const tile = world.getTile(x, y);
        if (tile === undefined || tile.water === WaterType.Ocean) continue;
        const distance = Math.hypot(x + 0.5 - sample.x, y + 0.5 - sample.y);
        if (distance > radius) continue;
        const profile = 1 - distance / Math.max(0.0001, radius);
        const carveDepth = sample.depth * profile * config.channelCarvingStrength;
        tile.elevation = clamp(tile.elevation - carveDepth, 0, 1);
        tile.bedElevation = tile.elevation;
        tile.erosion += carveDepth;
        tile.river = true;
        if (tile.riverId === null) tile.riverId = riverId;
        tile.riverWidth = Math.max(tile.riverWidth, sample.width * profile);
        tile.riverDepth = Math.max(tile.riverDepth, sample.depth * profile);
        tile.discharge = Math.max(tile.discharge, sample.discharge);
        if (sample.course !== RiverCourse.Delta || tile.riverCourse === RiverCourse.None) {
          tile.riverCourse = sample.course;
        }
      }
    }
  }
}

function findLastLandOffset(world: World, path: readonly number[]): number {
  for (let offset = path.length - 1; offset >= 0; offset -= 1) {
    const index = path[offset];
    if (index !== undefined && world.tiles[index]?.water === WaterType.Land) return offset;
  }
  return Math.max(0, path.length - 1);
}

function generateDistributary(
  world: World,
  startIndex: number,
  length: number,
  random: Random,
): readonly number[] {
  const path: number[] = [startIndex];
  const visited = new Set<number>(path);
  let currentIndex = startIndex;
  for (let step = 0; step < length; step += 1) {
    const current = world.tiles[currentIndex];
    if (current === undefined) break;
    const candidates: { index: number; score: number }[] = [];
    for (const [dx, dy] of NEIGHBOR_DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!world.contains(nx, ny)) continue;
      const index = ny * world.width + nx;
      if (visited.has(index)) continue;
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      const southward = dy > 0 ? -0.025 : 0;
      const waterBias = tile.water === WaterType.Ocean ? -0.08 : 0.05;
      candidates.push({ index, score: tile.elevation + waterBias + southward + random.float(-0.02, 0.02) });
    }
    candidates.sort((left, right) => left.score - right.score || left.index - right.index);
    const selected = candidates[0];
    if (selected === undefined) break;
    currentIndex = selected.index;
    path.push(currentIndex);
    visited.add(currentIndex);
    const tile = world.tiles[currentIndex];
    if (tile?.water === WaterType.Ocean && step >= 4 && tile.waterDepth > 0.055) break;
  }
  return path;
}

function formDelta(
  world: World,
  path: readonly number[],
  maximumDischarge: number,
  config: HydrologyConfig,
  terrain: TerrainConfig,
  random: Random,
  protectedOceanOutlets: Set<number>,
): { deltaTileIndices: readonly number[]; distributaries: readonly (readonly number[])[] } {
  if (maximumDischarge < config.deltaMinimumDischarge || path.length === 0) {
    return { deltaTileIndices: [], distributaries: [] };
  }
  const lastLandOffset = findLastLandOffset(world, path);
  const terminalIndex = path[path.length - 1];
  const mouthIndex = path[lastLandOffset];
  if (mouthIndex === undefined) return { deltaTileIndices: [], distributaries: [] };
  const mouth = world.tiles[mouthIndex];
  if (mouth === undefined || mouth.coastDistance > 5 || terminalIndex === undefined) return { deltaTileIndices: [], distributaries: [] };
  const protectedOcean = findProtectedOceanOutlet(world, terminalIndex);
  for (const index of protectedOcean) {
    protectedOceanOutlets.add(index);
    const outletTile = world.tiles[index];
    if (outletTile !== undefined) outletTile.elevation = Math.min(outletTile.elevation, terrain.seaLevel - 0.001);
  }

  const delta = new Set<number>();
  const sedimentLoad = maximumDischarge * config.deltaVelocityDamping * config.deltaDepositionRate;
  const radius = config.deltaSearchRadius;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const tile = world.getTile(mouth.x + dx, mouth.y + dy);
      if (tile === undefined) continue;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const index = tile.y * world.width + tile.x;
      const shallowFactor = tile.water === WaterType.Ocean
        ? clamp01(1 - tile.waterDepth / Math.max(0.001, terrain.deepWaterDepth * 1.2))
        : 0.42;
      const deposit = sedimentLoad * 0.00008 * shallowFactor * (1 - distance / (radius + 0.5));
      if (deposit <= 0.00001) continue;
      const depositedElevation = tile.elevation + deposit;
      tile.elevation = tile.water === WaterType.Ocean && protectedOceanOutlets.has(index)
        ? Math.min(terrain.seaLevel - 0.001, depositedElevation)
        : clamp(depositedElevation, 0, 1);
      tile.bedElevation = tile.elevation;
      tile.deposition += deposit;
      tile.sediment += deposit;
      tile.delta = true;
      tile.riverCourse = RiverCourse.Delta;
      delta.add(index);
    }
  }

  const distributaries: readonly number[][] = Array.from(
    { length: config.deltaDistributaryCount },
    (_, index) => [...generateDistributary(
      world,
      mouthIndex,
      config.deltaDistributaryLength,
      random.fork(`distributary-${index}`),
    )],
  );
  for (const distributary of distributaries) {
    for (const index of distributary) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      tile.delta = true;
      tile.river = true;
      tile.riverCourse = RiverCourse.Delta;
      tile.riverWidth = Math.max(tile.riverWidth, config.minimumRiverWidth * 0.72);
      delta.add(index);
    }
  }

  return { deltaTileIndices: [...delta].sort((a, b) => a - b), distributaries };
}

function placeRivers(
  world: World,
  field: DrainageField,
  config: HydrologyConfig,
  terrain: TerrainConfig,
  random: Random,
): River[] {
  const rivers: River[] = [];
  const selectedSources: number[] = [];
  const candidates = createSourceCandidates(world, config, random.fork('source-candidates'));
  const protectedOceanOutlets = new Set<number>();

  for (const candidate of candidates) {
    if (rivers.length >= config.riverSourceCount) break;
    if (!isFarEnoughFromSources(world, candidate.index, selectedSources, config.sourceSpacing)) continue;
    const fullPath = traceFlow(world, candidate.index);
    let confluenceOffset = -1;
    let tributaryOf: number | null = null;
    for (let offset = 1; offset < fullPath.length; offset += 1) {
      const pathIndex = fullPath[offset];
      const riverId = pathIndex === undefined ? null : world.tiles[pathIndex]?.riverId;
      if (riverId !== null && riverId !== undefined) {
        confluenceOffset = offset;
        tributaryOf = riverId;
        break;
      }
    }
    const path = confluenceOffset >= 0 ? fullPath.slice(0, confluenceOffset + 1) : [...fullPath];
    const finalIndex = path[path.length - 1];
    const finalTile = finalIndex === undefined ? undefined : world.tiles[finalIndex];
    const reachesOcean = finalTile?.water === WaterType.Ocean;
    if (path.length < config.minimumRiverLength || (!reachesOcean && tributaryOf === null)) continue;

    const id = rivers.length;
    const centerline = createCenterline(world, path, field, config, random.fork(`river-${id}-meander`));
    carveChannel(world, id, centerline, config);
    const maximumDischarge = Math.max(...centerline.map((sample) => sample.discharge));
    const maximumWidth = Math.max(...centerline.map((sample) => sample.width));
    const maximumDepth = Math.max(...centerline.map((sample) => sample.depth));
    const deltaResult = tributaryOf === null
      ? formDelta(world, path, maximumDischarge, config, terrain, random.fork(`river-${id}-delta`), protectedOceanOutlets)
      : { deltaTileIndices: [], distributaries: [] };

    rivers.push({
      id,
      sourceIndex: candidate.index,
      mouthIndex: finalIndex ?? candidate.index,
      path,
      centerline,
      distributaries: deltaResult.distributaries,
      deltaTileIndices: deltaResult.deltaTileIndices,
      length: path.length,
      maximumDischarge,
      maximumWidth,
      maximumDepth,
      terminus: tributaryOf === null ? RiverTerminus.Ocean : RiverTerminus.Confluence,
      tributaryOf,
    });
    selectedSources.push(candidate.index);
  }

  return rivers;
}

function generateFloodplains(world: World, config: HydrologyConfig): void {
  for (const riverTile of world.tiles) {
    if (!riverTile.river || riverTile.water === WaterType.Ocean) continue;
    const widthFactor = clamp01(riverTile.riverWidth / config.maximumRiverWidth);
    const courseFactor = riverTile.riverCourse === RiverCourse.Upper
      ? 0.35
      : riverTile.riverCourse === RiverCourse.Middle
        ? 1
        : riverTile.riverCourse === RiverCourse.Lower
          ? 1.25
          : 0.8;
    const radius = Math.max(1, Math.ceil((1 + widthFactor * (config.floodplainMaximumRadius - 1)) * courseFactor));
    riverTile.floodRisk = Math.max(riverTile.floodRisk, 0.52 + widthFactor * 0.48);

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const tile = world.getTile(riverTile.x + dx, riverTile.y + dy);
        if (tile === undefined || tile.water !== WaterType.Land || tile.river) continue;
        const elevationDifference = Math.abs(tile.elevation - riverTile.elevation);
        const tolerance = config.floodplainElevationTolerance * (1 + widthFactor * 0.8);
        if (elevationDifference > tolerance || tile.slope > config.floodplainSlopeLimit) continue;
        const risk = clamp01(
          (1 - distance / (radius + 0.5))
          * (1 - tile.slope / config.floodplainSlopeLimit)
          * (1 - elevationDifference / Math.max(0.0001, tolerance))
          * (0.45 + widthFactor * 0.55),
        );
        tile.floodRisk = Math.max(tile.floodRisk, risk);
      }
    }
  }
}

export function generateHydrology(
  world: World,
  config: HydrologyConfig,
  terrain: TerrainConfig,
  random: Random,
): void {
  const drainage = buildDrainageField(world, config);
  commitDrainageField(world, drainage);
  world.rivers = placeRivers(world, drainage, config, terrain, random);
  generateFloodplains(world, config);
}
