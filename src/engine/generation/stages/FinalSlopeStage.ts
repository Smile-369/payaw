import { calculateSlopeField } from '../../terrain/Slope';
import type { GenerationStage } from '../GenerationStage';

export class FinalSlopeStage implements GenerationStage {
  public readonly id = 'final-slope';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    const { world } = context;
    const elevations = new Float32Array(world.tiles.length);
    for (let index = 0; index < world.tiles.length; index += 1) elevations[index] = world.tiles[index]?.elevation ?? 0;
    const slopes = calculateSlopeField(elevations, world.width, world.height);
    for (let index = 0; index < world.tiles.length; index += 1) {
      const tile = world.tiles[index];
      const slope = slopes[index];
      if (tile === undefined || slope === undefined) throw new Error('Final slope stage encountered an invalid tile.');
      tile.slope = slope;
    }
  }
}
