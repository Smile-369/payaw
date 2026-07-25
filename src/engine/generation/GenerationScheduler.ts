export interface GenerationProgress {
  readonly stageId: string;
  readonly stageIndex: number;
  readonly stageCount: number;
  readonly stageDurationMs: number;
  readonly elapsedMs: number;
  readonly completed: boolean;
}

export interface GenerationRunOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: GenerationProgress) => void;
  /** Yield between stages so the browser can paint progress and process input. */
  readonly yieldBetweenStages?: boolean;
  /** Stop after this deterministic stage. Used by Player View to avoid generating hidden story/NPC data. */
  readonly stopAfterStageId?: string;
}

export class GenerationCancelledError extends Error {
  public constructor() {
    super('World generation was cancelled.');
    this.name = 'GenerationCancelledError';
  }
}

export function throwIfGenerationCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new GenerationCancelledError();
}

export async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => resolve());
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}
