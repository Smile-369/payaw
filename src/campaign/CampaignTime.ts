function zonedDateParts(timestampMs: number, timezone: string): Readonly<Record<string, number>> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestampMs));
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

export function datetimeLocalValue(timestampMs: number, timezone: string): string {
  const parts = zonedDateParts(timestampMs, timezone);
  const pad = (value: number | undefined): string => String(value ?? 0).padStart(2, '0');
  return `${parts.year ?? 1970}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function timestampFromZonedLocal(value: string, timezone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return Number.NaN;
  const desired = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]), second: 0,
  };
  let guess = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedDateParts(guess, timezone);
    const actualUtc = Date.UTC(actual.year ?? 1970, (actual.month ?? 1) - 1, actual.day ?? 1, actual.hour ?? 0, actual.minute ?? 0, actual.second ?? 0);
    const desiredUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, 0);
    const correction = desiredUtc - actualUtc;
    guess += correction;
    if (Math.abs(correction) < 1000) break;
  }
  return guess;
}

export function minuteFromTimeInput(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minuteAsTime(value: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(value)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}
