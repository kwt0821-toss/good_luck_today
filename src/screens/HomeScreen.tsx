import { useEffect, useRef, useState, type MouseEvent } from "react";

import { TitleRibbon } from "../components/TitleRibbon";
import { formatCountdownHms, formatLuckyCatalogDate, msUntilNextKstMidnight } from "../lib/date";
import { MENU_SETTINGS_EVENT, shouldReduceMenuMotion } from "../lib/menuSettings";
import { nyNotify } from "../lib/nyangNotify";

const ASSETS = {
  bg: "/assets/main/bg-night-base.webp",
  moon: "/assets/main/moon-glow.png",
  menu: "/assets/main/icon-menu-paw.svg",
  dex: "/assets/main/icon-dex-book.svg",
  room: "/assets/main/icon-room-house.svg",
  rateUp: "/assets/main/icon-rateup-sparkle.svg",
  /** Recolored cheese-cat tail (#FBC895 / #DC884A) — layout-spec §6. */
  tail: "/assets/main/mainscreen-assets/cat-tail.svg",
  card: "/assets/main/card-facedown.png",
  /** Head+paws without drool; drool is a separate animated layer. */
  cat: "/assets/main/mainscreen-assets/cat-sleeping-nodrool.webp",
  drool: "/assets/main/mainscreen-assets/drool.png",
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
  /** True before any normal draw today. */
  firstDrawPending: boolean;
  rateNormalPct: string;
  rateUpPct: string;
  /** Show 200P shop entry on rate-up (ad used, 0 tickets, limits left). */
  offerTicketShop?: boolean;
  ticketShopPricePaw?: number;
  menuBadge?: boolean;
  /** Red dot on #icon-dex when dex rewards are claimable. */
  dexBadge?: boolean;
  titleRibbon?: {
    equippedId?: string | null;
    equippedName?: string | null;
    emptyCopy: string;
    hasClaimable: boolean;
  };
  onDraw: () => void;
  onRateUpDraw: () => void;
  onOpenTicketShop?: () => void;
  onOpenMenu: () => void;
  onOpenCollection: () => void;
  onOpenRoom: () => void;
  onOpenTitles?: () => void;
};

export function HomeScreen({
  remainingNormal,
  normalPerDay,
  remainingRateUp,
  rateUpTickets,
  useRateUpTicket,
  rateUpAdSeconds = 30,
  firstDrawPending,
  rateNormalPct: _rateNormalPct,
  rateUpPct: _rateUpPct,
  offerTicketShop = false,
  ticketShopPricePaw = 200,
  menuBadge = false,
  dexBadge = false,
  titleRibbon,
  onDraw,
  onRateUpDraw,
  onOpenTicketShop,
  onOpenMenu,
  onOpenCollection,
  onOpenRoom,
  onOpenTitles,
}: HomeScreenProps) {
  const [waking, setWaking] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [countdown, setCountdown] = useState(() => formatCountdownHms(msUntilNextKstMidnight()));
  const [nudge, setNudge] = useState(false);
  const wakeTimer = useRef(0);
  const navTimer = useRef(0);
  const navLock = useRef(false);
  const [reduce, setReduce] = useState(() => shouldReduceMenuMotion());
  const dateLabel = formatLuckyCatalogDate();

  useEffect(() => {
    const sync = () => setReduce(shouldReduceMenuMotion());
    window.addEventListener(MENU_SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MENU_SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
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
    nyNotify({ key: `home:${message}`, kind: "info", title: message });
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

  const rateUpShopEntry = offerTicketShop && remainingRateUp <= 0 && rateUpTickets <= 0;
  const rateUpDisabled = remainingRateUp <= 0 && !rateUpShopEntry;
  const rateUpDetail = rateUpShopEntry
    ? `${ticketShopPricePaw}P`
    : rateUpDisabled
      ? "내일 다시"
      : "5성↑";
  const rateUpSub = rateUpShopEntry
    ? "포인트로 사기"
    : rateUpTickets > 0
      ? "뽑기권 사용"
      : !rateUpDisabled
        ? "광고"
        : null;
  /** Tip when draw available, or shop entry after ad used with 0 tickets. */
  const showRateUpTip = remainingRateUp > 0 || rateUpShopEntry;
  const rateUpTipLines = rateUpShopEntry
    ? [`${ticketShopPricePaw}P로`, "광고 없이"]
    : rateUpTickets > 0
      ? ["뽑기권으로", "광고 없이"]
      : [`${rateUpAdSeconds}초 광고`, "보고"];

  const countCopy = drawsDone
    ? `내일 00:00에 다시 채워져요 · ${countdown}`
    : remainingNormal >= normalPerDay
      ? `오늘 ${remainingNormal}장 뽑을 수 있어요`
      : `오늘 ${remainingNormal}장 더 뽑을 수 있어요`;

  return (
    <div className={`main-screen ${drawsDone ? "is-draws-done" : ""} ${reduce ? "is-reduce" : ""}`}>
      <img className="main-bg" src={ASSETS.bg} alt="" />

      <header className="main-header">
        <div className="main-brand">
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
          {titleRibbon && onOpenTitles ? (
            <TitleRibbon
              equippedId={titleRibbon.equippedId}
              equippedName={titleRibbon.equippedName}
              emptyCopy={titleRibbon.emptyCopy}
              hasClaimable={titleRibbon.hasClaimable}
              onOpen={onOpenTitles}
            />
          ) : null}
        </div>
        <button
          type="button"
          id="btn-menu"
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
              <p className="main-rateup-tip-text">
                {rateUpTipLines.map((line, index) => (
                  <span key={line} className="main-rateup-tip-line">
                    {index > 0 ? <br /> : null}
                    {line}
                    {index === rateUpTipLines.length - 1 ? (
                      <>
                        {" "}
                        <span className="main-rateup-tip-accent">확률업</span>
                      </>
                    ) : null}
                  </span>
                ))}
              </p>
              <span className="main-rateup-tip-tail" aria-hidden="true" />
            </div>
          ) : null}
          <button
            type="button"
            id="btn-rateup"
            className={`main-rateup ${rateUpDisabled ? "is-dim" : ""} ${useRateUpTicket ? "is-ticket" : ""} ${rateUpShopEntry ? "is-shop" : ""}`}
            disabled={rateUpDisabled}
            aria-label="확률업 뽑기"
            onClick={() => {
              if (rateUpShopEntry) {
                onOpenTicketShop?.();
                return;
              }
              if (rateUpDisabled) {
                showNotice("내일 다시 만나요");
                return;
              }
              onRateUpDraw();
            }}
          >
            <span className="main-rateup-orb">
              <img className="main-rateup-icon" src={ASSETS.rateUp} alt="" width={22} height={22} />
              {rateUpTickets > 0 ? (
                <span className="main-rateup-badge" aria-label={`뽑기권 ${rateUpTickets}장`}>
                  <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                    <path
                      d="M1.5 3.8c0-.6.5-1.1 1.1-1.1h6.8c.6 0 1.1.5 1.1 1.1v.5c-.6.1-1 .6-1 1.2s.4 1.1 1 1.2v.5c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1v-.5c.6-.1 1-.6 1-1.2s-.4-1.1-1-1.2v-.5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <path d="M5.2 3.4v5.2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1 1.4" />
                  </svg>
                  ×{rateUpTickets}
                </span>
              ) : null}
            </span>
            <span className="main-rateup-title">확률업</span>
            <span className="main-rateup-label">{rateUpDetail}</span>
            {rateUpSub ? <span className="main-rateup-hint">{rateUpSub}</span> : null}
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
            <div className={`main-deck ${drawsDone ? "is-done" : ""}`} aria-hidden="true">
              {Array.from({ length: deckCount }, (_, index) => {
                const fromTop = deckCount - 1 - index;
                const isTop = fromTop === 0;
                if (isTop) {
                  /* .deck-top carries the -2deg tilt; cat/tail sit beside the face
                     (not inside the flipping 3D card) so breathe/sway keep compositing. */
                  return (
                    <div
                      key={`deck-top-${remainingNormal}`}
                      className="deck-top"
                      style={{ zIndex: index + 1 }}
                    >
                      <img className="main-tail" src={ASSETS.tail} alt="" draggable={false} />
                      <div className={`main-deck-card is-top ${flipping ? "is-flip" : ""}`}>
                        <img className="main-deck-face" src={ASSETS.card} alt="" />
                        {showSparkle ? (
                          <>
                            <span className="main-deck-dot" />
                            <span className="main-deck-spark" />
                          </>
                        ) : null}
                      </div>
                      <div className="main-cat">
                        <img className="main-cat-body" src={ASSETS.cat} alt="잠자는 고양이" />
                        <img
                          className="main-drool"
                          src={ASSETS.drool}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                        />
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={`deck-${index}-${remainingNormal}`}
                    className="main-deck-card is-back"
                    style={{ zIndex: index + 1 }}
                    data-depth={fromTop}
                  >
                    <img className="main-deck-face" src={ASSETS.card} alt="" />
                  </div>
                );
              })}
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
          한 장 더 뽑기 <span className="main-draw-pill-ad">광고</span>
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

      <nav className="main-bottom">
        <button
          type="button"
          id="icon-dex"
          className="main-nav-btn"
          aria-label="도감"
          onClick={popThen(onOpenCollection)}
        >
          <span className="main-menu-icon-wrap">
            <img src={ASSETS.dex} alt="" width={28} height={28} />
            {dexBadge ? <span className="main-menu-dot" aria-hidden="true" /> : null}
          </span>
          <span>도감</span>
        </button>
        <button type="button" className="main-nav-btn" aria-label="방꾸미기" onClick={popThen(onOpenRoom)}>
          <img src={ASSETS.room} alt="" width={28} height={28} />
          <span>방꾸미기</span>
        </button>
      </nav>

    </div>
  );
}
