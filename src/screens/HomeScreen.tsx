import { TopNavigation } from "@toss/tds-mobile";
import { useState } from "react";

import { SleepingLuckyCat } from "../components/SleepingLuckyCat";
import { formatLuckyCatalogDate } from "../lib/date";
import { isInTossApp } from "../lib/native";
import type { Cat, DrawResult } from "../types";

const ICONS = {
  menu: "/home-icons/menu.png",
  draws: "/home-icons/draws.png",
  date: "/home-icons/date.png",
  collection: "/home-icons/collection.png",
  room: "/home-icons/room.png",
} as const;

type HomeScreenProps = {
  pinkJellyBalance: number;
  hasDrawnToday: boolean;
  remainingRerolls: number;
  todayCat: Cat | null;
  lastResult: DrawResult | null;
  onDraw: () => void;
  onOpenResult: () => void;
  onOpenCollection: () => void;
  onOpenRoom: () => void;
};

export function HomeScreen({
  pinkJellyBalance,
  hasDrawnToday,
  remainingRerolls,
  todayCat,
  lastResult,
  onDraw,
  onOpenResult,
  onOpenCollection,
  onOpenRoom,
}: HomeScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const remainingDraws = hasDrawnToday ? remainingRerolls : 1;
  const dateLabel = formatLuckyCatalogDate();

  const handleCatTap = () => {
    if (!hasDrawnToday) {
      onDraw();
      return;
    }
    if (lastResult) onOpenResult();
  };

  return (
    <div className="screen screen--night">
      {isInTossApp() ? null : (
        <div className="lucky-chrome">
          <TopNavigation withSafeAreaTop={false} content="럭키캣" />
        </div>
      )}

      <div className="lucky-home">
        <span className="lucky-star lucky-star-a" aria-hidden="true" />
        <span className="lucky-star lucky-star-b" aria-hidden="true" />
        <span className="lucky-star lucky-star-c" aria-hidden="true" />
        <span className="lucky-star lucky-star-d" aria-hidden="true" />

        <header className="lucky-hero">
          <h1 className="lucky-title">
            <span className="lucky-title-fill">LUCKY</span>
            <span className="lucky-title-outline">CAT.</span>
          </h1>
          <div className="lucky-menu-wrap">
            <button
              type="button"
              className="lucky-icon-btn lucky-menu-btn"
              aria-expanded={menuOpen}
              aria-label="메뉴"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <img src={ICONS.menu} alt="" width={40} height={40} draggable={false} />
              <span>메뉴</span>
            </button>
            {menuOpen ? (
              <div className="lucky-menu-pop" role="menu">
                <p>핑크젤리 {pinkJellyBalance.toLocaleString("ko-KR")}</p>
                {todayCat && lastResult ? (
                  <button type="button" onClick={onOpenResult}>
                    오늘의 카드
                  </button>
                ) : null}
                <button type="button" onClick={onOpenCollection}>
                  도감
                </button>
                <button type="button" onClick={onOpenRoom}>
                  방꾸미기
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="lucky-draws">
          <span className="lucky-draws-pill">
            <img src={ICONS.draws} alt="" width={12} height={12} draggable={false} />
            오늘 남은 뽑기 {remainingDraws}
          </span>
        </div>

        <div className="lucky-meta">
          <p>고양이가 골라 주는 오늘의 행운</p>
          <p className="lucky-date">
            <img src={ICONS.date} alt="" width={16} height={16} draggable={false} />
            <span>{dateLabel}</span>
          </p>
        </div>

        <button
          type="button"
          className="lucky-stage"
          onClick={handleCatTap}
          aria-label={hasDrawnToday ? "오늘의 카드 보기" : "고양이 톡해서 오늘의 카드 받기"}
        >
          <SleepingLuckyCat />
        </button>

        <p className="lucky-cta">
          {hasDrawnToday
            ? remainingRerolls > 0
              ? "톡, 카드를 다시 열어볼까요"
              : "오늘은 이미 카드를 받았어요"
            : "톡, 깨워서 오늘의 카드 받기"}
        </p>
        <p className="lucky-cta-en">{hasDrawnToday ? "TAP TO OPEN TODAY'S CARD" : "TAP THE CAT TO DRAW"}</p>

        <nav className="lucky-nav">
          <button type="button" className="lucky-icon-btn" onClick={onOpenCollection}>
            <img src={ICONS.collection} alt="" width={44} height={44} draggable={false} />
            <span>도감</span>
          </button>
          <button type="button" className="lucky-icon-btn" onClick={onOpenRoom}>
            <img src={ICONS.room} alt="" width={44} height={44} draggable={false} />
            <span>방꾸미기</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
