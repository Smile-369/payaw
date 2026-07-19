import { generateIslands } from '../../regional/IslandGenerator';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

export class IslandStage implements GenerationStage {
  public readonly id = 'islands';

  public run({ world, options, random }: GenerationContext): void {
    generateIslands(world, options.townScale, random, options.islandOverrides);
  }
}
