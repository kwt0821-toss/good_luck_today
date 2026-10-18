import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { withAssetVersion } from "../lib/cardArt";
import { setOverlayVisible } from "../lib/loadingGate";
import "./LoadingModal.css";

/** Stay hidden for requests that finish inside this window. */
const SHOW_AFTER_MS = 300;
/** Once the window is on screen, keep it up at least this long. */
const MIN_VISIBLE_MS = 1000;

/**
 * `open` is the in-flight request. The dialog mounts 300ms later so a fast
 * response never flashes, unless `eager` (show immediately). Either way it
 * stays at least 1s after it does appear.
 * `closeNow` hides it on the next frame and skips that minimum — used when a
 * tutorial must stay visible.
 */
function useDelayedOpen(open: boolean, eager: boolean, closeNow: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const shownAtRef = useRef(0);

  useEffect(() => {
    if (closeNow) {
      if (!visibleRef.current) return;
      visibleRef.current = false;
      setVisible(false);
      return;
    }
    let timer = 0;
    if (open) {
      if (visibleRef.current) return;
      timer = window.setTimeout(() => {
        shownAtRef.current = performance.now();
        visibleRef.current = true;
        setVisible(true);
      }, eager ? 0 : SHOW_AFTER_MS);
      return () => window.clearTimeout(timer);
    }
    if (!visibleRef.current) return;
    const elapsed = performance.now() - shownAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    timer = window.setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [open, eager, closeNow]);

  return visible;
}

export const DEFAULT_LOADING_MESSAGES = [
  "잠시만 기다려달라냥",
  "꿈속에서 행운을 찾는 중...",
  "하암~ 곧 일어날게냥",
];

const ASSET_BASE = "/assets/loading";

export type LoadingModalProps = {
  open: boolean;
  /** Rotating messages; shown one at a time. */
  messages?: string[];
  /** 0–1. Omit for an indeterminate (looping) bar. */
  progress?: number;
  title?: string;
  /** Message rotation interval in ms. */
  intervalMs?: number;
  /** Show immediately instead of waiting 300ms. Still stays up for 1s. */
  eager?: boolean;
  /** Hide immediately, even if the window has not finished its minimum time. */
  closeNow?: boolean;
};

/** Twinkling background stars inside the stage (fixed positions, no randomness per render). */
const TWINKLES: Array<{ x: number; y: number; s: number; d: number }> = [
  { x: 96, y: 14, s: 10, d: 0 },
  { x: 150, y: 8, s: 12, d: 0.5 },
  { x: 228, y: 70, s: 9, d: 1.1 },
  { x: 14, y: 92, s: 9, d: 0.8 },
  { x: 118, y: 46, s: 8, d: 1.4 },
  { x: 222, y: 120, s: 10, d: 0.3 },
];

const STAR_POS = [12, 30, 48, 66, 84];

function loadingSrc(file: string) {
  return withAssetVersion(`${ASSET_BASE}/${file}`);
}

function FadeImg({ name, className }: { name: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  const one = loadingSrc(`${name}.webp`);
  const two = loadingSrc(`${name}@2x.webp`);
  return (
    <img
      className={`lc-img ${className} ${loaded ? "is-loaded" : ""}`}
      src={one}
      srcSet={`${one} 1x, ${two} 2x`}
      alt=""
      draggable={false}
      decoding="async"
      onLoad={() => setLoaded(true)}
    />
  );
}

export function LoadingModal({
  open,
  messages = DEFAULT_LOADING_MESSAGES,
  progress,
  title = "잠깐 꿈나라.",
  intervalMs = 2500,
  eager = false,
  closeNow = false,
}: LoadingModalProps) {
  const visible = useDelayedOpen(open, eager, closeNow);
  const list = messages.length ? messages : DEFAULT_LOADING_MESSAGES;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    if (list.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % list.length), intervalMs);
    return () => window.clearInterval(id);
  }, [visible, list.length, intervalMs]);

  useEffect(() => {
    setOverlayVisible(visible);
    return () => {
      if (visible) setOverlayVisible(false);
    };
  }, [visible]);

  if (!visible) return null;

  const determinate = typeof progress === "number" && Number.isFinite(progress);
  const pct = determinate ? Math.round(Math.min(1, Math.max(0, progress as number)) * 100) : 0;
  const message = list[index % list.length];

  return createPortal(
    <div className="lc-overlay" role="dialog" aria-modal="true" aria-busy="true" aria-label={title}>
      <div className="lc-card">
        <svg className="lc-ears" viewBox="0 0 292 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M40 40 L58 6 Q62 0 67 6 L92 40" />
          <path d="M200 40 L225 6 Q230 0 234 6 L252 40" />
          <path className="lc-ear-in" d="M54 38 L62 16 L76 38" />
          <path className="lc-ear-in" d="M216 38 L230 16 L238 38" />
        </svg>
        <span className="lc-corner tl" aria-hidden="true">✦</span>
        <span className="lc-corner tr" aria-hidden="true">✦</span>
        <span className="lc-corner bl" aria-hidden="true">✧</span>
        <span className="lc-corner br" aria-hidden="true">✧</span>

        <div className="lc-title">{title}</div>

        <div className="lc-stage" aria-hidden="true">
          {TWINKLES.map((t, i) => (
            <span
              key={i}
              className="lc-tw"
              style={{ left: t.x, top: t.y, fontSize: t.s, animationDelay: `${t.d}s` }}
            >
              ✦
            </span>
          ))}
          <FadeImg name="loading-moon" className="lc-moon" />
          <div className="lc-cloud">
            <i />
            <i />
            <i />
          </div>
          <FadeImg name="loading-cat" className="lc-cat" />
          <span className="lc-z z1">z</span>
          <span className="lc-z z2">z</span>
          <span className="lc-z z3">Z</span>
        </div>

        <div
          className={`lc-track ${determinate ? "" : "is-indeterminate"}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={determinate ? pct : undefined}
        >
          <div className="lc-fill" style={determinate ? { width: `${pct}%` } : undefined}>
            <i className="lc-tip" aria-hidden="true">✦</i>
          </div>
          {STAR_POS.map((p) => (
            <span
              key={p}
              className={`lc-star ${determinate && pct >= p ? "is-on" : ""}`}
              style={{ left: `${p}%` }}
              aria-hidden="true"
            >
              ★
            </span>
          ))}
        </div>

        <div key={index} className="lc-msg" aria-live="polite">
          {message}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default LoadingModal;
