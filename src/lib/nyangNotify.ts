/**
 * 냥 알림 (Nyang Notify) — imperative queue + React host subscription.
 * Spec: docs/archive/notify/notify-spec.md
 */

export type NyKind = "success" | "reward" | "info" | "error" | "celebrate";

export type NyAction = {
  label: string;
  onClick: () => void;
};

export type NyRewardChip = {
  label: string;
  icon?: "ncoin" | "paw" | "ticket" | "cat";
};

export type NyNotifyInput = {
  key: string;
  kind: NyKind;
  /** Supports `<b>…</b>` and `{n}` (merge count). */
  title: string;
  sub?: string;
  action?: NyAction;
  /** Defaults: error/action 4000, celebrate 3200, else 2600. */
  duration?: number;
  /** Force assertive live region (errors default assertive). */
  assertive?: boolean;
  /** Merged numeric count; same key sums this value. */
  count?: number;
  /** Celebrate reward pills. */
  rewards?: NyRewardChip[];
  /** "menu" sits below the menu stat row so it does not cover the numbers. */
  anchor?: "top" | "menu";
};

export type NyConfirmInput = {
  key?: string;
  title: string;
  body: string;
  cancelLabel?: string;
  confirmLabel?: string;
  /** Optional pill under body, e.g. "+210 포인트". */
  badge?: string;
};

type QueuedNotify = NyNotifyInput & {
  count: number;
  enqueuedAt: number;
};

type SheetState = NyConfirmInput & {
  resolve: (ok: boolean) => void;
};

type HostSnapshot = {
  current: QueuedNotify | null;
  phase: "in" | "out" | "idle";
  sheet: SheetState | null;
  remainingMs: number;
  durationMs: number;
};

type Listener = () => void;

const PRIORITY: Record<NyKind, number> = {
  error: 5,
  celebrate: 4,
  reward: 3,
  success: 2,
  info: 1,
};

const MAX_QUEUE = 3;
const DEFAULT_DUR = 2600;
const ACTION_DUR = 4000;
const ERROR_DUR = 4000;
const CELEBRATE_DUR = 3200;
const OUT_MS = 220;
const OUT_MS_REDUCED = 150;

const queue: QueuedNotify[] = [];
let current: QueuedNotify | null = null;
let phase: HostSnapshot["phase"] = "idle";
let sheet: SheetState | null = null;
const listeners = new Set<Listener>();
let dismissTimer = 0;
let outTimer = 0;
let startedAt = 0;
let durationMs = 0;
let remainingMs = 0;
let paused = false;
let pauseStarted = 0;

function durationScale(): number {
  try {
    const raw = window.sessionStorage.getItem("ny.notify.durationScale");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  // CSSOM / accessibility: approximate with prefers-reduced-motion not duration.
  return 1;
}

function reduceMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function defaultDuration(item: NyNotifyInput): number {
  if (item.duration != null) return item.duration;
  if (item.kind === "error") return ERROR_DUR;
  if (item.kind === "celebrate") return CELEBRATE_DUR;
  if (item.action) return ACTION_DUR;
  return DEFAULT_DUR;
}

function applyCount(template: string | undefined, count: number): string | undefined {
  if (template == null) return template;
  return template.replace(/\{n\}/g, String(count));
}

/** Screen-reader text. `{ncoin}` / `{paw}` become words, not leftover tokens. */
export function nySpeakText(template: string | undefined, count: number): string {
  const raw = applyCount(template, count) ?? "";
  return raw
    .replace(/<\/?b>/g, "")
    .replace(/\{ncoin\}/g, "냥코인 ")
    .replace(/\{paw\}/g, "포인트 ")
    .replace(/\s+\+\s+/g, ", ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function emit() {
  for (const listener of listeners) listener();
}

function snapshot(): HostSnapshot {
  return {
    current,
    phase,
    sheet,
    remainingMs,
    durationMs,
  };
}

function clearTimers() {
  window.clearTimeout(dismissTimer);
  window.clearTimeout(outTimer);
  dismissTimer = 0;
  outTimer = 0;
}

function trimQueue() {
  while (queue.length > MAX_QUEUE) {
    const infoIdx = queue.findIndex((item) => item.kind === "info");
    if (infoIdx >= 0) {
      queue.splice(infoIdx, 1);
      continue;
    }
    // Drop oldest lowest-priority.
    let drop = 0;
    for (let i = 1; i < queue.length; i += 1) {
      if (PRIORITY[queue[i].kind] < PRIORITY[queue[drop].kind]) drop = i;
      else if (
        PRIORITY[queue[i].kind] === PRIORITY[queue[drop].kind] &&
        queue[i].enqueuedAt < queue[drop].enqueuedAt
      ) {
        drop = i;
      }
    }
    queue.splice(drop, 1);
  }
}

function mergeInto(target: QueuedNotify, incoming: NyNotifyInput) {
  const add = incoming.count ?? 1;
  target.count += add;
  target.kind = incoming.kind;
  target.title = incoming.title;
  target.sub = incoming.sub;
  target.action = incoming.action;
  target.assertive = incoming.assertive;
  target.rewards = incoming.rewards;
  if (incoming.duration != null) target.duration = incoming.duration;
}

function pickNext(): QueuedNotify | null {
  if (!queue.length) return null;
  let best = 0;
  for (let i = 1; i < queue.length; i += 1) {
    const a = queue[i];
    const b = queue[best];
    if (PRIORITY[a.kind] > PRIORITY[b.kind]) best = i;
    else if (PRIORITY[a.kind] === PRIORITY[b.kind] && a.enqueuedAt < b.enqueuedAt) best = i;
  }
  return queue.splice(best, 1)[0] ?? null;
}

function startTimer() {
  if (!current) return;
  clearTimers();
  durationMs = Math.round(defaultDuration(current) * durationScale());
  remainingMs = durationMs;
  startedAt = performance.now();
  paused = false;
  dismissTimer = window.setTimeout(() => dismissCurrent(), durationMs);
}

function pauseTimer() {
  if (!current || paused || phase !== "in") return;
  paused = true;
  pauseStarted = performance.now();
  remainingMs = Math.max(0, durationMs - (pauseStarted - startedAt));
  window.clearTimeout(dismissTimer);
  dismissTimer = 0;
}

function resumeTimer() {
  if (!current || !paused || phase !== "in") return;
  paused = false;
  startedAt = performance.now();
  durationMs = remainingMs;
  dismissTimer = window.setTimeout(() => dismissCurrent(), remainingMs);
  emit();
}

function finishOut() {
  phase = "idle";
  current = null;
  remainingMs = 0;
  durationMs = 0;
  emit();
  next();
}

function dismissCurrent() {
  if (!current || phase === "out") return;
  clearTimers();
  phase = "out";
  emit();
  const ms = reduceMotion() ? OUT_MS_REDUCED : OUT_MS;
  outTimer = window.setTimeout(finishOut, ms);
}

function next() {
  if (sheet) {
    emit();
    return;
  }
  if (current && phase !== "idle") return;
  const item = pickNext();
  if (!item) {
    current = null;
    phase = "idle";
    emit();
    return;
  }
  current = item;
  phase = "in";
  emit();
  startTimer();
}

/** Show a snackbar or celebrate banner. */
export function nyNotify(input: NyNotifyInput): void {
  const count = input.count ?? 1;
  if (current && current.key === input.key && phase === "in") {
    mergeInto(current, input);
    emit();
    startTimer();
    return;
  }
  const existing = queue.find((item) => item.key === input.key);
  if (existing) {
    mergeInto(existing, input);
    emit();
    return;
  }
  queue.push({
    ...input,
    count,
    enqueuedAt: Date.now(),
  });
  trimQueue();
  if (!current || phase === "idle") next();
  else emit();
}

/** Irreversible confirm sheet (T3). Resolves true on confirm. */
export function nyConfirm(input: NyConfirmInput): Promise<boolean> {
  return new Promise((resolve) => {
    if (sheet) {
      sheet.resolve(false);
    }
    // Pause active T1 while sheet is open.
    pauseTimer();
    sheet = { ...input, resolve };
    emit();
  });
}

export function nyConfirmClose(ok: boolean) {
  if (!sheet) return;
  const pending = sheet;
  sheet = null;
  pending.resolve(ok);
  emit();
  if (current && phase === "in") resumeTimer();
  else next();
}

/** Close the visible toast and drop anything still queued. Confirm sheets stay. */
export function nyDismiss() {
  queue.length = 0;
  if (current && phase !== "idle") dismissCurrent();
  else emit();
}

export function nyNotifySubscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function nyNotifyGetSnapshot(): HostSnapshot {
  return snapshot();
}

/** Render helpers — title/sub with merged `{n}`. */
export function nyResolveText(template: string | undefined, count: number): string {
  return applyCount(template, count) ?? "";
}

export function nyHostControls() {
  return {
    pauseTimer,
    resumeTimer,
    dismiss: dismissCurrent,
  };
}
