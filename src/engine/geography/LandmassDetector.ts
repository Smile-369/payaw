import { WaterType } from '../world/Tile';
import type { World } from '../world/World';
import type { GridPoint, Landmass } from './Landmass';

const CARDINALS: readonly (readonly [number, number])[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

function simplifyCoast(points: readonly GridPoint[], maximumPoints = 160): readonly GridPoint[] {
  if (points.length <= maximumPoints) return points;
  const step = Math.max(1, Math.ceil(points.length / maximumPoints));
  return points.filter((_, index) => index % step === 0);
}

function landmassKey(firstIndex: number, area: number): string {
  return `landmass-${firstIndex.toString(36)}-${area.toString(36)}`;
}

export function detectLandmasses(world: World): void {
  const visited = new Uint8Array(world.tiles.length);
  const components: number[][] = [];

  for (const tile of world.tiles) {
    tile.landmassId = null;
    tile.islandId = null;
    tile.settlementId = null;
  }

  for (let startIndex = 0; startIndex < world.tiles.length; startIndex += 1) {
    const start = world.tiles[startIndex];
    if (start === undefined || start.water !== WaterType.Land || visited[startIndex] === 1) continue;
    const component: number[] = [];
    const queue = [startIndex];
    visited[startIndex] = 1;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      if (index === undefined) continue;
      component.push(index);
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      for (const [dx, dy] of CARDINALS) {
        const nx = tile.x + dx;
        const ny = tile.y + dy;
        if (!world.contains(nx, ny)) continue;
        const neighborIndex = ny * world.width + nx;
        const neighbor = world.tiles[neighborIndex];
        if (neighbor?.water !== WaterType.Land || visited[neighborIndex] === 1) continue;
        visited[neighborIndex] = 1;
        queue.push(neighborIndex);
      }
    }
    components.push(component.sort((left, right) => left - right));
  }

  components.sort((left, right) => (left[0] ?? 0) - (right[0] ?? 0));
  world.landmasses = components.map((indices, id): Landmass => {
    let minX = world.width;
    let minY = world.height;
    let maxX = 0;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    let elevation = 0;
    let slope = 0;
    let flood = 0;
    let moisture = 0;
    let forest = 0;
    let freshwater = 0;
    let buildableArea = 0;
    const coastIndices: number[] = [];
    const coastPoints: GridPoint[] = [];

    for (const index of indices) {
      const tile = world.tiles[index];
      if (tile === undefined) continue;
      tile.landmassId = id;
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x);
      maxY = Math.max(maxY, tile.y);
      sumX += tile.x + 0.5;
      sumY += tile.y + 0.5;
      elevation += tile.elevation;
      slope += tile.slope;
      flood += tile.floodRisk;
      moisture += tile.moisture;
      forest += tile.forestDensity;
      freshwater += tile.river ? 1.6 : tile.moisture * 0.18;
      if (!tile.river && tile.slope <= 0.2 && tile.floodRisk <= 0.72) buildableArea += 1;

      let coastline = false;
      for (const [dx, dy] of CARDINALS) {
        const neighbor = world.getTile(tile.x + dx, tile.y + dy);
        if (neighbor === undefined || neighbor.water !== WaterType.Land) {
          coastline = true;
          break;
        }
      }
      if (coastline) {
        coastIndices.push(index);
        coastPoints.push({ x: tile.x + 0.5, y: tile.y + 0.5 });
      }
    }

    const divisor = Math.max(1, indices.length);
    return {
      id,
      key: landmassKey(indices[0] ?? id, indices.length),
      tileIndices: indices,
      coastlineTileIndices: coastIndices,
      simplifiedCoastline: simplifyCoast(coastPoints),
      area: indices.length,
      coastlineLength: coastIndices.length,
      bounds: { minX, minY, maxX, maxY },
      centroid: { x: sumX / divisor, y: sumY / divisor },
      averageElevation: elevation / divisor,
      averageSlope: slope / divisor,
      averageFloodRisk: flood / divisor,
      averageMoisture: moisture / divisor,
      averageForestDensity: forest / divisor,
      freshwaterScore: Math.min(1, freshwater / divisor),
      buildableArea,
    };
  });
}
