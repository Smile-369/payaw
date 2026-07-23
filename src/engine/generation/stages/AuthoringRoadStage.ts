import { rasterizeGeometryPath, transformAuthoringGeometry } from '../../../authoring/AuthoringGeometry';
import { RoadType, type Road } from '../../infrastructure/Road';
import type { GenerationContext, GenerationStage } from '../GenerationStage';

function roadType(subtype: string): RoadType {
  const normalized = subtype.toLowerCase();
  if (normalized.includes('main') || normalized.includes('highway') || normalized.includes('arterial')) return RoadType.Main;
  if (normalized.includes('secondary') || normalized.includes('collector')) return RoadType.Secondary;
  return RoadType.Local;
}

export class AuthoringRoadStage implements GenerationStage {
  public readonly id = 'authoring-roads';

  public run({ world, options }: GenerationContext): void {
    for (const feature of options.authoredFeatures) {
      if (feature.category !== 'road' || feature.hidden || feature.realityLayer !== 'normal') continue;
      const points = rasterizeGeometryPath(transformAuthoringGeometry(feature.geometry, feature.rotation, feature.scale));
      const path: number[] = [];
      for (const point of points) {
        const x = Math.round(point.x);
        const y = Math.round(point.y);
        if (!world.contains(x, y)) continue;
        const index = world.indexOf(x, y);
        if (path[path.length - 1] !== index) path.push(index);
      }
      if (path.length < 2) continue;
      const id = world.roads.length;
      const road: Road = {
        id,
        name: feature.name.trim() || `Authored Road ${id + 1}`,
        type: roadType(feature.subtype),
        path,
        bridgeTiles: [],
        connectsAnchorIds: [],
        connectsSettlementIds: [],
        length: path.length,
        bridgeId: null,
        portId: null,
        source: 'authored',
        authoringFeatureId: feature.id,
      };
      world.roads.push(road);
      for (const index of path) {
        const tile = world.tiles[index];
        if (tile === undefined) continue;
        tile.road = true;
        tile.roadId = id;
        tile.roadDistance = 0;
      }
    }
  }
}
