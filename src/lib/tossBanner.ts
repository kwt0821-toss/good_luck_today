import { TossAds } from "@apps-in-toss/web-framework";

export type BannerPlacement =
  | "dex"
  | "rewards"
  | "missions"
  | "titles"
  | "attendance"
  | "exchange"
  | "ticketShop"
  | "rates"
  | "notice"
  | "settings"
  | "help";

export type BannerAdsConfig = {
  banner?: Partial<Record<BannerPlacement, { adGroupId?: string }>>;
} | null;

let initPromise: Promise<boolean> | null = null;

/** False outside the Toss app (local browser) and on apps older than 5.241.0. */
export function isTossBannerSupported(): boolean {
  try {
    return Boolean(TossAds.initialize.isSupported() && TossAds.attachBanner.isSupported());
  } catch {
    return false;
  }
}

/**
 * Initialize the banner SDK once. Later calls share the same result.
 * Does nothing when the SDK is unsupported.
 */
export function initTossBanner(): Promise<boolean> {
  if (!isTossBannerSupported()) return Promise.resolve(false);
  if (initPromise) return initPromise;
  initPromise = new Promise((resolve) => {
    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => resolve(true),
          onInitializationFailed: () => resolve(false),
        },
      });
    } catch {
      resolve(false);
    }
  });
  return initPromise;
}

/** Live id from economy.json. Dev builds use the official test id, and that branch is stripped from production. */
export function bannerAdGroupId(placement: BannerPlacement, ads?: BannerAdsConfig): string {
  if (import.meta.env.DEV) return "ait-ad-test-banner-id";
  return ads?.banner?.[placement]?.adGroupId?.trim() ?? "";
}
