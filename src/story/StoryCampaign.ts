export enum StoryBeatType {
  Hook = 'hook',
  Clue = 'clue',
  Encounter = 'encounter',
  Choice = 'choice',
  Consequence = 'consequence',
  Boss = 'boss',
  Ending = 'ending',
}

export enum StoryTimeWindow {
  Any = 'any',
  Day = 'day',
  AfterDark = 'after-dark',
  ThreeAm = 'three-am',
}

export interface StoryBeat {
  readonly id: string;
  readonly title: string;
  readonly type: StoryBeatType;
  readonly locationId: string;
  readonly prerequisiteIds: readonly string[];
  readonly session: number;
  readonly timeWindow: StoryTimeWindow;
  readonly minimumMalas: number;
  readonly hiddenFromPlayers: boolean;
  readonly summary: string;
  readonly dmNotes: string;
}

export interface StoryCampaign {
  readonly version: 1;
  readonly beats: readonly StoryBeat[];
}

export const EMPTY_STORY_CAMPAIGN: StoryCampaign = { version: 1, beats: [] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function enumValue<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback;
}

function finiteInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}

export function normalizeStoryCampaign(value: unknown): StoryCampaign {
  if (!isObject(value)) return EMPTY_STORY_CAMPAIGN;
  const source = Array.isArray(value.beats) ? value.beats : [];
  const beats: StoryBeat[] = [];
  const ids = new Set<string>();
  for (const raw of source.slice(0, 128)) {
    if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.locationId !== 'string') continue;
    const id = raw.id.trim();
    const title = raw.title.trim();
    const locationId = raw.locationId.trim();
    if (id.length === 0 || title.length === 0 || locationId.length === 0 || ids.has(id)) continue;
    ids.add(id);
    beats.push({
      id,
      title,
      type: enumValue(Object.values(StoryBeatType), raw.type, StoryBeatType.Encounter),
      locationId,
      prerequisiteIds: Array.isArray(raw.prerequisiteIds)
        ? raw.prerequisiteIds.filter((item): item is string => typeof item === 'string' && item !== id).slice(0, 16)
        : [],
      session: finiteInteger(raw.session, 1, 0, 99),
      timeWindow: enumValue(Object.values(StoryTimeWindow), raw.timeWindow, StoryTimeWindow.Any),
      minimumMalas: finiteInteger(raw.minimumMalas, 0, 0, 20),
      hiddenFromPlayers: raw.hiddenFromPlayers !== false,
      summary: typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 1200) : '',
      dmNotes: typeof raw.dmNotes === 'string' ? raw.dmNotes.trim().slice(0, 4000) : '',
    });
  }
  const validIds = new Set(beats.map((beat) => beat.id));
  return {
    version: 1,
    beats: beats.map((beat) => ({
      ...beat,
      prerequisiteIds: [...new Set(beat.prerequisiteIds.filter((id) => validIds.has(id) && id !== beat.id))],
    })),
  };
}

export function orderedStoryBeats(campaign: StoryCampaign): readonly StoryBeat[] {
  const remaining = new Map(campaign.beats.map((beat) => [beat.id, beat]));
  const emitted = new Set<string>();
  const ordered: StoryBeat[] = [];
  while (remaining.size > 0) {
    const available = [...remaining.values()]
      .filter((beat) => beat.prerequisiteIds.every((id) => emitted.has(id) || !remaining.has(id)))
      .sort((left, right) => left.session - right.session || left.title.localeCompare(right.title));
    const next = available[0] ?? [...remaining.values()].sort((left, right) => left.session - right.session || left.title.localeCompare(right.title))[0];
    if (next === undefined) break;
    ordered.push(next);
    emitted.add(next.id);
    remaining.delete(next.id);
  }
  return ordered;
}

export function storyBeatTypeLabel(type: StoryBeatType): string {
  switch (type) {
    case StoryBeatType.Hook: return 'Hook';
    case StoryBeatType.Clue: return 'Clue';
    case StoryBeatType.Encounter: return 'Encounter';
    case StoryBeatType.Choice: return 'Choice';
    case StoryBeatType.Consequence: return 'Consequence';
    case StoryBeatType.Boss: return 'Boss';
    case StoryBeatType.Ending: return 'Ending';
  }
}

export function storyTimeWindowLabel(window: StoryTimeWindow): string {
  switch (window) {
    case StoryTimeWindow.Any: return 'Any time';
    case StoryTimeWindow.Day: return 'Daytime';
    case StoryTimeWindow.AfterDark: return 'After dark';
    case StoryTimeWindow.ThreeAm: return '3:00 AM';
  }
}
