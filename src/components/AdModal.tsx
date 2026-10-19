import { useEffect, useRef, useState } from "react";

import { mockAdDurationSec, type MockAdKind } from "../lib/mockAds";
import "./AdModal.css";

/**
 * 광고 대체 화면 (꿈나라). 토스 안에서 "온라인 상태로 2번 연속 광고 로드 실패"일 때만 띄워요.
 * - 화면 전체를 덮고, 위에 카운트다운 + "광고" 표시 + 닫기(X)
 * - 카운트가 끝나야 "보상 받기" 버튼이 켜져요. 건너뛰기 없음.
 * - 카운트는 Date.now() 차이로 계산하고, 한 틱에 최대 1초만 인정해서
 *   기기 시간을 앞/뒤로 바꾸거나 앱을 백그라운드로 보내도 시간을 건너뛸 수 없어요.
 * props는 기존 AdModal과 같아요(drop-in).
 */
type AdModalProps = {
  open: boolean;
  kind: MockAdKind;
  /** 큰 제목. 기본: 광고를 불러오지 못했어요 */
  title?: string;
  /** 설명. 기본: 카운트가 끝나면 보상을 드릴게요 */
  subtitle?: string;
  onComplete: () => void;
  onCancel: () => void;
};

const ASSET_BASE = "/assets/ad-fallback";
const TICK_MS = 100;
const MAX_STEP_MS = 1000;
const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;
const STAR_POS = [12, 30, 48, 66, 84];

/** 배경 반짝이 (고정 위치, % 단위) */
const TWINKLES: Array<{ x: number; y: number; s: number; d: number }> = [
  { x: 8, y: 14, s: 12, d: 0 },
  { x: 86, y: 12, s: 10, d: 0.6 },
  { x: 72, y: 22, s: 14, d: 1.2 },
  { x: 18, y: 30, s: 9, d: 0.9 },
  { x: 92, y: 38, s: 11, d: 0.3 },
  { x: 6, y: 48, s: 10, d: 1.5 },
  { x: 30, y: 9, s: 8, d: 0.4 },
  { x: 60, y: 6, s: 9, d: 1.0 },
  { x: 88, y: 60, s: 9, d: 0.7 },
  { x: 12, y: 66, s: 8, d: 1.3 },
];

function FadeImg({ name, className }: { name: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      className={`fa-img ${className} ${loaded ? "is-loaded" : ""}`}
      src={`${ASSET_BASE}/${name}.webp`}
      srcSet={`${ASSET_BASE}/${name}.webp 1x, ${ASSET_BASE}/${name}@2x.webp 2x`}
      alt=""
      draggable={false}
      decoding="async"
      onLoad={() => setLoaded(true)}
    />
  );
}

export function AdModal({ open, kind, title, subtitle, onComplete, onCancel }: AdModalProps) {
  const durationMs = mockAdDurationSec(kind) * 1000;
  const [elapsed, setElapsed] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    finishedRef.current = false;
    setElapsed(0);
    let acc = 0;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      // 시간이 거꾸로 가면 0, 크게 뛰면 최대 1초만 인정
      const step = Math.min(MAX_STEP_MS, Math.max(0, now - last));
      last = now;
      acc = Math.min(durationMs, acc + step);
      setElapsed(acc);
      if (acc >= durationMs) window.clearInterval(timer);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [open, durationMs]);

  if (!open) return null;

  const ratio = Math.min(1, elapsed / durationMs);
  const done = ratio >= 1;
  const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
  const pct = Math.round(ratio * 100);

  const finish = (fn: () => void) => {
    if (finishedRef.current) return; // 연타 방지: 한 번만
    finishedRef.current = true;
    fn();
  };

  const heading = title ?? "광고를 불러오지 못했어요";
  const desc = subtitle ?? "카운트가 끝나면 보상을 드릴게요";

  return (
    <div
      className={`fa-overlay ${done ? "is-done" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fa-title"
      aria-describedby="fa-desc"
    >
      <div className="fa-sky" aria-hidden="true">
        {TWINKLES.map((t, i) => (
          <span
            key={i}
            className="fa-tw"
            style={{ left: `${t.x}%`, top: `${t.y}%`, fontSize: t.s, animationDelay: `${t.d}s` }}
          >
            ✦
          </span>
        ))}
        <div className="fa-cloud c1"><i /><i /><i /></div>
        <div className="fa-cloud c2"><i /><i /><i /></div>
      </div>

      <div className="fa-top">
        <span className="fa-badge">광고</span>
        <div className="fa-count" aria-live="polite">
          <svg className="fa-ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle className="fa-ring-bg" cx="18" cy="18" r={RING_R} />
            <circle
              className="fa-ring-fg"
              cx="18"
              cy="18"
              r={RING_R}
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - ratio)}
            />
          </svg>
          <span className="fa-count-num" aria-hidden="true">{done ? "✓" : remaining}</span>
          <span className="fa-count-text">{done ? "보상 준비 완료" : `${remaining}초 후 보상`}</span>
        </div>
        <button
          type="button"
          className="fa-close"
          aria-label="닫기 (보상을 받을 수 없어요)"
          onClick={() => finish(onCancel)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="fa-body">
        <div className="fa-stage" aria-hidden="true">
          <FadeImg name="fallback-moon" className="fa-moon" />
          <div className="fa-bed"><i /><i /><i /></div>
          <FadeImg name="fallback-cat" className="fa-cat" />
          <span className="fa-z z1">z</span>
          <span className="fa-z z2">z</span>
          <span className="fa-z z3">Z</span>
        </div>

        <h2 id="fa-title" className="fa-title">{heading}</h2>
        <p id="fa-desc" className="fa-desc">
          {done ? "기다려 줘서 고마워요!" : desc}
        </p>
      </div>

      <div className="fa-bottom">
        <div
          className="fa-track"
          role="progressbar"
          aria-label="보상까지 남은 시간"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="fa-fill" style={{ width: `${pct}%` }}>
            <i className="fa-tip" aria-hidden="true">✦</i>
          </div>
          {STAR_POS.map((p) => (
            <span
              key={p}
              className={`fa-star ${pct >= p ? "is-on" : ""}`}
              style={{ left: `${p}%` }}
              aria-hidden="true"
            >
              ★
            </span>
          ))}
        </div>

        <button
          type="button"
          className="fa-cta"
          disabled={!done}
          onClick={() => finish(onComplete)}
        >
          {done ? "보상 받기" : `${remaining}초 후 받을 수 있어요`}
        </button>
        <p className={`fa-note ${done ? "is-hidden" : ""}`}>지금 닫으면 보상을 받을 수 없어요</p>
      </div>
    </div>
  );
}

export default AdModal;
