export type PositionOverrideKind = 'anchor' | 'settlement' | 'story';

/**
 * Signals that a persisted manual position no longer fits the current generated
 * geography. The engine keeps this strict so interactive drag operations can
 * reject invalid drops, while the browser's full-generation flow can recover
 * by removing only the stale override and retrying.
 */
export class InvalidPositionOverrideError extends Error {
  public readonly kind: PositionOverrideKind;
  public readonly key: string;
  public readonly entityId: number | null;
  public readonly displayName: string;
  public readonly reason: string;

  public constructor(
    kind: PositionOverrideKind,
    key: string,
    displayName: string,
    reason: string,
    entityId: number | null = null,
  ) {
    super(`Manual position for ${kind} “${displayName}” ${reason}`);
    this.name = 'InvalidPositionOverrideError';
    this.kind = kind;
    this.key = key;
    this.entityId = entityId;
    this.displayName = displayName;
    this.reason = reason;
  }
}
