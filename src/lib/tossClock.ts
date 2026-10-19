import { getServerTime } from "@apps-in-toss/web-framework";

import { toKstDateKey } from "./date";
import { isTossApp } from "./tossEnv";

let offsetMs: number | null = null;
let serverTimeOk = false;
let pending: Promise<boolean> | null = null;

/** Cached Toss server clock. False until a refresh succeeds, including outside Toss. */
export function hasServerTime(): boolean {
  return serverTimeOk;
}

/**
 * Read Toss server time once and keep the offset from the device clock.
 * Outside Toss, or when the call fails, later dates fall back to the device clock.
 */
export function refreshServerTime(): Promise<boolean> {
  if (!isTossApp()) {
    serverTimeOk = false;
    offsetMs = null;
    return Promise.resolve(false);
  }
  if (pending) return pending;
  pending = (async () => {
    try {
      if (typeof getServerTime.isSupported === "function" && !getServerTime.isSupported()) {
        serverTimeOk = false;
        offsetMs = null;
        return false;
      }
      const ms = await getServerTime();
      if (typeof ms !== "number" || !Number.isFinite(ms)) {
        serverTimeOk = false;
        offsetMs = null;
        return false;
      }
      offsetMs = ms - Date.now();
      serverTimeOk = true;
      return true;
    } catch {
      serverTimeOk = false;
      offsetMs = null;
      return false;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** Server instant when the Toss clock is known, otherwise the device clock. */
export function trustedNow(): Date {
  if (serverTimeOk && offsetMs != null) return new Date(Date.now() + offsetMs);
  return new Date();
}

/** KST calendar day for daily limits and attendance. */
export function trustedKstDateKey(): string {
  return toKstDateKey(trustedNow());
}
