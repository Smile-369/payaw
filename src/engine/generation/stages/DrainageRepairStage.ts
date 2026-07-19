import { repairDeltaDrainage } from '../../hydrology/DrainageRepair';
import type { GenerationStage } from '../GenerationStage';

export class DrainageRepairStage implements GenerationStage {
  public readonly id = 'delta-drainage-repair';
  public run(context: Parameters<GenerationStage['run']>[0]): void {
    repairDeltaDrainage(context.world);
  }
}
