import { readStoredCharacterSheet } from './CharacterSheetImport';
import type {
  CharacterGearProjection,
  CharacterProjection,
  CharacterSkillProjection,
  CharacterUltimateSkillProjection,
  PublicCharacterProfileProjection,
} from './PlayerProjection';

export interface PublicCharacterOwner {
  readonly id: string;
  readonly displayName: string;
  readonly color: string;
}

export function safeCharacterImageUri(value: string | null | undefined): string | null {
  const uri = value?.trim() ?? '';
  if (uri.length === 0 || uri.length > 1000) return null;
  if (/^https:\/\//i.test(uri) || /^data:image\/(?:png|jpeg|webp|gif);/i.test(uri)) return uri;
  if (/^payaw-player-asset:[0-9a-f-]{36}\/[0-9a-f-]{36}\/character\/[a-z0-9_.-]{1,180}$/i.test(uri)) return uri;
  return null;
}

function clean(value: string, maximum: number): string {
  return value.trim().slice(0, maximum);
}

function publicSkill(value: CharacterSkillProjection): CharacterSkillProjection {
  return {
    slot: clean(value.slot, 40),
    name: clean(value.name, 120),
    type: clean(value.type, 80),
    role: clean(value.role, 80),
    useCase: clean(value.useCase, 700),
    roll: clean(value.roll, 160),
    combatEffect: clean(value.combatEffect, 700),
    utility: clean(value.utility, 700),
    costRisk: clean(value.costRisk, 700),
  };
}

function publicGear(value: CharacterGearProjection): CharacterGearProjection {
  return {
    item: clean(value.item, 120),
    use: clean(value.use, 300),
    notes: clean(value.notes, 700),
  };
}

/**
 * Produces the only character payload that may be copied to another player's
 * projection. Private wish, taboo, consequences, risk, NPC ties, debts, and
 * freeform private notes are deliberately never represented by this type.
 */
export function createPublicCharacterProfile(
  owner: PublicCharacterOwner,
  character: CharacterProjection,
): PublicCharacterProfileProjection {
  const stored = readStoredCharacterSheet(character.privateNotes);
  const sheet = stored.sheet;
  const ultimate: CharacterUltimateSkillProjection | null = sheet?.ultimateSkill.unlocked === true
    && sheet.ultimateSkill.name.trim().length > 0
    ? { ...publicSkill(sheet.ultimateSkill), unlocked: true }
    : null;
  return {
    ownerId: owner.id,
    playerDisplayName: clean(owner.displayName, 80) || 'Player',
    color: /^#[0-9a-f]{6}$/i.test(owner.color) ? owner.color : '#73b7a4',
    name: clean(sheet?.characterName || character.name, 120) || 'Character',
    pronouns: clean(character.pronouns, 80),
    background: clean(sheet?.background || character.background, 2000),
    portraitUri: safeCharacterImageUri(character.portraitUri),
    galleryUris: character.galleryUris.flatMap((uri) => safeCharacterImageUri(uri) ?? []).slice(0, 6),
    handle: clean(sheet?.handle ?? '', 120),
    ageYear: clean(sheet?.ageYear ?? '', 120),
    connectionToGroup: clean(sheet?.connectionToGroup ?? '', 1200),
    schoolWork: clean(sheet?.schoolWork ?? '', 700),
    homeArea: clean(sheet?.homeArea ?? '', 500),
    startingItem: clean(sheet?.startingItem ?? '', 500),
    currentSituation: clean(sheet?.currentSituation ?? '', 1200),
    stats: Object.fromEntries(Object.entries(sheet?.stats ?? character.stats).slice(0, 40).map(([key, value]) => [clean(key, 20), clean(value, 80)])),
    malasCurrent: clean(sheet?.malasCurrent ?? '', 40),
    malasState: clean(sheet?.malasState ?? '', 160),
    conditions: [...new Set(character.conditions.map((item) => clean(item, 160)).filter(Boolean))].slice(0, 40),
    inventory: [...new Set(character.inventory.map((item) => clean(item, 300)).filter(Boolean))].slice(0, 100),
    skills: (sheet?.skills ?? []).map(publicSkill).filter((skill) => skill.name.length > 0).slice(0, 10),
    gear: (sheet?.gear ?? []).map(publicGear).filter((entry) => entry.item.length > 0).slice(0, 30),
    ultimateSkill: ultimate,
  };
}
