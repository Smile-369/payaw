import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { DEFAULT_GENERATION_CONFIG } from '../src/engine/config/GenerationConfig';
import { TerrainShape, TownScale } from '../src/engine/generation/GenerationOptions';
import { PortType } from '../src/engine/infrastructure/Port';
import { TrafficProfile, TravelMode, collectTravelLocations, planTravel } from '../src/engine/travel/TravelPlanner';
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
assert(world.bridges.every((bridge) => bridge.length <= DEFAULT_GENERATION_CONFIG.bridges.maximumSpan), 'An automatic bridge exceeded the practical nearby-shore span.');

for (const port of world.ports) {
  const land = world.tiles[port.tileIndex];
  const water = world.tiles[port.waterTileIndex];
  assert(land?.water === WaterType.Land && land.islandId === port.islandId, `${port.name} is not on its assigned island.`);
  assert(water?.water === WaterType.Ocean, `${port.name} has no valid ocean approach.`);
  assert(world.islands[port.islandId]?.portIds.includes(port.id), `${port.name} is missing from its island.`);
  assert(!Object.hasOwn(port, 'routeIds'), `${port.name} still owns obsolete water-route links.`);
}

const settledIslands = world.islands.filter((island) => island.settlementIds.length > 0);
const unbridgedPair = settledIslands.flatMap((from, index) => settledIslands.slice(index + 1).map((to) => ({ from, to })))
  .find(({ from, to }) => !world.bridges.some((bridge) => (
    (bridge.fromIslandId === from.id && bridge.toIslandId === to.id)
    || (bridge.fromIslandId === to.id && bridge.toIslandId === from.id)
  )));
assert(unbridgedPair !== undefined, 'The archipelago fixture did not produce an isolated settled-island pair.');
const fromPort = world.ports.find((port) => port.islandId === unbridgedPair.from.id);
const toPort = world.ports.find((port) => port.islandId === unbridgedPair.to.id);
assert(fromPort?.type === PortType.BarangayJetty && toPort?.type === PortType.BarangayJetty, 'An isolated settled island did not receive passenger-boat access.');
const fromSettlement = world.settlements[unbridgedPair.from.settlementIds[0] ?? -1];
const toSettlement = world.settlements[unbridgedPair.to.settlementIds[0] ?? -1];
assert(fromSettlement !== undefined && toSettlement !== undefined, 'The isolated-island travel fixture has no settlements.');
const locations = collectTravelLocations(world);
const fromLocation = locations.find((location) => location.id === `settlement:${fromSettlement.key}`);
const toLocation = locations.find((location) => location.id === `settlement:${toSettlement.key}`);
assert(fromLocation !== undefined && toLocation !== undefined, 'Settlement travel locations were not created.');
const boatPlan = planTravel(world, fromLocation, toLocation, { mode: TravelMode.PublicTransport, trafficProfile: TrafficProfile.Normal });
assert(boatPlan.reachable && boatPlan.segments.some((segment) => segment.mode === 'boat'), 'Public transport did not route an isolated island crossing by passenger boat.');

console.log(JSON.stringify({
  generationVersion: world.metadata.generationVersion,
  schemaVersion: world.metadata.schemaVersion,
  islands: world.islands.length,
  ports: world.ports.length,
  passengerBoatRouting: true,
  waterRoutesRetired: true,
}, null, 2));
