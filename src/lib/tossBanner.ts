import { TossAds, getOperationalEnvironment } from "@apps-in-toss/web-framework";

/** Official list-banner test id. Dev and sandbox always use this. */
export const TEST_BANNER_AD_GROUP_ID = "ait-ad-test-banner-id";

export type BannerPlacement = "dex" | "rewards" | "missions" | "titles";

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

function prefersTestBanner(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return getOperationalEnvironment() !== "toss";
  } catch {
    return false;
  }
}

/** Live id from economy.json. Empty, dev, and sandbox fall back to the test id. */
export function bannerAdGroupId(placement: BannerPlacement, ads?: BannerAdsConfig): string {
  if (prefersTestBanner()) return TEST_BANNER_AD_GROUP_ID;
  const configured = ads?.banner?.[placement]?.adGroupId?.trim() ?? "";
  return configured || TEST_BANNER_AD_GROUP_ID;
}
