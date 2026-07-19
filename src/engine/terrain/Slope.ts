function sampleClamped(
  elevation: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const clampedX = Math.min(width - 1, Math.max(0, x));
  const clampedY = Math.min(height - 1, Math.max(0, y));
  return elevation[clampedY * width + clampedX] ?? 0;
}

export function calculateSlopeField(
  elevation: Float32Array,
  width: number,
  height: number,
): Float32Array {
  if (elevation.length !== width * height) {
    throw new Error('Elevation field dimensions do not match the world dimensions.');
  }

  const slopes = new Float32Array(elevation.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const deltaX = (
        sampleClamped(elevation, width, height, x + 1, y)
        - sampleClamped(elevation, width, height, x - 1, y)
      ) * 0.5;
      const deltaY = (
        sampleClamped(elevation, width, height, x, y + 1)
        - sampleClamped(elevation, width, height, x, y - 1)
      ) * 0.5;

      slopes[y * width + x] = Math.min(1, Math.hypot(deltaX, deltaY) * 9);
    }
  }

  return slopes;
}
