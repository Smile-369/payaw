import { analyzeCoastline } from '../../terrain/Coastline';
import type { GenerationStage } from '../GenerationStage';

export class ErodedCoastlineStage implements GenerationStage {
  public readonly id = 'eroded-coastline';
  public run(context: Parameters<GenerationStage['run']>[0]): void {
    analyzeCoastline(context.world, context.config.terrain);
  }
}
