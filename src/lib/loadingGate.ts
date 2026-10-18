import { useEffect, useState } from "react";

type Hold = {
  progress?: number;
  messages?: string[];
  /** Skip the 300ms delay and show the window immediately. */
  eager?: boolean;
};

const holds = new Map<string, Hold>();
const listeners = new Set<() => void>();
/** While a tutorial is on screen, the dream window must not cover its copy. */
let blocked = false;

function emit() {
  listeners.forEach((listener) => listener());
}

/** Hide the shared loading window immediately and ignore new holds until cleared. */
export function setLoadingBlocked(next: boolean) {
  if (blocked === next) return;
  blocked = next;
  emit();
}

export function setLoadingHold(id: string, open: boolean, extra?: Hold) {
  if (!open) {
    if (!holds.has(id)) return;
    holds.delete(id);
    emit();
    return;
  }
  holds.set(id, extra ?? {});
  emit();
}

export function useLoadingHoldSnapshot() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((n) => n + 1);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  void version;
  let progress: number | undefined;
  let messages: string[] | undefined;
  let eager = false;
  for (const hold of holds.values()) {
    if (progress == null && typeof hold.progress === "number") progress = hold.progress;
    if (!messages && hold.messages?.length) messages = hold.messages;
    if (hold.eager) eager = true;
  }
  return {
    open: holds.size > 0 && !blocked,
    progress,
    messages,
    eager,
    /** Drop a window that is already up, without waiting out the minimum time. */
    closeNow: blocked,
  };
}

let overlayVisible = false;
const overlayListeners = new Set<() => void>();

/** The dream window is actually on screen (after the show delay, until the minimum time ends). */
export function setOverlayVisible(next: boolean) {
  if (overlayVisible === next) return;
  overlayVisible = next;
  overlayListeners.forEach((listener) => listener());
}

export function useOverlayVisible() {
  const [value, setValue] = useState(overlayVisible);
  useEffect(() => {
    const listener = () => setValue(overlayVisible);
    overlayListeners.add(listener);
    listener();
    return () => {
      overlayListeners.delete(listener);
    };
  }, []);
  return value;
}

/** Register one in-flight task. The shared loading window stays mounted above the app. */
export function useLoadingHold(
  id: string,
  open: boolean,
  progress?: number,
  messages?: string[],
  eager = false,
) {
  useEffect(() => {
    setLoadingHold(id, open, { progress, messages, eager });
  }, [id, open, progress, messages, eager]);

  useEffect(() => () => setLoadingHold(id, false), [id]);
}
