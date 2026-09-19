import type { PlayerCommand } from '../player/PlayerCommands';

export const COMMAND_PAYLOAD_LIMIT_BYTES = 32_768;

export class CommandRequestError extends Error {
  public constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = 'CommandRequestError';
  }
}

/** Match jsonb::text separators, including bytes added around nested sheet JSON. */
export function commandPayloadBytes(command: PlayerCommand): number {
  const encode = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(encode).join(', ')}]`;
    if (typeof value === 'object' && value !== null) {
      return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${encode(item)}`).join(', ')}}`;
    }
    return JSON.stringify(value);
  };
  return new TextEncoder().encode(encode(JSON.parse(JSON.stringify(command)))).byteLength;
}

export function validateCommandPayload(command: PlayerCommand): void {
  if (commandPayloadBytes(command) > COMMAND_PAYLOAD_LIMIT_BYTES) {
    throw new CommandRequestError('This edit is too large to save (32 KB maximum). Shorten the sheet descriptions, inventory, or private notes and try again.', false);
  }
}

export function commandRequestError(message: string, status?: number): CommandRequestError {
  const transient = /STALE_REVISION|REVISION_CONFLICT|SNAPSHOT_CONFLICT|RATE_LIMITED/.test(message);
  return new CommandRequestError(message, transient || status === 401 || status === 408 || status === 429 || (status !== undefined && status >= 500));
}

export function isRetryableCommandError(error: unknown): boolean {
  if (error instanceof CommandRequestError) return error.retryable;
  // Unclassified failures are transport failures; authoritative rejections
  // are converted to CommandRequestError by the gateway.
  return true;
}
