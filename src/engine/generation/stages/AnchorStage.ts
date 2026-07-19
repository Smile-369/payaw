import { generateAnchors } from '../../settlement/AnchorGenerator';
import { alignPrimarySettlementToPlaza } from '../../regional/SettlementGenerator';
import type { GenerationStage } from '../GenerationStage';

export class AnchorStage implements GenerationStage {
  public readonly id = 'anchor-placement';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateAnchors(
      context.world,
      context.config.anchors,
      context.random,
      context.options.customAnchors,
      context.options.builtInAnchorOverrides,
      context.options.anchorPositionOverrides,
    );
    alignPrimarySettlementToPlaza(context.world);
  }
}
