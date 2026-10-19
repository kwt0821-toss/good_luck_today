import { getNetworkStatus } from "@apps-in-toss/web-framework";

const PROBE_TIMEOUT_MS = 3000;

/**
 * True when the device cannot reach the network.
 * Prefers Toss `getNetworkStatus` (OFFLINE). Outside the Toss webview,
 * `navigator.onLine === false` means offline. A reported-online device
 * still has to answer one cache-less request within 3 seconds.
 */
export async function isOffline(): Promise<boolean> {
  if (await reportedOffline()) return true;
  return !(await probeReachable());
}

async function reportedOffline(): Promise<boolean> {
  if (typeof getNetworkStatus === "function") {
    try {
      const status = await getNetworkStatus();
      if (status === "OFFLINE") return true;
      return false;
    } catch {
      // Not inside the Toss webview — fall through to the browser signal.
    }
  }
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function probeReachable(): Promise<boolean> {
  if (typeof fetch !== "function") return true;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${window.location.origin}/?net=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
