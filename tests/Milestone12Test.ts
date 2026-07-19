import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale, type SettlementPositionOverride } from '../src/engine/generation/GenerationOptions';
import { TerrainType, WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pipeline = new GenerationPipeline();
const seed = 'payaw-ms12-metro-region';
const options = {
  terrainShape: TerrainShape.Archipelago,
  terrainSize: TerrainSize.Small,
  townScale: TownScale.SemiUrban,
  islandCount: 6,
  islandSpacingKilometers: 3.5,
} as const;
const world = pipeline.generate(seed, options);
const repeat = pipeline.generate(seed, options);

assert(world.metadata.schemaVersion === 12, 'Milestone 12 schema version was not exported.');
assert(world.metadata.targetIslandCount === 6, 'Requested island count was not preserved in metadata.');
assert(world.metadata.islandSpacingKilometers === 3.5, 'Requested island spacing was not preserved in metadata.');
assert(world.metadata.tileSizeMeters === 125, 'Metro-region tile scale is not 125 meters.');
assert(world.metadata.worldWidthKilometers === 32 && world.metadata.worldHeightKilometers === 24, 'Small terrain does not represent the expected 32×24 km region.');
assert(world.islands.length >= 4, 'The six-island profile did not produce a viable regional archipelago.');
assert(JSON.stringify(world.islands.map((island) => [island.key, island.name, island.role])) === JSON.stringify(repeat.islands.map((island) => [island.key, island.name, island.role])), 'Regional island generation is not deterministic.');

const primaryIsland = world.islands.find((island) => island.role === 'primary-settlement') ?? world.islands[0];
assert(primaryIsland !== undefined, 'No primary island was generated.');
const settlementWorld = pipeline.generate(seed, {
  ...options,
  islandOverrides: [{ key: primaryIsland.key, settlementCount: 2 }],
});
const movable = settlementWorld.settlements.find((settlement) => !settlement.isPrimary);
assert(movable !== undefined, 'No satellite settlement was available for the movement test.');
const island = settlementWorld.islands[movable.islandId];
assert(island !== undefined, 'Movable settlement has no island.');
const landmass = settlementWorld.landmasses[island.landmassId];
assert(landmass !== undefined, 'Movable settlement has no landmass.');
const candidate = landmass.tileIndices
  .map((index) => settlementWorld.tiles[index])
  .find((tile) => tile !== undefined
    && tile.water === WaterType.Land
    && !tile.river
    && tile.terrain !== TerrainType.Mountain
    && tile.slope <= 0.38
    && tile.floodRisk <= 0.92
    && Math.hypot(tile.x - movable.x, tile.y - movable.y) >= 7);
assert(candidate !== undefined, 'Could not find a valid alternate satellite-settlement location.');
const positionOverride: SettlementPositionOverride = { key: movable.key, x: candidate.x, y: candidate.y };
const movedWorld = pipeline.generate(seed, { ...options, islandOverrides: [{ key: primaryIsland.key, settlementCount: 2 }], settlementPositionOverrides: [positionOverride] });
const moved = movedWorld.settlements.find((settlement) => settlement.key === movable.key);
assert(moved?.x === candidate.x && moved.y === candidate.y, 'Satellite settlement position override was not applied.');


console.log(JSON.stringify({
  schemaVersion: world.metadata.schemaVersion,
  requestedIslands: world.metadata.targetIslandCount,
  generatedIslands: world.islands.length,
  settlements: world.settlements.length,
  islandSpacingKilometers: world.metadata.islandSpacingKilometers,
  worldSizeKilometers: [world.metadata.worldWidthKilometers, world.metadata.worldHeightKilometers],
  movedSettlement: moved.name,
}, null, 2));
