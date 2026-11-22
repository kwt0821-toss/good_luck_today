import { isDebugFlagRequest } from "../debugSaveQuery.ts";

type FrameSample = { t: number; gap: number };

let enabled: boolean | null = null;
let raf = 0;
let holders = 0;
let navAt = 0;
let lastFrame = 0;
let trackingEnter = false;
let enterMs = 0;
let enterLongest = 0;
const recent: FrameSample[] = [];

export function debugPerfEnabled(search = "", schemeUrl = ""): boolean {
  if (enabled === true) return true;
  if (!isDebugFlagRequest("debugPerf", search, schemeUrl)) return false;
  enabled = true;
  return true;
}

function tick(now: number) {
  const gap = lastFrame ? now - lastFrame : 0;
  lastFrame = now;
  if (trackingEnter && gap > 0) enterLongest = Math.max(enterLongest, gap);
  if (gap > 0) {
    recent.push({ t: now, gap });
    const cutoff = now - 5000;
    while (recent.length && recent[0].t < cutoff) recent.shift();
  }
  raf = requestAnimationFrame(tick);
}

function ensureLoop(now: number) {
  lastFrame = now;
  if (!raf) raf = requestAnimationFrame(tick);
}

function releaseLoop() {
  if (holders > 0 || trackingEnter) return;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/** Keep the frame loop only while the perf box is on screen. */
export function holdRoomPerf(): () => void {
  holders += 1;
  ensureLoop(performance.now());
  return () => {
    holders = Math.max(0, holders - 1);
    releaseLoop();
  };
}

/** Home 방꾸미기 tab press. Does nothing unless debugPerf=1. */
export function markRoomNav(search = "", schemeUrl = ""): void {
  if (!debugPerfEnabled(search, schemeUrl)) return;
  navAt = performance.now();
  trackingEnter = true;
  enterMs = 0;
  enterLongest = 0;
  ensureLoop(navAt);
}

/** First paint of the current room. */
export function markRoomFirstPaint(): void {
  if (!trackingEnter || !navAt) return;
  trackingEnter = false;
  enterMs = performance.now() - navAt;
  releaseLoop();
}

export type RoomPerfSnap = {
  enterMs: number;
  enterLongest: number;
  fps: number;
  slowFrames: number;
  longest: number;
};

export function readRoomPerf(): RoomPerfSnap {
  let slow = 0;
  let longest = 0;
  let span = 0;
  if (recent.length >= 2) {
    span = recent[recent.length - 1].t - recent[0].t;
    for (const sample of recent) {
      if (sample.gap > 50) slow += 1;
      if (sample.gap > longest) longest = sample.gap;
    }
  }
  const fps = span > 0 ? ((recent.length - 1) * 1000) / span : 0;
  return {
    enterMs,
    enterLongest,
    fps,
    slowFrames: slow,
    longest,
  };
}
