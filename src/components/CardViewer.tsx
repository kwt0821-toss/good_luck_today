import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";

import { FLIP_BUTTON_ZONE, boxStyle, flipGuideStyle } from "../lib/cardFrames";
import { shouldReduceMenuMotion } from "../lib/menuSettings";
import "./CardViewer.css";

const SWIPE_LOCK_PX = 8;
const SWIPE_COMMIT_PX = 50;
const SWIPE_MS = 250;

export type CardSwipeDirection = "prev" | "next";

export type CardSwipe = {
  canPrev: boolean;
  canNext: boolean;
  onSwipe: (direction: CardSwipeDirection) => void;
};

type SwipeDrag = {
  pointerId: number;
  x: number;
  y: number;
  el: HTMLDivElement;
  locked: "h" | "v" | null;
};

function reducedSwipeMotion(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  } catch {
    // matchMedia can throw in locked-down webviews.
  }
  return shouldReduceMenuMotion();
}

function resistedX(dx: number): number {
  return Math.sign(dx) * Math.min(Math.abs(dx) * 0.28, 42);
}

function clearSwipeStyles(el: HTMLDivElement) {
  el.style.transition = "";
  el.style.transform = "";
  el.style.opacity = "";
}

const FLIP_HINT_KEY = "lucky-cat.card-flip-hint";

function flipHintSeen(): boolean {
  try {
    return window.localStorage.getItem(FLIP_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function markFlipHintSeen(): void {
  try {
    window.localStorage.setItem(FLIP_HINT_KEY, "1");
  } catch {
    // Private mode can reject storage; the hint just stays for this visit.
  }
}

type CardViewerProps = {
  /** 오늘의 한 줄, under the card and outside the frame. */
  line?: string;
  /** Grade color from layout.nameColor[tier]. */
  accentColor?: string;
  showingBack?: boolean;
  onFlip?: () => void;
  /** False while the draw reveal is still spinning. */
  flipEnabled?: boolean;
  /** False while a tap should fall through (skip the reveal). */
  zoomEnabled?: boolean;
  children: ReactNode;
  className?: string;
  captionRef?: Ref<HTMLDivElement>;
  captionClassName?: string;
  renderZoom?: () => ReactNode;
  /** Dex detail only. Draw leaves this unset. */
  swipe?: CardSwipe;
};

/** Static front/back stack for the enlarged overlay. */
export function CardFlipStack({
  showingBack,
  front,
  back,
}: {
  showingBack: boolean;
  front: ReactNode;
  back: ReactNode;
}) {
  return (
    <div className="card-flip-scene">
      <div className={`card-flip-inner ${showingBack ? "is-back" : ""}`}>
        <div className="card-flip-face">{front}</div>
        <div className="card-flip-face is-back">{back}</div>
      </div>
    </div>
  );
}

function FortuneBubble({ line, accent }: { line: string; accent: string }) {
  const style = { "--fortune-accent": accent } as CSSProperties;
  return (
    <div className="card-viewer-bubble" style={style}>
      <p className="card-viewer-kicker">🍀 오늘의 한 줄</p>
      <p className="card-viewer-line">{line}</p>
    </div>
  );
}

function FlipGuide() {
  return (
    <div className="card-viewer-guide" style={flipGuideStyle()} aria-hidden="true">
      <span className="card-viewer-guide-label">뒷면보기</span>
      <svg className="card-viewer-guide-arrow" viewBox="0 0 96 58" fill="none">
        <path
          d="M10 12 C 26 14, 38 22, 52 34 S 78 48, 86 52"
          stroke="#FFE08A"
          strokeWidth="1.8"
          strokeDasharray="1.2 3.6"
          strokeLinecap="round"
        />
        <path
          d="M74 44 L88 54 L76 56"
          stroke="#FFE08A"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function FlipButton({
  showingBack,
  onFlip,
}: {
  showingBack: boolean;
  onFlip: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="card-viewer-flip-zone" style={boxStyle(FLIP_BUTTON_ZONE)}>
      <button
        type="button"
        className="card-viewer-flip"
        aria-label={showingBack ? "앞면 보기" : "뒷면 보기"}
        onClick={onFlip}
      >
        <img src="/assets/dex/icons/icon-flip.svg" alt="" />
      </button>
    </div>
  );
}

/** Shared draw + dex chrome: fortune under the card, flip button, enlarge overlay. */
export function CardViewer({
  line = "",
  accentColor = "#5A4030",
  showingBack = false,
  onFlip,
  flipEnabled = true,
  zoomEnabled = true,
  children,
  className,
  captionRef,
  captionClassName,
  renderZoom,
  swipe,
}: CardViewerProps) {
  const [hintOn, setHintOn] = useState(() => !flipHintSeen());
  const [zoom, setZoom] = useState(false);
  const canFlip = Boolean(onFlip) && flipEnabled;
  const canZoom = zoomEnabled && Boolean(renderZoom);
  const swipeLatest = useRef(swipe);
  swipeLatest.current = swipe;
  const dragRef = useRef<SwipeDrag | null>(null);
  const blockClick = useRef(false);
  const animating = useRef(false);
  const swipeTimer = useRef(0);
  const clickTimer = useRef(0);

  const eatNextClick = () => {
    blockClick.current = true;
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      blockClick.current = false;
    }, 350);
  };

  useEffect(
    () => () => {
      window.clearTimeout(swipeTimer.current);
      window.clearTimeout(clickTimer.current);
    },
    [],
  );

  const closeZoom = () => setZoom(false);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setZoom(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [zoom]);

  const handleFlip = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!canFlip || !onFlip) return;
    if (hintOn) {
      markFlipHintSeen();
      setHintOn(false);
    }
    onFlip();
  };

  const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (blockClick.current) {
      blockClick.current = false;
      window.clearTimeout(clickTimer.current);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!canZoom) return;
    const target = event.target as HTMLElement;
    if (target.closest(".card-viewer-flip")) return;
    event.stopPropagation();
    setZoom(true);
  };

  const settleSwipe = (el: HTMLDivElement, direction: CardSwipeDirection) => {
    const reduce = reducedSwipeMotion();
    const width = el.offsetWidth || 1;
    const out = direction === "next" ? -width : width;
    animating.current = true;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(swipeTimer.current);
      el.style.transition = "none";
      flushSync(() => {
        swipeLatest.current?.onSwipe(direction);
      });
      if (reduce) {
        el.style.opacity = "0";
        el.style.transform = "";
      } else {
        el.style.opacity = "";
        el.style.transform = `translateX(${-out}px)`;
      }
      requestAnimationFrame(() => {
        el.style.transition = reduce ? `opacity ${SWIPE_MS}ms ease` : `transform ${SWIPE_MS}ms ease`;
        el.style.opacity = "1";
        el.style.transform = "translateX(0px)";
        swipeTimer.current = window.setTimeout(() => {
          clearSwipeStyles(el);
          animating.current = false;
        }, SWIPE_MS + 40);
      });
    };
    const onEnd = (event: globalThis.TransitionEvent) => {
      if (event.target !== el) return;
      if (event.propertyName !== (reduce ? "opacity" : "transform")) return;
      el.removeEventListener("transitionend", onEnd);
      finish();
    };
    el.addEventListener("transitionend", onEnd);
    window.clearTimeout(swipeTimer.current);
    swipeTimer.current = window.setTimeout(() => {
      el.removeEventListener("transitionend", onEnd);
      if (animating.current) finish();
    }, SWIPE_MS + 80);
    if (reduce) {
      el.style.transition = `opacity ${SWIPE_MS}ms ease`;
      el.style.opacity = "0";
      return;
    }
    el.style.transition = `transform ${SWIPE_MS}ms ease`;
    el.style.transform = `translateX(${out}px)`;
  };

  const springBack = (el: HTMLDivElement) => {
    if (reducedSwipeMotion()) {
      clearSwipeStyles(el);
      return;
    }
    animating.current = true;
    el.style.transition = `transform ${SWIPE_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    el.style.transform = "translateX(0px)";
    const done = () => {
      clearSwipeStyles(el);
      animating.current = false;
    };
    const onEnd = (event: globalThis.TransitionEvent) => {
      if (event.target !== el || event.propertyName !== "transform") return;
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(swipeTimer.current);
      done();
    };
    el.addEventListener("transitionend", onEnd);
    window.clearTimeout(swipeTimer.current);
    swipeTimer.current = window.setTimeout(() => {
      el.removeEventListener("transitionend", onEnd);
      done();
    }, SWIPE_MS + 80);
  };

  const onSwipePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeLatest.current || animating.current) return;
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".card-viewer-flip")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      el: event.currentTarget,
      locked: null,
    };
  };

  const onSwipePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.locked) {
      if (Math.abs(dx) < SWIPE_LOCK_PX && Math.abs(dy) < SWIPE_LOCK_PX) return;
      drag.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (drag.locked === "v") {
        eatNextClick();
        dragRef.current = null;
        return;
      }
      drag.el.setPointerCapture(event.pointerId);
    }
    if (drag.locked !== "h") return;
    eatNextClick();
    if (reducedSwipeMotion()) return;
    const gesture = swipeLatest.current;
    const atEdge = (dx > 0 && !gesture?.canPrev) || (dx < 0 && !gesture?.canNext);
    drag.el.style.transition = "none";
    drag.el.style.transform = `translateX(${atEdge ? resistedX(dx) : dx}px)`;
  };

  const onSwipePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (drag.locked !== "h" || Math.abs(dx) <= Math.abs(dy)) {
      if (drag.locked === "h") springBack(drag.el);
      return;
    }
    eatNextClick();
    const direction: CardSwipeDirection = dx < 0 ? "next" : "prev";
    const gesture = swipeLatest.current;
    const allowed = direction === "next" ? gesture?.canNext : gesture?.canPrev;
    if (Math.abs(dx) < SWIPE_COMMIT_PX || !allowed) {
      springBack(drag.el);
      return;
    }
    settleSwipe(drag.el, direction);
  };

  const onSwipePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    eatNextClick();
    springBack(drag.el);
  };

  const swipeHandlers = swipe
    ? {
        onPointerDown: onSwipePointerDown,
        onPointerMove: onSwipePointerMove,
        onPointerUp: onSwipePointerUp,
        onPointerCancel: onSwipePointerCancel,
      }
    : {};

  const guide = hintOn && canFlip ? <FlipGuide /> : null;

  return (
    <div className={["card-viewer", className ?? ""].filter(Boolean).join(" ")}>
      <div className="card-viewer-stage" onClick={onStageClick}>
        <div className={swipe ? "card-viewer-swipe" : "card-viewer-swipe is-off"} {...swipeHandlers}>
          {children}
          {canFlip ? <FlipButton showingBack={showingBack} onFlip={handleFlip} /> : null}
          {guide}
        </div>
      </div>
      <div
        ref={captionRef}
        className={["card-viewer-caption", line ? "" : "is-empty", captionClassName ?? ""]
          .filter(Boolean)
          .join(" ")}
      >
        {line ? <FortuneBubble line={line} accent={accentColor} /> : null}
      </div>
      {zoom && renderZoom
        ? createPortal(
            <div className="card-zoom" role="dialog" aria-modal="true" aria-label="카드 크게 보기">
              <button type="button" className="card-zoom-backdrop" aria-label="닫기" onClick={closeZoom} />
              <div className="card-zoom-layout">
                <button type="button" className="card-zoom-close" aria-label="닫기" onClick={closeZoom}>
                  ✕
                </button>
                <div className={swipe ? "card-zoom-stage card-viewer-swipe" : "card-zoom-stage"} {...swipeHandlers}>
                  {renderZoom()}
                  {canFlip ? <FlipButton showingBack={showingBack} onFlip={handleFlip} /> : null}
                  {hintOn && canFlip ? <FlipGuide /> : null}
                </div>
                {line ? (
                  <div className="card-viewer-caption">
                    <FortuneBubble line={line} accent={accentColor} />
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
