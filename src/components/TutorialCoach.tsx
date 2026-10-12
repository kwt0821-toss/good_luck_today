import { useEffect, useMemo, useState } from "react";

import type { CoachMark, FeatureIntro } from "../lib/opsTypes";
import "./TutorialCoach.css";

const SKIP_TOP_ZONE_PT = 160;
const BUBBLE_GAP = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 20;

type TutorialCoachProps = {
  mark: CoachMark | null;
  onSkip: () => void;
  onAdvance: () => void;
};

function rectsOverlap(a: DOMRect, b: { left: number; top: number; width: number; height: number }) {
  return !(
    a.right < b.left ||
    a.left > b.left + b.width ||
    a.bottom < b.top ||
    a.top > b.top + b.height
  );
}

/** Fixed containing block for tutor layer (#root when it has transform). */
function fixedFrameRect(): DOMRect {
  const root = document.getElementById("root");
  if (root) return root.getBoundingClientRect();
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

export function TutorialCoach({ mark, onSkip, onAdvance }: TutorialCoachProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [frame, setFrame] = useState<DOMRect>(() =>
    typeof document === "undefined" ? new DOMRect(0, 0, 390, 844) : fixedFrameRect(),
  );
  const [bubbleEl, setBubbleEl] = useState<HTMLDivElement | null>(null);
  const [measuredBubbleH, setMeasuredBubbleH] = useState(0);

  useEffect(() => {
    if (!mark) {
      setRect(null);
      return;
    }
    const measure = () => {
      setFrame(fixedFrameRect());
      if (!mark.target) {
        setRect(null);
        return;
      }
      try {
        const el = document.querySelector(mark.target);
        setRect(el?.getBoundingClientRect() ?? null);
      } catch {
        setRect(null);
      }
    };
    measure();
    const timer = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [mark]);

  useEffect(() => {
    if (!bubbleEl) {
      setMeasuredBubbleH(0);
      return;
    }
    const update = () => setMeasuredBubbleH(bubbleEl.getBoundingClientRect().height);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(bubbleEl);
    return () => ro?.disconnect();
  }, [bubbleEl, mark]);

  const hole = useMemo(() => {
    // Convert viewport rects → fixed-containing-block coords (#root on desktop).
    if (!rect) {
      return { left: 40, top: 220, width: 310, height: 220 };
    }
    return {
      left: Math.max(8, rect.left - frame.left - 10),
      top: Math.max(8, rect.top - frame.top - 10),
      width: rect.width + 20,
      height: rect.height + 20,
    };
  }, [rect, frame]);

  const skipInline = useMemo(() => {
    if (!rect) return false;
    // Skip zone is in viewport / frame-local top.
    const targetTopInFrame = rect.top - frame.top;
    if (targetTopInFrame < SKIP_TOP_ZONE_PT) return true;
    const skipApprox = {
      left: frame.width - 110,
      top: 52,
      width: 96,
      height: 40,
    };
    const local = new DOMRect(rect.left - frame.left, rect.top - frame.top, rect.width, rect.height);
    return rectsOverlap(local, skipApprox);
  }, [rect, frame]);

  const bubbleLayout = useMemo(() => {
    if (!mark) return { top: PAD_TOP, above: false };
    const bubbleH = measuredBubbleH || estimateBubbleHeight(mark);
    const viewH = frame.height || window.innerHeight;
    const maxTop = Math.max(PAD_TOP, viewH - PAD_BOTTOM - bubbleH);
    const spaceBelow = viewH - (hole.top + hole.height) - PAD_BOTTOM;
    const spaceAbove = hole.top - PAD_TOP;
    const preferAbove = mark.bubble === "above";
    const placeAbove =
      preferAbove ||
      (spaceBelow < bubbleH + BUBBLE_GAP && spaceAbove >= Math.min(bubbleH + BUBBLE_GAP, spaceBelow));
    const rawTop = placeAbove
      ? hole.top - BUBBLE_GAP - bubbleH
      : hole.top + hole.height + BUBBLE_GAP;
    return {
      top: Math.min(maxTop, Math.max(PAD_TOP, rawTop)),
      above: placeAbove,
    };
  }, [mark, hole, measuredBubbleH, frame.height]);

  if (!mark) return null;

  const ctaLabel = mark.cta ?? (mark.ackOnly ? "알겠어요" : "다음");
  const showFinger = mark.showFinger !== false && !mark.ackOnly && !mark.lines?.length;

  return (
    <div className="tut-layer" role="dialog" aria-modal="true" aria-label="튜토리얼">
      <div
        className="tut-dim"
        onClick={() => {
          if (!mark.ackOnly) onAdvance();
        }}
      />
      <div
        className="tut-hole"
        style={{
          left: hole.left,
          top: hole.top,
          width: hole.width,
          height: hole.height,
        }}
        onClick={() => {
          if (!mark.ackOnly) onAdvance();
        }}
      />
      {!skipInline ? (
        <button type="button" className="tut-skip" id="tut-skip" onClick={onSkip}>
          건너뛰기
        </button>
      ) : null}
      <div
        ref={setBubbleEl}
        className={`tut-bubble ${bubbleLayout.above ? "is-above" : "is-below"}`}
        style={{ top: bubbleLayout.top, left: 24, right: 24 }}
      >
        {mark.title ? <p className="tut-title">{mark.title}</p> : null}
        {mark.copy ? <p className="tut-copy">{mark.copy}</p> : null}
        {mark.sub ? <p className="tut-sub">{mark.sub}</p> : null}
        {mark.lines?.length ? (
          <ul className="tut-lines">
            {mark.lines.map((line, index) => (
              <li
                key={`${line.text}-${index}`}
                className={`tut-line ${line.muted ? "is-muted" : ""} ${line.dividerAbove ? "has-divider" : ""}`}
              >
                {line.icon ? (
                  <img className="tut-line-icon" src={line.icon} alt="" width={18} height={18} />
                ) : (
                  <span className="tut-line-icon is-empty" />
                )}
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={`tut-actions ${skipInline ? "has-skip" : ""}`}>
          {skipInline ? (
            <button type="button" className="tut-skip-inline" id="tut-skip" onClick={onSkip}>
              건너뛰기
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="tut-next" onClick={onAdvance}>
            {ctaLabel}
          </button>
        </div>
      </div>
      {showFinger ? (
        <div
          className="tut-finger"
          style={{ left: hole.left + hole.width / 2, top: hole.top + hole.height / 2 }}
          aria-hidden="true"
        >
          👆
        </div>
      ) : null}
    </div>
  );
}

function estimateBubbleHeight(mark: CoachMark) {
  let h = 72;
  if (mark.title) h += 28;
  if (mark.copy) h += 28;
  if (mark.sub) h += 22;
  if (mark.lines?.length) h += mark.lines.length * 28 + 12;
  return h;
}

type FeatureIntroBubbleProps = {
  intro: FeatureIntro;
  onDismiss: () => void;
};

export function FeatureIntroBubble({ intro, onDismiss }: FeatureIntroBubbleProps) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const el = document.querySelector(intro.target);
    const next = el?.getBoundingClientRect();
    const frame = fixedFrameRect();
    if (!next) {
      setPos({ left: 24, top: 120 });
      return;
    }
    setPos({
      left: Math.min(frame.width - 260, Math.max(16, next.left - frame.left)),
      top: next.bottom - frame.top + 8,
    });
  }, [intro]);

  if (!pos) return null;

  return (
    <button
      type="button"
      className="feature-intro"
      style={{ left: pos.left, top: pos.top }}
      onClick={onDismiss}
    >
      <strong>새 기능</strong>
      <span>{intro.copy}</span>
    </button>
  );
}
