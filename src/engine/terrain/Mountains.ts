import type { MountainConfig } from '../config/GenerationConfig';
import { clamp01, gaussian } from '../math/Scalar';
import type { Random } from '../rng/Random';
import type { World } from '../world/World';
import { Noise2D } from './Noise';

interface MountainPass {
  readonly x: number;
  readonly depth: number;
  readonly width: number;
}

interface RidgePoint {
  readonly x: number;
  readonly y: number;
}

interface VoronoiPoint {
  readonly x: number;
  readonly y: number;
}

function createPasses(config: MountainConfig, random: Random): readonly MountainPass[] {
  const passes: MountainPass[] = [];
  const segmentWidth = 1 / Math.max(1, config.passCount);

  for (let index = 0; index < config.passCount; index += 1) {
    const segmentStart = index * segmentWidth;
    passes.push({
      x: segmentStart + random.float(0.22, 0.78) * segmentWidth,
      depth: config.passDepth * random.float(0.82, 1.12),
      width: config.passWidth * random.float(0.8, 1.25),
    });
  }

  return passes;
}

function createRidgePoints(config: MountainConfig, random: Random): readonly RidgePoint[] {
  const points: RidgePoint[] = [];
  const count = Math.max(4, config.centerlineControlPoints);
  for (let index = 0; index < count; index += 1) {
    const x = index / (count - 1);
    const longWave = Math.sin(x * Math.PI * 2.1) * 0.016;
    points.push({
      x,
      y: 0.17 + longWave + random.float(-config.centerlineJitter, config.centerlineJitter),
    });
  }
  return points;
}

function catmullRom(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * b
    + (-a + c) * t
    + (2 * a - 5 * b + 4 * c - d) * t2
    + (-a + 3 * b - 3 * c + d) * t3
  );
}

function sampleRidgeCenterline(points: readonly RidgePoint[], x: number): number {
  const scaled = x * (points.length - 1);
  const segment = Math.min(points.length - 2, Math.max(0, Math.floor(scaled)));
  const t = scaled - segment;
  const p0 = points[Math.max(0, segment - 1)] ?? points[0];
  const p1 = points[segment];
  const p2 = points[segment + 1];
  const p3 = points[Math.min(points.length - 1, segment + 2)] ?? points[points.length - 1];
  if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) return 0.17;
  return catmullRom(p0.y, p1.y, p2.y, p3.y, t);
}

function ridgedMultifractal(
  noise: Noise2D,
  x: number,
  y: number,
  config: MountainConfig,
): number {
  let frequency = config.ridgeNoiseScale;
  let amplitude = 1;
  let weight = 1;
  let total = 0;
  let normalization = 0;

  for (let octave = 0; octave < config.ridgeOctaves; octave += 1) {
    let ridge = 1 - Math.abs(noise.noise2D(x * frequency, y * frequency));
    ridge = Math.pow(clamp01(ridge), config.ridgeSharpness);
    ridge *= weight;
    weight = clamp01(ridge * 1.9);
    total += ridge * amplitude;
    normalization += amplitude;
    amplitude *= config.ridgePersistence;
    frequency *= config.ridgeLacunarity;
  }

  return normalization <= 0 ? 0 : total / normalization;
}

function createVoronoiPoints(config: MountainConfig, random: Random): readonly VoronoiPoint[] {
  const points: VoronoiPoint[] = [];
  for (let index = 0; index < config.voronoiCellCount; index += 1) {
    points.push({
      x: random.float(-0.08, 1.08),
      y: random.float(0.02, 0.38),
    });
  }
  return points;
}

function voronoiRidge(points: readonly VoronoiPoint[], x: number, y: number): number {
  let first = Number.POSITIVE_INFINITY;
  let second = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < first) {
      second = first;
      first = distance;
    } else if (distance < second) {
      second = distance;
    }
  }
  const borderDistance = Math.max(0, second - first);
  return clamp01(1 - borderDistance * 12);
}

/**
 * Builds the authored northern range as a spline-shaped macro mask, then
 * adds ridged multifractal and Voronoi fault detail inside that mask.
 * This creates connected mountain chains rather than isolated noise bumps.
 */
export function applyNorthernMountainRange(
  world: World,
  config: MountainConfig,
  random: Random,
): void {
  const ridgeNoise = new Noise2D(random.fork('ridged-multifractal'));
  const points = createRidgePoints(config, random.fork('range-spline'));
  const voronoiPoints = createVoronoiPoints(config, random.fork('fault-cells'));
  const passes = createPasses(config, random.fork('passes'));
  const widthDenominator = Math.max(1, world.width - 1);
  const heightDenominator = Math.max(1, world.height - 1);

  for (const tile of world.tiles) {
    const normalizedX = tile.x / widthDenominator;
    const normalizedY = tile.y / heightDenominator;
    const centerline = sampleRidgeCenterline(points, normalizedX);
    const rangeMask = gaussian(normalizedY, centerline, config.ridgeWidth);
    const ridged = ridgedMultifractal(ridgeNoise, normalizedX, normalizedY, config);
    const faults = voronoiRidge(voronoiPoints, normalizedX, normalizedY);
    const ridgeDetail = ridged * (1 - config.voronoiInfluence) + faults * config.voronoiInfluence;

    let passCarving = 0;
    for (const pass of passes) {
      passCarving += gaussian(normalizedX, pass.x, pass.width)
        * gaussian(normalizedY, centerline, config.ridgeWidth * 0.72)
        * pass.depth;
    }

    const shoulder = gaussian(normalizedY, centerline + config.ridgeWidth * 0.72, config.ridgeWidth * 1.45) * 0.28;
    tile.elevation = clamp01(
      tile.elevation
      + rangeMask * ridgeDetail * config.ridgeStrength
      + shoulder * config.ridgeStrength
      - passCarving,
    );
    tile.bedElevation = tile.elevation;
  }
}
