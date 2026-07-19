import { calculateLandValue } from '../../economy/LandValue';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

export class LandValueStage implements GenerationStage {
  public readonly id = 'land-value';

  public run(context: GenerationContext): void {
    calculateLandValue(context.world, context.config.landValue);
  }
}
