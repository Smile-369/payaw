import { rasterizeGeometryPath, transformAuthoringGeometry } from '../../../authoring/AuthoringGeometry';
import { TerrainType, WaterType } from '../../world/Tile';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class AuthoringTerrainStage implements GenerationStage {
  public readonly id = 'authoring-terrain';

  public run({ world, options }: GenerationContext): void {

    for (const feature of options.authoredFeatures) {
      if (feature.category !== 'river' || feature.hidden || feature.realityLayer !== 'normal') continue;
      const points = rasterizeGeometryPath(transformAuthoringGeometry(feature.geometry, feature.rotation, feature.scale));
      const radius = Math.max(0, Math.min(4, Math.round(feature.lineWidth / 2)));
      for (const point of points) {
        for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
          for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            if (Math.hypot(offsetX, offsetY) > radius + 0.25) continue;
            const tile = world.getTile(Math.round(point.x) + offsetX, Math.round(point.y) + offsetY);
            if (tile === undefined) continue;
            tile.river = true;
            tile.terrain = TerrainType.RiverChannel;
            tile.water = WaterType.Land;
            tile.riverWidth = Math.max(tile.riverWidth, Math.max(0.7, feature.lineWidth));
            tile.riverDepth = Math.max(tile.riverDepth, 0.35);
            tile.floodRisk = Math.max(tile.floodRisk, 0.4);
          }
        }
      }
    }

    for (const override of options.terrainOverrides) {
      const tile = world.tiles[override.tileIndex];
      if (tile === undefined) continue;
      if (override.elevation !== undefined) tile.elevation = clamp01(override.elevation);
      if (override.elevationDelta !== undefined) tile.elevation = clamp01(tile.elevation + override.elevationDelta);
      if (override.moisture !== undefined) tile.moisture = clamp01(override.moisture);
      if (override.forestDensity !== undefined) tile.forestDensity = clamp01(override.forestDensity);
      if (override.floodRisk !== undefined) tile.floodRisk = clamp01(override.floodRisk);
      if (override.terrain !== undefined) tile.terrain = override.terrain;
      if (override.water !== undefined) tile.water = override.water;
      if (override.river !== undefined) {
        tile.river = override.river;
        if (override.river) {
          tile.terrain = TerrainType.RiverChannel;
          tile.water = WaterType.Land;
          tile.riverWidth = Math.max(tile.riverWidth, 0.8);
          tile.riverDepth = Math.max(tile.riverDepth, 0.35);
          tile.floodRisk = Math.max(tile.floodRisk, 0.35);
        } else {
          tile.riverId = null;
          tile.riverWidth = 0;
          tile.riverDepth = 0;
        }
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
}
