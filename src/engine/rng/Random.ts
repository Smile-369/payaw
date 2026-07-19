/**
 * Deterministic seeded RNG used by every generation subsystem.
 *
 * Algorithm: cyrb53 string hashing feeding mulberry32. Forks are derived
 * from the original seed string, never the current mutable state, so a
 * subsystem can consume additional random values without perturbing any
 * other subsystem's output.
 */
export interface Random {
  next(): number;
  nextUint32(): number;
  float(min?: number, max?: number): number;
  int(min: number, maxInclusive: number): number;
  chance(probability: number): boolean;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
  fork(namespace: string): Random;
}

function cyrb53(value: string, seed = 0): number {
  let hash1 = 0xdeadbeef ^ seed;
  let hash2 = 0x41c6ce57 ^ seed;

  for (let index = 0; index < value.length; index += 1) {
    const character = value.charCodeAt(index);
    hash1 = Math.imul(hash1 ^ character, 2654435761);
    hash2 = Math.imul(hash2 ^ character, 1597334677);
  }

  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507);
  hash1 ^= Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507);
  hash2 ^= Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & hash2) + (hash1 >>> 0);
}

export class SeededRandom implements Random {
  private readonly rootSeed: string;
  private state: number;

  public constructor(seed: string | number) {
    this.rootSeed = String(seed);
    this.state = cyrb53(this.rootSeed) >>> 0;
  }

  public nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let value = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return (value ^ (value >>> 14)) >>> 0;
  }

  public next(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  public float(min = 0, max = 1): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new RangeError(`Invalid float range: ${min}..${max}`);
    }

    return min + (max - min) * this.next();
  }

  public int(min: number, maxInclusive: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(maxInclusive) || maxInclusive < min) {
      throw new RangeError(`Invalid integer range: ${min}..${maxInclusive}`);
    }

    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  public chance(probability: number): boolean {
    if (probability < 0 || probability > 1) {
      throw new RangeError(`Probability must be between 0 and 1. Received ${probability}.`);
    }

    return this.next() < probability;
  }

  public pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new RangeError('Cannot pick from an empty collection.');
    }

    const value = values[this.int(0, values.length - 1)];
    if (value === undefined) {
      throw new Error('Random selection failed unexpectedly.');
    }

    return value;
  }

  public shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];

    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = this.int(0, index);
      const currentValue = result[index];
      const targetValue = result[target];
      if (currentValue === undefined || targetValue === undefined) {
        throw new Error('Shuffle index escaped the collection bounds.');
      }
      result[index] = targetValue;
      result[target] = currentValue;
    }

    return result;
  }

  public fork(namespace: string): Random {
    if (namespace.length === 0) {
      throw new Error('Random stream namespaces must not be empty.');
    }

    return new SeededRandom(`${this.rootSeed}::${namespace}`);
  }
}
