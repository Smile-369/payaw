import { generateBridgeNetwork } from '../../infrastructure/BridgeNetwork';
import type { GenerationStage } from '../GenerationStage';

export class BridgeStage implements GenerationStage {
  public readonly id = 'bridges';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateBridgeNetwork(
      context.world,
      context.config.bridges,
      context.config.roads,
      context.random,
      context.options.bridgeOverrides,
      context.options.customBridges,
    );
  }
}
