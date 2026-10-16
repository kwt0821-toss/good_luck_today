import { useEffect, useState, type RefObject } from "react";

/** Cat + card design box width (layout-spec §1 #9 / §6). */
export const CAT_STAGE_W = 390;
/**
 * Card deck ends at y 376 (top 152 + 224). Extra px covers the -2deg tilt
 * AABB so the face doesn't spill into the 16px CTA gap.
 */
export const CAT_STAGE_H = 386;

/**
 * Scale the cat/card stage into `rowRef`'s box. Buttons / bottom nav stay full size —
 * only this group resizes. Fills leftover mid height (may grow past design) so the
 * main screen doesn't letterbox; keeps aspect ratio (sides may crop slightly).
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
      // Fill slot height exactly (aspect locked). Stage is left-aligned in CSS
      // so the rate-up control stays on-screen; right side may crop slightly.
      const next = ah / CAT_STAGE_H;
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
