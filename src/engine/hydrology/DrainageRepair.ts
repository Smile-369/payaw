import { WaterType } from '../world/Tile';
import type { World } from '../world/World';

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],             [1, 0],
  [-1, 1],  [0, 1],    [1, 1],
];

/**
 * Delta deposition can lift former ocean cells above sea level. Build an
 * ocean-distance field only across those new cells, then point each cell to
 * a strictly smaller distance so the repaired drainage remains acyclic.
 */
export function repairDeltaDrainage(world: World): void {
  const unresolved = new Set<number>();
  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (tile !== undefined && tile.water !== WaterType.Ocean && tile.flowTo < 0) unresolved.add(index);
  }
  if (unresolved.size === 0) return;

  const distance = new Int32Array(world.tiles.length);
  distance.fill(-1);
  const queue: number[] = [];
  for (const index of unresolved) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    for (const [dx, dy] of DIRECTIONS) {
      if (world.getTile(tile.x + dx, tile.y + dy)?.water !== WaterType.Ocean) continue;
      distance[index] = 1;
      queue.push(index);
      break;
    }
  }

  for (let offset = 0; offset < queue.length; offset += 1) {
    const index = queue[offset];
    if (index === undefined) continue;
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    const nextDistance = (distance[index] ?? 0) + 1;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (!world.contains(nx, ny)) continue;
      const neighborIndex = ny * world.width + nx;
      if (!unresolved.has(neighborIndex) || (distance[neighborIndex] ?? -1) >= 0) continue;
      distance[neighborIndex] = nextDistance;
      queue.push(neighborIndex);
    }
  }

  for (const index of unresolved) {
    const tile = world.tiles[index];
    const ownDistance = distance[index] ?? -1;
    if (tile === undefined || ownDistance < 1) throw new Error(`Delta tile ${index} cannot reach ocean water.`);
    const candidates: { index: number; distance: number; elevation: number }[] = [];
    for (const [dx, dy] of DIRECTIONS) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (!world.contains(nx, ny)) continue;
      const neighborIndex = ny * world.width + nx;
      const neighbor = world.tiles[neighborIndex];
      if (neighbor === undefined) continue;
      if (neighbor.water === WaterType.Ocean) {
        candidates.push({ index: neighborIndex, distance: 0, elevation: neighbor.elevation });
      } else {
        const neighborDistance = distance[neighborIndex] ?? -1;
        if (neighborDistance >= 0 && neighborDistance < ownDistance) {
          candidates.push({ index: neighborIndex, distance: neighborDistance, elevation: neighbor.elevation });
        }
      }
    }
    candidates.sort((left, right) => left.distance - right.distance
      || left.elevation - right.elevation
      || left.index - right.index);
    const target = candidates[0];
    if (target === undefined) throw new Error(`Delta tile ${index} has no oceanward neighbor.`);
    tile.flowTo = target.index;
    tile.flowAccumulation = Math.max(tile.flowAccumulation, 0.1);
    tile.discharge = Math.max(tile.discharge, tile.flowAccumulation);
  }
}
