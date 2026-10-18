import { graniteEvent, Screen } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

import { ExitConfirmModal } from "../components/ExitConfirmModal";

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
    } catch (error) {
      // Browser preview has no Toss webview. The listener still no-ops after this.
      console.error("backEvent error", error);
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
