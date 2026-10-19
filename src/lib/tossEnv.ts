/** True inside the Toss app webview. Browser dev and sandbox previews stay false. */
export function isTossApp(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as Window & { ReactNativeWebView?: unknown };
  return host.ReactNativeWebView != null;
}
