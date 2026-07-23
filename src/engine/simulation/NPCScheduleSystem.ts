import { resolveNpcPlacement, type NPCLocationAuthoringState } from '../../campaign/NPCLocationAuthoring';
import type { NPC } from '../npc/NPC';
import { npcSchedulePeriodForTimestamp } from '../time/WorldClock';
import type { TravelContext } from '../travel/TravelPlanner';
import type { World } from '../world/World';
import type { NPCDynamicState, NPCDynamicStateEntry, WeatherState } from './SimulationTypes';

export interface NPCScheduleSnapshot {
  readonly npcs: readonly NPC[];
  readonly dynamicState: NPCDynamicState;
}

/**
 * Milestone 19 treats schedules as authored continuity, not autonomous AI.
 * The resolver answers where an NPC should be and never simulates their commute.
 * Scene placements and GM temporary overrides always win over the weekly schedule.
 */
export class NPCScheduleSystem {
  public evaluate(
    world: World,
    timestampMs: number,
    timezone: string,
    _context: TravelContext,
    _weather: WeatherState,
    authoring: NPCLocationAuthoringState,
  ): NPCScheduleSnapshot {
    const period = npcSchedulePeriodForTimestamp(timestampMs, timezone);
    const entriesByNpcId: Record<number, NPCDynamicStateEntry> = {};
    const positioned = world.npcs.map((npc) => {
      const placement = resolveNpcPlacement(world, npc, authoring, timestampMs, timezone);
      const tile = world.tiles[placement.location.tileIndex] ?? world.tiles[npc.tileIndex];
      entriesByNpcId[npc.id] = {
        npcId: npc.id,
        state: 'at-location',
        schedulePeriod: period,
        currentTileIndex: placement.location.tileIndex,
        destinationTileIndex: placement.location.tileIndex,
        activity: placement.activity,
        estimatedArrivalTimestampMs: placement.untilMs,
        delayMinutes: 0,
      };
      return tile === undefined ? npc : { ...npc, tileIndex: placement.location.tileIndex, x: tile.x, y: tile.y };
    });
    return { npcs: positioned, dynamicState: { entriesByNpcId } };
  }
}
