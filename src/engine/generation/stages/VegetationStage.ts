import { generateVegetation } from '../../vegetation/ForestGenerator';
import type { GenerationStage } from '../GenerationStage';

export class VegetationStage implements GenerationStage {
  public readonly id = 'vegetation';
  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateVegetation(context.world, context.config.vegetation, context.random);
  }
}
