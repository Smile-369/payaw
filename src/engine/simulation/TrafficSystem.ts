import { RoadType } from '../infrastructure/Road';
import type { World } from '../world/World';
import type { SettlementActivityLevel, SettlementActivityState, WeatherState } from './SimulationTypes';

export interface TrafficSnapshot {
  readonly settlementActivity: SettlementActivityState;
  readonly trafficByRoadId: ReadonlyMap<number, number>;
}

export function hourInTimezone(timestampMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestampMs));
  return Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
}

function trafficProfile(hour: number): { readonly label: string; readonly multiplier: number; readonly activity: SettlementActivityLevel } {
  if (hour >= 5 && hour < 6) return { label: 'Predawn', multiplier: 0.72, activity: 'quiet' };
  if (hour >= 6 && hour < 9) return { label: 'Morning rush', multiplier: 1.55, activity: 'rush' };
  if (hour >= 9 && hour < 14) return { label: 'Midday', multiplier: 1.04, activity: 'normal' };
  if (hour >= 14 && hour < 17) return { label: 'School release', multiplier: 1.28, activity: 'busy' };
  if (hour >= 17 && hour < 20) return { label: 'Evening rush', multiplier: 1.68, activity: 'rush' };
  if (hour >= 20 && hour < 23) return { label: 'Evening', multiplier: 0.92, activity: 'normal' };
  return { label: 'Late night', multiplier: 0.58, activity: 'asleep' };
}

function roadClassMultiplier(type: RoadType): number {
  if (type === RoadType.Main) return 1.12;
  if (type === RoadType.Secondary) return 1;
  return 0.82;
}

export function simulateTraffic(world: World, timestampMs: number, timezone: string, weather: WeatherState): TrafficSnapshot {
  const hour = hourInTimezone(timestampMs, timezone);
  const profile = trafficProfile(hour);
  const weatherCongestion = 1 / Math.max(0.25, weather.roadSpeedMultiplier);
  const trafficByRoadId = new Map<number, number>();
  for (const road of world.roads) {
    const populationPressure = road.connectsSettlementIds.reduce((sum, id) => sum + (world.settlements[id]?.populationTarget ?? 0), 0);
    const demand = 1 + Math.min(0.55, Math.log10(Math.max(1, populationPressure)) * 0.08);
    trafficByRoadId.set(road.id, Math.max(0.45, profile.multiplier * roadClassMultiplier(road.type) * demand * weatherCongestion));
  }

  const levelBySettlementId: Record<number, SettlementActivityLevel> = {};
  for (const settlement of world.settlements) {
    const highPopulation = settlement.populationTarget >= 20_000;
    levelBySettlementId[settlement.id] = highPopulation && profile.activity === 'normal' ? 'busy' : profile.activity;
  }

  return {
    trafficByRoadId,
    settlementActivity: {
      levelBySettlementId,
      aggregateTrafficMultiplier: profile.multiplier * weatherCongestion,
      profileLabel: profile.label,
    },
  };
}
