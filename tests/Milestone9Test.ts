import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TownScale } from '../src/engine/generation/GenerationOptions';
import { DevelopmentLevel, IslandRole } from '../src/engine/regional/Island';
import { WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function regionalSnapshot(world: ReturnType<GenerationPipeline['generate']>): string {
  return JSON.stringify({
    landmasses: world.landmasses.map((landmass) => ({
      key: landmass.key,
      area: landmass.area,
      coast: landmass.coastlineLength,
      centroid: landmass.centroid,
      buildable: landmass.buildableArea,
    })),
    islands: world.islands.map((island) => ({
      key: island.key,
      landmassId: island.landmassId,
      name: island.name,
      role: island.role,
      development: island.developmentLevel,
      capacity: island.populationCapacity,
      population: island.allocatedPopulation,
      settlements: island.settlementIds,
    })),
    settlements: world.settlements.map((settlement) => ({
      key: settlement.key,
      islandId: settlement.islandId,
      name: settlement.name,
      type: settlement.type,
      tileIndex: settlement.tileIndex,
      population: settlement.populationTarget,
      roads: settlement.roadIds,
    })),
    roads: world.roads.map((road) => ({
      type: road.type,
      length: road.length,
      settlements: road.connectsSettlementIds,
      start: road.path[0],
      end: road.path[road.path.length - 1],
    })),
    blockCount: world.blocks.length,
  });
}

const pipeline = new GenerationPipeline();
const seed = 'payaw-ms9-archipelago';
const options = {
  terrainShape: TerrainShape.Archipelago,
  townScale: TownScale.SemiUrban,
} as const;

const world = pipeline.generate(seed, options);
const repeated = pipeline.generate(seed, options);

assert(world.metadata.schemaVersion >= 9, 'Regional schema version was not exported.');
assert(world.landmasses.length >= 3, `Archipelago generated only ${world.landmasses.length} physical landmasses.`);
assert(world.islands.length >= 3, `Archipelago promoted only ${world.islands.length} islands.`);
assert(world.settlements.length >= 2, 'Regional generation did not produce multiple settlements.');
assert(regionalSnapshot(world) === regionalSnapshot(repeated), 'Regional world generation is not deterministic.');

const landmassIds = new Set(world.landmasses.map((landmass) => landmass.id));
for (const tile of world.tiles) {
  if (tile.water === WaterType.Land) assert(tile.landmassId !== null, `Land tile ${tile.x},${tile.y} has no physical landmass.`);
}
for (const landmass of world.landmasses) {
  for (const tileIndex of landmass.tileIndices) {
    assert(world.tiles[tileIndex]?.landmassId === landmass.id, `Landmass ${landmass.key} contains a tile with a mismatched id.`);
  }
}

assert(world.islands.filter((island) => island.role === IslandRole.PrimarySettlement).length === 1, 'There must be exactly one primary-settlement island.');
for (const island of world.islands) {
  assert(landmassIds.has(island.landmassId), `${island.key} references a missing landmass.`);
  assert(island.allocatedPopulation >= 0, `${island.key} has negative population.`);
  assert(island.allocatedPopulation <= island.populationCapacity, `${island.key} exceeds its population capacity.`);
  const landmass = world.landmasses[island.landmassId];
  assert(landmass !== undefined, `${island.key} landmass lookup failed.`);
  for (const tileIndex of landmass.tileIndices) {
    assert(world.tiles[tileIndex]?.islandId === island.id, `${island.key} does not own all tiles of its landmass.`);
  }
  for (const settlementId of island.settlementIds) {
    assert(world.settlements[settlementId]?.islandId === island.id, `${island.key} references a settlement on another island.`);
  }
}

for (const settlement of world.settlements) {
  const center = world.tiles[settlement.tileIndex];
  assert(center !== undefined, `${settlement.key} center tile is missing.`);
  assert(center.islandId === settlement.islandId, `${settlement.key} is not on its assigned island.`);
  assert(world.islands[settlement.islandId]?.settlementIds.includes(settlement.id), `${settlement.key} is missing from its island settlement list.`);
  assert(settlement.populationTarget > 0, `${settlement.key} has no population target.`);
  assert(settlement.roadIds.length > 0, `${settlement.key} was not integrated into the road generator.`);
  assert(settlement.roadIds.every((roadId) => world.roads[roadId] !== undefined), `${settlement.key} references a missing road.`);
}

const secondary = world.islands.find((island) => island.role !== IslandRole.PrimarySettlement && (world.landmasses[island.landmassId]?.area ?? 0) >= 500);
assert(secondary !== undefined, 'No editable secondary island was generated for the override test.');
const overridden = pipeline.generate(seed, {
  ...options,
  islandOverrides: [{
    key: secondary.key,
    name: 'Isla Binagyo',
    role: IslandRole.RuralVillage,
    developmentLevel: DevelopmentLevel.Village,
    populationWeight: 2.5,
    settlementCount: 2,
    allowRoads: true,
    allowPorts: true,
    allowBridges: false,
    allowStoryPoints: false,
    preserveNature: false,
    locked: true,
  }],
});
const edited = overridden.islands.find((island) => island.key === secondary.key);
assert(edited !== undefined, 'The island override target disappeared after regeneration.');
assert(edited.name === 'Isla Binagyo', 'Island name override was not applied.');
assert(edited.role === IslandRole.RuralVillage, 'Island role override was not applied.');
assert(edited.developmentLevel === DevelopmentLevel.Village, 'Island development override was not applied.');
assert(edited.populationWeight === 2.5, 'Island population weight override was not applied.');
assert(edited.settlementCountTarget === 2, 'Island settlement-count override was not applied.');
assert(edited.allowPorts && !edited.allowBridges && !edited.allowStoryPoints && edited.locked, 'Island capability overrides were not preserved.');
assert(edited.settlementIds.length === 2, 'The overridden island did not generate the requested settlement count.');

const totalPopulation = world.islands.reduce((sum, island) => sum + island.allocatedPopulation, 0);
console.log(JSON.stringify({
  generationVersion: world.metadata.generationVersion,
  schemaVersion: world.metadata.schemaVersion,
  shape: world.metadata.terrainShape,
  landmasses: world.landmasses.length,
  islands: world.islands.length,
  settlements: world.settlements.length,
  totalPopulation,
  roads: world.roads.length,
  blocks: world.blocks.length,
  roles: world.islands.map((island) => island.role),
  override: {
    key: edited.key,
    name: edited.name,
    role: edited.role,
    settlements: edited.settlementIds.length,
    allowPorts: edited.allowPorts,
    allowBridges: edited.allowBridges,
  },
}, null, 2));
