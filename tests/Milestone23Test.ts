import { isOfflineSafeCommand } from '../src/netcode/NetcodeTypes';
import { mergePlayerOwnedProjection, mergeSharedProjectionEvent } from '../src/netcode/ProjectionMerge';
import { parsePlayerProjection, type PlayerProjection } from '../src/player/PlayerProjection';
import { createDefaultPlayerViewState, resizePlayerViewState, setPlayerMapPolicy } from '../src/player/PlayerViewState';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function baseProjection(revision: number): PlayerProjection {
  return parsePlayerProjection({
    projectionVersion: 1,
    generatedAt: '2026-07-23T00:00:00.000Z',
    campaign: { id: 'campaign:safe', name: 'Hidden Payaw', status: 'active', campaignTime: '2026-07-23T00:00:00.000Z', timezone: 'Asia/Manila', weather: 'Rain', publicConditions: [] },
    viewer: { id: 'viewer:safe', displayName: 'Player 1', characterId: 'character:safe', characterName: 'Ana', color: '#73b7a4' },
    capabilities: ['character.edit.self', 'journal.write.private', 'map.ping', 'dice.roll', 'objective.propose', 'message.send.party'],
    map: { base: { columns: 1, rows: 1, worldWidth: 100, worldHeight: 100, terrainRows: ['L'] }, worldRecipe: null, unexploredTreatment: 'paper', roads: [], buildings: [], features: [], partyPosition: null, tileSizeMeters: 125 },
    knownNpcs: [], knownLocations: [], clues: [], handouts: [], messages: [{ id: 'thread:one', name: 'Friends', medium: 'Messenger', canReply: true, messages: [] }],
    character: { id: 'character:safe', name: 'Ana', pronouns: '', background: '', portraitUri: null, stats: {}, conditions: [], inventory: [], privateNotes: '', editableFields: ['privateNotes'] },
    journal: { personal: [], shared: [] }, objectives: [], diceRolls: [], notifications: [], revision,
  });
}

function main(): void {
  const generated = { ...baseProjection(12), knownNpcs: [{ id: 'npc:new', name: 'Revealed NPC', knowledge: 'discovered' as const, description: '', occupation: null, relationship: null, lastKnownContext: '', portraitUri: null, facts: [] }] };
  const hosted = {
    ...baseProjection(15),
    knownNpcs: [{ id: 'npc:stale', name: 'Revoked Secret', knowledge: 'investigated' as const, description: '', occupation: null, relationship: null, lastKnownContext: '', portraitUri: null, facts: [] }],
    character: { ...baseProjection(15).character!, privateNotes: 'Player-owned note' },
    journal: { personal: [{ id: 'journal:one', title: 'Theory', body: 'The bell matters.', ownerLabel: 'Player 1', sharedWithParty: false, linkedEntityIds: [], createdAt: '2026-07-23T00:00:00.000Z', updatedAt: '2026-07-23T00:00:00.000Z' }], shared: [] },
    map: { ...baseProjection(15).map, features: [{ id: 'ping:one', kind: 'ping' as const, label: 'Look here', knowledge: 'visited' as const, position: { x: 20, y: 20 }, approximateRadius: null, detail: 'Temporary player ping', linkedEntityId: null, color: '#73b7a4', expiresAt: '2099-01-01T00:00:00.000Z' }] },
    messages: [{ ...baseProjection(15).messages[0]!, messages: [{ id: 'message:player', senderLabel: 'Ana', body: 'Are you there?', sentAt: '2026-07-23T00:00:00.000Z', status: 'sent' as const, presentation: { glitch: false, corruption: 0 } }] }],
    objectives: [{ id: 'objective:player', wording: 'Check the bell tower', status: 'proposed' as const, completionNote: '', playerCreated: true }],
    diceRolls: [{ id: 'roll:one', rollerUsername: 'PLAYER_ONE', notation: '1d20', values: [12], modifier: 0, total: 12, visibility: 'party' as const, rolledAt: '2026-07-23T00:00:00.000Z' }],
  };
  const merged = mergePlayerOwnedProjection(parsePlayerProjection(generated), parsePlayerProjection(hosted));
  const json = JSON.stringify(merged);
  assert(merged.knownNpcs.some((npc) => npc.name === 'Revealed NPC'), 'Fresh GM reveal was lost.');
  assert(!json.includes('Revoked Secret'), 'Stale hosted knowledge survived a GM revoke.');
  assert(merged.character?.privateNotes === 'Player-owned note', 'Editable player character field was overwritten.');
  assert(merged.journal.personal.some((entry) => entry.id === 'journal:one'), 'Player journal was overwritten.');
  assert(merged.map.features.some((feature) => feature.id === 'ping:one'), 'Unexpired player ping was overwritten.');
  assert(merged.messages[0]?.messages.some((message) => message.id === 'message:player'), 'Player message was overwritten.');
  assert(merged.objectives.some((objective) => objective.playerCreated), 'Player objective proposal was overwritten.');
  assert(merged.diceRolls.length === 0, 'Legacy dice history was copied back into the durable player slot.');
  assert(merged.revision === 15, 'Projection merge moved the revision backwards.');
  const sharedPing = mergeSharedProjectionEvent(baseProjection(20), 'command.map.ping', {
    ping: {
      id: 'ping:party',
      kind: 'ping',
      label: 'Party ping',
      knowledge: 'visited',
      position: { x: 40, y: 30 },
      approximateRadius: null,
      detail: 'Temporary player ping',
      linkedEntityId: null,
      color: '#73b7a4',
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  });
  assert(sharedPing.map.features.some((feature) => feature.id === 'ping:party'), 'Realtime party ping was not merged.');
  const sharedMessage = mergeSharedProjectionEvent(sharedPing, 'command.message.send', {
    threadId: 'thread:one',
    message: {
      id: 'message:party',
      senderLabel: 'Bea',
      body: 'Meet at the bridge.',
      sentAt: '2026-07-23T00:00:00.000Z',
      status: 'sent',
      presentation: { glitch: false, corruption: 0 },
    },
  });
  assert(sharedMessage.messages[0]?.messages.some((message) => message.id === 'message:party'), 'Realtime party message was not merged.');
  const deduplicated = mergeSharedProjectionEvent(sharedMessage, 'command.message.send', {
    threadId: 'thread:one',
    message: sharedMessage.messages[0]?.messages[0],
  });
  assert(deduplicated === sharedMessage, 'Duplicate collaboration event caused a second render.');
  assert(isOfflineSafeCommand({ kind: 'journal.create', title: 'x', body: '', sharedWithParty: false }), 'Private journal write should be offline-safe.');
  assert(!isOfflineSafeCommand({ kind: 'dice.roll', notation: '1d20', visibility: 'party' }), 'Dice must not be queued offline.');
  assert(!isOfflineSafeCommand({ kind: 'message.send', threadId: 'x', body: 'x', privateToGm: false }), 'Shared messages must not be queued offline.');
  const originalTable = createDefaultPlayerViewState(6);
  assert(originalTable.capabilitiesByPlayer['player-1']?.includes('journal.write.private') === true, 'Private journal should be enabled by default.');
  assert(originalTable.capabilitiesByPlayer['player-1']?.includes('message.send.party') === false, 'Shared messages must be denied by default.');
  assert(
    originalTable.mapPolicy.includeBaseGeography
      && originalTable.mapPolicy.includePublicRoads
      && originalTable.mapPolicy.includeBuildingFootprints,
    'Ordinary town geometry must be public in new player views.',
  );
  const attemptedHide = setPlayerMapPolicy(originalTable, {
    includeBaseGeography: false,
    includePublicRoads: false,
    includeBuildingFootprints: false,
  });
  assert(
    attemptedHide.mapPolicy.includeBaseGeography
      && attemptedHide.mapPolicy.includePublicRoads
      && attemptedHide.mapPolicy.includeBuildingFootprints,
    'The public town-map baseline can be accidentally disabled.',
  );
  const expandedTable = resizePlayerViewState(originalTable, 10);
  assert(expandedTable.players.length === 10 && expandedTable.characters.length === 10, 'The player table did not expand to the GM-configured size.');
  assert(expandedTable.players[0]?.id === originalTable.players[0]?.id, 'Expanding the table replaced an existing player.');
  const reducedTable = resizePlayerViewState(expandedTable, 3);
  assert(reducedTable.players.length === 3 && reducedTable.characters.length === 3, 'The player table did not shrink to the GM-configured size.');
  assert(Object.keys(reducedTable.capabilitiesByPlayer).length === 3, 'Removed player capabilities survived a table resize.');
  console.log(JSON.stringify({
    projectionMerge: true, staleKnowledgeRemoved: true, playerOwnedDataPreserved: true, eventBackedDice: true,
    monotonicRevision: true, offlineQueueAllowlist: true, configurablePlayerCount: true,
    denyByDefault: true, publicTownMapBaseline: true, realtimeCollaborationDelta: true,
  }, null, 2));
}

main();
