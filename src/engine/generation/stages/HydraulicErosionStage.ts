import { applyHydraulicErosion } from '../../terrain/HydraulicErosion';
import type { GenerationStage } from '../GenerationStage';

export class HydraulicErosionStage implements GenerationStage {
  public readonly id = 'hydraulic-erosion';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    applyHydraulicErosion(context.world, context.config.hydraulicErosion);
  }
}
