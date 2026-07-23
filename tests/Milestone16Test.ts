import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';
import { TrafficProfile, TravelMode, collectTravelLocations, planTravelAlternatives, pointTravelLocation } from '../src/engine/travel/TravelPlanner';
import { NPCStatus } from '../src/engine/npc/NPC';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main(): void {
  const pipeline = new GenerationPipeline();
  const world = pipeline.generate('payaw-ms16-npc-routing', {
    terrainShape: TerrainShape.SingleLargeIsland,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    islandCount: 5,
    islandSpacingKilometers: 4,
    satelliteSettlementCount: 3,
  });

  assert(world.metadata.schemaVersion >= 16, 'Milestone 16-compatible schema is not exported.');
  assert(/^payaw-m(?:1[6-9]|2\d)-/.test(world.metadata.generationVersion), 'Milestone 16-or-later routing generation lineage is missing.');
  assert(world.npcs.length >= 12, 'NPC population was not generated.');
  assert(world.npcs.every((npc) => npc.name.length > 0 && npc.schedule.length === 4), 'Generated NPC records are incomplete.');
  assert(world.npcs.some((npc) => npc.relationships.length > 0), 'NPC relationships were not generated.');
  assert(world.npcs.every((npc) => Object.values(NPCStatus).includes(npc.status)), 'NPC status normalization failed.');

  const anchorDegree = new Map(world.anchors.map((anchor) => [anchor.id, 0]));
  for (const road of world.roads) {
    for (const anchorId of road.connectsAnchorIds) anchorDegree.set(anchorId, (anchorDegree.get(anchorId) ?? 0) + 1);
  }
  if (world.anchors.length >= 3) {
    assert(world.anchors.every((anchor) => (anchorDegree.get(anchor.id) ?? 0) >= 2), 'An anchor has fewer than two generated road approaches.');
  }

  const locations = collectTravelLocations(world);
  assert(locations.some((location) => location.kind === 'npc'), 'NPCs are not exposed to the travel calculator.');
  const pointA = pointTravelLocation(world, world.settlements[0]?.x ?? 0, world.settlements[0]?.y ?? 0, 'Point A');
  const pointB = pointTravelLocation(world, world.anchors[0]?.x ?? 1, world.anchors[0]?.y ?? 1, 'Point B');
  assert(pointA !== undefined && pointB !== undefined, 'Point A/B locations could not be created.');

  let bestAlternatives = 0;
  let sampleMinutes = 0;
  const candidates = locations.filter((location) => location.kind === 'anchor' || location.kind === 'settlement' || location.kind === 'npc').slice(0, 24);
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const from = candidates[left];
      const to = candidates[right];
      if (from === undefined || to === undefined) continue;
      const plans = planTravelAlternatives(world, from, to, { mode: TravelMode.Drive, trafficProfile: TrafficProfile.Normal }, 3);
      if (plans[0]?.reachable) {
        bestAlternatives = Math.max(bestAlternatives, plans.length);
        sampleMinutes = plans[0].durationMinutes;
      }
      if (bestAlternatives >= 2) break;
    }
    if (bestAlternatives >= 2) break;
  }
  assert(sampleMinutes > 0, 'Point-to-point driving time was not calculated.');
  assert(bestAlternatives >= 2, 'The routing engine did not expose an alternate forked road path.');

  console.log(JSON.stringify({
    schemaVersion: world.metadata.schemaVersion,
    generationVersion: world.metadata.generationVersion,
    npcCount: world.npcs.length,
    anchorCount: world.anchors.length,
    minimumAnchorDegree: Math.min(...anchorDegree.values()),
    travelLocations: locations.length,
    alternateRoutes: bestAlternatives,
    sampleDriveMinutes: Number(sampleMinutes.toFixed(2)),
  }, null, 2));
}

main();
