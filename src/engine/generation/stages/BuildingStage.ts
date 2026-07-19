import { generateBuildings } from '../../buildings/BuildingGenerator';
import type { GenerationStage } from '../GenerationStage';

export class BuildingStage implements GenerationStage {
  public readonly id = 'buildings';
  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateBuildings(context.world, context.config.buildings, context.random);
  }
}
