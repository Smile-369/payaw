import { BuildingType } from '../src/engine/buildings/Building';
import { BUILDING_TEMPLATES } from '../src/engine/buildings/BuildingTemplates';
import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { ZoneType } from '../src/engine/zoning/Zone';
import { StoryObjectType } from '../src/story/StoryObject';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pipeline = new GenerationPipeline();
const base = pipeline.generate('payaw-ms8-focused');
const tileIndex = base.blocks[0]?.tileIndices[0];
assert(tileIndex !== undefined, 'No editable block tile was generated.');

const options = {
  zoneOverrides: [{ tileIndex, zoneType: ZoneType.Mixed, locked: true }],
  storyRuleOverrides: [{
    id: 4,
    name: 'Payaw Grand Cinema',
    preferredZone: ZoneType.Commercial,
    allowedZones: [ZoneType.Commercial],
    disallowedZones: [ZoneType.Industrial],
    influenceRadius: 18,
  }],
} as const;

const authored = pipeline.generate('payaw-ms8-focused', options);
const repeated = pipeline.generate('payaw-ms8-focused', options);
const tile = authored.tiles[tileIndex];
const cinema = authored.storyObjects[4];

assert(tile?.zoneType === ZoneType.Mixed, 'Mixed-use zone override was not applied.');
assert(tile.generatedZoneType !== ZoneType.Mixed, 'Generated zoning was destructively overwritten.');
assert(tile.hasZoneOverride && tile.zoneLocked, 'Zone override lock metadata was lost.');
assert(authored.zones.some((zone) => zone.type === ZoneType.Mixed), 'Mixed-use zone entity was not rebuilt.');
assert(cinema?.type === StoryObjectType.AbandonedCinema, 'The deterministic cinema story slot changed.');
assert(cinema.name === 'Payaw Grand Cinema', 'Story name override was not applied.');
assert(cinema.zoneType === ZoneType.Commercial, 'Story allowed-zone constraint was not honored.');
assert(cinema.preferredZone === ZoneType.Commercial, 'Story preferred zone metadata was not preserved.');
assert(cinema.influenceRadius === 18, 'Story influence radius was not applied.');
assert(JSON.stringify(authored.toJSON()) === JSON.stringify(repeated.toJSON()), 'Milestone 8 overrides are not deterministic.');
assert(BUILDING_TEMPLATES.some((template) => template.type === BuildingType.Mall), 'Mall template is missing.');
assert(BUILDING_TEMPLATES.some((template) => template.type === BuildingType.NipaHut), 'Nipa hut template is missing.');
assert(BUILDING_TEMPLATES.some((template) => template.type === BuildingType.TownHouse), 'Town house template is missing.');

console.log(JSON.stringify({
  generationVersion: authored.metadata.generationVersion,
  tileCount: authored.tiles.length,
  zoneOverrides: authored.tiles.filter((candidate) => candidate.hasZoneOverride).length,
  mixedZones: authored.zones.filter((zone) => zone.type === ZoneType.Mixed).length,
  story: {
    id: cinema.id,
    key: cinema.key,
    name: cinema.name,
    zone: cinema.zoneType,
    influenceRadius: cinema.influenceRadius,
  },
  expandedBuildingTypes: [BuildingType.Mall, BuildingType.NipaHut, BuildingType.TownHouse, BuildingType.Cinema],
}, null, 2));
