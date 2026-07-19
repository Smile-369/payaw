import { DEFAULT_GENERATION_CONFIG } from '../src/engine/config/GenerationConfig';
import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainSize, TownScale } from '../src/engine/generation/GenerationOptions';
import { BuildingType } from '../src/engine/buildings/Building';
import { BUILDING_TEMPLATES } from '../src/engine/buildings/BuildingTemplates';
import { ElevationStage } from '../src/engine/generation/stages/ElevationStage';
import { RiverTerminus } from '../src/engine/hydrology/River';
import { RoadType } from '../src/engine/infrastructure/Road';
import {
  BUILT_IN_ANCHOR_TYPES,
  AnchorProximityBand,
  AnchorRegionPreference,
  AnchorSource,
  AnchorTerrainPreference,
  AnchorType,
  type BuiltInAnchorOverride,
  type CustomAnchorDefinition,
} from '../src/engine/settlement/Anchor';
import { RiverCourse, WaterType } from '../src/engine/world/Tile';
import type { World } from '../src/engine/world/World';
import { ZoneType } from '../src/engine/zoning/Zone';
import { StoryObjectType } from '../src/story/StoryObject';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function deterministicPayload(world: World): string {
  return JSON.stringify(world.toJSON());
}


interface RegionStats {
  readonly averageElevation: number;
  readonly landFraction: number;
  readonly oceanFraction: number;
}

function measureRegion(
  world: World,
  minimumX: number,
  maximumX: number,
  minimumY: number,
  maximumY: number,
): RegionStats {
  let tileCount = 0;
  let elevationTotal = 0;
  let landTiles = 0;
  let oceanTiles = 0;
  const widthDenominator = Math.max(1, world.width - 1);
  const heightDenominator = Math.max(1, world.height - 1);

  for (const tile of world.tiles) {
    const normalizedX = tile.x / widthDenominator;
    const normalizedY = tile.y / heightDenominator;
    if (
      normalizedX < minimumX
      || normalizedX > maximumX
      || normalizedY < minimumY
      || normalizedY > maximumY
    ) {
      continue;
    }

    tileCount += 1;
    elevationTotal += tile.elevation;
    landTiles += tile.water === WaterType.Land ? 1 : 0;
    oceanTiles += tile.water === WaterType.Ocean ? 1 : 0;
  }

  assert(tileCount > 0, 'Macro-geography test selected an empty region.');
  return {
    averageElevation: elevationTotal / tileCount,
    landFraction: landTiles / tileCount,
    oceanFraction: oceanTiles / tileCount,
  };
}

function validateMacroGeography(world: World): void {
  const north = measureRegion(world, 0.1, 0.9, 0, 0.3);
  const southBay = measureRegion(world, 0.3, 0.7, 0.75, 1);
  const eastPeninsula = measureRegion(world, 0.7, 1, 0.35, 0.75);
  const westFarmland = measureRegion(world, 0, 0.35, 0.35, 0.8);

  assert(north.averageElevation > 0.5, `Seed ${world.seed} lost the northern highlands.`);
  assert(
    north.averageElevation > westFarmland.averageElevation + 0.02,
    `Seed ${world.seed} does not keep the west below the northern mountains.`,
  );
  assert(southBay.oceanFraction > 0.6, `Seed ${world.seed} lost the southern bay.`);
  assert(eastPeninsula.landFraction > 0.4, `Seed ${world.seed} lost the eastern peninsula.`);
  assert(westFarmland.landFraction > 0.35, `Seed ${world.seed} lost the western farmland shelf.`);
  assert(westFarmland.averageElevation < 0.58, `Seed ${world.seed} made the western farmland too mountainous.`);
}

function validateDrainage(world: World): void {
  const sampleStride = Math.max(1, Math.floor(world.tiles.length / 256));

  for (let sourceIndex = 0; sourceIndex < world.tiles.length; sourceIndex += sampleStride) {
    const source = world.tiles[sourceIndex];
    if (source === undefined || source.water === WaterType.Ocean) {
      continue;
    }

    const visited = new Set<number>();
    let currentIndex = sourceIndex;

    for (let step = 0; step < world.tiles.length; step += 1) {
      assert(!visited.has(currentIndex), `Drainage cycle detected from tile ${sourceIndex}.`);
      visited.add(currentIndex);

      const tile = world.tiles[currentIndex];
      assert(tile !== undefined, `Drainage escaped the world from tile ${sourceIndex}.`);
      if (tile.water === WaterType.Ocean) {
        break;
      }

      assert(tile.flowTo >= 0, `Non-ocean tile ${currentIndex} has no downstream tile.`);
      currentIndex = tile.flowTo;
    }

    const terminal = world.tiles[currentIndex];
    assert(terminal?.water === WaterType.Ocean, `Drainage from tile ${sourceIndex} did not reach the ocean.`);
  }
}

function validateRivers(world: World): void {
  assert(world.rivers.length > 0, `Seed ${world.seed} generated no rivers.`);
  assert(
    world.rivers.length <= DEFAULT_GENERATION_CONFIG.hydrology.riverSourceCount,
    'River count exceeded the configured source limit.',
  );

  for (const river of world.rivers) {
    assert(
      river.length >= DEFAULT_GENERATION_CONFIG.hydrology.minimumRiverLength,
      `River ${river.id} is shorter than the configured minimum.`,
    );

    const source = world.tiles[river.sourceIndex];
    assert(source !== undefined, `River ${river.id} has an invalid source.`);
    assert(
      source.elevation >= DEFAULT_GENERATION_CONFIG.hydrology.sourceMinElevation,
      `River ${river.id} does not begin in high terrain.`,
    );

    assert(river.centerline.length === river.path.length, `River ${river.id} centerline does not match its drainage path.`);
    assert(river.maximumWidth >= DEFAULT_GENERATION_CONFIG.hydrology.minimumRiverWidth, `River ${river.id} has invalid width.`);
    assert(river.maximumWidth <= DEFAULT_GENERATION_CONFIG.hydrology.maximumRiverWidth + 0.000001, `River ${river.id} exceeded the configured narrow-channel limit.`);
    assert(river.maximumDepth >= DEFAULT_GENERATION_CONFIG.hydrology.minimumRiverDepth, `River ${river.id} has invalid depth.`);
    for (let offset = 0; offset < river.centerline.length; offset += 1) {
      const sample = river.centerline[offset];
      assert(sample !== undefined, `River ${river.id} has a missing centerline sample.`);
      assert(Number.isFinite(sample.x) && Number.isFinite(sample.y), `River ${river.id} has non-finite geometry.`);
      assert(sample.width > 0 && sample.depth > 0 && sample.discharge >= 0, `River ${river.id} has invalid hydraulic geometry.`);
      const previous = river.centerline[offset - 1];
      if (previous !== undefined) {
        assert(sample.discharge + 0.000001 >= previous.discharge, `River ${river.id} discharge decreases downstream.`);
        assert(sample.width + 0.000001 >= previous.width, `River ${river.id} narrows despite increasing discharge.`);
      }
    }

    for (let offset = 0; offset < river.path.length - 1; offset += 1) {
      const currentIndex = river.path[offset];
      const nextIndex = river.path[offset + 1];
      assert(currentIndex !== undefined && nextIndex !== undefined, `River ${river.id} has an invalid path.`);
      const current = world.tiles[currentIndex];
      assert(current?.flowTo === nextIndex, `River ${river.id} does not follow the drainage field.`);
    }

    const mouth = world.tiles[river.mouthIndex];
    assert(mouth !== undefined, `River ${river.id} has an invalid mouth.`);
    if (river.terminus === RiverTerminus.Ocean) {
      assert(mouth.water === WaterType.Ocean, `River ${river.id} does not terminate at the ocean.`);
    } else {
      assert(river.tributaryOf !== null, `River ${river.id} has a confluence without a parent river.`);
      assert(mouth.riverId === river.tributaryOf, `River ${river.id} confluence does not meet its parent river.`);
    }
  }
}



function validateTerrainProcesses(world: World): void {
  let totalErosion = 0;
  let totalDeposition = 0;
  let deltaTiles = 0;
  let upperCourse = 0;
  let middleCourse = 0;
  let lowerCourse = 0;

  for (const tile of world.tiles) {
    assert(Number.isFinite(tile.bedElevation), 'A tile has non-finite bed elevation.');
    assert(Number.isFinite(tile.erosion) && tile.erosion >= 0, 'A tile has invalid erosion.');
    assert(Number.isFinite(tile.deposition) && tile.deposition >= 0, 'A tile has invalid deposition.');
    assert(Number.isFinite(tile.sediment) && tile.sediment >= 0, 'A tile has invalid sediment.');
    assert(Number.isFinite(tile.discharge) && tile.discharge >= 0, 'A tile has invalid discharge.');
    totalErosion += tile.erosion;
    totalDeposition += tile.deposition;
    deltaTiles += tile.delta ? 1 : 0;
    upperCourse += tile.riverCourse === RiverCourse.Upper ? 1 : 0;
    middleCourse += tile.riverCourse === RiverCourse.Middle ? 1 : 0;
    lowerCourse += tile.riverCourse === RiverCourse.Lower ? 1 : 0;
  }

  assert(totalErosion > 1, `Seed ${world.seed} did not hydraulically carve terrain.`);
  assert(totalDeposition > 0.01, `Seed ${world.seed} generated no sediment deposition.`);
  assert(deltaTiles > 0, `Seed ${world.seed} generated no delta deposits.`);
  assert(upperCourse > 0 && middleCourse > 0 && lowerCourse > 0, `Seed ${world.seed} lacks varied river courses.`);
}

function validateBuildings(world: World): void {
  assert(world.buildings.length >= 10, `Seed ${world.seed} generated too few buildings.`);
  const occupied = new Set<number>();
  const types = new Set<string>();

  for (let buildingIndex = 0; buildingIndex < world.buildings.length; buildingIndex += 1) {
    const building = world.buildings[buildingIndex];
    assert(building !== undefined, 'Building array contains a missing entry.');
    assert(building.id === buildingIndex, `Building ${building.id} has a non-contiguous ID.`);
    assert(building.tileIndices.length > 0, `Building ${building.id} has an empty footprint.`);
    assert(building.footprint.length >= 4, `Building ${building.id} has an invalid polygon.`);
    assert(building.stories >= 1, `Building ${building.id} has an invalid story count.`);
    assert(world.tiles[building.entrance.roadTileIndex]?.road === true, `Building ${building.id} entrance does not face a road.`);
    if (building.blockId !== null) assert(world.blocks[building.blockId] !== undefined, `Building ${building.id} references an invalid block.`);
    types.add(building.type);

    for (const index of building.tileIndices) {
      assert(!occupied.has(index), `Tile ${index} belongs to multiple buildings.`);
      occupied.add(index);
      const tile = world.tiles[index];
      assert(tile !== undefined, `Building ${building.id} references an invalid tile.`);
      assert(tile.buildingId === building.id, `Building ${building.id} was not committed to tile ${index}.`);
      assert(tile.water === WaterType.Land, `Building ${building.id} occupies water.`);
      assert(!tile.road && !tile.river, `Building ${building.id} overlaps infrastructure.`);
      assert(tile.blockId === building.blockId, `Building ${building.id} escapes its block.`);
    }
  }

  const anchorBuildings = world.buildings.filter((building) => building.anchorId !== null);
  assert(anchorBuildings.length === 7, `Seed ${world.seed} did not generate all seven structural anchor buildings.`);
  assert(new Set(anchorBuildings.map((building) => building.anchorId)).size === 7, `Seed ${world.seed} duplicated an anchor building.`);
  assert(types.size >= 3, `Seed ${world.seed} lacks building-type variety.`);
}

function validateVegetation(world: World): void {
  assert(world.vegetation.length >= 100, `Seed ${world.seed} generated too little vegetation.`);
  const occupied = new Set<number>();
  const types = new Set<string>();

  for (let vegetationIndex = 0; vegetationIndex < world.vegetation.length; vegetationIndex += 1) {
    const plant = world.vegetation[vegetationIndex];
    assert(plant !== undefined, 'Vegetation array contains a missing entry.');
    assert(plant.id === vegetationIndex, `Vegetation ${plant.id} has a non-contiguous ID.`);
    assert(!occupied.has(plant.tileIndex), `Tile ${plant.tileIndex} has duplicate vegetation.`);
    occupied.add(plant.tileIndex);
    const tile = world.tiles[plant.tileIndex];
    assert(tile !== undefined, `Vegetation ${plant.id} references an invalid tile.`);
    assert(tile.vegetationId === plant.id, `Vegetation ${plant.id} was not committed to its tile.`);
    assert(tile.water === WaterType.Land, `Vegetation ${plant.id} occupies water.`);
    assert(!tile.road && !tile.river && tile.buildingId === null, `Vegetation ${plant.id} overlaps generated content.`);
    assert(plant.scale > 0 && plant.age >= 0 && plant.age <= 1, `Vegetation ${plant.id} has invalid attributes.`);
    types.add(plant.type);
  }

  assert(types.size >= 3, `Seed ${world.seed} lacks vegetation variety.`);
}

function validateAnchorsAndRoads(world: World): void {
  const requiredAnchors = new Set(BUILT_IN_ANCHOR_TYPES);
  assert(world.anchors.length === requiredAnchors.size, `Seed ${world.seed} has an incorrect anchor count.`);
  const seenTypes = new Set<AnchorType>();

  for (const anchor of world.anchors) {
    if (anchor.type !== AnchorType.Custom) {
      assert(!seenTypes.has(anchor.type), `Seed ${world.seed} duplicated anchor ${anchor.type}.`);
      seenTypes.add(anchor.type);
      requiredAnchors.delete(anchor.type);
    }
    const tile = world.tiles[anchor.tileIndex];
    assert(tile !== undefined, `Anchor ${anchor.type} references an invalid tile.`);
    assert(tile.water === WaterType.Land, `Anchor ${anchor.type} was placed in water.`);
    assert(tile.x === anchor.x && tile.y === anchor.y, `Anchor ${anchor.type} coordinates do not match its tile.`);
    assert(tile.road, `Anchor ${anchor.type} is not connected to a road endpoint.`);
  }
  assert(requiredAnchors.size === 0, `Seed ${world.seed} is missing required anchors.`);
  const port = world.anchors.find((anchor) => anchor.type === AnchorType.Port);
  const airport = world.anchors.find((anchor) => anchor.type === AnchorType.Airport);
  const plaza = world.anchors.find((anchor) => anchor.type === AnchorType.TownPlaza);
  const church = world.anchors.find((anchor) => anchor.type === AnchorType.Church);
  const market = world.anchors.find((anchor) => anchor.type === AnchorType.Market);
  assert(port !== undefined && airport !== undefined && plaza !== undefined && church !== undefined && market !== undefined, 'Core anchors are missing.');
  let portTouchesOcean = false;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      portTouchesOcean ||= world.getTile(port.x + dx, port.y + dy)?.water === WaterType.Ocean;
    }
  }
  assert(portTouchesOcean, `Seed ${world.seed} placed the port away from ocean water.`);
  assert(Math.hypot(church.x - plaza.x, church.y - plaza.y) <= 20, `Seed ${world.seed} placed the church too far from the plaza.`);
  assert(Math.hypot(market.x - plaza.x, market.y - plaza.y) <= 28, `Seed ${world.seed} placed the market too far from the plaza.`);
  const airportTile = world.tiles[airport.tileIndex];
  assert(airportTile !== undefined && airportTile.slope <= DEFAULT_GENERATION_CONFIG.anchors.maximumAirportSlope, `Seed ${world.seed} placed the airport on a steep tile.`);

  assert(world.roads.some((road) => road.type === RoadType.Main), `Seed ${world.seed} generated no main roads.`);
  assert(world.roads.some((road) => road.type === RoadType.Secondary), `Seed ${world.seed} generated no secondary roads.`);
  assert(world.roads.some((road) => road.type === RoadType.Local), `Seed ${world.seed} generated no local connector roads.`);

  const roadTiles = new Set<number>();
  for (const road of world.roads) {
    assert(road.path.length > 1, `Road ${road.id} is too short.`);
    for (let offset = 0; offset < road.path.length; offset += 1) {
      const index = road.path[offset];
      assert(index !== undefined, `Road ${road.id} has an invalid path index.`);
      const tile = world.tiles[index];
      assert(tile !== undefined, `Road ${road.id} references an invalid tile.`);
      assert(tile.water === WaterType.Land, `Road ${road.id} enters non-land terrain.`);
      assert(tile.road, `Road ${road.id} was not committed to its tile.`);
      roadTiles.add(index);
      const previousIndex = road.path[offset - 1];
      if (previousIndex !== undefined) {
        const previous = world.tiles[previousIndex];
        assert(previous !== undefined, `Road ${road.id} has an invalid previous tile.`);
        assert(Math.max(Math.abs(tile.x - previous.x), Math.abs(tile.y - previous.y)) === 1, `Road ${road.id} contains a discontinuity.`);
      }
    }
    for (const index of road.bridgeTiles) {
      const tile = world.tiles[index];
      assert(tile?.river === true, `Road ${road.id} contains a bridge outside a river.`);
      assert(tile.bridge, `Road ${road.id} bridge was not committed to its tile.`);
    }
  }

  const firstAnchor = world.anchors[0];
  assert(firstAnchor !== undefined, 'No anchor available for connectivity validation.');
  const visited = new Set<number>([firstAnchor.tileIndex]);
  const queue = [firstAnchor.tileIndex];
  const directions: readonly (readonly [number, number])[] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  for (let offset = 0; offset < queue.length; offset += 1) {
    const current = queue[offset];
    if (current === undefined) continue;
    const x = current % world.width;
    const y = Math.floor(current / world.width);
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.contains(nx, ny)) continue;
      const next = ny * world.width + nx;
      if (roadTiles.has(next) && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  for (const anchor of world.anchors) {
    assert(visited.has(anchor.tileIndex), `Anchor ${anchor.type} is disconnected from the road network.`);
  }
}



function signedPolygonArea(points: readonly { x: number; y: number }[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    area += current.x * next.y - next.x * current.y;
  }
  return area * 0.5;
}

function validateAccessibilityAndLandValue(world: World): void {
  let minimumAccessibility = 1;
  let maximumAccessibility = 0;
  let minimumLandValue = 1;
  let maximumLandValue = 0;
  let nearRoadAccessibility = 0;
  let nearRoadCount = 0;
  let farRoadAccessibility = 0;
  let farRoadCount = 0;

  for (const tile of world.tiles) {
    assert(Number.isFinite(tile.accessibility), 'A tile has non-finite accessibility.');
    assert(Number.isFinite(tile.landValue), 'A tile has non-finite land value.');
    assert(tile.accessibility >= 0 && tile.accessibility <= 1, 'Accessibility escaped the normalized range.');
    assert(tile.landValue >= 0 && tile.landValue <= 1, 'Land value escaped the normalized range.');

    if (tile.water !== WaterType.Land) {
      assert(tile.accessibility === 0, 'A water tile received accessibility.');
      assert(tile.landValue === 0, 'A water tile received land value.');
      continue;
    }

    if (tile.road) assert(tile.roadDistance === 0, 'A road tile does not have zero road distance.');
    minimumAccessibility = Math.min(minimumAccessibility, tile.accessibility);
    maximumAccessibility = Math.max(maximumAccessibility, tile.accessibility);
    minimumLandValue = Math.min(minimumLandValue, tile.landValue);
    maximumLandValue = Math.max(maximumLandValue, tile.landValue);

    if (tile.roadDistance >= 0 && tile.roadDistance <= 2) {
      nearRoadAccessibility += tile.accessibility;
      nearRoadCount += 1;
    } else if (tile.roadDistance < 0 || tile.roadDistance >= 20) {
      farRoadAccessibility += tile.accessibility;
      farRoadCount += 1;
    }
  }

  assert(maximumAccessibility - minimumAccessibility > 0.35, `Seed ${world.seed} lacks accessibility variation.`);
  assert(maximumLandValue - minimumLandValue > 0.35, `Seed ${world.seed} lacks land-value variation.`);
  assert(nearRoadCount > 0 && farRoadCount > 0, `Seed ${world.seed} lacks road-distance comparison samples.`);
  assert(
    nearRoadAccessibility / nearRoadCount > farRoadAccessibility / farRoadCount,
    `Seed ${world.seed} does not make road-adjacent land more accessible.`,
  );
}

function validateBlocks(world: World): void {
  assert(world.blocks.length >= 5, `Seed ${world.seed} generated too few road-bounded blocks.`);
  const assignedTiles = new Set<number>();

  for (let blockIndex = 0; blockIndex < world.blocks.length; blockIndex += 1) {
    const block = world.blocks[blockIndex];
    assert(block !== undefined, 'Block array contains a missing entry.');
    assert(block.id === blockIndex, `Block ${block.id} has a non-contiguous ID.`);
    assert(block.area === block.tileIndices.length, `Block ${block.id} area does not match its tiles.`);
    assert(block.area >= DEFAULT_GENERATION_CONFIG.blocks.minimumArea, `Block ${block.id} is too small.`);
    assert(block.area <= DEFAULT_GENERATION_CONFIG.blocks.maximumArea, `Block ${block.id} is too large.`);
    assert(block.roadFrontage >= DEFAULT_GENERATION_CONFIG.blocks.minimumRoadFrontage, `Block ${block.id} lacks road frontage.`);
    assert(block.boundary.length >= 4, `Block ${block.id} has an invalid polygon boundary.`);
    assert(Math.abs(signedPolygonArea(block.boundary)) > 0, `Block ${block.id} has a zero-area boundary.`);
    assert(Number.isFinite(block.averageAccessibility), `Block ${block.id} has invalid accessibility.`);
    assert(Number.isFinite(block.averageLandValue), `Block ${block.id} has invalid land value.`);
    assert(block.zoneId !== null, `Block ${block.id} was not assigned to a zone.`);

    for (const index of block.tileIndices) {
      assert(!assignedTiles.has(index), `Tile ${index} belongs to multiple blocks.`);
      assignedTiles.add(index);
      const tile = world.tiles[index];
      assert(tile !== undefined, `Block ${block.id} references an invalid tile.`);
      assert(tile.blockId === block.id, `Block ${block.id} was not committed to tile ${index}.`);
      assert(tile.water === WaterType.Land, `Block ${block.id} contains water.`);
      assert(!tile.road, `Block ${block.id} contains a road tile.`);
      assert(!tile.river, `Block ${block.id} contains a river tile.`);
      assert(tile.roadDistance >= 1, `Block ${block.id} overlaps its road boundary.`);
      assert(tile.roadDistance <= DEFAULT_GENERATION_CONFIG.blocks.maximumRoadDistance, `Block ${block.id} is too far from roads.`);
    }
  }

  for (let index = 0; index < world.tiles.length; index += 1) {
    const blockId = world.tiles[index]?.blockId;
    if (blockId === undefined || blockId === null) continue;
    assert(world.blocks[blockId]?.tileIndices.includes(index) === true, `Tile ${index} has a stale block ID.`);
  }
}

function validateZones(world: World): void {
  const requiredTypes = new Set<ZoneType>(Object.values(ZoneType).filter((type) => type !== ZoneType.Mixed));
  assert(world.zones.length > requiredTypes.size, `Seed ${world.seed} generated too few zone regions.`);

  for (let zoneIndex = 0; zoneIndex < world.zones.length; zoneIndex += 1) {
    const zone = world.zones[zoneIndex];
    assert(zone !== undefined, 'Zone array contains a missing entry.');
    assert(zone.id === zoneIndex, `Zone ${zone.id} has a non-contiguous ID.`);
    assert(zone.area === zone.tileIndices.length && zone.area > 0, `Zone ${zone.id} has invalid area.`);
    assert(Number.isFinite(zone.averageLandValue), `Zone ${zone.id} has invalid average land value.`);
    requiredTypes.delete(zone.type);

    for (const index of zone.tileIndices) {
      const tile = world.tiles[index];
      assert(tile !== undefined, `Zone ${zone.id} references an invalid tile.`);
      assert(tile.zoneId === zone.id, `Zone ${zone.id} was not committed to tile ${index}.`);
      assert(tile.zoneType === zone.type, `Zone ${zone.id} contains the wrong tile type.`);
      assert(tile.water === WaterType.Land, `Zone ${zone.id} contains water.`);
      assert(!tile.road, `Zone ${zone.id} contains road infrastructure.`);
    }

    for (const blockId of zone.blockIds) {
      const block = world.blocks[blockId];
      assert(block !== undefined, `Zone ${zone.id} references an invalid block.`);
      assert(block.zoneId === zone.id, `Zone ${zone.id} block mapping is inconsistent.`);
    }
  }

  assert(requiredTypes.size === 0, `Seed ${world.seed} is missing zone types: ${[...requiredTypes].join(', ')}.`);
  for (const block of world.blocks) {
    const zone = block.zoneId === null ? undefined : world.zones[block.zoneId];
    assert(zone !== undefined, `Block ${block.id} references an invalid zone.`);
    for (const index of block.tileIndices) {
      assert(world.tiles[index]?.zoneType === zone.type, `Block ${block.id} crosses zoning boundaries.`);
    }
  }
}

function validateWorld(world: World): { landTiles: number; oceanTiles: number } {
  let oceanTiles = 0;
  let landTiles = 0;
  let coastTiles = 0;
  let riverTiles = 0;
  let floodplainTiles = 0;
  let minimumMoisture = 1;
  let maximumMoisture = 0;
  let minimumTemperature = 1;
  let maximumTemperature = 0;

  for (const tile of world.tiles) {
    assert(Number.isFinite(tile.elevation), 'A tile has a non-finite elevation.');
    assert(Number.isFinite(tile.moisture), 'A tile has non-finite moisture.');
    assert(Number.isFinite(tile.temperature), 'A tile has a non-finite temperature.');
    assert(Number.isFinite(tile.flowAccumulation), 'A tile has non-finite flow accumulation.');
    assert(Number.isFinite(tile.floodRisk), 'A tile has non-finite flood risk.');
    oceanTiles += tile.water === WaterType.Ocean ? 1 : 0;
    landTiles += tile.water === WaterType.Land ? 1 : 0;
    coastTiles += tile.coast ? 1 : 0;
    riverTiles += tile.river ? 1 : 0;
    floodplainTiles += tile.floodRisk >= 0.35 ? 1 : 0;
    minimumMoisture = Math.min(minimumMoisture, tile.moisture);
    maximumMoisture = Math.max(maximumMoisture, tile.moisture);
    minimumTemperature = Math.min(minimumTemperature, tile.temperature);
    maximumTemperature = Math.max(maximumTemperature, tile.temperature);
  }

  assert(oceanTiles > 0, `Seed ${world.seed} generated no ocean.`);
  assert(landTiles > 0, `Seed ${world.seed} generated no land.`);
  assert(coastTiles > 0, `Seed ${world.seed} generated no coastline.`);
  assert(riverTiles > 0, `Seed ${world.seed} generated no river tiles.`);
  assert(floodplainTiles > 0, `Seed ${world.seed} generated no floodplain.`);
  assert(maximumMoisture - minimumMoisture > 0.2, `Seed ${world.seed} lacks moisture variation.`);
  assert(maximumTemperature - minimumTemperature > 0.2, `Seed ${world.seed} lacks temperature variation.`);
  validateMacroGeography(world);
  validateTerrainProcesses(world);
  validateDrainage(world);
  validateRivers(world);
  validateAnchorsAndRoads(world);
  validateAccessibilityAndLandValue(world);
  validateBlocks(world);
  validateZones(world);
  validateBuildings(world);
  validateVegetation(world);
  return { landTiles, oceanTiles };
}


function validateCanonicalTerrainContract(): void {
  const terrainOnly = new GenerationPipeline(
    DEFAULT_GENERATION_CONFIG,
    [new ElevationStage()],
  ).generate('payaw-terrain-contract');
  const values = new Float32Array(terrainOnly.tiles.map((tile) => tile.elevation));
  const bytes = new Uint8Array(values.buffer);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  assert(
    hash.toString(16).padStart(8, '0') === '376ee58e',
    'The canonical Island Gen elevation contract changed unexpectedly.',
  );
}

validateCanonicalTerrainContract();

const pipeline = new GenerationPipeline();
const first = pipeline.generate('payaw-smoke-test');
const second = pipeline.generate('payaw-smoke-test');
const different = pipeline.generate('payaw-smoke-test-different');

assert(
  deterministicPayload(first) === deterministicPayload(second),
  'The same seed generated different serialized world data.',
);
assert(
  deterministicPayload(first) !== deterministicPayload(different),
  'Different seeds generated identical world data.',
);


const customAnchorDefinition: CustomAnchorDefinition = {
  id: 'old-cemetery-test',
  name: 'Old Cemetery',
  region: AnchorRegionPreference.West,
  terrain: AnchorTerrainPreference.SafeLand,
  targetAnchor: AnchorType.TownPlaza,
  proximity: AnchorProximityBand.Near,
  radius: 6,
  minimumDistance: 10,
  zoneType: ZoneType.Residential,
};
const customWorld = pipeline.generate('payaw-custom-anchor-test', { customAnchors: [customAnchorDefinition] });
const repeatedCustomWorld = pipeline.generate('payaw-custom-anchor-test', { customAnchors: [customAnchorDefinition] });
assert(deterministicPayload(customWorld) === deterministicPayload(repeatedCustomWorld), 'Custom anchor rules are not deterministic.');
const customAnchor = customWorld.anchors.find((anchor) => anchor.key === 'custom:old-cemetery-test');
assert(customAnchor !== undefined, 'The custom anchor was not generated.');
assert(customAnchor.source === AnchorSource.Custom && customAnchor.name === 'Old Cemetery', 'Custom anchor metadata was not preserved.');
assert(customWorld.tiles[customAnchor.tileIndex]?.road === true, 'The custom anchor was not connected to the road network.');
assert(customWorld.anchors.length === BUILT_IN_ANCHOR_TYPES.length + 1, 'The custom anchor changed the built-in anchor set.');


function validateMilestoneSix(world: World): void {
  assert(world.storyObjects.length === 6, `Seed ${world.seed} did not generate six required story objects.`);
  assert(
    world.storyObjects.filter((item) => item.type === StoryObjectType.BaleteTree).length === 3,
    `Seed ${world.seed} did not generate exactly three Balete trees.`,
  );
  for (const type of [StoryObjectType.OldSchool, StoryObjectType.AbandonedCinema, StoryObjectType.OldCemetery]) {
    assert(world.storyObjects.some((item) => item.type === type), `Seed ${world.seed} is missing ${type}.`);
  }
  for (const item of world.storyObjects) {
    assert(world.tiles[item.tileIndex] !== undefined, `Story object ${item.name} references an invalid tile.`);
    assert(item.wish.length > 0 && item.manifestation.length > 0, `Story object ${item.name} lacks narrative data.`);
  }
  assert(world.roads.every((road) => road.name.trim().length > 0), `Seed ${world.seed} contains an unnamed road.`);
  assert(world.blocks.every((block) => block.name.trim().length > 0), `Seed ${world.seed} contains an unnamed block.`);
}

validateMilestoneSix(first);

assert(BUILDING_TEMPLATES.some((template) => template.type === BuildingType.Mall), 'Milestone 8 is missing the mall building template.');
assert(BUILDING_TEMPLATES.some((template) => template.type === BuildingType.NipaHut), 'Milestone 8 is missing expanded house templates.');

const authoredTileIndex = first.blocks[0]?.tileIndices[0];
assert(authoredTileIndex !== undefined, 'Zone override test could not find a block tile.');
const authoredWorld = pipeline.generate('payaw-smoke-test', {
  zoneOverrides: [{ tileIndex: authoredTileIndex, zoneType: ZoneType.Mixed, locked: true }],
});
const authoredTile = authoredWorld.tiles[authoredTileIndex];
assert(authoredTile?.zoneType === ZoneType.Mixed, 'Manual mixed-use zone override was not applied.');
assert(authoredTile.generatedZoneType !== ZoneType.Mixed, 'Manual zoning overwrote the generated base zone.');
assert(authoredTile.hasZoneOverride && authoredTile.zoneLocked, 'Zone override metadata was not preserved.');
assert(authoredWorld.zones.some((zone) => zone.type === ZoneType.Mixed), 'Manual mixed-use zoning did not rebuild zone entities.');

const storyAuthoredWorld = pipeline.generate('payaw-story-authoring', {
  storyRuleOverrides: [{
    id: 4,
    name: 'Payaw Grand Cinema',
    preferredZone: ZoneType.Commercial,
    allowedZones: [ZoneType.Commercial],
    disallowedZones: [ZoneType.Industrial],
    influenceRadius: 18,
  }],
});
const authoredCinema = storyAuthoredWorld.storyObjects[4];
assert(authoredCinema?.name === 'Payaw Grand Cinema', 'Story authoring did not preserve the custom story name.');
assert(authoredCinema.preferredZone === ZoneType.Commercial, 'Story preferred-zone rule was not preserved.');
assert(authoredCinema.zoneType === ZoneType.Commercial, 'Story allowed-zone rule was not used for placement.');
assert(authoredCinema.influenceRadius === 18, 'Story influence radius override was not applied.');
assert(authoredCinema.key === StoryObjectType.AbandonedCinema, 'Story object key is not stable.');

const renamedWorld = pipeline.generate('payaw-name-overrides', {
  roadNameOverrides: [{ id: 0, name: 'Dandansoy Road' }],
  blockNameOverrides: [{ id: 0, name: 'Balete Quarter' }],
});
assert(renamedWorld.roads[0]?.name === 'Dandansoy Road', 'Road name override was not applied.');
assert(renamedWorld.blocks[0]?.name === 'Balete Quarter', 'Block name override was not applied.');

const marketOverride: BuiltInAnchorOverride = {
  type: AnchorType.Market,
  name: 'Payaw Night Market',
  region: AnchorRegionPreference.TownCenter,
  terrain: AnchorTerrainPreference.SafeLand,
  targetAnchor: AnchorType.TownPlaza,
  proximity: AnchorProximityBand.Near,
  radius: 8,
  minimumDistance: 7,
  zoneType: ZoneType.Residential,
};
const editedAnchorWorld = pipeline.generate('payaw-edited-anchor', { builtInAnchorOverrides: [marketOverride] });
const editedMarket = editedAnchorWorld.anchors.find((anchor) => anchor.type === AnchorType.Market);
assert(editedMarket?.name === 'Payaw Night Market', 'Built-in anchor name override was not preserved.');
assert(editedMarket.zoneType === ZoneType.Residential, 'Built-in anchor zoning override was not preserved.');
assert(
  editedAnchorWorld.tiles.some((tile) => tile.zoneType === ZoneType.Residential && Math.hypot(tile.x - editedMarket.x, tile.y - editedMarket.y) <= editedMarket.radius),
  'Edited anchor did not influence zoning around its location.',
);

const ruralWorld = pipeline.generate('payaw-profile-density', { townScale: TownScale.Rural });
const urbanWorld = pipeline.generate('payaw-profile-density', { townScale: TownScale.Urban });
assert(urbanWorld.roads.length > ruralWorld.roads.length, 'Urban profile did not generate more roads than rural profile.');
assert(urbanWorld.buildings.length >= ruralWorld.buildings.length, 'Urban profile did not generate at least as many buildings as rural profile.');
const mediumWorld = pipeline.generate('payaw-profile-medium', { terrainSize: TerrainSize.Medium });
assert(mediumWorld.width === 320 && mediumWorld.height === 240, 'Medium terrain profile has incorrect dimensions.');
assert(mediumWorld.metadata.terrainSize === TerrainSize.Medium, 'Terrain profile metadata was not serialized.');
validateMilestoneSix(mediumWorld);

function findManualPlacement(world: World, originX: number, originY: number, excluded: ReadonlySet<number> = new Set()): { x: number; y: number } {
  for (let radius = 2; radius <= 18; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
        const tile = world.getTile(originX + offsetX, originY + offsetY);
        if (tile === undefined || tile.water !== WaterType.Land || tile.river) continue;
        const index = tile.y * world.width + tile.x;
        if (excluded.has(index)) continue;
        return { x: tile.x, y: tile.y };
      }
    }
  }
  throw new Error('Could not find a valid manual placement tile for the override test.');
}

const baselineMarket = first.anchors.find((anchor) => anchor.type === AnchorType.Market);
const baselineStory = first.storyObjects.find((item) => item.type === StoryObjectType.OldCemetery);
assert(baselineMarket !== undefined && baselineStory !== undefined, 'Manual placement test prerequisites are missing.');
const occupiedAnchorTiles = new Set(first.anchors.map((anchor) => anchor.tileIndex));
const manualMarketPosition = findManualPlacement(first, baselineMarket.x, baselineMarket.y, occupiedAnchorTiles);
const manualStoryPosition = findManualPlacement(first, baselineStory.x, baselineStory.y);
const manuallyEditedWorld = pipeline.generate('payaw-smoke-test', {
  anchorPositionOverrides: [{ key: AnchorType.Market, ...manualMarketPosition }],
  storyPositionOverrides: [{ id: baselineStory.id, ...manualStoryPosition }],
});
const manuallyEditedMarket = manuallyEditedWorld.anchors.find((anchor) => anchor.type === AnchorType.Market);
const manuallyEditedStory = manuallyEditedWorld.storyObjects.find((item) => item.id === baselineStory.id);
assert(
  manuallyEditedMarket?.x === manualMarketPosition.x && manuallyEditedMarket.y === manualMarketPosition.y,
  'Manual anchor position override was not applied.',
);
assert(
  manuallyEditedStory?.x === manualStoryPosition.x && manuallyEditedStory.y === manualStoryPosition.y,
  'Manual story position override was not applied.',
);
assert(manuallyEditedWorld.tiles[manuallyEditedMarket.tileIndex]?.road === true, 'Moved anchor was not reconnected to the road network.');
const repeatedManualWorld = pipeline.generate('payaw-smoke-test', {
  anchorPositionOverrides: [{ key: AnchorType.Market, ...manualMarketPosition }],
  storyPositionOverrides: [{ id: baselineStory.id, ...manualStoryPosition }],
});
assert(deterministicPayload(manuallyEditedWorld) === deterministicPayload(repeatedManualWorld), 'Manual position overrides are not deterministic.');

const regressionSeeds = [
  'payaw-smoke-test',
  'payaw-smoke-test-different',
];

const summaries = regressionSeeds.map((seed) => {
  const world = seed === first.seed
    ? first
    : seed === different.seed
      ? different
      : pipeline.generate(seed);
  const counts = validateWorld(world);
  validateMilestoneSix(world);

  return {
    seed,
    ...counts,
    rivers: world.rivers.length,
    shortestRiver: Math.min(...world.rivers.map((river) => river.length)),
    longestRiver: Math.max(...world.rivers.map((river) => river.length)),
    anchors: world.anchors.length,
    roads: world.roads.length,
    localRoads: world.roads.filter((road) => road.type === RoadType.Local).length,
    blocks: world.blocks.length,
    zones: world.zones.length,
    buildings: world.buildings.length,
    vegetation: world.vegetation.length,
    deltaTiles: world.tiles.filter((tile) => tile.delta).length,
    anchorBuildings: world.buildings.filter((building) => building.anchorId !== null).length,
    bridges: world.roads.reduce((sum, road) => sum + road.bridgeTiles.length, 0),
  };
});

console.log(JSON.stringify({
  generationVersion: first.metadata.generationVersion,
  tileCount: first.tiles.length,
  seedsValidated: summaries.length,
  summaries,
}, null, 2));
