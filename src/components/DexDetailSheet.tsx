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

const LIFT_MS = 80;
const ROTATE_END_MS = 520;
const BOUNCE_MS = 140;
const TOTAL_FLIP_MS = ROTATE_END_MS + BOUNCE_MS;
const SWIPE_PT = 40;
const DRAG_MAX_DEG = 25;
const DRAG_FLIP_RATIO = 0.5;
const CROSSFADE_MS = 200;
const SHINE_MS = 380;

/** cubic-bezier(.2, .8, .2, 1) — progress in [0,1] → eased [0,1] */
function easeFlip(t: number): number {
  const x1 = 0.2;
  const y1 = 0.8;
  const x2 = 0.2;
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

function bounceScale(t: number): number {
  // Overshoot then settle: 1.04 → 0.985 → 1
  if (t < 0.55) {
    const p = t / 0.55;
    return 1.04 + (0.985 - 1.04) * (1 - (1 - p) * (1 - p));
  }
  const p = (t - 0.55) / 0.45;
  return 0.985 + (1 - 0.985) * (1 - (1 - p) * (1 - p));
}

function isBackFace(angle: number): boolean {
  const halfTurns = Math.round(angle / 180);
  return ((halfTurns % 2) + 2) % 2 === 1;
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
  const flippingRef = useRef(false);
  const rafRef = useRef(0);
  const shineTimerRef = useRef(0);
  const reduceMotionRef = useRef(shouldReduceMenuMotion());

  const pointerIdRef = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragKind = useRef<"close" | "card" | null>(null);
  const draggingRef = useRef(false);
  const dragTiltRef = useRef(0);

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

  const applyPose = (angle: number, scale: number, translateY: number) => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transform = `translateY(${translateY}px) scale(${scale}) rotateY(${angle}deg)`;

    // Mid-flip thickness: narrow + soft shadow near 90° within each half-turn
    const phase = Math.abs(((angle % 180) + 180) % 180);
    const mid = 1 - Math.abs(phase - 90) / 90;
    const shadow = shadowRef.current;
    if (shadow) {
      shadow.style.opacity = String(0.42 - mid * 0.28);
      shadow.style.transform = `translateX(-50%) scaleX(${1 - mid * 0.62}) scaleY(${1 - mid * 0.08})`;
    }
  };

  const applyCrossfade = (opacityFront: number, opacityBack: number) => {
    if (frontFaceRef.current) frontFaceRef.current.style.opacity = String(opacityFront);
    if (backFaceRef.current) backFaceRef.current.style.opacity = String(opacityBack);
    if (innerRef.current) {
      // Stacked faces only — no 3D spin when motion is reduced
      innerRef.current.style.transform = "none";
    }
  };

  const resetPose = (angle = 0) => {
    angleRef.current = angle;
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
    applyPose(angle, 1, 0);
  };

  const playShine = () => {
    if (!rare) return;
    setShining(true);
    AudioManager.playSfx("reveal-rare", { volume: 0.5 });
    window.clearTimeout(shineTimerRef.current);
    shineTimerRef.current = window.setTimeout(() => setShining(false), SHINE_MS);
  };

  const flipTo = (dir: 1 | -1) => {
    if (flippingRef.current) return;
    flippingRef.current = true;

    const from = angleRef.current;
    const to = from + dir * 180;
    const willShowBack = isBackFace(to);

    AudioManager.playSfx("card-flip");
    lightVibrate(10);

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
        angleRef.current = willShowBack ? 180 : 0;
        setShowingBack(willShowBack);
        flippingRef.current = false;
        if (rare) playShine();
      };
      rafRef.current = requestAnimationFrame(tickFade);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      let scale = 1;
      let translateY = 0;
      let angle = from;

      if (elapsed < LIFT_MS) {
        const p = elapsed / LIFT_MS;
        scale = 1 + 0.04 * p;
        translateY = -6 * p;
        angle = from;
      } else if (elapsed < ROTATE_END_MS) {
        const p = easeFlip((elapsed - LIFT_MS) / (ROTATE_END_MS - LIFT_MS));
        scale = 1.04;
        translateY = -6;
        angle = from + (to - from) * p;
      } else {
        const p = Math.min(1, (elapsed - ROTATE_END_MS) / BOUNCE_MS);
        scale = bounceScale(p);
        translateY = -6 * (1 - p);
        angle = to;
      }

      applyPose(angle, scale, translateY);

      if (elapsed < TOTAL_FLIP_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      angleRef.current = to;
      setShowingBack(willShowBack);
      applyPose(to, 1, 0);
      flippingRef.current = false;
      if (rare) playShine();
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 240);
  };

  useEffect(() => {
    reduceMotionRef.current = shouldReduceMenuMotion();
    cancelAnimationFrame(rafRef.current);
    flippingRef.current = false;
    dragTiltRef.current = 0;
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
    if (flippingRef.current) return;
    if (event.button != null && event.button !== 0) return;
    pointerIdRef.current = event.pointerId;
    startX.current = event.clientX;
    startY.current = event.clientY;
    dragKind.current = "card";
    draggingRef.current = false;
    dragTiltRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragKind.current !== "card" || flippingRef.current) return;
    if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;

    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (!draggingRef.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
        // Vertical intent — don't steal for flip tilt
        dragKind.current = null;
        return;
      }
      draggingRef.current = true;
    }

    if (reduceMotionRef.current) return;

    const width = cardRef.current?.clientWidth || 220;
    const tilt = Math.max(-DRAG_MAX_DEG, Math.min(DRAG_MAX_DEG, (dx / width) * DRAG_MAX_DEG * 2));
    dragTiltRef.current = tilt;
    applyPose(angleRef.current + tilt, 1.02, -3);
  };

  const onCardPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragKind.current !== "card") return;
    dragKind.current = null;
    if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;

    if (flippingRef.current) return;

    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    const width = cardRef.current?.clientWidth || 220;

    if (draggingRef.current) {
      draggingRef.current = false;
      const ratio = dx / width;
      if (Math.abs(ratio) >= DRAG_FLIP_RATIO) {
        flipTo(dx > 0 ? 1 : -1);
        return;
      }
      if (Math.abs(dx) >= SWIPE_PT && Math.abs(dx) > Math.abs(dy)) {
        flipTo(dx > 0 ? 1 : -1);
        return;
      }
      // Spring back
      if (!reduceMotionRef.current) {
        applyPose(angleRef.current, 1, 0);
      }
      dragTiltRef.current = 0;
      return;
    }

    // Tap
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      flipTo(1);
    }
  };

  const onCardPointerCancel = () => {
    dragKind.current = null;
    pointerIdRef.current = null;
    if (draggingRef.current && !flippingRef.current && !reduceMotionRef.current) {
      applyPose(angleRef.current, 1, 0);
    }
    draggingRef.current = false;
    dragTiltRef.current = 0;
  };

  const onFlipClick = () => {
    if (flippingRef.current) return;
    flipTo(1);
  };

  // Keep onChangeCard available for future nav; suppress unused lint by referencing in dots
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
