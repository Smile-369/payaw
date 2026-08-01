import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';
import { DEFAULT_SIMULATION_TIMEZONE } from '../src/engine/simulation/SimulationClock';
import { WorldSimulation } from '../src/engine/simulation/WorldSimulation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main(): void {
  const world = new GenerationPipeline().generate('payaw-ms171-qa-fixes', {
    terrainShape: TerrainShape.Archipelago,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    islandCount: 4,
    islandSpacingKilometers: 2.5,
    satelliteSettlementCount: 4,
  });

  const beforeBoundary = new Date('2026-07-20T08:59:00+08:00').getTime();
  const boundary = new Date('2026-07-20T09:00:00+08:00').getTime();
  const simulation = new WorldSimulation(world, {
    time: { mode: 'manual', campaignTimestampMs: beforeBoundary, speed: 0, timezone: 'Asia/Manila' },
    weatherOverride: 'heavy-rain',
  }, beforeBoundary);

  const before = simulation.state();
  const firstNpcState = Object.values(before.npcs.entriesByNpcId)[0];
  assert(firstNpcState !== undefined, 'No NPC dynamic state was produced.');
  assert(firstNpcState.state === 'at-location', 'Milestone 19 should resolve authored NPC locations without autonomous commute simulation.');

  simulation.setTimestamp(boundary, boundary);
  const after = simulation.state().npcs.entriesByNpcId[firstNpcState.npcId];
  assert(after !== undefined, 'The NPC disappeared after the schedule boundary.');
  assert(after.state === 'at-location', 'NPC schedule resolution should remain author-driven at schedule boundaries.');
  assert(after.currentTileIndex === after.destinationTileIndex, 'Author-driven placement should resolve to one location, not an autonomous journey.');

  const firstRoad = world.roads[0];
  assert(firstRoad !== undefined, 'Test world generated no roads.');
  simulation.setWeatherOverride('typhoon', boundary);
  simulation.setInfrastructureOverride('road', firstRoad.id, 'closed', boundary);
  const saved = simulation.serialize();
  assert(saved.eventLog.length > 0, 'Simulation events were not serialized.');
  assert(saved.eventLog.some((event) => event.message.includes('Typhoon')), 'Weather override event was not retained in the saved event log.');

  const restored = new WorldSimulation(world, saved, boundary);
  assert(restored.state().eventLog.some((event) => event.id === saved.eventLog[0]?.id), 'Saved simulation events were not restored.');
  assert(restored.travelContext().closedRoadIds.has(firstRoad.id), 'Saved infrastructure overrides were not restored into routing.');

  const invalidTimezone = new WorldSimulation(world, {
    ...saved,
    time: { ...saved.time, timezone: 'Not/AZone' },
  }, boundary);
  assert(invalidTimezone.state().time.timezone === DEFAULT_SIMULATION_TIMEZONE, 'Invalid imported timezone did not fall back safely.');

  const bridge = world.bridges[0];
  if (bridge !== undefined) {
    invalidTimezone.setInfrastructureOverride('bridge', bridge.id, 'restricted', boundary);
    assert(invalidTimezone.travelContext().restrictedBridgeIds.has(bridge.id), 'Restricted bridge was not exposed to routing context.');
  }
  const port = world.ports[0];
  if (port !== undefined) {
    invalidTimezone.setInfrastructureOverride('port', port.id, 'restricted', boundary);
    assert(invalidTimezone.state().infrastructure.portStatusById[port.id] === 'restricted', 'Restricted port was not retained as a visible GM exception.');
  }

  invalidTimezone.clearEventLog();
  assert(invalidTimezone.state().eventLog.length === 0, 'Event log clear action did not clear the timeline.');

  console.log(JSON.stringify({
    npcId: firstNpcState.npcId,
    beforeState: firstNpcState.state,
    afterState: after.state,
    authorDrivenPlacement: true,
    serializedEvents: saved.eventLog.length,
    restoredTimezone: invalidTimezone.state().time.timezone,
    restrictedBridgeChecked: bridge !== undefined,
    restrictedPortChecked: port !== undefined,
    waterRoutesRetired: !Object.hasOwn(world, 'waterRoutes'),
  }, null, 2));
}

main();
