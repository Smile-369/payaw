import type { GenerationStage } from '../GenerationStage';
import { generateElevationField } from '../../terrain/Heightmap';

export class ElevationStage implements GenerationStage {
  public readonly id = 'terrain';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    const { world, config, random } = context;
    const elevations = generateElevationField(world.width, world.height, config, random);

    for (let index = 0; index < world.tiles.length; index += 1) {
      const tile = world.tiles[index];
      const elevation = elevations[index];
      if (tile === undefined || elevation === undefined) {
        throw new Error('Elevation stage encountered an invalid tile index.');
      }

      tile.elevation = elevation;
    }
  }
}
