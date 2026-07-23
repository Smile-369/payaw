import type { NPC, NPCSchedulePeriod } from '../npc/NPC';
import type { World } from '../world/World';

export type ClockDisplayFormat = '12h' | '24h';

export interface LiveClockSnapshot {
  readonly date: Date;
  readonly period: NPCSchedulePeriod;
  readonly timeText: string;
  readonly dateText: string;
}

export function npcSchedulePeriodForHour(hour: number): NPCSchedulePeriod {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  if (normalized >= 5 && normalized < 9) return 'morning';
  if (normalized >= 9 && normalized < 18) return 'day';
  if (normalized >= 18 && normalized < 22) return 'evening';
  return 'night';
}

export function npcSchedulePeriodForDate(date: Date): NPCSchedulePeriod {
  return npcSchedulePeriodForHour(date.getHours());
}

export function hourInTimezone(timestampMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestampMs));
  return Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
}

export function npcSchedulePeriodForTimestamp(timestampMs: number, timezone: string): NPCSchedulePeriod {
  return npcSchedulePeriodForHour(hourInTimezone(timestampMs, timezone));
}

export function liveClockSnapshot(date = new Date(), format: ClockDisplayFormat = '12h'): LiveClockSnapshot {
  return {
    date,
    period: npcSchedulePeriodForDate(date),
    timeText: new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: format === '12h',
    }).format(date),
    dateText: new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date),
  };
}

export function npcScheduleEntryForPeriod(npc: NPC, period: NPCSchedulePeriod) {
  return npc.schedule.find((entry) => entry.period === period) ?? npc.schedule[0];
}

export function positionNpcForPeriod(world: World, npc: NPC, period: NPCSchedulePeriod): NPC {
  const entry = npcScheduleEntryForPeriod(npc, period);
  if (entry === undefined) return npc;
  const tile = world.tiles[entry.tileIndex];
  if (tile === undefined) return npc;
  return { ...npc, tileIndex: entry.tileIndex, x: tile.x, y: tile.y };
}

export function positionNpcPopulationForPeriod(
  world: World,
  npcs: readonly NPC[],
  period: NPCSchedulePeriod,
): NPC[] {
  return npcs.map((npc) => positionNpcForPeriod(world, npc, period));
}
