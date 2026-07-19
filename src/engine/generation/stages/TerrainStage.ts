import type { GenerationStage } from '../GenerationStage';
import { classifyTerrain } from '../../terrain/TerrainClassifier';

export class TerrainStage implements GenerationStage {
  public readonly id = 'terrain-classification';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    for (const tile of context.world.tiles) {
      classifyTerrain(tile, context.config);
    }
  }
}
