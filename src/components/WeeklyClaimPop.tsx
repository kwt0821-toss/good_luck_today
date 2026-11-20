import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useBackHandler } from "../hooks/useBackHandler";
import type { WeeklyCelebrate } from "../lib/weeklySync";
import "./InvitePopups.css";

type Props = {
  view: WeeklyCelebrate;
  onClose: () => void;
};

export function WeeklyClaimPop({ view, onClose }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useBackHandler(true, onClose, 70);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);
  return createPortal(
    <div className="invite-pop is-gift">
      <button type="button" className="invite-pop-dim" aria-label="닫기" onClick={onClose} />
      <div className="invite-pop-card" role="dialog" aria-modal="true" aria-labelledby="weekly-claim-title">
        <button type="button" className="invite-pop-x" aria-label="닫기" onClick={onClose}>
          ×
        </button>
        <img src="/assets/weekly/claim-cat.webp" alt="" />
        <p className="invite-pop-eye">{view.past ? "지난 주" : "주간 미션"}</p>
        <h2 id="weekly-claim-title">{view.title}</h2>
        <div className="invite-pop-pills">
          {view.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <button ref={buttonRef} type="button" className="invite-pop-go" onClick={onClose}>
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}
