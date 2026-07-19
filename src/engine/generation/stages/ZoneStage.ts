import { generateZones } from '../../zoning/ZoneGenerator';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

export class ZoneStage implements GenerationStage {
  public readonly id = 'zoning';

  public run(context: GenerationContext): void {
    generateZones(context.world, context.config.zoning);
  }
}
