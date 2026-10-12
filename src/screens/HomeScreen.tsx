import { useEffect, useRef, useState, type MouseEvent } from "react";

import { formatCountdownHms, formatLuckyCatalogDate, msUntilNextKstMidnight } from "../lib/date";
import { shouldReduceMenuMotion } from "../lib/menuSettings";

const ASSETS = {
  bg: "/assets/main/bg-night-base.webp",
  moon: "/assets/main/moon-glow.png",
  menu: "/assets/main/icon-menu-paw.svg",
  dex: "/assets/main/icon-dex-book.svg",
  room: "/assets/main/icon-room-house.svg",
  tail: "/assets/main/cat-tail.png",
  card: "/assets/main/card-facedown.png",
  cat: "/assets/main/cat-body.png",
  paw: "/assets/room/ui/icon-paw-point.svg",
} as const;

const FLIP_MS = 180;
const SETTLE_MS = 240;
const NUDGE_MS = 2600;

type HomeScreenProps = {
  /** Remaining normal draws today (deck size). */
  remainingNormal: number;
  normalPerDay: number;
  remainingRateUp: number;
  rateUpTickets: number;
  useRateUpTicket: boolean;
  /** Long-ad seconds for rate-up tip (economy.draws.daily[slot=up].adSeconds). */
  rateUpAdSeconds?: number;
  remainingPawAds: number;
  pawBalance: number;
  /** True before any normal draw today. */
  firstDrawPending: boolean;
  rateNormalPct: string;
  rateUpPct: string;
  menuBadge?: boolean;
  onDraw: () => void;
  onRateUpDraw: () => void;
  onPawAd: () => void;
  onOpenMenu: () => void;
  onOpenCollection: () => void;
  onOpenRoom: () => void;
};

export function HomeScreen({
  remainingNormal,
  normalPerDay,
  remainingRateUp,
  rateUpTickets,
  useRateUpTicket,
  rateUpAdSeconds = 30,
  remainingPawAds,
  pawBalance,
  firstDrawPending,
  rateNormalPct,
  rateUpPct,
  menuBadge = false,
  onDraw,
  onRateUpDraw,
  onPawAd,
  onOpenMenu,
  onOpenCollection,
  onOpenRoom,
}: HomeScreenProps) {
  const [waking, setWaking] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(() => formatCountdownHms(msUntilNextKstMidnight()));
  const [nudge, setNudge] = useState(false);
  const wakeTimer = useRef(0);
  const noticeTimer = useRef(0);
  const navTimer = useRef(0);
  const navLock = useRef(false);
  const reduce = shouldReduceMenuMotion();
  const dateLabel = formatLuckyCatalogDate();
  const drawsDone = remainingNormal <= 0;
  const lowRemaining = remainingNormal === 1 || remainingNormal === 2;
  const deckCount = drawsDone ? 1 : remainingNormal;
  const showSparkle = firstDrawPending && remainingNormal > 0 && !reduce;

  useEffect(() => {
    if (!drawsDone) return;
    const tick = () => setCountdown(formatCountdownHms(msUntilNextKstMidnight()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [drawsDone]);

  useEffect(() => {
    if (!lowRemaining || reduce || drawsDone) {
      setNudge(false);
      return;
    }
    const id = window.setInterval(() => {
      setNudge(true);
      window.setTimeout(() => setNudge(false), 420);
    }, NUDGE_MS);
    return () => window.clearInterval(id);
  }, [lowRemaining, reduce, drawsDone]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1800);
  };

  const popThen = (action: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
    if (navLock.current) return;
    navLock.current = true;
    const btn = event.currentTarget;
    btn.classList.remove("is-pop");
    void btn.offsetWidth;
    btn.classList.add("is-pop");
    window.clearTimeout(navTimer.current);
    navTimer.current = window.setTimeout(() => {
      navLock.current = false;
      action();
    }, 220);
  };

  const handleDrawTap = () => {
    if (drawsDone) {
      showNotice("내일 다시 만나요");
      return;
    }
    if (waking || flipping) return;
    setWaking(true);
    setFlipping(true);
    window.clearTimeout(wakeTimer.current);
    const flipDelay = reduce ? 0 : FLIP_MS;
    const settleDelay = reduce ? 0 : SETTLE_MS;
    wakeTimer.current = window.setTimeout(() => {
      setWaking(false);
      setFlipping(false);
      onDraw();
    }, flipDelay + settleDelay + 40);
  };

  const rateUpDisabled = remainingRateUp <= 0;
  const rateUpLabel = rateUpDisabled
    ? "내일 다시"
    : useRateUpTicket
      ? "뽑기권 사용"
      : `5성↑ ${rateNormalPct}→${rateUpPct}`;
  /** Hide when today's rate-up is used and no tickets remain. */
  const showRateUpTip = remainingRateUp > 0;
  const rateUpTipCopy =
    rateUpTickets > 0
      ? "뽑기권으로 광고 없이 확률업"
      : `${rateUpAdSeconds}초 광고 보고 확률업`;

  const countCopy = drawsDone
    ? `내일 00:00에 다시 채워져요 · ${countdown}`
    : remainingNormal >= normalPerDay
      ? `오늘 ${remainingNormal}장 뽑을 수 있어요`
      : `오늘 ${remainingNormal}장 더 뽑을 수 있어요`;

  return (
    <div className={`main-screen ${drawsDone ? "is-draws-done" : ""} ${reduce ? "is-reduce" : ""}`}>
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
        <button
          type="button"
          id="icon-menu"
          className="main-nav-btn main-menu-btn"
          aria-label="메뉴"
          onClick={popThen(onOpenMenu)}
        >
          <span className="main-menu-icon-wrap">
            <img src={ASSETS.menu} alt="" width={28} height={28} />
            {menuBadge ? <span className="main-menu-dot" aria-hidden="true" /> : null}
          </span>
          <span>메뉴</span>
        </button>
      </header>

      <div className="main-rule" aria-hidden="true" />

      <div className="main-meta">
        <p>고양이가 골라 주는 오늘의 행운</p>
        <p className="main-date">{dateLabel}</p>
      </div>

      <div className="main-stage-row">
        <div className="main-rateup-wrap">
          {showRateUpTip ? (
            <div className="main-rateup-tip" role="status" aria-live="polite">
              <p className="main-rateup-tip-text">{rateUpTipCopy}</p>
              <span className="main-rateup-tip-tail" aria-hidden="true" />
            </div>
          ) : null}
          <button
            type="button"
            id="btn-rateup"
            className={`main-rateup ${rateUpDisabled ? "is-dim" : ""} ${useRateUpTicket ? "is-ticket" : ""}`}
            disabled={rateUpDisabled}
            onClick={() => {
              if (rateUpDisabled) {
                showNotice("내일 다시 만나요");
                return;
              }
              onRateUpDraw();
            }}
          >
            {!rateUpDisabled && !useRateUpTicket ? (
              <span className="main-rateup-hint">({rateUpAdSeconds}초 광고)</span>
            ) : null}
            <span className="main-rateup-label">{rateUpLabel}</span>
            {rateUpTickets > 0 && !rateUpDisabled ? (
              <span className="main-rateup-badge" aria-label={`뽑기권 ${rateUpTickets}장`}>
                ×{rateUpTickets}
              </span>
            ) : null}
          </button>
        </div>

        <button
          type="button"
          id="stage-cat"
          className={`main-stage ${waking ? "is-waking" : ""} ${flipping ? "is-flipping" : ""} ${drawsDone ? "is-empty" : ""}`}
          aria-label={drawsDone ? "오늘은 이미 뽑았어요" : "고양이 톡해서 오늘의 카드 받기"}
          onClick={handleDrawTap}
        >
          <img className="main-moon" src={ASSETS.moon} alt="" />
          <div className="main-float">
            <img className="main-tail" src={ASSETS.tail} alt="" />
            <div className={`main-deck ${drawsDone ? "is-done" : ""}`} aria-hidden="true">
              {Array.from({ length: deckCount }, (_, index) => {
                const fromTop = deckCount - 1 - index;
                const isTop = fromTop === 0;
                return (
                  <div
                    key={`deck-${index}-${remainingNormal}`}
                    className={`main-deck-card ${isTop ? "is-top" : "is-back"} ${isTop && flipping ? "is-flip" : ""}`}
                    style={{ zIndex: index + 1 }}
                    data-depth={fromTop}
                  >
                    <img src={ASSETS.card} alt="" />
                    {isTop && showSparkle ? (
                      <>
                        <span className="main-deck-dot" />
                        <span className="main-deck-spark" />
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="main-cat">
              <img src={ASSETS.cat} alt="잠자는 고양이" />
            </div>
            {!drawsDone ? (
              <div className="main-zzz" aria-hidden="true">
                <span>z</span>
                <span>z</span>
                <span>z</span>
              </div>
            ) : null}
          </div>
        </button>
      </div>

      {drawsDone ? (
        <p className="main-cta main-cta-done">오늘 카드는 다 뽑았어요, 잘 자요</p>
      ) : lowRemaining ? (
        <button
          type="button"
          className={`main-draw-pill ${nudge ? "is-nudge" : ""}`}
          onClick={handleDrawTap}
        >
          한 장 더 뽑기 <span className="main-draw-pill-ad">[광고]</span>
          <span className="main-draw-pill-arrow" aria-hidden="true">
            →
          </span>
        </button>
      ) : (
        <>
          <p className="main-cta-ad">(짧은 광고가 나온 뒤 카드를 뽑아요)</p>
          <p className="main-cta">
            <span className="main-cta-accent">톡,</span> 깨워서 오늘의 카드 받기
          </p>
          <p className="main-cta-en">TAP THE CAT TO DRAW</p>
        </>
      )}

      <div
        id="chip-draws"
        className={`main-count-pill ${drawsDone ? "is-done" : ""}`}
        role="status"
        aria-live={drawsDone ? "polite" : "off"}
      >
        <span className="main-count-dots" aria-hidden="true">
          {Array.from({ length: normalPerDay }, (_, i) => (
            <i key={i} className={i < remainingNormal ? "is-on" : ""} />
          ))}
        </span>
        <span className="main-count-copy">{countCopy}</span>
      </div>

      <div className="main-ops-row">
        <button
          type="button"
          id="btn-paw-ad"
          className="main-ops-btn"
          disabled={remainingPawAds <= 0}
          onClick={() => {
            if (remainingPawAds <= 0) {
              showNotice("오늘 포인트 광고를 모두 봤어요");
              return;
            }
            onPawAd();
          }}
        >
          <span className="main-ops-hint">(짧은 광고 보고)</span>
          <span className="main-ops-label main-ops-paw">
            <img src={ASSETS.paw} alt="" width={16} height={16} />
            받기
          </span>
          <em>
            {pawBalance.toLocaleString("en-US")} · {remainingPawAds}회
          </em>
        </button>
      </div>

      <nav className="main-bottom">
        <button
          type="button"
          id="icon-dex"
          className="main-nav-btn"
          aria-label="도감"
          onClick={popThen(onOpenCollection)}
        >
          <img src={ASSETS.dex} alt="" width={28} height={28} />
          <span>도감</span>
        </button>
        <button type="button" className="main-nav-btn" aria-label="방꾸미기" onClick={popThen(onOpenRoom)}>
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
