import type { World } from '../engine/world/World';
import { TerrainType, WaterType } from '../engine/world/Tile';

export type TerrainEditOperation =
  | 'raise'
  | 'lower'
  | 'flatten'
  | 'smooth'
  | 'paint'
  | 'river'
  | 'erase-river'
  | 'restore';

export interface LiveTerrainEdit {
  readonly operation: TerrainEditOperation;
  readonly strength: number;
  readonly terrain: TerrainType;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function waterForTerrain(terrain: TerrainType): WaterType {
  if (terrain === TerrainType.DeepWater || terrain === TerrainType.ShallowWater) return WaterType.Ocean;
  if (terrain === TerrainType.Lake) return WaterType.Lake;
  return WaterType.Land;
}

/**
 * Applies only the visible tile mutation needed for an authoring stroke.
 * It deliberately does not rebuild hydrology, roads, zoning, buildings, or NPCs.
 * Those dependent systems are rebuilt explicitly by the GM after a batch of edits.
 */
export function applyLiveTerrainEdit(
  world: World,
  tileIndices: readonly number[],
  edit: LiveTerrainEdit,
): void {
  if (edit.operation === 'restore') return;

  const originalElevation = new Map<number, number>();
  if (edit.operation === 'smooth') {
    for (const index of tileIndices) {
      const tile = world.tiles[index];
      if (tile !== undefined) originalElevation.set(index, tile.elevation);
    }
  }

  for (const tileIndex of tileIndices) {
    const tile = world.tiles[tileIndex];
    if (tile === undefined) continue;

    switch (edit.operation) {
      case 'raise':
        tile.elevation = clamp01(tile.elevation + edit.strength);
        break;
      case 'lower':
        tile.elevation = clamp01(tile.elevation - edit.strength);
        break;
      case 'flatten':
        tile.elevation = clamp01(edit.strength);
        break;
      case 'smooth': {
        const neighbors = [
          world.getTile(tile.x - 1, tile.y),
          world.getTile(tile.x + 1, tile.y),
          world.getTile(tile.x, tile.y - 1),
          world.getTile(tile.x, tile.y + 1),
        ].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined);
        const average = neighbors.length === 0
          ? tile.elevation
          : neighbors.reduce((sum, candidate) => sum + (originalElevation.get(candidate.y * world.width + candidate.x) ?? candidate.elevation), 0) / neighbors.length;
        tile.elevation = clamp01(tile.elevation + (average - tile.elevation) * clamp01(edit.strength));
        break;
      }
      case 'paint':
        tile.terrain = edit.terrain;
        tile.water = waterForTerrain(edit.terrain);
        if (edit.terrain === TerrainType.Forest) tile.forestDensity = Math.max(tile.forestDensity, 0.85);
        if (edit.terrain === TerrainType.Floodplain) tile.floodRisk = Math.max(tile.floodRisk, 0.8);
        if (edit.terrain === TerrainType.RiverChannel) {
          tile.river = true;
          tile.water = WaterType.Land;
          tile.riverWidth = Math.max(tile.riverWidth, 0.8);
          tile.riverDepth = Math.max(tile.riverDepth, 0.35);
          tile.floodRisk = Math.max(tile.floodRisk, 0.35);
        }
        break;
      case 'river':
        tile.river = true;
        tile.terrain = TerrainType.RiverChannel;
        tile.water = WaterType.Land;
        tile.riverWidth = Math.max(tile.riverWidth, 0.8);
        tile.riverDepth = Math.max(tile.riverDepth, 0.35);
        tile.floodRisk = Math.max(tile.floodRisk, 0.35);
        break;
      case 'erase-river':
        tile.river = false;
        tile.riverId = null;
        tile.riverWidth = 0;
        tile.riverDepth = 0;
        break;
    }

    if (tile.water !== WaterType.Land) {
      tile.coast = false;
      tile.river = false;
      tile.riverId = null;
      tile.riverWidth = 0;
      tile.riverDepth = 0;
    }
    tile.bedElevation = Math.min(tile.bedElevation, tile.elevation);
  }
}
