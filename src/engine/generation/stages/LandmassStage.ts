import { detectLandmasses } from '../../geography/LandmassDetector';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

export class LandmassStage implements GenerationStage {
  public readonly id = 'landmasses';

  public run({ world }: GenerationContext): void {
    detectLandmasses(world);
  }
}
