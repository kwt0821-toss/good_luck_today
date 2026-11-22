import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import { SIT_LOOK_BODY_PX, SIT_LOOK_CHEESE } from "../lib/catSeats";
import { HEART_BED_ID, useHeartBedSrc } from "../lib/heartBed";
import { useHideBrokenImages } from "../lib/hideBrokenImages";
import { roomAsset } from "../lib/roomCatalog";
import { AudioManager } from "../audio/AudioManager";
import {
  DEFAULT_CAT_BREED_ID,
  auraStrength,
  catAsset,
  clipPlayMs,
  defaultSitFrame,
  furnitureDepthKey,
  spriteDepthZ,
  meditateFloatPx,
} from "../lib/roomCat";
import { createSnowflakes, paintSnow, stepSnow, type SnowFlake } from "../lib/saberBlizzard";
import {
  WALL_BANDS,
  WALL_SLOTS,
  WORLD_H,
  WORLD_W,
  canPlaceWall,
  diamondPoints,
  footprintCentreWorld,
  hostOf,
  isDecal,
  itemSize,
  occupancy,
  previewTiles,
  resolveSuggestTile,
  shadowRect,
  sortFloor,
  spriteRect,
  wallCellPoints,
  wallCellsOf,
  wallOccupancy,
  wallPlaceFromSlot,
  wallSpriteRect,
  screenOf,
} from "../lib/roomLayout";
import {
  floorTileClip,
  floorTileRect,
  floorTileSrc,
  paintSkinType,
  wallStripClip,
  wallStripRect,
  wallStripSrc,
} from "../lib/roomTiles";
import type { RoomSetCue } from "../lib/roomSets";
import type {
  FloorPlacement,
  PaintTarget,
  RoomDrag,
  RoomItem,
  RoomLayoutState,
  RoomMode,
  SpriteRect,
  WallPlacement,
} from "../lib/roomTypes";
import { emitsLight, NEON_ITEM_IDS, WINDOW_ITEM_IDS } from "../lib/roomTime";
import { useRoomCat, type CatMotionRef, type CatSpot, type CatSpotsRef, type RoomCatView } from "../lib/useRoomCat";

type RoomWorldProps = {
  mode: RoomMode;
  roomId: string;
  roamingCatIds: string[];
  roamingActive: boolean;
  itemsById: Map<string, RoomItem>;
  layout: RoomLayoutState;
  selectedId: string | null;
  dragging: RoomDrag | null;
  hints: { col: number; row: number }[] | null;
  frameThumbs: string[];
  shakeId: string | null;
  shadowsEnabled: boolean;
  painting: boolean;
  paintHover: PaintTarget | null;
  /** Live wallpaper/floor texture preview (replaces yellow paint overlays). */
  paintPreview?: {
    itemId: string;
    paintKind: "floor" | "wall";
    target: PaintTarget;
    fillAll: boolean;
    valid: boolean;
  } | null;
  /** Tutorial step-4 suggest target (c/r); snaps to nearest free tile if blocked. */
  suggestTile?: { c: number; r: number } | null;
  suggestItemId?: string | null;
  reduceMotion?: boolean;
  placeFxId?: string | null;
  /** Placement preview: lift ghost ~24pt above finger. */
  previewGhost?: boolean;
  /** Placement preview: tint red when invalid. */
  previewInvalid?: boolean;
  /** `?debugHit=1` outlines each sprite's real hit box. */
  debugHit?: boolean;
  /** Plays only for the room whose theme set is complete. */
  setBonus?: RoomSetCue | null;
  favorite?: {
    catId: string;
    lines: string[];
    seatItemId: string;
    seatMul: number;
    onPet: () => void;
  } | null;
  onSelect: (instanceId: string | null, kind: "floor" | "wall") => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, instanceId: string) => void;
  onFloorPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
};

/** World pixels as a percentage of the on-screen island (not a 3840px layer). */
function writeStyle(el: HTMLElement, prop: string, value: string) {
  if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
}

function setData(el: HTMLElement, key: string, value: string) {
  if (el.dataset[key] !== value) el.dataset[key] = value;
}

function roomBox(el: HTMLElement) {
  const world = el.closest(".lucky-world");
  if (!(world instanceof HTMLElement)) return null;
  const w = world.clientWidth;
  const h = world.clientHeight;
  if (w < 1 || h < 1) return null;
  return { w, h };
}

function worldTranslate(x: number, y: number, box: { w: number; h: number }) {
  const px = (x / WORLD_W) * box.w;
  const py = (y / WORLD_H) * box.h;
  return `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
}

function pctX(worldPx: number) {
  return `${(worldPx / WORLD_W) * 100}%`;
}

function pctY(worldPx: number) {
  return `${(worldPx / WORLD_H) * 100}%`;
}

function worldBox(rect: { x: number; y: number; w: number; h: number }): CSSProperties {
  return {
    left: pctX(rect.x),
    top: pctY(rect.y),
    width: pctX(rect.w),
    height: pctY(rect.h),
  };
}

const FLOOR_CLIP = floorTileClip();
const WALL_CLIP = { L: wallStripClip("L"), R: wallStripClip("R") } as const;

function tileClipStyle(rect: { x: number; y: number; w: number; h: number }, clip: string): CSSProperties {
  return {
    ...worldBox(rect),
    ["--tile-clip" as string]: clip,
    clipPath: clip,
    WebkitClipPath: clip,
  };
}

/** Glass pane, inset so the curtains stay the painted color. */
function windowGlassBox(rect: { x: number; y: number; w: number; h: number }): CSSProperties {
  return {
    left: pctX(rect.x + rect.w * 0.3),
    top: pctY(rect.y + rect.h * 0.16),
    width: pctX(rect.w * 0.4),
    height: pctY(rect.h * 0.5),
  };
}

function Layer({ src, className }: { src: string; className?: string }) {
  return <img className={`lucky-world-layer ${className ?? ""}`} src={roomAsset(src)} alt="" draggable={false} />;
}

function TilePoly({
  col,
  row,
  tone,
}: {
  col: number;
  row: number;
  tone: "selected" | "valid" | "invalid" | "hint" | "paint" | "suggest";
}) {
  return <polygon className={`lucky-tile is-${tone}`} points={diamondPoints(col, row)} />;
}

function WallCell({
  wall,
  slot,
  band,
  tone,
}: {
  wall: "L" | "R";
  slot: number;
  band: number;
  tone: "grid" | "valid" | "invalid" | "selected";
}) {
  return (
    <polygon
      className={`lucky-tile is-wall is-wall-${tone}`}
      points={wallCellPoints(wall, slot, band)}
    />
  );
}

function FloorSprite({
  place,
  item,
  rect,
  selected,
  lifted,
  shaking,
  flipped,
  thumbs,
  placeFx = false,
  previewGhost = false,
  previewInvalid = false,
  fit,
  zIndex,
  onSelect,
  onItemPointerDown,
}: {
  place: FloorPlacement;
  item: RoomItem;
  rect: SpriteRect;
  selected: boolean;
  lifted: boolean;
  shaking: boolean;
  flipped: boolean;
  thumbs: string[];
  placeFx?: boolean;
  previewGhost?: boolean;
  previewInvalid?: boolean;
  /** Island scale. Lift offsets are world pixels and must shrink with the room. */
  fit: number;
  zIndex: number;
  onSelect: (id: string) => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
}) {
  const frames = item.id === "cardframe" || item.id === "squareframe";
  const heartSrc = useHeartBedSrc(item.id === HEART_BED_ID);
  const liftWorld = previewGhost ? -24 : lifted ? -12 : 0;
  const liftY = liftWorld ? `translateY(${liftWorld * fit}px)` : "";
  return (
    <button
      type="button"
      className={[
        "lucky-sprite",
        selected ? "is-selected" : "",
        lifted || previewGhost ? "is-lifted" : "",
        previewGhost ? "is-preview-ghost" : "",
        previewInvalid ? "is-preview-invalid" : "",
        shaking ? "is-shake" : "",
        placeFx ? "is-place-fx" : "",
        item.hero || item.id === "catbed_cat" ? "is-catbed" : "",
        isDecal(item) ? "is-rug" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...worldBox(rect),
        zIndex,
        transform: `${flipped ? "scaleX(-1) " : ""}${liftY}`.trim() || undefined,
      }}
      aria-label={item.nameKo}
      onPointerDown={(event) => onItemPointerDown(event, place.instanceId)}
      onClick={() => onSelect(place.instanceId)}
    >
      {rect.src || heartSrc ? (
        <img src={heartSrc || roomAsset(rect.src)} alt="" draggable={false} />
      ) : (
        <span className="lucky-sprite-fallback">{item.nameKo}</span>
      )}
      {placeFx ? <span className="lucky-place-sparkles" aria-hidden="true" /> : null}
      {placeFx ? <span className="lucky-place-dust" aria-hidden="true" /> : null}
      {frames && thumbs[0] ? (
        <span className={`lucky-frame-art is-${item.id}`} aria-hidden="true">
          <img src={thumbs[0]} alt="" />
        </span>
      ) : null}
    </button>
  );
}

function RoamingCatShadow({
  view,
  motionRef,
}: {
  view: RoomCatView;
  motionRef: CatMotionRef;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    if (!view.sheet) return;
    const shadow = view.sheet.shadow;
    let box = { w: 0, h: 0 };
    const readBox = () => {
      const next = imgRef.current ? roomBox(imgRef.current) : null;
      if (next) box = next;
    };
    const apply = () => {
      const el = imgRef.current;
      if (!el) return;
      if (box.w < 1) readBox();
      if (box.w < 1) return;
      const motion = motionRef.current;
      const loafish =
        motion.anim === "loaf" ||
        motion.anim === "loaf_r" ||
        motion.anim === "sleep" ||
        motion.anim === "sleep_r";
      const scale = loafish ? 0.8 : 1;
      const x = motion.worldX - shadow.anchor[0] * scale;
      const y = motion.worldY - shadow.anchor[1] * scale;
      writeStyle(el, "width", `${((shadow.size[0] * scale) / WORLD_W) * box.w}px`);
      writeStyle(el, "height", `${((shadow.size[1] * scale) / WORLD_H) * box.h}px`);
      writeStyle(el, "transform", worldTranslate(x, y, box));
      writeStyle(el, "opacity", motion.spriteHidden ? "0" : String(motion.opacity));
    };
    readBox();
    const world = imgRef.current?.closest(".lucky-world");
    const ro = world instanceof HTMLElement ? new ResizeObserver(() => { readBox(); apply(); }) : null;
    if (world instanceof HTMLElement && ro) ro.observe(world);
    apply();
    const unsub = motionRef.subscribe(apply);
    return () => {
      unsub();
      ro?.disconnect();
    };
  }, [view.sheet, motionRef]);
  if (!view.sheet || !view.ready) return null;
  return <img ref={imgRef} className="lucky-roam-shadow" src={catAsset(view.sheet.shadow.image)} alt="" draggable={false} />;
}

/** Keep the meow line inside the room viewport, above the cat, outside the island mask. */
function placeMeowBubble(bubble: HTMLElement, btn: HTMLElement) {
  const root = bubble.offsetParent instanceof HTMLElement ? bubble.offsetParent : bubble.parentElement;
  if (!root) return;
  const rootRect = root.getBoundingClientRect();
  const catRect = btn.getBoundingClientRect();
  const width = bubble.offsetWidth;
  const tailDrop = 8;
  const height = bubble.offsetHeight + tailDrop;
  if (width < 1 || height < 1) return;
  const pad = 8;
  const maxLeft = Math.max(pad, root.clientWidth - width - pad);
  const maxTop = Math.max(pad, root.clientHeight - height - pad);
  let left = catRect.left + catRect.width / 2 - width / 2 - rootRect.left;
  let top = catRect.top - height - 2 - rootRect.top;
  left = Math.min(Math.max(left, pad), maxLeft);
  top = Math.min(Math.max(top, pad), maxTop);
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  const catCenter = catRect.left + catRect.width / 2 - rootRect.left;
  const tail = Math.min(Math.max(catCenter - left, 14), Math.max(14, width - 14));
  bubble.style.setProperty("--meow-tail", `${tail}px`);
}

function RoamingCatBody({
  view,
  motionRef,
  onTap,
  tapEnabled,
}: {
  view: RoomCatView;
  motionRef: CatMotionRef;
  onTap: () => void;
  tapEnabled: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const emojiRef = useRef<HTMLSpanElement>(null);
  const meowRef = useRef<HTMLSpanElement>(null);
  const meowTextRef = useRef<HTMLSpanElement>(null);
  const postRef = useRef<HTMLSpanElement>(null);
  const cloudRef = useRef<HTMLSpanElement>(null);
  const auraRef = useRef<HTMLSpanElement>(null);
  const backSnowRef = useRef<HTMLCanvasElement>(null);
  const frontSnowRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<HTMLImageElement>(null);
  const zzzRef = useRef<HTMLSpanElement>(null);
  const snowRef = useRef<{ flakes: SnowFlake[]; scale: number; last: number } | null>(null);
  const applyRef = useRef<(() => void) | null>(null);
  const [bubbleRoot, setBubbleRoot] = useState<HTMLElement | null>(null);
  const downRef = useRef<{ x: number; y: number; t: number } | null>(null);
  useLayoutEffect(() => {
    const root = btnRef.current?.closest(".lucky-island-port");
    if (root instanceof HTMLElement) setBubbleRoot(root);
  }, [view.sheet]);
  useLayoutEffect(() => {
    if (!view.sheet) return;
    const sheet = view.sheet;
    const [fw, fh] = sheet.frameSize;
    const [sw, sh] = sheet.sheetSize;
    let box = { w: 0, h: 0 };
    const readBox = () => {
      const next = btnRef.current ? roomBox(btnRef.current) : null;
      if (next) box = next;
    };
    const placeBox = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
      if (box.w < 1) return;
      const width = (w / WORLD_W) * box.w;
      const height = (h / WORLD_H) * box.h;
      writeStyle(el, "width", `${width.toFixed(2)}px`);
      writeStyle(el, "height", `${height.toFixed(2)}px`);
      writeStyle(el, "transform", worldTranslate(x, y, box));
      writeStyle(el, "font-size", `${(height * 0.42).toFixed(2)}px`);
    };
    const apply = () => {
      const btn = btnRef.current;
      const frameEl = frameRef.current;
      if (!btn || !frameEl) return;
      if (box.w < 1) readBox();
      const motion = motionRef.current;
      const frame = sheet.frames[motion.frameName] ?? sheet.frames[defaultSitFrame(sheet)];
      if (!frame) return;
      const sleeping = motion.anim === "sleep" || motion.anim === "sleep_r";
      if (btn.classList.contains("is-sleeping") !== sleeping) btn.classList.toggle("is-sleeping", sleeping);
      setData(btn, "catAnim", motion.anim);
      setData(btn, "catFlip", motion.flip ? "1" : "0");
      setData(btn, "catFx", motion.fx);
      setData(btn, "spriteHidden", motion.spriteHidden ? "1" : "0");
      writeStyle(btn, "opacity", String(motion.opacity));
      writeStyle(btn, "z-index", String(motion.zIndex));
      writeStyle(frameEl, "opacity", motion.spriteHidden ? "0" : "1");
      let placed = false;
      const poseEl = poseRef.current;
      const cheeseLook =
        motion.pose === "sit_look" &&
        (btn.dataset.catId === SIT_LOOK_CHEESE.breedId || btn.dataset.catId === DEFAULT_CAT_BREED_ID);
      let poseBox: { w: number; h: number; ax: number; ay: number } | null = null;
      if (poseEl) {
        if (!cheeseLook) {
          poseEl.hidden = true;
        } else {
          const src = catAsset(SIT_LOOK_CHEESE.src);
          if (poseEl.dataset.src !== src) {
            poseEl.dataset.src = src;
            poseEl.dataset.ready = "";
            poseEl.dataset.broken = "";
            poseEl.onload = () => {
              poseEl.dataset.ready = "1";
            };
            poseEl.onerror = () => {
              poseEl.dataset.broken = "1";
              poseEl.hidden = true;
            };
            poseEl.src = src;
          }
          const ready = poseEl.dataset.ready === "1" && poseEl.dataset.broken !== "1";
          poseEl.hidden = !ready;
          if (ready) {
            const scale = SIT_LOOK_BODY_PX / SIT_LOOK_CHEESE.body;
            const w = SIT_LOOK_CHEESE.w * scale;
            const h = SIT_LOOK_CHEESE.h * scale;
            const ax = SIT_LOOK_CHEESE.ax * scale;
            const ay = SIT_LOOK_CHEESE.ay * scale;
            poseBox = { w, h, ax, ay };
            placeBox(btn, motion.worldX - ax, motion.worldY - ay, w, h);
            placed = true;
            writeStyle(frameEl, "opacity", "0");
            writeStyle(poseEl, "transform-origin", `${(ax / w) * 100}% ${(ay / h) * 100}%`);
            writeStyle(poseEl, "transform", motion.flip ? "scaleX(-1)" : "");
          }
        }
      }
      if (!placed) placeBox(btn, motion.worldX - sheet.anchor.x, motion.worldY - sheet.anchor.y, fw, fh);
      const zzzEl = zzzRef.current;
      if (zzzEl) {
        zzzEl.hidden = !motion.zzz;
        if (motion.zzz) {
          const ax = poseBox ? poseBox.ax : sheet.anchor.x;
          const ay = poseBox ? poseBox.ay : sheet.anchor.y;
          const bw = poseBox ? poseBox.w : fw;
          const bh = poseBox ? poseBox.h : fh;
          zzzEl.style.left = `${(ax / bw) * 100}%`;
          zzzEl.style.top = `${(Math.max(0, ay - 108) / bh) * 100}%`;
        }
      }
      setData(btn, "seat", motion.seatId);
      setData(btn, "zzz", motion.zzz ? "1" : "0");
      setData(btn, "pose", motion.pose);
      const flip = motion.flip ? "scaleX(-1)" : "";
      writeStyle(frameEl, "transform-origin", `${(sheet.anchor.x / fw) * 100}% 100%`);
      const cloud = cloudRef.current;
      const aura = auraRef.current;
      if (motion.fx === "meditate") {
        const playMs = clipPlayMs(sheet.animations[motion.anim] ?? sheet.animations.meditate);
        const floated = meditateFloatPx(motion.fxMs, playMs);
        writeStyle(frameEl, "transform", `translateY(-${(floated.lift / fh) * 100}%) ${flip}`.trim());
        if (cloud) {
          cloud.hidden = floated.cloud <= 0.01;
          cloud.style.opacity = String(floated.cloud);
          cloud.style.left = `${(sheet.anchor.x / fw) * 100}%`;
          cloud.style.bottom = `${((fh - sheet.anchor.y) / fh) * 100}%`;
        }
      } else {
        writeStyle(frameEl, "transform", flip);
        if (cloud) cloud.hidden = true;
      }
      if (aura) {
        if (motion.fx === "aura") {
          const playMs = clipPlayMs(sheet.animations[motion.anim] ?? sheet.animations.aura);
          const strength = auraStrength(playMs > 0 ? motion.fxMs / playMs : 0);
          aura.hidden = strength <= 0.01;
          aura.style.opacity = String(strength);
        } else {
          aura.hidden = true;
        }
      }
      const show = Boolean(motion.bubbleOn && (motion.bubbleText || motion.bubbleEmoji));
      const float = show && motion.bubbleRoom && Boolean(meowRef.current);
      const bubble = bubbleRef.current;
      if (bubble && textRef.current && emojiRef.current) {
        bubble.hidden = !show || float;
        textRef.current.textContent = float ? "" : motion.bubbleText;
        emojiRef.current.textContent = float ? "" : motion.bubbleEmoji;
        textRef.current.hidden = float || !motion.bubbleText;
        emojiRef.current.hidden = float || !motion.bubbleEmoji;
      }
      const meow = meowRef.current;
      if (meow && meowTextRef.current) {
        meowTextRef.current.textContent = float ? motion.bubbleText : "";
        meow.hidden = !float;
        if (float) placeMeowBubble(meow, btn);
      }
      const post = postRef.current;
      if (post) {
        const scratching = motion.anim === "scratch" || motion.anim === "scratch_r";
        post.hidden = !scratching;
        if (scratching) {
          post.style.left = `${(sheet.anchor.x / fw) * 100}%`;
          post.style.bottom = `${((fh - sheet.anchor.y) / fh) * 100}%`;
        }
      }
      const backSnow = backSnowRef.current;
      const frontSnow = frontSnowRef.current;
      if (backSnow && frontSnow) {
        if (motion.fx === "blizzard") {
          const rect = btn.getBoundingClientRect();
          const scale = fw > 0 ? rect.width / fw : 1;
          const now = performance.now();
          if (!snowRef.current || Math.abs(snowRef.current.scale - scale) > 0.03) {
            snowRef.current = {
              flakes: createSnowflakes(scale, rect.width, rect.height, sheet.anchor.y),
              scale,
              last: now,
            };
          }
          const snow = snowRef.current;
          const dt = Math.min(0.05, Math.max(0, (now - snow.last) / 1000));
          snow.last = now;
          const tSec = motion.fxMs / 1000;
          stepSnow(snow.flakes, dt, tSec, scale, rect.width, rect.height, sheet.anchor.y);
          backSnow.hidden = false;
          frontSnow.hidden = false;
          const paint = {
            k: motion.fxK,
            tSec,
            scale,
            anchorX: sheet.anchor.x,
            anchorY: sheet.anchor.y,
            cssW: rect.width,
            cssH: rect.height,
            dpr: window.devicePixelRatio || 1,
          };
          const back = paintSnow(backSnow, snow.flakes, { ...paint, front: false });
          const front = paintSnow(frontSnow, snow.flakes, { ...paint, front: true });
          setData(btn, "snowBack", String(back.shown));
          setData(btn, "snowFront", String(front.shown));
          setData(btn, "snowFace", String(front.faceDimmed));
        } else if (!backSnow.hidden || !frontSnow.hidden) {
          backSnow.hidden = true;
          frontSnow.hidden = true;
          snowRef.current = null;
          setData(btn, "snowBack", "0");
          setData(btn, "snowFront", "0");
          setData(btn, "snowFace", "0");
        }
      }
      writeStyle(frameEl, "background-size", `${(sw / fw) * 100}% ${(sh / fh) * 100}%`);
      writeStyle(
        frameEl,
        "background-position",
        `${sw === fw ? 0 : (frame.x / (sw - fw)) * 100}% ${sh === fh ? 0 : (frame.y / (sh - fh)) * 100}%`,
      );
    };
    applyRef.current = apply;
    readBox();
    const world = btnRef.current?.closest(".lucky-world");
    const ro = world instanceof HTMLElement ? new ResizeObserver(() => { readBox(); apply(); }) : null;
    if (world instanceof HTMLElement && ro) ro.observe(world);
    apply();
    const unsub = motionRef.subscribe(apply);
    return () => {
      applyRef.current = null;
      unsub();
      ro?.disconnect();
    };
  }, [view.sheet, motionRef]);
  useLayoutEffect(() => {
    applyRef.current?.();
  });
  if (!view.sheet || !view.ready) return null;
  const [fw, fh] = view.sheet.frameSize;
  const [sw, sh] = view.sheet.sheetSize;
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) return;
    downRef.current = { x: event.clientX, y: event.clientY, t: performance.now() };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-released pointers have nothing to capture.
    }
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const down = downRef.current;
    downRef.current = null;
    if (!down || !tapEnabled) return;
    const dist = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const elapsed = performance.now() - down.t;
    if (dist <= 8 && elapsed <= 300) onTap();
  };
  return (
    <button
      ref={btnRef}
      type="button"
      className="lucky-sprite lucky-roam-cat"
      tabIndex={-1}
      aria-label="돌아다니는 고양이"
      data-cat-id={view.breedId}
      data-happy-frames={view.happyFrames >= 2 ? "multi" : "1"}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        downRef.current = null;
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <span ref={bubbleRef} className="lucky-cat-tap-bubble" hidden>
        <span ref={textRef} />
        <span ref={emojiRef} />
      </span>
      {bubbleRoot
        ? createPortal(
            <span ref={meowRef} className="lucky-cat-meow-bubble" hidden>
              <span ref={meowTextRef} />
            </span>,
            bubbleRoot,
          )
        : null}
      <span ref={auraRef} className="lucky-cat-aura" hidden aria-hidden="true" />
      <span ref={cloudRef} className="lucky-cat-cloud" hidden aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <canvas ref={backSnowRef} className="lucky-cat-snow is-back" hidden aria-hidden="true" />
      <span ref={zzzRef} className="lucky-cat-zzz" hidden>
        Zzz
      </span>
      <img ref={poseRef} className="lucky-cat-pose" alt="" draggable={false} hidden />
      <span
        ref={frameRef}
        className="lucky-roam-frame"
        style={{
          width: "100%",
          height: "100%",
          backgroundImage: `url(${catAsset(view.sheet.image)})`,
          backgroundSize: `${(sw / fw) * 100}% ${(sh / fh) * 100}%`,
          backgroundRepeat: "no-repeat",
        }}
      />
      <canvas ref={frontSnowRef} className="lucky-cat-snow is-front" hidden aria-hidden="true" />
      <span ref={postRef} className="lucky-cat-scratcher" hidden aria-hidden="true">
        <span className="lucky-cat-scratcher-post" />
        <span className="lucky-cat-scratcher-base" />
      </span>
    </button>
  );
}

type PublishedCat = {
  catId: string;
  view: RoomCatView;
  motionRef: CatMotionRef;
  tap: () => void;
};

function RoomCatAgent({
  catId,
  slot,
  spotsRef,
  roomId,
  floor,
  walls,
  itemsById,
  mode,
  active,
  reducedTapMotion,
  setBonus,
  favorite,
  onPublish,
}: {
  catId: string;
  slot: number;
  spotsRef: CatSpotsRef;
  roomId: string;
  floor: RoomLayoutState["floor"];
  walls: RoomLayoutState["walls"];
  itemsById: Map<string, RoomItem>;
  mode: RoomMode;
  active: boolean;
  reducedTapMotion: boolean;
  setBonus: RoomSetCue | null;
  favorite: RoomWorldProps["favorite"];
  onPublish: (catId: string, next: PublishedCat | null) => void;
}) {
  const { view, motionRef, tap } = useRoomCat({
    roomId,
    breedId: catId,
    floor,
    walls,
    itemsById,
    mode,
    active,
    reducedMotion: false,
    reducedTapMotion,
    spotsRef,
    slot,
    setBonus,
    favoriteLines: favorite && favorite.catId === catId ? favorite.lines : [],
    seatBias:
      favorite && favorite.catId === catId
        ? { itemId: favorite.seatItemId, mul: favorite.seatMul }
        : null,
    onPet: favorite && favorite.catId === catId ? favorite.onPet : undefined,
  });
  const tapRef = useRef(tap);
  tapRef.current = tap;
  const stableTap = useCallback(() => {
    tapRef.current();
  }, []);
  useEffect(() => {
    onPublish(catId, { catId, view, motionRef, tap: stableTap });
  }, [catId, view, motionRef, stableTap, onPublish]);
  useEffect(() => {
    return () => onPublish(catId, null);
  }, [catId, onPublish]);
  return null;
}

function RoomSetFx({ effect }: { effect: RoomSetCue["effect"] }) {
  const count = effect === "steam" ? 16 : 18;
  return (
    <div className={`lucky-set-fx is-${effect}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`lucky-set-bit${effect === "steam" && index >= 8 ? " is-bean" : ""}`}
          style={{
            ["--x" as string]: `${36 + ((index * 11) % 28)}%`,
            ["--y" as string]: `${34 + ((index * 9) % 24)}%`,
            ["--dur" as string]: `${2.8 + (index % 5) * 0.45}s`,
            ["--delay" as string]: `${(index * 0.31) % 3.2}s`,
            ["--drift" as string]: `${(index % 2 === 0 ? -1 : 1) * (8 + (index % 4) * 6)}px`,
          }}
        />
      ))}
    </div>
  );
}

export const RoomWorld = memo(function RoomWorld({
  mode,
  roomId,
  roamingCatIds,
  roamingActive,
  itemsById,
  layout,
  selectedId,
  dragging,
  hints,
  frameThumbs,
  shakeId,
  shadowsEnabled,
  painting,
  paintPreview = null,
  suggestTile = null,
  suggestItemId = null,
  reduceMotion = false,
  placeFxId = null,
  previewGhost = false,
  previewInvalid = false,
  debugHit = false,
  setBonus = null,
  favorite = null,
  onSelect,
  onItemPointerDown,
  onFloorPointerDown,
}: RoomWorldProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  useHideBrokenImages(worldRef);
  const fit = screenOf(mode).scale;
  const paintSkin = paintPreview ? paintSkinType(paintPreview.itemId) : null;
  const isPaintFloorCell = (col: number, row: number) => {
    if (!paintPreview || paintPreview.paintKind !== "floor" || !paintSkin) return false;
    if (paintPreview.fillAll) return true;
    return paintPreview.target.kind === "floor" && paintPreview.target.col === col && paintPreview.target.row === row;
  };
  const isPaintWallCell = (wall: "L" | "R", index: number) => {
    if (!paintPreview || paintPreview.paintKind !== "wall" || !paintSkin) return false;
    if (paintPreview.fillAll) return true;
    return (
      paintPreview.target.kind === "wall" &&
      paintPreview.target.wall === wall &&
      paintPreview.target.index === index
    );
  };
  // Roaming is the room's main delight — keep walking even when the OS asks to
  // reduce motion (CSS breathing/float still respect prefers-reduced-motion).
  const catIds = [...new Set(roamingCatIds.filter(Boolean))].slice(0, 3);
  const roomCatIds = catIds.length ? catIds : [DEFAULT_CAT_BREED_ID];
  const spotsRef = useRef<Map<string, CatSpot>>(new Map());
  const [publishedCats, setPublishedCats] = useState<Record<string, PublishedCat>>({});
  const onPublishCat = useCallback((catId: string, next: PublishedCat | null) => {
    setPublishedCats((prev) => {
      if (!next) {
        if (!(catId in prev)) return prev;
        const copy = { ...prev };
        delete copy[catId];
        return copy;
      }
      const current = prev[catId];
      if (current && current.view === next.view && current.motionRef === next.motionRef && current.tap === next.tap) {
        return prev;
      }
      return { ...prev, [catId]: next };
    });
  }, []);
  const selected = [...layout.floor, ...layout.walls].find((item) => item.instanceId === selectedId);
  const selectedItem = selected ? itemsById.get(selected.id) : undefined;
  const used = occupancy(layout.floor, itemsById, dragging?.instanceId ?? selectedId ?? undefined);
  const floorDrag = dragging?.kind === "floor" ? dragging : null;
  const wallDrag = dragging?.kind === "wall" ? dragging : null;
  const dragPlace = floorDrag ? layout.floor.find((place) => place.instanceId === floorDrag.instanceId) : undefined;
  const dragItem = dragPlace ? itemsById.get(dragPlace.id) : undefined;
  const dragTiles =
    floorDrag && dragItem && dragPlace && !dragPlace.onTopOf
      ? previewTiles(dragItem, floorDrag.col, floorDrag.row, dragPlace.orientation, used)
      : [];
  const wallDragPlace = wallDrag ? layout.walls.find((place) => place.instanceId === wallDrag.instanceId) : undefined;
  const wallDragItem = wallDragPlace ? itemsById.get(wallDragPlace.id) : undefined;
  const wallUsed = wallOccupancy(layout.walls, itemsById, wallDrag?.instanceId);
  const wallPreviewOk =
    wallDrag && wallDragItem ? canPlaceWall(wallDragItem, wallDrag.wall, wallDrag.slot, wallDrag.band, wallUsed) : false;
  const wallPreviewCells =
    wallDrag && wallDragItem
      ? wallCellsOf(wallDragItem, wallPlaceFromSlot(wallDragItem, wallDrag.wall, wallDrag.slot, wallDrag.band))
      : [];
  const wallGridWall = wallDrag?.wall ?? null;
  const selectedFloor = selected && "col" in selected ? (selected as FloorPlacement) : null;
  const selectedTiles =
    mode === "edit" && selectedFloor && selectedItem && selectedItem.placement !== "wall" && !selectedFloor.onTopOf && !dragging
      ? footprintTilesSafe(selectedFloor, selectedItem)
      : [];

  const suggestItem = suggestItemId ? itemsById.get(suggestItemId) : undefined;
  const resolvedSuggest =
    mode === "edit" && suggestTile && suggestItem
      ? resolveSuggestTile(
          suggestItem,
          "default",
          layout.floor,
          itemsById,
          { col: suggestTile.c, row: suggestTile.r },
        )
      : null;
  const suggestCentre = resolvedSuggest
    ? footprintCentreWorld(
        resolvedSuggest.col,
        resolvedSuggest.row,
        itemSize(suggestItem!, "default")[0],
        itemSize(suggestItem!, "default")[1],
      )
    : null;

  const shownFloor = layout.floor.map((place) => {
    if (floorDrag && place.instanceId === floorDrag.instanceId && !place.onTopOf) {
      return { ...place, col: floorDrag.col, row: floorDrag.row };
    }
    return place;
  });
  const shownWalls = layout.walls.map((place) => {
    if (wallDrag && wallDragItem && place.instanceId === wallDrag.instanceId) {
      return {
        ...place,
        ...wallPlaceFromSlot(wallDragItem, wallDrag.wall, wallDrag.slot, wallDrag.band),
        worldPx: undefined,
      };
    }
    return place;
  });

  const floorSorted = sortFloor(shownFloor, itemsById);
  const decals = floorSorted.filter((place) => isDecal(itemsById.get(place.id)));
  const furniture = floorSorted.filter((place) => !isDecal(itemsById.get(place.id)));
  const liftedHost = selectedFloor && mode === "edit" ? selectedFloor : null;
  const liftedIds = new Set<string>();
  if (liftedHost) {
    liftedIds.add(liftedHost.instanceId);
    for (const child of shownFloor) {
      if (child.onTopOf === liftedHost.id || child.onTopOf === liftedHost.instanceId) {
        liftedIds.add(child.instanceId);
      }
    }
    const parent = hostOf(liftedHost, shownFloor);
    if (parent && liftedHost.onTopOf) liftedIds.add(liftedHost.instanceId);
  }
  const furnitureDrawn = [
    ...furniture.filter((place) => !liftedIds.has(place.instanceId)),
    ...furniture.filter((place) => liftedIds.has(place.instanceId)),
  ];

  const lightGlows: { key: string; x: number; y: number; neon: boolean }[] = [];
  for (const place of shownFloor) {
    if (!emitsLight(place.id)) continue;
    const item = itemsById.get(place.id);
    if (!item) continue;
    const rect = spriteRect(item, place, shownFloor, itemsById);
    lightGlows.push({
      key: place.instanceId,
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h * 0.28,
      neon: NEON_ITEM_IDS.has(place.id),
    });
  }
  for (const place of shownWalls) {
    if (!emitsLight(place.id)) continue;
    const item = itemsById.get(place.id);
    if (!item) continue;
    const rect = wallSpriteRect(item, place);
    lightGlows.push({
      key: place.instanceId,
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h * 0.4,
      neon: NEON_ITEM_IDS.has(place.id),
    });
  }
  const windows = shownWalls.flatMap((place) => {
    if (!WINDOW_ITEM_IDS.has(place.id)) return [];
    const item = itemsById.get(place.id);
    if (!item) return [];
    return [{ key: place.instanceId, wall: place.wall, rect: wallSpriteRect(item, place) }];
  });

  const lamp = shownFloor.find((place) => place.id === "floorlamp");
  const lampItem = itemsById.get("floorlamp");
  const lampRect =
    lamp && lampItem ? spriteRect(lampItem, lamp, shownFloor, itemsById) : null;
  const defaultLampRect =
    lampItem
      ? spriteRect(
          lampItem,
          { instanceId: "p-floorlamp", id: "floorlamp", col: 0, row: 0, orientation: "default" },
          shownFloor,
          itemsById,
        )
      : null;
  const glowShift =
    lampRect && defaultLampRect
      ? { x: lampRect.x - defaultLampRect.x, y: lampRect.y - defaultLampRect.y }
      : { x: 0, y: 0 };

  const renderFurniture = (place: FloorPlacement) => {
    const item = itemsById.get(place.id);
    if (!item) return null;
    const rect = spriteRect(item, place, shownFloor, itemsById);
    const isPreview = Boolean(previewGhost && dragging?.instanceId === place.instanceId);
    const lifted = liftedIds.has(place.instanceId);
    const depth = furnitureDepthKey(place, item);
    return (
      <FloorSprite
        key={place.instanceId}
        place={place}
        item={item}
        rect={rect}
        selected={place.instanceId === selectedId}
        lifted={lifted}
        shaking={place.instanceId === shakeId}
        flipped={!item.furniture && place.orientation === "mirrored"}
        thumbs={frameThumbs}
        placeFx={place.instanceId === placeFxId}
        previewGhost={isPreview}
        previewInvalid={isPreview && previewInvalid}
        fit={fit}
        zIndex={isPreview ? 9 : lifted ? 8 : spriteDepthZ(depth.front, depth.bias)}
        onSelect={(id) => onSelect(id, "floor")}
        onItemPointerDown={onItemPointerDown}
      />
    );
  };
  const raisedFurniture = furnitureDrawn.filter(
    (place) => liftedIds.has(place.instanceId) || Boolean(previewGhost && dragging?.instanceId === place.instanceId),
  );
  const depthFurniture = furnitureDrawn.filter((place) => !raisedFurniture.includes(place));

  return (
    <div
      ref={worldRef}
      className={`lucky-world ${painting ? "is-painting" : ""} ${mode === "view" ? "is-view" : ""} ${debugHit ? "is-debug-hit" : ""}`}
      style={{ ["--room-fit" as string]: fit }}
      onPointerDown={onFloorPointerDown}
    >
      <Layer src="world/base-bg.webp" className="is-base" />
      <div className="lucky-tod-sky" aria-hidden="true" />
      <div className="lucky-world-layer lucky-floor-tiles" aria-hidden="true">
        {layout.floorTiles.map((row, r) =>
          row.map((id, c) => {
            const rect = floorTileRect(c, r);
            const previewing = isPaintFloorCell(c, r);
            const skin = previewing && paintSkin ? paintSkin : id;
            return (
              <img
                key={`ft-${c}-${r}`}
                className={`lucky-floor-tile ${previewing ? "is-paint-preview" : ""} ${
                  previewing && paintPreview && !paintPreview.valid ? "is-paint-invalid" : ""
                } ${previewing && reduceMotion ? "is-reduced" : ""}`}
                src={roomAsset(floorTileSrc(skin, c, r))}
                alt=""
                draggable={false}
                style={tileClipStyle(rect, FLOOR_CLIP)}
              />
            );
          }),
        )}
      </div>
      <div className="lucky-world-layer lucky-wall-tiles" aria-hidden="true">
        {(["L", "R"] as const).flatMap((wall) =>
          layout.wallTiles[wall].map((id, index) => {
            const rect = wallStripRect(wall, index);
            const previewing = isPaintWallCell(wall, index);
            const skin = previewing && paintSkin ? paintSkin : id;
            return (
              <img
                key={`wt-${wall}-${index}`}
                className={`lucky-wall-tile is-${wall} ${previewing ? "is-paint-preview" : ""} ${
                  previewing && paintPreview && !paintPreview.valid ? "is-paint-invalid" : ""
                } ${previewing && reduceMotion ? "is-reduced" : ""}`}
                src={roomAsset(wallStripSrc(skin, wall, index))}
                alt=""
                draggable={false}
                style={tileClipStyle(rect, WALL_CLIP[wall])}
              />
            );
          }),
        )}
      </div>
      <Layer src={mode === "edit" ? "world/room-frame-edit.svg" : "world/room-frame-view.webp"} className="is-frame" />
      <Layer src="world/string-lights.webp" className="is-lights" />

      {mode === "edit" ? (
        <svg className="lucky-world-layer lucky-tile-layer" viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}>
          {hints?.map((tile) => (
            <TilePoly key={`h-${tile.col}-${tile.row}`} col={tile.col} row={tile.row} tone="hint" />
          ))}
          {selectedTiles.map((tile) => (
            <TilePoly
              key={`s-${tile.col}-${tile.row}`}
              col={tile.col}
              row={tile.row}
              tone={previewGhost && previewInvalid ? "invalid" : "selected"}
            />
          ))}
          {dragTiles.map((tile) => (
            <TilePoly
              key={`d-${tile.col}-${tile.row}`}
              col={tile.col}
              row={tile.row}
              tone={tile.valid && !(previewGhost && previewInvalid) ? "valid" : "invalid"}
            />
          ))}
          {resolvedSuggest ? (
            <TilePoly
              key={`suggest-${resolvedSuggest.col}-${resolvedSuggest.row}`}
              col={resolvedSuggest.col}
              row={resolvedSuggest.row}
              tone="suggest"
            />
          ) : null}
        </svg>
      ) : null}

      {mode === "edit" && resolvedSuggest && suggestItem && suggestCentre ? (
        <div
          className={`lucky-suggest-ghost ${reduceMotion ? "is-reduced" : ""}`}
          aria-hidden="true"
        >
          {/* Screen-space anchor for tutorial drag-guide arrow (RoomTutDragGuide). */}
          <div
            id="room-suggest-target"
            className="lucky-suggest-anchor"
            style={{
              left: pctX(suggestCentre.x),
              top: pctY(suggestCentre.y),
            }}
          />
          <img
            className="lucky-suggest-item"
            src={roomAsset(suggestItem.tileImage ?? suggestItem.image ?? `tiles/${suggestItem.id}.png`)}
            alt=""
            style={{
              left: pctX(suggestCentre.x),
              top: pctY(suggestCentre.y),
            }}
            draggable={false}
          />
          {/* Local finger replaced by RoomTutDragGuide path finger during tutorial. */}
        </div>
      ) : null}

      {mode === "edit" && wallGridWall ? (
        <svg className="lucky-world-layer lucky-wall-tile-layer" viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}>
          {Array.from({ length: WALL_SLOTS }, (_, slot) =>
            Array.from({ length: WALL_BANDS }, (_, band) => (
              <WallCell key={`g-${wallGridWall}-${slot}-${band}`} wall={wallGridWall} slot={slot} band={band} tone="grid" />
            )),
          )}
          {wallPreviewCells.map((cell) => (
            <WallCell
              key={`p-${cell.wall}-${cell.slot}-${cell.band}`}
              wall={cell.wall}
              slot={cell.slot}
              band={cell.band}
              tone={wallPreviewOk ? "valid" : "invalid"}
            />
          ))}
        </svg>
      ) : null}

      {decals.map((place) => {
        const item = itemsById.get(place.id);
        if (!item) return null;
        const rect = spriteRect(item, place, shownFloor, itemsById);
        const isPreview = Boolean(previewGhost && dragging?.instanceId === place.instanceId);
        return (
          <FloorSprite
            key={place.instanceId}
            place={place}
            item={item}
            rect={rect}
            selected={place.instanceId === selectedId}
            lifted={liftedIds.has(place.instanceId)}
            shaking={place.instanceId === shakeId}
            flipped={place.orientation === "mirrored"}
            thumbs={frameThumbs}
            placeFx={place.instanceId === placeFxId}
            previewGhost={isPreview}
            previewInvalid={isPreview && previewInvalid}
            fit={fit}
            zIndex={isPreview ? 9 : liftedIds.has(place.instanceId) ? 8 : 1}
            onSelect={(id) => onSelect(id, "floor")}
            onItemPointerDown={onItemPointerDown}
          />
        );
      })}

      {shadowsEnabled
        ? furniture.map((place) => {
            const item = itemsById.get(place.id);
            if (!item) return null;
            const shadow = shadowRect(item, place);
            if (!shadow) return null;
            const liftedShadow = liftedIds.has(place.instanceId);
            return (
              <img
                key={`sh-${place.instanceId}`}
                className={`lucky-contact-shadow${liftedShadow ? " is-lifted" : ""}`}
                src={roomAsset(shadow.src)}
                alt=""
                draggable={false}
                style={worldBox(shadow)}
              />
            );
          })
        : null}

      {roomCatIds.map((catId) => {
        const published = publishedCats[catId];
        if (!published?.view.ready) return null;
        return <RoamingCatShadow key={`shadow-${catId}`} view={published.view} motionRef={published.motionRef} />;
      })}

      {shownWalls.map((place) => {
        const isPreview = Boolean(previewGhost && dragging?.instanceId === place.instanceId);
        return (
          <WallSprite
            key={place.instanceId}
            place={place}
            item={itemsById.get(place.id)}
            selected={place.instanceId === selectedId}
            lifted={(place.instanceId === selectedId && mode === "edit") || isPreview}
            shaking={place.instanceId === shakeId}
            thumbs={frameThumbs}
            placeFx={place.instanceId === placeFxId}
            previewGhost={isPreview}
            previewInvalid={isPreview && previewInvalid}
            fit={fit}
            onSelect={(id) => onSelect(id, "wall")}
            onItemPointerDown={onItemPointerDown}
          />
        );
      })}

      <div className="lucky-tod-wash" aria-hidden="true" />
      {setBonus ? <RoomSetFx effect={setBonus.effect} /> : null}
      {windows.map((win) => (
        <div key={`sky-${win.key}`} className="lucky-window-sky" style={windowGlassBox(win.rect)} aria-hidden="true" />
      ))}
      {windows.map((win) => (
        <div
          key={`beam-${win.key}`}
          className={`lucky-sunbeam is-${win.wall}`}
          style={{
            left: pctX(win.rect.x + win.rect.w * 0.35),
            top: pctY(win.rect.y + win.rect.h * 0.22),
          }}
          aria-hidden="true"
        />
      ))}

      {roomCatIds.map((catId, slot) => (
        <RoomCatAgent
          key={catId}
          catId={catId}
          slot={slot}
          spotsRef={spotsRef}
          roomId={roomId}
          floor={layout.floor}
          walls={layout.walls}
          itemsById={itemsById}
          mode={mode}
          active={roamingActive}
          reducedTapMotion={reduceMotion}
          setBonus={setBonus}
          favorite={favorite}
          onPublish={onPublishCat}
        />
      ))}

      <div className="lucky-depth">
        {depthFurniture.map(renderFurniture)}
        {roomCatIds.map((catId) => {
          const published = publishedCats[catId];
          if (!published?.view.ready) return null;
          return (
            <RoamingCatBody
              key={`roaming-cat-${catId}`}
              view={published.view}
              motionRef={published.motionRef}
              onTap={() => {
                AudioManager.playSfx("meow", { catId });
                published.tap();
              }}
              tapEnabled={mode !== "edit" && !dragging && !previewGhost}
            />
          );
        })}
      </div>
      {raisedFurniture.map(renderFurniture)}

      {lamp ? (
        <img
          className="lucky-world-layer lucky-lamp-glow"
          src={roomAsset("world/lamp-glow-additive.webp")}
          alt=""
          style={{ transform: `translate(${(glowShift.x / WORLD_W) * 100}%, ${(glowShift.y / WORLD_H) * 100}%)` }}
          draggable={false}
        />
      ) : null}
      {lightGlows.map((glow) => (
        <span
          key={`glow-${glow.key}`}
          className={`lucky-item-glow ${glow.neon ? "is-neon" : ""}`}
          style={{ left: pctX(glow.x), top: pctY(glow.y) }}
          aria-hidden="true"
        />
      ))}

      <Layer src={mode === "edit" ? "world/front-puffs-edit.svg" : "world/front-puffs-view.webp"} className="is-puffs" />
    </div>
  );
});

function footprintTilesSafe(place: FloorPlacement, item: RoomItem) {
  const [w, d] = itemSize(item, place.orientation);
  const tiles: { col: number; row: number }[] = [];
  for (let dc = 0; dc < w; dc += 1) {
    for (let dr = 0; dr < d; dr += 1) {
      tiles.push({ col: place.col + dc, row: place.row + dr });
    }
  }
  return tiles;
}

function WallSprite({
  place,
  item,
  selected,
  lifted,
  shaking,
  thumbs,
  placeFx = false,
  previewGhost = false,
  previewInvalid = false,
  fit,
  onSelect,
  onItemPointerDown,
}: {
  place: WallPlacement;
  item?: RoomItem;
  selected: boolean;
  lifted: boolean;
  shaking: boolean;
  thumbs: string[];
  placeFx?: boolean;
  previewGhost?: boolean;
  previewInvalid?: boolean;
  fit: number;
  onSelect: (id: string) => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
}) {
  if (!item) return null;
  const rect = wallSpriteRect(item, place);
  const frames = item.id === "cardframe" || item.id === "squareframe";
  const liftWorld = previewGhost ? -24 : lifted ? -12 : 0;
  const liftY = liftWorld ? `translateY(${liftWorld * fit}px)` : undefined;
  return (
    <button
      type="button"
      className={`lucky-sprite is-wall is-wall-${place.wall} ${selected ? "is-selected" : ""} ${lifted || previewGhost ? "is-lifted" : ""} ${previewGhost ? "is-preview-ghost" : ""} ${previewInvalid ? "is-preview-invalid" : ""} ${shaking ? "is-shake" : ""} ${placeFx ? "is-place-fx" : ""}`}
      style={{
        ...worldBox(rect),
        transform: liftY,
      }}
      aria-label={item.nameKo}
      onPointerDown={(event) => onItemPointerDown(event, place.instanceId)}
      onClick={() => onSelect(place.instanceId)}
    >
      {rect.src ? <img src={roomAsset(rect.src)} alt="" draggable={false} /> : null}
      {placeFx ? <span className="lucky-place-sparkles" aria-hidden="true" /> : null}
      {placeFx ? <span className="lucky-place-dust" aria-hidden="true" /> : null}
      {frames && thumbs[0] ? (
        <span className={`lucky-frame-art is-${item.id} is-wall-${place.wall}`} aria-hidden="true">
          <img src={thumbs[0]} alt="" />
        </span>
      ) : null}
    </button>
  );
}
