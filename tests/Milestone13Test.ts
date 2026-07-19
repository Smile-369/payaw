import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';
import { WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pipeline = new GenerationPipeline();
const layouts = [
  TerrainShape.SingleSmallIsland,
  TerrainShape.SingleMediumIsland,
  TerrainShape.SingleLargeIsland,
  TerrainShape.Archipelago,
  TerrainShape.TwinIslands,
  TerrainShape.Peninsula,
  TerrainShape.InlandCoast,
  TerrainShape.Delta,
] as const;

const results = [];
for (const layout of layouts) {
  const world = pipeline.generate(`payaw-ms13-${layout}`, {
    terrainShape: layout,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    islandCount: layout === TerrainShape.Archipelago ? 4 : 2,
    islandSpacingKilometers: 3,
  });
  const landTiles = world.tiles.filter((tile) => tile.water === WaterType.Land).length;
  assert(world.metadata.terrainShape === layout, `${layout} was not retained in metadata.`);
  assert(landTiles > 100, `${layout} did not generate enough usable land.`);
  if (layout === TerrainShape.Archipelago) assert(world.metadata.targetIslandCount === 4, 'Archipelago island count was not retained.');
  if (layout === TerrainShape.TwinIslands) assert(world.metadata.targetIslandCount === 2, 'Twin Islands was not fixed to two islands.');
  results.push({ layout, landTiles, detectedIslands: world.islands.length, settlements: world.settlements.length });
}

const small = results.find((item) => item.layout === TerrainShape.SingleSmallIsland)!;
const medium = results.find((item) => item.layout === TerrainShape.SingleMediumIsland)!;
const large = results.find((item) => item.layout === TerrainShape.SingleLargeIsland)!;
assert(small.landTiles < medium.landTiles && medium.landTiles < large.landTiles, 'Single-island size presets do not increase land area in order.');

console.log(JSON.stringify({ layouts: results }, null, 2));
