import {
  CAMPAIGN_SCHEMA_VERSION,
  activateScene,
  addCampaignNote,
  addMessageDraft,
  advanceCampaignTime,
  campaignBacklinks,
  campaignExportManifest,
  createAsset,
  createCampaign,
  createCampaignExport,
  createClue,
  createHandout,
  createMessageThread,
  createObjective,
  createScene,
  createTimelineEvent,
  endEncounter,
  endSession,
  normalizeCampaignState,
  previewCampaignTimeAdvance,
  restoreCheckpoint,
  searchCampaign,
  stageSceneParticipant,
  startEncounter,
  startSession,
  setCampaignNoteCompleted,
  setCampaignTimezone,
  triggerTimelineEvent,
  updateScene,
  validateCampaignReferences,
  type CampaignState,
} from '../src/campaign/CampaignSystem';
import { GenerationPipeline } from '../src/engine/generation/GenerationPipeline';
import { TerrainShape, TerrainSize, TownScale, type GenerationOptions } from '../src/engine/generation/GenerationOptions';

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

function requireStateEntity<T>(items: readonly T[], predicate: (item: T) => boolean, message: string): T {
  const item = items.find(predicate);
  assert(item !== undefined, message);
  return item;
}

function main(): void {
  const world = new GenerationPipeline().generate('payaw-ms20-campaign-system', options);
  assert(world.metadata.schemaVersion === 20, 'World schema was not upgraded to Milestone 20.');
  assert(world.metadata.generationVersion.includes('m20-campaign-system'), 'Milestone 20 generation lineage is missing.');

  const start = '2026-07-24T11:00:00.000Z'; // 7:00 PM Manila
  let state: CampaignState = createCampaign(`world:${world.seed}`, 'Hidden Payaw', start, 'Asia/Manila');
  assert(state.schemaVersion === CAMPAIGN_SCHEMA_VERSION, 'Campaign schema is not version 20.');
  assert(state.worldRef === `world:${world.seed}`, 'Campaign is not bound to its authored world.');
  state = setCampaignTimezone(state, 'UTC', 'GM', start);
  assert(state.runState.timezone === 'UTC', 'Campaign timezone could not be authored.');
  state = setCampaignTimezone(state, 'Asia/Manila', 'GM', start);
  state = createAsset(state, {
    id: 'asset:chat', name: 'Messenger Screenshot', type: 'image', uri: 'payaw-asset:chat', mimeType: 'image/png',
    alternateText: 'A corrupted chat window showing Angelica online.', rightsNote: 'Original campaign asset.',
  }, 'GM', start);
  state = addCampaignNote(state, 'Prepare CRT monitor handout', '', 'checklist', 'GM', start);
  const checklist = requireStateEntity(state.notes, (note) => note.kind === 'checklist', 'Preparation checklist item was not created.');
  state = setCampaignNoteCompleted(state, checklist.id, true, 'GM', start);
  assert(requireStateEntity(state.notes, (note) => note.id === checklist.id, 'Checklist item missing.').completed, 'Checklist item could not be completed.');

  state = createScene(state, {
    id: 'scene:cafe',
    name: 'Old Internet Cafe',
    type: 'location',
    status: 'ready',
    locationRef: 'location:cafe',
    gmDescription: 'The fluorescent lights hum while a corrupted messenger window remains open.',
    playerDescription: 'An aging computer shop near closing time.',
    readAloud: 'The last CRT monitor flickers even though its tower is unplugged.',
  }, 'GM', start);
  state = createScene(state, {
    id: 'scene:school',
    name: 'Old School',
    type: 'location',
    status: 'ready',
    locationRef: 'location:school',
  }, 'GM', start);
  state = stageSceneParticipant(state, 'scene:cafe', {
    id: 'npc:attendant', type: 'npc', label: 'Cafe Attendant', hidden: false,
  }, true, 'GM', start);

  state = createClue(state, {
    id: 'clue:login', gmTitle: 'Angelica Login', playerTitle: 'Saved Login',
    description: 'The account is still active years after Angelica disappeared.',
    linkedEntities: [{ type: 'scene', id: 'scene:cafe' }],
  }, 'GM', start);
  state = createHandout(state, {
    id: 'handout:chat', title: 'Messenger Screenshot', assetId: 'asset:chat', caption: 'A timestamped chat window.', sceneIds: ['scene:cafe'],
  }, 'GM', start);
  state = createObjective(state, {
    id: 'objective:account', gmIntent: 'Make the group investigate the account', playerWording: 'Find out who is using Angelica’s account.', status: 'active',
  }, 'GM', start);
  state = updateScene(state, 'scene:cafe', {
    clueIds: ['clue:login'], handoutIds: ['handout:chat'],
  }, 'GM', start);

  const eventAt = '2026-07-24T11:30:00.000Z';
  state = createMessageThread(state, 'fallen_angel', 'Messenger', 'GM', start);
  const thread = requireStateEntity(state.messageThreads, (item) => item.name === 'fallen_angel', 'Message thread was not created.');
  state = addMessageDraft(state, thread.id, {
    id: 'message:first', senderRef: 'npc:angelica', senderLabel: 'fallen_angel', body: 'nandyan ka?', status: 'queued', scheduledAt: eventAt,
    style: { typingDelayMs: 1200, glitch: true, corruption: 0.2, soundAssetId: null },
  }, 'GM', start);

  state = createTimelineEvent(state, {
    id: 'event:first-message',
    name: 'Angelica replies',
    description: 'The old account sends its first message.',
    trigger: { kind: 'time', at: eventAt },
    confirmationRequired: true,
    actions: [
      { id: 'action:reveal-login', kind: 'queue-reveal', entityType: 'clue', entityId: 'clue:login', audience: 'party' },
      { id: 'action:send-message', kind: 'send-message', threadId: thread.id, messageId: 'message:first' },
      { id: 'action:weather', kind: 'set-weather', weather: 'rain' },
      { id: 'action:note', kind: 'add-note', text: 'The message arrived while the monitor was unplugged.' },
    ],
    targetSceneId: 'scene:cafe',
  }, 'GM', start);

  const preview = previewCampaignTimeAdvance(state, 60);
  assert(preview.eligibleEventIds.includes('event:first-message'), 'Time preview did not identify a crossed timeline event.');
  assert(preview.largeJump === false, 'A one-hour jump was incorrectly treated as a large jump.');
  assert(previewCampaignTimeAdvance(state, 240).largeJump, 'Four-hour jump confirmation signal is missing.');

  state = startSession(state, {
    title: 'Session 1 — The Login', attendeeRefs: ['character:1', 'character:2'], openingSceneId: 'scene:cafe', openingTime: start,
  }, 'GM', start);
  assert(state.runState.activeSessionId !== null, 'Session did not start.');
  assert(state.runState.activeSceneId === 'scene:cafe', 'Opening scene did not activate.');
  assert(state.checkpoints.length === 1, 'Pre-session checkpoint was not created.');
  assert(requireStateEntity(state.scenes, (scene) => scene.id === 'scene:cafe', 'Cafe scene missing.').status === 'active', 'Opening scene status is not active.');

  const timeResult = advanceCampaignTime(state, 30, 'GM', eventAt);
  state = timeResult.state;
  assert(requireStateEntity(state.timelineEvents, (event) => event.id === 'event:first-message', 'Timeline event missing.').status === 'eligible', 'Crossed timeline event was not marked eligible.');

  const unconfirmed = triggerTimelineEvent(state, 'event:first-message', { confirmed: false, actor: 'GM', timestamp: eventAt });
  assert(unconfirmed.requiresConfirmation, 'Unsafe event did not require GM confirmation.');
  assert(unconfirmed.state === state, 'Unconfirmed event changed campaign state.');

  const confirmed = triggerTimelineEvent(state, 'event:first-message', { confirmed: true, actor: 'GM', timestamp: eventAt });
  state = confirmed.state;
  assert(confirmed.appliedActionIds.length === 4, 'Confirmed event did not apply every action exactly once.');
  assert(state.runState.weatherOverride === 'rain', 'Timeline event did not update campaign weather.');
  assert(state.reveals.some((reveal) => reveal.entityId === 'clue:login' && reveal.revokedAt === null), 'Timeline event did not record the clue reveal.');
  assert(requireStateEntity(state.messageThreads, (item) => item.id === thread.id, 'Message thread missing.').messages[0]?.status === 'sent', 'Timeline event did not send the prepared message.');
  assert(requireStateEntity(state.timelineEvents, (event) => event.id === 'event:first-message', 'Timeline event missing.').status === 'completed', 'Triggered event did not complete.');

  const repeated = triggerTimelineEvent(state, 'event:first-message', { confirmed: true, actor: 'GM', timestamp: eventAt });
  assert(repeated.appliedActionIds.length === 0, 'Completed event actions were applied twice.');
  assert(repeated.state === state, 'Idempotent event retry changed campaign state.');

  state = startEncounter(state, 'Long-neck apparition', ['character:1', 'npc:attendant'], 'GM', eventAt);
  assert(state.runState.activeEncounterId !== null, 'Encounter marker did not start.');
  state = endEncounter(state, 'GM', eventAt);
  assert(state.runState.activeEncounterId === null, 'Encounter marker did not end.');

  const search = searchCampaign(state, 'Angelica');
  assert(search.some((result) => result.type === 'event'), 'Campaign search did not index timeline events.');
  assert(search.some((result) => result.type === 'clue'), 'Campaign search did not index clues.');
  const backlinks = campaignBacklinks(state, { type: 'clue', id: 'clue:login' });
  assert(backlinks.some((ref) => ref.type === 'scene' && ref.id === 'scene:cafe'), 'Campaign backlinks did not connect clue to scene.');

  const issues = validateCampaignReferences(state, {
    worldRef: `world:${world.seed}`,
    npcIds: new Set(['npc:attendant', 'npc:angelica']),
    locationIds: new Set(['location:cafe', 'location:school']),
    characterIds: new Set(['character:1', 'character:2']),
    externalAssetIds: new Set(),
  });
  assert(issues.length === 0, `Valid campaign has broken references: ${issues.map((issue) => issue.message).join('; ')}`);
  const brokenIssues = validateCampaignReferences(state, {
    worldRef: 'world:wrong', npcIds: new Set(), locationIds: new Set(), characterIds: new Set(), externalAssetIds: new Set(),
  });
  assert(brokenIssues.some((issue) => issue.field === 'worldRef'), 'World-reference mismatch was not detected.');
  assert(brokenIssues.some((issue) => issue.field === 'participants'), 'Missing participant reference was not detected.');

  state = activateScene(state, 'scene:cafe', 'GM', eventAt);
  state = endSession(state, 'The group discovered that Angelica’s account is still active.', 'GM', '2026-07-24T14:00:00.000Z');
  assert(state.runState.activeSessionId === null, 'Session did not end.');
  assert(state.sessions[0]?.status === 'completed', 'Session record was not completed.');
  assert(state.sessions[0]?.recap.includes('still active'), 'Session recap was not saved.');
  assert(state.checkpoints.length === 2, 'End-of-session checkpoint was not created.');
  assert(state.sessions[0]?.unusedPreparedSceneIds.includes('scene:school'), 'Unused prepared scene was not surfaced for follow-up prep.');
  const restored = restoreCheckpoint(state, state.checkpoints[0]!.id, 'GM', '2026-07-24T14:05:00.000Z');
  assert(restored.runState.activeSessionId === null, 'Pre-session checkpoint did not restore its run state.');
  assert(restored.reveals.length === 0, 'Checkpoint restore did not restore reveal state.');

  const normalized = normalizeCampaignState(JSON.parse(JSON.stringify(state)), `world:${world.seed}`, start);
  assert(normalized.schemaVersion === 20, 'Campaign did not survive schema-20 normalization.');
  assert(normalized.scenes.length === state.scenes.length && normalized.sessions.length === state.sessions.length, 'Campaign entities were lost during normalization.');
  assert(normalized.runState.revision === state.runState.revision, 'Campaign revision was not preserved.');

  const manifest = campaignExportManifest(normalized, '2026-07-24T15:00:00.000Z');
  assert(manifest.entityCounts.scenes === 2, 'Campaign export manifest scene count is wrong.');
  const exported = createCampaignExport(normalized, '2026-07-24T15:00:00.000Z');
  assert(exported.format === 'payaw-campaign', 'Standalone campaign export format is missing.');

  console.log(JSON.stringify({
    schemaVersion: normalized.schemaVersion,
    worldSchemaVersion: world.metadata.schemaVersion,
    scenes: normalized.scenes.length,
    events: normalized.timelineEvents.length,
    sessions: normalized.sessions.length,
    checkpoints: normalized.checkpoints.length,
    assets: normalized.assets.length,
    checklistItems: normalized.notes.filter((note) => note.kind === 'checklist').length,
    reveals: normalized.reveals.length,
    activityRecords: normalized.activityLog.length,
    eventIdempotency: true,
    referenceHealth: issues.length,
  }, null, 2));
}

main();
