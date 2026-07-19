import type { Random } from './Random';

const STRETCH_CONSTANT_2D = -0.211324865405187;
const SQUISH_CONSTANT_2D = 0.366025403784439;
const NORM_CONSTANT_2D = 47;

const GRADIENTS_2D = new Int8Array([
  5, 2,
  2, 5,
  -5, 2,
  -2, 5,
  5, -2,
  2, -5,
  -5, -2,
  -2, -5,
]);

function fastFloor(value: number): number {
  const integer = Math.trunc(value);
  return value < integer ? integer - 1 : integer;
}

export class OpenSimplexNoise2D {
  private readonly permutation = new Uint8Array(256);
  private readonly gradientIndex = new Uint8Array(256);

  public constructor(random: Random) {
    const source = Array.from({ length: 256 }, (_, index) => index);
    const shuffled = random.shuffle(source);

    for (let index = 0; index < 256; index += 1) {
      const value = shuffled[index];
      if (value === undefined) {
        throw new Error('OpenSimplex permutation initialization failed.');
      }

      this.permutation[index] = value;
      this.gradientIndex[index] = (value % (GRADIENTS_2D.length / 2)) * 2;
    }
  }

  public sample(x: number, y: number): number {
    const stretchOffset = (x + y) * STRETCH_CONSTANT_2D;
    const stretchedX = x + stretchOffset;
    const stretchedY = y + stretchOffset;

    let simplexX = fastFloor(stretchedX);
    let simplexY = fastFloor(stretchedY);

    const squishOffset = (simplexX + simplexY) * SQUISH_CONSTANT_2D;
    const originX = simplexX + squishOffset;
    const originY = simplexY + squishOffset;

    const xInside = stretchedX - simplexX;
    const yInside = stretchedY - simplexY;
    const insideSum = xInside + yInside;

    let deltaX0 = x - originX;
    let deltaY0 = y - originY;

    let extraSimplexX: number;
    let extraSimplexY: number;
    let extraDeltaX: number;
    let extraDeltaY: number;
    let value = 0;

    const deltaX1 = deltaX0 - 1 - SQUISH_CONSTANT_2D;
    const deltaY1 = deltaY0 - SQUISH_CONSTANT_2D;
    let attenuation1 = 2 - deltaX1 * deltaX1 - deltaY1 * deltaY1;
    if (attenuation1 > 0) {
      attenuation1 *= attenuation1;
      value += attenuation1 * attenuation1 * this.extrapolate(simplexX + 1, simplexY, deltaX1, deltaY1);
    }

    const deltaX2 = deltaX0 - SQUISH_CONSTANT_2D;
    const deltaY2 = deltaY0 - 1 - SQUISH_CONSTANT_2D;
    let attenuation2 = 2 - deltaX2 * deltaX2 - deltaY2 * deltaY2;
    if (attenuation2 > 0) {
      attenuation2 *= attenuation2;
      value += attenuation2 * attenuation2 * this.extrapolate(simplexX, simplexY + 1, deltaX2, deltaY2);
    }

    if (insideSum <= 1) {
      const remaining = 1 - insideSum;

      if (remaining > xInside || remaining > yInside) {
        if (xInside > yInside) {
          extraSimplexX = simplexX + 1;
          extraSimplexY = simplexY - 1;
          extraDeltaX = deltaX0 - 1;
          extraDeltaY = deltaY0 + 1;
        } else {
          extraSimplexX = simplexX - 1;
          extraSimplexY = simplexY + 1;
          extraDeltaX = deltaX0 + 1;
          extraDeltaY = deltaY0 - 1;
        }
      } else {
        extraSimplexX = simplexX + 1;
        extraSimplexY = simplexY + 1;
        extraDeltaX = deltaX0 - 1 - 2 * SQUISH_CONSTANT_2D;
        extraDeltaY = deltaY0 - 1 - 2 * SQUISH_CONSTANT_2D;
      }

      let attenuation0 = 2 - deltaX0 * deltaX0 - deltaY0 * deltaY0;
      if (attenuation0 > 0) {
        attenuation0 *= attenuation0;
        value += attenuation0 * attenuation0 * this.extrapolate(simplexX, simplexY, deltaX0, deltaY0);
      }
    } else {
      const remaining = 2 - insideSum;

      if (remaining < xInside || remaining < yInside) {
        if (xInside > yInside) {
          extraSimplexX = simplexX + 2;
          extraSimplexY = simplexY;
          extraDeltaX = deltaX0 - 2 - 2 * SQUISH_CONSTANT_2D;
          extraDeltaY = deltaY0 - 2 * SQUISH_CONSTANT_2D;
        } else {
          extraSimplexX = simplexX;
          extraSimplexY = simplexY + 2;
          extraDeltaX = deltaX0 - 2 * SQUISH_CONSTANT_2D;
          extraDeltaY = deltaY0 - 2 - 2 * SQUISH_CONSTANT_2D;
        }
      } else {
        extraSimplexX = simplexX;
        extraSimplexY = simplexY;
        extraDeltaX = deltaX0;
        extraDeltaY = deltaY0;
      }

      simplexX += 1;
      simplexY += 1;
      deltaX0 = deltaX0 - 1 - 2 * SQUISH_CONSTANT_2D;
      deltaY0 = deltaY0 - 1 - 2 * SQUISH_CONSTANT_2D;

      let attenuation0 = 2 - deltaX0 * deltaX0 - deltaY0 * deltaY0;
      if (attenuation0 > 0) {
        attenuation0 *= attenuation0;
        value += attenuation0 * attenuation0 * this.extrapolate(simplexX, simplexY, deltaX0, deltaY0);
      }
    }

    let extraAttenuation = 2 - extraDeltaX * extraDeltaX - extraDeltaY * extraDeltaY;
    if (extraAttenuation > 0) {
      extraAttenuation *= extraAttenuation;
      value += extraAttenuation * extraAttenuation
        * this.extrapolate(extraSimplexX, extraSimplexY, extraDeltaX, extraDeltaY);
    }

    return value / NORM_CONSTANT_2D;
  }

  private extrapolate(simplexX: number, simplexY: number, deltaX: number, deltaY: number): number {
    const firstPermutation = this.permutation[simplexX & 0xff];
    if (firstPermutation === undefined) {
      throw new Error('OpenSimplex permutation lookup failed.');
    }

    const gradientOffset = this.gradientIndex[(firstPermutation + simplexY) & 0xff];
    if (gradientOffset === undefined) {
      throw new Error('OpenSimplex gradient lookup failed.');
    }

    const gradientX = GRADIENTS_2D[gradientOffset];
    const gradientY = GRADIENTS_2D[gradientOffset + 1];
    if (gradientX === undefined || gradientY === undefined) {
      throw new Error('OpenSimplex gradient index escaped the gradient table.');
    }

    return gradientX * deltaX + gradientY * deltaY;
  }
}
