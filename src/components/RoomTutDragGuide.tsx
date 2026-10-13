import { useEffect, useId, useState } from "react";

import "./RoomTutDragGuide.css";

type Point = { x: number; y: number };

type RoomTutDragGuideProps = {
  /** When false, render nothing. */
  active: boolean;
  /** pick: full arrow + finger; drag (holding): faded arrow, no finger. */
  phase: "pick" | "drag";
  reduceMotion?: boolean;
  startSelector?: string;
  endSelector?: string;
};

function readCenter(el: Element, anchor: "center" | "top"): Point {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: anchor === "top" ? rect.top + Math.min(18, rect.height * 0.2) : rect.top + rect.height / 2,
  };
}

/** Smooth cubic from drawer item up to the suggest tile. */
export function buildDragGuidePath(start: Point, end: Point): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lift = Math.max(48, Math.abs(dy) * 0.42);
  const sway = Math.max(-56, Math.min(56, dx * 0.22 + (dx >= 0 ? -28 : 28)));
  const c1x = start.x + sway;
  const c1y = start.y - lift;
  const c2x = end.x + sway * 0.25;
  const c2y = end.y + Math.max(24, Math.abs(dy) * 0.22);
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

export function RoomTutDragGuide({
  active,
  phase,
  reduceMotion = false,
  startSelector = "#drawer-item-0",
  endSelector = "#room-suggest-target",
}: RoomTutDragGuideProps) {
  const reactId = useId();
  const markerId = `room-tut-arrowhead-${reactId.replace(/:/g, "")}`;
  const [pathD, setPathD] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setPathD(null);
      return;
    }

    let raf = 0;
    const measure = () => {
      const startEl = document.querySelector(startSelector);
      const endEl = document.querySelector(endSelector);
      if (!startEl || !endEl) {
        setPathD(null);
        return;
      }
      const start = readCenter(startEl, "top");
      const end = readCenter(endEl, "center");
      if (!Number.isFinite(start.x) || !Number.isFinite(end.x)) {
        setPathD(null);
        return;
      }
      // Skip until both nodes have real layout (drawer slide-in / island scale).
      if (start.x === 0 && start.y === 0) return;
      const next = buildDragGuidePath(start, end);
      setPathD((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    };

    measure();
    schedule();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    const startEl = document.querySelector(startSelector);
    const endEl = document.querySelector(endSelector);
    if (ro) {
      ro.observe(document.documentElement);
      if (startEl) ro.observe(startEl);
      if (endEl) ro.observe(endEl);
    }
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    // Drawer / suggest target can mount a tick later.
    const retry = window.setInterval(schedule, 200);
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 2400);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(retry);
      window.clearTimeout(stopRetry);
      ro?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [active, startSelector, endSelector, phase]);

  if (!active || !pathD) return null;

  const holding = phase === "drag";
  const showFinger = !reduceMotion && !holding;

  return (
    <div
      className={`room-tut-drag-guide ${holding ? "is-holding" : ""} ${reduceMotion ? "is-reduced" : ""}`}
      aria-hidden="true"
    >
      <svg className="room-tut-drag-svg" width="100%" height="100%">
        <defs>
          <marker
            id={markerId}
            markerWidth="12"
            markerHeight="12"
            refX="9"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 12 6 L 0 12 Z" fill="#FFD86B" />
          </marker>
        </defs>
        <path
          className="room-tut-drag-path"
          d={pathD}
          fill="none"
          stroke="#FFD86B"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="10 12"
          markerEnd={`url(#${markerId})`}
        />
      </svg>
      {showFinger ? (
        <div className="room-tut-drag-finger" style={{ offsetPath: `path('${pathD}')` }}>
          <span className="room-tut-drag-finger-glyph" aria-hidden="true">
            👆
          </span>
        </div>
      ) : null}
    </div>
  );
}
