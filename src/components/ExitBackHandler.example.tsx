// Example: show ExitConfirmModal when the Toss nav-bar back button (or Android system back)
// is pressed on the FIRST screen (home). Other screens keep their normal back behaviour.
// The Toss nav-bar X (close) button cannot be intercepted; Toss shows its own exit modal for it.
import { graniteEvent, Screen } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

import { ExitConfirmModal } from "./ExitConfirmModal";

export function useExitConfirmOnBack(isHomeScreen: boolean) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!isHomeScreen) return;
    const unsubscribe = graniteEvent.addEventListener("backEvent", {
      onEvent: () => {
        // Back while the modal is open = "더 놀래" (close the modal).
        setOpen(!openRef.current);
      },
      onError: (error) => {
        console.error("backEvent error", error);
      },
    });
    return unsubscribe;
  }, [isHomeScreen]);

  const modal = (
    <ExitConfirmModal
      open={open}
      onStay={() => setOpen(false)}
      onExit={() => {
        setOpen(false);
        // Save anything pending first if needed, then close the mini-app.
        // Screen.close() is the current name in @apps-in-toss/web-framework 3.7+;
        // closeView() (the name in the docs) still works but is marked @deprecated.
        void Screen.close();
      }}
    />
  );
  return { modal, openExitConfirm: () => setOpen(true) };
}

// Usage in the home screen component:
//   const { modal } = useExitConfirmOnBack(true);
//   return (<>{/* home UI */}{modal}</>);
