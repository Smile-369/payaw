import { generateClimate } from '../../terrain/Climate';
import type { GenerationStage } from '../GenerationStage';

export class ClimateStage implements GenerationStage {
  public readonly id = 'climate';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateClimate(
      context.world,
      context.config.terrain,
      context.config.climate,
      context.random,
    );
  }
}
