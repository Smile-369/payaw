import { TerrainShape } from '../GenerationOptions';
import { generateIslands } from '../../regional/IslandGenerator';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

export class IslandStage implements GenerationStage {
  public readonly id = 'islands';

  public run({ world, options, random }: GenerationContext): void {
    const requestedCount = options.terrainShape === TerrainShape.Archipelago
      ? options.islandCount
      : options.terrainShape === TerrainShape.TwinIslands ? 2 : undefined;
    generateIslands(world, options.townScale, random, options.islandOverrides, requestedCount);
  }
}
