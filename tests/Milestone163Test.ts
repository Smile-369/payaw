import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';
import { findNearestValidSettlementTile } from '../src/engine/regional/SettlementGenerator';
import { WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main(): void {
  const pipeline = new GenerationPipeline();
  const seed = 'payaw-ms16-3-settlement-land-safety';
  const options = {
    terrainShape: TerrainShape.Archipelago,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    islandCount: 4,
    islandSpacingKilometers: 3,
    satelliteSettlementCount: 4,
  } as const;
  const world = pipeline.generate(seed, options);
  const movable = world.settlements.find((settlement) => !settlement.isPrimary);
  assert(movable !== undefined, 'No movable satellite settlement was generated.');

  const current = findNearestValidSettlementTile(world, movable.key, movable.x, movable.y, 0);
  assert(current?.x === movable.x && current.y === movable.y, 'The current satellite center should remain valid.');

  const oceanTile = world.tiles.find((tile) => tile.water !== WaterType.Land && tile.islandId === null);
  assert(oceanTile !== undefined, 'The test world has no ocean tile.');
  const oceanCandidate = findNearestValidSettlementTile(world, movable.key, oceanTile.x, oceanTile.y, 0);
  assert(oceanCandidate?.x === oceanTile.x && oceanCandidate.y === oceanTile.y, 'Settlement drag lookup did not preserve the GM-selected ocean tile.');
  assert(oceanCandidate.warning?.includes('water') === true, 'Ocean placement did not return a warning.');

  const movedWorld = pipeline.generate(seed, {
    ...options,
    settlementPositionOverrides: [{ key: movable.key, x: oceanTile.x, y: oceanTile.y }],
  });
  const moved = movedWorld.settlements.find((settlement) => settlement.key === movable.key);
  assert(moved?.x === oceanTile.x && moved.y === oceanTile.y, 'Deterministic regeneration did not preserve the GM-authored settlement position.');

  console.log(JSON.stringify({
    settlement: movable.name,
    currentPosition: current,
    oceanAccepted: true,
    placementWarning: oceanCandidate.warning,
    authoredPositionPreserved: moved?.x === oceanTile.x && moved.y === oceanTile.y,
  }, null, 2));
}

main();
