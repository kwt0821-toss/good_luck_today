import { useEffect, useState } from "react";

import type { FeatureIntro, TutorialStep } from "../lib/opsTypes";
import "./TutorialCoach.css";

type TutorialCoachProps = {
  step: TutorialStep | null;
  onSkip: () => void;
  onAdvance: () => void;
};

export function TutorialCoach({ step, onSkip, onAdvance }: TutorialCoachProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(step.target);
      setRect(el?.getBoundingClientRect() ?? null);
    };
    measure();
    const timer = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  if (!step) return null;

  const hole = rect
    ? {
        left: Math.max(8, rect.left - 10),
        top: Math.max(8, rect.top - 10),
        width: rect.width + 20,
        height: rect.height + 20,
      }
    : { left: 40, top: 220, width: 310, height: 220 };

  return (
    <div className="tut-layer" role="dialog" aria-modal="true" aria-label="튜토리얼">
      <div className="tut-dim" onClick={onAdvance} />
      <div
        className="tut-hole"
        style={{
          left: hole.left,
          top: hole.top,
          width: hole.width,
          height: hole.height,
        }}
        onClick={onAdvance}
      />
      <button type="button" className="tut-skip" id="tut-skip" onClick={onSkip}>
        건너뛰기
      </button>
      <div
        className="tut-bubble"
        style={{
          top: Math.min(window.innerHeight - 140, hole.top + hole.height + 12),
          left: 24,
          right: 24,
        }}
      >
        <p className="tut-copy">{step.copy}</p>
        {step.sub ? <p className="tut-sub">{step.sub}</p> : null}
        <button type="button" className="tut-next" onClick={onAdvance}>
          다음
        </button>
      </div>
      <div className="tut-finger" style={{ left: hole.left + hole.width / 2, top: hole.top + hole.height / 2 }} aria-hidden="true">
        👆
      </div>
    </div>
  );
}

type FeatureIntroBubbleProps = {
  intro: FeatureIntro;
  onDismiss: () => void;
};

export function FeatureIntroBubble({ intro, onDismiss }: FeatureIntroBubbleProps) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const el = document.querySelector(intro.target);
    const rect = el?.getBoundingClientRect();
    if (!rect) {
      setPos({ left: 24, top: 120 });
      return;
    }
    setPos({ left: Math.min(window.innerWidth - 260, Math.max(16, rect.left)), top: rect.bottom + 8 });
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
