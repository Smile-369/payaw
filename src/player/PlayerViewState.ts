export const PLAYER_VIEW_STATE_VERSION = 22 as const;

export type KnowledgeLevel = 'unknown' | 'rumored' | 'discovered' | 'visited' | 'investigated';
export type KnowledgeSubjectType =
  | 'scene'
  | 'npc'
  | 'location'
  | 'clue'
  | 'handout'
  | 'objective'
  | 'message-thread';
export type PlayerAudience = 'party' | `player:${string}`;

export type Capability =
  | 'character.edit.self'
  | 'journal.write.private'
  | 'journal.share.party'
  | 'message.send.party'
  | 'message.send.private'
  | 'dice.roll'
  | 'map.ping'
  | 'objective.propose';

export const ALL_PLAYER_CAPABILITIES: readonly Capability[] = [
  'character.edit.self',
  'journal.write.private',
  'journal.share.party',
  'message.send.party',
  'message.send.private',
  'dice.roll',
  'map.ping',
  'objective.propose',
];

export const DEFAULT_PLAYER_CAPABILITIES: readonly Capability[] = [
  'character.edit.self',
  'journal.write.private',
  'dice.roll',
];

export interface PlayerIdentityRecord {
  readonly id: string;
  readonly displayName: string;
  readonly characterId: string;
  readonly color: string;
  readonly active: boolean;
}

export interface PlayerCharacterRecord {
  readonly id: string;
  readonly ownerPlayerId: string;
  readonly name: string;
  readonly pronouns: string;
  readonly background: string;
  readonly portraitUri: string | null;
  readonly stats: Readonly<Record<string, string>>;
  readonly conditions: readonly string[];
  readonly inventory: readonly string[];
  readonly privateNotes: string;
  readonly editableFields: readonly ('name' | 'pronouns' | 'background' | 'conditions' | 'inventory' | 'privateNotes')[];
}

export interface KnowledgeGrant {
  readonly id: string;
  readonly subjectType: KnowledgeSubjectType;
  readonly subjectId: string;
  readonly audience: PlayerAudience;
  readonly level: Exclude<KnowledgeLevel, 'unknown'>;
  readonly alias: string | null;
  readonly source: string;
  readonly grantedAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
}

export interface PlayerJournalRecord {
  readonly id: string;
  readonly ownerPlayerId: string;
  readonly title: string;
  readonly body: string;
  readonly sharedWithParty: boolean;
  readonly linkedSubjectIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlayerMapPolicy {
  readonly includeBaseGeography: boolean;
  readonly includePublicRoads: boolean;
  readonly includeBuildingFootprints: boolean;
  readonly unexploredTreatment: 'paper' | 'fog' | 'blank';
  readonly publicConditions: readonly string[];
}

export interface PlayerViewState {
  readonly schemaVersion: typeof PLAYER_VIEW_STATE_VERSION;
  readonly players: readonly PlayerIdentityRecord[];
  readonly characters: readonly PlayerCharacterRecord[];
  readonly knowledgeGrants: readonly KnowledgeGrant[];
  readonly journalEntries: readonly PlayerJournalRecord[];
  readonly capabilitiesByPlayer: Readonly<Record<string, readonly Capability[]>>;
  readonly mapPolicy: PlayerMapPolicy;
}

const PLAYER_COLORS = ['#73b7a4', '#e7b56c', '#9c8fd9', '#d98784', '#7ca8d8', '#b5bd77'] as const;
export const MIN_PLAYER_COUNT = 1;
export const MAX_PLAYER_COUNT = 32;

function clampPlayerCount(value: number): number {
  return Math.max(MIN_PLAYER_COUNT, Math.min(MAX_PLAYER_COUNT, Math.round(value)));
}

function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID !== undefined) return `${prefix}:${cryptoApi.randomUUID()}`;
  return `${prefix}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? unique(value.filter((item): item is string => typeof item === 'string')) : [];
}

function validIso(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function normalizeCapabilities(value: unknown): Capability[] {
  const allowed = new Set<Capability>(ALL_PLAYER_CAPABILITIES);
  return stringArray(value).filter((item): item is Capability => allowed.has(item as Capability));
}

export function createDefaultPlayerViewState(playerCount = 6): PlayerViewState {
  const count = clampPlayerCount(playerCount);
  const players: PlayerIdentityRecord[] = [];
  const characters: PlayerCharacterRecord[] = [];
  const capabilitiesByPlayer: Record<string, readonly Capability[]> = {};
  for (let index = 0; index < count; index += 1) {
    const playerId = `player-${index + 1}`;
    const characterId = `character:player-${index + 1}`;
    players.push({
      id: playerId,
      displayName: `Player ${index + 1}`,
      characterId,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length] ?? '#73b7a4',
      active: true,
    });
    characters.push({
      id: characterId,
      ownerPlayerId: playerId,
      name: `Player Character ${index + 1}`,
      pronouns: '',
      background: '',
      portraitUri: null,
      stats: {},
      conditions: [],
      inventory: [],
      privateNotes: '',
      editableFields: ['name', 'pronouns', 'background', 'conditions', 'inventory', 'privateNotes'],
    });
    capabilitiesByPlayer[playerId] = [...DEFAULT_PLAYER_CAPABILITIES];
  }
  return {
    schemaVersion: PLAYER_VIEW_STATE_VERSION,
    players,
    characters,
    knowledgeGrants: [],
    journalEntries: [],
    capabilitiesByPlayer,
    mapPolicy: {
      includeBaseGeography: true,
      includePublicRoads: true,
      includeBuildingFootprints: true,
      unexploredTreatment: 'paper',
      publicConditions: [],
    },
  };
}

export function normalizePlayerViewState(value: unknown, playerCount = 6): PlayerViewState {
  const defaults = createDefaultPlayerViewState(playerCount);
  if (!isRecord(value)) return defaults;
  const now = new Date().toISOString();

  const players = Array.isArray(value.players) ? value.players.flatMap((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string') return [];
    const characterId = text(candidate.characterId, `character:${candidate.id}`);
    return [{
      id: candidate.id,
      displayName: text(candidate.displayName, `Player ${index + 1}`).slice(0, 80),
      characterId,
      color: /^#[0-9a-f]{6}$/i.test(text(candidate.color)) ? text(candidate.color) : PLAYER_COLORS[index % PLAYER_COLORS.length] ?? '#73b7a4',
      active: candidate.active !== false,
    } satisfies PlayerIdentityRecord];
  }).slice(0, MAX_PLAYER_COUNT) : [];
  const normalizedPlayers = players.length > 0 ? players : defaults.players;
  const playerIds = new Set(normalizedPlayers.map((player) => player.id));

  const characters = Array.isArray(value.characters) ? value.characters.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.ownerPlayerId !== 'string' || !playerIds.has(candidate.ownerPlayerId)) return [];
    const rawStats = isRecord(candidate.stats) ? candidate.stats : {};
    const stats = Object.fromEntries(Object.entries(rawStats).filter((entry): entry is [string, string] => typeof entry[1] === 'string').slice(0, 40));
    const editable = stringArray(candidate.editableFields).filter((field): field is PlayerCharacterRecord['editableFields'][number] =>
      ['name', 'pronouns', 'background', 'conditions', 'inventory', 'privateNotes'].includes(field),
    );
    return [{
      id: candidate.id,
      ownerPlayerId: candidate.ownerPlayerId,
      name: text(candidate.name, 'Unnamed Character').slice(0, 120),
      pronouns: text(candidate.pronouns).slice(0, 80),
      background: text(candidate.background).slice(0, 2000),
      portraitUri: typeof candidate.portraitUri === 'string' ? candidate.portraitUri : null,
      stats,
      conditions: stringArray(candidate.conditions).slice(0, 40),
      inventory: stringArray(candidate.inventory).slice(0, 100),
      privateNotes: text(candidate.privateNotes).slice(0, 8000),
      editableFields: editable.length > 0 ? editable : ['privateNotes'],
    } satisfies PlayerCharacterRecord];
  }) : [];
  const characterByOwner = new Map(characters.map((character) => [character.ownerPlayerId, character]));
  const normalizedCharacters: readonly PlayerCharacterRecord[] = normalizedPlayers.map((player, index) => characterByOwner.get(player.id) ?? defaults.characters[index] ?? ({
    id: player.characterId,
    ownerPlayerId: player.id,
    name: `Character ${index + 1}`,
    pronouns: '',
    background: '',
    portraitUri: null,
    stats: {},
    conditions: [],
    inventory: [],
    privateNotes: '',
    editableFields: ['privateNotes'],
  } satisfies PlayerCharacterRecord));

  const grants = Array.isArray(value.knowledgeGrants) ? value.knowledgeGrants.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.subjectId !== 'string') return [];
    const type = text(candidate.subjectType) as KnowledgeSubjectType;
    const audience = text(candidate.audience) as PlayerAudience;
    const level = text(candidate.level) as KnowledgeGrant['level'];
    if (!['scene', 'npc', 'location', 'clue', 'handout', 'objective', 'message-thread'].includes(type)) return [];
    if (audience !== 'party' && (!audience.startsWith('player:') || !playerIds.has(audience.slice(7)))) return [];
    if (!['rumored', 'discovered', 'visited', 'investigated'].includes(level)) return [];
    return [{
      id: candidate.id,
      subjectType: type,
      subjectId: candidate.subjectId,
      audience,
      level,
      alias: typeof candidate.alias === 'string' && candidate.alias.trim().length > 0 ? candidate.alias.trim().slice(0, 160) : null,
      source: text(candidate.source, 'GM reveal').slice(0, 240),
      grantedAt: validIso(candidate.grantedAt, now),
      expiresAt: candidate.expiresAt === null ? null : validIso(candidate.expiresAt, now),
      revokedAt: candidate.revokedAt === null ? null : validIso(candidate.revokedAt, now),
    } satisfies KnowledgeGrant];
  }).slice(0, 5000) : [];

  const journalEntries = Array.isArray(value.journalEntries) ? value.journalEntries.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.ownerPlayerId !== 'string' || !playerIds.has(candidate.ownerPlayerId)) return [];
    return [{
      id: candidate.id,
      ownerPlayerId: candidate.ownerPlayerId,
      title: text(candidate.title, 'Untitled note').slice(0, 160),
      body: text(candidate.body).slice(0, 20000),
      sharedWithParty: candidate.sharedWithParty === true,
      linkedSubjectIds: stringArray(candidate.linkedSubjectIds).slice(0, 100),
      createdAt: validIso(candidate.createdAt, now),
      updatedAt: validIso(candidate.updatedAt, now),
    } satisfies PlayerJournalRecord];
  }).slice(0, 2000) : [];

  const rawCapabilities = isRecord(value.capabilitiesByPlayer) ? value.capabilitiesByPlayer : {};
  const capabilitiesByPlayer = Object.fromEntries(normalizedPlayers.map((player) => {
    const normalized = normalizeCapabilities(rawCapabilities[player.id]);
    return [player.id, Object.hasOwn(rawCapabilities, player.id) ? normalized : [...DEFAULT_PLAYER_CAPABILITIES]];
  }));

  const rawMapPolicy = isRecord(value.mapPolicy) ? value.mapPolicy : {};
  const unexplored = text(rawMapPolicy.unexploredTreatment) as PlayerMapPolicy['unexploredTreatment'];
  return {
    schemaVersion: PLAYER_VIEW_STATE_VERSION,
    players: normalizedPlayers,
    characters: normalizedCharacters,
    knowledgeGrants: grants,
    journalEntries,
    capabilitiesByPlayer,
    mapPolicy: {
      // Ordinary geography is public campaign context. Normalize legacy saves to
      // the same baseline so only authored story knowledge remains reveal-gated.
      includeBaseGeography: true,
      includePublicRoads: true,
      includeBuildingFootprints: true,
      unexploredTreatment: ['paper', 'fog', 'blank'].includes(unexplored) ? unexplored : 'paper',
      publicConditions: stringArray(rawMapPolicy.publicConditions).slice(0, 40),
    },
  };
}

export function resizePlayerViewState(value: PlayerViewState, playerCount: number): PlayerViewState {
  const targetCount = clampPlayerCount(playerCount);
  const state = normalizePlayerViewState(value, targetCount);
  const retainedPlayers = state.players.slice(0, targetCount);
  const retainedPlayerIds = new Set(retainedPlayers.map((player) => player.id));
  const players = [...retainedPlayers];
  const characters = state.characters.filter((character) => retainedPlayerIds.has(character.ownerPlayerId));
  const capabilitiesByPlayer: Record<string, readonly Capability[]> = Object.fromEntries(
    retainedPlayers.map((player) => [player.id, state.capabilitiesByPlayer[player.id] ?? [...DEFAULT_PLAYER_CAPABILITIES]]),
  );
  const usedPlayerIds = new Set(players.map((player) => player.id));
  const usedCharacterIds = new Set(characters.map((character) => character.id));

  for (let index = players.length; index < targetCount; index += 1) {
    let sequence = index + 1;
    while (usedPlayerIds.has(`player-${sequence}`) || usedCharacterIds.has(`character:player-${sequence}`)) sequence += 1;
    const playerId = `player-${sequence}`;
    const characterId = `character:player-${sequence}`;
    players.push({
      id: playerId,
      displayName: `Player ${index + 1}`,
      characterId,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length] ?? '#73b7a4',
      active: true,
    });
    characters.push({
      id: characterId,
      ownerPlayerId: playerId,
      name: `Player Character ${index + 1}`,
      pronouns: '',
      background: '',
      portraitUri: null,
      stats: {},
      conditions: [],
      inventory: [],
      privateNotes: '',
      editableFields: ['name', 'pronouns', 'background', 'conditions', 'inventory', 'privateNotes'],
    });
    capabilitiesByPlayer[playerId] = [...DEFAULT_PLAYER_CAPABILITIES];
    usedPlayerIds.add(playerId);
    usedCharacterIds.add(characterId);
  }

  return {
    ...state,
    players,
    characters,
    knowledgeGrants: state.knowledgeGrants.filter((grant) =>
      grant.audience === 'party' || retainedPlayerIds.has(grant.audience.slice(7)),
    ),
    journalEntries: state.journalEntries.filter((entry) => retainedPlayerIds.has(entry.ownerPlayerId)),
    capabilitiesByPlayer,
  };
}

export function createKnowledgeGrant(input: Omit<KnowledgeGrant, 'id' | 'grantedAt' | 'revokedAt'> & { readonly id?: string; readonly grantedAt?: string }): KnowledgeGrant {
  const now = new Date().toISOString();
  return {
    ...input,
    id: input.id ?? createId('knowledge'),
    grantedAt: validIso(input.grantedAt, now),
    revokedAt: null,
  };
}

export function upsertKnowledgeGrant(state: PlayerViewState, grant: KnowledgeGrant): PlayerViewState {
  const duplicateIds = new Set(state.knowledgeGrants.filter((candidate) =>
    candidate.subjectType === grant.subjectType
      && candidate.subjectId === grant.subjectId
      && candidate.audience === grant.audience
      && candidate.revokedAt === null,
  ).map((candidate) => candidate.id));
  return {
    ...state,
    knowledgeGrants: [...state.knowledgeGrants.filter((candidate) => !duplicateIds.has(candidate.id)), grant],
  };
}

export function revokeKnowledgeGrant(state: PlayerViewState, grantId: string, timestamp = new Date().toISOString()): PlayerViewState {
  return {
    ...state,
    knowledgeGrants: state.knowledgeGrants.map((grant) => grant.id === grantId && grant.revokedAt === null ? { ...grant, revokedAt: validIso(timestamp, new Date().toISOString()) } : grant),
  };
}

export function updatePlayerIdentity(state: PlayerViewState, playerId: string, displayName: string, characterName: string): PlayerViewState {
  const cleanPlayerName = displayName.trim().slice(0, 80) || 'Player';
  const cleanCharacterName = characterName.trim().slice(0, 120) || 'Unnamed Character';
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, displayName: cleanPlayerName } : player),
    characters: state.characters.map((character) => character.ownerPlayerId === playerId ? { ...character, name: cleanCharacterName } : character),
  };
}

export function setPlayerCapabilities(state: PlayerViewState, playerId: string, capabilities: readonly Capability[]): PlayerViewState {
  const allowed = new Set<Capability>(ALL_PLAYER_CAPABILITIES);
  return {
    ...state,
    capabilitiesByPlayer: {
      ...state.capabilitiesByPlayer,
      [playerId]: unique(capabilities.filter((capability) => allowed.has(capability))),
    },
  };
}

export function setPlayerMapPolicy(state: PlayerViewState, policy: Partial<PlayerMapPolicy>): PlayerViewState {
  return {
    ...state,
    mapPolicy: {
      ...state.mapPolicy,
      ...policy,
      includeBaseGeography: true,
      includePublicRoads: true,
      includeBuildingFootprints: true,
      publicConditions: policy.publicConditions === undefined
        ? state.mapPolicy.publicConditions
        : unique(policy.publicConditions.map((item) => item.trim()).filter(Boolean)).slice(0, 40),
    },
  };
}
