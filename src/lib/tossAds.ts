import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";

import type { MockAdKind } from "./mockAds";
import { isOffline } from "./network";

/** Fallback IDs if economy.json has not loaded yet. */
export const DEFAULT_AD_GROUP_IDS: Record<MockAdKind, string> = {
  short: "ait.v2.live.5d314f95538c4737",
  long: "ait.v2.live.3e9536c7ec2d4ae7",
};

export type TossAdResult = "completed" | "cancelled" | "failed" | "unsupported" | "offline";

const LOAD_RETRY_DELAY_MS = 1500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function isTossFullScreenAdSupported(): boolean {
  try {
    return Boolean(loadFullScreenAd.isSupported?.() && showFullScreenAd.isSupported?.());
  } catch {
    return false;
  }
}

export function adGroupIdForKind(
  kind: MockAdKind,
  ads?: {
    short?: { adGroupId?: string };
    long?: { adGroupId?: string };
  } | null,
): string {
  const fromConfig = kind === "long" ? ads?.long?.adGroupId : ads?.short?.adGroupId;
  return fromConfig || DEFAULT_AD_GROUP_IDS[kind];
}

function loadOnce(adGroupId: string): Promise<"loaded" | "failed"> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: "loaded" | "failed") => {
      if (settled) return;
      settled = true;
      try {
        cleanup();
      } catch {
        // ignore
      }
      resolve(value);
    };
    const cleanup = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === "loaded") finish("loaded");
      },
      onError: () => finish("failed"),
    });
  });
}

/**
 * Load + show a console ad group.
 * Offline is not a failure: no retry, no reward, result "offline".
 * An online load miss waits 1.5s and loads once more. "failed" is only
 * two online load misses in a row. Closing the ad is "cancelled".
 * Long (30s) requires userEarnedReward; short accepts reward or a normal dismiss after show.
 */
export async function playTossFullScreenAd(
  kind: MockAdKind,
  adGroupId: string,
  onLoadFail?: (attempt: number, online: boolean) => void,
): Promise<TossAdResult> {
  if (await isOffline()) return "offline";
  if (!isTossFullScreenAdSupported()) return "unsupported";

  let loaded: "loaded" | "failed" = "failed";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    loaded = await loadOnce(adGroupId);
    if (loaded === "failed") {
      const online = typeof navigator !== "undefined" && navigator.onLine;
      try {
        onLoadFail?.(attempt + 1, online);
      } catch {
        // Analytics must not change the ad result.
      }
    }
    if (loaded === "loaded") break;
    if (await isOffline()) return "offline";
    if (attempt === 0) {
      await wait(LOAD_RETRY_DELAY_MS);
      if (await isOffline()) return "offline";
    }
  }
  if (loaded === "failed") return "failed";

  return new Promise((resolve) => {
    let settled = false;
    let shown = false;
    let earned = false;
    const finish = (value: TossAdResult) => {
      if (settled) return;
      settled = true;
      try {
        cleanup();
      } catch {
        // ignore
      }
      resolve(value);
    };

    const cleanup = showFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        switch (event.type) {
          case "show":
          case "impression":
            shown = true;
            break;
          case "userEarnedReward":
            earned = true;
            break;
          case "dismissed":
            if (kind === "long") {
              finish(earned ? "completed" : "cancelled");
            } else {
              finish(earned || shown ? "completed" : "cancelled");
            }
            break;
          case "failedToShow":
            void settleShowFailure();
            break;
          default:
            break;
        }
      },
      onError: () => {
        void settleShowFailure();
      },
    });

    async function settleShowFailure() {
      finish((await isOffline()) ? "offline" : "failed");
    }
  });
}

/** Warm the ad cache for both groups (best-effort, ignore errors). */
export function preloadTossAds(ads?: {
  short?: { adGroupId?: string };
  long?: { adGroupId?: string };
} | null): void {
  if (!isTossFullScreenAdSupported()) return;
  for (const kind of ["short", "long"] as const) {
    const adGroupId = adGroupIdForKind(kind, ads);
    try {
      loadFullScreenAd({
        options: { adGroupId },
        onEvent: () => undefined,
        onError: () => undefined,
      });
    } catch {
      // preview / unsupported
    }
  }
}
