import { loadRoomImage, peekRoomImage } from "./imageCache";
import { scheduleIdle } from "./idle";

const queued = new Set<string>();
const pending: string[] = [];
let batchSize = 4;
let running = false;
let paused = false;
let pauseTimer = 0;
let cancelIdle: (() => void) | null = null;

/** Decode room images a few at a time, waiting for idle between batches. */
export function warmRoomImages(urls: Iterable<string>, batch = 4): void {
  batchSize = batch;
  let added = false;
  for (const url of urls) {
    if (!url || queued.has(url) || peekRoomImage(url) !== undefined) continue;
    queued.add(url);
    pending.push(url);
    added = true;
  }
  if (!added || running) return;
  running = true;
  pump();
}

/** While paused, the next batch waits and then checks idle again. */
export function pauseRoomWarm(next: boolean): void {
  if (paused === next) return;
  paused = next;
  if (next || !running || !pauseTimer) return;
  window.clearTimeout(pauseTimer);
  pauseTimer = 0;
  waitIdle();
}

function pump(): void {
  if (paused) {
    holdForPause();
    return;
  }
  const slice: string[] = [];
  while (slice.length < batchSize && pending.length > 0) {
    const url = pending.shift();
    if (!url) break;
    if (peekRoomImage(url) !== undefined) {
      queued.delete(url);
      continue;
    }
    slice.push(url);
  }
  if (slice.length === 0) {
    running = false;
    return;
  }
  void Promise.all(slice.map((url) => loadRoomImage(url))).then(() => {
    for (const url of slice) queued.delete(url);
    if (paused) {
      holdForPause();
      return;
    }
    waitIdle();
  });
}

function holdForPause(): void {
  window.clearTimeout(pauseTimer);
  pauseTimer = window.setTimeout(() => {
    pauseTimer = 0;
    waitIdle();
  }, 400);
}

function waitIdle(): void {
  cancelIdle?.();
  cancelIdle = scheduleIdle(() => {
    cancelIdle = null;
    pump();
  }, 300);
}
