import { dispatchAppBack } from "../hooks/useBackHandler";
import "./DevBackButton.css";

function isTossWebView(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as Window & { ReactNativeWebView?: unknown };
  return host.ReactNativeWebView != null;
}

/** Browser preview only. The Toss nav bar already has the back button. */
export function DevBackButton() {
  if (!import.meta.env.DEV || isTossWebView()) return null;
  return (
    <button type="button" className="dev-back" aria-label="뒤로 가기" onClick={() => dispatchAppBack()}>
      ‹
    </button>
  );
}
