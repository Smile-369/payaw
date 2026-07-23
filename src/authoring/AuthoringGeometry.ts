import type { AuthoringGeometry, AuthoringPoint } from './AuthoringLayer';

function bresenham(start: AuthoringPoint, end: AuthoringPoint): AuthoringPoint[] {
  let x0 = Math.round(start.x);
  let y0 = Math.round(start.y);
  const x1 = Math.round(end.x);
  const y1 = Math.round(end.y);
  const points: AuthoringPoint[] = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x0 += sx; }
    if (twice <= dx) { error += dx; y0 += sy; }
  }
  return points;
}

export function geometryPathPoints(geometry: AuthoringGeometry): readonly AuthoringPoint[] {
  if (geometry.kind === 'point') return [geometry.point];
  if (geometry.kind === 'circle') {
    const points: AuthoringPoint[] = [];
    const steps = Math.max(12, Math.ceil(geometry.radius * Math.PI * 2));
    for (let index = 0; index < steps; index += 1) {
      const angle = index / steps * Math.PI * 2;
      points.push({ x: geometry.center.x + Math.cos(angle) * geometry.radius, y: geometry.center.y + Math.sin(angle) * geometry.radius });
    }
    return points;
  }
  return geometry.points;
}

export function rasterizePolyline(points: readonly AuthoringPoint[]): readonly AuthoringPoint[] {
  const result: AuthoringPoint[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (start === undefined || end === undefined) continue;
    for (const point of bresenham(start, end)) {
      const key = `${point.x}:${point.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(point);
    }
  }
  return result;
}

export function rasterizeGeometryPath(geometry: AuthoringGeometry): readonly AuthoringPoint[] {
  if (geometry.kind === 'point') return [geometry.point];
  if (geometry.kind === 'circle') {
    const path = [...geometryPathPoints(geometry)];
    const first = path[0];
    return first === undefined ? [] : rasterizePolyline([...path, first]);
  }
  if (geometry.kind === 'polygon') {
    const first = geometry.points[0];
    return first === undefined ? [] : rasterizePolyline([...geometry.points, first]);
  }
  return rasterizePolyline(geometry.points);
}


export function transformAuthoringGeometry(
  geometry: AuthoringGeometry,
  rotation = 0,
  scale = 1,
): AuthoringGeometry {
  const safeScale = Math.max(0.01, scale);
  if (geometry.kind === 'point') return geometry;
  if (geometry.kind === 'circle') {
    return { kind: 'circle', center: geometry.center, radius: geometry.radius * safeScale };
  }
  if (geometry.points.length === 0) return geometry;
  const center = {
    x: geometry.points.reduce((sum, point) => sum + point.x, 0) / geometry.points.length,
    y: geometry.points.reduce((sum, point) => sum + point.y, 0) / geometry.points.length,
  };
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const points = geometry.points.map((point) => {
    const dx = (point.x - center.x) * safeScale;
    const dy = (point.y - center.y) * safeScale;
    return {
      x: center.x + dx * cosine - dy * sine,
      y: center.y + dx * sine + dy * cosine,
    };
  });
  return { kind: geometry.kind, points };
}
