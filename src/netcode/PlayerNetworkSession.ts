import { applyPlayerCommand, type PlayerCommand } from '../player/PlayerCommands';
import { parsePlayerProjection, type PlayerProjection } from '../player/PlayerProjection';
import { isOfflineSafeCommand, type ConnectionSnapshot, type PresenceRecord, type QueuedPlayerCommand } from './NetcodeTypes';
import { SupabaseGateway } from './SupabaseGateway';

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
  private unsubscribeRealtime: (() => void) | null = null;
  private retryTimer: number | null = null;
  private queue: QueuedPlayerCommand[];
  private readonly queueKey: string;
  private readonly cacheKey: string;

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

  public async start(): Promise<void> {
    this.setConnection('connecting', 'Joining the private campaign channel…');
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    try {
      await this.connectRealtime();
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
    const offlineSafe = isOfflineSafeCommand(command);
    const online = this.state.state === 'online' && navigator.onLine;
    if (!online && !offlineSafe) throw new Error('This action requires a live connection. PAYAW did not queue it.');
    const queued: QueuedPlayerCommand = {
      campaignId: this.campaignId, idempotencyKey: commandId(), command,
      expectedRevision: this.projectionValue.revision, offlineSafe, queuedAt: new Date().toISOString(), attempts: 0,
    };
    if (!online) {
      this.enqueue(queued);
      this.projectionValue = applyPlayerCommand(this.projectionValue, command);
      this.writeCache(this.projectionValue); this.emitProjection();
      return this.projectionValue;
    }
    try {
      const result = await this.gateway.submitCommand(this.campaignId, command, this.projectionValue.revision, offlineSafe, queued.idempotencyKey);
      this.acceptSnapshot(result.projection);
      return this.projectionValue;
    } catch (error) {
      if (!offlineSafe) throw error;
      this.enqueue(queued);
      this.projectionValue = applyPlayerCommand(this.projectionValue, command);
      this.writeCache(this.projectionValue); this.emitProjection();
      this.setConnection('reconnecting', 'The edit is saved locally and will sync after reconnection.');
      return this.projectionValue;
    }
  }

  private readonly handleOnline = (): void => {
    this.setConnection('reconnecting', 'Network returned; reconnecting safely…');
    void this.connectRealtime().then(() => this.flushQueue()).catch(() => {
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
        if (state === 'online') void this.flushQueue();
      },
    });
  }

  private acceptSnapshot(value: PlayerProjection): void {
    const projection = parsePlayerProjection(value);
    if (projection.revision < this.projectionValue.revision && this.queue.length === 0) return;
    const gap = projection.revision > this.projectionValue.revision + 1;
    this.projectionValue = projection;
    this.writeCache(projection); this.emitProjection();
    void this.gateway.acknowledge(this.campaignId, projection.revision).catch(() => undefined);
    if (gap) this.setConnection('online', 'A revision gap was replaced with a complete safe snapshot.');
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
