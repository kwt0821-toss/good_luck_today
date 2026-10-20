import { createPortal } from "react-dom";

import { useBackHandler } from "../hooks/useBackHandler";
import "./AdIntro.css";

type AdIntroProps = {
  open: boolean;
  /** "짧은 광고를 볼까요?" / "30초 광고를 볼까요?" */
  headline: string;
  /** What the user receives if they watch the ad through. */
  detail: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation sheet before a rewarded ad.
 * The ad starts only when the user taps [광고 보기].
 */
export function AdIntro({ open, headline, detail, onConfirm, onCancel }: AdIntroProps) {
  useBackHandler(open, onCancel, 28);

  if (!open) return null;

  return createPortal(
    <div
      className="ai-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="ai-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-intro-title"
        onClick={(event) => event.stopPropagation()}
      >
        <svg className="ai-ears" viewBox="0 0 240 32" preserveAspectRatio="none" aria-hidden="true">
          <path d="M28 32 L44 6 Q48 0 52 6 L72 32" />
          <path d="M168 32 L188 6 Q192 0 196 6 L212 32" />
          <path className="ai-ear-in" d="M40 30 L48 14 L58 30" />
          <path className="ai-ear-in" d="M182 30 L192 14 L200 30" />
        </svg>
        <span className="ai-corner tl" aria-hidden="true">
          ✦
        </span>
        <span className="ai-corner tr" aria-hidden="true">
          ✦
        </span>
        <span className="ai-badge">광고</span>
        <h2 id="ad-intro-title" className="ai-title">
          {headline}
        </h2>
        <p className="ai-detail">{detail}</p>
        <p className="ai-note">광고를 끝까지 보면 보상을 받아요. 중간에 닫으면 받지 못해요.</p>
        <div className="ai-stage" aria-hidden="true">
          <span className="ai-tw ai-tw-a">✦</span>
          <span className="ai-tw ai-tw-b">✧</span>
          <img className="ai-moon" src="/assets/loading/loading-moon.webp" alt="" draggable={false} />
        </div>
        <div className="ai-actions">
          <button type="button" className="ai-confirm" onClick={onConfirm}>
            광고 보기
          </button>
          <button type="button" className="ai-cancel" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
