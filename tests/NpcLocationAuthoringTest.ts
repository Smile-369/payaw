import {
  EMPTY_NPC_LOCATION_AUTHORING,
  applyNpcLocationAuthoring,
  collectCampaignLocations,
  normalizeNpcLocationAuthoring,
  resolveNpcPlacement,
  validateNpcHome,
  validateSchedule,
  venueStatusAt,
  type AuthoredLocationRecord,
  type AuthoredNPCDefinition,
  type NPCLocationAuthoringState,
} from '../src/campaign/NPCLocationAuthoring';
import { EMPTY_AUTHORING_LAYER } from '../src/authoring/AuthoringLayer';
import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale, type GenerationOptions } from '../src/engine/generation/GenerationOptions';
import { NPCStatus, type NPCScheduleEntry, type NPCScheduleLocation } from '../src/engine/npc/NPC';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const options: GenerationOptions = {
  terrainShape: TerrainShape.SingleLargeIsland,
  terrainSize: TerrainSize.Small,
  townScale: TownScale.SemiUrban,
  islandCount: 2,
  islandSpacingKilometers: 4,
  satelliteSettlementCount: 0,
};

function main(): void {
  const world = new GenerationPipeline().generate('payaw-ms19-npc-authoring', options);
  assert(world.metadata.schemaVersion >= 19, 'Milestone 19 schema version is missing.');
  assert(world.metadata.generationVersion.includes('m19-npc-location-authoring') || world.metadata.generationVersion.includes('m20-campaign-system'), 'Milestone 19 generation version is missing.');
  assert(world.settlements.length >= 1, 'A primary community anchor is required.');

  const residential = world.buildings.find((building) => collectCampaignLocations(world, EMPTY_AUTHORING_LAYER)
    .some((location) => location.ref === `building:${building.id}` && location.residential));
  const nonResidential = world.buildings.find((building) => collectCampaignLocations(world, EMPTY_AUTHORING_LAYER)
    .some((location) => location.ref === `building:${building.id}` && !location.residential));
  assert(residential !== undefined, 'Generated world has no residential building for home validation.');
  assert(validateNpcHome(world, residential.id, false) === null, 'Residential homes should be accepted.');
  if (nonResidential !== undefined) {
    assert(validateNpcHome(world, nonResidential.id, false) !== null, 'Non-residential homes should be rejected without a GM override.');
    assert(validateNpcHome(world, nonResidential.id, true) === null, 'Explicit unusual residence override should be accepted.');
  }

  for (const npc of world.npcs) {
    assert(npc.status === NPCStatus.Alive, 'Generated NPCs should not begin missing, injured, possessed, or dead.');
    assert(npc.homeBuildingId === null || validateNpcHome(world, npc.homeBuildingId, false) === null, 'Generated NPC home is not residential.');
  }

  const homeLocation: NPCScheduleLocation = {
    kind: 'home',
    ref: `building:${residential.id}`,
    label: residential.authoredName ?? 'Residential home',
    tileIndex: residential.tileIndices[0] ?? residential.entrance.roadTileIndex,
  };
  const scheduledLocation = collectCampaignLocations(world, EMPTY_AUTHORING_LAYER).find((location) => location.ref !== homeLocation.ref) ?? collectCampaignLocations(world, EMPTY_AUTHORING_LAYER)[0];
  assert(scheduledLocation !== undefined, 'No schedule location is available.');
  const scheduleLocation: NPCScheduleLocation = {
    kind: scheduledLocation.kind,
    ref: scheduledLocation.ref,
    label: scheduledLocation.label,
    tileIndex: scheduledLocation.tileIndex,
  };
  const weeklySchedule: NPCScheduleEntry[] = [{
    id: 'monday-work',
    day: 'monday',
    startMinute: 8 * 60,
    endMinute: 10 * 60,
    activity: 'Working the morning shift',
    location: scheduleLocation,
    travelMode: 'walk',
    visibility: 'gm-only',
  }];
  assert(validateSchedule(weeklySchedule).length === 0, 'Valid weekly schedule was rejected.');
  assert(validateSchedule([...weeklySchedule, { ...weeklySchedule[0]!, id: 'overlap', startMinute: 9 * 60 }]).length > 0, 'Overlapping weekly schedule was accepted.');

  const authored: AuthoredNPCDefinition = {
    key: 'npc:authored:test',
    name: 'Maria Test',
    age: 32,
    occupation: 'Bakery owner',
    status: NPCStatus.Alive,
    settlementId: world.settlements[0]!.id,
    homeBuildingId: residential.id,
    allowNonResidentialHome: false,
    workplaceBuildingId: null,
    personality: 'Careful and observant',
    wish: '',
    fear: '',
    secret: '',
    rumor: '',
    weeklySchedule,
    relationships: [],
    portraitAssetId: null,
    portraitDataUrl: null,
    publicDescription: 'Runs a small bakery.',
    gmNotes: 'Milestone test NPC.',
    tags: ['test'],
  };
  const monday0830Manila = Date.UTC(2026, 6, 20, 0, 30);
  const temporaryLocation: NPCScheduleLocation = { ...scheduleLocation, label: 'Temporary location' };
  const sceneLocation: NPCScheduleLocation = { ...scheduleLocation, label: 'Active scene' };
  const state: NPCLocationAuthoringState = {
    ...EMPTY_NPC_LOCATION_AUTHORING,
    authoredNpcs: [authored],
    temporaryOverrides: [{
      id: 'override-1', npcKey: authored.key, startsAtMs: monday0830Manila - 60_000, endsAtMs: monday0830Manila + 30 * 60_000,
      location: temporaryLocation, activity: 'Questioned by the party', reason: 'GM placement', priority: 100,
    }],
    scenePlacements: [{
      id: 'scene-placement-1', sceneId: 'scene-1', npcKey: authored.key, location: sceneLocation, activity: 'Present in scene', visibleToPlayers: true,
    }],
    activeSceneId: 'scene-1',
  };
  const authoredWorldNpcs = applyNpcLocationAuthoring(world, state);
  const maria = authoredWorldNpcs.find((npc) => npc.key === authored.key);
  assert(maria !== undefined, 'Authored NPC was not added to the campaign roster.');
  assert(resolveNpcPlacement(world, maria, state, monday0830Manila, 'Asia/Manila').source === 'scene', 'Scene placement must override every other NPC location source.');
  const withoutScene = { ...state, activeSceneId: null };
  assert(resolveNpcPlacement(world, maria, withoutScene, monday0830Manila, 'Asia/Manila').source === 'override', 'Temporary GM override must beat the weekly schedule.');
  const monday0930Manila = Date.UTC(2026, 6, 20, 1, 30);
  assert(resolveNpcPlacement(world, maria, withoutScene, monday0930Manila, 'Asia/Manila').source === 'schedule', 'Weekly schedule should resolve after the temporary override ends.');
  const monday2200Manila = Date.UTC(2026, 6, 20, 14, 0);
  assert(resolveNpcPlacement(world, maria, withoutScene, monday2200Manila, 'Asia/Manila').source === 'home', 'Unscheduled time should resolve to the residential home.');

  const venue: AuthoredLocationRecord = {
    key: 'location:test', name: 'Test Bakery', sourceRef: scheduledLocation.ref, locationType: 'bakery',
    description: '', playerDescription: '', gmNotes: '', ownerNpcKey: authored.key, tags: ['bakery'], visibility: 'players',
    venueHours: [{ day: 'monday', openMinute: 8 * 60, closeMinute: 10 * 60, closed: false }], manualStatus: null, portraitAssetId: null,
  };
  assert(venueStatusAt(venue, monday0830Manila, 'Asia/Manila') === 'open', 'Authored venue hours did not open the location.');
  assert(venueStatusAt(venue, monday0930Manila, 'Asia/Manila') === 'closing-soon', 'Closing-soon venue status is missing.');
  assert(venueStatusAt(venue, monday2200Manila, 'Asia/Manila') === 'closed', 'Venue should be closed outside authored hours.');

  const normalized = normalizeNpcLocationAuthoring(JSON.parse(JSON.stringify({ ...state, locations: [venue] })));
  assert(normalized.authoredNpcs.length === 1 && normalized.locations.length === 1, 'NPC/location authoring state did not survive normalization.');

  console.log(JSON.stringify({
    schemaVersion: world.metadata.schemaVersion,
    generationVersion: world.metadata.generationVersion,
    generatedNpcCount: world.npcs.length,
    authoredNpc: maria.name,
    residentialHomeId: maria.homeBuildingId,
    placementPrecedence: ['scene', 'override', 'schedule', 'home'],
    venueStatuses: ['open', 'closing-soon', 'closed'],
  }, null, 2));
}

main();
