import {
  loadNameState,
  loadProfile,
  normalizeAnchorState,
  normalizeCustomStoryDefinition,
  normalizeLabelSettings,
  normalizeStoredProfile,
  parseEncounterLines,
  saveNameState,
  type KeyValueStorage,
} from '../src/editor/EditorStatePersistence';
import {
  ClimatePreset,
  TerrainShape,
  TerrainSize,
  TownScale,
} from '../src/engine/generation/GenerationOptions';
import {
  AnchorProximityBand,
  AnchorRegionPreference,
  AnchorTerrainPreference,
  AnchorType,
} from '../src/engine/settlement/Anchor';
import { ZoneType } from '../src/engine/zoning/Zone';
import { EncounterDanger, StoryObjectType } from '../src/story/StoryObject';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function main(): void {
  const profile = normalizeStoredProfile({
    terrainSize: TerrainSize.Large,
    townScale: TownScale.Urban,
    terrainShape: TerrainShape.LegacyRiverDelta,
    climatePreset: ClimatePreset.Temperate,
    targetIslandCount: 99,
    islandSpacingKilometers: 0.1,
    satelliteSettlementCount: 17,
  });
  assert(profile.terrainShape === TerrainShape.Delta, 'Legacy terrain shapes must migrate.');
  assert(profile.islandCount === 12, 'Island count must be clamped.');
  assert(profile.islandSpacingKilometers === 0.5, 'Island spacing must be clamped.');
  assert(profile.satelliteSettlementCount === 0, 'Removed satellite settlements must stay disabled.');

  const labels = normalizeLabelSettings({
    road: { visible: 'yes', fontSizePx: 2, opacity: 4 },
    block: { minZoom: 99 },
    avoidCollisions: false,
  });
  assert(labels.road.visible, 'Invalid booleans must use label defaults.');
  assert(labels.road.fontSizePx === 4 && labels.road.opacity === 1, 'Road label values must be clamped.');
  assert(labels.block.minZoom === 12, 'Block label zoom must be clamped.');
  assert(!labels.avoidCollisions, 'Valid label booleans must be preserved.');

  const anchorRule = {
    name: '  Plaza  ',
    region: AnchorRegionPreference.TownCenter,
    terrain: AnchorTerrainPreference.FlatLand,
    targetAnchor: null,
    proximity: AnchorProximityBand.None,
    radius: 8,
    minimumDistance: 4,
    zoneType: ZoneType.Government,
  };
  const anchors = normalizeAnchorState({
    customAnchors: [{ id: 'custom:plaza', ...anchorRule }, { id: 3, ...anchorRule }],
    builtInAnchorOverrides: [{ type: AnchorType.Church, ...anchorRule }],
  });
  assert(anchors.customAnchors.length === 1 && anchors.customAnchors[0]?.name === 'Plaza', 'Invalid anchors must be removed and names trimmed.');
  assert(anchors.builtInOverrides[0]?.type === AnchorType.Church, 'Legacy built-in anchor storage must migrate.');

  const encounters = parseEncounterLines('500 | severe | Night Market | Keep | the separators\ninvalid | unknown | Omen |');
  assert(encounters[0]?.weight === 100 && encounters[0]?.danger === EncounterDanger.Severe, 'Encounter values must be clamped and parsed.');
  assert(encounters[0]?.description === 'Keep | the separators', 'Encounter descriptions must preserve separators.');
  assert(encounters[1]?.weight === 1 && encounters[1]?.danger === EncounterDanger.Low, 'Invalid encounter values must use defaults.');

  const story = normalizeCustomStoryDefinition({
    id: 'story:test',
    name: '  Old House ',
    type: StoryObjectType.HauntedHouse,
    region: AnchorRegionPreference.Anywhere,
    terrain: AnchorTerrainPreference.SafeLand,
    preferredZone: ZoneType.Residential,
    allowedZones: [ZoneType.Residential, 'invalid'],
    disallowedZones: [ZoneType.Residential, ZoneType.Industrial],
    influenceRadius: 200,
    minimumDistance: 1,
    encounters,
  });
  assert(story?.name === 'Old House', 'Story names must be trimmed.');
  assert(story?.influenceRadius === 40 && story.minimumDistance === 4, 'Story distances must be clamped.');
  assert(story.disallowedZones.length === 1 && story.disallowedZones[0] === ZoneType.Industrial, 'Allowed zones must win conflicts.');

  const storage = new MemoryStorage();
  storage.setItem('payaw.generation-profile.v1', '{broken json');
  const fallback = loadProfile(storage);
  assert(fallback.terrainSize === TerrainSize.Small, 'Corrupt stored profiles must fall back safely.');

  saveNameState('world:a', {
    roads: [{ id: 1, name: '  Mabini Road  ' }],
    blocks: [{ id: 2, name: 'Market Block' }],
  }, storage);
  const names = loadNameState('world:a', storage);
  assert(names.roads[0]?.name === 'Mabini Road', 'Stored names must be normalized when read.');

  console.log(JSON.stringify({
    profiles: true,
    labels: true,
    anchors: true,
    stories: true,
    storageFallbacks: true,
  }));
}

main();
