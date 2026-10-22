import { useCallback, useEffect, useRef, useState } from "react";

import { shouldOfferAttendanceNotify } from "./attendanceNotify";

/**
 * Shows the attendance-notify card after a successful check-in.
 * While the tutorial, a replay, or the rewards intro is up, the offer waits.
 * One extra commit lets a rewards intro that starts in the same turn win.
 */
export function useAttendanceNotifyOffer(blocked: boolean) {
  const [open, setOpen] = useState(false);
  const pendingRef = useRef(false);
  const [armed, setArmed] = useState(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const offerAfterReward = useCallback(() => {
    if (!shouldOfferAttendanceNotify()) return;
    if (blockedRef.current) {
      pendingRef.current = true;
      return;
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!pendingRef.current) {
      if (armed) setArmed(false);
      return;
    }
    if (blocked) {
      if (armed) setArmed(false);
      return;
    }
    if (!armed) {
      setArmed(true);
      return;
    }
    pendingRef.current = false;
    setArmed(false);
    if (shouldOfferAttendanceNotify()) setOpen(true);
  }, [blocked, armed]);

  const dismiss = useCallback(() => setOpen(false), []);

  return { open, offerAfterReward, dismiss };
}
