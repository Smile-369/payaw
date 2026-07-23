import type { World } from '../world/World';
import type {
  InfrastructureOperationalState,
  InfrastructureStatusState,
  WeatherState,
} from './SimulationTypes';

function meanFloodRisk(world: World, indices: readonly number[]): number {
  if (indices.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const index of indices) {
    const tile = world.tiles[index];
    if (tile === undefined) continue;
    total += tile.floodRisk;
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

function derivedRoadStatus(world: World, roadId: number, weather: WeatherState): InfrastructureOperationalState {
  const road = world.roads[roadId];
  if (road === undefined) return 'open';
  const risk = meanFloodRisk(world, [...road.path, ...road.bridgeTiles]) + weather.floodRiskDelta;
  if (weather.condition === 'typhoon' && risk > 0.46) return 'closed';
  if ((weather.condition === 'thunderstorm' || weather.condition === 'typhoon') && risk > 0.35) return 'flooded';
  if ((weather.condition === 'heavy-rain' || weather.condition === 'thunderstorm') && risk > 0.28) return 'restricted';
  return 'open';
}

function statusRecord<T extends { readonly id: number }>(items: readonly T[], resolve: (item: T) => InfrastructureOperationalState): Record<number, InfrastructureOperationalState> {
  const result: Record<number, InfrastructureOperationalState> = {};
  for (const item of items) result[item.id] = resolve(item);
  return result;
}

export function emptyInfrastructureStatus(): InfrastructureStatusState {
  return {
    roadStatusById: {},
    bridgeStatusById: {},
    portStatusById: {},
    manualRoadStatusById: {},
    manualBridgeStatusById: {},
    manualPortStatusById: {},
  };
}

export function simulateInfrastructure(
  world: World,
  weather: WeatherState,
  manual: InfrastructureStatusState,
): InfrastructureStatusState {
  const roadStatusById = statusRecord(world.roads, (road) => manual.manualRoadStatusById[road.id] ?? derivedRoadStatus(world, road.id, weather));
  const bridgeStatusById = statusRecord(world.bridges, (bridge) => {
    const authored = manual.manualBridgeStatusById[bridge.id];
    if (authored !== undefined) return authored;
    if (weather.condition === 'typhoon') return bridge.type === 'long-span-bridge' ? 'restricted' : 'closed';
    if (weather.condition === 'thunderstorm' && bridge.clearance < 3) return 'restricted';
    return 'open';
  });
  const portStatusById = statusRecord(world.ports, (port) => {
    const authored = manual.manualPortStatusById[port.id];
    if (authored !== undefined) return authored;
    if (weather.condition === 'typhoon') return 'closed';
    if (weather.condition === 'thunderstorm' && port.waterDepth < 0.15) return 'restricted';
    return 'open';
  });
  return {
    roadStatusById,
    bridgeStatusById,
    portStatusById,
    manualRoadStatusById: manual.manualRoadStatusById,
    manualBridgeStatusById: manual.manualBridgeStatusById,
    manualPortStatusById: manual.manualPortStatusById,
  };
}

export function setManualInfrastructureStatus(
  state: InfrastructureStatusState,
  kind: 'road' | 'bridge' | 'port',
  id: number,
  status: InfrastructureOperationalState | null,
): InfrastructureStatusState {
  const field = kind === 'road'
    ? 'manualRoadStatusById'
    : kind === 'bridge'
      ? 'manualBridgeStatusById'
      : 'manualPortStatusById';
  const updated = { ...state[field] };
  if (status === null) delete updated[id];
  else updated[id] = status;
  return { ...state, [field]: updated };
}
