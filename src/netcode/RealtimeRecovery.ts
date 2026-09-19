/** Own one subscription, including recovery after CLOSED (not retried by the SDK). */
interface RecoverableChannel {
  subscribe(callback: (status: string, error?: Error) => void): unknown;
  track(payload: object): Promise<unknown>;
}

export function maintainRealtimeSubscription<T extends RecoverableChannel>(options: {
  readonly authenticate: () => Promise<void>;
  readonly createChannel: () => T;
  readonly removeChannel: (channel: T) => Promise<unknown>;
  readonly presence: object;
  readonly onConnection: (state: 'online' | 'reconnecting' | 'offline', detail: string) => void;
}): () => void {
  let disposed = false;
  let connecting = false;
  let healthy = false;
  let generation = 0;
  let attempts = 0;
  let channel: T | null = null;
  let timer: number | null = null;
  const clearRetry = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };
  const schedule = (detail: string) => {
    if (disposed) return;
    healthy = false;
    if (!navigator.onLine) {
      options.onConnection('offline', 'Network unavailable. Your session is kept on this browser.');
      return;
    }
    options.onConnection('reconnecting', detail);
    if (timer !== null) return;
    // Jitter prevents a full table from rejoining simultaneously after an outage.
    const delay = Math.min(30_000, 2_000 * 2 ** Math.min(attempts++, 4)) * (0.75 + Math.random() * 0.5);
    timer = window.setTimeout(() => { timer = null; void connect(); }, delay);
  };
  const connect = async () => {
    if (disposed || connecting || healthy) return;
    if (!navigator.onLine) { schedule('Waiting for the network.'); return; }
    connecting = true;
    const current = ++generation;
    try {
      const previous = channel;
      channel = null;
      // Invalidate old callbacks before removing a channel, and wait for removal
      // before creating its replacement (Supabase reuses matching topics).
      if (previous !== null) await options.removeChannel(previous);
      if (disposed) return;
      await options.authenticate();
      if (disposed) return;
      const next = options.createChannel();
      channel = next;
      next.subscribe((status, error) => {
        if (disposed || current !== generation) return;
        if (status === 'SUBSCRIBED') {
          healthy = true;
          attempts = 0;
          clearRetry();
          // Presence is informational; do not hold the session offline while
          // waiting for a presence acknowledgement during a busy join burst.
          options.onConnection('online', 'Live with the campaign room.');
          void next.track(options.presence).catch(() => undefined);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const reason = error?.message ? ` (${error.message})` : '';
          schedule(`Campaign connection interrupted${reason}; reconnecting automatically. Your login is retained.`);
        }
      });
    } catch {
      schedule('Could not reconnect yet. Your login is retained; retrying automatically.');
    } finally {
      connecting = false;
    }
  };
  const wake = () => {
    if (disposed || !navigator.onLine) return;
    if (!healthy) {
      // Coalesce online/pageshow/visibility bursts into one jittered retry.
      schedule('Resuming your campaign connection…');
    } else {
      void options.authenticate().catch(() => schedule('Refreshing the campaign connection…'));
    }
  };
  const visibility = () => { if (document.visibilityState === 'visible') wake(); };
  const offline = () => { clearRetry(); schedule('Waiting for the network.'); };
  window.addEventListener('online', wake);
  window.addEventListener('pageshow', wake);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('offline', offline);
  void connect();
  return () => {
    disposed = true;
    generation++;
    clearRetry();
    window.removeEventListener('online', wake);
    window.removeEventListener('pageshow', wake);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('offline', offline);
    if (channel !== null) void options.removeChannel(channel).catch(() => undefined);
    channel = null;
  };
}
