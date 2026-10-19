import { graniteEvent, Screen } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

import { ExitConfirmModal } from "../components/ExitConfirmModal";

function isTossApp(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as Window & { ReactNativeWebView?: unknown };
  return host.ReactNativeWebView != null;
}

/**
 * First screen only: Toss back (nav back / Android system back) opens ExitConfirmModal.
 * Leaving the screen unsubscribes, so other screens keep the default back behaviour.
 * The nav-bar X is not intercepted.
 */
export function useExitConfirmOnBack(isHomeScreen: boolean) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!isHomeScreen) {
      setOpen(false);
      return;
    }
    if (!isTossApp()) return;

    let unsubscribe = () => {};
    try {
      unsubscribe = graniteEvent.addEventListener("backEvent", {
        onEvent: () => {
          // Back while the modal is open closes it ("더 놀래").
          setOpen(!openRef.current);
        },
        onError: (error) => {
          console.error("backEvent error", error);
        },
      });
    } catch {
      // Outside the Toss webview there is no back bridge.
    }

    return unsubscribe;
  }, [isHomeScreen]);

  const modal = (
    <ExitConfirmModal
      open={open}
      onStay={() => setOpen(false)}
      onExit={() => {
        setOpen(false);
        try {
          void Screen.close().catch((error) => {
            console.error("Screen.close error", error);
          });
        } catch (error) {
          console.error("Screen.close error", error);
        }
      }}
    />
  );

  return { modal, openExitConfirm: () => setOpen(true) };
}

/** Toss nav back / Android system back. Unsubscribes when `active` becomes false. */
export function useGraniteBack(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active || !isTossApp()) return;
    let unsubscribe = () => {};
    try {
      unsubscribe = graniteEvent.addEventListener("backEvent", {
        onEvent: () => onBackRef.current(),
        onError: (error) => {
          console.error("backEvent error", error);
        },
      });
    } catch {
      // Outside the Toss webview there is no back bridge.
    }
    return unsubscribe;
  }, [active]);
}
