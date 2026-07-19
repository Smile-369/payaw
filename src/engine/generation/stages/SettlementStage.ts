import { generateSettlements } from '../../regional/SettlementGenerator';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

export class SettlementStage implements GenerationStage {
  public readonly id = 'settlements';

  public run({ world, random }: GenerationContext): void {
    generateSettlements(world, random);
  }
}
