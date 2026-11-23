export type PaintBox = { x: number; y: number; w: number; h: number };

/** `object-fit: contain` inside `box`. */
export function containBox(natW: number, natH: number, box: PaintBox): PaintBox {
  if (natW <= 0 || natH <= 0 || box.w <= 0 || box.h <= 0) return { x: box.x, y: box.y, w: 0, h: 0 };
  const scale = Math.min(box.w / natW, box.h / natH);
  const w = natW * scale;
  const h = natH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** Source rect for `object-fit: cover`. */
export function coverSource(
  natW: number,
  natH: number,
  boxW: number,
  boxH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (natW <= 0 || natH <= 0 || boxW <= 0 || boxH <= 0) return { sx: 0, sy: 0, sw: 0, sh: 0 };
  const scale = Math.max(boxW / natW, boxH / natH);
  const sw = boxW / scale;
  const sh = boxH / scale;
  return { sx: (natW - sw) / 2, sy: (natH - sh) / 2, sw, sh };
}

export type CoverSprite = { key: string; z: number; box: PaintBox };
export type CoverOccluder = { z: number; box: PaintBox };

/**
 * Furniture drawn on the canvas that an HTML occluder (a cat, or a cat bed
 * left in the DOM) sits behind. Those sprites must pop back to HTML.
 */
export function coveredSpriteKeys(sprites: CoverSprite[], occluders: CoverOccluder[]): string[] {
  const keys: string[] = [];
  for (const sprite of sprites) {
    if (occluders.some((mover) => mover.z < sprite.z && boxesTouch(sprite.box, mover.box))) keys.push(sprite.key);
  }
  return keys;
}

export function coverListKey(keys: Iterable<string>): string {
  return [...new Set(keys)].sort().join(",");
}

export function boxesTouch(a: PaintBox, b: PaintBox): boolean {
  return a.x < b.x + b.w && a.y < b.y + b.h && b.x < a.x + a.w && b.y < a.y + a.h;
}

export function unionBox(boxes: PaintBox[]): PaintBox | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const box of boxes) {
    if (box.w <= 0 || box.h <= 0) continue;
    x0 = Math.min(x0, box.x);
    y0 = Math.min(y0, box.y);
    x1 = Math.max(x1, box.x + box.w);
    y1 = Math.max(y1, box.y + box.h);
  }
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function padBox(box: PaintBox, pad: number): PaintBox {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}

/** Painter order: farther first. Equal depth keeps DOM order. */
export function depthOrder<T extends { z: number; order: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.z - b.z || a.order - b.order);
}

function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
}

/**
 * `lucky-cat-breathe`: 3.6s, scaleY 1 → 1.025 → 1, ease-in-out.
 * Pass `period` and `lift` for the roaming cat clip (2s, 1.03).
 */
export function breatheScaleY(ms: number, period = 3600, lift = 0.025): number {
  if (period <= 0) return 1;
  const wrapped = ((ms % period) + period) % period;
  const t = wrapped / period;
  const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const eased = easeInOut(local);
  const amount = t < 0.5 ? eased : 1 - eased;
  return 1 + lift * amount;
}

/** Device pixels per CSS pixel, lowered so one canvas stays at or under 4 million pixels. */
export function backingScale(cssW: number, cssH: number, dpr: number, maxPixels = 4_000_000): number {
  if (cssW <= 0 || cssH <= 0) return 1;
  const pixels = (scale: number) =>
    Math.max(1, Math.round(cssW * scale)) * Math.max(1, Math.round(cssH * scale));
  let wanted = Math.max(0.01, dpr);
  if (pixels(wanted) <= maxPixels) return wanted;
  wanted = Math.sqrt(maxPixels / (cssW * cssH));
  while (pixels(wanted) > maxPixels && wanted > 0.01) wanted *= 0.99;
  return wanted;
}

export type WorldView = { x: number; y: number; w: number; h: number };

/** Visible slice of the world, in world pixels. Null when the port does not meet the world. */
export function visibleWorldBox(
  world: { left: number; top: number; width: number; height: number },
  port: { left: number; top: number; width: number; height: number },
  worldW: number,
  worldH: number,
): WorldView | null {
  if (world.width <= 0 || world.height <= 0) return null;
  const left = Math.max(world.left, port.left);
  const top = Math.max(world.top, port.top);
  const right = Math.min(world.left + world.width, port.left + port.width);
  const bottom = Math.min(world.top + world.height, port.top + port.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: ((left - world.left) / world.width) * worldW,
    y: ((top - world.top) / world.height) * worldH,
    w: ((right - left) / world.width) * worldW,
    h: ((bottom - top) / world.height) * worldH,
  };
}

/** Special clips stay on the DOM for that moment. Cheese `sit_look` is the window pose. */
export function catNeedsDom(motion: { fx: string; anim: string; pose: string }, breedId: string): boolean {
  if (motion.fx === "meditate" || motion.fx === "aura" || motion.fx === "blizzard") return true;
  if (motion.anim === "scratch" || motion.anim === "scratch_r") return true;
  return motion.pose === "sit_look" && breedId === "cheese";
}

/** Same clips the roam CSS breathes. `happySingle` is `data-happy-frames="1"`. */
export function catBreathes(anim: string, happySingle: boolean): boolean {
  if (anim === "happy" || anim === "happy_r") return happySingle;
  return (
    anim === "idle_sit" ||
    anim === "idle_sit_r" ||
    anim === "loaf" ||
    anim === "loaf_r" ||
    anim === "sleep" ||
    anim === "sleep_r"
  );
}

/** Frame inset matching `.lucky-frame-art.is-cardframe` and `.is-squareframe` (top, right, bottom, left). */
export function frameArtBox(kind: "cardframe" | "squareframe", box: PaintBox): PaintBox {
  const [top, right, bottom, left] = kind === "cardframe" ? [0.22, 0.24, 0.18, 0.24] : [0.2, 0.22, 0.28, 0.22];
  return {
    x: box.x + box.w * left,
    y: box.y + box.h * top,
    w: box.w * (1 - left - right),
    h: box.h * (1 - top - bottom),
  };
}

/**
 * Breed files seen most recently, not in the room, beyond `keep`, are dropped.
 * `history` is oldest first.
 */
export function rememberCatBreeds(
  history: string[],
  inRoom: string[],
  keep = 3,
): { history: string[]; drop: string[] } {
  const next = history.filter((id) => !inRoom.includes(id));
  for (const id of inRoom) next.push(id);
  const seen = new Set<string>();
  const newestFirst: string[] = [];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const id = next[i];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    newestFirst.push(id);
  }
  const ordered = newestFirst.reverse();
  const room = new Set(inRoom);
  const outside = ordered.filter((id) => !room.has(id));
  const drop = outside.slice(0, Math.max(0, outside.length - keep));
  const gone = new Set(drop);
  return { history: ordered.filter((id) => !gone.has(id)), drop };
}
