import { useEffect, useRef, useState } from "react";

import "./ExitConfirmModal.css";

const ASSET_BASE = "/assets/exit";

export type ExitConfirmModalProps = {
  open: boolean;
  /** "더 놀래", backdrop tap, or Escape: close the modal and keep playing. */
  onStay: () => void;
  /** "종료하기": the caller closes the mini-app (closeView()). */
  onExit: () => void;
};

const TWINKLES: Array<{ x: number; y: number; s: number; d: number }> = [
  { x: 18, y: 16, s: 10, d: 0 },
  { x: 120, y: 10, s: 8, d: 0.6 },
  { x: 226, y: 96, s: 9, d: 1.1 },
  { x: 16, y: 110, s: 9, d: 0.3 },
  { x: 204, y: 130, s: 8, d: 1.4 },
];

export function ExitConfirmModal({ open, onStay, onExit }: ExitConfirmModalProps) {
  const [catLoaded, setCatLoaded] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    stayRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onStay]);

  if (!open) return null;

  return (
    <div className="ex-overlay" onClick={onStay}>
      <div
        className="ex-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ex-title"
        aria-describedby="ex-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="ex-ears" viewBox="0 0 292 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M40 40 L58 6 Q62 0 67 6 L92 40" />
          <path d="M200 40 L225 6 Q230 0 234 6 L252 40" />
          <path className="ex-ear-in" d="M54 38 L62 16 L76 38" />
          <path className="ex-ear-in" d="M216 38 L230 16 L238 38" />
        </svg>
        <span className="ex-corner tl" aria-hidden="true">✦</span>
        <span className="ex-corner tr" aria-hidden="true">✦</span>
        <span className="ex-corner bl" aria-hidden="true">✧</span>
        <span className="ex-corner br" aria-hidden="true">✧</span>

        <div id="ex-title" className="ex-title">벌써 가는 거냥?</div>

        <div className="ex-stage" aria-hidden="true">
          {TWINKLES.map((t, i) => (
            <span key={i} className="ex-tw" style={{ left: t.x, top: t.y, fontSize: t.s, animationDelay: `${t.d}s` }}>
              ✦
            </span>
          ))}
          <div className="ex-catbox">
            <img
              className={`ex-cat ${catLoaded ? "is-loaded" : ""}`}
              src={`${ASSET_BASE}/exit-cat-a.webp`}
              srcSet={`${ASSET_BASE}/exit-cat-a.webp 1x, ${ASSET_BASE}/exit-cat-a@2x.webp 2x`}
              width={140}
              height={140}
              alt=""
              draggable={false}
              decoding="async"
              onLoad={() => setCatLoaded(true)}
            />
            <span className="ex-drip" />
          </div>
          <span className="ex-sob">훌쩍...</span>
        </div>

        <div id="ex-desc">
          <div className="ex-text">조금만 더 놀다 가면 안 될까냥?</div>
          <div className="ex-sub">행운냥을 종료할까요?</div>
        </div>

        <div className="ex-btns">
          <button type="button" className="ex-btn is-exit" onClick={onExit}>
            종료하기
          </button>
          <button ref={stayRef} type="button" className="ex-btn is-stay" onClick={onStay}>
            더 놀래
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExitConfirmModal;
