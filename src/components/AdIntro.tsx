import { createPortal } from "react-dom";

import { useBackHandler } from "../hooks/useBackHandler";
import "./AdIntro.css";

type AdIntroProps = {
  open: boolean;
  /** "잠시 후 짧은 광고가 나와요" / "잠시 후 30초 광고가 나와요" */
  headline: string;
  /** What the user receives if they watch the ad through. */
  detail: string;
  onCancel: () => void;
};

/**
 * Small dream-loading card shown for 1.5s before a rewarded ad.
 * The parent starts the ad when the timer ends. 취소 leaves without an ad.
 */
export function AdIntro({ open, headline, detail, onCancel }: AdIntroProps) {
  useBackHandler(open, onCancel, 28);

  if (!open) return null;

  return createPortal(
    <div className="ai-overlay" role="dialog" aria-modal="true" aria-labelledby="ad-intro-title">
      <div className="ai-card">
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
        <div className="ai-stage" aria-hidden="true">
          <span className="ai-tw ai-tw-a">✦</span>
          <span className="ai-tw ai-tw-b">✧</span>
          <img className="ai-moon" src="/assets/loading/loading-moon.webp" alt="" draggable={false} />
        </div>
        <div className="ai-track" aria-hidden="true">
          <div className="ai-fill" />
        </div>
        <button type="button" className="ai-cancel" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>,
    document.body,
  );
}
