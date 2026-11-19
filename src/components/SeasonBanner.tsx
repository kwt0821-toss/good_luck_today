import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cardThumbUrl } from "../lib/cardArt";
import { loadDexCatalog } from "../lib/dexCatalog";
import { jellyLabel } from "../lib/jellyLabel";
import { loadOpsConfig } from "../lib/opsConfig";
import {
  formatSeasonPercent,
  seasonActive,
  seasonCards,
  seasonCountdown,
  seasonRate,
} from "../lib/season";
import type { DexCard } from "../lib/dexTypes";
import type { SeasonEventConfig } from "../lib/opsTypes";
import "./SeasonBanner.css";

export function SeasonBanner() {
  const [event, setEvent] = useState<SeasonEventConfig | null>(null);
  const [cards, setCards] = useState<DexCard[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    void Promise.all([loadOpsConfig(), loadDexCatalog()]).then(([config, catalog]) => {
      if (!alive) return;
      const active = seasonActive(config.economy);
      setEvent(active);
      setCards(active ? seasonCards(catalog, active) : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!event) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [event]);

  if (!event) return null;
  const per = seasonRate(event, false) / (event.cardIds.length || 1);
  const perUp = seasonRate(event, true) / (event.cardIds.length || 1);

  return (
    <>
      <button type="button" className="season-banner" onClick={() => setOpen(true)}>
        <span className="season-banner-kicker">시즌</span>
        <span className="season-banner-name">{event.nameKo}</span>
        <span className="season-banner-time">{seasonCountdown(event, new Date(now))} 남음</span>
      </button>
      {open
        ? createPortal(
        <div className="season-sheet" role="presentation">
          <button type="button" className="season-sheet-back" aria-label="닫기" onClick={() => setOpen(false)} />
          <div className="season-sheet-card" role="dialog" aria-labelledby="season-sheet-title">
            <p className="season-sheet-kicker">시즌 한정</p>
            <h2 id="season-sheet-title">{event.nameKo}</h2>
            <p className="season-sheet-time">{seasonCountdown(event, new Date(now))} 남았어요</p>
            <div className="season-sheet-cards">
              {cards.map((card) => (
                <figure key={card.id}>
                  <img src={cardThumbUrl(card)} alt="" />
                  <figcaption>{card.name?.ko}</figcaption>
                </figure>
              ))}
            </div>
            <p className="season-sheet-line">
              일반 {formatSeasonPercent(seasonRate(event, false))} (장당 {formatSeasonPercent(per)}) · 확률업{" "}
              {formatSeasonPercent(seasonRate(event, true))} (장당 {formatSeasonPercent(perUp)})
            </p>
            <p className="season-sheet-line">
              출석 7일 선물은 아직 없는 시즌 카드 1장이에요. 다섯 장을 다 모았으면{" "}
              {jellyLabel(event.attend7Gift?.fallbackPaw ?? 0)}이에요.
            </p>
            <p className="season-sheet-line">시즌이 끝나면 못 모은 카드는 다음 시즌에 다시 만나요.</p>
            <button type="button" className="season-sheet-go" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
