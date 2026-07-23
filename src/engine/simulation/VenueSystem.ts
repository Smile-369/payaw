import { AnchorType } from '../settlement/Anchor';
import type { World } from '../world/World';
import type { VenueOperationalState, VenueStatusState, WeatherState } from './SimulationTypes';
import { hourInTimezone } from './TrafficSystem';

function regularStatus(type: AnchorType, hour: number): VenueOperationalState {
  if (type === AnchorType.Hospital) return 'open';
  if (type === AnchorType.Airport || type === AnchorType.Port) return hour >= 5 && hour < 23 ? 'open' : 'closed';
  if (type === AnchorType.Market) return hour >= 5 && hour < 19 ? (hour >= 18 ? 'closing-soon' : 'open') : 'closed';
  if (type === AnchorType.School) return hour >= 6 && hour < 18 ? (hour >= 17 ? 'closing-soon' : 'open') : 'closed';
  if (type === AnchorType.Church) return hour >= 5 && hour < 21 ? 'open' : 'closed';
  if (type === AnchorType.TownPlaza) return hour >= 4 && hour < 24 ? 'open' : 'closed';
  if (type === AnchorType.RiceFields || type === AnchorType.Hacienda) return hour >= 5 && hour < 18 ? 'open' : 'closed';
  return hour >= 6 && hour < 22 ? 'open' : 'closed';
}

export function simulateVenues(world: World, timestampMs: number, timezone: string, weather: WeatherState): VenueStatusState {
  const hour = hourInTimezone(timestampMs, timezone);
  const anchorStatusById: Record<number, VenueOperationalState> = {};
  for (const anchor of world.anchors) {
    let status = regularStatus(anchor.type, hour);
    if (weather.condition === 'typhoon') {
      status = anchor.type === AnchorType.Hospital ? 'emergency-only' : anchor.type === AnchorType.Airport || anchor.type === AnchorType.Port ? 'closed' : 'evacuated';
    } else if (weather.condition === 'thunderstorm' && (anchor.type === AnchorType.RiceFields || anchor.type === AnchorType.TownPlaza)) {
      status = 'closed';
    }
    anchorStatusById[anchor.id] = status;
  }
  return { anchorStatusById };
}
