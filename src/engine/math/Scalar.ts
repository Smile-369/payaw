export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function gaussian(value: number, center: number, radius: number): number {
  const normalized = (value - center) / Math.max(Number.EPSILON, radius);
  return Math.exp(-(normalized * normalized));
}
