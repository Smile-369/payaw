import type { HydraulicErosionConfig } from '../config/GenerationConfig';
import { clamp } from '../math/Scalar';
import { WaterType } from '../world/Tile';
import type { World } from '../world/World';

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],             [1, 0],
  [-1, 1],  [0, 1],    [1, 1],
];

interface DownhillTarget {
  readonly index: number;
  readonly difference: number;
  readonly distance: number;
}

function findDownhillTarget(
  world: World,
  index: number,
  water: Float64Array,
): DownhillTarget | undefined {
  const tile = world.tiles[index];
  if (tile === undefined) return undefined;
  const surface = tile.elevation + (water[index] ?? 0);
  let best: DownhillTarget | undefined;

  for (const [dx, dy] of DIRECTIONS) {
    const nx = tile.x + dx;
    const ny = tile.y + dy;
    if (!world.contains(nx, ny)) continue;
    const neighborIndex = ny * world.width + nx;
    const neighbor = world.tiles[neighborIndex];
    if (neighbor === undefined) continue;
    const neighborSurface = neighbor.elevation + (water[neighborIndex] ?? 0);
    const distance = dx === 0 || dy === 0 ? 1 : Math.SQRT2;
    const difference = (surface - neighborSurface) / distance;
    if (difference <= 0) continue;
    if (best === undefined || difference > best.difference) {
      best = { index: neighborIndex, difference, distance };
    }
  }

  return best;
}

/**
 * Grid hydraulic erosion pass. Rainfall becomes surface water, accelerates
 * downslope, carries sediment up to a velocity/slope-dependent capacity,
 * erodes when undersaturated, deposits when oversaturated, and loses water
 * through infiltration and evaporation. The pass mutates the terrain before
 * the river network is extracted.
 */
export function applyHydraulicErosion(world: World, config: HydraulicErosionConfig): void {
  const count = world.tiles.length;
  const water = new Float64Array(count);
  const sediment = new Float64Array(count);
  const waterDelta = new Float64Array(count);
  const sedimentDelta = new Float64Array(count);

  for (const tile of world.tiles) {
    tile.erosion = 0;
    tile.deposition = 0;
    tile.sediment = 0;
    tile.bedElevation = tile.elevation;
  }

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    waterDelta.fill(0);
    sedimentDelta.fill(0);

    for (let index = 0; index < count; index += 1) {
      const tile = world.tiles[index];
      if (tile === undefined || tile.water === WaterType.Ocean) continue;
      const mountainFactor = Math.max(0, tile.elevation - 0.58) / 0.42;
      water[index] = (water[index] ?? 0)
        + config.rainfallAmount * (0.45 + tile.moisture * 0.75)
        + config.mountainRainfallBoost * mountainFactor;
    }

    for (let index = 0; index < count; index += 1) {
      const tile = world.tiles[index];
      const currentWater = water[index] ?? 0;
      if (tile === undefined || tile.water === WaterType.Ocean || currentWater <= 0.000001) continue;
      const target = findDownhillTarget(world, index, water);
      if (target === undefined) {
        const deposit = Math.min(sediment[index] ?? 0, config.depositionRate * currentWater);
        sediment[index] = (sediment[index] ?? 0) - deposit;
        tile.elevation = clamp(tile.elevation + deposit, 0, 1);
        tile.deposition += deposit;
        continue;
      }

      const slope = Math.max(config.minimumSlope, target.difference / target.distance);
      const flow = Math.min(currentWater * 0.72, target.difference * config.flowRate);
      const velocity = flow * (1 + slope * 8);
      const capacity = velocity * slope * currentWater * config.sedimentCapacity;
      const carried = sediment[index] ?? 0;

      if (carried < capacity) {
        const erosion = Math.min(
          config.maximumErosionPerIteration,
          (capacity - carried) * config.erosionRate,
          Math.max(0, tile.elevation - 0.002),
        );
        tile.elevation = clamp(tile.elevation - erosion, 0, 1);
        tile.erosion += erosion;
        sediment[index] = carried + erosion;
      } else {
        const deposit = Math.min(carried, (carried - capacity) * config.depositionRate);
        tile.elevation = clamp(tile.elevation + deposit, 0, 1);
        tile.deposition += deposit;
        sediment[index] = carried - deposit;
      }

      const sedimentConcentration = (sediment[index] ?? 0) / Math.max(0.000001, currentWater);
      const movedSediment = Math.min(sediment[index] ?? 0, sedimentConcentration * flow);
      waterDelta[index] = (waterDelta[index] ?? 0) - flow;
      waterDelta[target.index] = (waterDelta[target.index] ?? 0) + flow;
      sedimentDelta[index] = (sedimentDelta[index] ?? 0) - movedSediment;
      sedimentDelta[target.index] = (sedimentDelta[target.index] ?? 0) + movedSediment;
    }

    for (let index = 0; index < count; index += 1) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      water[index] = Math.max(
        0,
        ((water[index] ?? 0) + (waterDelta[index] ?? 0))
          * (1 - config.evaporationRate - config.infiltrationRate),
      );
      sediment[index] = Math.max(0, (sediment[index] ?? 0) + (sedimentDelta[index] ?? 0));
      tile.sediment = sediment[index] ?? 0;
      tile.bedElevation = tile.elevation;
    }
  }
}
