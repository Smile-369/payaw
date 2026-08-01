import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';
import { liveClockSnapshot, npcSchedulePeriodForHour, positionNpcPopulationForPeriod } from '../src/engine/time/WorldClock';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main(): void {
  assert(npcSchedulePeriodForHour(6) === 'morning', '06:00 should be morning.');
  assert(npcSchedulePeriodForHour(12) === 'day', '12:00 should be day.');
  assert(npcSchedulePeriodForHour(19) === 'evening', '19:00 should be evening.');
  assert(npcSchedulePeriodForHour(2) === 'night', '02:00 should be night.');

  const snapshot = liveClockSnapshot(new Date(2026, 6, 20, 19, 5, 9), '24h');
  assert(snapshot.period === 'evening', 'Clock snapshot period is wrong.');
  assert(snapshot.timeText.includes('19') && snapshot.timeText.includes('05'), '24-hour live clock formatting failed.');

  const world = new GenerationPipeline().generate('payaw-ms16-2-clock', {
    terrainShape: TerrainShape.SingleLargeIsland,
    terrainSize: TerrainSize.Small,
    townScale: TownScale.SemiUrban,
    satelliteSettlementCount: 2,
  });
  assert(world.npcs.length > 0, 'Test world did not generate NPCs.');
  const morning = positionNpcPopulationForPeriod(world, world.npcs, 'morning');
  const day = positionNpcPopulationForPeriod(world, world.npcs, 'day');
  assert(morning.every((npc) => npc.schedule.some((entry) => entry.period === 'morning' && entry.tileIndex === npc.tileIndex)), 'Morning NPC positions do not follow schedules.');
  assert(day.every((npc) => npc.schedule.some((entry) => entry.period === 'day' && entry.tileIndex === npc.tileIndex)), 'Day NPC positions do not follow schedules.');

  console.log(JSON.stringify({
    clockPeriod: snapshot.period,
    clockText: snapshot.timeText,
    npcCount: world.npcs.length,
    morningMoved: morning.filter((npc, index) => npc.tileIndex !== day[index]?.tileIndex).length,
  }, null, 2));
}

main();
