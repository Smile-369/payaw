// Same-origin worker: keeps Realtime heartbeats off the throttled UI timer.
// Mobile operating systems can still suspend a page; recovery runs on resume.
let heartbeat;
self.addEventListener('message', (event) => {
  if (event.data?.event !== 'start') return;
  clearInterval(heartbeat);
  heartbeat = setInterval(() => self.postMessage({ event: 'keepAlive' }), event.data.interval);
});
