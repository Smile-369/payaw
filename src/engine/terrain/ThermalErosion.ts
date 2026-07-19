import type { ThermalErosionConfig } from '../config/GenerationConfig';
import { clamp } from '../math/Scalar';
import type { World } from '../world/World';

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],             [1, 0],
  [-1, 1],  [0, 1],    [1, 1],
];

/**
 * Deterministic talus relaxation. Material is moved from cells steeper than
 * the angle-of-repose proxy into every downslope neighbor, preserving mass.
 */
export function applyThermalErosion(world: World, config: ThermalErosionConfig): void {
  const transfers = new Float64Array(world.tiles.length);

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    transfers.fill(0);

    for (let index = 0; index < world.tiles.length; index += 1) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      const candidates: { index: number; excess: number }[] = [];
      let totalExcess = 0;

      for (const [dx, dy] of DIRECTIONS) {
        const nx = tile.x + dx;
        const ny = tile.y + dy;
        if (!world.contains(nx, ny)) continue;
        const neighborIndex = ny * world.width + nx;
        const neighbor = world.tiles[neighborIndex];
        if (neighbor === undefined) continue;
        const distance = dx === 0 || dy === 0 ? 1 : Math.SQRT2;
        const difference = (tile.elevation - neighbor.elevation) / distance;
        const excess = difference - config.talusThreshold;
        if (excess <= 0) continue;
        candidates.push({ index: neighborIndex, excess });
        totalExcess += excess;
      }

      if (candidates.length === 0 || totalExcess <= 0) continue;
      const movable = Math.min(
        config.maximumTransfer,
        totalExcess * config.transferCoefficient / candidates.length,
      );
      transfers[index] = (transfers[index] ?? 0) - movable;
      for (const candidate of candidates) {
        const share = movable * (candidate.excess / totalExcess);
        transfers[candidate.index] = (transfers[candidate.index] ?? 0) + share;
      }
    }

    for (let index = 0; index < world.tiles.length; index += 1) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      tile.elevation = clamp(tile.elevation + (transfers[index] ?? 0), 0, 1);
      tile.bedElevation = tile.elevation;
    }
  }
}
