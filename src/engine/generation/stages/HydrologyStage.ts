import { generateHydrology } from '../../hydrology/Hydrology';
import type { GenerationStage } from '../GenerationStage';

export class HydrologyStage implements GenerationStage {
  public readonly id = 'terrain-hydrology';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateHydrology(
      context.world,
      context.config.hydrology,
      context.config.terrain,
      context.random,
    );
  }
}
