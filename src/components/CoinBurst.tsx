import { useEffect, useMemo, useState, type CSSProperties } from "react";

import "./CoinBurst.css";

type CoinBurstProps = {
  /** Bump to replay. */
  token: number;
  count?: number;
  /** Full-viewport confetti (full dex complete). */
  confetti?: boolean;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
  rot: number;
  kind: "coin" | "dot";
  color: string;
};

/**
 * Short coin burst after a successful dex reward claim (+ optional confetti).
 */
export function CoinBurst({ token, count = 10, confetti = false }: CoinBurstProps) {
  const [alive, setAlive] = useState(false);
  const particles = useMemo(() => {
    if (!token) return [] as Particle[];
    const out: Particle[] = [];
    const n = confetti ? Math.max(count, 28) : count;
    for (let i = 0; i < n; i += 1) {
      const angle = (Math.PI * 2 * i) / n + (i % 3) * 0.2;
      const dist = confetti ? 90 + (i % 5) * 28 : 48 + (i % 4) * 18;
      out.push({
        id: i,
        x: 50,
        y: confetti ? 42 : 48,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - (confetti ? 40 : 20),
        delay: (i % 8) * 28,
        rot: (i * 37) % 360,
        kind: i % 3 === 0 || !confetti ? "coin" : "dot",
        color: ["#F5D27A", "#FFE680", "#FFC48A", "#FFF3E2", "#C7B0FF"][i % 5] ?? "#F5D27A",
      });
    }
    return out;
  }, [token, count, confetti]);

  useEffect(() => {
    if (!token) return;
    setAlive(true);
    const timer = window.setTimeout(() => setAlive(false), confetti ? 2200 : 900);
    return () => window.clearTimeout(timer);
  }, [token, confetti]);

  if (!alive || !particles.length) return null;

  return (
    <div className={`coin-burst ${confetti ? "is-confetti" : ""}`} aria-hidden="true">
      {particles.map((p) => (
        <span
          key={`${token}-${p.id}`}
          className={`coin-burst-p is-${p.kind}`}
          style={
            {
              "--x": `${p.x}%`,
              "--y": `${p.y}%`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--delay": `${p.delay}ms`,
              "--rot": `${p.rot}deg`,
              "--col": p.color,
            } as CSSProperties
          }
        >
          {p.kind === "coin" ? (
            <img src="/assets/ncoin/ncoin-16@3x.svg" alt="" width={16} height={16} />
          ) : null}
        </span>
      ))}
    </div>
  );
}
