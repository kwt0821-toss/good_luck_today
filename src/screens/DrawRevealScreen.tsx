import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { AudioManager } from "../audio/AudioManager";
import { useBackHandler } from "../hooks/useBackHandler";
import { loadDexOwned } from "../lib/dexCollection";
import type { DexCard } from "../lib/dexTypes";
import { josa } from "../lib/josa";
import { jellyLabel } from "../lib/jellyLabel";
import { ncoinIcon } from "../lib/ncoinIcon";
import type { DrawReservation } from "../lib/opsTypes";
import { cardFortune, cardKoreanName, formatCardDexNo } from "../lib/dexCatalog";
import { boxStyle, resolveFrame, type FrameSubject } from "../lib/cardFrames";
import { CardFrame } from "../components/CardFrame";
import { CardFlipStack, CardViewer } from "../components/CardViewer";
import "./DrawRevealScreen.css";

const FACEDOWN = "/assets/main/card-facedown.png";
const FLIP_MS = 1000;
const FORTUNE_DELAY_MS = 300;
const FORTUNE_IN_MS = 300;
/** Card settle, then the fortune line finishes its 300ms rise. */
const FINAL_MS = FLIP_MS + FORTUNE_DELAY_MS + FORTUNE_IN_MS;
const FLIP_DEG = 900;
const WAIT_MAX_MS = 1500;
const AD_NCOIN_TOAST_MS = 2600;

type RarityTheme = {
  g1: string;
  g2: string;
  acc: string;
  rays: string | null;
  parts: string[];
  n: number;
  burst?: boolean;
  holo?: boolean | "gold";
};

/** Grade glow: 1–3★ cream, 4★ mint, 5★ gold, meme lemon, character lavender, legend gold+rays. */
const RAR: Record<string, RarityTheme> = {
  b1: {
    g1: "rgba(255,246,230,.32)",
    g2: "rgba(243,233,215,.1)",
    acc: "#F3E9D7",
    rays: null,
    parts: ["#FFF6E6", "#F3E9D7"],
    n: 8,
  },
  b2: {
    g1: "rgba(255,246,230,.34)",
    g2: "rgba(243,233,215,.12)",
    acc: "#F3E9D7",
    rays: null,
    parts: ["#FFF6E6", "#F3E9D7"],
    n: 8,
  },
  b3: {
    g1: "rgba(255,246,230,.38)",
    g2: "rgba(243,233,215,.14)",
    acc: "#F3E9D7",
    rays: null,
    parts: ["#FFF6E6", "#FFE2B8"],
    n: 10,
  },
  b4: {
    g1: "rgba(143,227,195,.5)",
    g2: "rgba(110,200,170,.18)",
    acc: "#8FE3C3",
    rays: "#8FE3C3",
    parts: ["#B8F0DC", "#8FE3C3", "#FFFFFF"],
    n: 12,
  },
  b5: {
    g1: "rgba(245,210,122,.62)",
    g2: "rgba(255,196,138,.22)",
    acc: "#F5D27A",
    rays: "#F5D27A",
    parts: ["#FAE296", "#F5D27A", "#FFE7A8"],
    n: 18,
    holo: "gold",
  },
  special: {
    g1: "rgba(255,236,120,.6)",
    g2: "rgba(255,220,90,.22)",
    acc: "#FFE680",
    rays: "#FFE680",
    parts: ["#FFF2A0", "#FFE066", "#FFFFFF"],
    n: 18,
    burst: true,
  },
  character: {
    g1: "rgba(200,170,255,.6)",
    g2: "rgba(170,140,255,.22)",
    acc: "#C7B0FF",
    rays: "#C7B0FF",
    parts: ["#E2D4FF", "#B89CFF", "#FFFFFF"],
    n: 18,
    burst: true,
  },
  legend: {
    g1: "rgba(245,210,122,.72)",
    g2: "rgba(201,151,46,.3)",
    acc: "#F5D27A",
    rays: "#F5D27A",
    parts: ["#FAE296", "#F5D27A", "#C9972E", "#FFFFFF"],
    n: 24,
    burst: true,
    holo: "gold",
  },
};

type Particle = {
  t0: number;
  dur: number;
  a: number;
  d: number;
  sz: number;
  kind: "paw" | "star";
  col: string;
};

type DrawRevealScreenProps = {
  reservation: DrawReservation;
  card?: DexCard | null;
  ready: boolean;
  waitFailed: boolean;
  /** Legacy / tutorial dex toast (new-card copy). Not used for ad 냥코인. */
  toastText?: string | null;
  /** Ad-draw only: "카드를 뽑아 냥코인 N개를 받았어요." */
  adNyangToast?: string | null;
  remainingDraws: number;
  /** Copy for the next draw, matched to the ad or ticket it will use. */
  againLabel: string;
  holdToast?: boolean;
  hideToast?: boolean;
  onToastShown?: () => void;
  onToDex: () => void;
  onDrawAgain: () => void;
  onRetry: () => void;
  onBack?: () => void;
};

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const eOutC = (p: number) => 1 - (1 - p) ** 3;
const eBack = (p: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function dupChipCopy(ownedCount: number, dupPaw: number) {
  const n = Math.max(2, ownedCount);
  return `x${n} 중복 · ${jellyLabel(dupPaw)}${josa(String(dupPaw), "으로로")} 바꿀 수 있어요`;
}

export function DrawRevealScreen({
  reservation,
  card = null,
  ready,
  waitFailed,
  toastText = null,
  adNyangToast = null,
  remainingDraws,
  againLabel,
  holdToast = false,
  hideToast = false,
  onToastShown,
  onToDex,
  onDrawAgain,
  onRetry,
  onBack,
}: DrawRevealScreenProps) {
  useBackHandler(true, () => onBack?.());
  const screenRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<HTMLDivElement>(null);
  const cardboxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const holoRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const dupRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const adToastRef = useRef<HTMLDivElement>(null);
  const toastShownRef = useRef(false);
  const [toastDismissed, setToastDismissed] = useState(false);
  const [toastHasShown, setToastHasShown] = useState(false);
  const [adToastVisible, setAdToastVisible] = useState(Boolean(adNyangToast));
  const [ownedCount, setOwnedCount] = useState(1);
  const holdToastRef = useRef(holdToast);
  const hideToastRef = useRef(hideToast);
  const onToastShownRef = useRef(onToastShown);
  holdToastRef.current = holdToast;
  hideToastRef.current = hideToast;
  onToastShownRef.current = onToastShown;
  const btnsRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<SVGSVGElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const rearRef = useRef<HTMLImageElement>(null);

  const [manualFlip, setManualFlip] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const partsRef = useRef<Particle[]>([]);
  const reduceRef = useRef(prefersReducedMotion());
  const readyRef = useRef(ready);
  const t0Ref = useRef(0);
  const readyAtRef = useRef<number | null>(null);
  const skipToFinalRef = useRef(false);
  const revealSoundRef = useRef(false);

  readyRef.current = ready;

  useEffect(() => {
    revealSoundRef.current = false;
    toastShownRef.current = false;
    setToastDismissed(false);
    setToastHasShown(false);
    setAdToastVisible(Boolean(adNyangToast));
    setManualFlip(false);
    setRevealDone(false);
  }, [reservation.drawId, adNyangToast]);

  useEffect(() => {
    if (hideToast) setToastDismissed(true);
  }, [hideToast]);

  useEffect(() => {
    if (!adNyangToast) {
      setAdToastVisible(false);
      return;
    }
    setAdToastVisible(true);
    const timer = window.setTimeout(() => setAdToastVisible(false), AD_NCOIN_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [adNyangToast, reservation.drawId]);

  useEffect(() => {
    let cancelled = false;
    void loadDexOwned().then((owned) => {
      if (cancelled) return;
      setOwnedCount(Math.max(1, owned[reservation.cardId]?.count ?? 1));
    });
    return () => {
      cancelled = true;
    };
  }, [reservation.cardId, reservation.drawId]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => setRevealDone(true), FINAL_MS);
    return () => window.clearTimeout(timer);
  }, [ready, reservation.drawId]);

  useEffect(() => {
    if (!ready || revealSoundRef.current) return;
    revealSoundRef.current = true;
    AudioManager.playSfx("card-flip");
    window.setTimeout(() => {
      AudioManager.playSfx("reveal", { rarity: reservation.rarity });
    }, 420);
  }, [ready, reservation.rarity]);

  useEffect(() => {
    if (!toastText || !reservation.isNew || toastDismissed || holdToast || !toastHasShown) return;
    const timer = window.setTimeout(() => setToastDismissed(true), 2800);
    return () => window.clearTimeout(timer);
  }, [toastText, reservation.isNew, toastDismissed, holdToast, toastHasShown, reservation.drawId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onBack?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const theme = RAR[reservation.rarity] ?? RAR.b1;
  const frontSrc = reservation.frontUrl || reservation.thumbUrl;
  const frameCard: FrameSubject = card
    ? { type: card.type, stars: card.stars }
    : reservation.rarity === "special" || reservation.rarity === "character" || reservation.rarity === "legend"
      ? { type: reservation.rarity, stars: null }
      : { type: "breed", stars: Number(reservation.rarity.replace(/\D/g, "")) || 1 };
  const frameName = card ? cardKoreanName(card) || reservation.nameKo : reservation.nameKo;
  const fortune = cardFortune(card?.id ?? reservation.cardId);
  const dexNo = formatCardDexNo(card?.id ?? reservation.cardId);
  const dupCopy = dupChipCopy(ownedCount, reservation.dupPaw);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen || !theme) return;
    screen.style.setProperty("--g1", theme.g1);
    screen.style.setProperty("--g2", theme.g2);
    screen.style.setProperty("--acc", theme.acc);

    if (raysRef.current) {
      raysRef.current.style.background = theme.rays
        ? `repeating-conic-gradient(from 0deg,${theme.rays} 0 5deg,transparent 5deg 18deg)`
        : "none";
    }
    if (holoRef.current) {
      holoRef.current.style.background =
        theme.holo === "gold"
          ? "linear-gradient(115deg,transparent 25%,rgba(255,240,190,.7) 45%,rgba(245,210,122,.5) 52%,transparent 70%)"
          : "";
      holoRef.current.style.backgroundSize = "300% 100%";
    }

    const r = rng(reservation.cardId.length * 977 + 7);
    const parts: Particle[] = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 + r() * 0.4;
      parts.push({
        t0: 80,
        dur: 520,
        a,
        d: 120 + r() * 60,
        sz: 7 + r() * 4,
        kind: i % 2 ? "paw" : "star",
        col: "#FFE2B8",
      });
    }
    for (let i = 0; i < theme.n; i += 1) {
      const a = r() * Math.PI * 2;
      parts.push({
        t0: 420 + r() * 160,
        dur: theme.burst ? 800 : 900,
        a,
        d: (theme.burst ? 150 : 110) + r() * 90,
        sz: (theme.burst ? 6 : 4) + r() * 6,
        kind: "star",
        col: theme.parts[i % theme.parts.length] ?? "#fff",
      });
    }
    partsRef.current = parts;
    if (fxRef.current) {
      fxRef.current.innerHTML = parts
        .map((p, i) =>
          p.kind === "paw"
            ? `<g id="dr-p${i}"><ellipse cx="0" cy="2" rx="3.2" ry="2.6" fill="${p.col}"/><circle cx="-3.4" cy="-2.2" r="1.3" fill="${p.col}"/><circle cx="-1.2" cy="-3.8" r="1.3" fill="${p.col}"/><circle cx="1.2" cy="-3.8" r="1.3" fill="${p.col}"/><circle cx="3.4" cy="-2.2" r="1.3" fill="${p.col}"/></g>`
            : `<path id="dr-p${i}" d="M0 -6 C.8 -1.5 1.5 -.8 6 0 C1.5 .8 .8 1.5 0 6 C-.8 1.5 -1.5 .8 -6 0 C-1.5 -.8 -.8 -1.5 0 -6Z" fill="${p.col}"/>`,
        )
        .join("");
    }

    t0Ref.current = performance.now();
    readyAtRef.current = null;
    skipToFinalRef.current = false;
    setManualFlip(false);
  }, [reservation.drawId, reservation.cardId, theme]);

  useEffect(() => {
    if (ready && readyAtRef.current == null) {
      readyAtRef.current = performance.now() - t0Ref.current;
    }
  }, [ready]);

  useEffect(() => {
    let raf = 0;
    const reduce = reduceRef.current;

    const render = (t: number, flipped: boolean) => {
      const glow = glowRef.current;
      const rays = raysRef.current;
      const cardbox = cardboxRef.current;
      const inner = innerRef.current;
      const holo = holoRef.current;
      const badge = badgeRef.current;
      const dup = dupRef.current;
      const info = infoRef.current;
      const toast = toastRef.current;
      const adToast = adToastRef.current;
      const btns = btnsRef.current;
      if (!glow || !cardbox || !inner) return;

      const dexToastVisible =
        Boolean(reservation.isNew && toastText) &&
        !toastDismissed &&
        !hideToastRef.current;

      if (adToast) {
        adToast.style.opacity = adToastVisible ? "1" : "0";
        adToast.style.transform = adToastVisible ? "translateY(0)" : "translateY(-12px)";
      }

      if (reduce) {
        // Crossfade facedown → front (no spin). `.is-reduce` keeps faces coplanar.
        const p = clamp(t / 250);
        cardbox.style.transform = `scale(${0.9 + 0.1 * p})`;
        glow.style.opacity = "0.7";
        glow.style.transform = "scale(1.05)";
        if (flipped) {
          // After reveal, use a normal 3D flip to the info back.
          screenRef.current?.classList.remove("is-reduce-reveal");
          inner.style.transform = "rotateY(180deg)";
          if (frontRef.current) frontRef.current.style.opacity = "1";
          if (rearRef.current) rearRef.current.style.opacity = "1";
        } else {
          screenRef.current?.classList.add("is-reduce-reveal");
          inner.style.transform = "rotateY(0deg)";
          if (frontRef.current) frontRef.current.style.opacity = String(p);
          if (rearRef.current) rearRef.current.style.opacity = String(1 - p);
        }
        if (info) {
          info.style.opacity = "1";
          info.style.transform = "none";
        }
        if (badge) {
          badge.style.opacity = reservation.isNew ? String(p) : "0";
          badge.style.transform = "scale(1) rotate(-14deg)";
        }
        if (dup) {
          dup.style.opacity = reservation.isNew ? "0" : String(p);
          dup.style.transform = "translateX(-50%) scale(1)";
        }
        if (toast) {
          toast.style.opacity = dexToastVisible ? String(p) : "0";
          toast.style.transform = "translateY(0)";
          if (dexToastVisible && p > 0.85 && !toastShownRef.current) {
            toastShownRef.current = true;
            setToastHasShown(true);
            onToastShownRef.current?.();
          }
        }
        if (btns) {
          btns.style.opacity = String(p);
          btns.style.transform = "translateY(0)";
          btns.style.pointerEvents = p > 0.5 ? "auto" : "none";
        }
        if (rays) rays.style.opacity = "0";
        return;
      }

      if (frontRef.current) frontRef.current.style.opacity = "1";
      if (rearRef.current) rearRef.current.style.opacity = "1";

      const pulse = 1 + 0.04 * Math.sin(t / 180);
      glow.style.transform = `scale(${t < FLIP_MS ? pulse : 1 + 0.12 * eOutC(clamp((t - 200) / 600))})`;
      glow.style.opacity = String(
        t < 200 ? 0.55 + 0.15 * Math.sin(t / 180) : 0.7 + 0.3 * eOutC(clamp((t - 200) / 400)),
      );

      // Facedown at 180° → +900° spin → 1080° ≡ 0° (front).
      let rot = 180;
      let sc = 0.9;
      if (t >= 0 && t < FLIP_MS) {
        const p = clamp(t / FLIP_MS);
        rot = 180 + FLIP_DEG * eOutC(p);
        sc = 0.9 + 0.1 * eBack(p);
      } else if (t >= FLIP_MS) {
        rot = 180 + FLIP_DEG;
        sc = 1;
      }
      if (flipped) rot = 180 + FLIP_DEG + 180;
      inner.style.transform = `rotateY(${rot}deg)`;
      cardbox.style.transform = `translateY(0px) scale(${sc})`;

      if (rays) {
        const rp = clamp((t - 420) / 500);
        rays.style.opacity = theme.rays ? String(rp * (theme.burst ? 0.95 : 0.75)) : "0";
        rays.style.transform = `rotate(${t * 0.02}deg) scale(${0.6 + 0.4 * eOutC(rp)})`;
      }

      if (holo && theme.holo) {
        const hp = ((t - 650) % 2600) / 600;
        const on = t > 650 && hp < 1;
        holo.style.opacity = on ? String(Math.sin(hp * Math.PI) * 0.9) : "0";
        holo.style.backgroundPosition = `${100 - hp * 100}% 0`;
      }

      const stage = cardbox.parentElement;
      const cx = stage ? stage.clientWidth / 2 : 195;
      const cy = stage ? stage.clientHeight / 2 : 235;
      partsRef.current.forEach((p, i) => {
        const el = document.getElementById(`dr-p${i}`);
        if (!el) return;
        const q = (t - p.t0) / p.dur;
        if (q < 0 || q > 1) {
          el.setAttribute("opacity", "0");
          return;
        }
        const e = eOutC(q);
        const x = cx + Math.cos(p.a) * p.d * e;
        const y = cy + Math.sin(p.a) * p.d * e * 0.9;
        const s = (p.sz / 6) * (1 - 0.4 * q) * (p.kind === "paw" ? 1.2 : 1);
        el.setAttribute("transform", `translate(${x},${y}) scale(${s}) rotate(${q * 90})`);
        el.setAttribute("opacity", String((q < 0.15 ? q / 0.15 : 1) * (1 - q)));
      });

      const bp = clamp((t - 780) / 260);
      if (badge) {
        badge.style.opacity = reservation.isNew ? (bp ? "1" : "0") : "0";
        badge.style.transform = `scale(${0.4 + 0.6 * eBack(bp)}) rotate(${-14 + 2 * bp}deg)`;
      }
      if (dup) {
        dup.style.opacity = reservation.isNew ? "0" : String(bp);
        dup.style.transform = `translateX(-50%) scale(${0.6 + 0.4 * eBack(bp)})`;
      }
      if (toast) {
        const tp = clamp((t - 780) / 300);
        toast.style.opacity = dexToastVisible ? String(tp) : "0";
        toast.style.transform = `translateY(${-24 * (1 - eOutC(tp))}px)`;
        if (dexToastVisible && tp >= 1 && !toastShownRef.current) {
          toastShownRef.current = true;
          setToastHasShown(true);
          onToastShownRef.current?.();
        }
      }
      if (info) {
        const ip = clamp((t - (FLIP_MS + FORTUNE_DELAY_MS)) / FORTUNE_IN_MS);
        info.style.opacity = String(ip);
        info.style.transform = `translateY(${8 * (1 - ip)}px)`;
      }
      if (btns) {
        const btp = clamp((t - 820) / 300);
        btns.style.opacity = String(btp);
        btns.style.transform = `translateY(${14 * (1 - eOutC(btp))}px)`;
        btns.style.pointerEvents = btp > 0.5 ? "auto" : "none";
      }
    };

    const loop = (now: number) => {
      const elapsed = now - t0Ref.current;
      if (!readyRef.current) {
        const slow = elapsed > WAIT_MAX_MS;
        screenRef.current?.classList.toggle("is-slow-load", slow);
        const cardbox = cardboxRef.current;
        const inner = innerRef.current;
        const glow = glowRef.current;
        const btns = btnsRef.current;
        if (inner) inner.style.transform = slow ? "rotateY(0deg)" : "rotateY(180deg)";
        if (cardbox) cardbox.style.transform = "scale(0.96)";
        if (glow) {
          glow.style.opacity = "0.45";
          glow.style.transform = "scale(1)";
        }
        if (frontRef.current) frontRef.current.style.opacity = "1";
        if (rearRef.current) rearRef.current.style.opacity = "1";
        if (btns) {
          btns.style.opacity = "0";
          btns.style.pointerEvents = "none";
        }
        raf = requestAnimationFrame(loop);
        return;
      }
      screenRef.current?.classList.remove("is-slow-load");
      if (readyAtRef.current == null) readyAtRef.current = elapsed;
      let t = elapsed - readyAtRef.current;
      if (skipToFinalRef.current) t = FINAL_MS;
      render(Math.min(t, FINAL_MS), manualFlip);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    manualFlip,
    reservation.isNew,
    theme,
    toastText,
    toastDismissed,
    adToastVisible,
  ]);

  useEffect(() => {
    // Facedown on rear for the opening reveal; info-back swaps in on tap.
    if (rearRef.current) rearRef.current.src = FACEDOWN;
    if (reduceRef.current) {
      screenRef.current?.classList.add("is-reduce-reveal");
    }
  }, [reservation.drawId]);

  const onScreenClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (
      target.closest(".draw-reveal-btn") ||
      target.closest(".draw-reveal-wait") ||
      target.closest(".draw-reveal-confirm")
    ) {
      return;
    }

    if (!readyRef.current) return;
    const elapsed = performance.now() - t0Ref.current;
    const readyAt = readyAtRef.current ?? 0;
    const t = elapsed - readyAt;
    if (t < FINAL_MS && !skipToFinalRef.current) {
      skipToFinalRef.current = true;
      setRevealDone(true);
    }
  };

  const flipCard = () => {
    if (!revealDone) return;
    AudioManager.playSfx("card-flip");
    setManualFlip((value) => !value);
    if (rearRef.current) {
      rearRef.current.src = manualFlip ? FACEDOWN : reservation.backUrl || FACEDOWN;
    }
    if (innerRef.current) {
      innerRef.current.style.transition = "transform .45s cubic-bezier(.3,.7,.2,1.1)";
      window.setTimeout(() => {
        if (innerRef.current) innerRef.current.style.transition = "";
      }, 460);
    }
  };

  const toastNode = (
    <div
      ref={toastRef}
      className={`draw-reveal-toast ${holdToast ? "is-above-tutor" : ""}`}
      id="dex-toast"
      style={{
        display:
          reservation.isNew && toastText && !toastDismissed && !hideToast ? undefined : "none",
      }}
    >
      <div className="draw-reveal-toast-icons" aria-hidden="true">
        <div className="ic">
          <img src={ncoinIcon(18)} alt="" width={18} height={18} />
        </div>
        <div className="ic is-paw">
          <img src="/assets/menu/icon-paw-mini.svg" alt="" width={18} height={18} />
        </div>
      </div>
      <div>{toastText}</div>
    </div>
  );
  const toastHost = typeof document !== "undefined" ? document.getElementById("root") : null;

  return (
    <div
      ref={screenRef}
      className="draw-reveal-screen"
      id="card-reveal"
      onClick={onScreenClick}
      role="dialog"
      aria-label="뽑기 결과"
    >
      <svg className="draw-reveal-grain" aria-hidden="true" preserveAspectRatio="none">
        <filter id="draw-grain">
          <feTurbulence type="fractalNoise" baseFrequency="1.0" numOctaves="3" seed="11" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#draw-grain)" />
      </svg>

      <div className="draw-reveal-content">
        <div className="draw-reveal-head">
          <div className="t">
            TODAY&apos;S CARD
            <br />
            <small>고양이가 골라 준 오늘의 행운</small>
          </div>
        </div>

        {adNyangToast ? (
          <div
            ref={adToastRef}
            className={`draw-reveal-ad-toast ${adToastVisible ? "is-on" : ""}`}
            role="status"
          >
            <img src={ncoinIcon(18)} alt="" width={18} height={18} />
            <span>{adNyangToast}</span>
          </div>
        ) : null}

        <div className="draw-reveal-stage">
          <div ref={raysRef} className="draw-reveal-rays" id="rays" />
          <div ref={glowRef} className="draw-reveal-glow" id="glow" />
          <div className="draw-reveal-shadow" id="shadow" />
          <CardViewer
            className="draw-reveal-viewer"
            line={fortune}
            accentColor={resolveFrame(frameCard).nameColor}
            showingBack={manualFlip}
            onFlip={flipCard}
            flipEnabled={revealDone}
            zoomEnabled={revealDone}
            captionRef={infoRef}
            captionClassName="draw-reveal-info"
            renderZoom={() => (
              <CardFlipStack
                showingBack={manualFlip}
                front={
                  <CardFrame
                    card={frameCard}
                    artId={reservation.cardId}
                    catSrc={frontSrc}
                    thumbSrc={reservation.thumbUrl}
                    name={frameName}
                    dexNo={dexNo}
                  />
                }
                back={<img src={reservation.backUrl || FACEDOWN} alt="" draggable={false} />}
              />
            )}
          >
          <div ref={cardboxRef} className="draw-reveal-cardbox" id="cardbox">
            <div
              ref={badgeRef}
              className="draw-reveal-badge"
              id="badge"
              style={{ display: reservation.isNew ? undefined : "none" }}
            >
              NEW
            </div>
            <div
              ref={dupRef}
              className="draw-reveal-dup"
              id="dup"
              style={{ display: reservation.isNew ? "none" : undefined }}
            >
              {dupCopy}
            </div>
            <div ref={innerRef} className="draw-reveal-inner" id="inner">
              <div className="draw-reveal-face" id="reveal-card">
                <CardFrame
                  ref={frontRef}
                  card={frameCard}
                  artId={reservation.cardId}
                  catSrc={frontSrc}
                  thumbSrc={reservation.thumbUrl}
                  name={frameName}
                  dexNo={dexNo}
                />
                <div className="draw-reveal-spark" style={boxStyle(resolveFrame(frameCard).tier.win)} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <div ref={holoRef} className="draw-reveal-holo" id="holo" />
              </div>
              <div className="draw-reveal-face is-rear">
                <img ref={rearRef} alt="" draggable={false} />
              </div>
            </div>
          </div>
          </CardViewer>
          <svg
            ref={fxRef}
            className="draw-reveal-fx"
            id="fx"
            viewBox="0 0 390 470"
            preserveAspectRatio="xMidYMid meet"
          />
        </div>

        {holdToast && toastHost ? createPortal(toastNode, toastHost) : toastNode}

        {waitFailed ? (
          <div className="draw-reveal-wait" role="alert">
            <p>카드를 가져오는 중이에요…</p>
            <button type="button" onClick={onRetry}>
              다시 시도
            </button>
          </div>
        ) : null}

        <div className="draw-reveal-footer">
          <div ref={btnsRef} className="draw-reveal-btns" id="btns">
            <button type="button" className="draw-reveal-btn is-primary" id="btn-to-dex" onClick={onToDex}>
              도감에서 보기
            </button>
            <button
              type="button"
              className="draw-reveal-btn is-secondary"
              id="btn-draw-again"
              disabled={remainingDraws <= 0}
              onClick={onDrawAgain}
            >
              {remainingDraws > 0 ? (
                <>
                  {againLabel} · 남은 <em id="remain">{remainingDraws}회</em>
                </>
              ) : (
                "내일 또 만나요"
              )}
            </button>
          </div>
          <button type="button" className="draw-reveal-confirm" onClick={() => onBack?.()}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export const DRAW_REVEAL_WAIT_MAX_MS = WAIT_MAX_MS;
