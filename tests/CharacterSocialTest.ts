import { writeStoredCharacterSheet, createEmptyCharacterSheet } from '../src/player/CharacterSheetImport';
import { createPublicCharacterProfile } from '../src/player/CharacterProfiles';
import { applyPlayerCommand } from '../src/player/PlayerCommands';
import { parsePlayerProjection, type CharacterProjection } from '../src/player/PlayerProjection';
import { DEFAULT_CHARACTER_EDITABLE_FIELDS, normalizePlayerViewState } from '../src/player/PlayerViewState';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main(): void {
  const hiddenSheet = {
    ...createEmptyCharacterSheet('Mara', 'Player One'),
    handle: 'mara_online',
    background: 'A public background.',
    currentSituation: 'Back in the province.',
    warning: 'NEVER_SHOW_TABOO',
    warningConsequence: 'NEVER_SHOW_CONSEQUENCE',
    privateWish: 'NEVER_SHOW_WISH',
    risk: 'NEVER_SHOW_RISK',
    usefulContact: 'NEVER_SHOW_CONTACT',
    worriedPerson: 'NEVER_SHOW_PERSON',
    avoidedPlace: 'NEVER_SHOW_PLACE',
    notes: 'NEVER_SHOW_NOTES',
    stats: { STR: '12', WIL: '15' },
    skills: [{
      slot: 'Major', name: 'Signal Ghost', type: 'Supernatural', role: 'Support',
      useCase: 'Trace a haunting through a network.', roll: 'INT', combatEffect: '+1d4',
      utility: 'Find a signal source.', costRisk: 'Gain 1 MALAS.',
    }],
    ultimateSkill: {
      slot: 'Ultimate', name: 'Dead Air', type: 'Supernatural', role: 'Support',
      useCase: 'Silence the whole network.', roll: 'WIL', combatEffect: 'Prepared.',
      utility: 'Prepared.', costRisk: 'Prepared.', unlocked: false,
    },
    gear: [{ item: 'Old laptop', use: 'Connect', notes: 'Cracked hinge' }],
  } as const;
  const character: CharacterProjection = {
    id: 'character:mara',
    name: 'Mara',
    pronouns: 'she/her',
    background: 'Fallback background.',
    portraitUri: 'payaw-player-asset:11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/character/33333333-3333-4333-8333-333333333333.webp',
    galleryUris: [],
    stats: { STR: '12' },
    conditions: ['Tired'],
    inventory: ['Old laptop'],
    privateNotes: writeStoredCharacterSheet(hiddenSheet, 'NEVER_SHOW_FREEFORM'),
    editableFields: [...DEFAULT_CHARACTER_EDITABLE_FIELDS],
  };
  const publicProfile = createPublicCharacterProfile({ id: 'viewer:mara', displayName: 'Player One', color: '#73b7a4' }, character);
  const publicJson = JSON.stringify(publicProfile);
  for (const secret of [
    'NEVER_SHOW_TABOO', 'NEVER_SHOW_CONSEQUENCE', 'NEVER_SHOW_WISH', 'NEVER_SHOW_RISK',
    'NEVER_SHOW_CONTACT', 'NEVER_SHOW_PERSON', 'NEVER_SHOW_PLACE', 'NEVER_SHOW_NOTES', 'NEVER_SHOW_FREEFORM',
  ]) assert(!publicJson.includes(secret), `Private field leaked into party profile: ${secret}`);
  assert(publicProfile.name === 'Mara' && publicProfile.skills[0]?.name === 'Signal Ghost', 'Public profile lost safe character-sheet fields.');
  assert(publicProfile.ultimateSkill === null, 'Locked ultimate skill was exposed to the party.');

  const unlockedNotes = writeStoredCharacterSheet({
    ...hiddenSheet,
    ultimateSkill: { ...hiddenSheet.ultimateSkill, unlocked: true },
  }, 'NEVER_SHOW_FREEFORM');
  const unlockedProfile = createPublicCharacterProfile({ id: 'viewer:mara', displayName: 'Player One', color: '#73b7a4' }, { ...character, privateNotes: unlockedNotes });
  assert(unlockedProfile.ultimateSkill?.name === 'Dead Air', 'Unlocked ultimate skill was not projected to the party.');

  const projection = parsePlayerProjection({
    projectionVersion: 1,
    generatedAt: '2026-07-26T00:00:00.000Z',
    campaign: { id: 'campaign:test', name: 'PAYAW', status: 'active', campaignTime: '', timezone: 'Asia/Manila', weather: '', publicConditions: [] },
    viewer: { id: 'viewer:mara', displayName: 'Player One', characterId: character.id, characterName: character.name, color: '#73b7a4' },
    capabilities: ['character.edit.self'],
    map: { base: null, worldRecipe: null, unexploredTreatment: 'paper', roads: [], buildings: [], features: [], partyPosition: null, tileSizeMeters: 125 },
    knownNpcs: [], knownLocations: [], clues: [], handouts: [], messages: [],
    character,
    partyCharacters: [publicProfile],
    journal: { personal: [], shared: [] }, objectives: [], diceRolls: [], notifications: [], revision: 1,
  });
  const updated = applyPlayerCommand(projection, {
    kind: 'character.sheet.update',
    character: {
      name: 'Mara Updated', pronouns: 'she/her', background: 'New public background.',
      portraitUri: character.portraitUri, galleryUris: [], stats: { STR: '13' }, conditions: ['Focused'],
      inventory: ['Old laptop'], privateNotes: unlockedNotes,
    },
  }, { now: '2026-07-26T00:01:00.000Z' });
  assert(updated.character?.name === 'Mara Updated', 'Full character-sheet update did not edit the owned character.');
  assert(updated.partyCharacters.find((profile) => profile.ownerId === projection.viewer.id)?.name === 'Mara', 'Workbook character name should remain the public display source.');
  assert(updated.partyCharacters.find((profile) => profile.ownerId === projection.viewer.id)?.ultimateSkill?.name === 'Dead Air', 'Full update did not refresh the party-safe ultimate skill.');

  const oldState = normalizePlayerViewState({
    players: [{ id: 'player-1', displayName: 'Player 1', characterId: 'character:player-1', color: '#73b7a4', active: true }],
    characters: [{
      id: 'character:player-1', ownerPlayerId: 'player-1', name: 'Old Save', pronouns: '', background: '', portraitUri: null,
      stats: {}, conditions: [], inventory: [], privateNotes: '', editableFields: ['privateNotes'],
    }],
    knowledgeGrants: [], journalEntries: [], mapPolicy: {}, capabilitiesByPlayer: {},
  }, 1);
  const upgradedFields = new Set(oldState.characters[0]?.editableFields ?? []);
  for (const field of DEFAULT_CHARACTER_EDITABLE_FIELDS) assert(upgradedFields.has(field), `Old save was not upgraded for full sheet editing: ${field}`);

  console.log(JSON.stringify({
    fullPlayerEditing: true,
    partyProfiles: true,
    hiddenFieldsExcluded: true,
    characterImages: true,
    ultimateSkillPrepared: true,
    lockedUltimateHidden: true,
    oldSaveUpgrade: true,
  }, null, 2));
}

main();
