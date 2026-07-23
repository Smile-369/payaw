import { generateNPCPopulation } from '../../npc/NPCGenerator';
import type { GenerationStage } from '../GenerationStage';

export class NPCStage implements GenerationStage {
  public readonly id = 'npc-population';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    context.world.npcs = generateNPCPopulation(context.world, context.random);
  }
}
