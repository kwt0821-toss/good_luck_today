/** Snow drawn over the sabertooth cell while `blizzard` plays. Sizes are for a 242×172 cell. */

export const BLIZZARD_IN_MS = 700;
export const BLIZZARD_HOLD_MS = 1000;
export const BLIZZARD_OUT_MS = 1000;

const FACE_HALF_W = 35;
const FACE_UP_NEAR = 70;
const FACE_UP_FAR = 120;
const SHADOW = { r: 80, g: 120, b: 170, a: 0.3 };
const OUTLINE = { r: 120, g: 170, b: 215 };

type LayerSpec = {
  count: number;
  front: boolean;
  size: number;
  /** 0 for a dot. Mid flakes use a short tail of this length. */
  tail: number;
  vx: number;
  vy: number;
  alpha: number;
  color: [number, number, number];
  blur: number;
  outline: boolean;
  bigLane: boolean;
};

const LAYERS: LayerSpec[] = [
  { count: 60, front: false, size: 1, tail: 0, vx: 38, vy: 20, alpha: 0.82, color: [196, 226, 250], blur: 0, outline: false, bigLane: false },
  { count: 40, front: false, size: 1.5, tail: 1.5, vx: 91, vy: 48, alpha: 0.94, color: [196, 226, 250], blur: 0, outline: false, bigLane: false },
  { count: 6, front: true, size: 3, tail: 0, vx: 181, vy: 97, alpha: 0.5, color: [215, 238, 255], blur: 0.8, outline: true, bigLane: false },
  { count: 1, front: true, size: 5, tail: 0, vx: 265, vy: 141, alpha: 0.4, color: [215, 238, 255], blur: 1.2, outline: true, bigLane: true },
];

export type SnowFlake = {
  x: number;
  y: number;
  phase: number;
  vx: number;
  vy: number;
  size: number;
  tail: number;
  alpha: number;
  blur: number;
  outline: boolean;
  front: boolean;
  bigLane: boolean;
  slot: number;
  slots: number;
  color: [number, number, number];
};

export type BlizzardStage = "in" | "play" | "hold" | "out" | "done";

export function blizzardClock(elapsedMs: number, playMs: number): {
  k: number;
  stage: BlizzardStage;
  localMs: number;
  hideSprite: boolean;
} {
  const span = playMs > 0 ? playMs : 5000;
  const playEnd = BLIZZARD_IN_MS + span;
  const holdEnd = playEnd + BLIZZARD_HOLD_MS;
  const outEnd = holdEnd + BLIZZARD_OUT_MS;
  if (elapsedMs < BLIZZARD_IN_MS) {
    return { k: Math.max(0, elapsedMs / BLIZZARD_IN_MS), stage: "in", localMs: 0, hideSprite: true };
  }
  if (elapsedMs < playEnd) {
    return { k: 1, stage: "play", localMs: elapsedMs - BLIZZARD_IN_MS, hideSprite: false };
  }
  if (elapsedMs < holdEnd) {
    return { k: 1, stage: "hold", localMs: span, hideSprite: false };
  }
  if (elapsedMs < outEnd) {
    return {
      k: Math.max(0, 1 - (elapsedMs - holdEnd) / BLIZZARD_OUT_MS),
      stage: "out",
      localMs: span,
      hideSprite: false,
    };
  }
  return { k: 0, stage: "done", localMs: span, hideSprite: false };
}

/** Even counted taps (2, 4, …) roar. Odd counted taps (1, 3, …) blizzard. */
export function saberCountedClip(tapNumber: number): "roar" | "blizzard" {
  return tapNumber % 2 === 0 ? "roar" : "blizzard";
}

export function createSnowflakes(scale: number, width: number, height: number, anchorY: number): SnowFlake[] {
  const flakes: SnowFlake[] = [];
  const safe = scale > 0 ? scale : 1;
  for (const spec of LAYERS) {
    const slots = Math.max(spec.count === 1 ? 1 : 0, Math.round(spec.count * safe));
    const laneTop = (anchorY - 50) * safe;
    const laneH = Math.max(8, 40 * safe);
    for (let i = 0; i < slots; i += 1) {
      const sized = spec.size === 1.5 ? (i % 2 === 0 ? 1 : 2) : spec.size;
      flakes.push({
        x: Math.random() * Math.max(1, width),
        y: spec.bigLane ? laneTop + Math.random() * laneH : Math.random() * Math.max(1, height),
        phase: Math.random() * Math.PI * 2,
        vx: spec.vx * safe,
        vy: spec.vy * safe,
        size: sized * safe,
        tail: (spec.size === 1.5 ? sized : spec.tail) * safe,
        alpha: spec.alpha,
        blur: spec.blur * safe,
        outline: spec.outline,
        front: spec.front,
        bigLane: spec.bigLane,
        slot: i,
        slots,
        color: spec.color,
      });
    }
  }
  return flakes;
}

export function gustScale(tSec: number): number {
  return 1 + 0.6 * (0.5 + 0.5 * Math.sin(1.3 * tSec));
}

function wrap(value: number, span: number): number {
  if (span <= 0) return 0;
  let next = value % span;
  if (next < 0) next += span;
  return next;
}

export function stepSnow(
  flakes: SnowFlake[],
  dtSec: number,
  tSec: number,
  scale: number,
  width: number,
  height: number,
  anchorY: number,
) {
  const gust = gustScale(tSec);
  const laneTop = (anchorY - 50) * scale;
  const laneBottom = (anchorY - 10) * scale;
  const laneSpan = Math.max(1, laneBottom - laneTop);
  for (const flake of flakes) {
    flake.x += flake.vx * gust * dtSec;
    flake.y += flake.vy * dtSec;
    flake.x = wrap(flake.x, width);
    if (flake.bigLane) {
      if (flake.y > laneBottom) flake.y = laneTop + ((flake.y - laneBottom) % laneSpan);
      if (flake.y < laneTop) flake.y = laneTop;
    } else {
      flake.y = wrap(flake.y, height);
    }
  }
}

function inFace(x: number, y: number, scale: number, anchorX: number, anchorY: number): boolean {
  if (scale <= 0) return false;
  const cx = x / scale;
  const cy = y / scale;
  return Math.abs(cx - anchorX) <= FACE_HALF_W && cy <= anchorY - FACE_UP_NEAR && cy >= anchorY - FACE_UP_FAR;
}

export function paintSnow(
  canvas: HTMLCanvasElement,
  flakes: SnowFlake[],
  opts: {
    front: boolean;
    k: number;
    tSec: number;
    scale: number;
    anchorX: number;
    anchorY: number;
    cssW: number;
    cssH: number;
    dpr: number;
  },
): { shown: number; faceDimmed: number } {
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  const pxW = Math.max(1, Math.round(opts.cssW * dpr));
  const pxH = Math.max(1, Math.round(opts.cssH * dpr));
  if (canvas.width !== pxW) canvas.width = pxW;
  if (canvas.height !== pxH) canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { shown: 0, faceDimmed: 0 };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, opts.cssW, opts.cssH);
  const fade = Math.min(1, 1.3 * Math.max(0, opts.k));
  let shown = 0;
  let faceDimmed = 0;
  for (const flake of flakes) {
    if (flake.front !== opts.front) continue;
    if (flake.slot >= Math.floor(flake.slots * opts.k)) continue;
    const sway = 6 * opts.scale * Math.sin(2 * opts.tSec + flake.phase);
    const x = flake.x + sway;
    const y = flake.y;
    const faceMul = opts.front && inFace(x, y, opts.scale, opts.anchorX, opts.anchorY) ? 0.25 : 1;
    if (faceMul < 1) faceDimmed += 1;
    const alpha = Math.min(1, flake.alpha * fade * faceMul);
    if (alpha <= 0.004) continue;
    shown += 1;
    const [r, g, b] = flake.color;
    const shadowA = SHADOW.a * fade * faceMul;
    ctx.filter = "none";
    ctx.fillStyle = `rgba(${SHADOW.r},${SHADOW.g},${SHADOW.b},${shadowA})`;
    ctx.strokeStyle = ctx.fillStyle;
    drawFlake(ctx, x + opts.scale, y + opts.scale, flake, false);
    ctx.filter = flake.blur > 0 ? `blur(${flake.blur}px)` : "none";
    if (flake.outline) {
      ctx.strokeStyle = `rgba(${OUTLINE.r},${OUTLINE.g},${OUTLINE.b},${alpha})`;
      ctx.lineWidth = Math.max(opts.scale, 0.6);
    }
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    drawFlake(ctx, x, y, flake, flake.outline);
    ctx.filter = "none";
  }
  return { shown, faceDimmed };
}

function drawFlake(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  flake: SnowFlake,
  outline: boolean,
) {
  if (flake.tail > 0.2) {
    const len = Math.hypot(flake.vx, flake.vy) || 1;
    const ux = flake.vx / len;
    const uy = flake.vy / len;
    ctx.beginPath();
    ctx.moveTo(x - ux * flake.tail, y - uy * flake.tail);
    ctx.lineTo(x, y);
    ctx.lineWidth = Math.max(0.6, flake.size);
    ctx.lineCap = "round";
    ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.4, flake.size / 2), 0, Math.PI * 2);
  ctx.fill();
  if (outline) ctx.stroke();
}
