import type { GenerationConfig } from '../config/GenerationConfig';
import { Biome, RiverCourse, TerrainType, WaterType, type Tile } from '../world/Tile';

export function classifyTerrain(tile: Tile, config: GenerationConfig): void {
  const terrain = config.terrain;

  if (tile.water === WaterType.Ocean) {
    tile.terrain = tile.waterDepth >= terrain.deepWaterDepth
      ? TerrainType.DeepWater
      : TerrainType.ShallowWater;
    tile.biome = Biome.Ocean;
    return;
  }

  if (tile.water === WaterType.Lake) {
    tile.terrain = TerrainType.Lake;
    tile.biome = Biome.Lake;
    return;
  }

  if (tile.delta || tile.riverCourse === RiverCourse.Delta) {
    tile.terrain = TerrainType.Delta;
    tile.biome = Biome.Wetland;
    return;
  }

  if (tile.river) {
    tile.terrain = TerrainType.RiverChannel;
    tile.biome = tile.riverCourse === RiverCourse.Upper ? Biome.Upland : Biome.Wetland;
    return;
  }

  if (tile.coast && tile.elevation < terrain.seaLevel + terrain.beachWidth) {
    tile.terrain = TerrainType.Beach;
    tile.biome = Biome.Coast;
    return;
  }

  if (
    tile.floodRisk >= terrain.wetlandFloodRiskThreshold
    && tile.slope < config.hydrology.floodplainSlopeLimit
  ) {
    tile.terrain = TerrainType.Floodplain;
    tile.biome = Biome.Wetland;
    return;
  }

  if (tile.elevation >= terrain.mountainLevel || tile.slope > 0.62) {
    tile.terrain = TerrainType.Mountain;
    tile.biome = Biome.Mountain;
    return;
  }

  if (tile.elevation >= terrain.hillLevel || tile.slope > 0.31) {
    if (tile.forestDensity >= terrain.forestTerrainThreshold - 0.08) {
      tile.terrain = TerrainType.Forest;
      tile.biome = Biome.UplandForest;
    } else {
      tile.terrain = TerrainType.Hill;
      tile.biome = Biome.Upland;
    }
    return;
  }

  if (tile.forestDensity >= terrain.forestTerrainThreshold) {
    tile.terrain = TerrainType.Forest;
    tile.biome = Biome.LowlandForest;
    return;
  }

  tile.terrain = TerrainType.Plain;
  tile.biome = Biome.Lowland;
}
