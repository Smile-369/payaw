import { nameWorldFeatures } from '../../naming/PlaceNames';
import type { GenerationStage } from '../GenerationStage';

export class NamingStage implements GenerationStage {
  public readonly id = 'place-naming';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    nameWorldFeatures(
      context.world,
      context.random,
      context.options.roadNameOverrides,
      context.options.blockNameOverrides,
    );
  }
}
