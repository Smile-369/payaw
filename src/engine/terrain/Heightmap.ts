import type { GenerationConfig } from '../config/GenerationConfig';
import type { Random } from '../rng/Random';
import { Noise2D } from './Noise';

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function ellipse(u: number, v: number, cx: number, cy: number, rx: number, ry: number): number {
  const dx = (u - cx) / rx;
  const dy = (v - cy) / ry;
  return clamp01(1 - Math.sqrt(dx * dx + dy * dy));
}

function islandMask(u: number, v: number): number {
  return Math.pow(ellipse(u, v, 0.52, 0.48, 0.50, 0.46), 0.72);
}

interface PlannedIsland {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly strength: number;
}

function plannedMask(u: number, v: number, plan: readonly PlannedIsland[]): number {
  let value = 0;
  for (const island of plan) {
    value = Math.max(value, Math.pow(ellipse(u, v, island.cx, island.cy, island.rx, island.ry), 0.72) * island.strength);
  }
  return value;
}

function tryPlanIslands(
  width: number,
  height: number,
  count: number,
  gapTiles: number,
  random: Random,
  twinProfile: boolean,
): PlannedIsland[] | undefined {
  const minimumDimension = Math.min(width, height);
  const countScale = Math.sqrt(5 / Math.max(2, count));
  const baseRadius = twinProfile
    ? Math.min(minimumDimension * 0.24, minimumDimension * 0.19 * countScale)
    : Math.max(13, Math.min(minimumDimension * 0.17, minimumDimension * 0.125 * countScale));
  const radii = Array.from({ length: count }, (_, index) => {
    const stream = random.fork(`radius-${index}`);
    const multiplier = index === 0
      ? (twinProfile ? 1.03 : 1.2)
      : stream.float(twinProfile ? 0.92 : 0.68, twinProfile ? 1.03 : 0.96);
    const rx = baseRadius * multiplier * stream.float(0.92, 1.12);
    const ry = baseRadius * multiplier * stream.float(0.82, 1.08);
    return { rx, ry };
  });

  const placed: Array<{ x: number; y: number; rx: number; ry: number }> = [];
  const primary = radii[0];
  if (primary === undefined) return [];
  placed.push({
    x: width * (0.46 + random.fork('primary').float(-0.035, 0.035)),
    y: height * (0.48 + random.fork('primary-y').float(-0.035, 0.035)),
    ...primary,
  });

  for (let index = 1; index < count; index += 1) {
    const radius = radii[index];
    if (radius === undefined) return undefined;
    let best: { x: number; y: number; score: number; edgeGap: number } | undefined;
    const stream = random.fork(`center-${index}`);
    const attempts = Math.max(900, count * 160);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const x = stream.float(radius.rx + 5, width - radius.rx - 5);
      const y = stream.float(radius.ry + 5, height - radius.ry - 5);
      let minimumEdgeGap = Number.POSITIVE_INFINITY;
      for (const other of placed) {
        const centerDistance = Math.hypot(x - other.x, y - other.y);
        const thisRadius = (radius.rx + radius.ry) * 0.5;
        const otherRadius = (other.rx + other.ry) * 0.5;
        minimumEdgeGap = Math.min(minimumEdgeGap, centerDistance - thisRadius - otherRadius);
      }
      const distanceFromRegionalCenter = Math.hypot(x - width * 0.5, y - height * 0.5);
      const reachesGap = minimumEdgeGap >= gapTiles;
      const score = reachesGap
        ? 10000 - Math.abs(minimumEdgeGap - gapTiles) * 4 - distanceFromRegionalCenter * 0.06
        : minimumEdgeGap;
      if (best === undefined || score > best.score) best = { x, y, score, edgeGap: minimumEdgeGap };
    }
    if (best === undefined || best.edgeGap < Math.max(1.5, gapTiles * 0.72)) return undefined;
    placed.push({ x: best.x, y: best.y, ...radius });
  }

  return placed.map((item, index): PlannedIsland => ({
    cx: item.x / width,
    cy: item.y / height,
    rx: item.rx / width,
    ry: item.ry / height,
    strength: index === 0 ? 1.16 : random.fork(`strength-${index}`).float(1.08, 1.15),
  }));
}

/**
 * Creates a deterministic archipelago plan. Requested spacing is treated as a
 * minimum coastline gap. If the requested count/gap cannot fit in the chosen
 * map extent, the gap is progressively reduced rather than silently dropping
 * islands, so island count remains the stronger authoring constraint.
 */
function createIslandPlan(width: number, height: number, config: GenerationConfig, random: Random): readonly PlannedIsland[] {
  const twinProfile = config.terrain.shapeProfile === 'twin-islands';
  const count = twinProfile ? 2 : Math.max(1, Math.min(12, Math.round(config.terrain.targetIslandCount)));
  const tileSizeKilometers = config.world.tileSizeMeters / 1000;
  const requestedGapTiles = config.terrain.islandSpacingKilometers / tileSizeKilometers;
  let gapTiles = requestedGapTiles;
  for (let pass = 0; pass < 10; pass += 1) {
    const plan = tryPlanIslands(width, height, count, gapTiles, random.fork(`layout-${pass}`), twinProfile);
    if (plan !== undefined) return plan;
    gapTiles *= 0.84;
  }
  const fallback = tryPlanIslands(width, height, count, 1.5, random.fork('layout-fallback'), twinProfile);
  if (fallback !== undefined) return fallback;
  throw new Error(`Could not fit ${count} generated islands inside ${width}×${height}. Reduce island count or spacing.`);
}

function shapeMask(
  profile: string,
  u: number,
  v: number,
  detail: number,
  islandPlan: readonly PlannedIsland[],
): number {
  switch (profile) {
    case 'single-small-island':
      return Math.pow(ellipse(u, v, 0.52, 0.49, 0.29, 0.26), 0.76) + detail * 0.04;
    case 'single-medium-island':
      return Math.pow(ellipse(u, v, 0.52, 0.49, 0.39, 0.35), 0.74) + detail * 0.045;
    case 'single-large-island':
      return Math.pow(ellipse(u, v, 0.52, 0.49, 0.49, 0.45), 0.72) + detail * 0.05;
    case 'archipelago':
    case 'twin-islands':
      return plannedMask(u, v, islandPlan) + detail * 0.028;
    case 'peninsula': {
      const mainland = ellipse(u, v, 0.30, 0.48, 0.43, 0.50);
      const neck = ellipse(u, v, 0.67, 0.52, 0.34, 0.16);
      const cape = ellipse(u, v, 0.87, 0.56, 0.18, 0.24);
      return Math.max(mainland, neck * 0.86, cape * 0.90) + detail * 0.05;
    }
    case 'inland-coast': {
      // A mainland region entering from the east, leaving one broad western coast.
      const coastLine = clamp01((u - 0.15 + detail * 0.08) * 2.15);
      const coastalBays = ellipse(u, v, 0.58, 0.50, 0.68, 0.62);
      return clamp01(Math.min(coastLine, coastalBays * 1.15) + detail * 0.035);
    }
    case 'delta': {
      const mainland = clamp01((0.78 - v) * 1.65 + detail * 0.06);
      const fan = ellipse(u, v, 0.52, 0.72, 0.48, 0.34);
      return Math.max(mainland, fan * 0.74);
    }
    // Legacy project compatibility.
    case 'inland': {
      const continent = ellipse(u, v, 0.50, 0.50, 0.61, 0.58);
      return clamp01(continent * 1.08 + detail * 0.06);
    }
    case 'river-delta': {
      const mainland = clamp01((0.78 - v) * 1.65 + detail * 0.06);
      const fan = ellipse(u, v, 0.52, 0.72, 0.48, 0.34);
      return Math.max(mainland, fan * 0.74);
    }
    case 'atoll': {
      const outer = ellipse(u, v, 0.50, 0.50, 0.45, 0.39);
      const inner = ellipse(u, v, 0.50, 0.50, 0.27, 0.21);
      return clamp01((outer - inner * 1.35) * 1.65 + detail * 0.05);
    }
    case 'full-island':
    default:
      return islandMask(u, v);
  }
}

/** PAYAW authored bias retained for the default full-island preset. */
export function regionalBias(u: number, v: number): number {
  const northMountains = Math.max(0, 1 - v * 2.2);
  const southBay = -Math.max(0, (v - 0.65) * 2.6);
  const eastPeninsulaTaper = (u - 0.5) * 0.3;
  return northMountains * 0.35 + southBay * 0.4 + eastPeninsulaTaper;
}

export function generateElevationField(
  width: number,
  height: number,
  config: GenerationConfig,
  random: Random,
): Float32Array {
  const noise = new Noise2D(random);
  const macroNoise = new Noise2D(random.fork('shape-mask'));
  const elevation = new Float32Array(width * height);
  const noiseConfig = config.terrain.elevationNoise;
  const profile = config.terrain.shapeProfile;
  const islandPlan = profile === 'archipelago' || profile === 'twin-islands'
    ? createIslandPlan(width, height, config, random.fork('island-plan'))
    : [];

  for (let y = 0; y < height; y += 1) {
    const v = profile === 'full-island' ? y / height : y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = profile === 'full-island' ? x / width : x / Math.max(1, width - 1);
      const base = noise.fbm2D(x, y, noiseConfig.octaves, noiseConfig.persistence, noiseConfig.lacunarity, noiseConfig.scale);
      if (profile === 'full-island') {
        elevation[y * width + x] = clamp01(base + regionalBias(u, v));
        continue;
      }
      const detail = macroNoise.fbm2D(x, y, 3, 0.5, 2, noiseConfig.scale * 1.6) - 0.5;
      const mask = shapeMask(profile, u, v, detail, islandPlan);
      const continentalLift = profile === 'inland' ? 0.18 : 0;
      elevation[y * width + x] = clamp01(base * 0.58 + mask * 0.58 + continentalLift - 0.20);
    }
  }

  return elevation;
}
