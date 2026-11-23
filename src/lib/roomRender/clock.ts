/** Shared room clock. Lights tick at 10fps; the loop stops when nobody is listening or the tab is hidden. */
const LIGHT_FRAME_MS = 100;

type Tick = (now: number) => void;

const listeners = new Set<Tick>();
let raf = 0;
let last = 0;

function loop(now: number) {
  raf = 0;
  if (!listeners.size || document.hidden) return;
  if (now - last >= LIGHT_FRAME_MS) {
    last = now;
    for (const tick of listeners) tick(now);
  }
  raf = requestAnimationFrame(loop);
}

function ensure() {
  if (raf || !listeners.size || document.hidden) return;
  last = 0;
  raf = requestAnimationFrame(loop);
}

function onShow() {
  if (!document.hidden) ensure();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onShow);
}

export function subscribeRoomClock(tick: Tick): () => void {
  listeners.add(tick);
  ensure();
  return () => {
    listeners.delete(tick);
    if (!listeners.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

export const ROOM_LIGHT_FPS = 1000 / LIGHT_FRAME_MS;
