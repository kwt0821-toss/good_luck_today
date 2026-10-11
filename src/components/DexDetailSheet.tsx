import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import { cardDisplayName, cardKoreanName, dexAsset, formatMetDate } from "../lib/dexCatalog";
import type { DexCard, DexOwnedMap } from "../lib/dexTypes";

type DexDetailSheetProps = {
  card: DexCard;
  group: DexCard[];
  owned: DexOwnedMap;
  onClose: () => void;
  onChangeCard: (card: DexCard) => void;
};

export function DexDetailSheet({ card, group, owned, onClose, onChangeCard }: DexDetailSheetProps) {
  const [flipped, setFlipped] = useState(false);
  const [closing, setClosing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [settled, setSettled] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragKind = useRef<"close" | "swipe" | null>(null);
  const ignoreFlipClick = useRef(false);
  const record = owned[card.id];
  const ownedInGroup = group.filter((item) => (owned[item.id]?.count ?? 0) > 0);
  const ownedCount = ownedInGroup.length;
  const total = group.length;
  const ko = cardKoreanName(card);
  const met = record ? formatMetDate(record.firstSeen) : null;

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

  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 240);
  };

  const goOwned = (dir: 1 | -1) => {
    const index = ownedInGroup.findIndex((item) => item.id === card.id);
    if (index < 0 || ownedInGroup.length < 2) return;
    const next = ownedInGroup[(index + dir + ownedInGroup.length) % ownedInGroup.length];
    setFlipped(false);
    onChangeCard(next);
  };

  useEffect(() => {
    setFlipped(false);
  }, [card.id]);

  useEffect(() => {
    const arm = window.setTimeout(() => setArmed(true), 280);
    const settle = window.setTimeout(() => setSettled(true), 420);
    return () => {
      window.clearTimeout(arm);
      window.clearTimeout(settle);
    };
  }, []);

  const onHandlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    startY.current = event.clientY;
    dragKind.current = "close";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragKind.current !== "close") return;
    dragKind.current = null;
    const dy = event.clientY - startY.current;
    const dx = event.clientX - startX.current;
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) close();
  };

  const onCardPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    startY.current = event.clientY;
    dragKind.current = "swipe";
    ignoreFlipClick.current = false;
  };

  const onCardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragKind.current !== "swipe") return;
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      ignoreFlipClick.current = true;
      dragKind.current = null;
      goOwned(dx < 0 ? 1 : -1);
    }
  };

  const onCardPointerUp = () => {
    if (dragKind.current === "swipe") dragKind.current = null;
  };

  const onFlipClick = () => {
    if (ignoreFlipClick.current) {
      ignoreFlipClick.current = false;
      return;
    }
    setFlipped((value) => !value);
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

        <div
          className="dex-flip-stage"
          onPointerDown={onCardPointerDown}
          onPointerMove={onCardPointerMove}
          onPointerUp={onCardPointerUp}
          onPointerCancel={onCardPointerUp}
        >
          <div className="dex-card-glow" />
          <button
            type="button"
            className={`dex-flip ${flipped ? "is-flipped" : ""}`}
            onClick={onFlipClick}
            aria-label={flipped ? "앞면 보기" : "뒷면 보기"}
          >
            <div className="dex-flip-inner">
              <img className="dex-flip-face is-front" src={dexAsset(card.front)} alt={`${cardDisplayName(card)} 앞면`} />
              <img className="dex-flip-face is-back" src={dexAsset(card.back)} alt={`${cardDisplayName(card)} 뒷면`} />
            </div>
          </button>
          <button type="button" className="dex-flip-btn" aria-label="카드 뒤집기" onClick={onFlipClick}>
            <img src={dexAsset("icons/icon-flip.svg")} alt="" />
          </button>
        </div>

        <p className="dex-flip-hint">
          <span>톡,</span> {flipped ? "뒤집어서 앞면 보기" : "뒤집어서 뒷면 보기"}
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

        <div className="dex-dots" aria-hidden="true">
          {group.map((item) => (
            <span
              key={item.id}
              className={`dex-dot ${item.id === card.id ? "is-active" : ""} ${owned[item.id] ? "" : "is-locked"}`}
            />
          ))}
        </div>
      </div>
    </div>,
    host,
  );
}
