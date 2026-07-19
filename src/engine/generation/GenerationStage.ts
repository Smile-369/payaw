import type { GenerationConfig } from '../config/GenerationConfig';
import type { Random } from '../rng/Random';
import type { World } from '../world/World';
import type { ResolvedGenerationOptions } from './GenerationOptions';

export interface GenerationContext {
  readonly config: GenerationConfig;
  readonly options: ResolvedGenerationOptions;
  readonly random: Random;
  readonly world: World;
}

export interface GenerationStage {
  readonly id: string;
  run(context: GenerationContext): void;
}
