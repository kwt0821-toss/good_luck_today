import { TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

import { track } from "../lib/analytics";
import { loadOpsConfig } from "../lib/opsConfig";
import {
  bannerAdGroupId,
  initTossBanner,
  isTossBannerSupported,
  type BannerPlacement,
} from "../lib/tossBanner";
import "./BannerAdSlot.css";

/**
 * One Toss banner. The host stays empty so the SDK can fill it.
 * Unsupported environments render nothing. No-fill and render failure collapse the slot.
 * The SDK refreshes the creative itself — this component never reloads on a timer.
 */
export function BannerAdSlot({ placement }: { placement: BannerPlacement }) {
  const supported = isTossBannerSupported();
  const hostRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<{ destroy: () => void } | null>(null);
  const [adGroupId, setAdGroupId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"wait" | "shown" | "gone">("wait");

  useEffect(() => {
    if (!supported) return;
    let cancel = false;
    void loadOpsConfig()
      .then((config) => {
        if (cancel) return;
        const id = bannerAdGroupId(placement, config.economy.ads);
        if (!id) setPhase("gone");
        else setAdGroupId(id);
      })
      .catch(() => {
        if (cancel) return;
        if (import.meta.env.DEV) setAdGroupId("ait-ad-test-banner-id");
        else setPhase("gone");
      });
    return () => {
      cancel = true;
    };
  }, [placement, supported]);

  useEffect(() => {
    if (!supported) return;
    let cancel = false;
    void initTossBanner().then((ok) => {
      if (cancel) return;
      if (ok) setReady(true);
      else setPhase("gone");
    });
    return () => {
      cancel = true;
    };
  }, [supported]);

  useEffect(() => {
    if (!supported || !ready || !adGroupId || !hostRef.current) return;
    const host = hostRef.current;
    let alive = true;
    const drop = () => {
      const current = bannerRef.current;
      bannerRef.current = null;
      try {
        current?.destroy();
      } catch {
        // already destroyed
      }
    };
    try {
      bannerRef.current = TossAds.attachBanner(adGroupId, host, {
        theme: "dark",
        tone: "grey",
        variant: "card",
        callbacks: {
          onAdRendered: () => {
            if (!alive) return;
            setPhase("shown");
            track("banner_rendered", { placement });
          },
          onAdViewable: () => {
            if (!alive) return;
            track("banner_viewable", { placement });
          },
          onAdClicked: () => {
            if (!alive) return;
            track("banner_clicked", { placement });
          },
          onNoFill: () => {
            if (!alive) return;
            track("banner_no_fill", { placement });
            setPhase("gone");
            drop();
          },
          onAdFailedToRender: () => {
            if (!alive) return;
            setPhase("gone");
            drop();
          },
        },
      });
    } catch {
      if (alive) setPhase("gone");
    }
    return () => {
      alive = false;
      drop();
    };
  }, [adGroupId, placement, ready, supported]);

  if (!supported || phase === "gone") return null;

  return (
    <div
      className={`banner-ad-slot${phase === "shown" ? " is-shown" : ""}`}
      data-placement={placement}
    >
      <div className="banner-ad-clip">
        <div className="banner-ad-host" ref={hostRef} />
      </div>
    </div>
  );
}
