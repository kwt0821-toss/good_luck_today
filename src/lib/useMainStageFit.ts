import { useEffect, useState, type RefObject } from "react";

/** Design frame from main-screen layout-spec / mockup. */
export const MAIN_STAGE_W = 390;
export const MAIN_STAGE_H = 844;

/**
 * Fit a 390×844 stage into the shell's content box (safe-area already padded).
 * Uses visualViewport-driven resize; scale never exceeds 1 (시안은 줄이기만).
 */
export function useMainStageFit(shellRef: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const update = () => {
      const aw = el.clientWidth;
      const ah = el.clientHeight;
      if (aw <= 0 || ah <= 0) return;
      const next = Math.min(aw / MAIN_STAGE_W, ah / MAIN_STAGE_H, 1);
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
  }, [shellRef]);

  return scale;
}
