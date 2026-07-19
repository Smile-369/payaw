import type { AnchorConfig } from '../config/GenerationConfig';
import type { AnchorPositionOverride } from '../generation/GenerationOptions';
import type { Random } from '../rng/Random';
import type { World } from '../world/World';
import { AnchorType, type Anchor, type BuiltInAnchorOverride, type CustomAnchorDefinition } from './Anchor';
import { createAnchorRules, type AnchorRule } from './AnchorRules';

interface ScoredCandidate {
  readonly index: number;
  readonly score: number;
}

function isSeparated(world: World, index: number, placed: readonly Anchor[], minimumDistance: number): boolean {
  const tile = world.tiles[index];
  if (tile === undefined) return false;
  return placed.every((anchor) => Math.hypot(tile.x - anchor.x, tile.y - anchor.y) >= minimumDistance);
}

function selectCandidate(
  world: World,
  config: AnchorConfig,
  rule: AnchorRule,
  placed: readonly Anchor[],
  random: Random,
  allowedLand: ReadonlySet<number> | null,
): ScoredCandidate {
  const candidates: ScoredCandidate[] = [];
  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    if (allowedLand !== null && !allowedLand.has(index)) continue;
    if (tile === undefined || !isSeparated(world, index, placed, rule.minimumDistance)) continue;
    const baseScore = rule.score(tile, { world, config, placed });
    if (!Number.isFinite(baseScore)) continue;
    candidates.push({ index, score: baseScore + random.float(0, 0.012) });
  }
  candidates.sort((left, right) => right.score - left.score || left.index - right.index);
  const shortlist = candidates.slice(0, Math.min(config.candidateLimit, candidates.length));
  const selected = shortlist[0];
  if (selected !== undefined) return selected;

  // Extreme terrain profiles such as deltas and archipelagos may not contain a
  // tile satisfying the strict procedural airport rule. Keep generation usable
  // by selecting the safest, flattest separated tile on the town landmass.
  if (rule.type === AnchorType.Airport) {
    const fallback = world.tiles
      .map((tile, index) => ({ tile, index }))
      .filter(({ tile, index }) => tile.water === 'land' && !tile.river && (allowedLand === null || allowedLand.has(index)) && isSeparated(world, index, placed, Math.max(8, rule.minimumDistance * 0.5)))
      .map(({ tile, index }) => ({ index, score: (1 - tile.slope) * 0.62 + (1 - tile.floodRisk) * 0.28 + tile.accessibility * 0.10 }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0];
    if (fallback !== undefined) return fallback;
  }

  throw new Error(`No valid procedural location was found for anchor “${rule.name}”. Loosen one of its rules and try again.`);
}


function selectPositionOverride(
  world: World,
  rule: AnchorRule,
  placed: readonly Anchor[],
  allowedLand: ReadonlySet<number> | null,
  override: AnchorPositionOverride,
): ScoredCandidate {
  const x = Math.round(override.x);
  const y = Math.round(override.y);
  const tile = world.getTile(x, y);
  if (tile === undefined) {
    throw new Error(`Manual position for anchor “${rule.name}” is outside the map.`);
  }
  const index = y * world.width + x;
  if (tile.water !== 'land' || tile.river) {
    throw new Error(`Manual position for anchor “${rule.name}” must be on dry land.`);
  }
  if (allowedLand !== null && !allowedLand.has(index)) {
    throw new Error(`Manual position for anchor “${rule.name}” must be on the town plaza's connected landmass.`);
  }
  if (placed.some((anchor) => anchor.tileIndex === index)) {
    throw new Error(`Manual position for anchor “${rule.name}” overlaps another anchor.`);
  }
  return { index, score: 1 };
}

const LAND_DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

function collectConnectedLand(world: World, sourceIndex: number): Set<number> {
  const source = world.tiles[sourceIndex];
  if (source === undefined || source.water !== 'land') {
    throw new Error('The town-plaza anchor must begin on land.');
  }

  const connected = new Set<number>([sourceIndex]);
  const queue: number[] = [sourceIndex];
  let cursor = 0;

  while (cursor < queue.length) {
    const index = queue[cursor];
    cursor += 1;
    if (index === undefined) continue;
    const tile = world.tiles[index];
    if (tile === undefined) continue;

    for (const [offsetX, offsetY] of LAND_DIRECTIONS) {
      const neighbor = world.getTile(tile.x + offsetX, tile.y + offsetY);
      if (neighbor === undefined || neighbor.water !== 'land') continue;
      const neighborIndex = neighbor.y * world.width + neighbor.x;
      if (connected.has(neighborIndex)) continue;
      connected.add(neighborIndex);
      queue.push(neighborIndex);
    }
  }

  return connected;
}

export function generateAnchors(
  world: World,
  config: AnchorConfig,
  random: Random,
  customAnchors: readonly CustomAnchorDefinition[] = [],
  builtInOverrides: readonly BuiltInAnchorOverride[] = [],
  positionOverrides: readonly AnchorPositionOverride[] = [],
): void {
  const placed: Anchor[] = [];
  const rules = createAnchorRules(config, customAnchors, builtInOverrides);
  const primaryIsland = world.islands.find((island) => island.role === 'primary-settlement') ?? world.islands[0];
  const primaryLandmass = primaryIsland === undefined ? undefined : world.landmasses[primaryIsland.landmassId];
  let townLandmass: Set<number> | null = primaryLandmass === undefined ? null : new Set(primaryLandmass.tileIndices);

  for (const rule of rules) {
    const positionOverride = positionOverrides.find((override) => override.key === rule.key);
    const candidate = positionOverride === undefined
      ? selectCandidate(
        world,
        config,
        rule,
        placed,
        random.fork(rule.key),
        townLandmass,
      )
      : selectPositionOverride(world, rule, placed, townLandmass, positionOverride);
    const tile = world.tiles[candidate.index];
    if (tile === undefined) throw new Error('Anchor candidate referenced an invalid tile.');
    placed.push({
      id: placed.length,
      key: rule.key,
      type: rule.type,
      name: rule.name,
      source: rule.source,
      tileIndex: candidate.index,
      x: tile.x,
      y: tile.y,
      radius: rule.radius,
      placementScore: candidate.score,
      zoneType: rule.zoneType,
      customRule: rule.customRule,
      builtInOverride: rule.builtInOverride,
    });

    if (townLandmass === null && rule.type === AnchorType.TownPlaza) {
      townLandmass = collectConnectedLand(world, candidate.index);
    }
  }
  world.anchors = placed;
}
