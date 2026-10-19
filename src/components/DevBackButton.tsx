import { useEffect } from "react";

import { dispatchAppBack } from "../hooks/useBackHandler";
import "./DevBackButton.css";

function isTossWebView(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as Window & { ReactNativeWebView?: unknown };
  return host.ReactNativeWebView != null;
}

/** Browser preview only. The Toss nav bar already has the back button. */
export function DevBackButton() {
  const show = import.meta.env.DEV && !isTossWebView();
  useEffect(() => {
    if (!show) return;
    const root = document.getElementById("root");
    root?.classList.add("has-dev-back");
    return () => root?.classList.remove("has-dev-back");
  }, [show]);
  if (!show) return null;
  return (
    <button type="button" className="dev-back" aria-label="뒤로 가기" onClick={() => dispatchAppBack()}>
      ‹
    </button>
  );
}
