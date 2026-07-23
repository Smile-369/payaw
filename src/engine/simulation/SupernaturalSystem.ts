import type { SupernaturalState, WeatherState } from './SimulationTypes';
import { hourInTimezone } from './TrafficSystem';

export function simulateSupernatural(timestampMs: number, timezone: string, weather: WeatherState): SupernaturalState {
  const hour = hourInTimezone(timestampMs, timezone);
  const afterDark = hour >= 18 || hour < 5;
  const witchingHour = hour === 3;
  const stormAmplified = weather.condition === 'thunderstorm' || weather.condition === 'typhoon';
  const active = afterDark || stormAmplified;
  const level = witchingHour
    ? 'peak'
    : afterDark && stormAmplified
      ? 'manifesting'
      : active
        ? 'uneasy'
        : 'dormant';
  return { active, level, afterDark, witchingHour, stormAmplified };
}
