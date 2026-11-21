import { TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useId, useRef, useState } from "react";

import { track } from "../lib/analytics";
import { loadOpsConfig } from "../lib/opsConfig";
import {
  bannerAdGroupId,
  initTossBanner,
  isTossBannerSupported,
  type BannerPlacement,
} from "../lib/tossBanner";
import "./BannerAdSlot.css";

const LAZY_CAP = 3;

type LazySlot = {
  id: string;
  near: boolean;
  ratio: number;
  arm: (on: boolean) => void;
};

const lazySlots = new Map<string, LazySlot>();

function reconcileLazy() {
  const near = [...lazySlots.values()].filter((slot) => slot.near).sort((a, b) => b.ratio - a.ratio);
  const keep = new Set(near.slice(0, LAZY_CAP).map((slot) => slot.id));
  for (const slot of lazySlots.values()) slot.arm(keep.has(slot.id));
}

/**
 * One Toss banner. The host stays empty so the SDK can fill it.
 * Unsupported environments render nothing. No-fill and render failure collapse the slot.
 * The SDK refreshes the creative itself — this component never reloads on a timer.
 * `scrollRoot` attaches only while the slot is near that scroller, and keeps the
 * opened height after destroy so the list does not jump.
 */
export function BannerAdSlot({
  placement,
  scrollRoot,
}: {
  placement: BannerPlacement;
  scrollRoot?: HTMLElement | null;
}) {
  const lazy = scrollRoot !== undefined;
  const supported = isTossBannerSupported();
  const slotId = useId();
  const slotRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<{ destroy: () => void } | null>(null);
  const [adGroupId, setAdGroupId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [armed, setArmed] = useState(!lazy);
  const [heldHeight, setHeldHeight] = useState(0);
  const [phase, setPhase] = useState<"wait" | "shown" | "held" | "gone">("wait");

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
    if (!lazy || phase === "gone") return;
    if (!scrollRoot || !slotRef.current) return;
    const slot: LazySlot = {
      id: slotId,
      near: false,
      ratio: 0,
      arm: (on) => setArmed((prev) => (prev === on ? prev : on)),
    };
    lazySlots.set(slotId, slot);
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        slot.near = entry.isIntersecting;
        slot.ratio = entry.intersectionRatio;
        reconcileLazy();
      },
      { root: scrollRoot, rootMargin: "280px 0px", threshold: [0, 0.25, 0.75] },
    );
    io.observe(slotRef.current);
    return () => {
      io.disconnect();
      lazySlots.delete(slotId);
      reconcileLazy();
    };
  }, [lazy, phase, scrollRoot, slotId]);

  useEffect(() => {
    if (!armed && phase === "shown") setPhase("held");
  }, [armed, phase]);

  useEffect(() => {
    if (!supported || !ready || !adGroupId || !armed || !hostRef.current) return;
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
            const height = slotRef.current?.offsetHeight ?? 0;
            if (height > 8) setHeldHeight(height);
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
  }, [adGroupId, armed, placement, ready, supported]);

  if (!supported || phase === "gone") return null;

  const open = phase === "shown" || phase === "held";
  return (
    <div
      ref={slotRef}
      className={`banner-ad-slot${open ? " is-shown" : ""}${lazy ? " is-lazy" : ""}${phase === "held" ? " is-held" : ""}`}
      data-placement={placement}
      style={open && heldHeight > 0 ? { minHeight: heldHeight } : undefined}
    >
      <div className="banner-ad-clip">
        <div className="banner-ad-host" ref={hostRef} />
      </div>
    </div>
  );
}
