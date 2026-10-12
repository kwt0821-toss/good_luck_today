import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";

import type { MockAdKind } from "./mockAds";

/** Fallback IDs if economy.json has not loaded yet. */
export const DEFAULT_AD_GROUP_IDS: Record<MockAdKind, string> = {
  short: "ait.v2.live.5d314f95538c4737",
  long: "ait.v2.live.3e9536c7ec2d4ae7",
};

export type TossAdResult = "completed" | "cancelled" | "failed" | "unsupported";

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
 * Load + show a console ad group. Retries load once on failure
 * (economy.draws.adFailFallback). Long (30s) requires userEarnedReward;
 * short accepts reward or a normal dismiss after show.
 */
export async function playTossFullScreenAd(
  kind: MockAdKind,
  adGroupId: string,
): Promise<TossAdResult> {
  if (!isTossFullScreenAdSupported()) return "unsupported";

  let loaded = await loadOnce(adGroupId);
  if (loaded === "failed") {
    loaded = await loadOnce(adGroupId);
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
            finish("failed");
            break;
          default:
            break;
        }
      },
      onError: () => finish("failed"),
    });
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
