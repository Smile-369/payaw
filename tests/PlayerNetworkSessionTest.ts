import { commandPayloadBytes, commandRequestError, isRetryableCommandError, validateCommandPayload } from '../src/netcode/CommandValidation';
import { PlayerNetworkSession } from '../src/netcode/PlayerNetworkSession';
import type { PlayerSessionTransport } from '../src/netcode/PlayerSessionTransport';
import type { QueuedPlayerCommand } from '../src/netcode/NetcodeTypes';
import { applyPlayerCommand, type PlayerCommand } from '../src/player/PlayerCommands';
import { parsePlayerProjection } from '../src/player/PlayerProjection';
import { createEmptyCharacterSheet, writeStoredCharacterSheet } from '../src/player/CharacterSheetImport';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const storage = new Map<string, string>();
const timers = new Map<number, () => void>();
let timerId = 0;
let online = true;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get onLine() { return online; } } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
  setInterval: () => ++timerId,
  clearInterval: () => undefined,
  setTimeout: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; },
  clearTimeout: (id: number) => timers.delete(id),
}) });
Object.defineProperty(globalThis, 'document', { configurable: true, value: Object.assign(new EventTarget(), { visibilityState: 'visible' }) });

const queueKey = 'payaw:netcode:queue:campaign:safe:user:safe';
function baseProjection() {
  return parsePlayerProjection({
    projectionVersion: 1, revision: 10, generatedAt: '2026-07-23T00:00:00.000Z',
    campaign: { id: 'campaign:safe', name: 'Payaw', status: 'active', campaignTime: '2026-07-23T00:00:00.000Z', timezone: 'Asia/Manila', weather: '', publicConditions: [] },
    viewer: { id: 'viewer:safe', displayName: 'Player 1', characterId: 'character:safe', characterName: 'Ana', color: '#73b7a4' },
    capabilities: ['character.edit.self', 'journal.write.private', 'objective.propose'],
    map: { base: { columns: 1, rows: 1, worldWidth: 100, worldHeight: 100, terrainRows: ['L'] }, worldRecipe: null, unexploredTreatment: 'paper', roads: [], buildings: [], features: [], partyPosition: null, tileSizeMeters: 125 },
    knownNpcs: [], knownLocations: [], clues: [], handouts: [], messages: [],
    character: { id: 'character:safe', name: 'Ana', pronouns: '', background: '', portraitUri: null, stats: {}, conditions: [], inventory: [], privateNotes: 'Original notes', editableFields: ['privateNotes'] },
    journal: { personal: [], shared: [] }, objectives: [], diceRolls: [], notifications: [],
  });
}

const notes = { kind: 'character.update', field: 'privateNotes', value: 'Pending notes' } satisfies PlayerCommand;
const objective: PlayerCommand = { kind: 'objective.propose', wording: 'Explore the port' };

function queued(command: PlayerCommand, id: string): QueuedPlayerCommand {
  return { campaignId: 'campaign:safe', idempotencyKey: id, command, expectedRevision: 10, offlineSafe: true, queuedAt: '2026-07-23T00:00:00.000Z', attempts: 0 };
}

function fixture(queue: QueuedPlayerCommand[] = [], cached = baseProjection()) {
  storage.clear(); timers.clear(); online = true;
  storage.set(queueKey, JSON.stringify(queue));
  let server = baseProjection();
  let subscriptions = 0;
  let reject: (command: PlayerCommand) => unknown = () => undefined;
  const calls: { command: PlayerCommand; key: string }[] = [];
  const gateway: PlayerSessionTransport = {
    uploadCharacterImage: async () => 'unused', resolveCharacterImage: async (uri) => uri,
    diceEvents: async () => [],
    assignedSlot: async () => ({ campaign_id: 'campaign:safe', source_player_id: 'viewer:safe', assigned_user_id: 'user:safe', assigned_character_id: 'character:safe', display_name: 'Player 1', projection_version: 1, revision: server.revision, projection: server, generated_at: server.generatedAt }),
    subscribePlayer: async () => { subscriptions++; return () => undefined; },
    submitCommand: async (_campaign, command, _revision, _safe, key) => {
      calls.push({ command, key });
      const error = reject(command);
      if (error !== undefined) throw error;
      server = applyPlayerCommand(server, command);
      return { projection: server, diceRoll: null };
    },
  };
  const session = new PlayerNetworkSession('campaign:safe', 'user:safe', cached, gateway, {
    userId: 'user:safe', displayName: 'Player 1', role: 'player', sourcePlayerId: 'viewer:safe', view: 'player', state: 'online', onlineAt: cached.generatedAt,
  });
  return { session, calls, subscriptions: () => subscriptions, rejectWith: (fn: typeof reject) => { reject = fn; } };
}

async function expectRejected(operation: () => unknown | Promise<unknown>, message: string) {
  let rejected = false;
  try { await operation(); } catch { rejected = true; }
  assert(rejected, message);
}

async function main() {
  const overhead = commandPayloadBytes({ ...notes, value: '' });
  const boundary = { ...notes, value: 'x'.repeat(32768 - overhead) };
  assert(commandPayloadBytes(boundary) === 32768, 'Complete command byte boundary is wrong.');
  validateCommandPayload(boundary);
  await expectRejected(() => validateCommandPayload({ ...boundary, value: `${boundary.value}x` }), 'Oversized ASCII was accepted.');
  await expectRejected(() => validateCommandPayload({ ...notes, value: '🎲'.repeat(9000) }), 'UTF-8 bytes were counted as characters.');
  assert(commandPayloadBytes({ kind: 'objective.propose', wording: 'a"\nb' }) === new TextEncoder().encode('{"kind": "objective.propose", "wording": "a\\"\\nb"}').byteLength, 'JSON escaping was not included.');
  const largeSheet: PlayerCommand = { kind: 'character.sheet.update', character: {
    name: 'Ana', pronouns: '', background: 'b'.repeat(2000), portraitUri: null, galleryUris: [], stats: {}, conditions: [], inventory: [],
    privateNotes: writeStoredCharacterSheet(createEmptyCharacterSheet('Ana'), 'n'.repeat(30000)),
  } };
  validateCommandPayload({ ...largeSheet, character: { ...largeSheet.character, background: '', privateNotes: writeStoredCharacterSheet(createEmptyCharacterSheet('Ana'), '') } });
  await expectRejected(() => validateCommandPayload(largeSheet), 'Nested sheet metadata bypassed complete payload validation.');
  for (const [message, status, retryable] of [
    ['PAYLOAD_TOO_LARGE', 400, false], ['CAPABILITY_DENIED', 403, false], ['BAD_REQUEST', 400, false],
    ['STALE_REVISION', 400, true], ['REVISION_CONFLICT', 409, true], ['RATE_LIMITED', 400, true],
    ['Expired token', 401, true], ['Unavailable', 503, true], ['Too many requests', 429, true],
  ] as const) assert(isRetryableCommandError(commandRequestError(message, status)) === retryable, `Wrong retry classification: ${message}`);
  assert(isRetryableCommandError(new TypeError('Failed to fetch')), 'Network failures must remain retryable.');

  const oversized = fixture();
  online = false;
  await expectRejected(() => oversized.session.submit(largeSheet), 'Oversized offline sheet was queued.');
  assert(oversized.session.connection().pendingCommands === 0 && oversized.calls.length === 0, 'Preflight rejection modified the queue or called the server.');

  // Exercise the real offline optimistic path, then reject its head on reconnect.
  const offline = fixture();
  online = false;
  await offline.session.submit(notes);
  await offline.session.submit(objective);
  assert(offline.session.projection().revision === 12, 'Offline edits were not optimistic.');
  offline.rejectWith((command) => command.kind === 'character.update' ? commandRequestError('CAPABILITY_DENIED', 403) : undefined);
  online = true;
  await offline.session.start();
  assert(offline.calls.length === 2 && offline.session.connection().pendingCommands === 0, 'A permanent rejection blocked the next command.');
  assert(offline.session.projection().character?.privateNotes === 'Original notes', 'Rejected optimistic notes remained in the projection.');
  assert(offline.session.projection().objectives.length === 1, 'The later valid command was lost.');
  assert(offline.session.connection().state === 'online' && offline.session.connection().lastCommandError?.includes('CAPABILITY_DENIED'), 'Rejection notice disappeared after successful sync.');
  assert([...storage.entries()].some(([key, value]) => key.startsWith(`${queueKey}:rejected:`) && value.includes('Pending notes')), 'Rejected edit has no recovery copy.');
  offline.session.stop();

  const cold = fixture([queued(notes, 'cold-rejected')], applyPlayerCommand(baseProjection(), notes));
  cold.rejectWith(() => commandRequestError('CAPABILITY_DENIED', 403));
  await cold.session.start();
  assert(cold.session.projection().revision === 10 && cold.session.projection().character?.privateNotes === 'Original notes', 'Cold-start optimistic cache refused authoritative rollback.');
  cold.session.stop();

  const legacy = fixture([queued(largeSheet, 'legacy-large'), queued(objective, 'legacy-valid')]);
  await legacy.session.start();
  assert(legacy.calls.length === 1 && legacy.calls[0]?.key === 'legacy-valid', 'An old oversized queue entry reached the transport or blocked later edits.');
  legacy.session.stop();

  const transient = fixture([queued(notes, 'retry-same-key')]);
  transient.rejectWith(() => commandRequestError('RATE_LIMITED', 429));
  await transient.session.start();
  assert(transient.session.connection().pendingCommands === 1 && timers.size === 1, 'Temporary rejection did not retain and schedule the command.');
  transient.rejectWith(() => undefined);
  // Fire the scheduled callback without waiting for a real clock.
  const retry = [...timers.values()][0]!; timers.clear(); retry();
  for (let step = 0; step < 20; step++) await Promise.resolve();
  assert(transient.session.connection().pendingCommands === 0 && transient.calls.length === 2, 'Scheduled retry did not drain the queue.');
  assert(transient.calls.every((call) => call.key === 'retry-same-key'), 'Retry changed the idempotency key.');
  transient.rejectWith(() => commandRequestError('BAD_REQUEST', 400));
  await expectRejected(() => transient.session.submit(notes), 'Live permanent rejection was swallowed.');
  assert(transient.session.connection().pendingCommands === 0 && timers.size === 0, 'Live permanent rejection entered the retry queue.');
  transient.session.stop();

  const denied = fixture([], parsePlayerProjection({ ...baseProjection(), capabilities: [] }));
  online = false;
  await expectRejected(() => denied.session.submit(notes), 'Offline permission failure was accepted.');
  assert(denied.session.connection().pendingCommands === 0, 'Locally invalid command poisoned the queue.');
  const reconnect = fixture();
  await reconnect.session.start();
  window.dispatchEvent(new Event('online'));
  window.dispatchEvent(new Event('online'));
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pageshow'));
  for (let step = 0; step < 20; step++) await Promise.resolve();
  assert(reconnect.subscriptions() === 1, 'Resume events created duplicate live subscriptions.');
  reconnect.session.stop();
  window.dispatchEvent(new Event('online'));
  for (let step = 0; step < 20; step++) await Promise.resolve();
  assert(reconnect.subscriptions() === 1, 'Stopped player session reconnected.');
  console.log(JSON.stringify({ completePayloadValidation: true, utf8Boundary: true, offlinePreflight: true, permanentRejectionRecovery: true, coldCacheRollback: true, legacyOversizedQueueRecovery: true, transientRetry: true, stableIdempotencyKey: true, liveRejection: true, offlinePermissionValidation: true, singleSubscriptionOnResume: true }));
}

void main().catch((error) => { console.error(error); throw error; });
