import { useEffect, useState, type MouseEvent, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";

import "./CardViewer.css";

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

function FlipGuide() {
  return (
    <div className="card-viewer-guide" aria-hidden="true">
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
    <button
      type="button"
      className="card-viewer-flip"
      aria-label={showingBack ? "앞면 보기" : "뒷면 보기"}
      onClick={onFlip}
    >
      <img src="/assets/dex/icons/icon-flip.svg" alt="" />
    </button>
  );
}

/** Shared draw + dex chrome: fortune under the card, flip button, enlarge overlay. */
export function CardViewer({
  line = "",
  showingBack = false,
  onFlip,
  flipEnabled = true,
  zoomEnabled = true,
  children,
  className,
  captionRef,
  captionClassName,
  renderZoom,
}: CardViewerProps) {
  const [hintOn, setHintOn] = useState(() => !flipHintSeen());
  const [zoom, setZoom] = useState(false);
  const canFlip = Boolean(onFlip) && flipEnabled;
  const canZoom = zoomEnabled && Boolean(renderZoom);

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
    if (!canZoom) return;
    const target = event.target as HTMLElement;
    if (target.closest(".card-viewer-flip")) return;
    event.stopPropagation();
    setZoom(true);
  };

  const guide = hintOn && canFlip ? <FlipGuide /> : null;

  return (
    <div className={["card-viewer", className ?? ""].filter(Boolean).join(" ")}>
      <div className="card-viewer-stage" onClick={onStageClick}>
        {children}
        {canFlip ? <FlipButton showingBack={showingBack} onFlip={handleFlip} /> : null}
        {guide}
      </div>
      <div
        ref={captionRef}
        className={["card-viewer-caption", captionClassName ?? ""].filter(Boolean).join(" ")}
      >
        {line ? <p className="card-viewer-line">{line}</p> : null}
      </div>
      {zoom && renderZoom
        ? createPortal(
            <div className="card-zoom" role="dialog" aria-modal="true" aria-label="카드 크게 보기">
              <button type="button" className="card-zoom-backdrop" aria-label="닫기" onClick={closeZoom} />
              <div className="card-zoom-layout">
                <button type="button" className="card-zoom-close" aria-label="닫기" onClick={closeZoom}>
                  ✕
                </button>
                <div className="card-zoom-stage">
                  {renderZoom()}
                  {canFlip ? <FlipButton showingBack={showingBack} onFlip={handleFlip} /> : null}
                  {hintOn && canFlip ? <FlipGuide /> : null}
                </div>
                {line ? <p className="card-viewer-line">{line}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
