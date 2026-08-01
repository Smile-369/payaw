import type { AuthoredMapFeature, AuthoredSettlementDefinition, GeneratedFeatureOverride, SettlementAuthoringOverride, TerrainTileOverride } from '../src/authoring/AuthoringLayer';
import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale, type GenerationOptions } from '../src/engine/generation/GenerationOptions';
import { TerrainType, WaterType } from '../src/engine/world/Tile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const baseOptions: GenerationOptions = {
  terrainShape: TerrainShape.Archipelago,
  terrainSize: TerrainSize.Small,
  townScale: TownScale.SemiUrban,
  islandCount: 4,
  islandSpacingKilometers: 2.5,
  satelliteSettlementCount: 4,
};

function feature(id: string, overrides: Partial<AuthoredMapFeature>): AuthoredMapFeature {
  const now = '2026-07-21T00:00:00.000Z';
  return {
    id,
    name: 'Authored Feature',
    category: 'landmark',
    subtype: 'custom',
    geometry: { kind: 'point', point: { x: 4, y: 4 } },
    realityLayer: 'normal',
    visibility: 'players',
    locked: false,
    hidden: false,
    opacity: 1,
    lineWidth: 2,
    fillOpacity: 0.35,
    color: '#d1aa72',
    rotation: 0,
    scale: 1,
    aliases: [],
    tags: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function main(): void {
  const pipeline = new GenerationPipeline();
  const baseline = pipeline.generate('payaw-ms18-world-authoring', baseOptions);
  assert(baseline.metadata.schemaVersion >= 18, 'Milestone 18-or-newer schema version is missing.');
  assert(baseline.metadata.generationVersion.includes('world-authoring') || baseline.metadata.generationVersion.includes('npc-location-authoring') || baseline.metadata.generationVersion.includes('campaign-system'), 'World-authoring generation version is missing.');

  const authoredSettlement: AuthoredSettlementDefinition = {
    key: 'settlement:authored:test-barangay',
    name: 'Barangay Malipayon',
    kind: 'barangay',
    x: 3,
    y: 4,
    radius: 12,
    rotation: Math.PI / 7,
    populationTarget: 1900,
    density: 0.72,
    parentKey: null,
    generateRoads: false,
    generateBuildings: false,
    locked: true,
    hidden: false,
    visibility: 'players',
    notes: 'Manually placed test barangay.',
  };

  const generatedSatellite = baseline.settlements.find((settlement) => !settlement.isPrimary && settlement.source === 'generated');
  assert(generatedSatellite !== undefined, 'Baseline generated no movable satellite settlement.');
  const movedX = Math.max(1, baseline.width - 5);
  const movedY = Math.max(1, baseline.height - 6);
  const settlementOverride: SettlementAuthoringOverride = {
    key: generatedSatellite.key,
    name: 'Riverside Subdivision',
    kind: 'subdivision',
    x: movedX,
    y: movedY,
    radius: 9,
    rotation: 0.4,
    populationTarget: 820,
    density: 0.84,
    generateRoads: false,
    generateBuildings: false,
    parentKey: authoredSettlement.key,
    locked: true,
    visibility: 'gm-only',
    notes: 'Moved by the GM.',
  };

  const terrainIndex = baseline.indexOf(Math.min(8, baseline.width - 1), Math.min(8, baseline.height - 1));
  const terrainOverride: TerrainTileOverride = {
    tileIndex: terrainIndex,
    terrain: TerrainType.Mountain,
    water: WaterType.Land,
    elevation: 0.91,
    moisture: 0.2,
    forestDensity: 0.1,
    floodRisk: 0.05,
    river: false,
    locked: true,
  };

  const authoredRoad = feature('feature:road:test', {
    name: 'GM Shortcut',
    category: 'road',
    subtype: 'local-footpath',
    geometry: { kind: 'polyline', points: [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 12, y: 5 }] },
  });
  const hiddenPayaw = feature('feature:hidden:test', {
    name: 'The Road Behind the Road',
    category: 'hidden-payaw',
    subtype: 'ghost-road',
    realityLayer: 'hidden-payaw',
    visibility: 'gm-only',
    geometry: { kind: 'polyline', points: [{ x: 5, y: 5 }, { x: 9, y: 9 }] },
  });

  const authoredOptions: GenerationOptions = {
    ...baseOptions,
    authoredSettlements: [authoredSettlement],
    settlementAuthoringOverrides: [settlementOverride],
    terrainOverrides: [terrainOverride],
    authoredFeatures: [authoredRoad, hiddenPayaw],
  };
  const authored = pipeline.generate('payaw-ms18-world-authoring', authoredOptions);
  const newBarangay = authored.settlements.find((settlement) => settlement.key === authoredSettlement.key);
  assert(newBarangay !== undefined, 'Authored settlement was not added to the world.');
  assert(newBarangay.x === authoredSettlement.x && newBarangay.y === authoredSettlement.y, 'Authored settlement was not placed at the exact GM coordinates.');
  assert(newBarangay.kind === 'barangay' && newBarangay.locked === true, 'Authored settlement metadata was not retained.');
  assert(newBarangay.generateRoads === false && newBarangay.generateBuildings === false, 'Partial/empty settlement generation controls were ignored.');

  const moved = authored.settlements.find((settlement) => settlement.key === generatedSatellite.key);
  assert(moved !== undefined, 'Generated satellite disappeared after authoring override.');
  assert(moved.x === movedX && moved.y === movedY, 'Generated satellite was not moved to exact authored coordinates.');
  assert(moved.name === 'Riverside Subdivision' && moved.kind === 'subdivision', 'Generated settlement rename/type override failed.');
  assert(moved.parentKey === authoredSettlement.key && moved.visibility === 'gm-only', 'Settlement hierarchy/visibility override failed.');

  const editedTile = authored.tiles[terrainIndex];
  assert(editedTile !== undefined, 'Terrain override tile is missing.');
  assert(editedTile.terrain === TerrainType.Mountain && editedTile.water === WaterType.Land, 'Terrain paint override was not applied.');
  assert(Math.abs(editedTile.elevation - 0.91) < 0.00001, 'Absolute elevation authoring was not applied.');

  const authoredRoads = authored.roads.filter((road) => road.authoringFeatureId === authoredRoad.id);
  assert(authoredRoads.length === 1, 'Authored road was not generated exactly once.');
  pipeline.regenerateFrom(authored, 'road-network', authoredOptions);
  assert(authored.roads.filter((road) => road.authoringFeatureId === authoredRoad.id).length === 1, 'Granular road regeneration duplicated the authored road.');

  const generatedRoad = baseline.roads.find((road) => road.source === 'generated' && road.generatedId !== undefined && road.bridgeId === null && road.portId === null);
  assert(generatedRoad !== undefined, 'Baseline generated no adoptable road.');
  const roadSuppression: GeneratedFeatureOverride = {
    key: `generated-road:${generatedRoad.generatedId}`,
    entityType: 'road',
    entityId: generatedRoad.generatedId,
    suppressed: true,
  };
  const withoutRoad = pipeline.generate('payaw-ms18-world-authoring', { ...baseOptions, generatedFeatureOverrides: [roadSuppression] });
  assert(!withoutRoad.roads.some((road) => road.generatedId === generatedRoad.generatedId), 'Generated road suppression did not survive reindexing.');

  const generatedBuilding = baseline.buildings.find((building) => building.generatedId !== undefined);
  assert(generatedBuilding !== undefined, 'Baseline generated no adoptable building.');
  const buildingSuppression: GeneratedFeatureOverride = {
    key: `generated-building:${generatedBuilding.generatedId}`,
    entityType: 'building',
    entityId: generatedBuilding.generatedId,
    suppressed: true,
  };
  const withoutBuilding = pipeline.generate('payaw-ms18-world-authoring', { ...baseOptions, generatedFeatureOverrides: [buildingSuppression] });
  assert(!withoutBuilding.buildings.some((building) => building.generatedId === generatedBuilding.generatedId), 'Generated building suppression did not survive reindexing.');

  const restoredTerrain = pipeline.generate('payaw-ms18-world-authoring', baseOptions).tiles[terrainIndex];
  assert(restoredTerrain !== undefined, 'Baseline terrain tile is missing after reset generation.');
  assert(Math.abs(restoredTerrain.elevation - 0.91) > 0.00001 || restoredTerrain.terrain !== TerrainType.Mountain, 'Removing terrain overrides did not restore the deterministic baseline.');

  console.log(JSON.stringify({
    schemaVersion: authored.metadata.schemaVersion,
    generationVersion: authored.metadata.generationVersion,
    authoredSettlement: { name: newBarangay.name, kind: newBarangay.kind, x: newBarangay.x, y: newBarangay.y },
    movedSettlement: { name: moved.name, kind: moved.kind, x: moved.x, y: moved.y, parentKey: moved.parentKey },
    terrainOverride: { index: terrainIndex, terrain: editedTile.terrain, elevation: editedTile.elevation },
    authoredRoadCount: authored.roads.filter((road) => road.authoringFeatureId === authoredRoad.id).length,
    hiddenPayawFeatureStored: hiddenPayaw.realityLayer === 'hidden-payaw',
    suppressedRoadStableId: generatedRoad.generatedId,
    suppressedBuildingStableId: generatedBuilding.generatedId,
  }, null, 2));
}

main();
