import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { CoachMark, FeatureIntro } from "../lib/opsTypes";
import "./TutorialCoach.css";

const SKIP_TOP_ZONE_PT = 160;
const BUBBLE_GAP = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 20;
const NCOIN_ICON = "/assets/ncoin/ncoin-16@3x.svg";
const PAW_ICON = "/assets/menu/icon-paw-mini.svg";

/** Inline 냥코인 / 발바닥 포인트 icons wherever those words appear. */
function TutorialRichText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const re = /(냥코인|발바닥 포인트)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<span key={`t-${key++}`}>{text.slice(last, match.index)}</span>);
    }
    const token = match[1];
    nodes.push(
      <span key={`i-${key++}`} className="tut-inline-token">
        <img src={token === "냥코인" ? NCOIN_ICON : PAW_ICON} alt="" />
        {token}
      </span>,
    );
    last = match.index + token.length;
  }
  if (last < text.length) {
    nodes.push(<span key={`t-${key++}`}>{text.slice(last)}</span>);
  }
  return <>{nodes}</>;
}

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

  // Raise pass-through / activate targets above the tut overlay (WebView-safe).
  // Retry until the target mounts (e.g. room drawer after load).
  useEffect(() => {
    if (!mark?.target) return;
    if (!mark.passThrough && !mark.activateTarget) return;
    let elevated: HTMLElement | null = null;
    let panel: HTMLElement | null = null;
    let cancelled = false;
    let timer = 0;

    const tryElevate = () => {
      if (cancelled) return;
      try {
        elevated = document.querySelector(mark.target) as HTMLElement | null;
        panel = elevated?.closest(
          ".menu-root, .lucky-drawer, .main-screen, .home-screen, .lucky-room",
        ) as HTMLElement | null;
      } catch {
        elevated = null;
        panel = null;
      }
      if (!elevated) {
        timer = window.setTimeout(tryElevate, 100);
        return;
      }
      elevated.classList.add("tut-elevated-target");
      panel?.classList.add("tut-elevated-panel");
    };
    tryElevate();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      elevated?.classList.remove("tut-elevated-target");
      panel?.classList.remove("tut-elevated-panel");
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

  const hasHole = Boolean(mark?.target && rect);
  const blockOutside = Boolean(mark && hasHole && mark.dim !== false);
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
  const frameW = frame.width || window.innerWidth;
  const frameH = frame.height || window.innerHeight;

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
    let rawTop = placeAbove
      ? hole.top - BUBBLE_GAP - bubbleH
      : hole.top + hole.height + BUBBLE_GAP;
    // Room tutorial: keep copy in the stage above the bottom sheet, not on ITEMS chrome.
    try {
      const drawer = document.querySelector(".lucky-drawer");
      if (drawer) {
        const drawerTop = drawer.getBoundingClientRect().top - frame.top;
        const aboveDrawer = drawerTop - BUBBLE_GAP - bubbleH;
        if (aboveDrawer >= PAD_TOP) rawTop = aboveDrawer;
      }
    } catch {
      // ignore
    }
    return {
      top: Math.min(maxTop, Math.max(PAD_TOP, rawTop)),
      above: placeAbove,
    };
  }, [mark, hole, measuredBubbleH, frame]);

  if (!mark) return null;

  // CTA only when provided, or for tap-to-advance marks (not ack/activate gates).
  const showCta = mark.cta != null || (!mark.ackOnly && !mark.activateTarget);
  const ctaLabel = mark.cta ?? "다음";
  const showFinger =
    mark.showFinger === true ||
    (mark.showFinger !== false && !mark.ackOnly && !mark.lines?.length);
  const hasBubbleContent = Boolean(
    mark.stepLabel ||
      mark.title ||
      mark.copy ||
      mark.sub ||
      mark.lines?.length ||
      showCta ||
      (skipInline && !mark.hideSkip),
  );

  const activateOrAdvance = () => {
    if (mark.activateTarget && mark.target) {
      try {
        const el = document.querySelector(mark.target) as HTMLElement | null;
        el?.click();
      } catch {
        // ignore invalid selector
      }
      return;
    }
    if (!mark.ackOnly) onAdvance();
  };

  return (
    <>
      {/* Dim/hole stay under elevated pass-through targets (z≈130). */}
      <div className="tut-layer" role="presentation" aria-hidden="true">
        {/* When a hole exists, dim via hole box-shadow; pads block taps outside the cutout.
            Skip full dim while waiting for a pass-through/activate target (avoids freezing UI). */}
        {hasHole ||
        mark.dim === false ||
        ((mark.passThrough || mark.activateTarget) && !hasHole) ? null : (
          <div
            className="tut-dim"
            onClick={() => {
              if (!mark.ackOnly && !mark.activateTarget) onAdvance();
            }}
          />
        )}
        {blockOutside ? (
          <>
            <div className="tut-block" style={{ left: 0, top: 0, width: frameW, height: Math.max(0, hole.top) }} />
            <div
              className="tut-block"
              style={{ left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height }}
            />
            <div
              className="tut-block"
              style={{
                left: hole.left + hole.width,
                top: hole.top,
                width: Math.max(0, frameW - hole.left - hole.width),
                height: hole.height,
              }}
            />
            <div
              className="tut-block"
              style={{
                left: 0,
                top: hole.top + hole.height,
                width: frameW,
                height: Math.max(0, frameH - hole.top - hole.height),
              }}
            />
          </>
        ) : null}
        {hasHole ? (
          <div
            className={`tut-hole ${mark.activateTarget ? "is-activate" : ""} ${mark.passThrough ? "is-pass" : ""}`}
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.width,
              height: hole.height,
            }}
            onClick={mark.passThrough ? undefined : activateOrAdvance}
          />
        ) : null}
      </div>
      {/* Chrome above elevated panels so room-drawer (z=130) cannot cover copy/skip. */}
      <div className="tut-chrome" role="dialog" aria-modal="true" aria-label="튜토리얼">
        {!skipInline && !mark.hideSkip ? (
          <button type="button" className="tut-skip" id="tut-skip" onClick={onSkip}>
            건너뛰기
          </button>
        ) : null}
        {hasBubbleContent ? (
          <div
            ref={setBubbleEl}
            className={`tut-bubble ${bubbleLayout.above ? "is-above" : "is-below"} ${hasHole ? "" : "is-centered"}`}
            style={
              hasHole
                ? { top: bubbleLayout.top, left: 24, right: 24 }
                : { top: "40%", left: 24, right: 24, transform: "translateY(-50%)" }
            }
          >
            {mark.stepLabel ? <p className="tut-step-label">{mark.stepLabel}</p> : null}
            {mark.title ? (
              <p className="tut-title">
                <TutorialRichText text={mark.title} />
              </p>
            ) : null}
            {mark.copy ? (
              <p className="tut-copy">
                <TutorialRichText text={mark.copy} />
              </p>
            ) : null}
            {mark.sub ? (
              <p className="tut-sub">
                <TutorialRichText text={mark.sub} />
              </p>
            ) : null}
            {mark.lines?.length ? (
              <ul
                className={`tut-lines ${
                  mark.lines.every((line) => /^x\s*\d+/i.test(line.text.trim())) ? "is-rewards" : ""
                }`}
              >
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
                    <span>
                      <TutorialRichText text={line.text} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {showCta || skipInline ? (
              <div className={`tut-actions ${skipInline ? "has-skip" : ""}`}>
                {skipInline ? (
                  <button type="button" className="tut-skip-inline" id="tut-skip" onClick={onSkip}>
                    건너뛰기
                  </button>
                ) : (
                  <span />
                )}
                {showCta ? (
                  <button type="button" className="tut-next" onClick={onAdvance}>
                    {ctaLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {showFinger && hasHole ? (
          <div
            className="tut-finger"
            style={{ left: hole.left + hole.width / 2, top: hole.top + hole.height / 2 }}
            aria-hidden="true"
          >
            👆
          </div>
        ) : null}
      </div>
    </>
  );
}

function estimateBubbleHeight(mark: CoachMark) {
  let h = 72;
  if (mark.title) h += 28;
  if (mark.copy) h += 28 * Math.max(1, mark.copy.split("\n").length);
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
