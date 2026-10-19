import { graniteEvent } from "@apps-in-toss/web-framework";
import { useEffect, useRef } from "react";

type BackEntry = {
  id: number;
  priority: number;
  run: () => void;
};

const stack: BackEntry[] = [];
let seq = 1;
let listening = false;

function isTossWebView(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as Window & { ReactNativeWebView?: unknown };
  return host.ReactNativeWebView != null;
}

function ensureTossListener() {
  if (listening || !isTossWebView()) return;
  listening = true;
  try {
    graniteEvent.addEventListener("backEvent", {
      onEvent: () => dispatchAppBack(),
      onError: (error) => {
        console.error("backEvent error", error);
      },
    });
  } catch {
    listening = false;
  }
}

/** Highest priority wins. Same priority: the latest registration. */
export function dispatchAppBack() {
  if (stack.length === 0) return;
  let best = stack[0];
  for (const entry of stack) {
    if (entry.priority > best.priority || (entry.priority === best.priority && entry.id > best.id)) {
      best = entry;
    }
  }
  best.run();
}

/**
 * Handle Toss nav back (and the dev back button) while `active`.
 * Nested sheets should use a higher priority so they close before the screen leaves.
 */
export function useBackHandler(active: boolean, onBack: () => void, priority = 0) {
  const ref = useRef(onBack);
  ref.current = onBack;

  useEffect(() => {
    if (!active) return;
    ensureTossListener();
    const id = seq++;
    stack.push({ id, priority, run: () => ref.current() });
    return () => {
      const index = stack.findIndex((entry) => entry.id === id);
      if (index >= 0) stack.splice(index, 1);
    };
  }, [active, priority]);
}
