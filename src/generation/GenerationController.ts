import type { EditorSession } from '../models/EditorSession';
import { createCryptoSeed } from '../utils/Identifiers';
import * as elements from '../ui/AppElements';

export interface GenerationControllerDependencies {
  readonly session: EditorSession;
  readonly generate: () => Promise<void>;
  readonly cancel: () => void;
  readonly updateProfileHint: () => void;
}

export class GenerationController {
  public constructor(private readonly dependencies: GenerationControllerDependencies) {
    this.bindEvents();
  }

  private bindEvents(): void {
    elements.generateButton.addEventListener('click', () => { void this.dependencies.generate(); });
    elements.cancelGenerationButton.addEventListener('click', this.dependencies.cancel);
    elements.seedInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void this.dependencies.generate();
    });
    elements.randomSeedButton.addEventListener('click', () => {
      elements.seedInput.value = createCryptoSeed();
      void this.dependencies.generate();
    });
    for (const control of [
      elements.terrainSizeSelect,
      elements.townScaleSelect,
      elements.terrainShapeSelect,
      elements.climatePresetSelect,
    ]) {
      control.addEventListener('change', this.dependencies.updateProfileHint);
    }
    elements.islandCountInput.addEventListener('input', this.dependencies.updateProfileHint);
    elements.islandSpacingInput.addEventListener('input', this.dependencies.updateProfileHint);
  }
}
