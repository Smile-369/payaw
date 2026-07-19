import type { EntityNameOverride } from '../generation/GenerationOptions';
import { RoadType } from '../infrastructure/Road';
import type { Random } from '../rng/Random';
import type { World } from '../world/World';
import { ZoneType } from '../zoning/Zone';

const ROAD_ROOTS = [
  'Dandansoy', 'Mabini', 'Rizal', 'Bonifacio', 'Luna', 'Balete', 'Baybay', 'Hacienda',
  'Malipayon', 'Maharlika', 'Ilang-Ilang', 'Acacia', 'Narra', 'Molave', 'Sampaguita',
  'Katipunan', 'San Roque', 'San Isidro', 'Santa Clara', 'Magsaysay', 'Kamagong',
] as const;

const ROAD_SUFFIXES: Readonly<Record<RoadType, readonly string[]>> = {
  [RoadType.Main]: ['Road', 'Avenue', 'Highway'],
  [RoadType.Secondary]: ['Street', 'Road', 'Drive'],
  [RoadType.Local]: ['Lane', 'Calle', 'Extension'],
};

const ZONE_LABELS: Readonly<Record<ZoneType, string>> = {
  [ZoneType.Commercial]: 'Commerce',
  [ZoneType.Residential]: 'Residential',
  [ZoneType.Industrial]: 'Works',
  [ZoneType.Agricultural]: 'Fields',
  [ZoneType.Institutional]: 'Civic',
  [ZoneType.Government]: 'Plaza',
  [ZoneType.Forest]: 'Woodland',
  [ZoneType.Mixed]: 'Mixed Use',
};

function overrideMap(values: readonly EntityNameOverride[]): ReadonlyMap<number, string> {
  return new Map(values
    .map((value) => ({ id: value.id, name: value.name.trim() }))
    .filter((value) => value.name.length > 0)
    .map((value) => [value.id, value.name]));
}

function uniqueName(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let suffix = 2;
  while (used.has(`${candidate} ${suffix}`)) suffix += 1;
  const result = `${candidate} ${suffix}`;
  used.add(result);
  return result;
}

function shortAnchorName(name: string): string {
  return name.replace(/\b(Town|Municipal|Public)\b/gi, '').replace(/\s+/g, ' ').trim();
}

function nearestAnchorName(world: World, x: number, y: number): string | undefined {
  const candidates = [
    ...world.anchors.map((anchor) => ({ name: anchor.name, x: anchor.x, y: anchor.y })),
    ...world.settlements.map((settlement) => ({ name: settlement.name, x: settlement.x, y: settlement.y })),
  ];
  return candidates.sort((left, right) => Math.hypot(left.x - x, left.y - y) - Math.hypot(right.x - x, right.y - y))[0]?.name;
}

export function nameWorldFeatures(
  world: World,
  random: Random,
  roadOverrides: readonly EntityNameOverride[],
  blockOverrides: readonly EntityNameOverride[],
): void {
  const roads = overrideMap(roadOverrides);
  const blocks = overrideMap(blockOverrides);
  const usedRoadNames = new Set<string>();

  for (const road of world.roads) {
    const override = roads.get(road.id);
    if (override !== undefined) {
      road.name = uniqueName(override, usedRoadNames);
      continue;
    }
    const bridge = road.bridgeId === null ? undefined : world.bridges[road.bridgeId];
    if (bridge !== undefined) {
      road.name = uniqueName(road.bridgeTiles.length > 0 ? bridge.name : `${bridge.name} Approach`, usedRoadNames);
      continue;
    }
    const connected = [
      ...road.connectsAnchorIds.map((id) => world.anchors[id]?.name),
      ...road.connectsSettlementIds.map((id) => world.settlements[id]?.name),
    ].filter((name): name is string => name !== undefined);
    const generated = road.type === RoadType.Main && connected.length >= 2
      ? `${shortAnchorName(connected[0] ?? 'Town')}–${shortAnchorName(connected[1] ?? 'Town')} Road`
      : `${random.fork(`road-${road.id}`).pick(ROAD_ROOTS)} ${random.fork(`road-suffix-${road.id}`).pick(ROAD_SUFFIXES[road.type])}`;
    road.name = uniqueName(generated, usedRoadNames);
  }

  const zoneCounters = new Map<string, number>();
  for (const block of world.blocks) {
    const override = blocks.get(block.id);
    if (override !== undefined) {
      block.name = override;
      continue;
    }
    const zoneType = block.zoneId === null ? undefined : world.zones[block.zoneId]?.type;
    const zoneLabel = zoneType === undefined ? 'Town' : ZONE_LABELS[zoneType];
    const anchorName = nearestAnchorName(world, block.centroid.x, block.centroid.y);
    const root = anchorName === undefined ? zoneLabel : `${shortAnchorName(anchorName)} ${zoneLabel}`;
    const count = (zoneCounters.get(root) ?? 0) + 1;
    zoneCounters.set(root, count);
    block.name = `${root} Block ${count}`;
  }
}
