import { analyzeCoastline } from '../../terrain/Coastline';
import type { GenerationStage } from '../GenerationStage';

export class FinalCoastlineStage implements GenerationStage {
  public readonly id = 'final-coastline';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    analyzeCoastline(context.world, context.config.terrain);
  }
}
