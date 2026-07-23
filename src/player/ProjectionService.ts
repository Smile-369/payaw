import type { AuthoringLayerState } from '../authoring/AuthoringLayer';
import type {
  CampaignEntityType,
  CampaignRevealRecord,
  CampaignState,
} from '../campaign/CampaignSystem';
import {
  collectCampaignLocations,
  type NPCLocationAuthoringState,
} from '../campaign/NPCLocationAuthoring';
import { RoadType } from '../engine/infrastructure/Road';
import type { NPC } from '../engine/npc/NPC';
import { TerrainType, WaterType, type Tile } from '../engine/world/Tile';
import type { World } from '../engine/world/World';
import {
  PLAYER_PROJECTION_VERSION,
  deepFreeze,
  type AssetProjection,
  type CharacterProjection,
  type ClueProjection,
  type JournalEntryProjection,
  type LocationProjection,
  type MessageThreadProjection,
  type NpcProjection,
  type ObjectiveProjection,
  type PlayerBuildingProjection,
  type PlayerMapFeatureProjection,
  type PlayerMapPoint,
  type PlayerProjection,
  type PlayerRoadProjection,
  type SceneProjection,
} from './PlayerProjection';
import type {
  KnowledgeGrant,
  KnowledgeLevel,
  KnowledgeSubjectType,
  PlayerAudience,
  PlayerViewState,
} from './PlayerViewState';

export interface PlayerProjectionContext {
  readonly campaign: CampaignState;
  readonly world: World;
  readonly authoringLayer: AuthoringLayerState;
  readonly npcLocationAuthoring: NPCLocationAuthoringState;
  readonly playerView: PlayerViewState;
  readonly viewerId: string;
  readonly now?: string | Date | number;
  readonly renderPublicMapImage?: (projection: PlayerProjection) => string | null;
}

interface EffectiveKnowledge {
  readonly level: Exclude<KnowledgeLevel, 'unknown'>;
  readonly alias: string | null;
  readonly source: string;
  readonly timestamp: string;
}

const LEVEL_RANK: Readonly<Record<Exclude<KnowledgeLevel, 'unknown'>, number>> = {
  rumored: 1,
  discovered: 2,
  visited: 3,
  investigated: 4,
};

function nowIso(value: string | Date | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function safeId(campaignId: string, prefix: string, canonicalId: string): string {
  const input = `${campaignId}|${prefix}|${canonicalId}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}:${(hash >>> 0).toString(36)}`;
}

function matchingAudience(audience: string, viewerId: string): boolean {
  return audience === 'party' || audience === `player:${viewerId}`;
}

function revealSubjectType(type: CampaignEntityType): KnowledgeSubjectType | null {
  return ['scene', 'npc', 'location', 'clue', 'handout', 'objective', 'message-thread'].includes(type) ? type as KnowledgeSubjectType : null;
}

function campaignRevealKnowledge(reveal: CampaignRevealRecord, viewerId: string, subjectType: KnowledgeSubjectType, subjectId: string): EffectiveKnowledge | null {
  if (reveal.revokedAt !== null || !matchingAudience(reveal.audience, viewerId)) return null;
  if (revealSubjectType(reveal.entityType) !== subjectType || reveal.entityId !== subjectId) return null;
  return { level: 'discovered', alias: null, source: reveal.note || 'GM reveal', timestamp: reveal.timestamp };
}

function explicitGrantKnowledge(grant: KnowledgeGrant, viewerId: string, subjectType: KnowledgeSubjectType, subjectId: string, now: string): EffectiveKnowledge | null {
  if (grant.subjectType !== subjectType || grant.subjectId !== subjectId || grant.revokedAt !== null || !matchingAudience(grant.audience, viewerId)) return null;
  if (grant.expiresAt !== null && Date.parse(grant.expiresAt) <= Date.parse(now)) return null;
  return { level: grant.level, alias: grant.alias, source: grant.source, timestamp: grant.grantedAt };
}

function knowledgeFor(context: PlayerProjectionContext, subjectType: KnowledgeSubjectType, subjectId: string, now: string): EffectiveKnowledge | null {
  const candidates: EffectiveKnowledge[] = [];
  for (const reveal of context.campaign.reveals) {
    const knowledge = campaignRevealKnowledge(reveal, context.viewerId, subjectType, subjectId);
    if (knowledge !== null) candidates.push(knowledge);
  }
  for (const grant of context.playerView.knowledgeGrants) {
    const knowledge = explicitGrantKnowledge(grant, context.viewerId, subjectType, subjectId, now);
    if (knowledge !== null) candidates.push(knowledge);
  }
  candidates.sort((left, right) => (LEVEL_RANK[right.level] ?? 0) - (LEVEL_RANK[left.level] ?? 0) || Date.parse(right.timestamp) - Date.parse(left.timestamp));
  return candidates[0] ?? null;
}

function tilePoint(world: World, tileIndex: number): PlayerMapPoint | null {
  const tile = world.tiles[tileIndex];
  return tile === undefined ? null : { x: tile.x + 0.5, y: tile.y + 0.5 };
}

function featurePosition(point: PlayerMapPoint | null, knowledge: Exclude<KnowledgeLevel, 'unknown'>): { readonly position: PlayerMapPoint | null; readonly approximateRadius: number | null } {
  if (point === null) return { position: null, approximateRadius: null };
  if (knowledge !== 'rumored') return { position: point, approximateRadius: null };
  return {
    position: { x: Math.round(point.x / 12) * 12, y: Math.round(point.y / 12) * 12 },
    approximateRadius: 12,
  };
}

function cellCharacter(tile: Tile | undefined): string {
  if (tile === undefined) return 'W';
  if (tile.water !== WaterType.Land) return tile.terrain === TerrainType.ShallowWater || tile.terrain === TerrainType.Lake ? 'w' : 'W';
  if (tile.river) return 'R';
  if (tile.terrain === TerrainType.Forest || tile.forestDensity > 0.48) return 'F';
  if (tile.terrain === TerrainType.Hill || tile.terrain === TerrainType.Mountain) return 'H';
  if (tile.terrain === TerrainType.Beach || tile.terrain === TerrainType.Floodplain || tile.terrain === TerrainType.Delta) return 'S';
  return 'L';
}

function gridCellCharacter(world: World, column: number, row: number, step: number): string {
  const startX = column * step;
  const startY = row * step;
  const endX = Math.min(world.width, startX + step);
  const endY = Math.min(world.height, startY + step);
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const tile = world.getTile(x, y);
      if (tile?.river === true && tile.water === WaterType.Land) return 'R';
    }
  }
  const x = Math.min(world.width - 1, startX + Math.floor(step * 0.5));
  const y = Math.min(world.height - 1, startY + Math.floor(step * 0.5));
  return cellCharacter(world.getTile(x, y));
}

function buildBaseGrid(world: World): PlayerProjection['map']['base'] {
  const step = Math.max(1, Math.ceil(Math.max(world.width / 128, world.height / 84)));
  const columns = Math.ceil(world.width / step);
  const rows = Math.ceil(world.height / step);
  const terrainRows: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    let encoded = '';
    for (let column = 0; column < columns; column += 1) {
      encoded += gridCellCharacter(world, column, row, step);
    }
    terrainRows.push(encoded);
  }
  return { columns, rows, worldWidth: world.width, worldHeight: world.height, terrainRows };
}

function publicRoads(world: World, campaignId: string): PlayerRoadProjection[] {
  return world.roads
    .slice(0, 1000)
    .flatMap((road) => {
      if (road.path.length < 2) return [];
      const step = Math.max(1, Math.ceil(road.path.length / 48));
      const points = road.path.filter((_, index) => index % step === 0 || index === road.path.length - 1).flatMap((tileIndex) => tilePoint(world, tileIndex) ?? []);
      return points.length < 2 ? [] : [{
        id: safeId(campaignId, 'road', `${road.generatedId ?? road.id}`),
        classification: road.type === RoadType.Main
          ? 'main'
          : road.type === RoadType.Secondary
            ? 'secondary'
            : 'local',
        points,
      } satisfies PlayerRoadProjection];
    });
}

function publicBuildingFootprints(world: World, campaignId: string): PlayerBuildingProjection[] {
  return world.buildings
    .slice(0, 2500)
    .flatMap((building) => {
      const footprint = building.footprint
        .slice(0, 16)
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point) => ({ x: point.x, y: point.y }));
      if (footprint.length < 3) return [];
      return [{
        id: safeId(campaignId, 'building', `${building.generatedId ?? building.id}`),
        footprint,
      } satisfies PlayerBuildingProjection];
    });
}

function safeName(canonical: string, knowledge: EffectiveKnowledge, fallback: string): string {
  if (knowledge.alias !== null) return knowledge.alias;
  return knowledge.level === 'rumored' ? fallback : canonical;
}

function relationshipFor(npc: NPC, knownNpcIds: ReadonlySet<number>, knowledge: EffectiveKnowledge): string | null {
  if (knowledge.level !== 'investigated') return null;
  const relationship = npc.relationships.find((candidate) => !candidate.hidden && knownNpcIds.has(candidate.npcId));
  if (relationship === undefined) return null;
  return relationship.label?.trim() || relationship.kind.replaceAll('-', ' ');
}

function knownNpcProjections(context: PlayerProjectionContext, activeSceneNpcKeys: ReadonlySet<string>, now: string): NpcProjection[] {
  const knowledgeByKey = new Map<string, EffectiveKnowledge>();
  for (const npc of context.world.npcs) {
    const knowledge = knowledgeFor(context, 'npc', npc.key, now);
    if (knowledge !== null) knowledgeByKey.set(npc.key, knowledge);
    else if (activeSceneNpcKeys.has(npc.key)) knowledgeByKey.set(npc.key, { level: 'discovered', alias: null, source: 'Visible in current scene', timestamp: now });
  }
  const knownIds = new Set(context.world.npcs.filter((npc) => knowledgeByKey.has(npc.key)).map((npc) => npc.id));
  return context.world.npcs.flatMap((npc) => {
    const knowledge = knowledgeByKey.get(npc.key);
    if (knowledge === undefined) return [];
    const visibleNow = activeSceneNpcKeys.has(npc.key);
    const facts: string[] = [];
    if (knowledge.level === 'investigated' && npc.occupation.trim().length > 0) facts.push(`Occupation: ${npc.occupation}`);
    return [{
      id: safeId(context.campaign.id, 'npc', npc.key),
      name: safeName(npc.name, knowledge, knowledge.alias ?? 'A person you have heard about'),
      knowledge: knowledge.level,
      description: knowledge.level === 'rumored' ? knowledge.source : npc.publicDescription?.trim() || 'No public description has been recorded.',
      occupation: knowledge.level === 'visited' || knowledge.level === 'investigated' ? npc.occupation || null : null,
      relationship: relationshipFor(npc, knownIds, knowledge),
      lastKnownContext: visibleNow ? 'Present in the current scene' : knowledge.source,
      portraitUri: knowledge.level === 'rumored' ? null : npc.portraitDataUrl ?? null,
      facts,
    } satisfies NpcProjection];
  }).sort((left, right) => left.name.localeCompare(right.name));
}

function locationProjections(context: PlayerProjectionContext, activeLocationRef: string | null, now: string): { readonly records: LocationProjection[]; readonly features: PlayerMapFeatureProjection[] } {
  const options = collectCampaignLocations(context.world, context.authoringLayer);
  const authoredByRef = new Map(context.npcLocationAuthoring.locations.map((record) => [record.sourceRef, record]));
  const records: LocationProjection[] = [];
  const features: PlayerMapFeatureProjection[] = [];
  for (const option of options) {
    const authored = authoredByRef.get(option.ref);
    let knowledge = knowledgeFor(context, 'location', option.ref, now);
    const ordinaryMapFeature = option.kind === 'settlement' || option.kind === 'anchor' || option.kind === 'authored-feature';
    if (knowledge === null && ordinaryMapFeature) knowledge = { level: 'discovered', alias: null, source: 'Public town map', timestamp: now };
    if (knowledge === null && authored?.visibility === 'players') knowledge = { level: 'discovered', alias: null, source: 'Public campaign location', timestamp: now };
    if (knowledge === null && option.ref === activeLocationRef) knowledge = { level: 'visited', alias: null, source: 'Current scene', timestamp: now };
    if (knowledge === null) continue;
    const rawPoint = tilePoint(context.world, option.tileIndex);
    const visibility = featurePosition(rawPoint, knowledge.level);
    const id = safeId(context.campaign.id, 'location', option.ref);
    const type = authored?.locationType.trim() || option.kind.replaceAll('-', ' ');
    const description = knowledge.level === 'rumored'
      ? knowledge.source
      : authored?.playerDescription.trim() || (knowledge.level === 'investigated' ? authored?.description.trim() || '' : '');
    records.push({
      id,
      name: safeName(authored?.name.trim() || option.label, knowledge, knowledge.alias ?? 'A rumored place'),
      knowledge: knowledge.level,
      type,
      description,
      status: authored?.manualStatus ?? null,
      position: visibility.position,
      discoveredDetails: knowledge.level === 'investigated' ? authored?.tags ?? [] : [],
    });
    features.push({
      id: safeId(context.campaign.id, 'map-location', option.ref),
      kind: option.kind === 'settlement' ? 'community' : option.kind === 'anchor' ? 'anchor' : 'location',
      label: safeName(authored?.name.trim() || option.label, knowledge, knowledge.alias ?? 'Rumored area'),
      knowledge: knowledge.level,
      position: visibility.position,
      approximateRadius: visibility.approximateRadius,
      detail: type,
      linkedEntityId: id,
      color: null,
      expiresAt: null,
    });
  }
  for (const story of context.world.storyObjects) {
    const ref = `story:${story.key}`;
    const authored = authoredByRef.get(ref);
    let knowledge = knowledgeFor(context, 'location', ref, now);
    if (knowledge === null && ref === activeLocationRef) knowledge = { level: 'visited', alias: null, source: 'Current scene', timestamp: now };
    if (knowledge === null) continue;
    const rawPoint = tilePoint(context.world, story.tileIndex);
    const visibility = featurePosition(rawPoint, knowledge.level);
    const id = safeId(context.campaign.id, 'location', ref);
    const type = authored?.locationType.trim() || story.type.replaceAll('-', ' ');
    const label = safeName(authored?.name.trim() || story.name, knowledge, knowledge.alias ?? 'A rumored place');
    records.push({
      id,
      name: label,
      knowledge: knowledge.level,
      type,
      description: knowledge.level === 'rumored' ? knowledge.source : authored?.playerDescription.trim() || '',
      status: authored?.manualStatus ?? null,
      position: visibility.position,
      discoveredDetails: knowledge.level === 'investigated' ? authored?.tags ?? [] : [],
    });
    features.push({
      id: safeId(context.campaign.id, 'map-location', ref),
      kind: 'location',
      label,
      knowledge: knowledge.level,
      position: visibility.position,
      approximateRadius: visibility.approximateRadius,
      detail: type,
      linkedEntityId: id,
      color: '#b66a8c',
      expiresAt: null,
    });
  }
  return {
    records: records.sort((left, right) => left.name.localeCompare(right.name)),
    features,
  };
}

function clueProjections(context: PlayerProjectionContext, now: string): ClueProjection[] {
  return context.campaign.clues.flatMap((clue) => {
    const knowledge = knowledgeFor(context, 'clue', clue.id, now);
    if (knowledge === null) return [];
    return [{
      id: safeId(context.campaign.id, 'clue', clue.id),
      title: safeName(clue.playerTitle.trim() || 'Discovered clue', knowledge, knowledge.alias ?? 'A rumor'),
      description: knowledge.level === 'rumored' ? knowledge.source : clue.description,
      source: clue.source,
      knowledge: knowledge.level,
      linkedEntityIds: clue.linkedEntities.flatMap((reference) => {
        const type = revealSubjectType(reference.type);
        return type !== null && knowledgeFor(context, type, reference.id, now) !== null ? [safeId(context.campaign.id, type, reference.id)] : [];
      }),
      annotations: [],
    } satisfies ClueProjection];
  });
}

function safeUri(uri: string): string | null {
  const trimmed = uri.trim();
  if (/^https:\/\//i.test(trimmed) || /^data:(?:image|audio|video)\//i.test(trimmed)) return trimmed;
  return null;
}

function handoutProjections(context: PlayerProjectionContext, now: string): AssetProjection[] {
  return context.campaign.handouts.flatMap((handout) => {
    const knowledge = knowledgeFor(context, 'handout', handout.id, now);
    if (knowledge === null) return [];
    const asset = handout.assetId === null ? undefined : context.campaign.assets.find((candidate) => candidate.id === handout.assetId);
    return [{
      id: safeId(context.campaign.id, 'handout', handout.id),
      type: asset?.type ?? 'document',
      title: safeName(handout.title, knowledge, knowledge.alias ?? 'Revealed handout'),
      caption: handout.caption || asset?.caption || '',
      alternateText: handout.alternateText || asset?.alternateText || handout.caption,
      safeUri: asset === undefined ? null : safeUri(asset.uri),
      mimeType: asset?.mimeType ?? '',
    } satisfies AssetProjection];
  });
}

function messageThreadProjections(context: PlayerProjectionContext, now: string): MessageThreadProjection[] {
  return context.campaign.messageThreads.flatMap((thread) => {
    const explicitKnowledge = knowledgeFor(context, 'message-thread', thread.id, now);
    const messages = thread.messages.filter((message) =>
      (message.status === 'sent' || message.status === 'received' || message.status === 'read')
        && message.sentAt !== null
        && Date.parse(message.sentAt) <= Date.parse(now)
        && matchingAudience(message.audience, context.viewerId),
    );
    if (explicitKnowledge === null && messages.length === 0) return [];
    return [{
      id: safeId(context.campaign.id, 'thread', thread.id),
      name: explicitKnowledge?.alias ?? thread.name,
      medium: thread.medium,
      messages: messages.map((message) => ({
        id: safeId(context.campaign.id, 'message', message.id),
        senderLabel: message.senderLabel || 'Unknown',
        body: message.body,
        sentAt: message.sentAt ?? message.updatedAt,
        status: message.status === 'read' || message.status === 'received' ? message.status : 'sent',
        presentation: { glitch: message.style.glitch, corruption: message.style.corruption },
      })),
      canReply: context.playerView.capabilitiesByPlayer[context.viewerId]?.includes('message.send.party') === true,
    } satisfies MessageThreadProjection];
  });
}

function objectiveProjections(context: PlayerProjectionContext, now: string): ObjectiveProjection[] {
  return context.campaign.objectives.flatMap((objective) => {
    const knowledge = knowledgeFor(context, 'objective', objective.id, now);
    if ((objective.status === 'hidden' || objective.playerWording.trim().length === 0) && knowledge === null) return [];
    if (objective.status === 'hidden') return [];
    return [{
      id: safeId(context.campaign.id, 'objective', objective.id),
      wording: objective.playerWording,
      status: objective.status,
      completionNote: objective.status === 'completed' ? objective.completionNote : '',
      playerCreated: false,
    } satisfies ObjectiveProjection];
  });
}

function journalProjection(context: PlayerProjectionContext): PlayerProjection['journal'] {
  const playerNameById = new Map(context.playerView.players.map((player) => [player.id, player.displayName]));
  const normalize = (entry: PlayerViewState['journalEntries'][number]): JournalEntryProjection => ({
    id: safeId(context.campaign.id, 'journal', entry.id),
    title: entry.title,
    body: entry.body,
    ownerLabel: playerNameById.get(entry.ownerPlayerId) ?? 'Player',
    sharedWithParty: entry.sharedWithParty,
    linkedEntityIds: [],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
  return {
    personal: context.playerView.journalEntries.filter((entry) => entry.ownerPlayerId === context.viewerId).map(normalize),
    shared: context.playerView.journalEntries.filter((entry) => entry.sharedWithParty).map(normalize),
  };
}

function characterProjection(context: PlayerProjectionContext): CharacterProjection | undefined {
  const viewer = context.playerView.players.find((player) => player.id === context.viewerId);
  if (viewer === undefined) return undefined;
  const character = context.playerView.characters.find((candidate) => candidate.id === viewer.characterId && candidate.ownerPlayerId === viewer.id);
  if (character === undefined) return undefined;
  return {
    id: safeId(context.campaign.id, 'character', character.id),
    name: character.name,
    pronouns: character.pronouns,
    background: character.background,
    portraitUri: safeUri(character.portraitUri ?? ''),
    stats: { ...character.stats },
    conditions: [...character.conditions],
    inventory: [...character.inventory],
    privateNotes: character.privateNotes,
    editableFields: [...character.editableFields],
  };
}

function sceneProjection(context: PlayerProjectionContext, npcs: readonly NpcProjection[], locations: readonly LocationProjection[]): SceneProjection | undefined {
  const sceneId = context.campaign.runState.activeSceneId;
  const scene = sceneId === null ? undefined : context.campaign.scenes.find((candidate) => candidate.id === sceneId);
  if (scene === undefined) return undefined;
  const npcByCanonicalKey = new Map(context.world.npcs.map((npc) => [npc.key, npcs.find((projection) => projection.id === safeId(context.campaign.id, 'npc', npc.key))]));
  const presentNpcs = scene.participants.flatMap((participant) => {
    if (participant.type !== 'npc' || participant.hidden) return [];
    const npc = npcByCanonicalKey.get(participant.id);
    return npc === undefined ? [] : [{ id: npc.id, name: npc.name, description: npc.description }];
  });
  const locationId = scene.locationRef === null ? null : safeId(context.campaign.id, 'location', scene.locationRef);
  const location = locationId === null ? undefined : locations.find((candidate) => candidate.id === locationId);
  return {
    id: safeId(context.campaign.id, 'scene', scene.id),
    title: scene.name.trim() || 'Current scene',
    locationLabel: location?.name ?? (scene.freeformLocation.trim() || 'Location not disclosed'),
    description: scene.playerDescription,
    readAloud: scene.readAloud,
    presentNpcs,
    handoutIds: scene.handoutIds.flatMap((id) => knowledgeFor(context, 'handout', id, nowIso(context.now)) === null ? [] : [safeId(context.campaign.id, 'handout', id)]),
    clueIds: scene.clueIds.flatMap((id) => knowledgeFor(context, 'clue', id, nowIso(context.now)) === null ? [] : [safeId(context.campaign.id, 'clue', id)]),
    exits: scene.exits.map((exit) => ({
      label: exit.label,
      targetSceneId: exit.targetSceneId !== null && knowledgeFor(context, 'scene', exit.targetSceneId, nowIso(context.now)) !== null
        ? safeId(context.campaign.id, 'scene', exit.targetSceneId)
        : null,
    })),
    ambient: {
      time: context.campaign.runState.campaignTime,
      weather: context.campaign.runState.weatherOverride ?? 'auto',
      conditions: [...context.playerView.mapPolicy.publicConditions],
    },
  };
}

function notifications(context: PlayerProjectionContext, now: string): PlayerProjection['notifications'] {
  const items = context.playerView.knowledgeGrants
    .filter((grant) => grant.revokedAt === null && matchingAudience(grant.audience, context.viewerId) && (grant.expiresAt === null || Date.parse(grant.expiresAt) > Date.parse(now)))
    .sort((left, right) => Date.parse(right.grantedAt) - Date.parse(left.grantedAt))
    .slice(0, 8)
    .map((grant) => ({
      id: safeId(context.campaign.id, 'notification', grant.id),
      kind: 'reveal' as const,
      text: grant.alias === null ? `New ${grant.subjectType.replaceAll('-', ' ')} information is available.` : `${grant.alias} is now ${grant.level}.`,
      createdAt: grant.grantedAt,
    }));
  return items;
}

export function createPlayerProjection(context: PlayerProjectionContext): PlayerProjection {
  const now = nowIso(context.now);
  const viewer = context.playerView.players.find((player) => player.id === context.viewerId && player.active);
  if (viewer === undefined) throw new Error('The selected player identity is not available.');
  const character = context.playerView.characters.find((candidate) => candidate.id === viewer.characterId && candidate.ownerPlayerId === viewer.id);
  const activeScene = context.campaign.runState.activeSceneId === null ? undefined : context.campaign.scenes.find((scene) => scene.id === context.campaign.runState.activeSceneId);
  const activeSceneNpcKeys = new Set(activeScene?.participants.filter((participant) => participant.type === 'npc' && !participant.hidden).map((participant) => participant.id) ?? []);
  const npcs = knownNpcProjections(context, activeSceneNpcKeys, now);
  const locations = locationProjections(context, activeScene?.locationRef ?? null, now);
  const scene = sceneProjection(context, npcs, locations.records);
  const partyPosition = activeScene?.locationRef === null || activeScene?.locationRef === undefined
    ? null
    : locations.records.find((location) => location.id === safeId(context.campaign.id, 'location', activeScene.locationRef ?? ''))?.position ?? null;
  const sceneFeature: PlayerMapFeatureProjection[] = scene === undefined || partyPosition === null ? [] : [{
    id: safeId(context.campaign.id, 'map-scene', scene.id),
    kind: 'scene',
    label: scene.title,
    knowledge: 'visited',
    position: partyPosition,
    approximateRadius: null,
    detail: 'Current scene',
    linkedEntityId: scene.id,
    color: viewer.color,
    expiresAt: null,
  }];
  const projectedCharacter = character === undefined ? undefined : characterProjection(context);
  const projection: PlayerProjection = {
    projectionVersion: PLAYER_PROJECTION_VERSION,
    generatedAt: now,
    campaign: {
      id: safeId(context.campaign.id, 'campaign', context.campaign.id),
      name: context.campaign.name,
      status: context.campaign.status,
      campaignTime: context.campaign.runState.campaignTime,
      timezone: context.campaign.runState.timezone,
      weather: context.campaign.runState.weatherOverride ?? 'Automatic',
      publicConditions: [...context.playerView.mapPolicy.publicConditions],
    },
    viewer: {
      id: safeId(context.campaign.id, 'viewer', viewer.id),
      displayName: viewer.displayName,
      characterId: safeId(context.campaign.id, 'character', viewer.characterId),
      characterName: character?.name ?? 'Character',
      color: viewer.color,
    },
    capabilities: [...(context.playerView.capabilitiesByPlayer[viewer.id] ?? [])],
    ...(scene === undefined ? {} : { activeScene: scene }),
    map: {
      base: context.playerView.mapPolicy.includeBaseGeography ? buildBaseGrid(context.world) : null,
      baseImageDataUrl: null,
      unexploredTreatment: context.playerView.mapPolicy.unexploredTreatment,
      roads: context.playerView.mapPolicy.includePublicRoads ? publicRoads(context.world, context.campaign.id) : [],
      buildings: context.playerView.mapPolicy.includeBuildingFootprints ? publicBuildingFootprints(context.world, context.campaign.id) : [],
      features: [...locations.features, ...sceneFeature],
      partyPosition,
      tileSizeMeters: context.world.metadata.tileSizeMeters,
    },
    knownNpcs: npcs,
    knownLocations: locations.records,
    clues: clueProjections(context, now),
    handouts: handoutProjections(context, now),
    messages: messageThreadProjections(context, now),
    ...(projectedCharacter === undefined ? {} : { character: projectedCharacter }),
    journal: journalProjection(context),
    objectives: objectiveProjections(context, now),
    diceRolls: [],
    notifications: notifications(context, now),
    revision: context.campaign.runState.revision,
  };
  const baseImageDataUrl = context.renderPublicMapImage?.(projection) ?? null;
  return deepFreeze(baseImageDataUrl === null
    ? projection
    : { ...projection, map: { ...projection.map, baseImageDataUrl } });
}

export function projectionAudienceForViewer(viewerId: string): readonly PlayerAudience[] {
  return ['party', `player:${viewerId}`];
}
