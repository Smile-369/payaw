export interface PresentableDiceRoll {
  readonly rollerUsername: string;
  readonly notation: string;
  readonly values: readonly number[];
  readonly total: number;
  readonly rolledAt: string;
}

export function formatDiceResults(roll: PresentableDiceRoll): string {
  return `[${roll.values.join(', ')}]`;
}

export function formatDiceSummary(roll: PresentableDiceRoll, includeTime = false): string {
  const time = includeTime ? ` · ${new Date(roll.rolledAt).toLocaleTimeString()}` : '';
  return `${roll.rollerUsername} · ${roll.notation} · Total ${roll.total}${time}`;
}
