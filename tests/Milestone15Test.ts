import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main(): void {
  const pipeline = new GenerationPipeline();
  const world = pipeline.generate('payaw-ms15-ui', {
    terrainShape: TerrainShape.SingleLargeIsland,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    islandCount: 5,
    islandSpacingKilometers: 4,
    satelliteSettlementCount: 0,
  });
  assert(world.metadata.schemaVersion >= 15, 'Milestone 15-or-newer schema version is not exported.');
  assert(world.metadata.generationVersion.startsWith('payaw-m'), 'PAYAW generation version is missing.');
  assert(world.settlements.length === 1, 'The UI milestone changed zero-satellite generation behavior.');
  console.log(JSON.stringify({
    schemaVersion: world.metadata.schemaVersion,
    generationVersion: world.metadata.generationVersion,
    settlements: world.settlements.length,
    layout: world.metadata.terrainShape,
  }, null, 2));
}

main();
