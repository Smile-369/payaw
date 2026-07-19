import type { TerrainConfig } from '../config/GenerationConfig';
import { WaterType } from '../world/Tile';
import type { World } from '../world/World';

const CARDINAL_DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const NEIGHBOR_DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],             [1, 0],
  [-1, 1],  [0, 1],    [1, 1],
];

function isBoundary(x: number, y: number, width: number, height: number): boolean {
  return x === 0 || y === 0 || x === width - 1 || y === height - 1;
}

export function smoothCoastline(world: World, config: TerrainConfig): void {
  const working = new Float32Array(world.tiles.length);

  for (let pass = 0; pass < config.coastlineSmoothingPasses; pass += 1) {
    for (let index = 0; index < world.tiles.length; index += 1) {
      const tile = world.tiles[index];
      if (tile === undefined) {
        throw new Error('Coastline smoothing encountered an invalid tile index.');
      }

      const nearSea = Math.abs(tile.elevation - config.seaLevel) <= 0.055;
      if (!nearSea || isBoundary(tile.x, tile.y, world.width, world.height)) {
        working[index] = tile.elevation;
        continue;
      }

      let landNeighbors = 0;
      for (const [offsetX, offsetY] of NEIGHBOR_DIRECTIONS) {
        const neighbor = world.getTile(tile.x + offsetX, tile.y + offsetY);
        if (neighbor !== undefined && neighbor.elevation >= config.seaLevel) {
          landNeighbors += 1;
        }
      }

      let adjustment = 0;
      if (tile.elevation >= config.seaLevel && landNeighbors <= 2) {
        adjustment = -config.coastlineSmoothingStrength;
      } else if (tile.elevation < config.seaLevel && landNeighbors >= 6) {
        adjustment = config.coastlineSmoothingStrength;
      }

      working[index] = Math.min(1, Math.max(0, tile.elevation + adjustment));
    }

    for (let index = 0; index < world.tiles.length; index += 1) {
      const tile = world.tiles[index];
      const elevation = working[index];
      if (tile === undefined || elevation === undefined) {
        throw new Error('Coastline smoothing failed to commit its result.');
      }
      tile.elevation = elevation;
    }
  }
}

function enqueueBoundaryOcean(world: World, seaLevel: number, oceanMask: Uint8Array, queue: Int32Array): number {
  let queueLength = 0;

  for (const tile of world.tiles) {
    if (!isBoundary(tile.x, tile.y, world.width, world.height) || tile.elevation >= seaLevel) {
      continue;
    }

    const index = tile.y * world.width + tile.x;
    if (oceanMask[index] === 1) {
      continue;
    }

    oceanMask[index] = 1;
    queue[queueLength] = index;
    queueLength += 1;
  }

  return queueLength;
}

function identifyOcean(world: World, seaLevel: number): Uint8Array {
  const oceanMask = new Uint8Array(world.tiles.length);
  const queue = new Int32Array(world.tiles.length);
  let queueLength = enqueueBoundaryOcean(world, seaLevel, oceanMask, queue);
  let queuePosition = 0;

  while (queuePosition < queueLength) {
    const index = queue[queuePosition];
    queuePosition += 1;
    if (index === undefined) {
      throw new Error('Ocean flood fill encountered an invalid queue entry.');
    }

    const x = index % world.width;
    const y = Math.floor(index / world.width);

    for (const [offsetX, offsetY] of CARDINAL_DIRECTIONS) {
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      if (!world.contains(neighborX, neighborY)) {
        continue;
      }

      const neighborIndex = neighborY * world.width + neighborX;
      const neighbor = world.tiles[neighborIndex];
      if (
        neighbor === undefined
        || oceanMask[neighborIndex] === 1
        || neighbor.elevation >= seaLevel
      ) {
        continue;
      }

      oceanMask[neighborIndex] = 1;
      queue[queueLength] = neighborIndex;
      queueLength += 1;
    }
  }

  return oceanMask;
}

function calculateOceanDistance(world: World, oceanMask: Uint8Array): Int32Array {
  const distance = new Int32Array(world.tiles.length);
  distance.fill(-1);
  const queue = new Int32Array(world.tiles.length);
  let queueLength = 0;
  let queuePosition = 0;

  for (let index = 0; index < oceanMask.length; index += 1) {
    if (oceanMask[index] !== 1) {
      continue;
    }

    distance[index] = 0;
    queue[queueLength] = index;
    queueLength += 1;
  }

  while (queuePosition < queueLength) {
    const index = queue[queuePosition];
    queuePosition += 1;
    if (index === undefined) {
      throw new Error('Coast distance calculation encountered an invalid queue entry.');
    }

    const x = index % world.width;
    const y = Math.floor(index / world.width);
    const nextDistance = (distance[index] ?? 0) + 1;

    for (const [offsetX, offsetY] of CARDINAL_DIRECTIONS) {
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      if (!world.contains(neighborX, neighborY)) {
        continue;
      }

      const neighborIndex = neighborY * world.width + neighborX;
      if (distance[neighborIndex] !== -1) {
        continue;
      }

      distance[neighborIndex] = nextDistance;
      queue[queueLength] = neighborIndex;
      queueLength += 1;
    }
  }

  return distance;
}

export function analyzeCoastline(world: World, config: TerrainConfig): void {
  const oceanMask = identifyOcean(world, config.seaLevel);
  const oceanDistance = calculateOceanDistance(world, oceanMask);

  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (tile === undefined) {
      throw new Error('Coastline analysis encountered an invalid tile index.');
    }

    const submerged = tile.elevation < config.seaLevel;
    tile.water = submerged
      ? (oceanMask[index] === 1 ? WaterType.Ocean : WaterType.Lake)
      : WaterType.Land;
    tile.waterDepth = submerged ? Math.max(0, config.seaLevel - tile.elevation) : 0;
    tile.coastDistance = oceanDistance[index] ?? 0;
    tile.coast = false;
  }

  for (const tile of world.tiles) {
    if (tile.water !== WaterType.Land) {
      continue;
    }

    for (const [offsetX, offsetY] of NEIGHBOR_DIRECTIONS) {
      const neighbor = world.getTile(tile.x + offsetX, tile.y + offsetY);
      if (neighbor?.water === WaterType.Ocean) {
        tile.coast = true;
        break;
      }
    }
  }
}
