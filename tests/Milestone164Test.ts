import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';
import { findNearestValidSettlementTile } from '../src/engine/regional/SettlementGenerator';
import { TerrainType, WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main(): void {
  const pipeline = new GenerationPipeline();
  const seed = 'payaw-ms16-4-cross-island-settlements';
  const options = {
    terrainShape: TerrainShape.Archipelago,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    islandCount: 6,
    islandSpacingKilometers: 3,
    satelliteSettlementCount: 5,
  } as const;
  const world = pipeline.generate(seed, options);
  const movable = world.settlements.find((settlement) => !settlement.isPrimary);
  assert(movable !== undefined, 'No movable satellite settlement was generated.');
  const sourceIsland = world.islands[movable.islandId];
  assert(sourceIsland !== undefined, 'The movable settlement has no source island.');

  let candidate:
    | { readonly x: number; readonly y: number; readonly islandId: number; readonly islandKey: string }
    | undefined;
  for (const island of world.islands) {
    if (island.id === sourceIsland.id || island.locked || island.preserveNature) continue;
    const landmass = world.landmasses[island.landmassId];
    if (landmass === undefined) continue;
    for (const index of landmass.tileIndices) {
      const tile = world.tiles[index];
      if (
        tile === undefined
        || tile.islandId !== island.id
        || tile.water !== WaterType.Land
        || tile.river
        || tile.terrain === TerrainType.Mountain
        || tile.slope > 0.38
        || tile.floodRisk > 0.92
      ) continue;
      candidate = findNearestValidSettlementTile(world, movable.key, tile.x, tile.y, 0);
      if (candidate !== undefined && candidate.islandId === island.id) break;
    }
    if (candidate !== undefined) break;
  }
  assert(candidate !== undefined, 'Could not find a valid cross-island settlement destination.');
  assert(candidate.islandId !== sourceIsland.id, 'The candidate did not target a different island.');

  const destinationBefore = world.islands[candidate.islandId];
  assert(destinationBefore !== undefined, 'The destination island was not found.');
  const moved = pipeline.generate(seed, {
    ...options,
    settlementPositionOverrides: [{
      key: movable.key,
      x: candidate.x,
      y: candidate.y,
      islandKey: candidate.islandKey,
    }],
  });
  const movedSettlement = moved.settlements.find((settlement) => settlement.key === movable.key);
  assert(movedSettlement !== undefined, 'The moved settlement disappeared after regeneration.');
  assert(movedSettlement.islandId === candidate.islandId, 'The settlement island assignment was not changed.');
  assert(movedSettlement.x === candidate.x && movedSettlement.y === candidate.y, 'The settlement did not use the saved destination tile.');

  const movedSource = moved.islands[sourceIsland.id];
  const movedDestination = moved.islands[candidate.islandId];
  assert(movedSource !== undefined && movedDestination !== undefined, 'Source or destination island is missing after regeneration.');
  assert(!movedSource.settlementIds.includes(movedSettlement.id), 'The source island still owns the moved settlement.');
  assert(movedDestination.settlementIds.includes(movedSettlement.id), 'The destination island does not own the moved settlement.');
  assert(movedDestination.allowRoads, 'Cross-island placement did not activate road generation on the destination island.');
  assert(moved.tiles[movedSettlement.tileIndex]?.islandId === movedDestination.id, 'Settlement tile and island assignment disagree.');

  // Older project JSON did not include islandKey. It must remain compatible.
  const legacy = pipeline.generate(seed, {
    ...options,
    settlementPositionOverrides: [{ key: movable.key, x: candidate.x, y: candidate.y }],
  });
  const legacyMoved = legacy.settlements.find((settlement) => settlement.key === movable.key);
  assert(legacyMoved?.islandId === candidate.islandId, 'Legacy x/y-only settlement overrides were not migrated by inference.');

  console.log(JSON.stringify({
    settlement: movable.name,
    sourceIsland: sourceIsland.name,
    destinationIsland: movedDestination.name,
    destination: candidate,
    destinationRoadsEnabled: movedDestination.allowRoads,
    sourceOwnsSettlement: movedSource.settlementIds.includes(movedSettlement.id),
    destinationOwnsSettlement: movedDestination.settlementIds.includes(movedSettlement.id),
    legacyOverrideAccepted: legacyMoved?.islandId === candidate.islandId,
  }, null, 2));
}

main();
