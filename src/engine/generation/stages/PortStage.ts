import { generatePorts } from '../../infrastructure/MaritimeNetwork';
import type { GenerationStage } from '../GenerationStage';

export class PortStage implements GenerationStage {
  public readonly id = 'ports';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generatePorts(
      context.world,
      context.config.maritime,
      context.config.roads,
      context.random,
      context.options.portOverrides,
      context.options.customPorts,
    );
  }
}
