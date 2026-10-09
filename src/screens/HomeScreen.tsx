import { useRef, useState } from "react";

import { formatLuckyCatalogDate } from "../lib/date";

const ASSETS = {
  bg: "/assets/main/bg-night-base.webp",
  moon: "/assets/main/moon-glow.png",
  menu: "/assets/main/icon-menu-paw.svg",
  dex: "/assets/main/icon-dex-book.svg",
  room: "/assets/main/icon-room-house.svg",
  tail: "/assets/main/cat-tail.png",
  card: "/assets/main/card-facedown.png",
  cat: "/assets/main/cat-body.png",
} as const;

type HomeScreenProps = {
  remainingDraws: number;
  onDraw: () => void;
  onOpenMenu: () => void;
  onOpenCollection: () => void;
  onOpenRoom: () => void;
};

export function HomeScreen({
  remainingDraws,
  onDraw,
  onOpenMenu,
  onOpenCollection,
  onOpenRoom,
}: HomeScreenProps) {
  const [waking, setWaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const wakeTimer = useRef<number>(0);
  const noticeTimer = useRef<number>(0);
  const dateLabel = formatLuckyCatalogDate();
  const drawsDone = remainingDraws <= 0;

  const showNotice = (message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1800);
  };

  const handleDrawTap = () => {
    if (drawsDone) {
      showNotice("내일 다시 만나요");
      return;
    }
    if (waking) return;
    setWaking(true);
    window.clearTimeout(wakeTimer.current);
    wakeTimer.current = window.setTimeout(() => {
      setWaking(false);
      onDraw();
    }, 480);
  };

  return (
    <div className="main-screen">
      <img className="main-bg" src={ASSETS.bg} alt="" />

      <header className="main-header">
        <h1 className="main-logo">
          <svg viewBox="0 0 252 96" role="img" aria-label="LUCKY CAT.">
            <text
              x="2"
              y="42"
              fill="#F3EBD7"
              fontFamily="Poppins, 'Noto Sans KR', sans-serif"
              fontSize="42"
              fontWeight="800"
              letterSpacing="-1.4"
            >
              LUCKY
            </text>
            <text
              x="2"
              y="90"
              fill="#221E3A"
              stroke="#F3EBD7"
              strokeWidth="2.3"
              paintOrder="stroke fill"
              fontFamily="Poppins, 'Noto Sans KR', sans-serif"
              fontSize="42"
              fontWeight="800"
              letterSpacing="-0.8"
            >
              CAT.
            </text>
          </svg>
        </h1>
        <button type="button" className="main-nav-btn main-menu-btn" aria-label="메뉴" onClick={onOpenMenu}>
          <img src={ASSETS.menu} alt="" width={28} height={28} />
          <span>메뉴</span>
        </button>
      </header>

      <button
        type="button"
        className={`main-chip ${drawsDone ? "is-done" : ""}`}
        aria-label={drawsDone ? "오늘 뽑기 완료" : `오늘 남은 뽑기 ${remainingDraws}`}
        onClick={() => {
          if (drawsDone) showNotice("내일 다시 만나요");
        }}
      >
        <span className="main-chip-dot" aria-hidden="true" />
        {drawsDone ? "오늘 뽑기 완료" : `오늘 남은 뽑기 ${remainingDraws}`}
      </button>

      <div className="main-rule" aria-hidden="true" />

      <div className="main-meta">
        <p>고양이가 골라 주는 오늘의 행운</p>
        <p className="main-date">{dateLabel}</p>
      </div>

      <button
        type="button"
        className={`main-stage ${waking ? "is-waking" : ""}`}
        aria-label={drawsDone ? "오늘은 이미 뽑았어요" : "고양이 톡해서 오늘의 카드 받기"}
        onClick={handleDrawTap}
      >
        <img className="main-moon" src={ASSETS.moon} alt="" />
        <div className="main-float">
          <img className="main-tail" src={ASSETS.tail} alt="" />
          <div className="main-card-shadow" aria-hidden="true" />
          <img className="main-card" src={ASSETS.card} alt="뒤집힌 행운 카드" />
          <img className="main-cat" src={ASSETS.cat} alt="잠자는 고양이" />
          <div className="main-zzz" aria-hidden="true">
            <span>z</span>
            <span>z</span>
            <span>z</span>
          </div>
        </div>
      </button>

      <p className="main-cta">
        <span className="main-cta-accent">톡,</span> 깨워서 오늘의 카드 받기
      </p>
      <p className="main-cta-en">TAP THE CAT TO DRAW</p>

      <nav className="main-bottom">
        <button type="button" className="main-nav-btn" aria-label="도감" onClick={onOpenCollection}>
          <img src={ASSETS.dex} alt="" width={28} height={28} />
          <span>도감</span>
        </button>
        <button type="button" className="main-nav-btn" aria-label="방꾸미기" onClick={onOpenRoom}>
          <img src={ASSETS.room} alt="" width={28} height={28} />
          <span>방꾸미기</span>
        </button>
      </nav>

      {notice ? (
        <div className="local-toast" role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
