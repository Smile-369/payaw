import { applyNorthernMountainRange } from '../../terrain/Mountains';
import type { GenerationStage } from '../GenerationStage';

export class MountainStage implements GenerationStage {
  public readonly id = 'mountain-structure';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    applyNorthernMountainRange(context.world, context.config.mountains, context.random);
  }
}
