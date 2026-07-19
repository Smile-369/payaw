import { applyZoneOverrides } from '../../zoning/ZoneOverrides';
import type { GenerationStage } from '../GenerationStage';

export class ZoneOverrideStage implements GenerationStage {
  public readonly id = 'zone-overrides';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    applyZoneOverrides(context.world, context.options.zoneOverrides);
  }
}
