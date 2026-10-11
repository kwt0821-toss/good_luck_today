export type MockAdKind = "short" | "long";

export type MockAdResult = { completed: boolean };

/** Preview ad durations (seconds). Real SDK replaces this module. */
const DURATION_SEC: Record<MockAdKind, number> = {
  short: 3,
  long: 8,
};

export function mockAdDurationSec(kind: MockAdKind): number {
  return DURATION_SEC[kind];
}

/**
 * Imperative mock ad — used when UI owns the overlay (AdModal).
 * Rewards MUST only be granted when `completed === true`.
 */
export function createMockAdSession(kind: MockAdKind) {
  const duration = DURATION_SEC[kind];
  let remaining = duration;
  let completed = false;
  let timer = 0;

  const tickListeners = new Set<(n: number) => void>();

  const start = () => {
    remaining = duration;
    completed = false;
    window.clearInterval(timer);
    timer = window.setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      for (const fn of tickListeners) fn(remaining);
      if (remaining <= 0) {
        completed = true;
        window.clearInterval(timer);
      }
    }, 1000);
  };

  const stop = () => {
    window.clearInterval(timer);
  };

  const forceComplete = () => {
    remaining = 0;
    completed = true;
    window.clearInterval(timer);
    for (const fn of tickListeners) fn(0);
  };

  return {
    kind,
    duration,
    start,
    stop,
    forceComplete,
    onTick(fn: (n: number) => void) {
      tickListeners.add(fn);
      return () => tickListeners.delete(fn);
    },
    get remaining() {
      return remaining;
    },
    get completed(): boolean {
      return completed;
    },
    result(): MockAdResult {
      return { completed };
    },
  };
}
