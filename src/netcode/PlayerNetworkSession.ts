import { applyPlayerCommand, type PlayerCommand } from '../player/PlayerCommands';
import { parsePlayerProjection, type PlayerProjection } from '../player/PlayerProjection';
import { isOfflineSafeCommand, type ConnectionSnapshot, type PresenceRecord, type QueuedPlayerCommand } from './NetcodeTypes';
import { SupabaseGateway } from './SupabaseGateway';
import { parseSharedDiceRoll, type SharedDiceRoll } from './DiceRollBanner';

const QUEUE_LIMIT = 100;

function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16).padStart(12, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class PlayerNetworkSession {
  public readonly mode = 'network' as const;
  private projectionValue: PlayerProjection;
  private state: ConnectionSnapshot = { state: 'connecting', detail: 'Connecting to the campaign room…', lastOnlineAt: null, pendingCommands: 0 };
  private readonly projectionListeners = new Set<(projection: PlayerProjection) => void>();
  private readonly connectionListeners = new Set<(state: ConnectionSnapshot) => void>();
  private readonly diceRollListeners = new Set<(roll: SharedDiceRoll) => void>();
  private unsubscribeRealtime: (() => void) | null = null;
  private retryTimer: number | null = null;
  private diceHistoryPromise: Promise<void> | null = null;
  private queue: QueuedPlayerCommand[];
  private readonly queueKey: string;
  private readonly cacheKey: string;
  private readonly characterImageUrls = new Map<string, { readonly expiresAt: number; readonly value: Promise<string> }>();

  public constructor(
    private readonly campaignId: string,
    private readonly userId: string,
    initialProjection: PlayerProjection,
    private readonly gateway: SupabaseGateway,
    private readonly presence: PresenceRecord,
  ) {
    this.projectionValue = parsePlayerProjection(initialProjection);
    this.queueKey = `payaw:netcode:queue:${campaignId}:${userId}`;
    this.cacheKey = `payaw:netcode:projection:${campaignId}:${userId}`;
    this.queue = this.readQueue();
    this.writeCache(this.projectionValue);
    this.state = { ...this.state, pendingCommands: this.queue.length };
  }

  public projection(): PlayerProjection { return this.projectionValue; }
  public connection(): ConnectionSnapshot { return this.state; }

  public static cachedProjection(campaignId: string, userId: string): PlayerProjection | null {
    try {
      const raw = localStorage.getItem(`payaw:netcode:projection:${campaignId}:${userId}`);
      return raw === null ? null : parsePlayerProjection(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  public onProjection(listener: (projection: PlayerProjection) => void): () => void {
    this.projectionListeners.add(listener);
    return () => this.projectionListeners.delete(listener);
  }

  public onConnection(listener: (state: ConnectionSnapshot) => void): () => void {
    this.connectionListeners.add(listener);
    listener(this.state);
    return () => this.connectionListeners.delete(listener);
  }

  public onDiceRoll(listener: (roll: SharedDiceRoll) => void): () => void {
    this.diceRollListeners.add(listener);
    return () => this.diceRollListeners.delete(listener);
  }

  public async uploadCharacterImage(file: File): Promise<string> {
    if (this.state.state !== 'online' || !navigator.onLine) throw new Error('Character images require a live connection.');
    return this.gateway.uploadCharacterImage(this.campaignId, this.userId, file);
  }

  public resolveCharacterImage(uri: string): Promise<string> {
    const cached = this.characterImageUrls.get(uri);
    if (cached !== undefined && cached.expiresAt > Date.now()) return cached.value;
    if (cached !== undefined) this.characterImageUrls.delete(uri);
    const operation = this.gateway.resolveCharacterImage(uri).catch((error) => {
      this.characterImageUrls.delete(uri);
      throw error;
    });
    // Signed URLs last one hour. Refresh a little early so a long-running
    // session never keeps handing newly rendered profiles an expired URL.
    this.characterImageUrls.set(uri, { expiresAt: Date.now() + 50 * 60 * 1000, value: operation });
    return operation;
  }

  public async start(): Promise<void> {
    this.setConnection('connecting', 'Joining the private campaign channel…');
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    try {
      await this.connectRealtime();
      await this.hydrateDiceHistory();
    } catch {
      this.setConnection('offline', 'Offline cache opened. Live updates will resume when the connection returns.');
    }
  }

  public stop(): void {
    this.unsubscribeRealtime?.(); this.unsubscribeRealtime = null;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  public async submit(command: PlayerCommand): Promise<PlayerProjection> {
    const submittedCommand: PlayerCommand = command.kind === 'dice.roll'
      ? { ...command, visibility: 'party', rollerUsername: this.presence.displayName }
      : command;
    const offlineSafe = isOfflineSafeCommand(submittedCommand);
    const online = this.state.state === 'online' && navigator.onLine;
    if (!online && !offlineSafe) throw new Error('This action requires a live connection. PAYAW did not queue it.');
    const queued: QueuedPlayerCommand = {
      campaignId: this.campaignId, idempotencyKey: commandId(), command: submittedCommand,
      expectedRevision: this.projectionValue.revision, offlineSafe, queuedAt: new Date().toISOString(), attempts: 0,
    };
    if (!online) {
      this.enqueue(queued);
      this.projectionValue = applyPlayerCommand(this.projectionValue, submittedCommand);
      this.writeCache(this.projectionValue); this.emitProjection();
      return this.projectionValue;
    }
    try {
      const result = await this.gateway.submitCommand(this.campaignId, submittedCommand, this.projectionValue.revision, offlineSafe, queued.idempotencyKey);
      if (result.projection !== null) this.acceptSnapshot(result.projection);
      const roll = parseSharedDiceRoll(result.diceRoll);
      if (roll !== null) this.acceptDiceRoll(roll, true);
      return this.projectionValue;
    } catch (error) {
      if (!offlineSafe) throw error;
      this.enqueue(queued);
      this.projectionValue = applyPlayerCommand(this.projectionValue, submittedCommand);
      this.writeCache(this.projectionValue); this.emitProjection();
      this.setConnection('reconnecting', 'The edit is saved locally and will sync after reconnection.');
      return this.projectionValue;
    }
  }

  private readonly handleOnline = (): void => {
    this.setConnection('reconnecting', 'Network returned; reconnecting safely…');
    void this.connectRealtime().then(async () => {
      await this.hydrateDiceHistory();
      await this.flushQueue();
    }).catch(() => {
      this.setConnection('offline', 'Could not reconnect yet. Your cached view remains available.');
    });
  };
  private readonly handleOffline = (): void => this.setConnection('offline', 'Offline. Safe notes and character edits can still be queued.');

  private async connectRealtime(): Promise<void> {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = await this.gateway.subscribePlayer(this.campaignId, this.userId, this.presence, {
      onProjection: (projection) => this.acceptSnapshot(projection),
      onConnection: (state, detail) => {
        this.setConnection(state, detail);
        if (state === 'online') {
          void this.hydrateDiceHistory();
          void this.flushQueue();
        }
      },
      onEvent: (event) => {
        if (event.event_type !== 'command.dice.roll') return;
        const roll = parseSharedDiceRoll(event.safe_payload.diceRoll);
        if (roll !== null) this.acceptDiceRoll(roll, true);
      },
    });
  }

  private acceptSnapshot(value: PlayerProjection): void {
    const incoming = parsePlayerProjection(value);
    const diceById = new Map<string, SharedDiceRoll>();
    for (const candidate of [...this.projectionValue.diceRolls, ...incoming.diceRolls]) {
      const roll = parseSharedDiceRoll(candidate);
      if (roll !== null && !diceById.has(roll.id)) diceById.set(roll.id, roll);
    }
    const projection = parsePlayerProjection({
      ...incoming,
      diceRolls: [...diceById.values()]
        .sort((a, b) => Date.parse(b.rolledAt) - Date.parse(a.rolledAt))
        .slice(0, 100),
    });
    if (projection.revision < this.projectionValue.revision && this.queue.length === 0) return;
    const gap = projection.revision > this.projectionValue.revision + 1;
    this.projectionValue = projection;
    this.writeCache(projection); this.emitProjection();
    if (gap) this.setConnection('online', 'A revision gap was replaced with a complete safe snapshot.');
  }

  private async hydrateDiceHistory(): Promise<void> {
    if (this.diceHistoryPromise !== null) return this.diceHistoryPromise;
    const operation = this.loadDiceHistory();
    this.diceHistoryPromise = operation;
    try {
      await operation;
    } finally {
      if (this.diceHistoryPromise === operation) this.diceHistoryPromise = null;
    }
  }

  private async loadDiceHistory(): Promise<void> {
    try {
      const events = await this.gateway.diceEvents(this.campaignId, 30);
      const rolls = events.flatMap((event) => {
        const roll = parseSharedDiceRoll(event.safe_payload.diceRoll);
        return roll === null ? [] : [roll];
      });
      if (rolls.length === 0) return;
      const unique = new Map<string, SharedDiceRoll>();
      for (const roll of [...rolls, ...this.projectionValue.diceRolls]) {
        const parsed = parseSharedDiceRoll(roll);
        if (parsed !== null && !unique.has(parsed.id)) unique.set(parsed.id, parsed);
      }
      const diceRolls = [...unique.values()]
        .sort((a, b) => Date.parse(b.rolledAt) - Date.parse(a.rolledAt))
        .slice(0, 100);
      this.projectionValue = parsePlayerProjection({ ...this.projectionValue, diceRolls });
      this.writeCache(this.projectionValue);
      this.emitProjection();
    } catch {
      // Dice history is a reconnect convenience. The assigned safe projection still opens without it.
    }
  }

  private acceptDiceRoll(roll: SharedDiceRoll, announce: boolean): void {
    if (this.projectionValue.diceRolls.some((item) => item.id === roll.id)) return;
    this.projectionValue = parsePlayerProjection({
      ...this.projectionValue,
      diceRolls: [roll, ...this.projectionValue.diceRolls].slice(0, 100),
    });
    this.writeCache(this.projectionValue);
    this.emitProjection();
    if (announce) for (const listener of this.diceRollListeners) listener(roll);
  }

  private enqueue(command: QueuedPlayerCommand): void {
    if (this.queue.some((item) => item.idempotencyKey === command.idempotencyKey)) return;
    this.queue = [...this.queue, command].slice(-QUEUE_LIMIT);
    this.writeQueue(); this.updatePending();
  }

  private async flushQueue(): Promise<void> {
    if (!navigator.onLine || this.queue.length === 0) { this.updatePending(); return; }
    while (this.queue.length > 0 && navigator.onLine) {
      const next = this.queue[0];
      if (next === undefined) break;
      try {
        const result = await this.gateway.submitCommand(this.campaignId, next.command, next.expectedRevision, true, next.idempotencyKey);
        if (result.projection === null) throw new Error('Queued state command returned no projection.');
        this.queue = this.queue.slice(1); this.writeQueue(); this.acceptSnapshot(result.projection);
      } catch {
        const attempts = next.attempts + 1;
        this.queue = [{ ...next, attempts }, ...this.queue.slice(1)]; this.writeQueue(); this.updatePending();
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(5, attempts));
        this.setConnection('reconnecting', `Sync paused; retrying in ${Math.round(delay / 1000)} seconds.`);
        if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
        this.retryTimer = window.setTimeout(() => void this.flushQueue(), delay);
        return;
      }
    }
    this.updatePending();
    if (this.queue.length === 0) this.setConnection('online', 'All queued changes are synchronized.');
  }

  private readQueue(): QueuedPlayerCommand[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(this.queueKey) ?? '[]');
      if (!Array.isArray(value)) return [];
      return value.flatMap((candidate) => {
        if (!isRecord(candidate) || typeof candidate.idempotencyKey !== 'string' || !isRecord(candidate.command)) return [];
        return [candidate as unknown as QueuedPlayerCommand];
      }).slice(-QUEUE_LIMIT);
    } catch { return []; }
  }

  private writeQueue(): void { localStorage.setItem(this.queueKey, JSON.stringify(this.queue)); }
  private writeCache(projection: PlayerProjection): void { localStorage.setItem(this.cacheKey, JSON.stringify(projection)); }
  private emitProjection(): void { for (const listener of this.projectionListeners) listener(this.projectionValue); }
  private updatePending(): void { this.state = { ...this.state, pendingCommands: this.queue.length }; this.emitConnection(); }
  private setConnection(state: ConnectionSnapshot['state'], detail: string): void {
    this.state = { state, detail, lastOnlineAt: state === 'online' ? new Date().toISOString() : this.state.lastOnlineAt, pendingCommands: this.queue.length };
    this.emitConnection();
  }
  private emitConnection(): void { for (const listener of this.connectionListeners) listener(this.state); }
}
