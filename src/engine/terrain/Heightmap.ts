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

function shapeMask(profile: string, u: number, v: number, detail: number): number {
  switch (profile) {
    case 'archipelago': {
      // Intentionally separated macro masks. The previous broad overlapping
      // ellipses often eroded into one connected landmass, which defeated the
      // regional-island pipeline even though the silhouette looked varied.
      const islands = [
        ellipse(u, v, 0.31, 0.40, 0.22, 0.25),
        ellipse(u, v, 0.68, 0.29, 0.18, 0.16),
        ellipse(u, v, 0.58, 0.70, 0.20, 0.17),
        ellipse(u, v, 0.84, 0.62, 0.11, 0.14),
        ellipse(u, v, 0.16, 0.72, 0.12, 0.13),
      ];
      return Math.max(...islands) * 1.08 + detail * 0.045;
    }
    case 'twin-islands':
      return Math.max(
        ellipse(u, v, 0.28, 0.50, 0.235, 0.37),
        ellipse(u, v, 0.72, 0.48, 0.215, 0.33),
      ) * 1.02 + detail * 0.04;
    case 'peninsula': {
      const mainland = ellipse(u, v, 0.30, 0.48, 0.43, 0.50);
      const neck = ellipse(u, v, 0.67, 0.52, 0.34, 0.16);
      const cape = ellipse(u, v, 0.87, 0.56, 0.18, 0.24);
      return Math.max(mainland, neck * 0.86, cape * 0.90) + detail * 0.05;
    }
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
      const mask = shapeMask(profile, u, v, detail);
      const continentalLift = profile === 'inland' ? 0.18 : 0;
      elevation[y * width + x] = clamp01(base * 0.58 + mask * 0.58 + continentalLift - 0.20);
    }
  }

  return elevation;
}
