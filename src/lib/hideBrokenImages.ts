import { useEffect, type RefObject } from "react";

/** A failed <img> stays in layout but draws nothing, instead of a broken-image icon. */
export function useHideBrokenImages(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const hide = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) || !root.contains(target)) return;
      target.style.visibility = "hidden";
    };
    const show = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) || !root.contains(target)) return;
      target.style.visibility = "";
    };
    root.addEventListener("error", hide, true);
    root.addEventListener("load", show, true);
    return () => {
      root.removeEventListener("error", hide, true);
      root.removeEventListener("load", show, true);
    };
  }, [ref]);
}
