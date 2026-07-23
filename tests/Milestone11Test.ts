import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TownScale } from '../src/engine/generation/GenerationOptions';
import { WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function portSnapshot(world: ReturnType<GenerationPipeline['generate']>): string {
  return JSON.stringify(world.ports.map((port) => ({
    key: port.key,
    island: port.islandId,
    tile: port.tileIndex,
    water: port.waterTileIndex,
    type: port.type,
    capacity: port.capacity,
    road: port.accessRoadId,
  })));
}

const pipeline = new GenerationPipeline();
const seed = 'payaw-ms11-coastal-reference-retirement';
const options = { terrainShape: TerrainShape.Archipelago, townScale: TownScale.SemiUrban } as const;
const world = pipeline.generate(seed, options);
const repeat = pipeline.generate(seed, options);

assert(world.ports.length >= 2, 'Archipelago generation did not create enough coastal reference ports.');
assert(portSnapshot(world) === portSnapshot(repeat), 'Coastal reference generation is not deterministic.');
assert(!Object.hasOwn(world, 'waterRoutes'), 'Retired water-route state returned to the generated world.');

for (const port of world.ports) {
  const land = world.tiles[port.tileIndex];
  const water = world.tiles[port.waterTileIndex];
  assert(land?.water === WaterType.Land && land.islandId === port.islandId, `${port.name} is not on its assigned island.`);
  assert(water?.water === WaterType.Ocean, `${port.name} has no valid ocean approach.`);
  assert(world.islands[port.islandId]?.portIds.includes(port.id), `${port.name} is missing from its island.`);
  assert(!Object.hasOwn(port, 'routeIds'), `${port.name} still owns obsolete water-route links.`);
}

console.log(JSON.stringify({
  generationVersion: world.metadata.generationVersion,
  schemaVersion: world.metadata.schemaVersion,
  islands: world.islands.length,
  ports: world.ports.length,
  waterRoutesRetired: true,
}, null, 2));
