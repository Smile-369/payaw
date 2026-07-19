import { GenerationPipeline } from '../engine/generation/GenerationPipeline';
import type { GenerationOptions } from '../engine/generation/GenerationOptions';
import {
  GenerationCancelledError,
  type GenerationRunOptions,
} from '../engine/generation/GenerationScheduler';
import type {
  GenerationWorkerRequest,
  GenerationWorkerResponse,
  SerializedGenerationError,
} from '../engine/generation/GenerationWorkerProtocol';
import { InvalidPositionOverrideError } from '../engine/generation/InvalidPositionOverrideError';
import { World } from '../engine/world/World';

function deserializeError(error: SerializedGenerationError): Error {
  if (
    error.name === 'InvalidPositionOverrideError'
    && error.kind !== undefined
    && error.key !== undefined
    && error.displayName !== undefined
    && error.reason !== undefined
  ) {
    return new InvalidPositionOverrideError(
      error.kind,
      error.key,
      error.displayName,
      error.reason,
      error.entityId ?? null,
    );
  }
  const result = new Error(error.message);
  result.name = error.name;
  return result;
}

/**
 * Owns a single disposable generation worker. Cancelling a run terminates the
 * worker immediately, so a cancelled generation cannot keep consuming CPU.
 */
export class GenerationWorkerClient {
  private worker: Worker | null = null;
  private requestSequence = 0;

  public constructor(private readonly fallbackPipeline: GenerationPipeline) {}

  public cancel(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  public generate(
    seed: string,
    options: GenerationOptions = {},
    runOptions: GenerationRunOptions = {},
  ): Promise<World> {
    if (typeof Worker === 'undefined') {
      return this.fallbackPipeline.generateAsync(seed, options, runOptions);
    }

    this.cancel();
    const worker = new Worker(new URL('../workers/generation.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    const requestId = ++this.requestSequence;

    return new Promise<World>((resolve, reject) => {
      let settled = false;

      const cleanup = (): void => {
        runOptions.signal?.removeEventListener('abort', onAbort);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onWorkerError);
        worker.terminate();
        if (this.worker === worker) this.worker = null;
      };
      const finishResolve = (world: World): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(world);
      };
      const finishReject = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = (): void => finishReject(new GenerationCancelledError());
      const onWorkerError = (event: ErrorEvent): void => {
        finishReject(new Error(event.message || 'The world-generation worker failed.'));
      };
      const onMessage = (event: MessageEvent<GenerationWorkerResponse>): void => {
        const response = event.data;
        if (response.requestId !== requestId) return;
        if (response.type === 'progress') {
          runOptions.onProgress?.(response.progress);
          return;
        }
        if (response.type === 'error') {
          finishReject(deserializeError(response.error));
          return;
        }
        finishResolve(World.fromSerialized(response.world, response.diagnostics));
      };

      if (runOptions.signal?.aborted === true) {
        finishReject(new GenerationCancelledError());
        return;
      }

      runOptions.signal?.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onWorkerError);
      const request: GenerationWorkerRequest = { type: 'generate', requestId, seed, options };
      worker.postMessage(request);
    });
  }
}
