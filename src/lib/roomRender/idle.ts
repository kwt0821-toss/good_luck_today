/** Run once the main thread is idle, or after `timeout` ms if idle never comes. */
export function scheduleIdle(run: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, timeout);
  return () => window.clearTimeout(id);
}
