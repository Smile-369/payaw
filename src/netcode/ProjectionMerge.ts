import { deepFreeze, parsePlayerProjection, type PlayerProjection } from '../player/PlayerProjection';

function mergeById<T extends { readonly id: string }>(baseline: readonly T[], retained: readonly T[]): T[] {
  const values = new Map(baseline.map((item) => [item.id, item]));
  for (const item of retained) values.set(item.id, item);
  return [...values.values()];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Apply the small recipient-safe delta carried by a collaboration event.
 * Slot updates remain authoritative; this path makes pings and messages appear
 * immediately and also covers clients that miss a large projection update.
 */
export function mergeSharedProjectionEvent(
  currentValue: PlayerProjection,
  eventType: string,
  payloadValue: Readonly<Record<string, unknown>>,
): PlayerProjection {
  const current = parsePlayerProjection(currentValue);
  const payload = record(payloadValue);
  if (payload === null) return currentValue;

  if (eventType === 'command.map.ping') {
    const ping = record(payload.ping);
    if (ping === null || typeof ping.id !== 'string') return currentValue;
    if (current.map.features.some((feature) => feature.id === ping.id)) return currentValue;
    return parsePlayerProjection({
      ...current,
      map: { ...current.map, features: [...current.map.features, ping] },
      generatedAt: new Date().toISOString(),
    });
  }

  if (eventType === 'command.message.send') {
    const threadId = typeof payload.threadId === 'string' ? payload.threadId : '';
    const message = record(payload.message);
    if (threadId.length === 0 || message === null || typeof message.id !== 'string') return currentValue;
    const thread = current.messages.find((candidate) => candidate.id === threadId);
    if (thread === undefined || thread.messages.some((candidate) => candidate.id === message.id)) return currentValue;
    return parsePlayerProjection({
      ...current,
      messages: current.messages.map((candidate) => candidate.id === threadId
        ? { ...candidate, messages: [...candidate.messages, message] }
        : candidate),
      generatedAt: new Date().toISOString(),
    });
  }

  return currentValue;
}

/**
 * Preserve player-authored records when the GM republishes a projection.
 * GM-authored and revealed data always comes from `generated`; only explicitly
 * player-owned records are retained from the hosted projection.
 */
export function mergePlayerOwnedProjection(generatedValue: PlayerProjection, hostedValue: PlayerProjection | null): PlayerProjection {
  const generated = parsePlayerProjection(generatedValue);
  if (hostedValue === null) return generated;
  const hosted = parsePlayerProjection(hostedValue);
  if (generated.campaign.id !== hosted.campaign.id || generated.viewer.id !== hosted.viewer.id) return generated;
  const now = Date.now();
  const retainedPings = hosted.map.features.filter((feature) => feature.kind === 'ping' && (feature.expiresAt === null || Date.parse(feature.expiresAt) > now));
  const generatedThreads = new Map(generated.messages.map((thread) => [thread.id, thread]));
  const messages = generated.messages.map((thread) => {
    const hostedThread = hosted.messages.find((candidate) => candidate.id === thread.id);
    if (hostedThread === undefined) return thread;
    const playerMessages = hostedThread.messages.filter((message) =>
      message.senderLabel === hosted.viewer.characterName && !thread.messages.some((candidate) => candidate.id === message.id),
    );
    return { ...thread, messages: [...thread.messages, ...playerMessages] };
  });
  for (const thread of hosted.messages) {
    if (!generatedThreads.has(thread.id)) continue;
  }
  const editable = new Set(generated.character?.editableFields ?? []);
  const hostedCharacter = hosted.character;
  const character = generated.character === undefined || hostedCharacter === undefined || generated.character.id !== hostedCharacter.id
    ? generated.character
    : {
        ...generated.character,
        ...(editable.has('name') ? { name: hostedCharacter.name } : {}),
        ...(editable.has('pronouns') ? { pronouns: hostedCharacter.pronouns } : {}),
        ...(editable.has('background') ? { background: hostedCharacter.background } : {}),
        ...(editable.has('portraitUri') ? { portraitUri: hostedCharacter.portraitUri } : {}),
        ...(editable.has('galleryUris') ? { galleryUris: hostedCharacter.galleryUris } : {}),
        ...(editable.has('stats') ? { stats: hostedCharacter.stats } : {}),
        ...(editable.has('conditions') ? { conditions: hostedCharacter.conditions } : {}),
        ...(editable.has('inventory') ? { inventory: hostedCharacter.inventory } : {}),
        ...(editable.has('privateNotes') ? { privateNotes: hostedCharacter.privateNotes } : {}),
      };
  const generatedCharacterOwners = new Set(generated.partyCharacters.map((profile) => profile.ownerId));
  const partyCharacterValues = new Map(generated.partyCharacters.map((profile) => [profile.ownerId, profile]));
  for (const profile of hosted.partyCharacters) {
    if (generatedCharacterOwners.has(profile.ownerId)) partyCharacterValues.set(profile.ownerId, profile);
  }
  const partyCharacters = [...partyCharacterValues.values()];
  const merged: PlayerProjection = {
    ...generated,
    ...(character === undefined ? {} : { character }),
    partyCharacters,
    journal: {
      personal: mergeById(generated.journal.personal, hosted.journal.personal),
      shared: mergeById(generated.journal.shared, hosted.journal.shared.filter((entry) => entry.sharedWithParty)),
    },
    messages,
    // Shared dice is event-backed. Do not copy legacy roll history into every
    // recipient slot; PlayerNetworkSession hydrates and preserves it locally.
    diceRolls: generated.diceRolls,
    objectives: mergeById(generated.objectives, hosted.objectives.filter((objective) => objective.playerCreated)),
    map: { ...generated.map, features: mergeById(generated.map.features, retainedPings) },
    generatedAt: new Date().toISOString(),
    revision: Math.max(generated.revision, hosted.revision),
  };
  return deepFreeze(merged);
}
