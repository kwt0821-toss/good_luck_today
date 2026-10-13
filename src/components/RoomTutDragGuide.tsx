import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

function readPoint(el: Element, anchor: "center" | "top", origin: DOMRect): Point {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - origin.left,
    y:
      (anchor === "top" ? rect.top + Math.min(18, rect.height * 0.2) : rect.top + rect.height / 2) -
      origin.top,
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

function inBounds(pt: Point, w: number, h: number, pad = 8) {
  return pt.x >= -pad && pt.y >= -pad && pt.x <= w + pad && pt.y <= h + pad;
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pathD, setPathD] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ w: 390, h: 844 });

  useEffect(() => {
    if (!active) {
      setPathD(null);
      return;
    }

    let raf = 0;
    let alive = true;
    const startedAt = performance.now();

    const measure = () => {
      if (!alive) return;
      const host = document.getElementById("root") ?? document.body;
      const startEl = document.querySelector(startSelector);
      const endEl = document.querySelector(endSelector);
      if (!startEl || !endEl || !overlayRef.current) return;

      // Prefer #root box — matches absolute portal coords under translateZ(0).
      const origin = host.getBoundingClientRect();
      const w = host.clientWidth || origin.width;
      const h = host.clientHeight || origin.height;
      if (w < 8 || h < 8) return;

      setViewBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

      const start = readPoint(startEl, "top", origin);
      const end = readPoint(endEl, "center", origin);
      if (!Number.isFinite(start.x) || !Number.isFinite(end.x)) return;
      // Ignore drawer mid slide-in (coords outside the phone frame).
      if (!inBounds(start, w, h) || !inBounds(end, w, h)) return;
      if (Math.hypot(end.x - start.x, end.y - start.y) < 24) return;

      const next = buildDragGuidePath(start, end);
      setPathD((prev) => (prev === next ? prev : next));
    };

    const loop = () => {
      measure();
      // Hot for first 3s (drawer slide / island scale), then ease off.
      const hot = performance.now() - startedAt < 3000;
      raf = window.setTimeout(loop, hot ? 32 : 200) as unknown as number;
    };
    loop();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    const host = document.getElementById("root") ?? document.body;
    ro?.observe(host);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      alive = false;
      window.clearTimeout(raf);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, startSelector, endSelector, phase]);

  if (!active) return null;

  const holding = phase === "drag";
  const showFinger = Boolean(pathD) && !reduceMotion && !holding;
  const portalTarget = document.getElementById("root") ?? document.body;

  return createPortal(
    <div
      ref={overlayRef}
      className={`room-tut-drag-guide ${holding ? "is-holding" : ""} ${reduceMotion ? "is-reduced" : ""} ${pathD ? "is-ready" : ""}`}
      aria-hidden="true"
    >
      {pathD ? (
        <svg
          className="room-tut-drag-svg"
          width={viewBox.w}
          height={viewBox.h}
          viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
        >
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
      ) : null}
      {showFinger && pathD ? (
        <div className="room-tut-drag-finger" style={{ offsetPath: `path('${pathD}')` }}>
          <span className="room-tut-drag-finger-glyph" aria-hidden="true">
            👆
          </span>
        </div>
      ) : null}
    </div>,
    portalTarget,
  );
}
