import { SafeArea, type SafeAreaInsets } from "@apps-in-toss/web-framework";
import { useEffect, useState } from "react";

import { isInTossApp } from "./native";

const ZERO: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function readInsets(): SafeAreaInsets {
  if (!isInTossApp()) return ZERO;
  try {
    const next = SafeArea.get();
    return {
      top: Number(next?.top) || 0,
      right: Number(next?.right) || 0,
      bottom: Number(next?.bottom) || 0,
      left: Number(next?.left) || 0,
    };
  } catch {
    return ZERO;
  }
}

/** Push Toss SafeArea insets onto :root as --toss-inset-* (px). */
function applyCssVars(insets: SafeAreaInsets) {
  const root = document.documentElement;
  root.style.setProperty("--toss-inset-top", `${insets.top}px`);
  root.style.setProperty("--toss-inset-right", `${insets.right}px`);
  root.style.setProperty("--toss-inset-bottom", `${insets.bottom}px`);
  root.style.setProperty("--toss-inset-left", `${insets.left}px`);
}

/**
 * Sync Apps-in-Toss SafeAreaInsets into CSS variables.
 * Opaque NavigationBar: webview already starts below the title bar — use
 * bottom/left/right for home-indicator; do not pad the main header with top.
 * @see https://developers-apps-in-toss.toss.im/documentation/common/screen/safe-area
 */
export function useTossSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(() => {
    const initial = readInsets();
    if (typeof document !== "undefined") applyCssVars(initial);
    return initial;
  });

  useEffect(() => {
    const initial = readInsets();
    applyCssVars(initial);
    setInsets(initial);

    if (!isInTossApp()) return;
    try {
      return SafeArea.subscribe({
        onEvent: (next) => {
          const normalized = {
            top: Number(next?.top) || 0,
            right: Number(next?.right) || 0,
            bottom: Number(next?.bottom) || 0,
            left: Number(next?.left) || 0,
          };
          applyCssVars(normalized);
          setInsets(normalized);
        },
      });
    } catch {
      return undefined;
    }
  }, []);

  return insets;
}
