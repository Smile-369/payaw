import { maintainRealtimeSubscription } from '../src/netcode/RealtimeRecovery';

function assert(condition: unknown, message: string): void { if (!condition) throw new Error(message); }
const timers = new Map<number, { callback: () => void; delay: number }>();
let timerId = 0;
let online = true;
// Browser-style target without Node's 10-listener warning; the crowd test
// represents separate browsers sharing one deterministic test clock.
class Events {
  private readonly listeners = new Map<string, Set<EventListener>>();
  public addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  public removeEventListener(type: string, listener: EventListener) { this.listeners.get(type)?.delete(listener); }
  public dispatchEvent(event: Event) { for (const listener of this.listeners.get(event.type) ?? []) listener(event); }
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new Events(), {
  setTimeout: (callback: () => void, delay: number) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
  clearTimeout: (id: number) => timers.delete(id),
}) });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get onLine() { return online; } } });
Object.defineProperty(globalThis, 'document', { configurable: true, value: Object.assign(new Events(), { visibilityState: 'visible' }) });

class Channel {
  public callback: (status: string, error?: Error) => void = () => undefined;
  public tracks = 0;
  public subscribe(callback: typeof this.callback) { this.callback = callback; }
  public async track() { this.tracks++; throw new Error('Presence temporarily unavailable'); }
}

async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function fireTimers() {
  const pending = [...timers.values()]; timers.clear();
  for (const { callback } of pending) callback();
}
function fixture(authenticate: () => Promise<void> = async () => undefined, remove: () => Promise<void> = async () => undefined) {
  const channels: Channel[] = [];
  const removed: Channel[] = [];
  const states: string[] = [];
  let authentications = 0;
  const stop = maintainRealtimeSubscription({
    authenticate: async () => { authentications++; await authenticate(); },
    createChannel: () => { const channel = new Channel(); channels.push(channel); return channel; },
    removeChannel: async (channel) => { removed.push(channel); channel.callback('CLOSED'); await remove(); },
    presence: { userId: 'player' },
    onConnection: (state) => states.push(state),
  });
  return { channels, removed, states, stop, authentications: () => authentications };
}

async function main() {
  const room = fixture(); await settle();
  assert(room.channels.length === 1, 'Initial channel was not created.');
  room.channels[0]!.callback('SUBSCRIBED'); await settle();
  assert(room.states.at(-1) === 'online', 'Presence failure incorrectly disconnected the session.');
  room.channels[0]!.callback('CLOSED');
  room.channels[0]!.callback('CHANNEL_ERROR', new Error('Too many joins'));
  window.dispatchEvent(new Event('online'));
  window.dispatchEvent(new Event('pageshow'));
  document.dispatchEvent(new Event('visibilitychange'));
  assert(timers.size === 1, 'Reconnect events scheduled duplicate joins.');
  fireTimers(); await settle();
  assert(room.channels.length === 2 && room.removed.length === 1 && room.authentications() === 2, 'Closed channel did not reconnect with fresh auth.');
  room.channels[0]!.callback('SUBSCRIBED');
  assert(room.states.at(-1) !== 'online', 'Stale channel callbacks changed current connection state.');
  room.channels[1]!.callback('TIMED_OUT');
  room.channels[1]!.callback('SUBSCRIBED'); await settle();
  assert(timers.size === 0, 'SDK native recovery did not cancel the replacement timer.');
  online = false; window.dispatchEvent(new Event('offline'));
  assert(room.states.at(-1) === 'offline' && timers.size === 0, 'Offline clients keep hammering reconnect.');
  online = true; window.dispatchEvent(new Event('online')); fireTimers(); await settle();
  assert(room.channels.length === 3, 'Network return did not recover.');
  room.stop(); await settle();
  const stateCount = room.states.length;
  room.channels[2]!.callback('CLOSED'); window.dispatchEvent(new Event('online'));
  assert(room.states.length === stateCount && timers.size === 0, 'Intentional stop restarted the subscription.');

  let releaseAuth!: () => void;
  const delayedAuth = fixture(() => new Promise<void>((resolve) => { releaseAuth = resolve; }));
  delayedAuth.stop(); releaseAuth(); await settle();
  assert(delayedAuth.channels.length === 0, 'Stopping during authentication leaked a live channel.');

  let releaseRemoval!: () => void;
  const delayedRemoval = fixture(async () => undefined, () => new Promise<void>((resolve) => { releaseRemoval = resolve; }));
  await settle(); delayedRemoval.channels[0]!.callback('CLOSED'); fireTimers(); await settle();
  window.dispatchEvent(new Event('online')); fireTimers(); await settle();
  assert(delayedRemoval.channels.length === 1, 'Replacement joined before old channel removal completed.');
  releaseRemoval(); await settle();
  assert(delayedRemoval.channels.length === 2, 'Replacement did not join after removal completed.');
  delayedRemoval.stop(); releaseRemoval(); await settle();

  let authFails = true;
  const authFailure = fixture(async () => { if (authFails) throw new Error('Network error'); });
  await settle(); assert(timers.size === 1 && authFailure.channels.length === 0, 'Auth transport failure was not retried.');
  authFails = false; fireTimers(); await settle();
  assert(authFailure.channels.length === 1, 'Saved authentication did not recover.');
  authFailure.stop(); await settle();

  // Simulate a table-wide outage without connecting to a real backend.
  const originalRandom = Math.random;
  let seed = 0;
  Math.random = () => (seed++ % 16) / 16;
  const crowd = Array.from({ length: 16 }, () => fixture());
  await settle();
  for (const client of crowd) client.channels[0]!.callback('CLOSED');
  assert(timers.size === 16 && new Set([...timers.values()].map((timer) => timer.delay)).size === 16, 'Players all rejoin at the same instant.');
  fireTimers(); await settle();
  assert(crowd.every((client) => client.channels.length === 2 && client.removed.length === 1), 'Crowd recovery created duplicate or missing channels.');
  for (const client of crowd) client.stop();
  Math.random = originalRandom;
  assert(timers.size === 0, 'Reconnect timers leaked after stopping.');
  console.log(JSON.stringify({ closedChannelRecovery: true, backgroundResume: true, coalescedJoins: true, freshAuthentication: true, teardownSafety: true, presenceFailureIsolation: true, staggered16ClientRecovery: true }));
}
void main().catch((error) => { console.error(error); throw error; });
