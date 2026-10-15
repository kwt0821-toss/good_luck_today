import { useEffect, useState, type RefObject } from "react";

/** Cat + card design box width (layout-spec §1 #9 / §6). */
export const CAT_STAGE_W = 390;
/**
 * Height ends at the face-down card bottom (deck top 152 + 224) so the
 * after-stage 16px gap sits under the card, not under empty stage padding.
 */
export const CAT_STAGE_H = 376;

/**
 * Scale the cat/card stage into `rowRef`'s box. Buttons / bottom nav stay full size —
 * only this group shrinks when height is tight. Caps at 1.
 */
export function useCatStageFit(rowRef: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const update = () => {
      const aw = el.clientWidth;
      const ah = el.clientHeight;
      if (aw <= 0 || ah <= 0) return;
      const next = Math.min(aw / CAT_STAGE_W, ah / CAT_STAGE_H, 1);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    update();

    const vv = window.visualViewport;
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [rowRef]);

  return scale;
}

/** @deprecated use CAT_STAGE_* / useCatStageFit */
export const MAIN_STAGE_W = CAT_STAGE_W;
export const MAIN_STAGE_H = 844;
export const useMainStageFit = useCatStageFit;
