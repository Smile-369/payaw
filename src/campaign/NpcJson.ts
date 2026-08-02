import {
  normalizeScheduleEntries,
} from './NPCLocationAuthoring';
import {
  NPCStatus,
  type NPC,
  type NPCRelationship,
  type NPCScheduleEntry,
} from '../engine/npc/NPC';

export const NPC_JSON_FORMAT = 'payaw-npcs';
export const NPC_JSON_VERSION = 1;
export const MAX_IMPORTED_NPCS = 500;

export interface PortableNpcRelationship {
  readonly npcKey: string;
  readonly kind: NPCRelationship['kind'];
  readonly label: string | null;
  readonly notes: string | null;
  readonly hidden: boolean;
}

export interface PortableNpcRecord {
  readonly sourceKey: string;
  readonly name: string;
  readonly age: number;
  readonly occupation: string;
  readonly personality: string;
  readonly wish: string;
  readonly fear: string;
  readonly secret: string;
  readonly rumor: string;
  readonly status: NPCStatus;
  readonly settlementId: number;
  readonly settlementName: string;
  readonly homeBuildingId: number | null;
  readonly allowNonResidentialHome: boolean;
  readonly workplaceBuildingId: number | null;
  readonly weeklySchedule?: readonly NPCScheduleEntry[];
  readonly relationships: readonly PortableNpcRelationship[];
  readonly portraitDataUrl: string | null;
  readonly publicDescription: string;
  readonly gmNotes: string;
  readonly tags: readonly string[];
}

export interface NpcJsonBundle {
  readonly format: typeof NPC_JSON_FORMAT;
  readonly version: typeof NPC_JSON_VERSION;
  readonly kind: 'npc' | 'group';
  readonly name: string;
  readonly exportedAt: string;
  readonly sourceWorld: {
    readonly seed: string;
    readonly generationVersion: string;
  };
  readonly npcs: readonly PortableNpcRecord[];
}

function boundedText(value: unknown, maximum: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function nullableInteger(value: unknown): number | null {
  return value === null || !Number.isInteger(value) ? null : value as number;
}

function normalizeTags(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.flatMap((item) => typeof item === 'string' ? item.trim() : []).filter(Boolean))].slice(0, 64)
    : [];
}

function normalizePortableRelationships(value: unknown): PortableNpcRelationship[] {
  if (!Array.isArray(value)) return [];
  const kinds: readonly NPCRelationship['kind'][] = ['family', 'friend', 'rival', 'coworker', 'neighbor', 'contact', 'romantic', 'custom'];
  return value.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const item = candidate as Record<string, unknown>;
    const npcKey = boundedText(item.npcKey, 240);
    if (npcKey.length === 0 || !kinds.includes(item.kind as NPCRelationship['kind'])) return [];
    return [{
      npcKey,
      kind: item.kind as NPCRelationship['kind'],
      label: boundedText(item.label, 120) || null,
      notes: boundedText(item.notes, 2_000) || null,
      hidden: item.hidden === true,
    }];
  }).slice(0, 200);
}

function normalizePortableNpc(value: unknown): PortableNpcRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const name = boundedText(item.name, 160);
  if (name.length === 0) return undefined;
  const statuses = Object.values(NPCStatus);
  const status = statuses.includes(item.status as NPCStatus) ? item.status as NPCStatus : NPCStatus.Alive;
  return {
    sourceKey: boundedText(item.sourceKey, 240),
    name,
    age: Math.max(0, Math.min(130, Math.round(Number(item.age) || 30))),
    occupation: boundedText(item.occupation, 160),
    personality: boundedText(item.personality, 500),
    wish: boundedText(item.wish, 1_000),
    fear: boundedText(item.fear, 1_000),
    secret: boundedText(item.secret, 2_000),
    rumor: boundedText(item.rumor, 2_000),
    status,
    settlementId: Math.max(0, Math.round(Number(item.settlementId) || 0)),
    settlementName: boundedText(item.settlementName, 200),
    homeBuildingId: nullableInteger(item.homeBuildingId),
    allowNonResidentialHome: item.allowNonResidentialHome === true,
    workplaceBuildingId: nullableInteger(item.workplaceBuildingId),
    ...(Array.isArray(item.weeklySchedule)
      ? { weeklySchedule: normalizeScheduleEntries(item.weeklySchedule) }
      : {}),
    relationships: normalizePortableRelationships(item.relationships),
    portraitDataUrl: typeof item.portraitDataUrl === 'string' && item.portraitDataUrl.startsWith('data:image/')
      ? item.portraitDataUrl
      : null,
    publicDescription: boundedText(item.publicDescription, 4_000),
    gmNotes: boundedText(item.gmNotes, 8_000),
    tags: normalizeTags(item.tags),
  };
}

export function createNpcJsonBundle(
  npcs: readonly NPC[],
  allNpcs: readonly NPC[],
  sourceWorld: NpcJsonBundle['sourceWorld'],
  name: string,
  allowNonResidentialHomeForKey: (key: string) => boolean = () => false,
  includeWeeklySchedule = true,
): NpcJsonBundle {
  const keyById = new Map(allNpcs.map((npc) => [npc.id, npc.key]));
  const records = npcs.slice(0, MAX_IMPORTED_NPCS).map((npc): PortableNpcRecord => ({
    sourceKey: npc.key,
    name: npc.name,
    age: npc.age,
    occupation: npc.occupation,
    personality: npc.personality,
    wish: npc.wish,
    fear: npc.fear,
    secret: npc.secret,
    rumor: npc.rumor,
    status: npc.status,
    settlementId: npc.settlementId,
    settlementName: '',
    homeBuildingId: npc.homeBuildingId,
    allowNonResidentialHome: allowNonResidentialHomeForKey(npc.key),
    workplaceBuildingId: npc.workplaceBuildingId,
    ...(includeWeeklySchedule ? { weeklySchedule: npc.weeklySchedule } : {}),
    relationships: npc.relationships.flatMap((relationship) => {
      const npcKey = keyById.get(relationship.npcId);
      if (npcKey === undefined) return [];
      return [{
        npcKey,
        kind: relationship.kind,
        label: relationship.label?.trim() || null,
        notes: relationship.notes?.trim() || null,
        hidden: relationship.hidden === true,
      }];
    }),
    portraitDataUrl: npc.portraitDataUrl ?? null,
    publicDescription: npc.publicDescription ?? '',
    gmNotes: npc.gmNotes ?? '',
    tags: npc.tags ?? [],
  }));
  return {
    format: NPC_JSON_FORMAT,
    version: NPC_JSON_VERSION,
    kind: records.length === 1 ? 'npc' : 'group',
    name: name.trim().slice(0, 200) || (records.length === 1 ? records[0]?.name ?? 'NPC' : 'NPC group'),
    exportedAt: new Date().toISOString(),
    sourceWorld,
    npcs: records,
  };
}

export function withSettlementNames(
  bundle: NpcJsonBundle,
  settlementNameForId: (id: number) => string,
): NpcJsonBundle {
  return {
    ...bundle,
    npcs: bundle.npcs.map((npc) => ({ ...npc, settlementName: settlementNameForId(npc.settlementId) })),
  };
}

export function parseNpcJsonBundle(value: unknown): NpcJsonBundle {
  if ((typeof value !== 'object' || value === null) && !Array.isArray(value)) {
    throw new Error('The selected file is not an NPC JSON object or array.');
  }
  const root = Array.isArray(value) ? {} : value as Record<string, unknown>;
  const isPayawBundle = root.format === NPC_JSON_FORMAT;
  if (root.format !== undefined && !isPayawBundle) {
    throw new Error('Unsupported NPC JSON. Select a PAYAW NPC export or a JSON NPC record.');
  }
  if (isPayawBundle) {
    const version = Number(root.version);
    if (!Number.isInteger(version) || version < 1 || version > NPC_JSON_VERSION) {
      throw new Error(`Unsupported NPC JSON version. This editor supports version ${NPC_JSON_VERSION}.`);
    }
  }
  const candidates = Array.isArray(value)
    ? value
    : Array.isArray(root.npcs)
      ? root.npcs
      : [root];
  const npcs = candidates.flatMap((candidate) => normalizePortableNpc(candidate) ?? []).slice(0, MAX_IMPORTED_NPCS);
  if (npcs.length === 0) throw new Error('The NPC JSON does not contain any valid NPC records.');
  const source = typeof root.sourceWorld === 'object' && root.sourceWorld !== null
    ? root.sourceWorld as Record<string, unknown>
    : {};
  return {
    format: NPC_JSON_FORMAT,
    version: NPC_JSON_VERSION,
    kind: npcs.length === 1 ? 'npc' : 'group',
    name: isPayawBundle
      ? boundedText(root.name, 200) || (npcs.length === 1 ? npcs[0]?.name ?? 'NPC' : 'NPC group')
      : npcs.length === 1 ? npcs[0]?.name ?? 'NPC' : 'NPC group',
    exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt : '',
    sourceWorld: {
      seed: boundedText(source.seed, 240),
      generationVersion: boundedText(source.generationVersion, 120),
    },
    npcs,
  };
}
