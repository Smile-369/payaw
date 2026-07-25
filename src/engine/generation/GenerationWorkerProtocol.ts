import type { GenerationOptions } from './GenerationOptions';
import type { GenerationProgress } from './GenerationScheduler';
import type { SerializedWorld, WorldDiagnostics } from '../world/World';
import type { PositionOverrideKind } from './InvalidPositionOverrideError';

export interface GenerationWorkerRequest {
  readonly type: 'generate';
  readonly requestId: number;
  readonly seed: string;
  readonly options: GenerationOptions;
  readonly stopAfterStageId?: string;
}

export interface SerializedGenerationError {
  readonly name: string;
  readonly message: string;
  readonly kind?: PositionOverrideKind;
  readonly key?: string;
  readonly displayName?: string;
  readonly reason?: string;
  readonly entityId?: number | null;
}

export type GenerationWorkerResponse =
  | {
    readonly type: 'progress';
    readonly requestId: number;
    readonly progress: GenerationProgress;
  }
  | {
    readonly type: 'complete';
    readonly requestId: number;
    readonly world: SerializedWorld;
    readonly diagnostics: WorldDiagnostics;
  }
  | {
    readonly type: 'error';
    readonly requestId: number;
    readonly error: SerializedGenerationError;
  };
