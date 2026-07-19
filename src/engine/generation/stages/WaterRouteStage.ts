import { generateWaterRoutes } from '../../infrastructure/MaritimeNetwork';
import type { GenerationStage } from '../GenerationStage';

export class WaterRouteStage implements GenerationStage {
  public readonly id = 'water-routes';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateWaterRoutes(
      context.world,
      context.config.maritime,
      context.random,
      context.options.waterRouteOverrides,
      context.options.customWaterRoutes,
    );
  }
}
