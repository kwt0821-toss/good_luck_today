let suppressedUntil = 0;

function clock(now?: number): number {
  return now ?? performance.now();
}

/** Ignore app back events until `ms` from `now`. A later end time is kept. */
export function suppressAppBack(ms: number, now?: number): void {
  const end = clock(now) + ms;
  if (end > suppressedUntil) suppressedUntil = end;
}

export function isAppBackSuppressed(now?: number): boolean {
  return clock(now) < suppressedUntil;
}

/** Test helper. Clears the suppress window. */
export function clearAppBackSuppress(): void {
  suppressedUntil = 0;
}
