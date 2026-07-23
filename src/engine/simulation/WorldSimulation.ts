import type { World } from '../world/World';
import { EMPTY_NPC_LOCATION_AUTHORING, type NPCLocationAuthoringState } from '../../campaign/NPCLocationAuthoring';
import type { TravelContext } from '../travel/TravelPlanner';
import { npcSchedulePeriodForTimestamp } from '../time/WorldClock';
import { SimulationClock } from './SimulationClock';
import { NPCScheduleSystem } from './NPCScheduleSystem';
import { simulateWeather, weatherLabel } from './WeatherSystem';
import { simulateTraffic } from './TrafficSystem';
import { emptyInfrastructureStatus, setManualInfrastructureStatus, simulateInfrastructure } from './InfrastructureStatusSystem';
import { simulateVenues } from './VenueSystem';
import { simulateSupernatural } from './SupernaturalSystem';
import type {
  InfrastructureOperationalState,
  InfrastructureStatusState,
  SimulationClockMode,
  SimulationEvent,
  SimulationSpeed,
  StoredSimulationState,
  WeatherCondition,
  WorldSimulationState,
} from './SimulationTypes';

function eventId(timestampMs: number, category: SimulationEvent['category'], message: string): string {
  let hash = 0;
  for (let index = 0; index < message.length; index += 1) hash = Math.imul(hash ^ message.charCodeAt(index), 16777619);
  return `${timestampMs.toString(36)}-${category}-${(hash >>> 0).toString(36)}`;
}

function createEvent(
  timestampMs: number,
  category: SimulationEvent['category'],
  severity: SimulationEvent['severity'],
  message: string,
): SimulationEvent {
  return { id: eventId(timestampMs, category, message), timestampMs, category, severity, message };
}

function mergeEvents(next: readonly SimulationEvent[], existing: readonly SimulationEvent[]): readonly SimulationEvent[] {
  const seen = new Set<string>();
  const merged: SimulationEvent[] = [];
  for (const event of [...next, ...existing]) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
    if (merged.length >= 120) break;
  }
  return merged;
}

function statusIds(record: Readonly<Record<number, InfrastructureOperationalState>>, statuses: readonly InfrastructureOperationalState[]): Set<number> {
  const result = new Set<number>();
  for (const [key, value] of Object.entries(record)) if (statuses.includes(value)) result.add(Number(key));
  return result;
}

function infrastructureCounts(state: InfrastructureStatusState): { readonly unavailable: number; readonly restricted: number } {
  const all = [state.roadStatusById, state.bridgeStatusById, state.portStatusById];
  let unavailable = 0;
  let restricted = 0;
  for (const record of all) {
    for (const status of Object.values(record)) {
      if (status === 'closed' || status === 'flooded' || status === 'damaged') unavailable += 1;
      else if (status === 'restricted' || status === 'under-repair') restricted += 1;
    }
  }
  return { unavailable, restricted };
}

function venueProblemCount(state: WorldSimulationState['venues']): number {
  return Object.values(state.anchorStatusById).filter((status) => status !== 'open' && status !== 'closing-soon').length;
}

function npcProblemCount(state: WorldSimulationState['npcs']): number {
  return Object.values(state.entriesByNpcId).filter((entry) => entry.state === 'delayed' || entry.state === 'unable').length;
}

export class WorldSimulation {
  private world: World;
  private readonly clock: SimulationClock;
  private readonly npcSystem = new NPCScheduleSystem();
  private npcLocationAuthoring: NPCLocationAuthoringState = structuredClone(EMPTY_NPC_LOCATION_AUTHORING);
  private weatherOverride: WeatherCondition | null;
  private manualInfrastructure: InfrastructureStatusState;
  private stateValue: WorldSimulationState;
  private lastMinuteKey = Number.NaN;

  public constructor(world: World, stored?: Partial<StoredSimulationState>, nowMs = Date.now()) {
    this.world = world;
    this.clock = new SimulationClock(stored?.time, nowMs);
    this.weatherOverride = stored?.weatherOverride ?? null;
    const empty = emptyInfrastructureStatus();
    this.manualInfrastructure = {
      ...empty,
      manualRoadStatusById: stored?.manualRoadStatusById ?? {},
      manualBridgeStatusById: stored?.manualBridgeStatusById ?? {},
      manualPortStatusById: stored?.manualPortStatusById ?? {},
    };
    this.stateValue = {
      time: this.clock.snapshot(nowMs),
      weather: simulateWeather(world.seed, nowMs, this.weatherOverride),
      infrastructure: empty,
      venues: { anchorStatusById: {} },
      settlements: { levelBySettlementId: {}, aggregateTrafficMultiplier: 1, profileLabel: 'Normal' },
      npcs: { entriesByNpcId: {} },
      supernatural: { active: false, level: 'dormant', afterDark: false, witchingHour: false, stormAmplified: false },
      eventLog: stored?.eventLog ?? [],
      revision: 0,
    };
    this.tick(nowMs, true);
  }

  public state(): WorldSimulationState {
    return this.stateValue;
  }

  public currentTimestamp(nowMs = Date.now()): number {
    return this.clock.now(nowMs);
  }

  public setNpcLocationAuthoring(state: NPCLocationAuthoringState, nowMs = Date.now()): void {
    this.npcLocationAuthoring = structuredClone(state);
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public replaceWorld(world: World, nowMs = Date.now()): void {
    this.world = world;
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public setClockMode(mode: SimulationClockMode, nowMs = Date.now()): void {
    const previous = this.clock.snapshot(nowMs).mode;
    this.clock.setMode(mode, nowMs);
    if (previous !== mode) this.addEvent('time', 'info', `Clock mode changed to ${mode}.`, this.clock.now(nowMs));
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public setSpeed(speed: SimulationSpeed, nowMs = Date.now()): void {
    const previous = this.clock.snapshot(nowMs).speed;
    this.clock.setSpeed(speed, nowMs);
    const current = this.clock.snapshot(nowMs);
    if (previous !== current.speed) this.addEvent('time', 'info', current.speed === 0 ? 'Campaign clock paused.' : `Campaign speed changed to ${current.speed}×.`, current.campaignTimestampMs);
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public setTimestamp(timestampMs: number, nowMs = Date.now()): void {
    this.clock.setTimestamp(timestampMs, nowMs);
    this.addEvent('time', 'info', 'World date and time were set manually.', timestampMs);
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public setTimezone(timezone: string, nowMs = Date.now()): void {
    this.clock.setTimezone(timezone);
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public advanceMinutes(minutes: number, nowMs = Date.now()): void {
    this.clock.advanceMinutes(minutes, nowMs);
    const timestamp = this.clock.now(nowMs);
    const amount = Math.abs(minutes) >= 1440 && minutes % 1440 === 0
      ? `${minutes / 1440} day${Math.abs(minutes / 1440) === 1 ? '' : 's'}`
      : `${minutes} minute${Math.abs(minutes) === 1 ? '' : 's'}`;
    this.addEvent('time', 'info', `World time advanced by ${amount}.`, timestamp);
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public setWeatherOverride(condition: WeatherCondition | null, nowMs = Date.now()): void {
    if (this.weatherOverride !== condition) {
      this.weatherOverride = condition;
      this.addEvent('weather', 'info', condition === null ? 'Weather returned to deterministic simulation.' : `Weather override set to ${weatherLabel(condition)}.`, this.clock.now(nowMs));
    }
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public clearEventLog(): void {
    this.stateValue = { ...this.stateValue, eventLog: [] };
  }

  public setInfrastructureOverride(
    kind: 'road' | 'bridge' | 'port',
    id: number,
    status: InfrastructureOperationalState | null,
    nowMs = Date.now(),
  ): void {
    this.manualInfrastructure = setManualInfrastructureStatus(this.manualInfrastructure, kind, id, status);
    const label = kind === 'road'
      ? this.world.roads[id]?.name
      : kind === 'bridge'
        ? this.world.bridges[id]?.name
        : this.world.ports[id]?.name;
    this.addEvent(
      'infrastructure',
      status === 'closed' || status === 'flooded' || status === 'damaged' ? 'critical' : status === 'restricted' || status === 'under-repair' ? 'warning' : 'info',
      status === null ? `Cleared the manual override for ${label ?? `${kind} ${id}`}.` : `${label ?? `${kind} ${id}`} set to ${status.replace('-', ' ')}.`,
      this.clock.now(nowMs),
    );
    this.lastMinuteKey = Number.NaN;
    this.tick(nowMs, true);
  }

  public tick(nowMs = Date.now(), force = false): WorldSimulationState {
    const time = this.clock.snapshot(nowMs);
    const minuteKey = Math.floor(time.campaignTimestampMs / 60_000);
    if (!force && minuteKey === this.lastMinuteKey) return this.stateValue;
    this.lastMinuteKey = minuteKey;

    const previous = this.stateValue;
    const weather = simulateWeather(this.world.seed, time.campaignTimestampMs, this.weatherOverride);
    const traffic = simulateTraffic(this.world, time.campaignTimestampMs, time.timezone, weather);
    const infrastructure = simulateInfrastructure(this.world, weather, this.manualInfrastructure);
    const venues = simulateVenues(this.world, time.campaignTimestampMs, time.timezone, weather);
    const baseContext = this.contextFrom(infrastructure, traffic.trafficByRoadId, weather, previous.revision + 1, time.campaignTimestampMs, traffic.settlementActivity.profileLabel);
    const npcSnapshot = this.npcSystem.evaluate(this.world, time.campaignTimestampMs, time.timezone, baseContext, weather, this.npcLocationAuthoring);
    this.world.npcs = [...npcSnapshot.npcs];
    const supernatural = simulateSupernatural(time.campaignTimestampMs, time.timezone, weather);
    const nextEvents: SimulationEvent[] = [];

    if (previous.revision > 0 && previous.weather.condition !== weather.condition) {
      nextEvents.push(createEvent(
        time.campaignTimestampMs,
        'weather',
        weather.condition === 'typhoon' ? 'critical' : weather.intensity >= 0.68 ? 'warning' : 'info',
        `Weather changed to ${weatherLabel(weather.condition)}.`,
      ));
    }
    if (previous.revision > 0 && previous.settlements.profileLabel !== traffic.settlementActivity.profileLabel) {
      nextEvents.push(createEvent(
        time.campaignTimestampMs,
        'traffic',
        traffic.settlementActivity.aggregateTrafficMultiplier > 1.4 ? 'warning' : 'info',
        `${traffic.settlementActivity.profileLabel} traffic profile is active.`,
      ));
    }
    if (previous.revision > 0) {
      const beforeInfrastructure = infrastructureCounts(previous.infrastructure);
      const afterInfrastructure = infrastructureCounts(infrastructure);
      if (beforeInfrastructure.unavailable !== afterInfrastructure.unavailable || beforeInfrastructure.restricted !== afterInfrastructure.restricted) {
        nextEvents.push(createEvent(
          time.campaignTimestampMs,
          'infrastructure',
          afterInfrastructure.unavailable > 0 ? 'critical' : afterInfrastructure.restricted > 0 ? 'warning' : 'info',
          afterInfrastructure.unavailable === 0 && afterInfrastructure.restricted === 0
            ? 'All monitored infrastructure returned to normal operation.'
            : `${afterInfrastructure.unavailable} unavailable and ${afterInfrastructure.restricted} restricted infrastructure link${afterInfrastructure.unavailable + afterInfrastructure.restricted === 1 ? '' : 's'}.`,
        ));
      }
      const beforeVenues = venueProblemCount(previous.venues);
      const afterVenues = venueProblemCount(venues);
      if (beforeVenues !== afterVenues) {
        nextEvents.push(createEvent(
          time.campaignTimestampMs,
          'venue',
          afterVenues > 0 ? 'warning' : 'info',
          afterVenues === 0 ? 'All monitored venues are operating normally.' : `${afterVenues} venue${afterVenues === 1 ? '' : 's'} closed, evacuated, or in emergency operation.`,
        ));
      }
      const beforeNpcProblems = npcProblemCount(previous.npcs);
      const afterNpcProblems = npcProblemCount(npcSnapshot.dynamicState);
      if (beforeNpcProblems !== afterNpcProblems) {
        nextEvents.push(createEvent(
          time.campaignTimestampMs,
          'npc',
          afterNpcProblems > 0 ? 'warning' : 'info',
          afterNpcProblems === 0 ? 'All NPC schedule disruptions cleared.' : `${afterNpcProblems} NPC${afterNpcProblems === 1 ? '' : 's'} delayed or unable to reach a scheduled location.`,
        ));
      }
    }
    if (!previous.supernatural.witchingHour && supernatural.witchingHour) {
      nextEvents.push(createEvent(time.campaignTimestampMs, 'supernatural', 'critical', 'The 3 AM manifestation window has begun.'));
    } else if (previous.supernatural.witchingHour && !supernatural.witchingHour) {
      nextEvents.push(createEvent(time.campaignTimestampMs, 'supernatural', 'info', 'The 3 AM manifestation window has ended.'));
    }

    this.stateValue = {
      time,
      weather,
      infrastructure,
      venues,
      settlements: traffic.settlementActivity,
      npcs: npcSnapshot.dynamicState,
      supernatural,
      eventLog: mergeEvents(nextEvents.reverse(), previous.eventLog),
      revision: previous.revision + 1,
    };
    return this.stateValue;
  }

  public travelContext(): TravelContext {
    const state = this.stateValue;
    const traffic = simulateTraffic(this.world, state.time.campaignTimestampMs, state.time.timezone, state.weather);
    return this.contextFrom(
      state.infrastructure,
      traffic.trafficByRoadId,
      state.weather,
      state.revision,
      state.time.campaignTimestampMs,
      state.settlements.profileLabel,
    );
  }

  public serialize(): StoredSimulationState {
    const infrastructure = this.stateValue.infrastructure;
    return {
      time: this.clock.snapshot(),
      weatherOverride: this.weatherOverride,
      manualRoadStatusById: infrastructure.manualRoadStatusById,
      manualBridgeStatusById: infrastructure.manualBridgeStatusById,
      manualPortStatusById: infrastructure.manualPortStatusById,
      eventLog: this.stateValue.eventLog,
    };
  }

  private addEvent(
    category: SimulationEvent['category'],
    severity: SimulationEvent['severity'],
    message: string,
    timestampMs: number,
  ): void {
    const event = createEvent(timestampMs, category, severity, message);
    this.stateValue = { ...this.stateValue, eventLog: mergeEvents([event], this.stateValue.eventLog) };
  }

  private contextFrom(
    infrastructure: InfrastructureStatusState,
    trafficByRoadId: ReadonlyMap<number, number>,
    weather: WorldSimulationState['weather'],
    revision: number,
    timestampMs: number,
    trafficLabel: string,
  ): TravelContext {
    const closedRoadIds = statusIds(infrastructure.roadStatusById, ['closed', 'flooded', 'damaged']);
    const restrictedRoadIds = statusIds(infrastructure.roadStatusById, ['restricted', 'under-repair']);
    const closedBridgeIds = statusIds(infrastructure.bridgeStatusById, ['closed', 'flooded', 'damaged']);
    const restrictedBridgeIds = statusIds(infrastructure.bridgeStatusById, ['restricted', 'under-repair']);
    const reasons = [
      `${weatherLabel(weather.condition)} weather`,
      `${trafficLabel.toLocaleLowerCase()} traffic`,
    ];
    if (closedRoadIds.size > 0) reasons.push(`${closedRoadIds.size} road closure${closedRoadIds.size === 1 ? '' : 's'}`);
    if (restrictedBridgeIds.size > 0) reasons.push(`${restrictedBridgeIds.size} restricted bridge${restrictedBridgeIds.size === 1 ? '' : 's'}`);
    return {
      timestampMs,
      revision,
      trafficByRoadId,
      closedRoadIds,
      restrictedRoadIds,
      closedBridgeIds,
      restrictedBridgeIds,
      roadSpeedMultiplier: weather.roadSpeedMultiplier,
      walkingSpeedMultiplier: weather.walkingSpeedMultiplier,
      reasons,
    };
  }
}

export function simulationPeriodLabel(timestampMs: number, timezone = 'Asia/Manila'): string {
  return npcSchedulePeriodForTimestamp(timestampMs, timezone).toLocaleUpperCase();
}
