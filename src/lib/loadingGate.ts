import { useEffect, useState } from "react";

type Hold = {
  progress?: number;
  messages?: string[];
};

const holds = new Map<string, Hold>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
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
  for (const hold of holds.values()) {
    if (progress == null && typeof hold.progress === "number") progress = hold.progress;
    if (!messages && hold.messages?.length) messages = hold.messages;
  }
  return { open: holds.size > 0, progress, messages };
}

/** Register one in-flight task. The shared loading window stays mounted above the app. */
export function useLoadingHold(id: string, open: boolean, progress?: number, messages?: string[]) {
  useEffect(() => {
    setLoadingHold(id, open, { progress, messages });
  }, [id, open, progress, messages]);

  useEffect(() => () => setLoadingHold(id, false), [id]);
}
