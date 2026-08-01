import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { GenerationCancelledError } from '../src/engine/generation/GenerationScheduler';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const pipeline = new GenerationPipeline();
  const baseOptions = {
    terrainShape: TerrainShape.SingleLargeIsland,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    islandCount: 5,
    islandSpacingKilometers: 4,
  } as const;

  const primaryOnly = pipeline.generate('payaw-ms14-primary-only', {
    ...baseOptions,
    satelliteSettlementCount: 0,
  });
  assert(primaryOnly.metadata.schemaVersion >= 14, 'Milestone 14 schema version is not exported.');
  assert(primaryOnly.metadata.satelliteSettlementCount === 0, 'Satellite settlement count is missing from metadata.');
  assert(primaryOnly.settlements.length === 1, 'A zero-satellite profile should generate only the primary settlement.');
  assert(primaryOnly.settlements[0]?.isPrimary === true, 'The remaining settlement is not the primary Poblacion.');

  const withSatellites = pipeline.generate('payaw-ms14-satellites', {
    ...baseOptions,
    satelliteSettlementCount: 4,
  });
  assert(withSatellites.settlements.filter((settlement) => !settlement.isPrimary).length === 4, 'The requested four satellite settlements were not generated.');

  const progressStages: string[] = [];
  const asyncWorld = await pipeline.generateAsync('payaw-ms14-async', {
    ...baseOptions,
    satelliteSettlementCount: 2,
  }, {
    yieldBetweenStages: true,
    onProgress: (progress) => progressStages.push(progress.stageId),
  });
  const syncWorld = pipeline.generate('payaw-ms14-async', {
    ...baseOptions,
    satelliteSettlementCount: 2,
  });
  assert(progressStages.length === pipeline.stageIds().length, 'Async generation did not report every deterministic stage.');
  const asyncSerialized = asyncWorld.toJSON();
  const syncSerialized = syncWorld.toJSON();
  assert(JSON.stringify({ ...asyncSerialized, diagnostics: undefined }) === JSON.stringify({ ...syncSerialized, diagnostics: undefined }), 'Scheduled generation changed deterministic world output.');

  const controller = new AbortController();
  controller.abort();
  let cancelled = false;
  try {
    await pipeline.generateAsync('payaw-ms14-cancelled', baseOptions, { signal: controller.signal });
  } catch (error) {
    cancelled = error instanceof GenerationCancelledError;
  }
  assert(cancelled, 'An aborted scheduled generation did not throw GenerationCancelledError.');

  console.log(JSON.stringify({
    schemaVersion: primaryOnly.metadata.schemaVersion,
    primaryOnlySettlements: primaryOnly.settlements.length,
    satelliteSettlements: withSatellites.settlements.length - 1,
    scheduledStages: progressStages.length,
    deterministicAsync: true,
    cancellation: true,
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error);
  throw error;
});
