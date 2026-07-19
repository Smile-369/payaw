import { applyThermalErosion } from '../../terrain/ThermalErosion';
import type { GenerationStage } from '../GenerationStage';

export class ThermalErosionStage implements GenerationStage {
  public readonly id = 'thermal-erosion';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    applyThermalErosion(context.world, context.config.thermalErosion);
  }
}
