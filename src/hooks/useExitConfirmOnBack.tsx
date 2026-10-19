import { Screen } from "@apps-in-toss/web-framework";
import { useEffect, useState } from "react";

import { ExitConfirmModal } from "../components/ExitConfirmModal";
import { useBackHandler } from "./useBackHandler";

/**
 * First screen only: Toss back opens ExitConfirmModal.
 * Back while the modal is open closes it ("더 놀래").
 * The nav-bar X is not intercepted.
 */
export function useExitConfirmOnBack(isHomeScreen: boolean) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isHomeScreen) setOpen(false);
  }, [isHomeScreen]);

  useBackHandler(isHomeScreen && !open, () => setOpen(true), 0);
  useBackHandler(isHomeScreen && open, () => setOpen(false), 80);

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
