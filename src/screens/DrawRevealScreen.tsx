import { useEffect, useRef, useState, type MouseEvent } from "react";

import { AudioManager } from "../audio/AudioManager";
import type { DrawReservation } from "../lib/opsTypes";
import "./DrawRevealScreen.css";

const FACEDOWN = "/assets/main/card-facedown.png";
const FINAL_MS = 1500;
const WAIT_MAX_MS = 1500;

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

const RAR: Record<string, RarityTheme> = {
  b1: {
    g1: "rgba(255,240,215,.38)",
    g2: "rgba(255,220,180,.12)",
    acc: "#F3E9D7",
    rays: null,
    parts: ["#FFF3E2", "#F3E9D7"],
    n: 8,
  },
  b2: {
    g1: "rgba(255,240,215,.38)",
    g2: "rgba(255,220,180,.12)",
    acc: "#F3E9D7",
    rays: null,
    parts: ["#FFF3E2", "#F3E9D7"],
    n: 8,
  },
  b3: {
    g1: "rgba(255,196,120,.55)",
    g2: "rgba(255,170,90,.2)",
    acc: "#FFC48A",
    rays: "#FFC07A",
    parts: ["#FFD9A0", "#FFB36B"],
    n: 12,
  },
  b4: {
    g1: "rgba(255,196,120,.55)",
    g2: "rgba(255,170,90,.2)",
    acc: "#FFC48A",
    rays: "#FFC07A",
    parts: ["#FFD9A0", "#FFB36B"],
    n: 12,
  },
  b5: {
    g1: "rgba(255,214,170,.6)",
    g2: "rgba(200,170,255,.22)",
    acc: "#FFD9A0",
    rays: "rainbow",
    parts: ["#FF9EC4", "#FFE07A", "#8EF0C8", "#8EC2FF", "#C99BFF"],
    n: 18,
    holo: true,
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
    acc: "#CDB6FF",
    rays: "#C7B0FF",
    parts: ["#E2D4FF", "#B89CFF", "#FFFFFF"],
    n: 18,
    burst: true,
  },
  legend: {
    g1: "rgba(245,210,122,.7)",
    g2: "rgba(201,151,46,.28)",
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
  ready: boolean;
  waitFailed: boolean;
  toastText: string | null;
  remainingDraws: number;
  onToDex: () => void;
  onDrawAgain: () => void;
  onRetry: () => void;
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

export function DrawRevealScreen({
  reservation,
  ready,
  waitFailed,
  toastText,
  remainingDraws,
  onToDex,
  onDrawAgain,
  onRetry,
}: DrawRevealScreenProps) {
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
  const btnsRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<SVGSVGElement>(null);
  const frontRef = useRef<HTMLImageElement>(null);
  const rearRef = useRef<HTMLImageElement>(null);

  const [manualFlip, setManualFlip] = useState(false);
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
  }, [reservation.drawId]);

  useEffect(() => {
    if (!ready || revealSoundRef.current) return;
    revealSoundRef.current = true;
    AudioManager.playSfx("card-flip");
    window.setTimeout(() => {
      AudioManager.playSfx("reveal", { rarity: reservation.rarity });
    }, 420);
  }, [ready, reservation.rarity]);

  const theme = RAR[reservation.rarity] ?? RAR.b1;
  const frontSrc = reservation.frontUrl || reservation.thumbUrl;
  const remainLabel =
    remainingDraws > 0 ? `남은 ${remainingDraws}회` : "내일 또 만나요";

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen || !theme) return;
    screen.style.setProperty("--g1", theme.g1);
    screen.style.setProperty("--g2", theme.g2);
    screen.style.setProperty("--acc", theme.acc);

    if (raysRef.current) {
      raysRef.current.style.background =
        theme.rays === "rainbow"
          ? "repeating-conic-gradient(from 0deg,rgba(255,158,196,.55) 0 4deg,transparent 4deg 15deg,rgba(255,224,122,.5) 15deg 19deg,transparent 19deg 30deg,rgba(142,240,200,.5) 30deg 34deg,transparent 34deg 45deg,rgba(142,194,255,.5) 45deg 49deg,transparent 49deg 60deg)"
          : theme.rays
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
        t0: 150,
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
        t0: 560 + r() * 160,
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
      const btns = btnsRef.current;
      if (!glow || !cardbox || !inner) return;

      if (reduce) {
        // Spec: short crossfade only — skip shake/rays/particles.
        const p = clamp(t / 250);
        inner.style.transform = `rotateY(${180 * (1 - p)}deg)`;
        cardbox.style.transform = `scale(${0.9 + 0.1 * p})`;
        glow.style.opacity = "0.7";
        glow.style.transform = "scale(1.05)";
        if (info) {
          info.style.opacity = String(p);
          info.style.transform = "translateY(0)";
        }
        if (badge) {
          badge.style.opacity = reservation.isNew ? String(p) : "0";
          badge.style.transform = "scale(1) rotate(-8deg)";
        }
        if (dup) {
          dup.style.opacity = reservation.isNew ? "0" : String(p);
          dup.style.transform = "translateX(-50%) scale(1)";
        }
        if (toast) {
          toast.style.opacity = reservation.isNew && toastText ? String(p) : "0";
          toast.style.transform = "translateY(0)";
        }
        if (btns) {
          btns.style.opacity = String(p);
          btns.style.transform = "translateY(0)";
          btns.style.pointerEvents = p > 0.5 ? "auto" : "none";
        }
        if (rays) rays.style.opacity = "0";
        return;
      }

      const shake = t >= 150 && t < 350 ? (t - 150) / 200 : null;
      const pulse = 1 + 0.04 * Math.sin(t / 180);
      glow.style.transform = `scale(${t < 350 ? pulse : 1 + 0.12 * eOutC(clamp((t - 350) / 600))})`;
      glow.style.opacity = String(t < 350 ? 0.55 + 0.15 * Math.sin(t / 180) : 0.7 + 0.3 * eOutC(clamp((t - 500) / 400)));

      let rot = 180;
      let sc = 0.9;
      let rz = 0;
      if (shake !== null) {
        rz = Math.sin(shake * Math.PI * 4) * 3 * (1 - shake);
        sc = 0.9 + 0.04 * Math.sin(shake * Math.PI);
      }
      if (t >= 350) {
        const p = clamp((t - 350) / 450);
        rot = 180 * (1 - eOutC(p));
        sc = 0.9 + 0.1 * eBack(p);
      }
      if (flipped) rot = 180;
      inner.style.transform = `rotateY(${rot}deg)`;
      cardbox.style.transform = `translateY(0px) scale(${sc}) rotate(${rz}deg)`;

      if (rays) {
        const rp = clamp((t - 560) / 500);
        rays.style.opacity = theme.rays ? String(rp * (theme.burst ? 0.95 : 0.75)) : "0";
        rays.style.transform = `rotate(${t * 0.02}deg) scale(${0.6 + 0.4 * eOutC(rp)})`;
      }

      if (holo && theme.holo) {
        const hp = ((t - 650) % 2600) / 600;
        const on = t > 650 && hp < 1;
        holo.style.opacity = on ? String(Math.sin(hp * Math.PI) * 0.9) : "0";
        holo.style.backgroundPosition = `${100 - hp * 100}% 0`;
      }

      partsRef.current.forEach((p, i) => {
        const el = document.getElementById(`dr-p${i}`);
        if (!el) return;
        const q = (t - p.t0) / p.dur;
        if (q < 0 || q > 1) {
          el.setAttribute("opacity", "0");
          return;
        }
        const e = eOutC(q);
        const x = 195 + Math.cos(p.a) * p.d * e;
        const y = 235 + Math.sin(p.a) * p.d * e * 0.9;
        const s = (p.sz / 6) * (1 - 0.4 * q) * (p.kind === "paw" ? 1.2 : 1);
        el.setAttribute("transform", `translate(${x},${y}) scale(${s}) rotate(${q * 90})`);
        el.setAttribute("opacity", String((q < 0.15 ? q / 0.15 : 1) * (1 - q)));
      });

      const bp = clamp((t - 900) / 260);
      if (badge) {
        badge.style.opacity = reservation.isNew ? (bp ? "1" : "0") : "0";
        badge.style.transform = `scale(${0.4 + 0.6 * eBack(bp)}) rotate(${-10 + 4 * bp}deg)`;
      }
      if (dup) {
        dup.style.opacity = reservation.isNew ? "0" : String(bp);
        dup.style.transform = `translateX(-50%) scale(${0.6 + 0.4 * eBack(bp)})`;
      }
      if (toast) {
        const tp = clamp((t - 900) / 300);
        const show = Boolean(reservation.isNew && toastText);
        toast.style.opacity = show ? String(tp) : "0";
        toast.style.transform = `translateY(${-24 * (1 - eOutC(tp))}px)`;
      }
      if (info) {
        const ip = clamp((t - 820) / 280);
        info.style.opacity = String(ip);
        info.style.transform = `translateY(${8 * (1 - eOutC(ip))}px)`;
      }
      if (btns) {
        const btp = clamp((t - 950) / 300);
        btns.style.opacity = String(btp);
        btns.style.transform = `translateY(${14 * (1 - eOutC(btp))}px)`;
        btns.style.pointerEvents = btp > 0.5 ? "auto" : "none";
      }
    };

    const loop = (now: number) => {
      const elapsed = now - t0Ref.current;
      if (!readyRef.current) {
        render(Math.min(elapsed % 300, 149), false);
      } else {
        if (readyAtRef.current == null) readyAtRef.current = elapsed;
        let t = elapsed - readyAtRef.current;
        if (skipToFinalRef.current) t = FINAL_MS;
        render(Math.min(t, FINAL_MS), manualFlip);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [manualFlip, reservation.isNew, theme, toastText]);

  useEffect(() => {
    if (frontRef.current) frontRef.current.src = frontSrc;
    if (rearRef.current) rearRef.current.src = FACEDOWN;
  }, [frontSrc, reservation.drawId]);

  const onScreenClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest(".draw-reveal-btn") || target.closest(".draw-reveal-wait")) return;

    if (!readyRef.current) return;
    const elapsed = performance.now() - t0Ref.current;
    const readyAt = readyAtRef.current ?? 0;
    const t = elapsed - readyAt;
    if (t < FINAL_MS && !skipToFinalRef.current) {
      skipToFinalRef.current = true;
      return;
    }
    if (target.closest("#reveal-card") || target.closest(".draw-reveal-cardbox")) {
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
    }
  };

  return (
    <div
      ref={screenRef}
      className="draw-reveal-screen"
      id="screen"
      onClick={onScreenClick}
      role="presentation"
    >
      <svg className="draw-reveal-grain" width="390" height="844" aria-hidden="true">
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
            <small>고양이가 골라 준 오늘의 행운</small>
          </div>
          <div className="draw-reveal-chip" id="chip">
            <i />
            {remainingDraws > 0 ? `남은 뽑기 ${remainingDraws}` : "오늘 뽑기 완료"}
          </div>
        </div>

        <div className="draw-reveal-stage">
          <div ref={raysRef} className="draw-reveal-rays" id="rays" />
          <div ref={glowRef} className="draw-reveal-glow" id="glow" />
          <div className="draw-reveal-shadow" id="shadow" />
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
              중복 카드 <b>+{reservation.dupPaw}포인트</b>
            </div>
            <div ref={innerRef} className="draw-reveal-inner" id="inner">
              <div className="draw-reveal-face" id="reveal-card">
                <img ref={frontRef} alt={reservation.nameKo} draggable={false} />
                <div ref={holoRef} className="draw-reveal-holo" id="holo" />
              </div>
              <div className="draw-reveal-face is-rear">
                <img ref={rearRef} alt="" draggable={false} />
              </div>
            </div>
          </div>
          <svg ref={fxRef} className="draw-reveal-fx" id="fx" viewBox="0 0 390 470" preserveAspectRatio="xMidYMid meet" />
        </div>

        <div
          ref={toastRef}
          className="draw-reveal-toast"
          id="dex-toast"
          style={{ display: reservation.isNew && toastText ? undefined : "none" }}
        >
          <div className="ic">toss</div>
          <div>{toastText ?? "도감에 등록됐어요!"}</div>
        </div>

        {waitFailed ? (
          <div className="draw-reveal-wait" role="alert">
            <p>카드를 가져오는 중이에요…</p>
            <button type="button" onClick={onRetry}>
              다시 시도
            </button>
          </div>
        ) : null}

        <div className="draw-reveal-footer">
          <div ref={infoRef} className="draw-reveal-info" id="info">
            <div className="n" id="name">
              {reservation.nameKo}
            </div>
            <div className="s" id="stars">
              {reservation.starsLabel}
            </div>
            <div className="h">카드를 톡 누르면 뒷면을 볼 수 있어요</div>
          </div>

          <div ref={btnsRef} className="draw-reveal-btns" id="btns">
            <button type="button" className="draw-reveal-btn is-primary" id="btn-to-dex" onClick={onToDex}>
              도감에 넣기
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
                  한 번 더 뽑기 (광고) <em id="remain">{remainLabel}</em>
                </>
              ) : (
                "내일 또 만나요"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const DRAW_REVEAL_WAIT_MAX_MS = WAIT_MAX_MS;
