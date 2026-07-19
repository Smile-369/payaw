import { generateRoadNetwork } from '../../infrastructure/RoadNetwork';
import type { GenerationStage } from '../GenerationStage';

export class RoadStage implements GenerationStage {
  public readonly id = 'road-network';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateRoadNetwork(context.world, context.config.roads, context.random);
  }
}
