import type { Capability, CharacterEditableField, KnowledgeLevel } from './PlayerViewState';
import { parsePlayerWorldGenerationRecipe, type PlayerWorldGenerationRecipe } from './PlayerWorldRecipe';

export const PLAYER_PROJECTION_VERSION = 1 as const;
export const PLAYER_PROJECTION_STORAGE_PREFIX = 'payaw.player-projection.v1.';
export const PLAYER_PROJECTION_LATEST_KEY = 'payaw.player-projection.latest.v1';

export interface PublicCampaignSummary {
  readonly id: string;
  readonly name: string;
  readonly status: 'draft' | 'active' | 'archived';
  readonly campaignTime: string;
  readonly timezone: string;
  readonly weather: string;
  readonly publicConditions: readonly string[];
}

export interface PlayerIdentity {
  readonly id: string;
  readonly displayName: string;
  readonly characterId: string;
  readonly characterName: string;
  readonly color: string;
}

export interface PlayerMapCellGrid {
  readonly columns: number;
  readonly rows: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly terrainRows: readonly string[];
}

export interface PlayerMapPoint {
  readonly x: number;
  readonly y: number;
}

export interface PlayerRoadProjection {
  readonly id: string;
  readonly classification: 'main' | 'secondary' | 'local';
  readonly points: readonly PlayerMapPoint[];
}

export interface PlayerBuildingProjection {
  readonly id: string;
  readonly footprint: readonly PlayerMapPoint[];
}

export interface PlayerMapFeatureProjection {
  readonly id: string;
  readonly kind: 'community' | 'anchor' | 'location' | 'scene' | 'ping';
  readonly label: string;
  readonly knowledge: Exclude<KnowledgeLevel, 'unknown'>;
  readonly position: PlayerMapPoint | null;
  readonly approximateRadius: number | null;
  readonly detail: string;
  readonly linkedEntityId: string | null;
  readonly color: string | null;
  readonly expiresAt: string | null;
}

export interface PlayerMapProjection {
  readonly base: PlayerMapCellGrid | null;
  /** Deterministic public map recipe generated locally by the player client. */
  readonly worldRecipe: PlayerWorldGenerationRecipe | null;
  readonly unexploredTreatment: 'paper' | 'fog' | 'blank';
  readonly roads: readonly PlayerRoadProjection[];
  readonly buildings: readonly PlayerBuildingProjection[];
  readonly features: readonly PlayerMapFeatureProjection[];
  readonly partyPosition: PlayerMapPoint | null;
  readonly tileSizeMeters: number;
}

export interface SceneProjection {
  readonly id: string;
  readonly title: string;
  readonly locationLabel: string;
  readonly description: string;
  readonly readAloud: string;
  readonly presentNpcs: readonly { readonly id: string; readonly name: string; readonly description: string }[];
  readonly handoutIds: readonly string[];
  readonly clueIds: readonly string[];
  readonly exits: readonly { readonly label: string; readonly targetSceneId: string | null }[];
  readonly ambient: {
    readonly time: string;
    readonly weather: string;
    readonly conditions: readonly string[];
  };
}

export interface NpcProjection {
  readonly id: string;
  readonly name: string;
  readonly knowledge: Exclude<KnowledgeLevel, 'unknown'>;
  readonly description: string;
  readonly occupation: string | null;
  readonly relationship: string | null;
  readonly lastKnownContext: string;
  readonly portraitUri: string | null;
  readonly facts: readonly string[];
}

export interface LocationProjection {
  readonly id: string;
  readonly name: string;
  readonly knowledge: Exclude<KnowledgeLevel, 'unknown'>;
  readonly type: string;
  readonly description: string;
  readonly status: string | null;
  readonly position: PlayerMapPoint | null;
  readonly discoveredDetails: readonly string[];
}

export interface ClueProjection {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly knowledge: Exclude<KnowledgeLevel, 'unknown'>;
  readonly linkedEntityIds: readonly string[];
  readonly annotations: readonly string[];
}

export interface AssetProjection {
  readonly id: string;
  readonly type: 'image' | 'audio' | 'document' | 'video' | 'external-link';
  readonly title: string;
  readonly caption: string;
  readonly alternateText: string;
  readonly safeUri: string | null;
  readonly mimeType: string;
}

export interface MessageProjection {
  readonly id: string;
  readonly senderLabel: string;
  readonly body: string;
  readonly sentAt: string;
  readonly status: 'sent' | 'received' | 'read';
  readonly presentation: {
    readonly glitch: boolean;
    readonly corruption: number;
  };
}

export interface MessageThreadProjection {
  readonly id: string;
  readonly name: string;
  readonly medium: string;
  readonly messages: readonly MessageProjection[];
  readonly canReply: boolean;
}

export interface CharacterSkillProjection {
  readonly slot: string;
  readonly name: string;
  readonly type: string;
  readonly role: string;
  readonly useCase: string;
  readonly roll: string;
  readonly combatEffect: string;
  readonly utility: string;
  readonly costRisk: string;
}

export interface CharacterGearProjection {
  readonly item: string;
  readonly use: string;
  readonly notes: string;
}

export interface CharacterUltimateSkillProjection extends CharacterSkillProjection {
  readonly unlocked: boolean;
}

export interface PublicCharacterProfileProjection {
  readonly ownerId: string;
  readonly playerDisplayName: string;
  readonly color: string;
  readonly name: string;
  readonly pronouns: string;
  readonly background: string;
  readonly portraitUri: string | null;
  readonly galleryUris: readonly string[];
  readonly handle: string;
  readonly ageYear: string;
  readonly connectionToGroup: string;
  readonly schoolWork: string;
  readonly homeArea: string;
  readonly startingItem: string;
  readonly currentSituation: string;
  readonly stats: Readonly<Record<string, string>>;
  readonly malasCurrent: string;
  readonly malasState: string;
  readonly conditions: readonly string[];
  readonly inventory: readonly string[];
  readonly skills: readonly CharacterSkillProjection[];
  readonly gear: readonly CharacterGearProjection[];
  /** Only unlocked ultimate skills are projected to other players. */
  readonly ultimateSkill: CharacterUltimateSkillProjection | null;
}

export interface CharacterProjection {
  readonly id: string;
  readonly name: string;
  readonly pronouns: string;
  readonly background: string;
  readonly portraitUri: string | null;
  readonly galleryUris: readonly string[];
  readonly stats: Readonly<Record<string, string>>;
  readonly conditions: readonly string[];
  readonly inventory: readonly string[];
  readonly privateNotes: string;
  readonly editableFields: readonly CharacterEditableField[];
}

export interface JournalEntryProjection {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly ownerLabel: string;
  readonly sharedWithParty: boolean;
  readonly linkedEntityIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JournalProjection {
  readonly personal: readonly JournalEntryProjection[];
  readonly shared: readonly JournalEntryProjection[];
}

export interface ObjectiveProjection {
  readonly id: string;
  readonly wording: string;
  readonly status: 'active' | 'completed' | 'failed' | 'abandoned' | 'proposed';
  readonly completionNote: string;
  readonly playerCreated: boolean;
}

export interface DiceRollProjection {
  readonly id: string;
  readonly rollerUsername: string;
  readonly notation: string;
  readonly values: readonly number[];
  readonly modifier: number;
  readonly total: number;
  readonly visibility: 'private' | 'party' | 'gm';
  readonly rolledAt: string;
}

export interface PlayerNotification {
  readonly id: string;
  readonly kind: 'info' | 'reveal' | 'message' | 'warning';
  readonly text: string;
  readonly createdAt: string;
}

export interface PlayerProjection {
  readonly projectionVersion: typeof PLAYER_PROJECTION_VERSION;
  readonly generatedAt: string;
  readonly campaign: PublicCampaignSummary;
  readonly viewer: PlayerIdentity;
  readonly capabilities: readonly Capability[];
  readonly activeScene?: SceneProjection;
  readonly map: PlayerMapProjection;
  readonly knownNpcs: readonly NpcProjection[];
  readonly knownLocations: readonly LocationProjection[];
  readonly clues: readonly ClueProjection[];
  readonly handouts: readonly AssetProjection[];
  readonly messages: readonly MessageThreadProjection[];
  readonly character?: CharacterProjection;
  readonly partyCharacters: readonly PublicCharacterProfileProjection[];
  readonly journal: JournalProjection;
  readonly objectives: readonly ObjectiveProjection[];
  readonly diceRolls: readonly DiceRollProjection[];
  readonly notifications: readonly PlayerNotification[];
  readonly revision: number;
}

export class ProjectionVersionError extends Error {
  public constructor(public readonly receivedVersion: unknown) {
    super(`This Player View supports projection version ${PLAYER_PROJECTION_VERSION}; received ${String(receivedVersion)}.`);
    this.name = 'ProjectionVersionError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}


function array<T>(value: unknown, normalize: (item: unknown) => T | undefined): T[] {
  return Array.isArray(value) ? value.flatMap((item) => normalize(item) ?? []) : [];
}

function point(value: unknown): PlayerMapPoint | null {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: value.x, y: value.y };
}

function safeKnowledge(value: unknown): Exclude<KnowledgeLevel, 'unknown'> {
  return value === 'rumored' || value === 'visited' || value === 'investigated' ? value : 'discovered';
}

function safeAsset(value: unknown): AssetProjection | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') return undefined;
  const type = ['image', 'audio', 'document', 'video', 'external-link'].includes(stringValue(value.type)) ? stringValue(value.type) as AssetProjection['type'] : 'document';
  return {
    id: value.id,
    type,
    title: stringValue(value.title, 'Untitled handout'),
    caption: stringValue(value.caption),
    alternateText: stringValue(value.alternateText),
    safeUri: typeof value.safeUri === 'string' ? value.safeUri : null,
    mimeType: stringValue(value.mimeType),
  };
}

/**
 * Parses an already projected payload. It never accepts a CampaignState and it
 * never attempts to recover by reading GM storage when the payload is absent or
 * incompatible.
 */
export function parsePlayerProjection(value: unknown): PlayerProjection {
  if (!isRecord(value)) throw new ProjectionVersionError(undefined);
  if (value.projectionVersion !== PLAYER_PROJECTION_VERSION) throw new ProjectionVersionError(value.projectionVersion);
  if (!isRecord(value.campaign) || !isRecord(value.viewer) || !isRecord(value.map) || !isRecord(value.journal)) {
    throw new Error('The player projection is incomplete. Ask the GM to refresh the preview.');
  }
  const campaign = value.campaign;
  const viewer = value.viewer;
  const map = value.map;
  const base = isRecord(map.base) && Array.isArray(map.base.terrainRows) ? {
    columns: Number(map.base.columns) || 0,
    rows: Number(map.base.rows) || 0,
    worldWidth: Number(map.base.worldWidth) || 0,
    worldHeight: Number(map.base.worldHeight) || 0,
    terrainRows: stringArray(map.base.terrainRows),
  } : null;
  const activeScene = isRecord(value.activeScene) ? normalizeScene(value.activeScene) : undefined;
  const character = isRecord(value.character) ? normalizeCharacter(value.character) : undefined;
  const projection: PlayerProjection = {
    projectionVersion: PLAYER_PROJECTION_VERSION,
    generatedAt: stringValue(value.generatedAt, new Date().toISOString()),
    campaign: {
      id: stringValue(campaign.id),
      name: stringValue(campaign.name, 'PAYAW Campaign'),
      status: campaign.status === 'active' || campaign.status === 'archived' ? campaign.status : 'draft',
      campaignTime: stringValue(campaign.campaignTime),
      timezone: stringValue(campaign.timezone, 'Asia/Manila'),
      weather: stringValue(campaign.weather, 'Automatic'),
      publicConditions: stringArray(campaign.publicConditions),
    },
    viewer: {
      id: stringValue(viewer.id),
      displayName: stringValue(viewer.displayName, 'Player'),
      characterId: stringValue(viewer.characterId),
      characterName: stringValue(viewer.characterName, 'Character'),
      color: stringValue(viewer.color, '#73b7a4'),
    },
    capabilities: stringArray(value.capabilities) as Capability[],
    map: {
      base,
      worldRecipe: parsePlayerWorldGenerationRecipe(map.worldRecipe),
      unexploredTreatment: map.unexploredTreatment === 'fog' || map.unexploredTreatment === 'blank' ? map.unexploredTreatment : 'paper',
      roads: array(map.roads, (candidate) => {
        if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
        return {
          id: candidate.id,
          classification: candidate.classification === 'secondary' || candidate.classification === 'local'
            ? candidate.classification
            : 'main',
          points: array(candidate.points, (entry) => point(entry) ?? undefined),
        } satisfies PlayerRoadProjection;
      }),
      buildings: array(map.buildings, (candidate) => {
        if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
        const footprint = array(candidate.footprint, (entry) => point(entry) ?? undefined);
        if (footprint.length < 3) return undefined;
        return {
          id: candidate.id,
          footprint,
        } satisfies PlayerBuildingProjection;
      }),
      features: array(map.features, (candidate) => {
        if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
        const kind = ['community', 'anchor', 'location', 'scene', 'ping'].includes(stringValue(candidate.kind)) ? stringValue(candidate.kind) as PlayerMapFeatureProjection['kind'] : 'location';
        return {
          id: candidate.id,
          kind,
          label: stringValue(candidate.label, 'Unknown'),
          knowledge: safeKnowledge(candidate.knowledge),
          position: point(candidate.position),
          approximateRadius: typeof candidate.approximateRadius === 'number' ? candidate.approximateRadius : null,
          detail: stringValue(candidate.detail),
          linkedEntityId: typeof candidate.linkedEntityId === 'string' ? candidate.linkedEntityId : null,
          color: typeof candidate.color === 'string' ? candidate.color : null,
          expiresAt: typeof candidate.expiresAt === 'string' ? candidate.expiresAt : null,
        } satisfies PlayerMapFeatureProjection;
      }),
      partyPosition: point(map.partyPosition),
      tileSizeMeters: typeof map.tileSizeMeters === 'number' && Number.isFinite(map.tileSizeMeters) ? map.tileSizeMeters : 125,
    },
    knownNpcs: array(value.knownNpcs, (candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
      return {
        id: candidate.id,
        name: stringValue(candidate.name, 'Unknown person'),
        knowledge: safeKnowledge(candidate.knowledge),
        description: stringValue(candidate.description),
        occupation: typeof candidate.occupation === 'string' ? candidate.occupation : null,
        relationship: typeof candidate.relationship === 'string' ? candidate.relationship : null,
        lastKnownContext: stringValue(candidate.lastKnownContext),
        portraitUri: typeof candidate.portraitUri === 'string' ? candidate.portraitUri : null,
        facts: stringArray(candidate.facts),
      } satisfies NpcProjection;
    }),
    knownLocations: array(value.knownLocations, (candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
      return {
        id: candidate.id,
        name: stringValue(candidate.name, 'Unknown place'),
        knowledge: safeKnowledge(candidate.knowledge),
        type: stringValue(candidate.type, 'place'),
        description: stringValue(candidate.description),
        status: typeof candidate.status === 'string' ? candidate.status : null,
        position: point(candidate.position),
        discoveredDetails: stringArray(candidate.discoveredDetails),
      } satisfies LocationProjection;
    }),
    clues: array(value.clues, (candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
      return {
        id: candidate.id,
        title: stringValue(candidate.title, 'Unnamed clue'),
        description: stringValue(candidate.description),
        source: stringValue(candidate.source),
        knowledge: safeKnowledge(candidate.knowledge),
        linkedEntityIds: stringArray(candidate.linkedEntityIds),
        annotations: stringArray(candidate.annotations),
      } satisfies ClueProjection;
    }),
    handouts: array(value.handouts, safeAsset),
    messages: array(value.messages, (candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
      return {
        id: candidate.id,
        name: stringValue(candidate.name, 'Message thread'),
        medium: stringValue(candidate.medium, 'Messenger'),
        canReply: candidate.canReply === true,
        messages: array(candidate.messages, (message) => {
          if (!isRecord(message) || typeof message.id !== 'string') return undefined;
          const presentation = isRecord(message.presentation) ? message.presentation : {};
          return {
            id: message.id,
            senderLabel: stringValue(message.senderLabel, 'Unknown'),
            body: stringValue(message.body),
            sentAt: stringValue(message.sentAt),
            status: message.status === 'received' || message.status === 'read' ? message.status : 'sent',
            presentation: { glitch: presentation.glitch === true, corruption: Number(presentation.corruption) || 0 },
          } satisfies MessageProjection;
        }),
      } satisfies MessageThreadProjection;
    }),
    partyCharacters: array(value.partyCharacters, normalizePublicCharacterProfile),
    journal: {
      personal: array(value.journal.personal, normalizeJournal),
      shared: array(value.journal.shared, normalizeJournal),
    },
    objectives: array(value.objectives, (candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
      const status = ['completed', 'failed', 'abandoned', 'proposed'].includes(stringValue(candidate.status)) ? stringValue(candidate.status) as ObjectiveProjection['status'] : 'active';
      return { id: candidate.id, wording: stringValue(candidate.wording), status, completionNote: stringValue(candidate.completionNote), playerCreated: candidate.playerCreated === true };
    }),
    diceRolls: array(value.diceRolls, (candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
      return {
        id: candidate.id,
        rollerUsername: stringValue(candidate.rollerUsername ?? candidate.rollerLabel, 'PLAYER').slice(0, 24),
        notation: stringValue(candidate.notation, '1d20'),
        values: Array.isArray(candidate.values) ? candidate.values.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)) : [],
        modifier: Number(candidate.modifier) || 0,
        total: Number(candidate.total) || 0,
        visibility: candidate.visibility === 'party' || candidate.visibility === 'gm' ? candidate.visibility : 'private',
        rolledAt: stringValue(candidate.rolledAt),
      } satisfies DiceRollProjection;
    }),
    notifications: array(value.notifications, (candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') return undefined;
      const kind = ['reveal', 'message', 'warning'].includes(stringValue(candidate.kind)) ? stringValue(candidate.kind) as PlayerNotification['kind'] : 'info';
      return { id: candidate.id, kind, text: stringValue(candidate.text), createdAt: stringValue(candidate.createdAt) };
    }),
    revision: Math.max(0, Math.round(Number(value.revision) || 0)),
    ...(activeScene === undefined ? {} : { activeScene }),
    ...(character === undefined ? {} : { character }),
  };
  return deepFreeze(projection);
}

function normalizeJournal(value: unknown): JournalEntryProjection | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') return undefined;
  return {
    id: value.id,
    title: stringValue(value.title, 'Untitled note'),
    body: stringValue(value.body),
    ownerLabel: stringValue(value.ownerLabel, 'Player'),
    sharedWithParty: value.sharedWithParty === true,
    linkedEntityIds: stringArray(value.linkedEntityIds),
    createdAt: stringValue(value.createdAt),
    updatedAt: stringValue(value.updatedAt),
  };
}

function normalizeScene(value: Record<string, unknown>): SceneProjection {
  const ambient = isRecord(value.ambient) ? value.ambient : {};
  return {
    id: stringValue(value.id),
    title: stringValue(value.title, 'Current scene'),
    locationLabel: stringValue(value.locationLabel),
    description: stringValue(value.description),
    readAloud: stringValue(value.readAloud),
    presentNpcs: array(value.presentNpcs, (candidate) => isRecord(candidate) && typeof candidate.id === 'string' ? {
      id: candidate.id,
      name: stringValue(candidate.name, 'Unknown person'),
      description: stringValue(candidate.description),
    } : undefined),
    handoutIds: stringArray(value.handoutIds),
    clueIds: stringArray(value.clueIds),
    exits: array(value.exits, (candidate) => isRecord(candidate) ? { label: stringValue(candidate.label), targetSceneId: typeof candidate.targetSceneId === 'string' ? candidate.targetSceneId : null } : undefined),
    ambient: {
      time: stringValue(ambient.time),
      weather: stringValue(ambient.weather),
      conditions: stringArray(ambient.conditions),
    },
  };
}

function normalizeCharacterSkill(value: unknown): CharacterSkillProjection | undefined {
  if (!isRecord(value)) return undefined;
  return {
    slot: stringValue(value.slot).slice(0, 40),
    name: stringValue(value.name).slice(0, 120),
    type: stringValue(value.type).slice(0, 80),
    role: stringValue(value.role).slice(0, 80),
    useCase: stringValue(value.useCase).slice(0, 700),
    roll: stringValue(value.roll).slice(0, 160),
    combatEffect: stringValue(value.combatEffect).slice(0, 700),
    utility: stringValue(value.utility).slice(0, 700),
    costRisk: stringValue(value.costRisk).slice(0, 700),
  };
}

function normalizeCharacterGear(value: unknown): CharacterGearProjection | undefined {
  if (!isRecord(value)) return undefined;
  return {
    item: stringValue(value.item).slice(0, 120),
    use: stringValue(value.use).slice(0, 300),
    notes: stringValue(value.notes).slice(0, 700),
  };
}

function normalizePublicCharacterProfile(value: unknown): PublicCharacterProfileProjection | undefined {
  if (!isRecord(value) || typeof value.ownerId !== 'string') return undefined;
  const stats = isRecord(value.stats)
    ? Object.fromEntries(Object.entries(value.stats).filter((entry): entry is [string, string] => typeof entry[1] === 'string').slice(0, 40))
    : {};
  const ultimate = normalizeCharacterSkill(value.ultimateSkill);
  return {
    ownerId: value.ownerId,
    playerDisplayName: stringValue(value.playerDisplayName, 'Player').slice(0, 80),
    color: stringValue(value.color, '#73b7a4').slice(0, 20),
    name: stringValue(value.name, 'Character').slice(0, 120),
    pronouns: stringValue(value.pronouns).slice(0, 80),
    background: stringValue(value.background).slice(0, 2000),
    portraitUri: typeof value.portraitUri === 'string' ? value.portraitUri.slice(0, 1000) : null,
    galleryUris: stringArray(value.galleryUris).slice(0, 6).map((uri) => uri.slice(0, 1000)),
    handle: stringValue(value.handle).slice(0, 120),
    ageYear: stringValue(value.ageYear).slice(0, 120),
    connectionToGroup: stringValue(value.connectionToGroup).slice(0, 1200),
    schoolWork: stringValue(value.schoolWork).slice(0, 700),
    homeArea: stringValue(value.homeArea).slice(0, 500),
    startingItem: stringValue(value.startingItem).slice(0, 500),
    currentSituation: stringValue(value.currentSituation).slice(0, 1200),
    stats,
    malasCurrent: stringValue(value.malasCurrent).slice(0, 40),
    malasState: stringValue(value.malasState).slice(0, 160),
    conditions: stringArray(value.conditions).slice(0, 40),
    inventory: stringArray(value.inventory).slice(0, 100),
    skills: array(value.skills, normalizeCharacterSkill).slice(0, 10),
    gear: array(value.gear, normalizeCharacterGear).slice(0, 30),
    ultimateSkill: ultimate === undefined || !isRecord(value.ultimateSkill) || value.ultimateSkill.unlocked !== true
      ? null
      : { ...ultimate, unlocked: true },
  };
}

function normalizeCharacter(value: Record<string, unknown>): CharacterProjection {
  const stats = isRecord(value.stats) ? Object.fromEntries(Object.entries(value.stats).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {};
  return {
    id: stringValue(value.id),
    name: stringValue(value.name, 'Character'),
    pronouns: stringValue(value.pronouns),
    background: stringValue(value.background),
    portraitUri: typeof value.portraitUri === 'string' ? value.portraitUri : null,
    galleryUris: stringArray(value.galleryUris).slice(0, 6),
    stats,
    conditions: stringArray(value.conditions),
    inventory: stringArray(value.inventory),
    privateNotes: stringValue(value.privateNotes).slice(0, 32000),
    editableFields: stringArray(value.editableFields).filter((field): field is CharacterProjection['editableFields'][number] =>
      ['name', 'pronouns', 'background', 'portraitUri', 'galleryUris', 'stats', 'conditions', 'inventory', 'privateNotes'].includes(field),
    ),
  };
}

export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
