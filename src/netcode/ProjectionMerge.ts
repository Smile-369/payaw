import { deepFreeze, parsePlayerProjection, type PlayerProjection } from '../player/PlayerProjection';

function mergeById<T extends { readonly id: string }>(baseline: readonly T[], retained: readonly T[]): T[] {
  const values = new Map(baseline.map((item) => [item.id, item]));
  for (const item of retained) values.set(item.id, item);
  return [...values.values()];
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
        ...(editable.has('conditions') ? { conditions: hostedCharacter.conditions } : {}),
        ...(editable.has('inventory') ? { inventory: hostedCharacter.inventory } : {}),
        ...(editable.has('privateNotes') ? { privateNotes: hostedCharacter.privateNotes } : {}),
      };
  const merged: PlayerProjection = {
    ...generated,
    ...(character === undefined ? {} : { character }),
    journal: {
      personal: mergeById(generated.journal.personal, hosted.journal.personal),
      shared: mergeById(generated.journal.shared, hosted.journal.shared.filter((entry) => entry.sharedWithParty)),
    },
    messages,
    diceRolls: mergeById(generated.diceRolls, hosted.diceRolls).slice(0, 100),
    objectives: mergeById(generated.objectives, hosted.objectives.filter((objective) => objective.playerCreated)),
    map: { ...generated.map, features: mergeById(generated.map.features, retainedPings) },
    generatedAt: new Date().toISOString(),
    revision: Math.max(generated.revision, hosted.revision),
  };
  return deepFreeze(merged);
}

