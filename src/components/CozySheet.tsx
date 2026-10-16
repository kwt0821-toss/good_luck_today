import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { loadOpsConfig } from "../lib/opsConfig";
import type { OpsEconomy, OpsPrices, PriceTier } from "../lib/opsTypes";
import {
  COZY_SHEET_TIER_LABEL,
  COZY_SHEET_TIER_ORDER,
  getRoomCozy,
  type RoomCozyResponse,
} from "../lib/roomCozy";
import { roomAsset } from "../lib/roomCatalog";
import "./CozySheet.css";

type CozySheetProps = {
  open: boolean;
  onClose: () => void;
  /** Open decorating drawer on a shop tab (가구). */
  onBrowseItems: () => void;
};

type TierCard = {
  tier: PriceTier;
  label: string;
  points: number;
  dupLabel: string;
};

/** Only tiers that have at least one priced item (legend excluded from the sheet). */
function buildTierCards(economy: OpsEconomy, prices: OpsPrices): TierCard[] {
  const present = new Set(
    prices.items.map((item) => item.tier).filter((tier): tier is PriceTier => Boolean(tier)),
  );
  return COZY_SHEET_TIER_ORDER.filter((tier) => tier !== "legend" && present.has(tier)).map(
    (tier) => {
      const points = economy.cozy.pointsPerTier[tier] ?? 0;
      const dup = economy.cozy.duplicatePointsPerTier?.[tier];
      const dupLabel = tier === "tile" || dup == null ? "1번" : `+${dup}`;
      return {
        tier,
        label: COZY_SHEET_TIER_LABEL[tier],
        points,
        dupLabel,
      };
    },
  );
}

export function CozySheet({ open, onClose, onBrowseItems }: CozySheetProps) {
  const [status, setStatus] = useState<RoomCozyResponse | null>(null);
  const [cards, setCards] = useState<TierCard[]>([]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      return;
    }
    let cancelled = false;
    void Promise.all([getRoomCozy(), loadOpsConfig()]).then(([cozy, config]) => {
      if (cancelled) return;
      setStatus(cozy);
      setCards(buildTierCards(config.economy, config.prices));
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const level = status?.level ?? 1;
  const points = status?.cozyPoints ?? 0;
  const curMin = status?.curMin ?? 0;
  const nextMin = status?.nextMin ?? 100;
  const span = Math.max(1, nextMin - curMin);
  const progress = Math.max(0, Math.min(1, (points - curMin) / span));
  const remain = Math.max(0, nextMin - points);

  const onPointerDown = (event: ReactPointerEvent) => {
    drag.current = { y: event.clientY, dy: 0 };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag.current) return;
    const dy = Math.max(0, event.clientY - drag.current.y);
    drag.current.dy = dy;
    setDragY(dy);
  };

  const onPointerUp = () => {
    const dy = drag.current?.dy ?? 0;
    drag.current = null;
    if (dy > 90) {
      onClose();
      return;
    }
    setDragY(0);
  };

  return (
    <div className="cozy-sheet-root" role="presentation">
      <button type="button" className="cozy-sheet-dim" aria-label="닫기" onClick={onClose} />
      <div
        ref={sheetRef}
        className="cozy-sheet"
        role="dialog"
        aria-label="COZY 레벨"
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="cozy-sheet-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="cozy-sheet-hero">
          <span className="cozy-sheet-kicker">COZY</span>
          <div className="cozy-sheet-lv">
            <small>Lv.</small>
            {level}
          </div>
          <div className="cozy-sheet-bar" aria-hidden="true">
            <b style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="cozy-sheet-row">
            <span>
              {points} / {nextMin}점
            </span>
            <span>
              Lv.{level + 1}까지 <b>{remain}점 남았어요</b>
            </span>
          </div>
        </div>

        <p className="cozy-sheet-h">아이템마다 코지 점수가 올라요</p>
        <div className="cozy-sheet-grid">
          {cards.map((card) => (
            <div key={card.tier} className="cozy-sheet-tier">
              <div className="cozy-sheet-tier-n">{card.label}</div>
              <div className="cozy-sheet-tier-p">{card.points}</div>
              <div className="cozy-sheet-tier-d">{card.dupLabel}</div>
            </div>
          ))}
        </div>

        <div className="cozy-sheet-notes">
          <div className="cozy-sheet-nt">
            <span aria-hidden="true">½</span>
            같은 아이템을 더 사면 절반 점수 (초록 숫자)
          </div>
          <div className="cozy-sheet-nt">
            <span aria-hidden="true">
              <img src={roomAsset("ui/icon-paw-point.svg")} alt="" />
            </span>
            방에 놓지 않아도 가지고 있으면 점수가 올라요
          </div>
        </div>

        <button
          type="button"
          className="cozy-sheet-cta"
          onClick={() => {
            onClose();
            onBrowseItems();
          }}
        >
          <img src={roomAsset("ui/icon-paw-coin.svg")} alt="" width={20} height={20} />
          아이템 보러가기
        </button>
      </div>
    </div>
  );
}
