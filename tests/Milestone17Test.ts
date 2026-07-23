import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';
import { WorldSimulation } from '../src/engine/simulation/WorldSimulation';
import { TrafficProfile, TravelMode, collectTravelLocations, planTravel } from '../src/engine/travel/TravelPlanner';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function findReachablePair(world: ReturnType<GenerationPipeline['generate']>) {
  const locations = collectTravelLocations(world).filter((location) => location.kind === 'settlement' || location.kind === 'anchor' || location.kind === 'npc');
  for (let left = 0; left < locations.length; left += 1) {
    for (let right = left + 1; right < locations.length; right += 1) {
      const from = locations[left];
      const to = locations[right];
      if (from === undefined || to === undefined) continue;
      const plan = planTravel(world, from, to, { mode: TravelMode.Drive, trafficProfile: TrafficProfile.Normal });
      if (plan.reachable && plan.durationMinutes > 0) return { from, to, plan };
    }
  }
  return undefined;
}

function main(): void {
  const world = new GenerationPipeline().generate('payaw-ms17-living-world', {
    terrainShape: TerrainShape.Archipelago,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    islandCount: 4,
    islandSpacingKilometers: 2.5,
    satelliteSettlementCount: 4,
  });
  assert(world.metadata.schemaVersion >= 17, 'Milestone 17 schema version is missing.');
  assert(
    world.metadata.generationVersion.startsWith('payaw-m17-')
      || world.metadata.generationVersion.startsWith('payaw-m18-')
      || world.metadata.generationVersion.startsWith('payaw-m20-'),
    'Milestone 17 generation version is missing.',
  );

  const start = new Date('2026-07-20T18:00:00+08:00').getTime();
  const simulation = new WorldSimulation(world, {
    time: { mode: 'campaign', campaignTimestampMs: start, speed: 1, timezone: 'Asia/Manila' },
    weatherOverride: 'clear',
  }, start);
  const initial = simulation.tick(start, true);
  assert(initial.time.mode === 'campaign', 'Campaign clock mode was not restored.');
  assert(initial.settlements.profileLabel === 'Evening rush', 'Metro-scale evening traffic profile was not selected.');
  assert(Object.keys(initial.npcs.entriesByNpcId).length === world.npcs.length, 'NPC dynamic schedules were not evaluated.');

  const pair = findReachablePair(world);
  assert(pair !== undefined, 'No reachable road pair was available for travel testing.');
  simulation.setWeatherOverride('rain', start);
  const rainy = simulation.state();
  const livePlan = planTravel(world, pair.from, pair.to, {
    mode: TravelMode.Drive,
    trafficProfile: TrafficProfile.Normal,
    context: simulation.travelContext(),
  });
  assert(livePlan.reachable, 'Rain unexpectedly made the sample route unreachable.');
  assert(livePlan.durationMinutes >= pair.plan.durationMinutes, 'Live rain and evening traffic did not increase travel time.');
  assert(livePlan.contextRevision !== undefined, 'Live route did not record its simulation revision.');

  const firstRoad = world.roads[0];
  assert(firstRoad !== undefined, 'Test world generated no roads.');
  simulation.setInfrastructureOverride('road', firstRoad.id, 'closed', start);
  assert(simulation.travelContext().closedRoadIds.has(firstRoad.id), 'Manual road closure was not exposed to routing.');

  const beforeAdvance = simulation.currentTimestamp(start);
  simulation.advanceMinutes(60, start);
  assert(simulation.currentTimestamp(start) === beforeAdvance + 60 * 60_000, 'Campaign clock did not advance by one hour.');

  simulation.setWeatherOverride('typhoon', start);
  const typhoon = simulation.state();
  assert(world.ports.length > 0, 'Archipelago test world generated no coastal reference ports.');
  const unavailablePorts = Object.values(typhoon.infrastructure.portStatusById).filter((status) => status === 'closed').length;
  assert(unavailablePorts === world.ports.length, 'Typhoon conditions did not close all exposed ports.');
  assert(typhoon.supernatural.stormAmplified, 'Storm-amplified supernatural state was not activated.');

  const stored = simulation.serialize();
  assert(stored.weatherOverride === 'typhoon', 'Simulation weather override did not serialize.');
  assert(stored.manualRoadStatusById[firstRoad.id] === 'closed', 'Manual closure did not serialize.');

  console.log(JSON.stringify({
    schemaVersion: world.metadata.schemaVersion,
    generationVersion: world.metadata.generationVersion,
    npcCount: world.npcs.length,
    trafficProfile: initial.settlements.profileLabel,
    normalTravelMinutes: Number(pair.plan.durationMinutes.toFixed(2)),
    liveTravelMinutes: Number(livePlan.durationMinutes.toFixed(2)),
    portsClosed: unavailablePorts,
    simulationRevision: rainy.revision,
  }, null, 2));
}

main();
