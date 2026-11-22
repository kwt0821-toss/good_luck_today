import { useEffect, useState } from "react";

import { BannerAdSlot } from "./BannerAdSlot";
import { dealRemainLabel } from "../lib/roomDeals";
import { roomAsset } from "../lib/roomCatalog";
import type { DealList } from "../lib/serverWallet";
import type { RoomItem } from "../lib/roomTypes";

type Props = {
  deals: DealList;
  itemsById: Map<string, RoomItem>;
  refreshing: boolean;
  onBuy: (itemId: string) => void;
  onRefresh: () => void;
};

export function RoomDealTab({ deals, itemsById, refreshing, onBuy, onRefresh }: Props) {
  const [remain, setRemain] = useState(() => dealRemainLabel(deals.resetAt));

  useEffect(() => {
    const tick = () => setRemain(dealRemainLabel(deals.resetAt));
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [deals.resetAt]);

  return (
    <div className="lucky-deal">
      <p className="lucky-deal-head">
        매일 밤 12시에 바뀌어요
        {remain ? <span> · 남은 시간 {remain}</span> : null}
      </p>
      <div className="lucky-deal-row">
        {deals.items.map((deal) => {
          const item = itemsById.get(deal.itemId);
          const special = deal.pct === 30;
          return (
            <button
              key={deal.itemId}
              type="button"
              className={`lucky-deal-card${deal.bought ? " is-bought" : ""}${special ? " is-special" : ""}`}
              disabled={deal.bought}
              onClick={() => onBuy(deal.itemId)}
            >
              {special ? <span className="lucky-deal-ribbon">특가</span> : null}
              {deal.pct != null ? <span className="lucky-deal-pct">{deal.pct}%</span> : null}
              <span className="lucky-deal-art">
                {item?.tileImage ? <img src={roomAsset(item.tileImage)} alt="" /> : null}
              </span>
              <span className="lucky-deal-name">{item?.nameKo ?? deal.itemId}</span>
              {deal.bought ? (
                <span className="lucky-deal-done">오늘 할인 구매 완료</span>
              ) : (
                <span className="lucky-deal-price">
                  <s>{deal.price.toLocaleString("ko-KR")}</s>
                  <b>
                    <img src={roomAsset("ui/icon-paw-point.svg")} alt="" />
                    {deal.salePrice.toLocaleString("ko-KR")}
                  </b>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="lucky-deal-refresh"
        disabled={refreshing || deals.refreshesLeft <= 0}
        onClick={onRefresh}
      >
        광고 보고 다시 고르기 (오늘 1번)
      </button>
      <BannerAdSlot placement="roomDeal" />
    </div>
  );
}
