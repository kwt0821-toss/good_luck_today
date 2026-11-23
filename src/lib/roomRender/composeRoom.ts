import { cappedBitmapSize } from "./bitmapSize";
import { lampCurve, lampOpacity, skyPaint, sunbeamPaint, washPaint, windowPaint, type LightBlend, type LightPaint } from "./lightTable";
import type { RoomBright, RoomPeriod } from "../roomMood";

const WASH_POLY: readonly (readonly [number, number])[] = [
  [0.5, 0.208],
  [0.337, 0.353],
  [0.337, 0.561],
  [0.5, 0.706],
  [0.663, 0.561],
  [0.663, 0.353],
];

function periodOf(island: HTMLElement): RoomPeriod {
  const names = island.closest(".lucky-room")?.classList;
  if (names?.contains("is-tod-morning")) return "morning";
  if (names?.contains("is-tod-day")) return "day";
  if (names?.contains("is-tod-sunset")) return "sunset";
  return "night";
}

function brightOf(island: HTMLElement): RoomBright {
  if (island.classList.contains("is-mood-bright")) return "bright";
  if (island.classList.contains("is-mood-cozy")) return "cozy";
  return "normal";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(url));
    image.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, paint: LightPaint | null, width: number, height: number) {
  if (!paint) return;
  ctx.save();
  ctx.globalCompositeOperation = paint.blend;
  ctx.globalAlpha = paint.opacity;
  fillBackground(ctx, paint.background, width, height);
  ctx.restore();
}

function fillBackground(ctx: CanvasRenderingContext2D, background: string, width: number, height: number) {
  const colors = [...background.matchAll(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi)].map((match) => match[0]);
  if (background.startsWith("linear-gradient") && colors.length >= 2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = colors[0] ?? background;
  }
  ctx.fillRect(0, 0, width, height);
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  box: DOMRect,
  root: DOMRect,
  scale: number,
  opacity = 1,
  blend: LightBlend | "source-over" = "source-over",
) {
  if (box.width < 1 || box.height < 1) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = blend;
  ctx.drawImage(
    source,
    (box.left - root.left) * scale,
    (box.top - root.top) * scale,
    box.width * scale,
    box.height * scale,
  );
  ctx.restore();
}

async function imageOf(node: HTMLImageElement, cache: Map<string, HTMLImageElement>): Promise<HTMLImageElement | null> {
  if (node.naturalWidth > 0) return node;
  const src = node.currentSrc || node.src;
  if (!src) return null;
  const cached = cache.get(src);
  if (cached) return cached;
  try {
    const loaded = await loadImage(src);
    cache.set(src, loaded);
    return loaded;
  } catch {
    return null;
  }
}

async function drawCat(ctx: CanvasRenderingContext2D, frame: HTMLElement, root: DOMRect, scale: number, cache: Map<string, HTMLImageElement>) {
  const style = getComputedStyle(frame);
  if (style.visibility === "hidden" || style.display === "none") return;
  const url = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
  if (!url || url === "none") return;
  const sheet = cache.get(url) ?? (await loadImage(url).catch(() => null));
  if (!sheet) return;
  cache.set(url, sheet);
  const button = frame.parentElement instanceof HTMLElement ? frame.parentElement : frame;
  const box = button.getBoundingClientRect();
  const size = style.backgroundSize.split(/\s+/);
  const pos = style.backgroundPosition.split(/\s+/);
  const bw = (parseFloat(size[0]) / 100) * box.width;
  const bh = (parseFloat(size[1]) / 100) * box.height;
  const px = (parseFloat(pos[0]) || 0) / 100;
  const py = (parseFloat(pos[1]) || 0) / 100;
  ctx.save();
  ctx.beginPath();
  ctx.rect((box.left - root.left) * scale, (box.top - root.top) * scale, box.width * scale, box.height * scale);
  ctx.clip();
  ctx.drawImage(
    sheet,
    (box.left - root.left + (box.width - bw) * px) * scale,
    (box.top - root.top + (box.height - bh) * py) * scale,
    bw * scale,
    bh * scale,
  );
  ctx.restore();
}

/**
 * Paint one room into a single canvas, in the same order as the live screen.
 * `maxScale` caps device pixels per CSS pixel (photos use 2, pinch and neighbors use 1).
 */
export async function composeRoom(island: HTMLElement, options?: { maxScale?: number }): Promise<HTMLCanvasElement> {
  const root = island.getBoundingClientRect();
  const maxScale = options?.maxScale ?? 2;
  const scale = Math.min(maxScale, window.devicePixelRatio || 1);
  const size = cappedBitmapSize(Math.max(1, root.width * scale), Math.max(1, root.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || size.width < 1) return canvas;
  const fit = size.width / Math.max(1, root.width);
  const period = periodOf(island);
  const bright = brightOf(island);
  const cache = new Map<string, HTMLImageElement>();
  const world = island.querySelector(".lucky-world");

  const base = world?.querySelector<HTMLImageElement>("img.lucky-world-layer.is-base");
  if (base) {
    const image = await imageOf(base, cache);
    if (image) drawElement(ctx, image, base.getBoundingClientRect(), root, fit);
  }
  drawCover(ctx, skyPaint(period), canvas.width, canvas.height);

  const floor = world?.querySelector(".lucky-floor-tiles");
  if (floor) {
    const floorCanvas = floor.querySelector("canvas");
    if (floorCanvas instanceof HTMLCanvasElement && floorCanvas.width > 0) {
      drawElement(ctx, floorCanvas, floorCanvas.getBoundingClientRect(), root, fit);
    }
    for (const img of floor.querySelectorAll<HTMLImageElement>("img")) {
      const image = await imageOf(img, cache);
      if (image) drawElement(ctx, image, img.getBoundingClientRect(), root, fit);
    }
  }
  if (world) {
    for (const img of world.querySelectorAll<HTMLImageElement>("img.lucky-wall-tile, img.lucky-world-layer.is-frame, .lucky-sprite.is-rug img, .lucky-sprite.is-wall img")) {
      if (img.closest(".is-canvas:not(.is-over-cat)")) continue;
      const image = await imageOf(img, cache);
      if (image) drawElement(ctx, image, img.getBoundingClientRect(), root, fit);
    }
  }
  const lights = world?.querySelector<HTMLImageElement>("img.lucky-world-layer.is-lights");
  if (lights) {
    const image = await imageOf(lights, cache);
    const opacity = Number(getComputedStyle(lights).opacity) || 1;
    if (image) drawElement(ctx, image, lights.getBoundingClientRect(), root, fit, opacity);
  }
  const depth = world?.querySelector("canvas.lucky-depth-canvas");
  if (depth instanceof HTMLCanvasElement && depth.width > 0) {
    drawElement(ctx, depth, depth.getBoundingClientRect(), root, fit);
  }
  if (world) {
    for (const img of world.querySelectorAll<HTMLImageElement>(".lucky-sprite.is-catbed img, .lucky-sprite.is-over-cat img")) {
      const image = await imageOf(img, cache);
      if (image) drawElement(ctx, image, img.getBoundingClientRect(), root, fit);
    }
    for (const frame of world.querySelectorAll<HTMLElement>(".lucky-roam-frame")) {
      await drawCat(ctx, frame, root, fit, cache);
    }
  }

  ctx.save();
  const wash = washPaint(period, bright);
  ctx.globalCompositeOperation = wash.blend;
  ctx.beginPath();
  WASH_POLY.forEach(([x, y], index) => {
    const px = x * canvas.width;
    const py = y * canvas.height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.clip();
  fillBackground(ctx, wash.background, canvas.width, canvas.height);
  ctx.restore();

  drawCover(ctx, windowPaint(period), canvas.width, canvas.height);
  drawCover(ctx, sunbeamPaint(period), canvas.width, canvas.height);

  const glowMotion = lampCurve(period, bright);
  const glowOpacity = glowMotion.staticOpacity ?? lampOpacity(glowMotion.stops, 0);
  const editing = island.closest(".lucky-room")?.classList.contains("is-edit") === true;
  const lamp = world?.querySelector<HTMLImageElement>("img.lucky-lamp-glow");
  if (lamp) {
    const image = await imageOf(lamp, cache);
    if (image) {
      ctx.save();
      if (editing) ctx.filter = "brightness(0.8)";
      drawElement(ctx, image, lamp.getBoundingClientRect(), root, fit, glowOpacity, "screen");
      ctx.restore();
    }
  }
  world?.querySelectorAll<HTMLElement>(".lucky-item-glow").forEach((glow) => {
    const box = glow.getBoundingClientRect();
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = glowOpacity;
    if (editing && glow.classList.contains("is-neon")) ctx.filter = "brightness(0.8) sepia(0.35) hue-rotate(-20deg) saturate(2.4)";
    else if (editing) ctx.filter = "brightness(0.8)";
    else if (glow.classList.contains("is-neon")) ctx.filter = "sepia(0.35) hue-rotate(-20deg) saturate(2.4)";
    const gradient = ctx.createRadialGradient(
      (box.left - root.left + box.width / 2) * fit,
      (box.top - root.top + box.height / 2) * fit,
      0,
      (box.left - root.left + box.width / 2) * fit,
      (box.top - root.top + box.height / 2) * fit,
      (box.width / 2) * fit,
    );
    if (glow.classList.contains("is-neon")) {
      gradient.addColorStop(0, "rgba(255, 150, 196, 0.9)");
      gradient.addColorStop(0.48, "rgba(255, 90, 160, 0.34)");
    } else {
      gradient.addColorStop(0, "rgba(255, 220, 160, 0.9)");
      gradient.addColorStop(0.46, "rgba(255, 176, 96, 0.32)");
    }
    gradient.addColorStop(0.72, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect((box.left - root.left) * fit, (box.top - root.top) * fit, box.width * fit, box.height * fit);
    ctx.restore();
  });

  const puffs = world?.querySelector<HTMLImageElement>("img.lucky-world-layer.is-puffs");
  if (puffs) {
    const image = await imageOf(puffs, cache);
    if (image) drawElement(ctx, image, puffs.getBoundingClientRect(), root, fit);
  }
  return canvas;
}
