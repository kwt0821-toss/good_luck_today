import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import { AudioManager } from "../audio/AudioManager";
import { cardBackUrl, cardLargeUrl, cardThumbUrl, decodeImage } from "../lib/cardArt";
import { resolveFrame } from "../lib/cardFrames";
import { CardFrame } from "./CardFrame";
import { CardFlipStack, CardViewer } from "./CardViewer";
import {
  cardDisplayName,
  cardFortune,
  cardKoreanName,
  dexAsset,
  formatCardDexNo,
  formatMetDate,
} from "../lib/dexCatalog";
import { loadMenuSettings, shouldReduceMenuMotion } from "../lib/menuSettings";
import type { DexCard, DexOwnedMap } from "../lib/dexTypes";

type DupConvertPhase = "idle" | "stepper" | "confirm";

type DexDetailSheetProps = {
  card: DexCard;
  group: DexCard[];
  owned: DexOwnedMap;
  /** Paw points per duplicate card (economy.pawSources.duplicateConvert). */
  dupUnitPaw?: number;
  onClose: () => void;
  onChangeCard: (card: DexCard) => void;
  /** Convert `qty` duplicates (keeps 1). */
  onConvertDuplicate?: (card: DexCard, qty: number) => void | Promise<void>;
};

const FLIP_MS = 450;
const CROSSFADE_MS = 200;
const SHINE_MS = 380;

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

function preloadLarge(card: DexCard) {
  void decodeImage(cardLargeUrl(card)).catch(() => undefined);
  void decodeImage(cardThumbUrl(card)).catch(() => undefined);
  void decodeImage(cardBackUrl(card)).catch(() => undefined);
}

export function DexDetailSheet({
  card,
  group,
  owned,
  dupUnitPaw = 0,
  onClose,
  onChangeCard,
  onConvertDuplicate,
}: DexDetailSheetProps) {
  const [closing, setClosing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [showingBack, setShowingBack] = useState(false);
  const [shining, setShining] = useState(false);
  const [dupPhase, setDupPhase] = useState<DupConvertPhase>("idle");
  const [dupQty, setDupQty] = useState(1);
  const [dupBusy, setDupBusy] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const frontFaceRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);

  const angleRef = useRef(0);
  const spinningRef = useRef(false);
  const flipTimerRef = useRef(0);
  const shineTimerRef = useRef(0);
  const reduceMotionRef = useRef(shouldReduceMenuMotion());

  const startX = useRef(0);
  const startY = useRef(0);
  const dragKind = useRef<"close" | null>(null);

  const record = owned[card.id];
  const ownedInGroup = group.filter((item) => (owned[item.id]?.count ?? 0) > 0);
  const ownedCount = ownedInGroup.length;
  const ownedIndex = ownedInGroup.findIndex((item) => item.id === card.id);
  const total = group.length;
  const ko = cardKoreanName(card);
  const fortune = cardFortune(card.id);
  const met = record ? formatMetDate(record.firstSeen) : null;
  const rare = isRareCard(card);
  const legend = card.type === "legend";
  const dupCount = Math.max(0, (record?.count ?? 0) - 1);
  const dupPawTotal = dupUnitPaw * dupQty;

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

  const onFlipClick = () => {
    if (spinningRef.current) return;
    const to = isBackFace(angleRef.current) ? 0 : 180;
    const willShowBack = isBackFace(to);
    spinningRef.current = true;
    setShowingBack(willShowBack);
    AudioManager.playSfx("card-flip");

    if (reduceMotionRef.current) {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / CROSSFADE_MS);
        if (willShowBack) {
          if (frontFaceRef.current) frontFaceRef.current.style.opacity = String(1 - t);
          if (backFaceRef.current) backFaceRef.current.style.opacity = String(t);
        } else {
          if (frontFaceRef.current) frontFaceRef.current.style.opacity = String(t);
          if (backFaceRef.current) backFaceRef.current.style.opacity = String(1 - t);
        }
        if (t < 1) {
          requestAnimationFrame(tick);
          return;
        }
        onLand(to);
      };
      requestAnimationFrame(tick);
      return;
    }

    const inner = innerRef.current;
    if (!inner) {
      spinningRef.current = false;
      return;
    }
    inner.style.transition = "transform .45s cubic-bezier(.3,.7,.2,1.1)";
    applyPose(to, 1, 0, 0, 0);
    window.clearTimeout(flipTimerRef.current);
    flipTimerRef.current = window.setTimeout(() => {
      if (innerRef.current) innerRef.current.style.transition = "";
      onLand(to);
    }, FLIP_MS + 20);
  };

  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 240);
  };

  useEffect(() => {
    reduceMotionRef.current = shouldReduceMenuMotion();
    window.clearTimeout(flipTimerRef.current);
    spinningRef.current = false;
    setShining(false);
    resetPose(0);
    const maxDup = Math.max(0, (owned[card.id]?.count ?? 0) - 1);
    setDupPhase("idle");
    setDupBusy(false);
    setDupQty(Math.max(1, maxDup));
    // Reset when switching cards or after ownership count changes (post-convert).
  }, [card.id, card.front, card.back, owned[card.id]?.count]);

  const preloadKey = (() => {
    const ownedCards = group.filter((item) => (owned[item.id]?.count ?? 0) > 0);
    const index = ownedCards.findIndex((item) => item.id === card.id);
    return [ownedCards[index - 1]?.id ?? "", card.id, ownedCards[index + 1]?.id ?? ""].join("|");
  })();

  useEffect(() => {
    const ids = preloadKey.split("|").filter(Boolean);
    const byId = new Map(group.map((item) => [item.id, item]));
    for (const id of ids) {
      const item = byId.get(id);
      if (item) preloadLarge(item);
    }
    // group is read for the ids in preloadKey; the key changes when the open card or its neighbors change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- group identity changes every render
  }, [preloadKey]);

  useEffect(() => {
    const arm = window.setTimeout(() => setArmed(true), 280);
    const settle = window.setTimeout(() => setSettled(true), 420);
    return () => {
      window.clearTimeout(arm);
      window.clearTimeout(settle);
      window.clearTimeout(shineTimerRef.current);
      window.clearTimeout(flipTimerRef.current);
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

  const swipeToOwned = (direction: "prev" | "next") => {
    const step = direction === "next" ? 1 : -1;
    const next = ownedInGroup[ownedIndex + step];
    if (!next) return;
    window.clearTimeout(flipTimerRef.current);
    spinningRef.current = false;
    resetPose(0);
    onChangeCard(next);
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

        <CardViewer
          line={fortune}
          accentColor={resolveFrame(card).nameColor}
          showingBack={showingBack}
          onFlip={onFlipClick}
          swipe={{
            canPrev: ownedIndex > 0,
            canNext: ownedIndex >= 0 && ownedIndex < ownedCount - 1,
            onSwipe: swipeToOwned,
          }}
          renderZoom={() => (
            <CardFlipStack
              showingBack={showingBack}
              front={
                <CardFrame
                  card={card}
                  artId={card.id}
                  catSrc={cardLargeUrl(card)}
                  thumbSrc={cardThumbUrl(card)}
                  name={cardKoreanName(card) || cardDisplayName(card)}
                  dexNo={formatCardDexNo(card.id)}
                />
              }
              back={<img src={cardBackUrl(card)} alt="" draggable={false} />}
            />
          )}
        >
        <div className="dex-flip-stage">
          <div className="dex-flip-stage-tilt">
            <div className="dex-card-glow" />
            <div
              ref={cardRef}
              className={`card dex-card ${reduceMotionRef.current ? "is-reduced" : ""}`}
              role="button"
              tabIndex={0}
              aria-label="카드 크게 보기"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
            >
              <div ref={shadowRef} className="dex-card-depth" aria-hidden="true" />
              <div ref={innerRef} className="card-inner dex-card-inner">
                <div ref={frontFaceRef} className="face front dex-face">
                  <CardFrame
                    card={card}
                    artId={card.id}
                    catSrc={cardLargeUrl(card)}
                  thumbSrc={cardThumbUrl(card)}
                    name={cardKoreanName(card) || cardDisplayName(card)}
                    dexNo={formatCardDexNo(card.id)}
                  />
                </div>
                <div ref={backFaceRef} className="face back dex-face">
                  <img src={cardBackUrl(card)} alt={`${cardDisplayName(card)} 뒷면`} draggable={false} />
                </div>
              </div>
              <div
                className={`dex-card-shine ${shining ? "is-active" : ""} ${legend ? "is-legend" : ""}`}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
        </CardViewer>

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

        {dupCount > 0 && onConvertDuplicate && dupPhase === "idle" ? (
          <div className="dex-dup-block">
            <p className="dex-dup-meta">
              중복 {dupCount}장 · 1장당 {dupUnitPaw.toLocaleString("ko-KR")}P
            </p>
            <button
              type="button"
              id="dex-dup-convert"
              className="dex-convert-btn"
              onClick={() => {
                setDupQty(dupCount);
                setDupPhase("stepper");
              }}
            >
              발바닥 포인트로 바꾸기
            </button>
          </div>
        ) : null}

        {dupCount > 0 && onConvertDuplicate && dupPhase === "stepper" ? (
          <div className="dex-dup-stepper" role="group" aria-label="바꿀 장수">
            <p className="dex-dup-meta">도감에 1장은 남기고 바꿀 장수를 골라요</p>
            <div className="dex-dup-stepper-row">
              <button
                type="button"
                className="dex-dup-step-btn"
                aria-label="줄이기"
                disabled={dupQty <= 1}
                onClick={() => setDupQty((prev) => Math.max(1, prev - 1))}
              >
                −
              </button>
              <div className="dex-dup-step-value">
                <strong>{dupQty}</strong>
                <span>장</span>
              </div>
              <button
                type="button"
                className="dex-dup-step-btn"
                aria-label="늘리기"
                disabled={dupQty >= dupCount}
                onClick={() => setDupQty((prev) => Math.min(dupCount, prev + 1))}
              >
                +
              </button>
            </div>
            <p className="dex-dup-step-total">
              {dupQty}장 → {dupPawTotal.toLocaleString("ko-KR")}P
            </p>
            <div className="dex-dup-actions">
              <button type="button" className="dex-convert-btn is-secondary" onClick={() => setDupPhase("idle")}>
                취소
              </button>
              <button type="button" className="dex-convert-btn" onClick={() => setDupPhase("confirm")}>
                다음
              </button>
            </div>
          </div>
        ) : null}

        {dupCount > 0 && onConvertDuplicate && dupPhase === "confirm" ? (
          <div className="dex-dup-confirm" role="alertdialog" aria-label="중복 카드 바꾸기 확인">
            <p className="dex-dup-confirm-title">
              {dupQty}장을 {dupPawTotal.toLocaleString("ko-KR")}P로 바꿀까요?
            </p>
            <p className="dex-dup-meta">카드마다 1장은 도감에 남아요 · 바꾼 카드는 되돌릴 수 없어요</p>
            <div className="dex-dup-actions">
              <button
                type="button"
                className="dex-convert-btn is-secondary"
                disabled={dupBusy}
                onClick={() => setDupPhase("stepper")}
              >
                취소
              </button>
              <button
                type="button"
                className="dex-convert-btn"
                disabled={dupBusy}
                onClick={() => {
                  void (async () => {
                    if (dupBusy) return;
                    setDupBusy(true);
                    try {
                      await onConvertDuplicate(card, dupQty);
                      setDupPhase("idle");
                    } finally {
                      setDupBusy(false);
                    }
                  })();
                }}
              >
                {dupBusy ? "처리 중…" : "바꾸기"}
              </button>
            </div>
          </div>
        ) : null}

        {ownedIndex >= 0 ? (
          <p className="dex-pager" aria-label={`보유 카드 ${ownedIndex + 1} / ${ownedCount}`}>
            <b>{ownedIndex + 1}</b>
            <span aria-hidden="true"> / </span>
            <span>{ownedCount}</span>
          </p>
        ) : null}
      </div>
    </div>,
    host,
  );
}
