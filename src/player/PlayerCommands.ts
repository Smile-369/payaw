import { deepFreeze, type CharacterProjection, type PlayerProjection } from './PlayerProjection';
import { createPublicCharacterProfile, safeCharacterImageUri } from './CharacterProfiles';
import type { Capability } from './PlayerViewState';

export interface CharacterSheetUpdate {
  readonly name: string;
  readonly pronouns: string;
  readonly background: string;
  readonly portraitUri: string | null;
  readonly galleryUris: readonly string[];
  readonly stats: Readonly<Record<string, string>>;
  readonly conditions: readonly string[];
  readonly inventory: readonly string[];
  readonly privateNotes: string;
}

export type PlayerCommand =
  | { readonly kind: 'journal.create'; readonly title: string; readonly body: string; readonly sharedWithParty: boolean }
  | { readonly kind: 'journal.share'; readonly entryId: string; readonly sharedWithParty: boolean }
  | { readonly kind: 'character.update'; readonly field: CharacterProjection['editableFields'][number]; readonly value: string | readonly string[] | Readonly<Record<string, string>> | null }
  | { readonly kind: 'character.sheet.update'; readonly character: CharacterSheetUpdate }
  | { readonly kind: 'message.send'; readonly threadId: string; readonly body: string; readonly privateToGm: boolean }
  | { readonly kind: 'dice.roll'; readonly notation: string; readonly visibility: 'private' | 'party' | 'gm'; readonly rollerUsername?: string }
  | { readonly kind: 'map.ping'; readonly x: number; readonly y: number; readonly label: string }
  | { readonly kind: 'objective.propose'; readonly wording: string };

export interface PlayerCommandOptions {
  readonly now?: string | Date | number;
  readonly random?: () => number;
}

export class PlayerPermissionError extends Error {
  public constructor(public readonly requiredCapability: Capability) {
    super(`This action requires the ${requiredCapability} capability.`);
    this.name = 'PlayerPermissionError';
  }
}

function nowIso(value: string | Date | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function commandId(prefix: string): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID !== undefined) return `${prefix}:${cryptoApi.randomUUID()}`;
  return `${prefix}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function requireCapability(projection: PlayerProjection, capability: Capability): void {
  if (!projection.capabilities.includes(capability)) throw new PlayerPermissionError(capability);
}

function cleanText(value: string, maximum: number): string {
  return value.trim().slice(0, maximum);
}

function cleanList(values: readonly string[], maximumItems: number, maximumLength: number): string[] {
  return [...new Set(values.map((item) => cleanText(item, maximumLength)).filter(Boolean))].slice(0, maximumItems);
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string');
}

function cleanStats(value: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(value).slice(0, 40).flatMap(([key, item]) => {
    const cleanKey = cleanText(key, 20);
    const cleanValue = cleanText(item, 80);
    return cleanKey.length === 0 ? [] : [[cleanKey, cleanValue]];
  }));
}

function refreshOwnPublicProfile(projection: PlayerProjection, character: CharacterProjection): PlayerProjection['partyCharacters'] {
  const profile = createPublicCharacterProfile({
    id: projection.viewer.id,
    displayName: projection.viewer.displayName,
    color: projection.viewer.color,
  }, character);
  return [profile, ...projection.partyCharacters.filter((candidate) => candidate.ownerId !== profile.ownerId)];
}

function updateCharacter(
  projection: PlayerProjection,
  field: CharacterProjection['editableFields'][number],
  value: string | readonly string[] | Readonly<Record<string, string>> | null,
): PlayerProjection {
  requireCapability(projection, 'character.edit.self');
  if (projection.character === undefined) throw new Error('No owned character is available.');
  if (!projection.character.editableFields.includes(field)) throw new Error(`The GM has not enabled editing for ${field}.`);
  const character = projection.character;
  let updated: CharacterProjection;
  if (field === 'conditions' || field === 'inventory' || field === 'galleryUris') {
    const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    const list = field === 'galleryUris'
      ? values.flatMap((uri) => safeCharacterImageUri(uri) ?? []).slice(0, 6)
      : cleanList(values, field === 'inventory' ? 100 : 40, field === 'inventory' ? 300 : 160);
    updated = { ...character, [field]: list };
  } else if (field === 'stats') {
    const stats = isStringRecord(value) ? cleanStats(value) : {};
    updated = { ...character, stats };
  } else if (field === 'portraitUri') {
    updated = { ...character, portraitUri: typeof value === 'string' ? safeCharacterImageUri(value) : null };
  } else {
    const text = typeof value === 'string' ? value : '';
    updated = {
      ...character,
      [field]: cleanText(text, field === 'privateNotes' ? 32000 : field === 'background' ? 2000 : 160),
    };
  }
  return {
    ...projection,
    character: updated,
    partyCharacters: refreshOwnPublicProfile(projection, updated),
    revision: projection.revision + 1,
    generatedAt: new Date().toISOString(),
  };
}

function updateCharacterSheet(projection: PlayerProjection, value: CharacterSheetUpdate): PlayerProjection {
  requireCapability(projection, 'character.edit.self');
  if (projection.character === undefined) throw new Error('No owned character is available.');
  const editable = new Set(projection.character.editableFields);
  const current = projection.character;
  const next: CharacterProjection = {
    ...current,
    name: editable.has('name') ? cleanText(value.name, 120) || current.name : current.name,
    pronouns: editable.has('pronouns') ? cleanText(value.pronouns, 80) : current.pronouns,
    background: editable.has('background') ? cleanText(value.background, 2000) : current.background,
    portraitUri: editable.has('portraitUri') ? safeCharacterImageUri(value.portraitUri) : current.portraitUri,
    galleryUris: editable.has('galleryUris')
      ? value.galleryUris.flatMap((uri) => safeCharacterImageUri(uri) ?? []).slice(0, 6)
      : current.galleryUris,
    stats: editable.has('stats') ? cleanStats(value.stats) : current.stats,
    conditions: editable.has('conditions') ? cleanList(value.conditions, 40, 160) : current.conditions,
    inventory: editable.has('inventory') ? cleanList(value.inventory, 100, 300) : current.inventory,
    privateNotes: editable.has('privateNotes') ? cleanText(value.privateNotes, 32000) : current.privateNotes,
  };
  return {
    ...projection,
    character: next,
    partyCharacters: refreshOwnPublicProfile(projection, next),
    revision: projection.revision + 1,
    generatedAt: new Date().toISOString(),
  };
}

interface ParsedDice {
  readonly count: number;
  readonly sides: number;
  readonly modifier: number;
  readonly notation: string;
}

export function parseDiceNotation(value: string): ParsedDice {
  const normalized = value.trim().toLocaleLowerCase().replaceAll(' ', '');
  const match = /^(\d{0,2})d(\d{1,4})([+-]\d{1,3})?$/.exec(normalized);
  if (match === null) throw new Error('Use dice notation such as 1d20, 2d6+1, or 4d8-2.');
  const count = Math.max(1, Number(match[1] || 1));
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Roll between 1 and 20 dice.');
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) throw new Error('Dice must have between 2 and 1000 sides.');
  return { count, sides, modifier, notation: `${count}d${sides}${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}` };
}

function rollDice(parsed: ParsedDice, random: () => number): readonly number[] {
  return Array.from({ length: parsed.count }, () => Math.min(parsed.sides, Math.max(1, Math.floor(random() * parsed.sides) + 1)));
}

export function applyPlayerCommand(projection: PlayerProjection, command: PlayerCommand, options: PlayerCommandOptions = {}): PlayerProjection {
  const timestamp = nowIso(options.now);
  let next: PlayerProjection;
  switch (command.kind) {
    case 'journal.create': {
      requireCapability(projection, command.sharedWithParty ? 'journal.share.party' : 'journal.write.private');
      const entry = {
        id: commandId('journal'),
        title: cleanText(command.title, 160) || 'Untitled note',
        body: cleanText(command.body, 20000),
        ownerLabel: projection.viewer.displayName,
        sharedWithParty: command.sharedWithParty,
        linkedEntityIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      next = {
        ...projection,
        journal: {
          personal: [...projection.journal.personal, entry],
          shared: command.sharedWithParty ? [...projection.journal.shared, entry] : projection.journal.shared,
        },
        revision: projection.revision + 1,
        generatedAt: timestamp,
      };
      break;
    }
    case 'journal.share': {
      requireCapability(projection, 'journal.share.party');
      const original = projection.journal.personal.find((entry) => entry.id === command.entryId);
      if (original === undefined) throw new Error('That journal entry is not available to this player.');
      const updated = { ...original, sharedWithParty: command.sharedWithParty, updatedAt: timestamp };
      next = {
        ...projection,
        journal: {
          personal: projection.journal.personal.map((entry) => entry.id === original.id ? updated : entry),
          shared: command.sharedWithParty
            ? [...projection.journal.shared.filter((entry) => entry.id !== original.id), updated]
            : projection.journal.shared.filter((entry) => entry.id !== original.id),
        },
        revision: projection.revision + 1,
        generatedAt: timestamp,
      };
      break;
    }
    case 'character.update':
      next = { ...updateCharacter(projection, command.field, command.value), generatedAt: timestamp };
      break;
    case 'character.sheet.update':
      next = { ...updateCharacterSheet(projection, command.character), generatedAt: timestamp };
      break;
    case 'message.send': {
      requireCapability(projection, command.privateToGm ? 'message.send.private' : 'message.send.party');
      const body = cleanText(command.body, 4000);
      if (body.length === 0) throw new Error('Write a message before sending.');
      const thread = projection.messages.find((candidate) => candidate.id === command.threadId);
      if (thread === undefined || !thread.canReply) throw new Error('Replies are not enabled for that thread.');
      const message = {
        id: commandId('message'),
        senderLabel: projection.viewer.characterName,
        body,
        sentAt: timestamp,
        status: 'sent' as const,
        presentation: { glitch: false, corruption: 0 },
      };
      next = {
        ...projection,
        messages: projection.messages.map((candidate) => candidate.id === thread.id ? { ...candidate, messages: [...candidate.messages, message] } : candidate),
        revision: projection.revision + 1,
        generatedAt: timestamp,
      };
      break;
    }
    case 'dice.roll': {
      requireCapability(projection, 'dice.roll');
      const parsed = parseDiceNotation(command.notation);
      const values = rollDice(parsed, options.random ?? Math.random);
      const total = values.reduce((sum, value) => sum + value, 0) + parsed.modifier;
      const roll = {
        id: commandId('roll'),
        rollerUsername: cleanText(command.rollerUsername ?? projection.viewer.displayName, 24) || 'PLAYER',
        notation: parsed.notation,
        values,
        modifier: parsed.modifier,
        total,
        visibility: 'party' as const,
        rolledAt: timestamp,
      };
      next = { ...projection, diceRolls: [roll, ...projection.diceRolls].slice(0, 100), revision: projection.revision + 1, generatedAt: timestamp };
      break;
    }
    case 'map.ping': {
      requireCapability(projection, 'map.ping');
      if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) throw new Error('Choose a valid map position.');
      const maximumX = projection.map.base?.worldWidth ?? Number.POSITIVE_INFINITY;
      const maximumY = projection.map.base?.worldHeight ?? Number.POSITIVE_INFINITY;
      if (command.x < 0 || command.y < 0 || command.x > maximumX || command.y > maximumY) throw new Error('The map ping is outside the revealed map.');
      const ping = {
        id: commandId('ping'),
        kind: 'ping' as const,
        label: cleanText(command.label, 80) || `${projection.viewer.characterName}'s ping`,
        knowledge: 'visited' as const,
        position: { x: command.x, y: command.y },
        approximateRadius: null,
        detail: 'Temporary player ping',
        linkedEntityId: null,
        color: projection.viewer.color,
        expiresAt: new Date(Date.parse(timestamp) + 15 * 60 * 1000).toISOString(),
      };
      next = { ...projection, map: { ...projection.map, features: [...projection.map.features, ping] }, revision: projection.revision + 1, generatedAt: timestamp };
      break;
    }
    case 'objective.propose': {
      requireCapability(projection, 'objective.propose');
      const wording = cleanText(command.wording, 500);
      if (wording.length === 0) throw new Error('Describe the objective you want to propose.');
      next = {
        ...projection,
        objectives: [...projection.objectives, { id: commandId('objective'), wording, status: 'proposed', completionNote: '', playerCreated: true }],
        revision: projection.revision + 1,
        generatedAt: timestamp,
      };
      break;
    }
    default: {
      const exhaustive: never = command;
      throw new Error(`Unsupported player command: ${String(exhaustive)}`);
    }
  }
  return deepFreeze(next);
}
