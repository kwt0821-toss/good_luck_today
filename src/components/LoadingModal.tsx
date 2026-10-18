import { useEffect, useState } from "react";

import "./LoadingModal.css";

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

function FadeImg({ name, className }: { name: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      className={`lc-img ${className} ${loaded ? "is-loaded" : ""}`}
      src={`${ASSET_BASE}/${name}.webp`}
      srcSet={`${ASSET_BASE}/${name}.webp 1x, ${ASSET_BASE}/${name}@2x.webp 2x`}
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
}: LoadingModalProps) {
  const list = messages.length ? messages : DEFAULT_LOADING_MESSAGES;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    if (list.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % list.length), intervalMs);
    return () => window.clearInterval(id);
  }, [open, list.length, intervalMs]);

  if (!open) return null;

  const determinate = typeof progress === "number" && Number.isFinite(progress);
  const pct = determinate ? Math.round(Math.min(1, Math.max(0, progress as number)) * 100) : 0;
  const message = list[index % list.length];

  return (
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
    </div>
  );
}

export default LoadingModal;
