import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import { roomAsset } from "../lib/roomCatalog";
import { AudioManager } from "../audio/AudioManager";
import {
  DEFAULT_CAT_BREED_ID,
  auraStrength,
  catAsset,
  catDepthKey,
  clipPlayMs,
  defaultSitFrame,
  furnitureDepthKey,
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
  floorTileRect,
  floorTileSrc,
  paintSkinType,
  wallStripRect,
  wallStripSrc,
} from "../lib/roomTiles";
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
  onSelect: (instanceId: string | null, kind: "floor" | "wall") => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, instanceId: string) => void;
  onFloorPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
};

/** World pixels as a percentage of the on-screen island (not a 3840px layer). */
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
  onSelect: (id: string) => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
}) {
  const frames = item.id === "cardframe" || item.id === "squareframe";
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
        transform: `${flipped ? "scaleX(-1) " : ""}${liftY}`.trim() || undefined,
      }}
      aria-label={item.nameKo}
      onPointerDown={(event) => onItemPointerDown(event, place.instanceId)}
      onClick={() => onSelect(place.instanceId)}
    >
      {rect.src ? (
        <img src={roomAsset(rect.src)} alt="" draggable={false} />
      ) : (
        <span className="lucky-sprite-fallback">{item.nameKo}</span>
      )}
      {placeFx ? <span className="lucky-place-sparkles" aria-hidden="true" /> : null}
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
  useEffect(() => {
    if (!view.sheet) return;
    const shadow = view.sheet.shadow;
    const apply = () => {
      const el = imgRef.current;
      if (!el) return;
      const motion = motionRef.current;
      const loafish =
        motion.anim === "loaf" ||
        motion.anim === "loaf_r" ||
        motion.anim === "sleep" ||
        motion.anim === "sleep_r";
      const scale = loafish ? 0.8 : 1;
      const x = motion.worldX - shadow.anchor[0] * scale;
      const y = motion.worldY - shadow.anchor[1] * scale;
      el.style.left = pctX(x);
      el.style.top = pctY(y);
      el.style.width = pctX(shadow.size[0] * scale);
      el.style.height = pctY(shadow.size[1] * scale);
      el.style.opacity = motion.spriteHidden ? "0" : String(motion.opacity);
      el.style.transform = "";
    };
    apply();
    return motionRef.subscribe(apply);
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
  const snowRef = useRef<{ flakes: SnowFlake[]; scale: number; last: number } | null>(null);
  const [bubbleRoot, setBubbleRoot] = useState<HTMLElement | null>(null);
  const downRef = useRef<{ x: number; y: number; t: number } | null>(null);
  useLayoutEffect(() => {
    const root = btnRef.current?.closest(".lucky-island-port");
    if (root instanceof HTMLElement) setBubbleRoot(root);
  }, [view.sheet]);
  useEffect(() => {
    if (!view.sheet) return;
    const sheet = view.sheet;
    const [fw, fh] = sheet.frameSize;
    const apply = () => {
      const btn = btnRef.current;
      const frameEl = frameRef.current;
      if (!btn || !frameEl) return;
      const motion = motionRef.current;
      const frame = sheet.frames[motion.frameName] ?? sheet.frames[defaultSitFrame(sheet)];
      if (!frame) return;
      const x = motion.worldX - sheet.anchor.x;
      const y = motion.worldY - sheet.anchor.y;
      btn.style.left = pctX(x);
      btn.style.top = pctY(y);
      btn.style.width = pctX(fw);
      btn.style.height = pctY(fh);
      btn.style.opacity = String(motion.opacity);
      btn.style.transform = "";
      btn.classList.toggle("is-sleeping", motion.anim === "sleep" || motion.anim === "sleep_r");
      btn.dataset.catAnim = motion.anim;
      btn.dataset.catFlip = motion.flip ? "1" : "0";
      btn.dataset.catFx = motion.fx;
      btn.dataset.spriteHidden = motion.spriteHidden ? "1" : "0";
      frameEl.style.opacity = motion.spriteHidden ? "0" : "1";
      const flip = motion.flip ? "scaleX(-1)" : "";
      frameEl.style.transformOrigin = `${(sheet.anchor.x / fw) * 100}% 100%`;
      const cloud = cloudRef.current;
      const aura = auraRef.current;
      if (motion.fx === "meditate") {
        const playMs = clipPlayMs(sheet.animations[motion.anim] ?? sheet.animations.meditate);
        const floated = meditateFloatPx(motion.fxMs, playMs);
        frameEl.style.transform = `translateY(-${(floated.lift / fh) * 100}%) ${flip}`.trim();
        if (cloud) {
          cloud.hidden = floated.cloud <= 0.01;
          cloud.style.opacity = String(floated.cloud);
          cloud.style.left = `${(sheet.anchor.x / fw) * 100}%`;
          cloud.style.bottom = `${((fh - sheet.anchor.y) / fh) * 100}%`;
        }
      } else {
        frameEl.style.transform = flip;
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
          btn.dataset.snowBack = String(back.shown);
          btn.dataset.snowFront = String(front.shown);
          btn.dataset.snowFace = String(front.faceDimmed);
        } else if (!backSnow.hidden || !frontSnow.hidden) {
          backSnow.hidden = true;
          frontSnow.hidden = true;
          snowRef.current = null;
          btn.dataset.snowBack = "0";
          btn.dataset.snowFront = "0";
          btn.dataset.snowFace = "0";
        }
      }
      const [sw, sh] = sheet.sheetSize;
      frameEl.style.backgroundSize = `${(sw / fw) * 100}% ${(sh / fh) * 100}%`;
      frameEl.style.backgroundPosition = `${sw === fw ? 0 : (frame.x / (sw - fw)) * 100}% ${sh === fh ? 0 : (frame.y / (sh - fh)) * 100}%`;
    };
    apply();
    return motionRef.subscribe(apply);
  }, [view.sheet, motionRef]);
  if (!view.sheet || !view.ready) return null;
  const [fw, fh] = view.sheet.frameSize;
  const [sw, sh] = view.sheet.sheetSize;
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) return;
    downRef.current = { x: event.clientX, y: event.clientY, t: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
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
      className={`lucky-sprite lucky-roam-cat ${view.sleeping ? "is-sleeping" : ""}`}
      tabIndex={-1}
      aria-label="돌아다니는 고양이"
      data-cat-id={view.breedId}
      data-cat-flip="0"
      data-happy-frames={view.happyFrames >= 2 ? "multi" : "1"}
      style={{ width: pctX(fw), height: pctY(fh), opacity: view.opacity, left: 0, top: 0 }}
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
  itemsById,
  mode,
  active,
  reducedTapMotion,
  onPublish,
}: {
  catId: string;
  slot: number;
  spotsRef: CatSpotsRef;
  roomId: string;
  floor: RoomLayoutState["floor"];
  itemsById: Map<string, RoomItem>;
  mode: RoomMode;
  active: boolean;
  reducedTapMotion: boolean;
  onPublish: (catId: string, next: PublishedCat | null) => void;
}) {
  const { view, motionRef, tap } = useRoomCat({
    roomId,
    breedId: catId,
    floor,
    itemsById,
    mode,
    active,
    reducedMotion: false,
    reducedTapMotion,
    spotsRef,
    slot,
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

export function RoomWorld({
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
  onSelect,
  onItemPointerDown,
  onFloorPointerDown,
}: RoomWorldProps) {
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

  type DrawEntry =
    | { kind: "furniture"; place: FloorPlacement; front: number; bias: number }
    | { kind: "cat"; catId: string; front: number; bias: number };
  const drawList: DrawEntry[] = furnitureDrawn.map((place) => {
    const item = itemsById.get(place.id);
    const depth = item ? furnitureDepthKey(place, item) : { front: 0, bias: 0 };
    return { kind: "furniture" as const, place, front: depth.front, bias: depth.bias };
  });
  for (const catId of roomCatIds) {
    const published = publishedCats[catId];
    if (!published?.view.ready) continue;
    const depth = catDepthKey(published.view.depthCol, published.view.depthRow);
    drawList.push({ kind: "cat", catId, front: depth.front, bias: depth.bias });
  }
  drawList.sort((a, b) => (a.front !== b.front ? a.front - b.front : a.bias - b.bias));

  return (
    <div
      className={`lucky-world ${painting ? "is-painting" : ""} ${mode === "view" ? "is-view" : ""}`}
      style={{ ["--room-fit" as string]: fit }}
      onPointerDown={onFloorPointerDown}
    >
      <Layer src="world/base-bg.webp" />
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
                style={worldBox(rect)}
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
                style={worldBox(rect)}
              />
            );
          }),
        )}
      </div>
      <Layer src={mode === "edit" ? "world/room-frame-edit.svg" : "world/room-frame-view.svg"} className="is-frame" />

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
            return (
              <img
                key={`sh-${place.instanceId}`}
                className="lucky-contact-shadow"
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
            previewGhost={isPreview}
            previewInvalid={isPreview && previewInvalid}
            fit={fit}
            onSelect={(id) => onSelect(id, "wall")}
            onItemPointerDown={onItemPointerDown}
          />
        );
      })}

      {/* string lights are baked into world/room-frame-* */}

      {roomCatIds.map((catId, slot) => (
        <RoomCatAgent
          key={catId}
          catId={catId}
          slot={slot}
          spotsRef={spotsRef}
          roomId={roomId}
          floor={layout.floor}
          itemsById={itemsById}
          mode={mode}
          active={roamingActive}
          reducedTapMotion={reduceMotion}
          onPublish={onPublishCat}
        />
      ))}

      {drawList.map((entry) => {
        if (entry.kind === "cat") {
          const published = publishedCats[entry.catId];
          if (!published) return null;
          return (
            <RoamingCatBody
              key={`roaming-cat-${entry.catId}`}
              view={published.view}
              motionRef={published.motionRef}
              onTap={() => {
                AudioManager.playSfx("meow", { catId: entry.catId });
                published.tap();
              }}
              tapEnabled={mode !== "edit" && !dragging && !previewGhost}
            />
          );
        }
        const place = entry.place;
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
            flipped={!item.furniture && place.orientation === "mirrored"}
            thumbs={frameThumbs}
            placeFx={place.instanceId === placeFxId}
            previewGhost={isPreview}
            previewInvalid={isPreview && previewInvalid}
            fit={fit}
            onSelect={(id) => onSelect(id, "floor")}
            onItemPointerDown={onItemPointerDown}
          />
        );
      })}

      {lamp ? (
        <img
          className="lucky-world-layer lucky-lamp-glow"
          src={roomAsset("world/lamp-glow-additive.webp")}
          alt=""
          style={{ transform: `translate(${(glowShift.x / WORLD_W) * 100}%, ${(glowShift.y / WORLD_H) * 100}%)` }}
          draggable={false}
        />
      ) : null}

      <Layer src={mode === "edit" ? "world/front-puffs-edit.svg" : "world/front-puffs-view.svg"} className="is-puffs" />
    </div>
  );
}

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
      className={`lucky-sprite is-wall is-wall-${place.wall} ${selected ? "is-selected" : ""} ${lifted || previewGhost ? "is-lifted" : ""} ${previewGhost ? "is-preview-ghost" : ""} ${previewInvalid ? "is-preview-invalid" : ""} ${shaking ? "is-shake" : ""}`}
      style={{
        ...worldBox(rect),
        transform: liftY,
      }}
      aria-label={item.nameKo}
      onPointerDown={(event) => onItemPointerDown(event, place.instanceId)}
      onClick={() => onSelect(place.instanceId)}
    >
      {rect.src ? <img src={roomAsset(rect.src)} alt="" draggable={false} /> : null}
      {frames && thumbs[0] ? (
        <span className={`lucky-frame-art is-${item.id} is-wall-${place.wall}`} aria-hidden="true">
          <img src={thumbs[0]} alt="" />
        </span>
      ) : null}
    </button>
  );
}
