import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TownScale } from '../src/engine/generation/GenerationOptions';
import { BridgeType, type CustomBridgeDefinition } from '../src/engine/infrastructure/Bridge';
import { RoadType } from '../src/engine/infrastructure/Road';
import { WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function bridgeSnapshot(world: ReturnType<GenerationPipeline['generate']>): string {
  return JSON.stringify(world.bridges.map((bridge) => ({
    key: bridge.key,
    name: bridge.name,
    from: bridge.fromIslandId,
    to: bridge.toIslandId,
    start: bridge.startTileIndex,
    end: bridge.endTileIndex,
    type: bridge.type,
    roadClass: bridge.roadClass,
    width: bridge.deckWidth,
    clearance: bridge.clearance,
    deck: bridge.deckTileIndices,
    approaches: bridge.approachRoadIds,
    deckRoadId: bridge.deckRoadId,
  })));
}

const pipeline = new GenerationPipeline();
const seed = 'payaw-ms10-archipelago';
const options = { terrainShape: TerrainShape.Archipelago, townScale: TownScale.SemiUrban } as const;
const world = pipeline.generate(seed, options);
const repeated = pipeline.generate(seed, options);

assert(world.metadata.schemaVersion >= 10, 'Milestone 10 bridge schema was not exported.');
assert(world.bridges.length >= 1, 'Archipelago generation did not produce any bridges.');
assert(bridgeSnapshot(world) === bridgeSnapshot(repeated), 'Bridge generation is not deterministic.');

for (const bridge of world.bridges) {
  assert(bridge.fromIslandId !== bridge.toIslandId, `${bridge.name} connects an island to itself.`);
  assert(world.tiles[bridge.startTileIndex]?.islandId === bridge.fromIslandId, `${bridge.name} has an invalid start island.`);
  assert(world.tiles[bridge.endTileIndex]?.islandId === bridge.toIslandId, `${bridge.name} has an invalid end island.`);
  assert(bridge.deckTileIndices.length > 0, `${bridge.name} has no water deck.`);
  assert(bridge.deckRoadId !== null, `${bridge.name} has no deck road.`);
  assert(world.roads[bridge.deckRoadId]?.bridgeId === bridge.id, `${bridge.name} deck road does not reference the bridge.`);
  assert(bridge.approachRoadIds.length >= 1, `${bridge.name} has no approach road.`);
  assert(bridge.approachRoadIds.every((id) => world.roads[id]?.bridgeId === bridge.id), `${bridge.name} approach roads are not owned by the bridge.`);
  assert(world.islands[bridge.fromIslandId]?.bridgeIds.includes(bridge.id), `${bridge.name} is missing from its origin island.`);
  assert(world.islands[bridge.toIslandId]?.bridgeIds.includes(bridge.id), `${bridge.name} is missing from its destination island.`);
  for (const index of bridge.deckTileIndices) {
    const tile = world.tiles[index];
    assert(tile !== undefined && tile.water !== WaterType.Land && tile.bridge && tile.road, `${bridge.name} has an invalid deck tile.`);
  }
}

const first = world.bridges[0];
assert(first !== undefined, 'The bridge override test has no target.');
const edited = pipeline.generate(seed, {
  ...options,
  bridgeOverrides: [{
    key: first.key,
    name: 'Dandansoy Regional Bridge',
    type: BridgeType.HighwayBridge,
    roadClass: RoadType.Main,
    deckWidth: 2.1,
    clearance: 9,
    start: first.start,
    end: first.end,
    locked: true,
  }],
});
const editedBridge = edited.bridges.find((bridge) => bridge.key === first.key);
assert(editedBridge !== undefined, 'Edited bridge disappeared.');
assert(editedBridge.name === 'Dandansoy Regional Bridge', 'Bridge name override was not applied.');
assert(editedBridge.type === BridgeType.HighwayBridge && editedBridge.roadClass === RoadType.Main, 'Bridge type or road class override was not applied.');
assert(editedBridge.deckWidth === 2.1 && editedBridge.clearance === 9 && editedBridge.locked, 'Bridge physical overrides were not applied.');

const suppressed = pipeline.generate(seed, { ...options, bridgeOverrides: [{ key: first.key, suppressed: true }] });
assert(!suppressed.bridges.some((bridge) => bridge.key === first.key), 'Suppressed generated bridge was still produced.');

const fromIsland = world.islands[first.fromIslandId];
const toIsland = world.islands[first.toIslandId];
assert(fromIsland !== undefined && toIsland !== undefined, 'Custom bridge island lookup failed.');
const customDefinition: CustomBridgeDefinition = {
  key: 'bridge:custom:test-crossing',
  name: 'Test Custom Crossing',
  fromIslandKey: fromIsland.key,
  toIslandKey: toIsland.key,
  type: BridgeType.LocalBridge,
  roadClass: RoadType.Secondary,
  deckWidth: 1.25,
  clearance: 4,
  start: first.start,
  end: first.end,
  locked: true,
};
const custom = pipeline.generate(seed, { ...options, customBridges: [customDefinition] });
const customBridge = custom.bridges.find((bridge) => bridge.key === customDefinition.key);
assert(customBridge !== undefined, 'Custom bridge definition did not generate a bridge.');
assert(!customBridge.generated && customBridge.name === customDefinition.name, 'Custom bridge identity was not preserved.');
assert(custom.bridges.filter((bridge) => (
  (bridge.fromIslandId === customBridge.fromIslandId && bridge.toIslandId === customBridge.toIslandId)
  || (bridge.fromIslandId === customBridge.toIslandId && bridge.toIslandId === customBridge.fromIslandId)
)).length === 1, 'Automatic generation duplicated a custom island-pair bridge.');

const partial = pipeline.generate(seed, options);
pipeline.regenerateFrom(partial, 'bridges', {
  ...options,
  bridgeOverrides: [{ key: first.key, name: 'Partial Regeneration Bridge' }],
});
const full = pipeline.generate(seed, {
  ...options,
  bridgeOverrides: [{ key: first.key, name: 'Partial Regeneration Bridge' }],
});
assert(bridgeSnapshot(partial) === bridgeSnapshot(full), 'Partial bridge regeneration does not match a full generation.');

console.log(JSON.stringify({
  generationVersion: world.metadata.generationVersion,
  schemaVersion: world.metadata.schemaVersion,
  islands: world.islands.length,
  bridges: world.bridges.length,
  totalSpan: Number(world.bridges.reduce((sum, bridge) => sum + bridge.length, 0).toFixed(2)),
  types: world.bridges.map((bridge) => bridge.type),
  approachRoads: world.bridges.reduce((sum, bridge) => sum + bridge.approachRoadIds.length, 0),
  edited: editedBridge.name,
  suppressed: !suppressed.bridges.some((bridge) => bridge.key === first.key),
  custom: customBridge.name,
}, null, 2));
