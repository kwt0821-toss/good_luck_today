import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useBackHandler } from "../hooks/useBackHandler";
import { ncoinIcon } from "../lib/ncoinIcon";
import type { CoachMark, FeatureIntro } from "../lib/opsTypes";
import "./TutorialCoach.css";

const BUBBLE_GAP = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 20;
const FEATURE_PAD_TOP = 12;
const FEATURE_PAD_BOTTOM = 16;
const PAW_ICON = "/assets/menu/icon-paw-mini.svg";

/** Inline 냥코인 / 발바닥 젤리 icons wherever those words appear. */
function TutorialRichText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const re = /(냥코인|발바닥 젤리)/g;
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
        <img src={token === "냥코인" ? ncoinIcon(16) : PAW_ICON} alt="" />
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

/** Fixed containing block for tutor layer (#root when it has transform). */
function fixedFrameRect(): DOMRect {
  const root = document.getElementById("root");
  if (root) return root.getBoundingClientRect();
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

function safeAreaBottomPx(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sa-bottom").trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function TutorialCoach({ mark, onSkip, onAdvance }: TutorialCoachProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  /** Primary target rect — finger parks here (e.g. ✓), not the hole center. */
  const [fingerRect, setFingerRect] = useState<DOMRect | null>(null);
  const [frame, setFrame] = useState<DOMRect>(() =>
    typeof document === "undefined" ? new DOMRect(0, 0, 390, 844) : fixedFrameRect(),
  );
  const [bubbleEl, setBubbleEl] = useState<HTMLDivElement | null>(null);
  const [measuredBubbleH, setMeasuredBubbleH] = useState(0);

  useEffect(() => {
    if (!mark) {
      setRect(null);
      setFingerRect(null);
      return;
    }
    const measure = () => {
      setFrame(fixedFrameRect());
      if (!mark.target) {
        setRect(null);
        setFingerRect(null);
        return;
      }
      try {
        const els: Element[] = [];
        const primary = document.querySelector(mark.target);
        if (primary) {
          els.push(primary);
          const pr = primary.getBoundingClientRect();
          setFingerRect(pr.width > 0 || pr.height > 0 ? pr : null);
        } else {
          setFingerRect(null);
        }
        for (const sel of mark.alsoHighlight ?? []) {
          try {
            document.querySelectorAll(sel).forEach((node) => els.push(node));
          } catch {
            // ignore bad selectors
          }
        }
        if (!els.length) {
          setRect(null);
          return;
        }
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const node of els) {
          const r = node.getBoundingClientRect();
          if (r.width <= 0 && r.height <= 0) continue;
          left = Math.min(left, r.left);
          top = Math.min(top, r.top);
          right = Math.max(right, r.right);
          bottom = Math.max(bottom, r.bottom);
        }
        if (!Number.isFinite(left)) {
          setRect(null);
          return;
        }
        setRect(new DOMRect(left, top, right - left, bottom - top));
      } catch {
        setRect(null);
        setFingerRect(null);
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
    const elevatedNodes: HTMLElement[] = [];
    let panel: HTMLElement | null = null;
    let cancelled = false;
    let timer = 0;

    const elevateOne = (el: HTMLElement) => {
      el.classList.add("tut-elevated-target");
      if (getComputedStyle(el).position === "static") {
        el.classList.add("tut-elevated-static");
      }
      elevatedNodes.push(el);
    };

    const tryElevate = () => {
      if (cancelled) return;
      try {
        const primary = document.querySelector(mark.target) as HTMLElement | null;
        if (!primary) {
          timer = window.setTimeout(tryElevate, 100);
          return;
        }
        elevateOne(primary);
        for (const sel of mark.alsoHighlight ?? []) {
          try {
            document.querySelectorAll(sel).forEach((node) => elevateOne(node as HTMLElement));
          } catch {
            // ignore
          }
        }
        panel = primary.closest(
          ".menu-root, .lucky-drawer, #main, .main-screen, .home-screen, .lucky-room",
        ) as HTMLElement | null;
        panel?.classList.add("tut-elevated-panel");
      } catch {
        timer = window.setTimeout(tryElevate, 100);
      }
    };
    tryElevate();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      for (const el of elevatedNodes) {
        el.classList.remove("tut-elevated-target");
        el.classList.remove("tut-elevated-static");
      }
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

  const [skipAsk, setSkipAsk] = useState(false);
  useEffect(() => {
    setSkipAsk(false);
  }, [mark?.id]);
  // Toss back opens the skip confirm. A second press, while the sheet is open, stays in the tutorial.
  useBackHandler(Boolean(mark) && !skipAsk, () => setSkipAsk(true), 40);
  useBackHandler(Boolean(mark) && skipAsk, () => setSkipAsk(false), 60);

  const bubbleLayout = useMemo(() => {
    if (!mark) return { top: PAD_TOP, above: false, dockTop: false };
    if (mark.dock === "top") {
      return { top: 12, above: false, dockTop: true };
    }
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
    let above = placeAbove;
    // Room tutorial pick: park copy above the drawer so it doesn't sit on ITEMS chrome.
    // Never for stage targets like #placement-confirm — parking on the drawer covers
    // the preview item / "여기 놓을게요!" copy.
    const isStagePlacement =
      Boolean(mark.target) &&
      (mark.target.includes("placement-confirm") ||
        (mark.alsoHighlight ?? []).some(
          (sel) => sel.includes("placement-hud") || sel.includes("placement-toolbar"),
        ));
    try {
      const drawer = document.querySelector(".lucky-drawer");
      if (drawer && !isStagePlacement) {
        const drawerTop = drawer.getBoundingClientRect().top - frame.top;
        const holeNearDrawer = hole.top + hole.height >= drawerTop - 48;
        if (holeNearDrawer) {
          const aboveDrawer = drawerTop - BUBBLE_GAP - bubbleH;
          if (aboveDrawer >= PAD_TOP) {
            rawTop = aboveDrawer;
            above = true;
          }
        }
      }
    } catch {
      // ignore
    }
    return {
      top: Math.min(maxTop, Math.max(PAD_TOP, rawTop)),
      above,
      dockTop: false,
    };
  }, [mark, hole, measuredBubbleH, frame]);

  if (!mark) return null;

  // A highlighted control (cat, dex, coin, check) advances by itself. Other bubbles get [다음].
  const tapGate = Boolean((mark.passThrough || mark.activateTarget) && mark.cta == null);
  const showCta = !tapGate && (mark.cta != null || (!mark.ackOnly && !mark.activateTarget));
  const ctaLabel = mark.cta ?? "다음";
  const spoken = `${mark.title ?? ""} ${mark.copy ?? ""} ${mark.sub ?? ""} ${(mark.lines ?? []).map((line) => line.text).join(" ")}`;
  const tapHint = tapGate && !/누르/.test(spoken) ? "여기를 눌러 보세요" : null;
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
      tapHint ||
      !mark.hideSkip,
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
        {hasBubbleContent ? (
          <div
            ref={setBubbleEl}
            className={`tut-bubble ${bubbleLayout.dockTop ? "is-dock-top" : ""} ${bubbleLayout.above ? "is-above" : "is-below"} ${!hasHole && !bubbleLayout.dockTop ? "is-centered" : ""}`}
            style={
              bubbleLayout.dockTop
                ? { top: bubbleLayout.top, left: 16, right: 16 }
                : hasHole
                  ? { top: bubbleLayout.top, left: 24, right: 24 }
                  : { top: "40%", left: 24, right: 24, transform: "translateY(-50%)" }
            }
          >
            <div className="tut-bubble-head">
              {mark.stepLabel ? <p className="tut-step-label">{mark.stepLabel}</p> : <span />}
              {mark.hideSkip ? null : (
                <button type="button" className="tut-skip" id="tut-skip" onClick={() => setSkipAsk(true)}>
                  건너뛰기
                </button>
              )}
            </div>
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
                {mark.lines.map((line, index) => {
                  const rewardMatch = line.icon
                    ? /^x\s*(\d+)\s*$/i.exec(line.text.trim())
                    : null;
                  return (
                    <li
                      key={`${line.text}-${index}`}
                      className={`tut-line ${line.muted ? "is-muted" : ""} ${line.dividerAbove ? "has-divider" : ""} ${rewardMatch ? "is-reward-qty" : ""}`}
                    >
                      {line.icon ? (
                        <img className="tut-line-icon" src={line.icon} alt="" width={18} height={18} />
                      ) : (
                        <span className="tut-line-icon is-empty" />
                      )}
                      {/* Lines that already ship an icon skip inline token icons (no double paw/ncoin). */}
                      {rewardMatch ? (
                        <>
                          <span className="tut-line-x">x</span>
                          <span className="tut-line-qty">{rewardMatch[1]}</span>
                        </>
                      ) : (
                        <span>{line.icon ? line.text : <TutorialRichText text={line.text} />}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {tapHint ? <p className="tut-tap-hint">{tapHint}</p> : null}
            {showCta ? (
              <div className="tut-actions">
                <button type="button" className="tut-next" onClick={onAdvance}>
                  {ctaLabel}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {showFinger && hasHole ? (
          <div
            className="tut-finger"
            style={{
              left: fingerRect
                ? fingerRect.left - frame.left + fingerRect.width / 2
                : hole.left + hole.width / 2,
              top: fingerRect
                ? fingerRect.top - frame.top + fingerRect.height / 2
                : hole.top + hole.height / 2,
            }}
            aria-hidden="true"
          >
            👆
          </div>
        ) : null}
        {skipAsk ? (
          <div className="tut-skip-sheet" role="dialog" aria-modal="true" aria-labelledby="tut-skip-title">
            <button type="button" className="tut-skip-dim" aria-label="계속 보기" onClick={() => setSkipAsk(false)} />
            <div className="tut-skip-card">
              <h2 id="tut-skip-title">튜토리얼을 건너뛸까요?</h2>
              <p>건너뛰어도 첫 카드 뽑기는 무료로 남아요.</p>
              <div className="tut-skip-actions">
                <button type="button" className="tut-skip-go" onClick={onSkip}>
                  건너뛰기
                </button>
                <button type="button" className="tut-skip-stay" onClick={() => setSkipAsk(false)}>
                  계속 보기
                </button>
              </div>
            </div>
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
  if (mark.cta || mark.passThrough || mark.activateTarget) h += 64;
  return h;
}

type FeatureIntroBubbleProps = {
  intro: FeatureIntro;
  onDismiss: () => void;
};

export function FeatureIntroBubble({ intro, onDismiss }: FeatureIntroBubbleProps) {
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const frame = fixedFrameRect();
      const bubble = bubbleRef.current;
      const bubbleH = bubble?.offsetHeight ?? 76;
      const bubbleW = bubble?.offsetWidth ?? 220;
      const bottomLimit = frame.height - safeAreaBottomPx() - FEATURE_PAD_BOTTOM;
      const maxTop = Math.max(FEATURE_PAD_TOP, bottomLimit - bubbleH);
      const el = document.querySelector(intro.target);
      let left = 16;
      let top = Math.min(120, maxTop);
      if (el) {
        const next = el.getBoundingClientRect();
        left = Math.min(
          Math.max(12, frame.width - bubbleW - 12),
          Math.max(12, next.left - frame.left),
        );
        const below = next.bottom - frame.top + 8;
        // Stay under the anchor. If that runs off the screen, shift up only
        // enough for the whole bubble, including its bottom border, to fit.
        top = Math.min(Math.max(FEATURE_PAD_TOP, below), maxTop);
      }
      setPos((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
    };
    place();
    const ro = new ResizeObserver(place);
    if (bubbleRef.current) ro.observe(bubbleRef.current);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [intro]);

  return (
    <button
      ref={bubbleRef}
      type="button"
      className="feature-intro"
      style={{
        left: pos?.left ?? 16,
        top: pos?.top ?? 16,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={onDismiss}
    >
      <strong>새 기능</strong>
      <span>{intro.copy}</span>
    </button>
  );
}
