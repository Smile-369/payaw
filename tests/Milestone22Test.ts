import { EMPTY_AUTHORING_LAYER } from '../src/authoring/AuthoringLayer';
import {
  activateScene,
  addMessageDraft,
  createAsset,
  createCampaign,
  createClue,
  createHandout,
  createMessageThread,
  createObjective,
  createScene,
  sendCampaignMessage,
  stageSceneParticipant,
} from '../src/campaign/CampaignSystem';
import { EMPTY_NPC_LOCATION_AUTHORING, collectCampaignLocations } from '../src/campaign/NPCLocationAuthoring';
import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale, type GenerationOptions } from '../src/engine/generation/GenerationOptions';
import { applyPlayerCommand, PlayerPermissionError } from '../src/player/PlayerCommands';
import { PLAYER_PROJECTION_VERSION, ProjectionVersionError, parsePlayerProjection } from '../src/player/PlayerProjection';
import { createPlayerProjection } from '../src/player/ProjectionService';
import { hydratePlayerWorldGenerationOptions } from '../src/player/PlayerWorldRecipe';
import {
  createDefaultPlayerViewState,
  createKnowledgeGrant,
  revokeKnowledgeGrant,
  setPlayerCapabilities,
  upsertKnowledgeGrant,
} from '../src/player/PlayerViewState';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const options: GenerationOptions = {
  terrainShape: TerrainShape.SingleLargeIsland,
  terrainSize: TerrainSize.Small,
  townScale: TownScale.SemiUrban,
  islandCount: 1,
  islandSpacingKilometers: 4,
  satelliteSettlementCount: 0,
};

function main(): void {
  const now = '2026-07-24T12:00:00.000Z';
  const future = '2026-07-25T12:00:00.000Z';
  const world = new GenerationPipeline().generate('payaw-ms22-player-projection', options);
  const visibleNpc = world.npcs[0];
  const privateNpc = world.npcs[1];
  const hiddenNpc = world.npcs[2];
  assert(visibleNpc !== undefined && privateNpc !== undefined && hiddenNpc !== undefined, 'Fixture world did not generate enough NPCs.');
  const location = collectCampaignLocations(world, EMPTY_AUTHORING_LAYER)[0];
  assert(location !== undefined, 'Fixture world did not generate a player-map location.');
  const storyLocation = world.storyObjects[0];
  assert(storyLocation !== undefined, 'Fixture world did not generate a story location.');

  let campaign = createCampaign(`world:${world.seed}`, 'Hidden Payaw', now, 'Asia/Manila');
  campaign = createScene(campaign, {
    id: 'scene:active', name: 'The Old School', status: 'ready', locationRef: location.ref,
    playerDescription: 'Rain taps against the classroom windows.', readAloud: 'The hallway smells of wet paper.',
    gmDescription: 'GM-ONLY-SCENE-SECRET',
  }, 'GM', now);
  campaign = stageSceneParticipant(campaign, 'scene:active', { id: visibleNpc.key, type: 'npc', label: visibleNpc.name, hidden: false }, true, 'GM', now);
  campaign = stageSceneParticipant(campaign, 'scene:active', { id: hiddenNpc.key, type: 'npc', label: hiddenNpc.name, hidden: true }, true, 'GM', now);
  campaign = createAsset(campaign, {
    id: 'asset:photo', name: 'Class Photograph', type: 'image', uri: 'https://example.com/class-photo.png',
    mimeType: 'image/png', alternateText: 'A faded class photograph.', rightsNote: 'GM-ONLY-ASSET-NOTE',
  }, 'GM', now);
  campaign = createClue(campaign, {
    id: 'clue:photo', gmTitle: 'GM-ONLY-CLUE-TITLE', playerTitle: 'Class Photograph', description: 'One face has been scratched out.',
  }, 'GM', now);
  campaign = createHandout(campaign, { id: 'handout:photo', title: 'Class Photograph', assetId: 'asset:photo', caption: 'Class of 1998' }, 'GM', now);
  campaign = createObjective(campaign, {
    id: 'objective:school', gmIntent: 'GM-ONLY-OBJECTIVE-INTENT', playerWording: 'Find out who scratched the photograph.', status: 'active',
  }, 'GM', now);
  campaign = createMessageThread(campaign, 'Old Friends', 'Messenger', 'GM', now);
  const thread = campaign.messageThreads[0];
  assert(thread !== undefined, 'Message thread was not created.');
  campaign = addMessageDraft(campaign, thread.id, {
    id: 'message:sent', senderRef: privateNpc.key, senderLabel: 'fallen_angel', body: 'Are you still at the school?', audience: 'party', status: 'draft',
  }, 'GM', now);
  campaign = sendCampaignMessage(campaign, thread.id, 'message:sent', 'GM', now);
  campaign = addMessageDraft(campaign, thread.id, {
    id: 'message:future', senderRef: hiddenNpc.key, senderLabel: 'unknown', body: 'GM-ONLY-FUTURE-MESSAGE', audience: 'party', status: 'queued', scheduledAt: future,
  }, 'GM', now);
  campaign = activateScene(campaign, 'scene:active', 'GM', now);

  let playerView = createDefaultPlayerViewState(2);
  playerView = upsertKnowledgeGrant(playerView, createKnowledgeGrant({ subjectType: 'location', subjectId: location.ref, audience: 'party', level: 'visited', alias: null, source: 'Current scene', expiresAt: null, grantedAt: now }));
  playerView = upsertKnowledgeGrant(playerView, createKnowledgeGrant({ subjectType: 'npc', subjectId: privateNpc.key, audience: 'player:player-1', level: 'investigated', alias: 'A Trusted Friend', source: 'Private character knowledge', expiresAt: null, grantedAt: now }));
  playerView = upsertKnowledgeGrant(playerView, createKnowledgeGrant({ subjectType: 'clue', subjectId: 'clue:photo', audience: 'party', level: 'investigated', alias: null, source: 'Found in class', expiresAt: null, grantedAt: now }));
  playerView = upsertKnowledgeGrant(playerView, createKnowledgeGrant({ subjectType: 'handout', subjectId: 'handout:photo', audience: 'party', level: 'discovered', alias: null, source: 'GM handout', expiresAt: null, grantedAt: now }));
  playerView = upsertKnowledgeGrant(playerView, createKnowledgeGrant({ subjectType: 'message-thread', subjectId: thread.id, audience: 'party', level: 'discovered', alias: null, source: 'Delivered chat', expiresAt: null, grantedAt: now }));
  const revoked = createKnowledgeGrant({ subjectType: 'npc', subjectId: hiddenNpc.key, audience: 'party', level: 'discovered', alias: null, source: 'Mistaken reveal', expiresAt: null, grantedAt: now });
  playerView = revokeKnowledgeGrant(upsertKnowledgeGrant(playerView, revoked), revoked.id, now);

  const context = { campaign, world, authoringLayer: EMPTY_AUTHORING_LAYER, npcLocationAuthoring: EMPTY_NPC_LOCATION_AUTHORING, playerView, generationOptions: options, now };
  const first = createPlayerProjection({ ...context, viewerId: 'player-1' });
  const second = createPlayerProjection({ ...context, viewerId: 'player-2' });
  const firstJson = JSON.stringify(first);

  assert(first.projectionVersion === PLAYER_PROJECTION_VERSION, 'Player projection version is incorrect.');
  assert(Object.isFrozen(first) && Object.isFrozen(first.map), 'Projection is not deeply immutable.');
  assert(first.map.base !== null, 'Public terrain and water are absent from the default player map.');
  assert(first.map.base.terrainRows.some((row) => row.includes('W') || row.includes('w')), 'Public water is absent from the default player map.');
  if (world.tiles.some((tile) => tile.river)) assert(first.map.base.terrainRows.some((row) => row.includes('R')), 'Public rivers are absent from the default player map.');
  assert(first.map.roads.length > 0, 'Public roads are absent from the default player map.');
  assert(first.map.roads.some((road) => road.classification === 'local'), 'Local roads are absent from the default player map.');
  assert(first.map.buildings.length > 0, 'Anonymous building silhouettes are absent from the default player map.');
  assert(first.map.base?.terrainRows.every((row) => !row.includes('B')) !== false, 'Generated building footprints leaked into the player map.');
  assert(first.map.features.some((feature) => feature.kind === 'community' || feature.kind === 'anchor'), 'Ordinary settlements and anchors are absent from the default player map.');
  assert(!firstJson.includes(storyLocation.name), 'An unrevealed story location leaked into the player projection.');
  assert(first.knownLocations.length > 0 && second.knownLocations.length > 0, 'Party knowledge was not projected to both players.');
  assert(first.knownNpcs.some((npc) => npc.name === 'A Trusted Friend'), 'Private player knowledge was not projected to its audience.');
  assert(!second.knownNpcs.some((npc) => npc.name === 'A Trusted Friend'), 'Private player knowledge leaked to another player.');
  assert(first.activeScene?.presentNpcs.some((npc) => npc.name === visibleNpc.name), 'Visible scene participant is absent.');
  assert(!firstJson.includes(hiddenNpc.name), 'Hidden scene participant leaked into the player projection.');
  assert(first.messages[0]?.messages.some((message) => message.body.includes('still at the school')) === true, 'Delivered message is absent.');
  assert(!firstJson.includes('GM-ONLY-FUTURE-MESSAGE'), 'Future message leaked into the player projection.');
  for (const secret of ['GM-ONLY-SCENE-SECRET', 'GM-ONLY-ASSET-NOTE', 'GM-ONLY-CLUE-TITLE', 'GM-ONLY-OBJECTIVE-INTENT']) {
    assert(!firstJson.includes(secret), `GM-only value leaked into projection: ${secret}`);
  }
  for (const forbiddenKey of ['gmDescription', 'gmTitle', 'gmIntent', 'weeklySchedule', 'triggerConfig', 'rightsNote']) {
    assert(!firstJson.includes(`"${forbiddenKey}"`), `GM-only key leaked into projection: ${forbiddenKey}`);
  }

  assert(first.map.buildings.every((building) => building.footprint.length >= 3), 'A public building silhouette has an invalid footprint.');
  const buildingJson = JSON.stringify(first.map.buildings);
  assert(!buildingJson.includes('type') && !buildingJson.includes('name') && !buildingJson.includes('occup'), 'Player building silhouettes leaked private building metadata.');
  const storyRef = `story:${storyLocation.key}`;
  const storyState = upsertKnowledgeGrant(playerView, createKnowledgeGrant({
    subjectType: 'location', subjectId: storyRef, audience: 'party', level: 'discovered',
    alias: null, source: 'GM story reveal', expiresAt: null, grantedAt: now,
  }));
  const storyProjection = createPlayerProjection({ ...context, playerView: storyState, viewerId: 'player-1' });
  assert(storyProjection.knownLocations.some((item) => item.name === storyLocation.name), 'A GM-revealed story location is absent from Player View.');
  const recipe = first.map.worldRecipe;
  assert(recipe !== null && recipe.seed === world.seed, 'Player View did not receive the deterministic world seed.');
  assert(!firstJson.includes('baseImageDataUrl'), 'Player View still contains a baked PNG map field.');
  const playerGeneratedWorld = new GenerationPipeline().generate(
    recipe.seed,
    hydratePlayerWorldGenerationOptions(recipe),
    { stopAfterStageId: 'vegetation' },
  );
  assert(playerGeneratedWorld.width === world.width && playerGeneratedWorld.height === world.height, 'Client-generated player world dimensions differ from the GM world.');
  assert(playerGeneratedWorld.roads.length > 0 && playerGeneratedWorld.buildings.length > 0, 'Client-generated player map is missing public town geometry.');
  assert(playerGeneratedWorld.storyObjects.length === 0 && playerGeneratedWorld.npcs.length === 0, 'Player-side generation ran hidden story or NPC stages.');

  const noActionsState = setPlayerCapabilities(playerView, 'player-1', []);
  const noActions = createPlayerProjection({ ...context, playerView: noActionsState, viewerId: 'player-1' });
  let permissionDenied = false;
  try { applyPlayerCommand(noActions, { kind: 'dice.roll', notation: '1d20', visibility: 'private' }, { random: () => 0.5, now }); }
  catch (error) { permissionDenied = error instanceof PlayerPermissionError; }
  assert(permissionDenied, 'Default-deny command boundary did not reject a disabled action.');
  const diceState = setPlayerCapabilities(playerView, 'player-1', ['dice.roll']);
  const diceProjection = createPlayerProjection({ ...context, playerView: diceState, viewerId: 'player-1' });
  const rolled = applyPlayerCommand(diceProjection, { kind: 'dice.roll', notation: '2d6+1', visibility: 'private' }, { random: () => 0.5, now });
  assert(rolled.diceRolls[0]?.total === 9, 'Capability-approved dice command did not execute deterministically.');

  const parsed = parsePlayerProjection(JSON.parse(firstJson));
  assert(parsed.viewer.displayName === first.viewer.displayName, 'Safe projection could not round-trip through its parser.');
  let versionBlocked = false;
  try { parsePlayerProjection({ ...JSON.parse(firstJson), projectionVersion: 999 }); }
  catch (error) { versionBlocked = error instanceof ProjectionVersionError; }
  assert(versionBlocked, 'Incompatible projection version did not fail safely.');

  console.log(JSON.stringify({
    projectionVersion: first.projectionVersion,
    playerIsolation: true,
    hiddenParticipantOmitted: true,
    futureMessageOmitted: true,
    safeMapMarkers: first.map.features.length,
    safeBuildingSilhouettes: first.map.buildings.length,
    publicRivers: first.map.base.terrainRows.some((row) => row.includes('R')),
    storyLocationsRevealGated: true,
    clientGeneratedSeedMap: true,
    knownPeople: first.knownNpcs.length,
    privateKnowledgeIsolated: true,
    capabilityBoundary: true,
    parserFailClosed: true,
  }, null, 2));
}

main();
