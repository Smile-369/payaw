import type { WeatherCondition, WeatherState } from './SimulationTypes';

function hashUnit(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

const WEATHER_TABLE: Readonly<Record<WeatherCondition, Omit<WeatherState, 'condition' | 'authored'>>> = {
  clear: {
    intensity: 0,
    precipitationMmPerHour: 0,
    windKph: 8,
    visibilityKilometers: 18,
    roadSpeedMultiplier: 1,
    walkingSpeedMultiplier: 1,
    floodRiskDelta: 0,
  },
  cloudy: {
    intensity: 0.15,
    precipitationMmPerHour: 0,
    windKph: 12,
    visibilityKilometers: 14,
    roadSpeedMultiplier: 0.98,
    walkingSpeedMultiplier: 1,
    floodRiskDelta: 0,
  },
  rain: {
    intensity: 0.4,
    precipitationMmPerHour: 4,
    windKph: 18,
    visibilityKilometers: 8,
    roadSpeedMultiplier: 0.88,
    walkingSpeedMultiplier: 0.82,
    floodRiskDelta: 0.12,
  },
  'heavy-rain': {
    intensity: 0.68,
    precipitationMmPerHour: 16,
    windKph: 28,
    visibilityKilometers: 4,
    roadSpeedMultiplier: 0.72,
    walkingSpeedMultiplier: 0.64,
    floodRiskDelta: 0.28,
  },
  thunderstorm: {
    intensity: 0.84,
    precipitationMmPerHour: 28,
    windKph: 46,
    visibilityKilometers: 2.5,
    roadSpeedMultiplier: 0.58,
    walkingSpeedMultiplier: 0.48,
    floodRiskDelta: 0.42,
  },
  typhoon: {
    intensity: 1,
    precipitationMmPerHour: 48,
    windKph: 105,
    visibilityKilometers: 1,
    roadSpeedMultiplier: 0.38,
    walkingSpeedMultiplier: 0.3,
    floodRiskDelta: 0.7,
  },
};

function generatedCondition(seed: string, timestampMs: number): WeatherCondition {
  const date = new Date(timestampMs);
  const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  const hourBand = Math.floor(date.getUTCHours() / 3);
  const roll = hashUnit(`${seed}:weather:${dayKey}:${hourBand}`);
  const month = date.getUTCMonth();
  const wetSeason = month >= 4 && month <= 10;
  if (roll < (wetSeason ? 0.025 : 0.008)) return 'typhoon';
  if (roll < (wetSeason ? 0.11 : 0.035)) return 'thunderstorm';
  if (roll < (wetSeason ? 0.28 : 0.1)) return 'heavy-rain';
  if (roll < (wetSeason ? 0.55 : 0.28)) return 'rain';
  if (roll < 0.78) return 'cloudy';
  return 'clear';
}

export function simulateWeather(seed: string, timestampMs: number, override: WeatherCondition | null): WeatherState {
  const condition = override ?? generatedCondition(seed, timestampMs);
  return { condition, ...WEATHER_TABLE[condition], authored: override !== null };
}

export function weatherLabel(condition: WeatherCondition): string {
  return condition.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
