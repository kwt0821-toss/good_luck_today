import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import { AudioManager } from "../audio/AudioManager";
import { cardDisplayName, cardKoreanName, dexAsset, formatMetDate } from "../lib/dexCatalog";
import { loadMenuSettings, shouldReduceMenuMotion } from "../lib/menuSettings";
import type { DexCard, DexOwnedMap } from "../lib/dexTypes";

type DexDetailSheetProps = {
  card: DexCard;
  group: DexCard[];
  owned: DexOwnedMap;
  onClose: () => void;
  onChangeCard: (card: DexCard) => void;
  onConvertDuplicate?: (card: DexCard) => void;
};

const LIFT_MS = 100;
const ROTATE_END_MS = 1000;
const BOUNCE_MS = 160;
const TOTAL_SPIN_MS = ROTATE_END_MS + BOUNCE_MS;
const TAP_DELTA = 900; // 2.5 turns
const SWIPE_PT = 40;
const CROSSFADE_MS = 200;
const SHINE_MS = 380;
const LIFT_SCALE = 1.06;
const LIFT_Y = -8;

/** cubic-bezier(.15, .85, .25, 1) */
function easeSpin(t: number): number {
  const x1 = 0.15;
  const y1 = 0.85;
  const x2 = 0.25;
  const y2 = 1;
  let x = t;
  for (let i = 0; i < 6; i += 1) {
    const u = 1 - x;
    const cx = 3 * u * u * x * x1 + 3 * u * x * x * x2 + x * x * x;
    const dx = 3 * u * u * x1 + 6 * u * x * (x2 - x1) + 3 * x * x * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    x -= (cx - t) / dx;
    x = Math.min(1, Math.max(0, x));
  }
  const u = 1 - x;
  return 3 * u * u * x * y1 + 3 * u * x * x * y2 + x * x * x;
}

function bounceScale(t: number, from = LIFT_SCALE): number {
  // from → 0.985 → 1
  if (t < 0.55) {
    const p = t / 0.55;
    return from + (0.985 - from) * (1 - (1 - p) * (1 - p));
  }
  const p = (t - 0.55) / 0.45;
  return 0.985 + (1 - 0.985) * (1 - (1 - p) * (1 - p));
}

function isBackFace(angle: number): boolean {
  const normalized = ((Math.round(angle / 180) % 2) + 2) % 2;
  return normalized === 1;
}

function isRareCard(card: DexCard): boolean {
  if (card.type === "special" || card.type === "character" || card.type === "legend") return true;
  return (card.stars ?? 0) >= 5;
}

function lightVibrate(ms = 10) {
  if (!loadMenuSettings().haptic) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // ignore
  }
}

function prefetchCardFaces(card: DexCard) {
  const front = new Image();
  front.src = dexAsset(card.front);
  const back = new Image();
  back.src = dexAsset(card.back);
}

/** Swipe speed (px/ms) → 1.5 / 2.5 / 3.5 turns (always lands on opposite face). */
function spinDeltaFromSwipe(dx: number, durationMs: number): number {
  const dir = dx >= 0 ? 1 : -1;
  const speed = Math.abs(dx) / Math.max(16, durationMs);
  let turns = 1.5;
  if (speed >= 1.1) turns = 3.5;
  else if (speed >= 0.45) turns = 2.5;
  return dir * turns * 360;
}

export function DexDetailSheet({
  card,
  group,
  owned,
  onClose,
  onChangeCard,
  onConvertDuplicate,
}: DexDetailSheetProps) {
  const [closing, setClosing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [showingBack, setShowingBack] = useState(false);
  const [shining, setShining] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const frontFaceRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);

  const angleRef = useRef(0);
  const spinningRef = useRef(false);
  const rafRef = useRef(0);
  const spinAnimRef = useRef<Animation | null>(null);
  const shineTimerRef = useRef(0);
  const reduceMotionRef = useRef(shouldReduceMenuMotion());
  const lastAngleRef = useRef(0);

  const pointerIdRef = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startAt = useRef(0);
  const dragKind = useRef<"close" | "card" | null>(null);
  const draggingRef = useRef(false);

  const record = owned[card.id];
  const ownedInGroup = group.filter((item) => (owned[item.id]?.count ?? 0) > 0);
  const ownedCount = ownedInGroup.length;
  const total = group.length;
  const ko = cardKoreanName(card);
  const met = record ? formatMetDate(record.firstSeen) : null;
  const rare = isRareCard(card);
  const legend = card.type === "legend";

  const subtitle =
    card.type === "breed" && card.stars
      ? `${ko} · ${card.stars}성 카드`
      : card.type === "special"
        ? "스페셜 카드"
        : card.type === "character"
          ? "캐릭터 카드"
          : "레전드 카드";

  const collectionLabel =
    card.type === "breed"
      ? `${ko} 컬렉션`
      : card.type === "special"
        ? "스페셜 컬렉션"
        : card.type === "character"
          ? "캐릭터 컬렉션"
          : "레전드 컬렉션";

  const applyFaceBlur = (blurPx: number) => {
    const blur = blurPx > 0.05 ? `blur(${blurPx}px)` : "none";
    // Blur faces — never the preserve-3d inner (filter flattens 3D / backface).
    if (frontFaceRef.current) frontFaceRef.current.style.filter = blur;
    if (backFaceRef.current) backFaceRef.current.style.filter = blur;
  };

  const applyPose = (angle: number, scale: number, translateY: number, blurPx = 0, spinIntensity = 0) => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transform = `translateY(${translateY}px) scale(${scale}) rotateY(${angle}deg)`;
    applyFaceBlur(blurPx);

    const shadow = shadowRef.current;
    if (shadow) {
      // Faster spin → narrower / softer shadow
      const t = Math.min(1, Math.max(0, spinIntensity));
      shadow.style.opacity = String(0.42 - t * 0.3);
      shadow.style.transform = `translateX(-50%) scaleX(${1 - t * 0.7}) scaleY(${1 - t * 0.12})`;
    }
  };

  const applyCrossfade = (opacityFront: number, opacityBack: number) => {
    if (frontFaceRef.current) frontFaceRef.current.style.opacity = String(opacityFront);
    if (backFaceRef.current) backFaceRef.current.style.opacity = String(opacityBack);
    if (innerRef.current) {
      innerRef.current.style.transform = "none";
    }
    applyFaceBlur(0);
  };

  const resetPose = (angle = 0) => {
    angleRef.current = angle;
    lastAngleRef.current = angle;
    setShowingBack(isBackFace(angle));
    if (reduceMotionRef.current) {
      const back = isBackFace(angle);
      applyCrossfade(back ? 0 : 1, back ? 1 : 0);
      if (shadowRef.current) {
        shadowRef.current.style.opacity = "0.42";
        shadowRef.current.style.transform = "translateX(-50%) scaleX(1) scaleY(1)";
      }
      return;
    }
    if (frontFaceRef.current) frontFaceRef.current.style.opacity = "1";
    if (backFaceRef.current) backFaceRef.current.style.opacity = "1";
    applyPose(angle, 1, 0, 0, 0);
  };

  const onLand = (finalAngle: number) => {
    angleRef.current = finalAngle;
    lastAngleRef.current = finalAngle;
    const back = isBackFace(finalAngle);
    setShowingBack(back);
    applyPose(finalAngle, 1, 0, 0, 0);
    spinningRef.current = false;
    lightVibrate(10);
    if (rare) {
      setShining(true);
      AudioManager.playSfx("reveal-rare", { volume: 0.5 });
      window.clearTimeout(shineTimerRef.current);
      shineTimerRef.current = window.setTimeout(() => setShining(false), SHINE_MS);
    }
  };

  const spinBy = (deltaDeg: number) => {
    if (spinningRef.current) return;
    spinningRef.current = true;

    const from = angleRef.current;
    // Snap delta so we always finish on a half-turn boundary (0 / 180 mod 360)
    const rawTo = from + deltaDeg;
    const to = Math.round(rawTo / 180) * 180;
    const willShowBack = isBackFace(to);

    AudioManager.playSfx("card-flip");

    if (reduceMotionRef.current) {
      const start = performance.now();
      const tickFade = (now: number) => {
        const t = Math.min(1, (now - start) / CROSSFADE_MS);
        if (willShowBack) {
          if (frontFaceRef.current) frontFaceRef.current.style.opacity = String(1 - t);
          if (backFaceRef.current) backFaceRef.current.style.opacity = String(t);
        } else {
          if (frontFaceRef.current) frontFaceRef.current.style.opacity = String(t);
          if (backFaceRef.current) backFaceRef.current.style.opacity = String(1 - t);
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tickFade);
          return;
        }
        onLand(willShowBack ? 180 : 0);
      };
      rafRef.current = requestAnimationFrame(tickFade);
      return;
    }

    const inner = innerRef.current;
    if (!inner) {
      spinningRef.current = false;
      return;
    }

    spinAnimRef.current?.cancel();
    cancelAnimationFrame(rafRef.current);
    lastAngleRef.current = from;

    const pose = (angle: number, scale: number, y: number) =>
      `translateY(${y}px) scale(${scale}) rotateY(${angle}deg)`;

    // Compositor-driven transform — rAF style writes were hard to see under SwiftShader.
    const liftEnd = LIFT_MS / TOTAL_SPIN_MS;
    const rotateEnd = ROTATE_END_MS / TOTAL_SPIN_MS;
    const bounceMid = (ROTATE_END_MS + BOUNCE_MS * 0.55) / TOTAL_SPIN_MS;
    const anim = inner.animate(
      [
        { transform: pose(from, 1, 0), offset: 0, easing: "ease-out" },
        {
          transform: pose(from, LIFT_SCALE, LIFT_Y),
          offset: liftEnd,
          easing: "cubic-bezier(0.15, 0.85, 0.25, 1)",
        },
        {
          transform: pose(to, LIFT_SCALE, LIFT_Y),
          offset: rotateEnd,
          easing: "ease-out",
        },
        {
          transform: pose(to, 0.985, LIFT_Y * 0.2),
          offset: bounceMid,
          easing: "ease-out",
        },
        { transform: pose(to, 1, 0), offset: 1 },
      ],
      { duration: TOTAL_SPIN_MS, fill: "forwards" },
    );
    spinAnimRef.current = anim;

    let landed = false;
    const finish = () => {
      if (landed) return;
      landed = true;
      cancelAnimationFrame(rafRef.current);
      try {
        anim.commitStyles();
      } catch {
        applyPose(to, 1, 0, 0, 0);
      }
      anim.cancel();
      spinAnimRef.current = null;
      applyFaceBlur(0);
      if (shadowRef.current) {
        shadowRef.current.style.opacity = "0.42";
        shadowRef.current.style.transform = "translateX(-50%) scaleX(1) scaleY(1)";
      }
      onLand(to);
    };

    const start = performance.now();
    const tickFx = (now: number) => {
      if (landed) return;
      const elapsed = now - start;
      let blur = 0;
      let intensity = 0;
      let angle = from;

      if (elapsed < LIFT_MS) {
        angle = from;
      } else if (elapsed < ROTATE_END_MS) {
        const p = easeSpin((elapsed - LIFT_MS) / (ROTATE_END_MS - LIFT_MS));
        angle = from + (to - from) * p;
        const speedApprox = Math.min(1, Math.abs(easeSpin(Math.min(1, p + 0.02)) - p) * 40);
        intensity = 0.35 + speedApprox * 0.65;
        blur = 0.6 * intensity;
      } else {
        const p = Math.min(1, (elapsed - ROTATE_END_MS) / BOUNCE_MS);
        angle = to;
        blur = 0.6 * (1 - p);
        intensity = 1 - p;
      }

      applyFaceBlur(blur);
      const shadow = shadowRef.current;
      if (shadow) {
        const t = Math.min(1, Math.max(0, intensity));
        shadow.style.opacity = String(0.42 - t * 0.3);
        shadow.style.transform = `translateX(-50%) scaleX(${1 - t * 0.7}) scaleY(${1 - t * 0.12})`;
      }
      lastAngleRef.current = angle;

      if (elapsed >= TOTAL_SPIN_MS) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(tickFx);
    };

    rafRef.current = requestAnimationFrame(tickFx);
    void anim.finished.then(finish).catch(() => finish());
  };

  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 240);
  };

  useEffect(() => {
    reduceMotionRef.current = shouldReduceMenuMotion();
    cancelAnimationFrame(rafRef.current);
    spinAnimRef.current?.cancel();
    spinAnimRef.current = null;
    spinningRef.current = false;
    setShining(false);
    resetPose(0);
    prefetchCardFaces(card);
  }, [card.id, card.front, card.back]);

  useEffect(() => {
    prefetchCardFaces(card);
    const arm = window.setTimeout(() => setArmed(true), 280);
    const settle = window.setTimeout(() => setSettled(true), 420);
    return () => {
      window.clearTimeout(arm);
      window.clearTimeout(settle);
      window.clearTimeout(shineTimerRef.current);
      cancelAnimationFrame(rafRef.current);
      spinAnimRef.current?.cancel();
      spinAnimRef.current = null;
    };
  }, []);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    startY.current = event.clientY;
    dragKind.current = "close";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragKind.current !== "close") return;
    dragKind.current = null;
    const dy = event.clientY - startY.current;
    const dx = event.clientX - startX.current;
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) close();
  };

  const onCardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (spinningRef.current) return;
    if (event.button != null && event.button !== 0) return;
    pointerIdRef.current = event.pointerId;
    startX.current = event.clientX;
    startY.current = event.clientY;
    startAt.current = performance.now();
    dragKind.current = "card";
    draggingRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragKind.current !== "card" || spinningRef.current) return;
    if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;

    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (!draggingRef.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
        dragKind.current = null;
        return;
      }
      draggingRef.current = true;
    }
  };

  const onCardPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragKind.current !== "card") return;
    dragKind.current = null;
    if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    if (spinningRef.current) return;

    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    const duration = performance.now() - startAt.current;

    if (draggingRef.current) {
      draggingRef.current = false;
      if (Math.abs(dx) >= SWIPE_PT && Math.abs(dx) > Math.abs(dy)) {
        spinBy(spinDeltaFromSwipe(dx, duration));
        return;
      }
      return;
    }

    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      spinBy(TAP_DELTA);
    }
  };

  const onCardPointerCancel = () => {
    dragKind.current = null;
    pointerIdRef.current = null;
    draggingRef.current = false;
  };

  const onFlipClick = () => {
    if (spinningRef.current) return;
    spinBy(TAP_DELTA);
  };

  const selectOwned = (item: DexCard) => {
    if ((owned[item.id]?.count ?? 0) <= 0) return;
    if (item.id === card.id) return;
    onChangeCard(item);
  };

  const host = document.getElementById("root") ?? document.body;

  return createPortal(
    <div className={`dex-sheet-root ${closing ? "is-closing" : ""} ${settled ? "is-settled" : ""}`}>
      <button
        type="button"
        className="dex-sheet-backdrop"
        aria-label="닫기"
        onClick={() => {
          if (armed) close();
        }}
      />
      <div
        className="dex-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={cardDisplayName(card)}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="dex-sheet-handle"
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
        />
        <button type="button" className="dex-sheet-close" aria-label="닫기" onClick={close}>
          <img src={dexAsset("icons/icon-close.svg")} alt="" />
        </button>
        <h2 className="dex-sheet-title">{cardDisplayName(card)}</h2>
        <p className="dex-sheet-sub">
          {subtitle}
          {card.type === "breed" && card.stars ? (
            <span className="dex-sheet-stars">{"★".repeat(card.stars)}</span>
          ) : null}
        </p>

        <div className="dex-flip-stage">
          <div className="dex-flip-stage-tilt">
            <div className="dex-card-glow" />
            <div
              ref={cardRef}
              className={`card dex-card ${reduceMotionRef.current ? "is-reduced" : ""}`}
              onPointerDown={onCardPointerDown}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              onPointerCancel={onCardPointerCancel}
              role="button"
              tabIndex={0}
              aria-label={showingBack ? "앞면 보기" : "뒷면 보기"}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onFlipClick();
                }
              }}
            >
              <div ref={shadowRef} className="dex-card-depth" aria-hidden="true" />
              <div ref={innerRef} className="card-inner dex-card-inner">
                <div ref={frontFaceRef} className="face front dex-face">
                  <img src={dexAsset(card.front)} alt={`${cardDisplayName(card)} 앞면`} draggable={false} />
                </div>
                <div ref={backFaceRef} className="face back dex-face">
                  <img src={dexAsset(card.back)} alt={`${cardDisplayName(card)} 뒷면`} draggable={false} />
                </div>
              </div>
              <div
                className={`dex-card-shine ${shining ? "is-active" : ""} ${legend ? "is-legend" : ""}`}
                aria-hidden="true"
              />
            </div>
            <button type="button" className="dex-flip-btn" aria-label="카드 뒤집기" onClick={onFlipClick}>
              <img src={dexAsset("icons/icon-flip.svg")} alt="" />
            </button>
          </div>
        </div>

        <p className="dex-flip-hint">
          <span>톡,</span> {showingBack ? "뒤집어서 앞면 보기" : "뒤집어서 뒷면 보기"}
        </p>

        <div className="dex-stats">
          <div>
            <span>처음 만난 날</span>
            <strong>
              {met?.day} <small>{met?.year}</small>
            </strong>
          </div>
          <div>
            <span>보유</span>
            <strong className="is-amber">×{record?.count ?? 1}</strong>
          </div>
          <div>
            <span>{collectionLabel}</span>
            <strong>
              {ownedCount} <small>/ {total}</small>
            </strong>
          </div>
        </div>

        <div className="dex-dots" aria-label="보유 카드">
          {group.map((item) => {
            const isOwned = Boolean(owned[item.id]);
            const isActive = item.id === card.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`dex-dot ${isActive ? "is-active" : ""} ${isOwned ? "" : "is-locked"}`}
                aria-label={cardDisplayName(item)}
                disabled={!isOwned}
                onClick={() => selectOwned(item)}
              />
            );
          })}
        </div>

        {(record?.count ?? 0) > 1 && onConvertDuplicate ? (
          <button
            type="button"
            id="dex-dup-convert"
            className="dex-convert-btn"
            onClick={() => onConvertDuplicate(card)}
          >
            겹친 카드 포인트로 바꾸기
          </button>
        ) : null}
      </div>
    </div>,
    host,
  );
}
