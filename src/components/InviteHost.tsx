import { useEffect, useState } from "react";
import {
  bindInviteHost,
  captureInviteFromLaunch,
  inviteWelcomeDue,
  readInviteSnap,
  refreshInvite,
  subscribeInviteSnap,
  takeInviteWelcome,
  type InviterGiftView,
} from "../lib/invite";
import type { OpsState } from "../lib/opsTypes";
import { nyNotify } from "../lib/nyangNotify";
import { InviteWelcome, InviterGiftPopup } from "./InvitePopups";

type Props = {
  ops: OpsState;
  maxHold: number;
  canShowWelcome: boolean;
  onOpsChange: (next: OpsState) => void;
  onGoDraw: () => void;
};

export function InviteHost({ ops, maxHold, canShowWelcome, onOpsChange, onGoDraw }: Props) {
  const [welcome, setWelcome] = useState(false);
  const [snap, setSnap] = useState(readInviteSnap);
  const [welcomeTick, setWelcomeTick] = useState(0);
  const [gift, setGift] = useState<InviterGiftView | null>(null);

  bindInviteHost({
    getOps: () => ops,
    commit: onOpsChange,
    onWelcome: () => setWelcomeTick((value) => value + 1),
    onGift: setGift,
    onInvitee: (amount, tickets) => {
      nyNotify({
        key: "invite-invitee",
        kind: "success",
        title: "초대 선물을 받았어요",
        sub: tickets === 1 ? `젤리 ${amount} · 확률업 뽑기권 1장` : `젤리 ${amount}`,
      });
    },
    maxHold: () => maxHold,
  });

  useEffect(() => subscribeInviteSnap(setSnap), []);

  useEffect(() => {
    captureInviteFromLaunch();
    void refreshInvite("boot");
  }, []);

  const jelly = snap.phase === "ready" ? snap.status.rules.jelly : 150;

  useEffect(() => {
    if (ops.inviteWelcomeSeen) {
      if (inviteWelcomeDue()) takeInviteWelcome();
      return;
    }
    if (!canShowWelcome || !inviteWelcomeDue()) return;
    onOpsChange({ ...ops, inviteWelcomeSeen: true });
    setWelcome(true);
  }, [canShowWelcome, welcomeTick, ops, onOpsChange]);

  return (
    <>
      {welcome ? (
        <InviteWelcome
          jelly={jelly}
          onClose={() => setWelcome(false)}
          onDraw={() => {
            setWelcome(false);
            onGoDraw();
          }}
        />
      ) : null}
      {gift ? <InviterGiftPopup gift={gift} onClose={() => setGift(null)} /> : null}
    </>
  );
}
