import type { Random } from '../rng/Random';

/**
 * Deterministic, seedable 2D gradient noise (classic Simplex Noise,
 * Gustavson's algorithm). Vendored rather than pulled from npm, per
 * architecture doc §9: keeps determinism fully under our control and
 * avoids an upstream dependency bump silently changing seed output.
 *
 * Naming note: this is "Simplex Noise", the well-documented predecessor
 * to Ken Perlin's later, patent-free "OpenSimplex" family. It's simpler
 * to vendor correctly and is terrain-quality. If directional grid
 * artifacts ever become visible at higher zoom, swap this module for a
 * true OpenSimplex2 implementation — nothing outside this file needs to
 * change, since callers only see `noise2D` / `fbm2D`.
 */
export class Noise2D {
  private readonly perm: Uint8Array;
  private readonly permMod12: Uint8Array;

  private static readonly GRAD3: ReadonlyArray<readonly [number, number]> = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [1, 0], [-1, 0],
    [0, 1], [0, -1], [0, 1], [0, -1],
  ];

  private static readonly F2 = 0.5 * (Math.sqrt(3) - 1);
  private static readonly G2 = (3 - Math.sqrt(3)) / 6;

  /** Permutation table is derived from the given seeded RNG — never Math.random. */
  constructor(rng: Random) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle using the seeded RNG.
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      const tmp = p[i] as number;
      p[i] = p[j] as number;
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255] as number;
      this.permMod12[i] = (this.perm[i] as number) % 12;
    }
  }

  /** Single-octave simplex noise, output in [-1, 1]. */
  noise2D(xin: number, yin: number): number {
    const { F2, G2, GRAD3 } = Noise2D;
    const perm = this.perm;
    const permMod12 = this.permMod12;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1: number;
    let j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = permMod12[(ii + (perm[jj] as number)) as number] as number;
    const gi1 = permMod12[(ii + i1 + (perm[(jj + j1) as number] as number)) as number] as number;
    const gi2 = permMod12[(ii + 1 + (perm[(jj + 1) as number] as number)) as number] as number;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const g = GRAD3[gi0] as readonly [number, number];
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const g = GRAD3[gi1] as readonly [number, number];
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const g = GRAD3[gi2] as readonly [number, number];
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }

    return 70 * (n0 + n1 + n2);
  }

  /** Layered fractal Brownian motion, output normalized to [0, 1]. */
  fbm2D(
    x: number,
    y: number,
    octaves: number,
    persistence: number,
    lacunarity: number,
    scale: number,
  ): number {
    let amplitude = 1;
    let frequency = 1 / scale;
    let sum = 0;
    let maxAmplitude = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return (sum / maxAmplitude) * 0.5 + 0.5;
  }
}
