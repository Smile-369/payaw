import { calculateAccessibility } from '../../economy/Accessibility';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

export class AccessibilityStage implements GenerationStage {
  public readonly id = 'accessibility';

  public run(context: GenerationContext): void {
    calculateAccessibility(context.world, context.config.accessibility);
  }
}
