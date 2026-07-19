import { analyzeCoastline, smoothCoastline } from '../../terrain/Coastline';
import type { GenerationStage } from '../GenerationStage';

export class CoastlineStage implements GenerationStage {
  public readonly id = 'coastline';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    smoothCoastline(context.world, context.config.terrain);
    analyzeCoastline(context.world, context.config.terrain);
  }
}
