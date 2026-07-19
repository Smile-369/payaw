import { generateBlocks } from '../../blocks/BlockGenerator';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

export class BlockStage implements GenerationStage {
  public readonly id = 'blocks';

  public run(context: GenerationContext): void {
    generateBlocks(context.world, context.config.blocks);
  }
}
