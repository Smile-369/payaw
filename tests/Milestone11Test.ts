import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TownScale } from '../src/engine/generation/GenerationOptions';
import { PortType, type CustomPortDefinition } from '../src/engine/infrastructure/Port';
import { VesselClass, WaterRouteType, type CustomWaterRouteDefinition } from '../src/engine/infrastructure/WaterRoute';
import { WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function snapshot(world: ReturnType<GenerationPipeline['generate']>): string {
  return JSON.stringify({
    ports: world.ports.map((port) => ({ key: port.key, island: port.islandId, tile: port.tileIndex, water: port.waterTileIndex, type: port.type, capacity: port.capacity, road: port.accessRoadId })),
    routes: world.waterRoutes.map((route) => ({ key: route.key, from: route.fromPortId, to: route.toPortId, type: route.type, vessel: route.vesselClass, path: route.tileIndices, time: route.estimatedTravelTimeMinutes, danger: route.dangerRating })),
  });
}

const pipeline = new GenerationPipeline();
const seed = 'payaw-ms10-archipelago';
const options = { terrainShape: TerrainShape.Archipelago, townScale: TownScale.SemiUrban } as const;
const world = pipeline.generate(seed, options);
const repeat = pipeline.generate(seed, options);

assert(world.metadata.schemaVersion >= 11, 'Milestone 11-compatible schema was not exported.');
assert(world.ports.length >= 2, 'Archipelago generation did not create enough ports.');
assert(world.waterRoutes.length >= 1, 'Archipelago generation did not create any water routes.');
assert(snapshot(world) === snapshot(repeat), 'Maritime generation is not deterministic.');

for (const port of world.ports) {
  const land = world.tiles[port.tileIndex];
  const water = world.tiles[port.waterTileIndex];
  assert(land?.water === WaterType.Land && land.islandId === port.islandId, `${port.name} is not on its assigned island.`);
  assert(water?.water === WaterType.Ocean, `${port.name} has no valid ocean approach.`);
  assert(world.islands[port.islandId]?.portIds.includes(port.id), `${port.name} is missing from its island.`);
}

for (const route of world.waterRoutes) {
  assert(route.fromPortId !== route.toPortId, `${route.name} connects a port to itself.`);
  assert(route.tileIndices.length >= 2, `${route.name} has no navigable path.`);
  assert(route.tileIndices.every((index) => world.tiles[index]?.water === WaterType.Ocean), `${route.name} crosses land.`);
  assert(route.estimatedTravelTimeMinutes > 0, `${route.name} has invalid travel time.`);
  assert(route.encounters.length >= 4, `${route.name} has no maritime encounter table.`);
  assert(world.ports[route.fromPortId]?.routeIds.includes(route.id), `${route.name} is missing from its origin port.`);
  assert(world.ports[route.toPortId]?.routeIds.includes(route.id), `${route.name} is missing from its destination port.`);
}

const firstPort = world.ports[0];
assert(firstPort !== undefined, 'Port override test has no port.');
const edited = pipeline.generate(seed, { ...options, portOverrides: [{ key: firstPort.key, name: 'Payaw International Ferry Terminal', type: PortType.FerryTerminal, capacity: 1200, locked: true }] });
const editedPort = edited.ports.find((port) => port.key === firstPort.key);
assert(editedPort?.name === 'Payaw International Ferry Terminal' && editedPort.capacity === 1200 && editedPort.locked, 'Port override was not applied.');

const firstRoute = world.waterRoutes[0];
assert(firstRoute !== undefined, 'Route override test has no route.');
const editedRouteWorld = pipeline.generate(seed, { ...options, waterRouteOverrides: [{ key: firstRoute.key, name: 'Dandansoy Night Ferry', type: WaterRouteType.StoryRoute, vesselClass: VesselClass.SmallBoat, estimatedTravelTimeMinutes: 77, dangerRating: 0.9, enabled: false, locked: true }] });
const editedRoute = editedRouteWorld.waterRoutes.find((route) => route.key === firstRoute.key);
assert(editedRoute?.name === 'Dandansoy Night Ferry' && editedRoute.estimatedTravelTimeMinutes === 77 && editedRoute.dangerRating === 0.9 && !editedRoute.enabled && editedRoute.locked, 'Water-route override was not applied.');

const sourceIsland = world.islands.find((island) => island.allowPorts && island.portIds.length > 0);
assert(sourceIsland !== undefined, 'No island is available for a custom port.');
const sourcePosition = world.ports[sourceIsland.portIds[0] ?? -1]?.position;
assert(sourcePosition !== undefined, 'Custom port source position is unavailable.');
const customPort: CustomPortDefinition = {
  key: 'port:custom:test',
  name: 'Test Story Jetty',
  islandKey: sourceIsland.key,
  type: PortType.BarangayJetty,
  capacity: 150,
  position: sourcePosition,
  locked: true,
};
const withCustomPort = pipeline.generate(seed, { ...options, customPorts: [customPort] });
assert(withCustomPort.ports.some((port) => port.key === customPort.key && !port.generated), 'Custom port was not generated.');

const routePorts = world.ports.slice(0, 2);
assert(routePorts.length === 2 && routePorts[0] !== undefined && routePorts[1] !== undefined, 'Custom route needs two ports.');
const customRoute: CustomWaterRouteDefinition = {
  key: 'water-route:custom:test',
  name: 'Test Custom Ferry',
  fromPortKey: routePorts[0].key,
  toPortKey: routePorts[1].key,
  type: WaterRouteType.PassengerFerry,
  vesselClass: VesselClass.Ferry,
  enabled: true,
  locked: true,
};
const withCustomRoute = pipeline.generate(seed, { ...options, customWaterRoutes: [customRoute] });
assert(withCustomRoute.waterRoutes.some((route) => route.key === customRoute.key && !route.generated), 'Custom water route was not generated.');

const partial = pipeline.generate(seed, options);
pipeline.regenerateFrom(partial, 'ports', { ...options, portOverrides: [{ key: firstPort.key, name: 'Partial Port' }] });
const full = pipeline.generate(seed, { ...options, portOverrides: [{ key: firstPort.key, name: 'Partial Port' }] });
assert(snapshot(partial) === snapshot(full), 'Partial maritime regeneration does not match full generation.');

console.log(JSON.stringify({
  generationVersion: world.metadata.generationVersion,
  schemaVersion: world.metadata.schemaVersion,
  islands: world.islands.length,
  bridges: world.bridges.length,
  ports: world.ports.length,
  routes: world.waterRoutes.length,
  passengerRoutes: world.waterRoutes.filter((route) => route.type === WaterRouteType.PassengerFerry).length,
  totalTravelMinutes: Math.round(world.waterRoutes.reduce((sum, route) => sum + route.estimatedTravelTimeMinutes, 0)),
  customPort: customPort.name,
  customRoute: customRoute.name,
}, null, 2));
