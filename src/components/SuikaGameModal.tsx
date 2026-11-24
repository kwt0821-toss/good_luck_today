import { useCallback, useEffect, useRef, useState } from "react";

import { grantAffection, publishAffection } from "../lib/affection";
import { roomAsset } from "../lib/roomCatalog";
import { loadRoomCats } from "../lib/roomCats";
import { adoptServerJelly, displayJellyBalance } from "../lib/serverJelly";
import {
  applyWalletViewToOps,
  suikaAd,
  suikaFinish,
  suikaStart,
  suikaStatus,
  walletGet,
  type SuikaAdResult,
  type SuikaFinish,
  type SuikaStatus,
} from "../lib/serverWallet";
import {
  aimSuika,
  canDropSuika,
  createSuika,
  destroySuika,
  dropSuika,
  readSuika,
  stepSuika,
  type SuikaPop,
  type SuikaSim,
  type SuikaView,
} from "../lib/suika/physics";
import { FRUITS, RADIUS_FRAC, fruitByTier, rollDropTier, tuningFrom } from "../lib/suika/types";
import { adGroupIdForKind, playTossFullScreenAd } from "../lib/tossAds";
import type { OpsEconomy, OpsState } from "../lib/opsTypes";
import "./SuikaGameModal.css";

const RETRY = "잠시 후 다시 시도해 주세요";
const TOMORROW = "내일 0시에 다시 열려요";
const CHEESE = "cat-friends/cheese.webp";

const fruitImages = new Map<number, HTMLImageElement>();

function warmFruitImages() {
  for (const fruit of FRUITS) {
    if (fruitImages.has(fruit.tier)) continue;
    const image = new Image();
    image.decoding = "async";
    image.src = fruit.src;
    fruitImages.set(fruit.tier, image);
  }
}

function isPlayLimit(error: string): boolean {
  return (
    error === "no_play" ||
    error === "no_plays" ||
    error === "daily_limit" ||
    error === "limit" ||
    error === "closed"
  );
}

type Snap = {
  score: number;
  merges: number;
  madeWatermelon: boolean;
};

type Props = {
  ops: OpsState;
  economy: OpsEconomy;
  onClose: () => void;
  onOps: (next: OpsState) => void;
};

export function SuikaGameModal({ ops, economy, onClose, onOps }: Props) {
  const tuning = tuningFrom(economy);
  const opsRef = useRef(ops);
  opsRef.current = ops;
  const aliveRef = useRef(true);
  const [phase, setPhase] = useState<"start" | "play" | "result">("start");
  const [counts, setCounts] = useState<SuikaStatus | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [roundId, setRoundId] = useState("");
  const [nextTier, setNextTier] = useState(1);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [server, setServer] = useState<SuikaFinish | null>(null);
  const [finishNote, setFinishNote] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [adUsed, setAdUsed] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [adNote, setAdNote] = useState("");
  const [catUrl, setCatUrl] = useState(() => roomAsset(CHEESE));
  const endGuard = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    warmFruitImages();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      aliveRef.current = false;
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let live = true;
    const catId = ops.affection.catId;
    void loadRoomCats()
      .then((cats) => {
        if (!live) return;
        const favorite = catId ? cats.find((cat) => cat.id === catId) : undefined;
        const cheese = cats.find((cat) => cat.id === "cheese");
        const icon = favorite?.icon || cheese?.icon || CHEESE;
        setCatUrl(roomAsset(icon));
      })
      .catch(() => {
        if (live) setCatUrl(roomAsset(CHEESE));
      });
    return () => {
      live = false;
    };
  }, [ops.affection.catId]);

  const loadStatus = useCallback(() => {
    setLoading(true);
    setStatusNote("");
    void suikaStatus().then((result) => {
      if (!aliveRef.current) return;
      setLoading(false);
      if (!result.ok) {
        setCounts(null);
        setStatusNote(RETRY);
        return;
      }
      setCounts(result);
    });
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const refreshChips = async (jelly: number | null, balance: number | null) => {
    let next = opsRef.current;
    let dirty = false;
    if (jelly != null) {
      adoptServerJelly(jelly);
      next = { ...next, pawBalance: displayJellyBalance(next.pawBalance) };
      dirty = true;
    }
    const got = await walletGet();
    if (!aliveRef.current) return;
    if (got.ok) {
      const applied = applyWalletViewToOps(next, got.view);
      if (applied !== next) {
        next = applied;
        dirty = true;
      }
    } else if (balance != null && balance !== next.nyangCoinBalance) {
      next = { ...next, nyangCoinBalance: balance };
      dirty = true;
    }
    if (!dirty) return;
    opsRef.current = next;
    onOps(next);
  };

  const sendFinish = async (round: Snap) => {
    setFinishing(true);
    setFinishNote("");
    const result = await suikaFinish({
      roundId,
      score: round.score,
      merges: round.merges,
      madeWatermelon: round.madeWatermelon,
    });
    if (!aliveRef.current) return;
    setFinishing(false);
    if (!result.ok) {
      endGuard.current = false;
      setServer(null);
      setFinishNote(RETRY);
      setPhase("result");
      return;
    }
    setCounts(result);
    setServer(result);
    if (result.affectionXp === 5) {
      const granted = grantAffection(opsRef.current, economy, "suika");
      if (granted !== opsRef.current) {
        opsRef.current = granted;
        publishAffection(granted);
        onOps(granted);
      }
    }
    await refreshChips(result.jelly, result.balance);
    if (!aliveRef.current) return;
    setPhase("result");
  };

  const startRound = async (force = false) => {
    if (busy) return;
    const plays = (counts?.freeLeft ?? 0) + (counts?.extraLeft ?? 0);
    if (!force && (loading || !counts || plays <= 0)) {
      setStatusNote(counts ? TOMORROW : RETRY);
      setPhase("start");
      return;
    }
    setBusy(true);
    const id = crypto.randomUUID();
    const result = await suikaStart(id);
    if (!aliveRef.current) return;
    setBusy(false);
    if (!result.ok) {
      const message = isPlayLimit(result.error) ? TOMORROW : RETRY;
      setStatusNote(message);
      setAdNote(message);
      if (!force) setPhase("start");
      return;
    }
    endGuard.current = false;
    setRoundId(id);
    setNextTier(rollDropTier(tuning.dropTiersMax));
    setSnap(null);
    setServer(null);
    setFinishNote("");
    setAdUsed(false);
    setAdNote("");
    setPhase("play");
  };

  const onOver = (view: SuikaView) => {
    if (endGuard.current) return;
    endGuard.current = true;
    const round = {
      score: view.score,
      merges: view.merges,
      madeWatermelon: view.madeWatermelon,
    };
    setSnap(round);
    void sendFinish(round);
  };

  const watchAd = async (kind: "double" | "extra") => {
    if (adBusy || adUsed || !server || !roundId) return;
    setAdBusy(true);
    setAdNote("");
    try {
      const played = await playTossFullScreenAd("short", adGroupIdForKind("short", economy.ads));
      if (played !== "completed" || !aliveRef.current) return;
      const result = await suikaAd({ roundId, kind });
      if (!aliveRef.current) return;
      if (!result.ok) {
        setAdNote(RETRY);
        if (isPlayLimit(result.error)) {
          setCounts((prev) => (prev ? { ...prev, adsLeft: 0 } : prev));
          setAdUsed(true);
        }
        return;
      }
      setAdUsed(true);
      applyAd(result);
      await refreshChips(result.jelly, result.balance);
      if (!aliveRef.current) return;
      if (kind === "extra") await startRound(true);
    } finally {
      if (aliveRef.current) setAdBusy(false);
    }
  };

  const applyAd = (result: SuikaAdResult) => {
    setCounts((prev) =>
      prev
        ? {
            ...prev,
            freeLeft: result.freeLeft ?? prev.freeLeft,
            extraLeft: result.extraLeft ?? prev.extraLeft,
            adsLeft: result.adsLeft ?? prev.adsLeft,
            watermelonLeft: result.watermelonLeft ?? prev.watermelonLeft,
          }
        : prev,
    );
    setServer((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        jellyAmount: result.jellyAmount ?? prev.jellyAmount,
        freeLeft: result.freeLeft ?? prev.freeLeft,
        extraLeft: result.extraLeft ?? prev.extraLeft,
        adsLeft: result.adsLeft ?? prev.adsLeft,
        watermelonLeft: result.watermelonLeft ?? prev.watermelonLeft,
        jelly: result.jelly ?? prev.jelly,
        balance: result.balance ?? prev.balance,
      };
    });
  };

  const playsLeft = (counts?.freeLeft ?? 0) + (counts?.extraLeft ?? 0);
  const freeMax = economy.suikaGame?.freePlaysPerDay ?? 2;
  const adsLeft = server?.adsLeft ?? counts?.adsLeft ?? 0;
  const showAds = phase === "result" && server != null && !adUsed && adsLeft > 0 && finishNote === "";

  return (
    <div className="suika-modal" role="dialog" aria-modal="true" aria-label="수박냥 합치기">
      {phase === "play" && roundId ? (
        <SuikaPlay
          roundId={roundId}
          tuning={tuning}
          nextTier={nextTier}
          onNext={setNextTier}
          catUrl={catUrl}
          finishing={finishing}
          onOver={onOver}
        />
      ) : phase === "result" && snap ? (
        <ResultView
          snap={snap}
          server={server}
          finishNote={finishNote}
          adNote={adNote}
          adBusy={adBusy}
          showAds={showAds}
          playsLeft={playsLeft}
          busy={busy}
          onClose={onClose}
          onRetry={() => void sendFinish(snap)}
          onAgain={() => void startRound()}
          onAd={(kind) => void watchAd(kind)}
        />
      ) : (
        <StartView
          counts={counts}
          loading={loading}
          busy={busy}
          note={statusNote}
          freeMax={freeMax}
          catUrl={catUrl}
          playsLeft={playsLeft}
          onClose={onClose}
          onStart={() => void startRound()}
          onRetry={loadStatus}
        />
      )}
    </div>
  );
}

function StartView({
  counts,
  loading,
  busy,
  note,
  freeMax,
  catUrl,
  playsLeft,
  onClose,
  onStart,
  onRetry,
}: {
  counts: SuikaStatus | null;
  loading: boolean;
  busy: boolean;
  note: string;
  freeMax: number;
  catUrl: string;
  playsLeft: number;
  onClose: () => void;
  onStart: () => void;
  onRetry: () => void;
}) {
  const closed = !loading && counts != null && playsLeft <= 0;
  return (
    <>
      <header className="suika-top">
        <h1 className="suika-title">수박냥 합치기</h1>
        <button type="button" className="suika-x" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="suika-scroll">
        <div className="suika-hero">
          <p className="suika-kicker" style={{ color: "#fff6e6" }}>
            같은 과일을 합쳐 왕수박을 만들어요
          </p>
          <div className="suika-cat">
            <img src={catUrl} alt="최애냥" />
          </div>
        </div>
        <section className="suika-card">
          <div className="suika-dex">
            {FRUITS.map((fruit) => (
              <div key={fruit.tier} className={fruit.tier === 11 ? "suika-fruit is-king" : "suika-fruit"}>
                <img src={fruit.src} alt="" />
                <b>{fruit.name}</b>
                {fruit.tier === 11 ? <span className="suika-badge">완성 시 냥코인 5</span> : null}
              </div>
            ))}
          </div>
          <div className="suika-stats">
            <p>
              <span className="suika-kicker">오늘 무료</span>
              <strong>
                {counts ? counts.freeLeft : "–"} / {freeMax}
              </strong>
            </p>
            <p>
              <span className="suika-kicker">최고 점수</span>
              <strong>{counts ? counts.bestScore : "–"}</strong>
            </p>
          </div>
          {counts && counts.extraLeft > 0 ? (
            <p className="suika-note">추가 {counts.extraLeft}회</p>
          ) : null}
          {note ? <p className="suika-note">{note}</p> : null}
        </section>
      </div>
      <div className="suika-actions">
        {counts == null && !loading ? (
          <button type="button" className="suika-btn" onClick={onRetry}>
            다시 불러오기
          </button>
        ) : (
          <button type="button" className="suika-btn" disabled={loading || busy || closed || counts == null} onClick={onStart}>
            {closed ? TOMORROW : "시작"}
          </button>
        )}
      </div>
    </>
  );
}

function ResultView({
  snap,
  server,
  finishNote,
  adNote,
  adBusy,
  showAds,
  playsLeft,
  busy,
  onClose,
  onRetry,
  onAgain,
  onAd,
}: {
  snap: Snap;
  server: SuikaFinish | null;
  finishNote: string;
  adNote: string;
  adBusy: boolean;
  showAds: boolean;
  playsLeft: number;
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAgain: () => void;
  onAd: (kind: "double" | "extra") => void;
}) {
  const tooShort = server?.skipReason === "too_short";
  return (
    <>
      <header className="suika-top">
        <h1 className="suika-title">결과</h1>
        <button type="button" className="suika-x" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="suika-scroll">
        <section className="suika-card">
          <p className="suika-kicker">이번 점수</p>
          <p className="suika-result-score">{snap.score}</p>
          {server?.newBest ? <span className="suika-best">최고 기록</span> : null}
          {server ? (
            <p className="suika-reward">
              최고 <span className="suika-num">{server.bestScore}</span>
            </p>
          ) : null}
          {finishNote ? <p className="suika-soft">{finishNote}</p> : null}
          {tooShort ? <p className="suika-soft">짧게 끝나서 보상을 줄 수 없어요</p> : null}
          {server && !tooShort ? (
            <>
              <p className="suika-reward">
                젤리 <span className="suika-num">{server.jellyAmount}</span>
              </p>
              {server.affectionXp === 5 ? (
                <p className="suika-reward">
                  애정도 <span className="suika-num">+5</span>
                </p>
              ) : (
                <p className="suika-soft">오늘 애정도는 다 받았어요</p>
              )}
            </>
          ) : null}
          {server?.watermelonGranted ? (
            <div className="suika-bonus">
              <img src="/assets/suika/11_watermelon.png" alt="" />
              <div>
                <p>왕수박을 완성했어요</p>
                <p className="suika-reward">
                  냥코인 <span className="suika-num">{server.watermelonAmount}</span>
                </p>
              </div>
            </div>
          ) : null}
          {server && snap.madeWatermelon && server.watermelonAlreadyGranted && !server.watermelonGranted ? (
            <div className="suika-bonus">
              <img src="/assets/suika/11_watermelon.png" alt="" />
              <p>오늘은 이미 받았어요</p>
            </div>
          ) : null}
        </section>
      </div>
      <div className="suika-actions">
        {finishNote ? (
          <button type="button" className="suika-btn" onClick={onRetry}>
            다시 보내기
          </button>
        ) : null}
        {showAds && (server?.jellyAmount ?? 0) > 0 ? (
          <button type="button" className="suika-btn ad" disabled={adBusy} onClick={() => onAd("double")}>
            젤리 2배 + 냥코인 1
          </button>
        ) : null}
        {showAds && server?.watermelonGranted ? (
          <p className="suika-caption">왕수박 냥코인은 두 배가 되지 않아요</p>
        ) : null}
        {showAds ? (
          <button type="button" className="suika-btn ad" disabled={adBusy} onClick={() => onAd("extra")}>
            한 판 더 + 냥코인 1
          </button>
        ) : null}
        {adNote ? <p className="suika-caption">{adNote}</p> : null}
        {server && playsLeft > 0 ? (
          <button type="button" className="suika-btn" disabled={busy} onClick={onAgain}>
            한 판 더
          </button>
        ) : null}
        <button type="button" className="suika-btn line" onClick={onClose}>
          홈으로
        </button>
      </div>
    </>
  );
}

function SuikaPlay({
  roundId,
  tuning,
  nextTier,
  onNext,
  catUrl,
  finishing,
  onOver,
}: {
  roundId: string;
  tuning: ReturnType<typeof tuningFrom>;
  nextTier: number;
  onNext: (tier: number) => void;
  catUrl: string;
  finishing: boolean;
  onOver: (view: SuikaView) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<SuikaSim | null>(null);
  const layoutRef = useRef({ cssW: 1, cssH: 1, originX: 18, originY: 96 });
  const nextRef = useRef(nextTier);
  const onOverRef = useRef(onOver);
  const onNextRef = useRef(onNext);
  const catRef = useRef<HTMLImageElement | null>(null);
  const aimingRef = useRef(false);
  const [hud, setHud] = useState({ score: 0, largest: 0, ready: true });
  nextRef.current = nextTier;
  onOverRef.current = onOver;
  onNextRef.current = onNext;

  useEffect(() => {
    const image = new Image();
    image.src = catUrl;
    const ready = () => {
      catRef.current = image;
    };
    if (image.complete && image.naturalWidth > 0) ready();
    else image.onload = ready;
    return () => {
      image.onload = null;
    };
  }, [catUrl]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    const rect = stage.getBoundingClientRect();
    const cssW = Math.max(280, rect.width);
    const cssH = Math.max(360, rect.height);
    const originX = 18;
    const originY = 96;
    const boxW = Math.max(180, cssW - originX * 2);
    const boxH = Math.max(240, cssH - originY - 16);
    const layout = { cssW, cssH, originX, originY, boxW, boxH };
    layoutRef.current = layout;
    const sim = createSuika({
      width: boxW,
      height: boxH,
      dropCooldownMs: tuning.dropCooldownMs,
      dangerHoldMs: tuning.dangerHoldMs,
      boxWidthInWatermelons: tuning.boxWidthInWatermelons,
      dropTiersMax: tuning.dropTiersMax,
    });
    aimSuika(sim, boxW / 2, nextRef.current);
    simRef.current = sim;
    const pops: Array<SuikaPop & { born: number }> = [];
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let reported = false;
    let hudScore = -1;
    let hudLargest = -1;
    let hudReady = true;

    const paintSize = () => {
      const bounds = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(bounds.width * dpr));
      canvas.height = Math.max(1, Math.floor(bounds.height * dpr));
    };
    paintSize();

    const draw = (now: number) => {
      const bounds = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const view = readSuika(sim, now);
      const sx = bounds.width / layout.cssW;
      const sy = bounds.height / layout.cssH;
      context.setTransform(dpr * sx, 0, 0, dpr * sy, 0, 0);
      context.clearRect(0, 0, layout.cssW, layout.cssH);
      context.fillStyle = "#1e1a2b";
      roundRect(context, originX - 8, originY - 8, boxW + 16, boxH + 16, 22);
      context.fill();
      context.save();
      context.beginPath();
      roundRect(context, originX, originY, boxW, boxH, 16);
      context.clip();
      context.fillStyle = "#171428";
      context.fillRect(originX, originY, boxW, boxH);
      context.translate(originX, originY);
      for (const fruit of view.fruits) drawFruit(context, fruit.tier, fruit.x, fruit.y, fruit.r, fruit.angle);
      const livePops = pops.filter((pop) => now - pop.born < 320);
      pops.length = 0;
      pops.push(...livePops);
      for (const pop of pops) drawPop(context, pop, now);
      context.restore();
      const lineY = originY + view.dangerY;
      context.save();
      context.beginPath();
      context.rect(originX, originY, boxW, boxH);
      context.clip();
      context.strokeStyle = view.danger
        ? `rgba(255, 59, 92, ${0.45 + 0.55 * Math.abs(Math.sin(now / 80))})`
        : "rgba(255, 214, 170, 0.4)";
      context.lineWidth = view.danger ? 3 : 1.5;
      if (view.danger) {
        context.shadowColor = "rgba(255, 59, 92, 0.85)";
        context.shadowBlur = 14;
      }
      context.beginPath();
      context.moveTo(originX + 8, lineY);
      context.lineTo(originX + boxW - 8, lineY);
      context.stroke();
      context.restore();
      const held = fruitByTier(nextRef.current);
      const heldR = (RADIUS_FRAC[held.tier] ?? 0.3) * (boxW / (tuning.boxWidthInWatermelons * 2));
      const heldX = originX + view.aimX;
      const heldY = originY - heldR * 0.15;
      context.save();
      context.strokeStyle = "rgba(255, 246, 230, 0.55)";
      context.setLineDash([4, 6]);
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(heldX, heldY + heldR);
      context.lineTo(heldX, originY + boxH * 0.5);
      context.stroke();
      context.restore();
      const cat = catRef.current;
      if (cat && cat.naturalWidth > 0) {
        const size = 78;
        context.drawImage(cat, heldX - size / 2, originY - size + 12, size, size);
      }
      drawFruit(context, held.tier, heldX, heldY, heldR, 0);
      const largest = view.fruits.reduce((max, fruit) => Math.max(max, fruit.tier), 0);
      if (hudScore !== view.score || hudLargest !== largest || hudReady !== view.dropReady) {
        hudScore = view.score;
        hudLargest = largest;
        hudReady = view.dropReady;
        setHud({ score: view.score, largest, ready: view.dropReady });
      }
      if (view.over && !reported) {
        reported = true;
        onOverRef.current(view);
      }
    };

    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(48, now - last);
      last = now;
      const born = stepSuika(sim, dt, now);
      for (const pop of born) pops.push({ ...pop, born: now });
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const blockMove = (event: TouchEvent) => {
      event.preventDefault();
    };
    stage.addEventListener("touchmove", blockMove, { passive: false });
    const observer = new ResizeObserver(() => paintSize());
    observer.observe(stage);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      observer.disconnect();
      stage.removeEventListener("touchmove", blockMove);
      simRef.current = null;
      destroySuika(sim);
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [roundId, tuning.boxWidthInWatermelons, tuning.dangerHoldMs, tuning.dropCooldownMs, tuning.dropTiersMax]);

  const pointX = (clientX: number) => {
    const sim = simRef.current;
    const stage = stageRef.current;
    if (!sim || !stage) return;
    const bounds = stage.getBoundingClientRect();
    const layout = layoutRef.current;
    const scale = bounds.width / layout.cssW;
    const local = (clientX - bounds.left) / scale - layout.originX;
    aimSuika(sim, local, nextRef.current);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    const sim = simRef.current;
    if (!stage || !sim) return;
    const bounds = stage.getBoundingClientRect();
    const layout = layoutRef.current;
    const scale = bounds.height / layout.cssH;
    const y = (event.clientY - bounds.top) / scale;
    if (y > layout.originY + sim.height * 0.5) return;
    aimingRef.current = true;
    stage.setPointerCapture(event.pointerId);
    pointX(event.clientX);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!aimingRef.current) return;
    aimingRef.current = false;
    const sim = simRef.current;
    if (!sim) return;
    const now = performance.now();
    if (!canDropSuika(sim, now)) return;
    pointX(event.clientX);
    const tier = nextRef.current;
    if (!dropSuika(sim, tier, now)) return;
    const rolled = rollDropTier(tuning.dropTiersMax);
    nextRef.current = rolled;
    onNextRef.current(rolled);
  };

  const next = fruitByTier(nextTier);
  return (
    <>
      <div className="suika-hud">
        <p className="suika-score">
          <span>점수</span>
          {hud.score}
        </p>
        <div className={hud.ready ? "suika-pill" : "suika-pill is-wait"}>
          <img src={next.src} alt="" />
          <span>다음 {next.name}</span>
        </div>
      </div>
      <div className="suika-tiers" aria-hidden="true">
        {FRUITS.map((fruit) => (
          <i
            key={fruit.tier}
            className={fruit.tier === hud.largest ? "is-max" : fruit.tier < hud.largest ? "is-on" : undefined}
          />
        ))}
      </div>
      <div
        ref={stageRef}
        className="suika-stage"
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          if (aimingRef.current) pointX(event.clientX);
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          aimingRef.current = false;
        }}
      >
        <canvas ref={canvasRef} />
        {finishing ? <p className="suika-wait">결과를 가져오고 있어요</p> : null}
      </div>
    </>
  );
}

function drawFruit(
  context: CanvasRenderingContext2D,
  tier: number,
  x: number,
  y: number,
  radius: number,
  angle: number,
) {
  const image = fruitImages.get(tier);
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.clip();
  if (image && image.complete && image.naturalWidth > 0) {
    context.imageSmoothingEnabled = true;
    context.drawImage(image, -radius, -radius, radius * 2, radius * 2);
  }
  context.restore();
}

function drawPop(context: CanvasRenderingContext2D, pop: SuikaPop & { born: number }, now: number) {
  const t = (now - pop.born) / 320;
  context.save();
  context.strokeStyle = `rgba(255, 246, 230, ${1 - t})`;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(pop.x, pop.y, pop.r * (1 + t * 0.45), 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
