import { GenerationPipeline } from '../engine/generation/GenerationPipeline';
import { InvalidPositionOverrideError } from '../engine/generation/InvalidPositionOverrideError';
import type { GenerationWorkerRequest, GenerationWorkerResponse, SerializedGenerationError } from '../engine/generation/GenerationWorkerProtocol';

const scope = globalThis as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent<GenerationWorkerRequest>) => void): void;
  postMessage(message: GenerationWorkerResponse): void;
};
const pipeline = new GenerationPipeline();

function serializeError(error: unknown): SerializedGenerationError {
  if (error instanceof InvalidPositionOverrideError) {
    return {
      name: error.name,
      message: error.message,
      kind: error.kind,
      key: error.key,
      displayName: error.displayName,
      reason: error.reason,
      entityId: error.entityId,
    };
  }
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'Error', message: String(error) };
}

scope.addEventListener('message', (event) => {
  const request = event.data;
  if (request.type !== 'generate') return;
  try {
    const world = pipeline.generate(request.seed, request.options, {
      onProgress: (progress) => scope.postMessage({ type: 'progress', requestId: request.requestId, progress }),
      ...(request.stopAfterStageId === undefined ? {} : { stopAfterStageId: request.stopAfterStageId }),
    });
    scope.postMessage({
      type: 'complete',
      requestId: request.requestId,
      world: world.toJSON(),
      diagnostics: world.diagnostics,
    });
  } catch (error) {
    scope.postMessage({ type: 'error', requestId: request.requestId, error: serializeError(error) });
  }
});
