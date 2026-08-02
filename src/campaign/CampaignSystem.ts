export const CAMPAIGN_SCHEMA_VERSION = 20 as const;

export type CampaignStatus = 'draft' | 'active' | 'archived';
export type SceneStatus = 'draft' | 'ready' | 'active' | 'paused' | 'completed' | 'archived';
export type CampaignAudience = 'gm-only' | 'party' | `player:${string}`;
export type TimelineEventStatus = 'scheduled' | 'eligible' | 'triggered' | 'skipped' | 'delayed' | 'completed' | 'reverted' | 'failed';
export type SessionStatus = 'planned' | 'active' | 'paused' | 'completed';
export type ObjectiveStatus = 'hidden' | 'active' | 'completed' | 'failed' | 'abandoned';
export type CampaignWeather = 'auto' | 'clear' | 'cloudy' | 'rain' | 'heavy-rain' | 'thunderstorm' | 'typhoon';
export type CampaignEntityType = 'scene' | 'event' | 'clue' | 'handout' | 'objective' | 'message-thread' | 'note' | 'session' | 'asset' | 'npc' | 'location' | 'character';
export type CampaignParticipantType = 'character' | 'npc' | 'group';
export type CampaignAssetType = 'image' | 'audio' | 'document' | 'video' | 'external-link';
export type MessageStatus = 'draft' | 'queued' | 'sent' | 'received' | 'read' | 'failed' | 'cancelled';

export interface CampaignParticipantRef {
  readonly id: string;
  readonly type: CampaignParticipantType;
  readonly label: string;
  readonly hidden: boolean;
}

export interface CampaignEntityRef {
  readonly type: CampaignEntityType;
  readonly id: string;
}

export interface ScenePresentation {
  readonly ambientAssetId: string | null;
  readonly revealAssetId: string | null;
  readonly mapFocusRef: string | null;
  readonly defaultWeather: CampaignWeather | null;
  readonly defaultTime: string | null;
}

export interface CampaignScene {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly status: SceneStatus;
  readonly tags: readonly string[];
  readonly arc: string;
  readonly sessionTarget: string;
  readonly locationRef: string | null;
  readonly freeformLocation: string;
  readonly gmDescription: string;
  readonly playerDescription: string;
  readonly sensoryDetails: string;
  readonly readAloud: string;
  readonly participants: readonly CampaignParticipantRef[];
  readonly clueIds: readonly string[];
  readonly handoutIds: readonly string[];
  readonly messageThreadIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly noteIds: readonly string[];
  readonly exits: readonly { readonly label: string; readonly targetSceneId: string | null }[];
  readonly presentation: ScenePresentation;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type CampaignEventTrigger =
  | { readonly kind: 'manual' }
  | { readonly kind: 'time'; readonly at: string }
  | { readonly kind: 'scene-activation'; readonly sceneId: string }
  | { readonly kind: 'relative'; readonly eventId: string; readonly offsetMinutes: number }
  | { readonly kind: 'window'; readonly startsAt: string; readonly endsAt: string }
  | { readonly kind: 'condition'; readonly key: string; readonly expectedValue: string }
  | { readonly kind: 'recurring'; readonly everyMinutes: number; readonly startsAt: string; readonly until: string | null };

export type CampaignEventAction =
  | { readonly id: string; readonly kind: 'activate-scene'; readonly sceneId: string }
  | { readonly id: string; readonly kind: 'queue-reveal'; readonly entityType: CampaignEntityType; readonly entityId: string; readonly audience: CampaignAudience }
  | { readonly id: string; readonly kind: 'set-weather'; readonly weather: CampaignWeather }
  | { readonly id: string; readonly kind: 'add-note'; readonly text: string }
  | { readonly id: string; readonly kind: 'mark-objective'; readonly objectiveId: string; readonly status: ObjectiveStatus }
  | { readonly id: string; readonly kind: 'send-message'; readonly threadId: string; readonly messageId: string }
  | { readonly id: string; readonly kind: 'advance-time'; readonly minutes: number };

export interface CampaignTimelineEvent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly trigger: CampaignEventTrigger;
  readonly actions: readonly CampaignEventAction[];
  readonly status: TimelineEventStatus;
  readonly enabled: boolean;
  readonly confirmationRequired: boolean;
  readonly autoSafe: boolean;
  readonly targetSceneId: string | null;
  readonly tags: readonly string[];
  readonly lastTriggeredAt: string | null;
  readonly triggerCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignClue {
  readonly id: string;
  readonly gmTitle: string;
  readonly playerTitle: string;
  readonly description: string;
  readonly source: string;
  readonly linkedEntities: readonly CampaignEntityRef[];
  readonly discoveryState: 'hidden' | 'available' | 'revealed';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignHandout {
  readonly id: string;
  readonly title: string;
  readonly assetId: string | null;
  readonly caption: string;
  readonly alternateText: string;
  readonly sceneIds: readonly string[];
  readonly presentationOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignObjective {
  readonly id: string;
  readonly gmIntent: string;
  readonly playerWording: string;
  readonly status: ObjectiveStatus;
  readonly dependencyIds: readonly string[];
  readonly completionNote: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignRevealRecord {
  readonly id: string;
  readonly entityType: CampaignEntityType;
  readonly entityId: string;
  readonly audience: CampaignAudience;
  readonly timestamp: string;
  readonly sourceSceneId: string | null;
  readonly sourceSessionId: string | null;
  readonly sourceEventId: string | null;
  readonly reversible: boolean;
  readonly revokedAt: string | null;
  readonly note: string;
}

export interface CampaignMessage {
  readonly id: string;
  readonly senderRef: string;
  readonly senderLabel: string;
  readonly body: string;
  readonly status: MessageStatus;
  readonly scheduledAt: string | null;
  readonly sentAt: string | null;
  readonly linkedSceneId: string | null;
  readonly audience: CampaignAudience;
  readonly style: {
    readonly typingDelayMs: number;
    readonly glitch: boolean;
    readonly corruption: number;
    readonly soundAssetId: string | null;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignMessageThread {
  readonly id: string;
  readonly name: string;
  readonly medium: string;
  readonly participantRefs: readonly string[];
  readonly sceneIds: readonly string[];
  readonly tags: readonly string[];
  readonly messages: readonly CampaignMessage[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignAsset {
  readonly id: string;
  readonly name: string;
  readonly type: CampaignAssetType;
  readonly uri: string;
  readonly mimeType: string;
  readonly fileSize: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
  readonly alternateText: string;
  readonly caption: string;
  readonly tags: readonly string[];
  readonly rightsNote: string;
  readonly checksum: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignNote {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly kind: 'gm' | 'prep' | 'live' | 'recap' | 'checklist';
  readonly linkedEntities: readonly CampaignEntityRef[];
  readonly sessionId: string | null;
  readonly completed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignEncounter {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly participantRefs: readonly string[];
  readonly notes: string;
  readonly assetIds: readonly string[];
  readonly startedAt: string;
  readonly endedAt: string | null;
}

export interface CampaignActivityRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly sessionId: string | null;
  readonly source: string;
  readonly action: string;
  readonly entityRef: CampaignEntityRef | null;
  readonly summary: string;
  readonly revision: number;
  readonly reversible: boolean;
}

export interface CampaignCheckpointSnapshot {
  readonly runState: CampaignRunState;
  readonly sceneStatuses: Readonly<Record<string, SceneStatus>>;
  readonly eventStatuses: Readonly<Record<string, TimelineEventStatus>>;
  readonly objectiveStatuses: Readonly<Record<string, ObjectiveStatus>>;
  readonly reveals: readonly CampaignRevealRecord[];
}

export interface CampaignCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly timestamp: string;
  readonly sessionId: string | null;
  readonly revision: number;
  readonly snapshot: CampaignCheckpointSnapshot;
}

export interface CampaignSession {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly plannedAt: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly status: SessionStatus;
  readonly attendeeRefs: readonly string[];
  readonly sceneIds: readonly string[];
  readonly openingSceneId: string | null;
  readonly openingTime: string | null;
  readonly liveLogIds: readonly string[];
  readonly noteIds: readonly string[];
  readonly recap: string;
  readonly unresolvedThreads: readonly string[];
  readonly nextSessionChecklistIds: readonly string[];
  readonly checkpointIds: readonly string[];
  readonly unusedPreparedSceneIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignRunState {
  readonly activeSessionId: string | null;
  readonly activeSceneId: string | null;
  readonly campaignTime: string;
  readonly timezone: string;
  readonly weatherOverride: CampaignWeather | null;
  readonly activeEncounterId: string | null;
  readonly revision: number;
}

export interface CampaignState {
  readonly schemaVersion: typeof CAMPAIGN_SCHEMA_VERSION;
  readonly id: string;
  readonly worldRef: string;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly scenes: readonly CampaignScene[];
  readonly timelineEvents: readonly CampaignTimelineEvent[];
  readonly clues: readonly CampaignClue[];
  readonly handouts: readonly CampaignHandout[];
  readonly objectives: readonly CampaignObjective[];
  readonly messageThreads: readonly CampaignMessageThread[];
  readonly sessions: readonly CampaignSession[];
  readonly notes: readonly CampaignNote[];
  readonly assets: readonly CampaignAsset[];
  readonly reveals: readonly CampaignRevealRecord[];
  readonly encounters: readonly CampaignEncounter[];
  readonly activityLog: readonly CampaignActivityRecord[];
  readonly checkpoints: readonly CampaignCheckpoint[];
  readonly runState: CampaignRunState;
}

export interface CampaignReferenceContext {
  readonly worldRef: string;
  readonly npcIds: ReadonlySet<string>;
  readonly locationIds: ReadonlySet<string>;
  readonly characterIds?: ReadonlySet<string>;
  readonly externalAssetIds?: ReadonlySet<string>;
}

export interface CampaignReferenceIssue {
  readonly severity: 'warning' | 'error';
  readonly owner: CampaignEntityRef | { readonly type: 'campaign'; readonly id: string };
  readonly field: string;
  readonly missingRef: string;
  readonly message: string;
}

export interface CampaignSearchResult {
  readonly type: CampaignEntityType;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly score: number;
}

export interface TimeAdvancePreview {
  readonly from: string;
  readonly to: string;
  readonly minutes: number;
  readonly eligibleEventIds: readonly string[];
  readonly largeJump: boolean;
}

export interface EventTriggerResult {
  readonly state: CampaignState;
  readonly appliedActionIds: readonly string[];
  readonly requiresConfirmation: boolean;
  readonly message: string;
}

export interface CampaignExportManifest {
  readonly schemaVersion: number;
  readonly campaignId: string;
  readonly worldRef: string;
  readonly exportedAt: string;
  readonly entityCounts: Readonly<Record<string, number>>;
  readonly assetRefs: readonly { readonly id: string; readonly uri: string; readonly checksum: string | null }[];
}

function nowIso(now: string | Date | number = new Date()): string {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function id(prefix: string): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID !== undefined) return `${prefix}:${cryptoApi.randomUUID()}`;
  return `${prefix}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function bump(
  state: CampaignState,
  actor: string,
  source: string,
  action: string,
  summary: string,
  entityRef: CampaignEntityRef | null,
  now: string,
  reversible = true,
  patch: Partial<Omit<CampaignState, 'schemaVersion' | 'id' | 'worldRef' | 'createdAt'>> = {},
): CampaignState {
  const revision = state.runState.revision + 1;
  const activity: CampaignActivityRecord = {
    id: id('activity'), timestamp: now, actor, sessionId: state.runState.activeSessionId, source, action,
    entityRef, summary, revision, reversible,
  };
  return {
    ...state,
    ...patch,
    updatedAt: now,
    runState: { ...(patch.runState ?? state.runState), revision },
    activityLog: [activity, ...(patch.activityLog ?? state.activityLog)].slice(0, 1000),
  };
}

export function createCampaign(worldRef: string, name = 'Untitled Campaign', timestamp: string | Date | number = new Date(), timezone = 'Asia/Manila'): CampaignState {
  const now = nowIso(timestamp);
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    id: id('campaign'),
    worldRef,
    name: name.trim() || 'Untitled Campaign',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    scenes: [], timelineEvents: [], clues: [], handouts: [], objectives: [], messageThreads: [], sessions: [], notes: [], assets: [],
    reveals: [], encounters: [], activityLog: [], checkpoints: [],
    runState: {
      activeSessionId: null, activeSceneId: null, campaignTime: now, timezone: timezone.trim() || 'Asia/Manila',
      weatherOverride: null, activeEncounterId: null, revision: 0,
    },
  };
}

export function createScene(state: CampaignState, input: Partial<CampaignScene> & Pick<CampaignScene, 'name'>, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const now = nowIso(timestamp);
  const scene: CampaignScene = {
    id: input.id ?? id('scene'), name: input.name.trim() || 'Untitled Scene', type: input.type ?? 'location', status: input.status ?? 'draft',
    tags: uniqueStrings(input.tags ?? []), arc: input.arc ?? '', sessionTarget: input.sessionTarget ?? '', locationRef: input.locationRef ?? null,
    freeformLocation: input.freeformLocation ?? '', gmDescription: input.gmDescription ?? '', playerDescription: input.playerDescription ?? '',
    sensoryDetails: input.sensoryDetails ?? '', readAloud: input.readAloud ?? '', participants: input.participants ?? [], clueIds: uniqueStrings(input.clueIds ?? []),
    handoutIds: uniqueStrings(input.handoutIds ?? []), messageThreadIds: uniqueStrings(input.messageThreadIds ?? []), assetIds: uniqueStrings(input.assetIds ?? []),
    noteIds: uniqueStrings(input.noteIds ?? []), exits: input.exits ?? [],
    presentation: input.presentation ?? { ambientAssetId: null, revealAssetId: null, mapFocusRef: null, defaultWeather: null, defaultTime: null },
    createdAt: input.createdAt ?? now, updatedAt: now,
  };
  return bump(state, actor, 'scene-library', 'create-scene', `Created scene “${scene.name}”.`, { type: 'scene', id: scene.id }, now, true, { scenes: [...state.scenes, scene] });
}

export function updateScene(state: CampaignState, sceneId: string, changes: Partial<Omit<CampaignScene, 'id' | 'createdAt'>>, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const scene = state.scenes.find((candidate) => candidate.id === sceneId);
  if (scene === undefined) return state;
  const now = nowIso(timestamp);
  const next: CampaignScene = { ...scene, ...changes, id: scene.id, createdAt: scene.createdAt, updatedAt: now };
  return bump(state, actor, 'scene-library', 'update-scene', `Updated scene “${next.name}”.`, { type: 'scene', id: scene.id }, now, true, {
    scenes: state.scenes.map((candidate) => candidate.id === sceneId ? next : candidate),
  });
}

export function activateScene(state: CampaignState, sceneId: string, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const scene = state.scenes.find((candidate) => candidate.id === sceneId);
  if (scene === undefined || scene.status === 'archived') return state;
  const now = nowIso(timestamp);
  const previousId = state.runState.activeSceneId;
  const scenes = state.scenes.map((candidate): CampaignScene => {
    if (candidate.id === sceneId) return { ...candidate, status: 'active', updatedAt: now };
    if (candidate.id === previousId && candidate.status === 'active') return { ...candidate, status: 'paused', updatedAt: now };
    return candidate;
  });
  return bump(state, actor, 'scene-director', 'activate-scene', `Activated scene “${scene.name}”.`, { type: 'scene', id: scene.id }, now, true, {
    status: state.status === 'draft' ? 'active' : state.status,
    scenes,
    runState: { ...state.runState, activeSceneId: sceneId },
  });
}

export function pauseActiveScene(state: CampaignState, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const sceneId = state.runState.activeSceneId;
  if (sceneId === null) return state;
  const scene = state.scenes.find((candidate) => candidate.id === sceneId);
  const now = nowIso(timestamp);
  return bump(state, actor, 'scene-director', 'pause-scene', `Paused scene “${scene?.name ?? sceneId}”.`, { type: 'scene', id: sceneId }, now, true, {
    scenes: state.scenes.map((candidate) => candidate.id === sceneId ? { ...candidate, status: 'paused', updatedAt: now } : candidate),
    runState: { ...state.runState, activeSceneId: null },
  });
}

export function completeActiveScene(state: CampaignState, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const sceneId = state.runState.activeSceneId;
  if (sceneId === null) return state;
  const scene = state.scenes.find((candidate) => candidate.id === sceneId);
  const now = nowIso(timestamp);
  return bump(state, actor, 'scene-director', 'complete-scene', `Completed scene “${scene?.name ?? sceneId}”.`, { type: 'scene', id: sceneId }, now, true, {
    scenes: state.scenes.map((candidate) => candidate.id === sceneId ? { ...candidate, status: 'completed', updatedAt: now } : candidate),
    runState: { ...state.runState, activeSceneId: null },
  });
}

export function stageSceneParticipant(
  state: CampaignState,
  sceneId: string,
  participant: CampaignParticipantRef,
  present: boolean,
  actor = 'GM',
  timestamp: string | Date | number = new Date(),
): CampaignState {
  const scene = state.scenes.find((candidate) => candidate.id === sceneId);
  if (scene === undefined) return state;
  const current = scene.participants.filter((candidate) => !(candidate.id === participant.id && candidate.type === participant.type));
  const participants = present ? [...current, participant] : current;
  return updateScene(state, sceneId, { participants }, actor, timestamp);
}

export function createTimelineEvent(
  state: CampaignState,
  input: Partial<CampaignTimelineEvent> & Pick<CampaignTimelineEvent, 'name' | 'trigger'>,
  actor = 'GM',
  timestamp: string | Date | number = new Date(),
): CampaignState {
  const now = nowIso(timestamp);
  const event: CampaignTimelineEvent = {
    id: input.id ?? id('event'), name: input.name.trim() || 'Untitled Event', description: input.description ?? '', trigger: input.trigger,
    actions: input.actions ?? [], status: input.status ?? 'scheduled', enabled: input.enabled !== false,
    confirmationRequired: input.confirmationRequired !== false, autoSafe: input.autoSafe === true, targetSceneId: input.targetSceneId ?? null,
    tags: uniqueStrings(input.tags ?? []), lastTriggeredAt: input.lastTriggeredAt ?? null, triggerCount: input.triggerCount ?? 0,
    createdAt: input.createdAt ?? now, updatedAt: now,
  };
  return bump(state, actor, 'timeline', 'create-event', `Created timeline event “${event.name}”.`, { type: 'event', id: event.id }, now, true, {
    timelineEvents: [...state.timelineEvents, event],
  });
}

function eventTime(event: CampaignTimelineEvent): number | null {
  if (event.trigger.kind === 'time') {
    const time = Date.parse(event.trigger.at);
    return Number.isFinite(time) ? time : null;
  }
  if (event.trigger.kind === 'window') {
    const time = Date.parse(event.trigger.startsAt);
    return Number.isFinite(time) ? time : null;
  }
  if (event.trigger.kind === 'recurring') {
    const time = Date.parse(event.trigger.startsAt);
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

export function previewTimelineEventsBetween(state: CampaignState, from: string, to: string): readonly CampaignTimelineEvent[] {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return state.timelineEvents.filter((event) => {
    if (!event.enabled || ['triggered', 'completed', 'skipped'].includes(event.status)) return false;
    if (event.trigger.kind === 'window') {
      const windowStart = Date.parse(event.trigger.startsAt);
      const windowEnd = Date.parse(event.trigger.endsAt);
      return Number.isFinite(windowStart) && Number.isFinite(windowEnd) && windowEnd >= start && windowStart <= end;
    }
    const time = eventTime(event);
    return time !== null && time > start && time <= end;
  }).sort((left, right) => (eventTime(left) ?? 0) - (eventTime(right) ?? 0));
}

export function previewCampaignTimeAdvance(state: CampaignState, minutes: number): TimeAdvancePreview {
  const fromMs = Date.parse(state.runState.campaignTime);
  const safeFrom = Number.isFinite(fromMs) ? fromMs : Date.now();
  const to = new Date(safeFrom + minutes * 60_000).toISOString();
  const eligible = previewTimelineEventsBetween(state, new Date(safeFrom).toISOString(), to);
  return { from: new Date(safeFrom).toISOString(), to, minutes, eligibleEventIds: eligible.map((event) => event.id), largeJump: Math.abs(minutes) >= 240 };
}

export function setCampaignTime(
  state: CampaignState,
  target: string | Date | number,
  actor = 'GM',
  source = 'campaign-clock',
  timestamp: string | Date | number = new Date(),
): { readonly state: CampaignState; readonly preview: TimeAdvancePreview } {
  const current = Date.parse(state.runState.campaignTime);
  const targetMs = target instanceof Date ? target.getTime() : typeof target === 'number' ? target : Date.parse(target);
  if (!Number.isFinite(targetMs)) return { state, preview: previewCampaignTimeAdvance(state, 0) };
  const minutes = Math.round((targetMs - (Number.isFinite(current) ? current : targetMs)) / 60_000);
  const preview: TimeAdvancePreview = {
    from: new Date(Number.isFinite(current) ? current : targetMs).toISOString(), to: new Date(targetMs).toISOString(), minutes,
    eligibleEventIds: previewTimelineEventsBetween(state, new Date(Number.isFinite(current) ? current : targetMs).toISOString(), new Date(targetMs).toISOString()).map((event) => event.id),
    largeJump: Math.abs(minutes) >= 240,
  };
  const now = nowIso(timestamp);
  const next = bump(state, actor, source, 'set-time', `Set campaign time to ${new Date(targetMs).toISOString()}.`, null, now, true, {
    runState: { ...state.runState, campaignTime: new Date(targetMs).toISOString() },
    timelineEvents: state.timelineEvents.map((event) => preview.eligibleEventIds.includes(event.id) && event.status === 'scheduled' ? { ...event, status: 'eligible', updatedAt: now } : event),
  });
  return { state: next, preview };
}

export function advanceCampaignTime(state: CampaignState, minutes: number, actor = 'GM', timestamp: string | Date | number = new Date()): { readonly state: CampaignState; readonly preview: TimeAdvancePreview } {
  const preview = previewCampaignTimeAdvance(state, minutes);
  const result = setCampaignTime(state, preview.to, actor, 'campaign-clock', timestamp);
  return { state: result.state, preview };
}

export function setCampaignWeather(state: CampaignState, weather: CampaignWeather | null, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const now = nowIso(timestamp);
  return bump(state, actor, 'scene-director', 'set-weather', weather === null || weather === 'auto' ? 'Returned campaign weather to automatic.' : `Set campaign weather to ${weather}.`, null, now, true, {
    runState: { ...state.runState, weatherOverride: weather === 'auto' ? null : weather },
  });
}

export function setCampaignTimezone(state: CampaignState, timezone: string, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const value = timezone.trim();
  if (value.length === 0 || value === state.runState.timezone) return state;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date()); } catch { return state; }
  const now = nowIso(timestamp);
  return bump(state, actor, 'campaign-clock', 'set-timezone', `Set campaign timezone to ${value}.`, null, now, true, {
    runState: { ...state.runState, timezone: value },
  });
}

export function createClue(state: CampaignState, input: Partial<CampaignClue> & Pick<CampaignClue, 'gmTitle'>, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const now = nowIso(timestamp);
  const clue: CampaignClue = {
    id: input.id ?? id('clue'), gmTitle: input.gmTitle.trim() || 'Untitled Clue', playerTitle: input.playerTitle ?? input.gmTitle,
    description: input.description ?? '', source: input.source ?? '', linkedEntities: input.linkedEntities ?? [],
    discoveryState: input.discoveryState ?? 'hidden', createdAt: input.createdAt ?? now, updatedAt: now,
  };
  return bump(state, actor, 'information', 'create-clue', `Created clue “${clue.gmTitle}”.`, { type: 'clue', id: clue.id }, now, true, { clues: [...state.clues, clue] });
}

export function createHandout(state: CampaignState, input: Partial<CampaignHandout> & Pick<CampaignHandout, 'title'>, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const now = nowIso(timestamp);
  const handout: CampaignHandout = {
    id: input.id ?? id('handout'), title: input.title.trim() || 'Untitled Handout', assetId: input.assetId ?? null,
    caption: input.caption ?? '', alternateText: input.alternateText ?? '', sceneIds: uniqueStrings(input.sceneIds ?? []),
    presentationOrder: input.presentationOrder ?? state.handouts.length, createdAt: input.createdAt ?? now, updatedAt: now,
  };
  return bump(state, actor, 'information', 'create-handout', `Created handout “${handout.title}”.`, { type: 'handout', id: handout.id }, now, true, { handouts: [...state.handouts, handout] });
}

export function createObjective(state: CampaignState, input: Partial<CampaignObjective> & Pick<CampaignObjective, 'gmIntent'>, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const now = nowIso(timestamp);
  const objective: CampaignObjective = {
    id: input.id ?? id('objective'), gmIntent: input.gmIntent.trim() || 'Untitled Objective', playerWording: input.playerWording ?? '',
    status: input.status ?? 'hidden', dependencyIds: uniqueStrings(input.dependencyIds ?? []), completionNote: input.completionNote ?? '',
    createdAt: input.createdAt ?? now, updatedAt: now,
  };
  return bump(state, actor, 'information', 'create-objective', `Created objective “${objective.gmIntent}”.`, { type: 'objective', id: objective.id }, now, true, { objectives: [...state.objectives, objective] });
}

export function revealCampaignEntity(
  state: CampaignState,
  entityType: CampaignEntityType,
  entityId: string,
  audience: CampaignAudience = 'party',
  actor = 'GM',
  timestamp: string | Date | number = new Date(),
  sourceEventId: string | null = null,
): CampaignState {
  const now = nowIso(timestamp);
  const existing = state.reveals.find((reveal) => reveal.entityType === entityType && reveal.entityId === entityId && reveal.audience === audience && reveal.revokedAt === null);
  if (existing !== undefined) return state;
  const reveal: CampaignRevealRecord = {
    id: id('reveal'), entityType, entityId, audience, timestamp: now, sourceSceneId: state.runState.activeSceneId,
    sourceSessionId: state.runState.activeSessionId, sourceEventId, reversible: true, revokedAt: null, note: '',
  };
  const clues = entityType === 'clue' ? state.clues.map((clue) => clue.id === entityId ? { ...clue, discoveryState: 'revealed' as const, updatedAt: now } : clue) : state.clues;
  return bump(state, actor, 'reveal', 'reveal-entity', `Revealed ${entityType} ${entityId} to ${audience}.`, { type: entityType, id: entityId }, now, true, {
    clues, reveals: [...state.reveals, reveal],
  });
}

export function revokeReveal(state: CampaignState, revealId: string, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const reveal = state.reveals.find((candidate) => candidate.id === revealId);
  if (reveal === undefined || reveal.revokedAt !== null) return state;
  const now = nowIso(timestamp);
  return bump(state, actor, 'reveal', 'revoke-reveal', `Revoked reveal ${reveal.id}.`, { type: reveal.entityType, id: reveal.entityId }, now, true, {
    reveals: state.reveals.map((candidate) => candidate.id === revealId ? { ...candidate, revokedAt: now } : candidate),
  });
}

export function createMessageThread(state: CampaignState, name: string, medium = 'Messenger', actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const now = nowIso(timestamp);
  const thread: CampaignMessageThread = { id: id('thread'), name: name.trim() || 'Untitled Thread', medium, participantRefs: [], sceneIds: [], tags: [], messages: [], createdAt: now, updatedAt: now };
  return bump(state, actor, 'messages', 'create-thread', `Created message thread “${thread.name}”.`, { type: 'message-thread', id: thread.id }, now, true, { messageThreads: [...state.messageThreads, thread] });
}

export function addMessageDraft(
  state: CampaignState,
  threadId: string,
  input: Pick<CampaignMessage, 'senderRef' | 'senderLabel' | 'body'> & Partial<CampaignMessage>,
  actor = 'GM',
  timestamp: string | Date | number = new Date(),
): CampaignState {
  const thread = state.messageThreads.find((candidate) => candidate.id === threadId);
  if (thread === undefined || input.body.trim().length === 0) return state;
  const now = nowIso(timestamp);
  const message: CampaignMessage = {
    id: input.id ?? id('message'), senderRef: input.senderRef, senderLabel: input.senderLabel, body: input.body,
    status: input.status ?? 'draft', scheduledAt: input.scheduledAt ?? null, sentAt: input.sentAt ?? null,
    linkedSceneId: input.linkedSceneId ?? state.runState.activeSceneId, audience: input.audience ?? 'party',
    style: input.style ?? { typingDelayMs: 0, glitch: false, corruption: 0, soundAssetId: null }, createdAt: input.createdAt ?? now, updatedAt: now,
  };
  return bump(state, actor, 'messages', 'add-message', `Added a message to “${thread.name}”.`, { type: 'message-thread', id: threadId }, now, true, {
    messageThreads: state.messageThreads.map((candidate) => candidate.id === threadId ? { ...candidate, messages: [...candidate.messages, message], updatedAt: now } : candidate),
  });
}

export function sendCampaignMessage(state: CampaignState, threadId: string, messageId: string, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const thread = state.messageThreads.find((candidate) => candidate.id === threadId);
  const message = thread?.messages.find((candidate) => candidate.id === messageId);
  if (thread === undefined || message === undefined || message.status === 'sent') return state;
  const now = nowIso(timestamp);
  return bump(state, actor, 'messages', 'send-message', `Sent a message in “${thread.name}”.`, { type: 'message-thread', id: threadId }, now, true, {
    messageThreads: state.messageThreads.map((candidate) => candidate.id === threadId ? {
      ...candidate, updatedAt: now,
      messages: candidate.messages.map((candidateMessage) => candidateMessage.id === messageId ? { ...candidateMessage, status: 'sent', sentAt: now, updatedAt: now } : candidateMessage),
    } : candidate),
  });
}

export function clearCampaignMessages(state: CampaignState, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const messageCount = state.messageThreads.reduce((total, thread) => total + thread.messages.length, 0);
  if (messageCount === 0) return state;
  const now = nowIso(timestamp);
  return bump(
    state,
    actor,
    'messages',
    'clear-message-history',
    `Cleared ${messageCount} message${messageCount === 1 ? '' : 's'} while retaining the campaign threads.`,
    null,
    now,
    false,
    {
      messageThreads: state.messageThreads.map((thread) => ({ ...thread, messages: [], updatedAt: now })),
    },
  );
}

export function addCampaignNote(
  state: CampaignState,
  title: string,
  body: string,
  kind: CampaignNote['kind'] = 'gm',
  actor = 'GM',
  timestamp: string | Date | number = new Date(),
  linkedEntities: readonly CampaignEntityRef[] = [],
): CampaignState {
  if (title.trim().length === 0 && body.trim().length === 0) return state;
  const now = nowIso(timestamp);
  const note: CampaignNote = {
    id: id('note'), title: title.trim() || body.trim().slice(0, 80) || 'Untitled Note', body, kind, linkedEntities,
    sessionId: state.runState.activeSessionId, completed: false, createdAt: now, updatedAt: now,
  };
  return bump(state, actor, 'notes', 'add-note', `Added note “${note.title}”.`, { type: 'note', id: note.id }, now, true, { notes: [...state.notes, note] });
}

export function setCampaignNoteCompleted(state: CampaignState, noteId: string, completed: boolean, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const note = state.notes.find((candidate) => candidate.id === noteId);
  if (note === undefined || note.completed === completed) return state;
  const now = nowIso(timestamp);
  return bump(state, actor, 'notes', completed ? 'complete-checklist' : 'reopen-checklist', `${completed ? 'Completed' : 'Reopened'} “${note.title}”.`, { type: 'note', id: note.id }, now, true, {
    notes: state.notes.map((candidate) => candidate.id === noteId ? { ...candidate, completed, updatedAt: now } : candidate),
  });
}

export function createAsset(state: CampaignState, input: Partial<CampaignAsset> & Pick<CampaignAsset, 'name' | 'type'>, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const now = nowIso(timestamp);
  const asset: CampaignAsset = {
    id: input.id ?? id('asset'), name: input.name.trim() || 'Untitled Asset', type: input.type, uri: input.uri ?? '', mimeType: input.mimeType ?? '',
    fileSize: input.fileSize ?? null, width: input.width ?? null, height: input.height ?? null, durationSeconds: input.durationSeconds ?? null,
    alternateText: input.alternateText ?? '', caption: input.caption ?? '', tags: uniqueStrings(input.tags ?? []), rightsNote: input.rightsNote ?? '',
    checksum: input.checksum ?? null, createdAt: input.createdAt ?? now, updatedAt: now,
  };
  return bump(state, actor, 'assets', 'create-asset', `Added asset “${asset.name}”.`, { type: 'asset', id: asset.id }, now, true, { assets: [...state.assets, asset] });
}

function checkpointSnapshot(state: CampaignState): CampaignCheckpointSnapshot {
  return {
    runState: structuredClone(state.runState),
    sceneStatuses: Object.fromEntries(state.scenes.map((scene) => [scene.id, scene.status])),
    eventStatuses: Object.fromEntries(state.timelineEvents.map((event) => [event.id, event.status])),
    objectiveStatuses: Object.fromEntries(state.objectives.map((objective) => [objective.id, objective.status])),
    reveals: structuredClone(state.reveals),
  };
}

export function createCheckpoint(state: CampaignState, label: string, timestamp: string | Date | number = new Date()): { readonly state: CampaignState; readonly checkpointId: string } {
  const now = nowIso(timestamp);
  const checkpoint: CampaignCheckpoint = {
    id: id('checkpoint'), label: label.trim() || `Checkpoint ${state.checkpoints.length + 1}`, timestamp: now,
    sessionId: state.runState.activeSessionId, revision: state.runState.revision, snapshot: checkpointSnapshot(state),
  };
  return { state: { ...state, checkpoints: [...state.checkpoints, checkpoint], updatedAt: now }, checkpointId: checkpoint.id };
}

export function restoreCheckpoint(state: CampaignState, checkpointId: string, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const checkpoint = state.checkpoints.find((candidate) => candidate.id === checkpointId);
  if (checkpoint === undefined) return state;
  const now = nowIso(timestamp);
  const snapshot = checkpoint.snapshot;
  return bump(state, actor, 'session-recovery', 'restore-checkpoint', `Restored checkpoint “${checkpoint.label}”.`, { type: 'session', id: checkpoint.sessionId ?? 'none' }, now, false, {
    scenes: state.scenes.map((scene) => ({ ...scene, status: snapshot.sceneStatuses[scene.id] ?? scene.status, updatedAt: now })),
    timelineEvents: state.timelineEvents.map((event) => ({ ...event, status: snapshot.eventStatuses[event.id] ?? event.status, updatedAt: now })),
    objectives: state.objectives.map((objective) => ({ ...objective, status: snapshot.objectiveStatuses[objective.id] ?? objective.status, updatedAt: now })),
    reveals: structuredClone(snapshot.reveals),
    runState: { ...snapshot.runState },
  });
}

export function startSession(
  state: CampaignState,
  input: { readonly title?: string; readonly attendeeRefs?: readonly string[]; readonly openingSceneId?: string | null; readonly openingTime?: string | null } = {},
  actor = 'GM',
  timestamp: string | Date | number = new Date(),
): CampaignState {
  if (state.runState.activeSessionId !== null) return state;
  const now = nowIso(timestamp);
  const checkpointResult = createCheckpoint(state, `Before Session ${state.sessions.length + 1}`, now);
  let current = checkpointResult.state;
  const session: CampaignSession = {
    id: id('session'), number: state.sessions.length + 1, title: input.title?.trim() || `Session ${state.sessions.length + 1}`,
    plannedAt: null, startedAt: now, endedAt: null, status: 'active', attendeeRefs: uniqueStrings(input.attendeeRefs ?? []),
    sceneIds: input.openingSceneId === undefined || input.openingSceneId === null ? [] : [input.openingSceneId], openingSceneId: input.openingSceneId ?? null,
    openingTime: input.openingTime ?? state.runState.campaignTime, liveLogIds: [], noteIds: [], recap: '', unresolvedThreads: [], nextSessionChecklistIds: [],
    checkpointIds: [checkpointResult.checkpointId], unusedPreparedSceneIds: [], createdAt: now, updatedAt: now,
  };
  current = bump(current, actor, 'sessions', 'start-session', `Started ${session.title}.`, { type: 'session', id: session.id }, now, false, {
    sessions: [...current.sessions, session], status: 'active',
    runState: {
      ...current.runState, activeSessionId: session.id,
      campaignTime: input.openingTime === undefined || input.openingTime === null ? current.runState.campaignTime : nowIso(input.openingTime),
    },
  });
  if (input.openingSceneId !== undefined && input.openingSceneId !== null) current = activateScene(current, input.openingSceneId, actor, now);
  return current;
}

export function endSession(
  state: CampaignState,
  recap: string,
  actor = 'GM',
  timestamp: string | Date | number = new Date(),
  pauseScene = true,
): CampaignState {
  const sessionId = state.runState.activeSessionId;
  if (sessionId === null) return state;
  const now = nowIso(timestamp);
  let current = pauseScene ? pauseActiveScene(state, actor, now) : state;
  const used = new Set(current.activityLog.filter((entry) => entry.sessionId === sessionId && entry.entityRef?.type === 'scene').map((entry) => entry.entityRef?.id));
  const unusedPrepared = current.scenes.filter((scene) => scene.status === 'ready' && !used.has(scene.id)).map((scene) => scene.id);
  const checkpointResult = createCheckpoint(current, `End of ${current.sessions.find((session) => session.id === sessionId)?.title ?? 'session'}`, now);
  current = checkpointResult.state;
  const session = current.sessions.find((candidate) => candidate.id === sessionId);
  return bump(current, actor, 'sessions', 'end-session', `Ended ${session?.title ?? 'session'}.`, { type: 'session', id: sessionId }, now, false, {
    sessions: current.sessions.map((candidate) => candidate.id === sessionId ? {
      ...candidate, status: 'completed', endedAt: now, recap, unusedPreparedSceneIds: unusedPrepared,
      checkpointIds: [...candidate.checkpointIds, checkpointResult.checkpointId], updatedAt: now,
    } : candidate),
    runState: { ...current.runState, activeSessionId: null },
  });
}

export function startEncounter(state: CampaignState, name: string, participantRefs: readonly string[] = [], actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  if (state.runState.activeEncounterId !== null) return state;
  const now = nowIso(timestamp);
  const encounter: CampaignEncounter = { id: id('encounter'), name: name.trim() || 'Encounter', trigger: '', participantRefs: uniqueStrings(participantRefs), notes: '', assetIds: [], startedAt: now, endedAt: null };
  return bump(state, actor, 'scene-director', 'start-encounter', `Started encounter “${encounter.name}”.`, null, now, true, {
    encounters: [...state.encounters, encounter], runState: { ...state.runState, activeEncounterId: encounter.id },
  });
}

export function endEncounter(state: CampaignState, actor = 'GM', timestamp: string | Date | number = new Date()): CampaignState {
  const encounterId = state.runState.activeEncounterId;
  if (encounterId === null) return state;
  const now = nowIso(timestamp);
  return bump(state, actor, 'scene-director', 'end-encounter', 'Ended the active encounter.', null, now, true, {
    encounters: state.encounters.map((encounter) => encounter.id === encounterId ? { ...encounter, endedAt: now } : encounter),
    runState: { ...state.runState, activeEncounterId: null },
  });
}

export function triggerTimelineEvent(
  state: CampaignState,
  eventId: string,
  options: { readonly confirmed?: boolean; readonly actor?: string; readonly timestamp?: string | Date | number } = {},
): EventTriggerResult {
  const event = state.timelineEvents.find((candidate) => candidate.id === eventId);
  if (event === undefined) return { state, appliedActionIds: [], requiresConfirmation: false, message: 'Event does not exist.' };
  if (!event.enabled) return { state, appliedActionIds: [], requiresConfirmation: false, message: 'Event is disabled.' };
  if (event.status === 'triggered' || event.status === 'completed') return { state, appliedActionIds: [], requiresConfirmation: false, message: 'Event has already been applied.' };
  const requiresConfirmation = event.confirmationRequired && !event.autoSafe && options.confirmed !== true;
  if (requiresConfirmation) return { state, appliedActionIds: [], requiresConfirmation: true, message: 'This event requires GM confirmation.' };

  const now = nowIso(options.timestamp ?? new Date());
  const actor = options.actor ?? 'GM';
  let current = state;
  const applied: string[] = [];
  for (const action of event.actions) {
    if (applied.includes(action.id)) continue;
    switch (action.kind) {
      case 'activate-scene': current = activateScene(current, action.sceneId, actor, now); break;
      case 'queue-reveal': current = revealCampaignEntity(current, action.entityType, action.entityId, action.audience, actor, now, event.id); break;
      case 'set-weather': current = setCampaignWeather(current, action.weather, actor, now); break;
      case 'add-note': current = addCampaignNote(current, event.name, action.text, 'live', actor, now, [{ type: 'event', id: event.id }]); break;
      case 'mark-objective': current = { ...current, objectives: current.objectives.map((objective) => objective.id === action.objectiveId ? { ...objective, status: action.status, updatedAt: now } : objective) }; break;
      case 'send-message': current = sendCampaignMessage(current, action.threadId, action.messageId, actor, now); break;
      case 'advance-time': current = advanceCampaignTime(current, action.minutes, actor, now).state; break;
    }
    applied.push(action.id);
  }
  current = bump(current, actor, 'timeline', 'trigger-event', `Triggered event “${event.name}”.`, { type: 'event', id: event.id }, now, true, {
    timelineEvents: current.timelineEvents.map((candidate) => candidate.id === event.id ? {
      ...candidate, status: 'completed', lastTriggeredAt: now, triggerCount: candidate.triggerCount + 1, updatedAt: now,
    } : candidate),
  });
  return { state: current, appliedActionIds: applied, requiresConfirmation: false, message: `Applied ${applied.length} action${applied.length === 1 ? '' : 's'}.` };
}

export function campaignBacklinks(state: CampaignState, target: CampaignEntityRef): readonly CampaignEntityRef[] {
  const results: CampaignEntityRef[] = [];
  const push = (type: CampaignEntityType, idValue: string): void => {
    if (!results.some((entry) => entry.type === type && entry.id === idValue)) results.push({ type, id: idValue });
  };
  for (const scene of state.scenes) {
    if ((target.type === 'clue' && scene.clueIds.includes(target.id))
      || (target.type === 'handout' && scene.handoutIds.includes(target.id))
      || (target.type === 'message-thread' && scene.messageThreadIds.includes(target.id))
      || (target.type === 'asset' && scene.assetIds.includes(target.id))
      || (target.type === 'note' && scene.noteIds.includes(target.id))
      || (target.type === 'location' && scene.locationRef === target.id)
      || (target.type === 'scene' && scene.exits.some((exit) => exit.targetSceneId === target.id))) push('scene', scene.id);
  }
  for (const clue of state.clues) if (clue.linkedEntities.some((ref) => ref.type === target.type && ref.id === target.id)) push('clue', clue.id);
  if (target.type === 'asset') {
    for (const handout of state.handouts) if (handout.assetId === target.id) push('handout', handout.id);
    for (const thread of state.messageThreads) if (thread.messages.some((message) => message.style.soundAssetId === target.id)) push('message-thread', thread.id);
  }
  for (const event of state.timelineEvents) {
    if (event.targetSceneId === target.id && target.type === 'scene') push('event', event.id);
    if (event.actions.some((action) => ('sceneId' in action && target.type === 'scene' && action.sceneId === target.id)
      || ('entityId' in action && action.entityType === target.type && action.entityId === target.id)
      || ('objectiveId' in action && target.type === 'objective' && action.objectiveId === target.id)
      || ('threadId' in action && target.type === 'message-thread' && action.threadId === target.id))) push('event', event.id);
  }
  for (const note of state.notes) if (note.linkedEntities.some((ref) => ref.type === target.type && ref.id === target.id)) push('note', note.id);
  return results;
}

function searchScore(query: string, title: string, body: string): number {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return 0;
  const titleText = title.toLocaleLowerCase();
  const bodyText = body.toLocaleLowerCase();
  if (titleText === needle) return 100;
  if (titleText.startsWith(needle)) return 80;
  if (titleText.includes(needle)) return 60;
  if (bodyText.includes(needle)) return 30;
  return 0;
}

export function searchCampaign(state: CampaignState, query: string): readonly CampaignSearchResult[] {
  const results: CampaignSearchResult[] = [];
  const add = (type: CampaignEntityType, idValue: string, title: string, subtitle: string, body: string): void => {
    const score = searchScore(query, title, body);
    if (score > 0) results.push({ type, id: idValue, title, subtitle, score });
  };
  for (const scene of state.scenes) add('scene', scene.id, scene.name, `${scene.status} scene`, [scene.gmDescription, scene.playerDescription, scene.tags.join(' '), scene.freeformLocation].join(' '));
  for (const event of state.timelineEvents) add('event', event.id, event.name, `${event.status} event`, `${event.description} ${event.tags.join(' ')}`);
  for (const clue of state.clues) add('clue', clue.id, clue.gmTitle, `${clue.discoveryState} clue`, `${clue.playerTitle} ${clue.description} ${clue.source}`);
  for (const handout of state.handouts) add('handout', handout.id, handout.title, 'handout', `${handout.caption} ${handout.alternateText}`);
  for (const objective of state.objectives) add('objective', objective.id, objective.gmIntent, `${objective.status} objective`, `${objective.playerWording} ${objective.completionNote}`);
  for (const thread of state.messageThreads) add('message-thread', thread.id, thread.name, thread.medium, `${thread.tags.join(' ')} ${thread.messages.map((message) => `${message.senderLabel} ${message.body}`).join(' ')}`);
  for (const note of state.notes) add('note', note.id, note.title, `${note.kind} note`, note.body);
  for (const session of state.sessions) add('session', session.id, session.title, `${session.status} session`, `${session.recap} ${session.unresolvedThreads.join(' ')}`);
  for (const asset of state.assets) add('asset', asset.id, asset.name, `${asset.type} asset`, `${asset.caption} ${asset.alternateText} ${asset.tags.join(' ')}`);
  return results.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}

export function validateCampaignReferences(state: CampaignState, context: CampaignReferenceContext): readonly CampaignReferenceIssue[] {
  const issues: CampaignReferenceIssue[] = [];
  const issue = (owner: CampaignReferenceIssue['owner'], field: string, missingRef: string, message: string, severity: CampaignReferenceIssue['severity'] = 'warning'): void => {
    issues.push({ owner, field, missingRef, message, severity });
  };
  if (state.worldRef !== context.worldRef) issue({ type: 'campaign', id: state.id }, 'worldRef', state.worldRef, `Campaign references ${state.worldRef}, but the current world is ${context.worldRef}.`, 'error');
  const sceneIds = new Set(state.scenes.map((item) => item.id));
  const clueIds = new Set(state.clues.map((item) => item.id));
  const handoutIds = new Set(state.handouts.map((item) => item.id));
  const objectiveIds = new Set(state.objectives.map((item) => item.id));
  const threadIds = new Set(state.messageThreads.map((item) => item.id));
  const noteIds = new Set(state.notes.map((item) => item.id));
  const sessionIds = new Set(state.sessions.map((item) => item.id));
  const assetIds = new Set([...state.assets.map((item) => item.id), ...(context.externalAssetIds ?? new Set<string>())]);
  const hasEntity = (type: CampaignEntityType, ref: string): boolean => {
    if (type === 'scene') return sceneIds.has(ref);
    if (type === 'clue') return clueIds.has(ref);
    if (type === 'handout') return handoutIds.has(ref);
    if (type === 'objective') return objectiveIds.has(ref);
    if (type === 'message-thread') return threadIds.has(ref);
    if (type === 'note') return noteIds.has(ref);
    if (type === 'session') return sessionIds.has(ref);
    if (type === 'asset') return assetIds.has(ref);
    if (type === 'npc') return context.npcIds.has(ref);
    if (type === 'location') return context.locationIds.has(ref);
    if (type === 'character') return context.characterIds?.has(ref) ?? true;
    return true;
  };
  for (const scene of state.scenes) {
    const owner: CampaignEntityRef = { type: 'scene', id: scene.id };
    if (scene.locationRef !== null && !context.locationIds.has(scene.locationRef)) issue(owner, 'locationRef', scene.locationRef, 'Scene location is missing.');
    for (const participant of scene.participants) {
      if (participant.type === 'npc' && !context.npcIds.has(participant.id)) issue(owner, 'participants', participant.id, 'Scene NPC is missing.');
      if (participant.type === 'character' && context.characterIds !== undefined && !context.characterIds.has(participant.id)) issue(owner, 'participants', participant.id, 'Scene character is missing.');
    }
    for (const ref of scene.clueIds) if (!clueIds.has(ref)) issue(owner, 'clueIds', ref, 'Scene clue is missing.');
    for (const ref of scene.handoutIds) if (!handoutIds.has(ref)) issue(owner, 'handoutIds', ref, 'Scene handout is missing.');
    for (const ref of scene.messageThreadIds) if (!threadIds.has(ref)) issue(owner, 'messageThreadIds', ref, 'Scene message thread is missing.');
    for (const ref of scene.assetIds) if (!assetIds.has(ref)) issue(owner, 'assetIds', ref, 'Scene asset is missing.');
    for (const ref of scene.noteIds) if (!noteIds.has(ref)) issue(owner, 'noteIds', ref, 'Scene note is missing.');
  }
  for (const handout of state.handouts) {
    if (handout.assetId !== null && !assetIds.has(handout.assetId)) issue({ type: 'handout', id: handout.id }, 'assetId', handout.assetId, 'Handout asset is missing.');
    for (const sceneId of handout.sceneIds) if (!sceneIds.has(sceneId)) issue({ type: 'handout', id: handout.id }, 'sceneIds', sceneId, 'Handout scene is missing.');
  }
  for (const thread of state.messageThreads) {
    for (const sceneId of thread.sceneIds) if (!sceneIds.has(sceneId)) issue({ type: 'message-thread', id: thread.id }, 'sceneIds', sceneId, 'Message scene is missing.');
    for (const message of thread.messages) if (message.style.soundAssetId !== null && !assetIds.has(message.style.soundAssetId)) issue({ type: 'message-thread', id: thread.id }, 'messages.style.soundAssetId', message.style.soundAssetId, 'Message sound asset is missing.');
  }
  for (const encounter of state.encounters) for (const assetId of encounter.assetIds) if (!assetIds.has(assetId)) issue({ type: 'campaign', id: state.id }, 'encounters.assetIds', assetId, 'Encounter asset is missing.');
  for (const clue of state.clues) for (const ref of clue.linkedEntities) if (!hasEntity(ref.type, ref.id)) issue({ type: 'clue', id: clue.id }, 'linkedEntities', `${ref.type}:${ref.id}`, 'Linked entity is missing.');
  for (const event of state.timelineEvents) {
    const owner: CampaignEntityRef = { type: 'event', id: event.id };
    if (event.targetSceneId !== null && !sceneIds.has(event.targetSceneId)) issue(owner, 'targetSceneId', event.targetSceneId, 'Event target scene is missing.');
    if (event.trigger.kind === 'scene-activation' && !sceneIds.has(event.trigger.sceneId)) issue(owner, 'trigger.sceneId', event.trigger.sceneId, 'Event trigger scene is missing.');
    const trigger = event.trigger;
    if (trigger.kind === 'relative' && !state.timelineEvents.some((candidate) => candidate.id === trigger.eventId)) issue(owner, 'trigger.eventId', trigger.eventId, 'Relative parent event is missing.');
  }
  if (state.runState.activeSceneId !== null && !sceneIds.has(state.runState.activeSceneId)) issue({ type: 'campaign', id: state.id }, 'runState.activeSceneId', state.runState.activeSceneId, 'Active scene is missing.', 'error');
  if (state.runState.activeSessionId !== null && !sessionIds.has(state.runState.activeSessionId)) issue({ type: 'campaign', id: state.id }, 'runState.activeSessionId', state.runState.activeSessionId, 'Active session is missing.', 'error');
  return issues;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? uniqueStrings(value.filter((item): item is string => typeof item === 'string')) : [];
}

function validIso(value: unknown, fallback: string): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

export function normalizeCampaignState(value: unknown, fallbackWorldRef: string, timestamp: string | Date | number = new Date()): CampaignState {
  const fallback = createCampaign(fallbackWorldRef, 'Untitled Campaign', timestamp);
  if (typeof value !== 'object' || value === null) return fallback;
  const raw = value as Record<string, unknown>;
  const now = nowIso(timestamp);
  const campaign: CampaignState = {
    ...fallback,
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : fallback.id,
    worldRef: typeof raw.worldRef === 'string' && raw.worldRef.length > 0 ? raw.worldRef : fallbackWorldRef,
    name: typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : fallback.name,
    status: raw.status === 'active' || raw.status === 'archived' ? raw.status : 'draft',
    createdAt: validIso(raw.createdAt, fallback.createdAt), updatedAt: validIso(raw.updatedAt, now),
    scenes: Array.isArray(raw.scenes) ? raw.scenes.flatMap((item) => normalizeScene(item, now) ?? []) : [],
    timelineEvents: Array.isArray(raw.timelineEvents) ? raw.timelineEvents.flatMap((item) => normalizeTimelineEvent(item, now) ?? []) : [],
    clues: Array.isArray(raw.clues) ? raw.clues.flatMap((item) => normalizeClue(item, now) ?? []) : [],
    handouts: Array.isArray(raw.handouts) ? raw.handouts.flatMap((item) => normalizeHandout(item, now) ?? []) : [],
    objectives: Array.isArray(raw.objectives) ? raw.objectives.flatMap((item) => normalizeObjective(item, now) ?? []) : [],
    messageThreads: Array.isArray(raw.messageThreads) ? raw.messageThreads.flatMap((item) => normalizeThread(item, now) ?? []) : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions.flatMap((item) => normalizeSession(item, now) ?? []) : [],
    notes: Array.isArray(raw.notes) ? raw.notes.flatMap((item) => normalizeNote(item, now) ?? []) : [],
    assets: Array.isArray(raw.assets) ? raw.assets.flatMap((item) => normalizeAsset(item, now) ?? []) : [],
    reveals: Array.isArray(raw.reveals) ? raw.reveals.flatMap((item) => normalizeReveal(item, now) ?? []) : [],
    encounters: Array.isArray(raw.encounters) ? raw.encounters.flatMap((item) => normalizeEncounter(item, now) ?? []) : [],
    activityLog: Array.isArray(raw.activityLog) ? raw.activityLog.flatMap((item) => normalizeActivity(item, now) ?? []).slice(0, 1000) : [],
    checkpoints: Array.isArray(raw.checkpoints) ? raw.checkpoints.flatMap((item) => normalizeCheckpoint(item, now) ?? []) : [],
    runState: normalizeRunState(raw.runState, now),
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
  };
  return campaign;
}

function record(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null; }
function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
function bool(value: unknown, fallback = false): boolean { return typeof value === 'boolean' ? value : fallback; }
function num(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }

function normalizeParticipant(value: unknown): CampaignParticipantRef | undefined {
  const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined;
  const type: CampaignParticipantType = raw.type === 'character' || raw.type === 'group' ? raw.type : 'npc';
  return { id: raw.id, type, label: text(raw.label, raw.id), hidden: bool(raw.hidden) };
}

function normalizeScene(value: unknown, now: string): CampaignScene | undefined {
  const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined;
  const statuses: readonly SceneStatus[] = ['draft', 'ready', 'active', 'paused', 'completed', 'archived'];
  const status = statuses.includes(raw.status as SceneStatus) ? raw.status as SceneStatus : 'draft';
  const presentationRaw = record(raw.presentation);
  return {
    id: raw.id, name: text(raw.name, 'Untitled Scene'), type: text(raw.type, 'location'), status, tags: stringArray(raw.tags), arc: text(raw.arc), sessionTarget: text(raw.sessionTarget),
    locationRef: typeof raw.locationRef === 'string' ? raw.locationRef : null, freeformLocation: text(raw.freeformLocation), gmDescription: text(raw.gmDescription),
    playerDescription: text(raw.playerDescription), sensoryDetails: text(raw.sensoryDetails), readAloud: text(raw.readAloud),
    participants: Array.isArray(raw.participants) ? raw.participants.flatMap((item) => normalizeParticipant(item) ?? []) : [], clueIds: stringArray(raw.clueIds),
    handoutIds: stringArray(raw.handoutIds), messageThreadIds: stringArray(raw.messageThreadIds), assetIds: stringArray(raw.assetIds), noteIds: stringArray(raw.noteIds),
    exits: Array.isArray(raw.exits) ? raw.exits.flatMap((item) => { const exit = record(item); return exit === null ? [] : [{ label: text(exit.label), targetSceneId: typeof exit.targetSceneId === 'string' ? exit.targetSceneId : null }]; }) : [],
    presentation: {
      ambientAssetId: typeof presentationRaw?.ambientAssetId === 'string' ? presentationRaw.ambientAssetId : null,
      revealAssetId: typeof presentationRaw?.revealAssetId === 'string' ? presentationRaw.revealAssetId : null,
      mapFocusRef: typeof presentationRaw?.mapFocusRef === 'string' ? presentationRaw.mapFocusRef : null,
      defaultWeather: typeof presentationRaw?.defaultWeather === 'string' ? presentationRaw.defaultWeather as CampaignWeather : null,
      defaultTime: typeof presentationRaw?.defaultTime === 'string' ? presentationRaw.defaultTime : null,
    }, createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now),
  };
}

function normalizeTrigger(value: unknown): CampaignEventTrigger {
  const raw = record(value); if (raw === null) return { kind: 'manual' };
  if (raw.kind === 'time') return { kind: 'time', at: validIso(raw.at, new Date().toISOString()) };
  if (raw.kind === 'scene-activation' && typeof raw.sceneId === 'string') return { kind: 'scene-activation', sceneId: raw.sceneId };
  if (raw.kind === 'relative' && typeof raw.eventId === 'string') return { kind: 'relative', eventId: raw.eventId, offsetMinutes: num(raw.offsetMinutes) };
  if (raw.kind === 'window') return { kind: 'window', startsAt: validIso(raw.startsAt, new Date().toISOString()), endsAt: validIso(raw.endsAt, new Date().toISOString()) };
  if (raw.kind === 'condition') return { kind: 'condition', key: text(raw.key), expectedValue: text(raw.expectedValue) };
  if (raw.kind === 'recurring') return { kind: 'recurring', everyMinutes: Math.max(1, num(raw.everyMinutes, 60)), startsAt: validIso(raw.startsAt, new Date().toISOString()), until: typeof raw.until === 'string' ? validIso(raw.until, new Date().toISOString()) : null };
  return { kind: 'manual' };
}

function normalizeAction(value: unknown): CampaignEventAction | undefined {
  const raw = record(value); if (raw === null || typeof raw.id !== 'string' || typeof raw.kind !== 'string') return undefined;
  if (raw.kind === 'activate-scene' && typeof raw.sceneId === 'string') return { id: raw.id, kind: 'activate-scene', sceneId: raw.sceneId };
  if (raw.kind === 'queue-reveal' && typeof raw.entityId === 'string' && typeof raw.entityType === 'string') return { id: raw.id, kind: 'queue-reveal', entityType: raw.entityType as CampaignEntityType, entityId: raw.entityId, audience: text(raw.audience, 'party') as CampaignAudience };
  if (raw.kind === 'set-weather' && typeof raw.weather === 'string') return { id: raw.id, kind: 'set-weather', weather: raw.weather as CampaignWeather };
  if (raw.kind === 'add-note') return { id: raw.id, kind: 'add-note', text: text(raw.text) };
  if (raw.kind === 'mark-objective' && typeof raw.objectiveId === 'string') return { id: raw.id, kind: 'mark-objective', objectiveId: raw.objectiveId, status: text(raw.status, 'active') as ObjectiveStatus };
  if (raw.kind === 'send-message' && typeof raw.threadId === 'string' && typeof raw.messageId === 'string') return { id: raw.id, kind: 'send-message', threadId: raw.threadId, messageId: raw.messageId };
  if (raw.kind === 'advance-time') return { id: raw.id, kind: 'advance-time', minutes: num(raw.minutes) };
  return undefined;
}

function normalizeTimelineEvent(value: unknown, now: string): CampaignTimelineEvent | undefined {
  const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined;
  const statuses: readonly TimelineEventStatus[] = ['scheduled', 'eligible', 'triggered', 'skipped', 'delayed', 'completed', 'reverted', 'failed'];
  return {
    id: raw.id, name: text(raw.name, 'Untitled Event'), description: text(raw.description), trigger: normalizeTrigger(raw.trigger),
    actions: Array.isArray(raw.actions) ? raw.actions.flatMap((item) => normalizeAction(item) ?? []) : [], status: statuses.includes(raw.status as TimelineEventStatus) ? raw.status as TimelineEventStatus : 'scheduled',
    enabled: raw.enabled !== false, confirmationRequired: raw.confirmationRequired !== false, autoSafe: bool(raw.autoSafe),
    targetSceneId: typeof raw.targetSceneId === 'string' ? raw.targetSceneId : null, tags: stringArray(raw.tags),
    lastTriggeredAt: typeof raw.lastTriggeredAt === 'string' ? validIso(raw.lastTriggeredAt, now) : null, triggerCount: Math.max(0, Math.round(num(raw.triggerCount))),
    createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now),
  };
}

function normalizeEntityRef(value: unknown): CampaignEntityRef | undefined { const raw = record(value); return raw !== null && typeof raw.type === 'string' && typeof raw.id === 'string' ? { type: raw.type as CampaignEntityType, id: raw.id } : undefined; }
function normalizeClue(value: unknown, now: string): CampaignClue | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, gmTitle: text(raw.gmTitle, 'Untitled Clue'), playerTitle: text(raw.playerTitle), description: text(raw.description), source: text(raw.source), linkedEntities: Array.isArray(raw.linkedEntities) ? raw.linkedEntities.flatMap((item) => normalizeEntityRef(item) ?? []) : [], discoveryState: raw.discoveryState === 'available' || raw.discoveryState === 'revealed' ? raw.discoveryState : 'hidden', createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now) }; }
function normalizeHandout(value: unknown, now: string): CampaignHandout | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, title: text(raw.title, 'Untitled Handout'), assetId: typeof raw.assetId === 'string' ? raw.assetId : null, caption: text(raw.caption), alternateText: text(raw.alternateText), sceneIds: stringArray(raw.sceneIds), presentationOrder: num(raw.presentationOrder), createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now) }; }
function normalizeObjective(value: unknown, now: string): CampaignObjective | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, gmIntent: text(raw.gmIntent, 'Untitled Objective'), playerWording: text(raw.playerWording), status: text(raw.status, 'hidden') as ObjectiveStatus, dependencyIds: stringArray(raw.dependencyIds), completionNote: text(raw.completionNote), createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now) }; }
function normalizeMessage(value: unknown, now: string): CampaignMessage | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; const style = record(raw.style); return { id: raw.id, senderRef: text(raw.senderRef), senderLabel: text(raw.senderLabel, 'Unknown'), body: text(raw.body), status: text(raw.status, 'draft') as MessageStatus, scheduledAt: typeof raw.scheduledAt === 'string' ? validIso(raw.scheduledAt, now) : null, sentAt: typeof raw.sentAt === 'string' ? validIso(raw.sentAt, now) : null, linkedSceneId: typeof raw.linkedSceneId === 'string' ? raw.linkedSceneId : null, audience: text(raw.audience, 'party') as CampaignAudience, style: { typingDelayMs: num(style?.typingDelayMs), glitch: bool(style?.glitch), corruption: Math.max(0, Math.min(1, num(style?.corruption))), soundAssetId: typeof style?.soundAssetId === 'string' ? style.soundAssetId : null }, createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now) }; }
function normalizeThread(value: unknown, now: string): CampaignMessageThread | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, name: text(raw.name, 'Untitled Thread'), medium: text(raw.medium, 'Messenger'), participantRefs: stringArray(raw.participantRefs), sceneIds: stringArray(raw.sceneIds), tags: stringArray(raw.tags), messages: Array.isArray(raw.messages) ? raw.messages.flatMap((item) => normalizeMessage(item, now) ?? []) : [], createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now) }; }
function normalizeNote(value: unknown, now: string): CampaignNote | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, title: text(raw.title, 'Untitled Note'), body: text(raw.body), kind: text(raw.kind, 'gm') as CampaignNote['kind'], linkedEntities: Array.isArray(raw.linkedEntities) ? raw.linkedEntities.flatMap((item) => normalizeEntityRef(item) ?? []) : [], sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null, completed: bool(raw.completed), createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now) }; }
function normalizeAsset(value: unknown, now: string): CampaignAsset | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, name: text(raw.name, 'Untitled Asset'), type: text(raw.type, 'external-link') as CampaignAssetType, uri: text(raw.uri), mimeType: text(raw.mimeType), fileSize: typeof raw.fileSize === 'number' ? raw.fileSize : null, width: typeof raw.width === 'number' ? raw.width : null, height: typeof raw.height === 'number' ? raw.height : null, durationSeconds: typeof raw.durationSeconds === 'number' ? raw.durationSeconds : null, alternateText: text(raw.alternateText), caption: text(raw.caption), tags: stringArray(raw.tags), rightsNote: text(raw.rightsNote), checksum: typeof raw.checksum === 'string' ? raw.checksum : null, createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now) }; }
function normalizeReveal(value: unknown, now: string): CampaignRevealRecord | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string' || typeof raw.entityId !== 'string') return undefined; return { id: raw.id, entityType: text(raw.entityType, 'clue') as CampaignEntityType, entityId: raw.entityId, audience: text(raw.audience, 'party') as CampaignAudience, timestamp: validIso(raw.timestamp, now), sourceSceneId: typeof raw.sourceSceneId === 'string' ? raw.sourceSceneId : null, sourceSessionId: typeof raw.sourceSessionId === 'string' ? raw.sourceSessionId : null, sourceEventId: typeof raw.sourceEventId === 'string' ? raw.sourceEventId : null, reversible: raw.reversible !== false, revokedAt: typeof raw.revokedAt === 'string' ? validIso(raw.revokedAt, now) : null, note: text(raw.note) }; }
function normalizeEncounter(value: unknown, now: string): CampaignEncounter | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, name: text(raw.name, 'Encounter'), trigger: text(raw.trigger), participantRefs: stringArray(raw.participantRefs), notes: text(raw.notes), assetIds: stringArray(raw.assetIds), startedAt: validIso(raw.startedAt, now), endedAt: typeof raw.endedAt === 'string' ? validIso(raw.endedAt, now) : null }; }
function normalizeActivity(value: unknown, now: string): CampaignActivityRecord | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, timestamp: validIso(raw.timestamp, now), actor: text(raw.actor, 'GM'), sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null, source: text(raw.source), action: text(raw.action), entityRef: normalizeEntityRef(raw.entityRef) ?? null, summary: text(raw.summary), revision: Math.max(0, Math.round(num(raw.revision))), reversible: raw.reversible !== false }; }
function normalizeRunState(value: unknown, now: string): CampaignRunState { const raw = record(value); return { activeSessionId: typeof raw?.activeSessionId === 'string' ? raw.activeSessionId : null, activeSceneId: typeof raw?.activeSceneId === 'string' ? raw.activeSceneId : null, campaignTime: validIso(raw?.campaignTime, now), timezone: text(raw?.timezone, 'Asia/Manila') || 'Asia/Manila', weatherOverride: typeof raw?.weatherOverride === 'string' ? raw.weatherOverride as CampaignWeather : null, activeEncounterId: typeof raw?.activeEncounterId === 'string' ? raw.activeEncounterId : null, revision: Math.max(0, Math.round(num(raw?.revision))) }; }
function normalizeSession(value: unknown, now: string): CampaignSession | undefined { const raw = record(value); if (raw === null || typeof raw.id !== 'string') return undefined; return { id: raw.id, number: Math.max(1, Math.round(num(raw.number, 1))), title: text(raw.title, 'Session'), plannedAt: typeof raw.plannedAt === 'string' ? validIso(raw.plannedAt, now) : null, startedAt: typeof raw.startedAt === 'string' ? validIso(raw.startedAt, now) : null, endedAt: typeof raw.endedAt === 'string' ? validIso(raw.endedAt, now) : null, status: text(raw.status, 'planned') as SessionStatus, attendeeRefs: stringArray(raw.attendeeRefs), sceneIds: stringArray(raw.sceneIds), openingSceneId: typeof raw.openingSceneId === 'string' ? raw.openingSceneId : null, openingTime: typeof raw.openingTime === 'string' ? validIso(raw.openingTime, now) : null, liveLogIds: stringArray(raw.liveLogIds), noteIds: stringArray(raw.noteIds), recap: text(raw.recap), unresolvedThreads: stringArray(raw.unresolvedThreads), nextSessionChecklistIds: stringArray(raw.nextSessionChecklistIds), checkpointIds: stringArray(raw.checkpointIds), unusedPreparedSceneIds: stringArray(raw.unusedPreparedSceneIds), createdAt: validIso(raw.createdAt, now), updatedAt: validIso(raw.updatedAt, now) }; }
function normalizeCheckpoint(value: unknown, now: string): CampaignCheckpoint | undefined { const raw = record(value); const snapshot = record(raw?.snapshot); if (raw === null || typeof raw.id !== 'string' || snapshot === null) return undefined; const rawSceneStatuses = record(snapshot.sceneStatuses) ?? {}; const rawEventStatuses = record(snapshot.eventStatuses) ?? {}; const rawObjectiveStatuses = record(snapshot.objectiveStatuses) ?? {}; return { id: raw.id, label: text(raw.label, 'Checkpoint'), timestamp: validIso(raw.timestamp, now), sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null, revision: Math.max(0, Math.round(num(raw.revision))), snapshot: { runState: normalizeRunState(snapshot.runState, now), sceneStatuses: Object.fromEntries(Object.entries(rawSceneStatuses).filter(([, status]) => typeof status === 'string')) as Readonly<Record<string, SceneStatus>>, eventStatuses: Object.fromEntries(Object.entries(rawEventStatuses).filter(([, status]) => typeof status === 'string')) as Readonly<Record<string, TimelineEventStatus>>, objectiveStatuses: Object.fromEntries(Object.entries(rawObjectiveStatuses).filter(([, status]) => typeof status === 'string')) as Readonly<Record<string, ObjectiveStatus>>, reveals: Array.isArray(snapshot.reveals) ? snapshot.reveals.flatMap((item) => normalizeReveal(item, now) ?? []) : [] } }; }

export function campaignExportManifest(state: CampaignState, timestamp: string | Date | number = new Date()): CampaignExportManifest {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION, campaignId: state.id, worldRef: state.worldRef, exportedAt: nowIso(timestamp),
    entityCounts: {
      scenes: state.scenes.length, events: state.timelineEvents.length, clues: state.clues.length, handouts: state.handouts.length,
      objectives: state.objectives.length, messageThreads: state.messageThreads.length, sessions: state.sessions.length,
      notes: state.notes.length, assets: state.assets.length, reveals: state.reveals.length, encounters: state.encounters.length,
    },
    assetRefs: state.assets.map((asset) => ({ id: asset.id, uri: asset.uri, checksum: asset.checksum })),
  };
}

export function createCampaignExport(state: CampaignState, timestamp: string | Date | number = new Date()): Record<string, unknown> {
  return { format: 'payaw-campaign', schemaVersion: CAMPAIGN_SCHEMA_VERSION, manifest: campaignExportManifest(state, timestamp), campaign: state };
}
