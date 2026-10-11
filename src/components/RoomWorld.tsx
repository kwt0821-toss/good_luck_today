import { useEffect, useRef, type PointerEvent } from "react";

import { roomAsset } from "../lib/roomCatalog";
import { catAsset, catDepthKey, furnitureDepthKey } from "../lib/roomCat";
import {
  WALL_BANDS,
  WALL_SLOTS,
  WORLD_H,
  WORLD_W,
  canPlaceWall,
  diamondPoints,
  hostOf,
  isDecal,
  itemSize,
  occupancy,
  previewTiles,
  shadowRect,
  sortFloor,
  spriteRect,
  wallCellPoints,
  wallCellsOf,
  wallOccupancy,
  wallPlaceFromSlot,
  wallSpriteRect,
} from "../lib/roomLayout";
import { floorTileRect, floorTileSrc, wallStripPoints, wallStripRect, wallStripSrc } from "../lib/roomTiles";
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
import { useRoomCat, type CatMotionRef, type RoomCatView } from "../lib/useRoomCat";

type RoomWorldProps = {
  mode: RoomMode;
  roomId: string;
  roamingCatId: string | null;
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
  onSelect: (instanceId: string | null, kind: "floor" | "wall") => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, instanceId: string) => void;
  onFloorPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
};

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
  tone: "selected" | "valid" | "invalid" | "hint" | "paint";
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
  onSelect: (id: string) => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
}) {
  const frames = item.id === "cardframe" || item.id === "squareframe";
  return (
    <button
      type="button"
      className={[
        "lucky-sprite",
        selected ? "is-selected" : "",
        lifted ? "is-lifted" : "",
        shaking ? "is-shake" : "",
        item.hero || item.id === "catbed_cat" ? "is-catbed" : "",
        isDecal(item) ? "is-rug" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        transform: `${flipped ? "scaleX(-1) " : ""}${lifted ? "translateY(-12px)" : ""}`.trim(),
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
      const loafish = motion.anim === "loaf" || motion.anim === "sleep";
      const scale = loafish ? 0.8 : 1;
      el.style.left = `${motion.worldX - shadow.anchor[0] * scale}px`;
      el.style.top = `${motion.worldY - shadow.anchor[1] * scale}px`;
      el.style.width = `${shadow.size[0] * scale}px`;
      el.style.height = `${shadow.size[1] * scale}px`;
      el.style.opacity = String(motion.opacity);
    };
    apply();
    return motionRef.subscribe?.(apply);
  }, [view.sheet, motionRef]);
  if (!view.sheet || !view.ready) return null;
  return <img ref={imgRef} className="lucky-roam-shadow" src={catAsset(view.sheet.shadow.image)} alt="" draggable={false} />;
}

function RoamingCatBody({
  view,
  motionRef,
  onTap,
}: {
  view: RoomCatView;
  motionRef: CatMotionRef;
  onTap: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!view.sheet) return;
    const sheet = view.sheet;
    const [fw, fh] = sheet.frameSize;
    const apply = () => {
      const btn = btnRef.current;
      const frameEl = frameRef.current;
      if (!btn || !frameEl) return;
      const motion = motionRef.current;
      const frame = sheet.frames[motion.frameName] ?? sheet.frames.sit;
      if (!frame) return;
      btn.style.left = `${motion.worldX - sheet.anchor.x}px`;
      btn.style.top = `${motion.worldY - sheet.anchor.y}px`;
      btn.style.width = `${fw}px`;
      btn.style.height = `${fh}px`;
      btn.style.opacity = String(motion.opacity);
      btn.classList.toggle("is-sleeping", motion.anim === "sleep");
      frameEl.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
    };
    apply();
    return motionRef.subscribe?.(apply);
  }, [view.sheet, motionRef]);
  if (!view.sheet || !view.ready) return null;
  const [fw, fh] = view.sheet.frameSize;
  const [sw, sh] = view.sheet.sheetSize;
  return (
    <button
      ref={btnRef}
      type="button"
      className={`lucky-sprite lucky-roam-cat ${view.sleeping ? "is-sleeping" : ""}`}
      aria-label="돌아다니는 고양이"
      style={{ width: fw, height: fh, opacity: view.opacity }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onTap();
      }}
    >
      <span
        ref={frameRef}
        className="lucky-roam-frame"
        style={{
          width: fw,
          height: fh,
          backgroundImage: `url(${catAsset(view.sheet.image)})`,
          backgroundSize: `${sw}px ${sh}px`,
          backgroundRepeat: "no-repeat",
        }}
      />
    </button>
  );
}

export function RoomWorld({
  mode,
  roomId,
  roamingCatId,
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
  paintHover,
  onSelect,
  onItemPointerDown,
  onFloorPointerDown,
}: RoomWorldProps) {
  const { view: catView, motionRef: catMotionRef, tap: tapCat } = useRoomCat({
    roomId,
    breedId: roamingCatId,
    floor: layout.floor,
    itemsById,
    mode,
    active: roamingActive,
    reducedMotion: false,
  });
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
    | { kind: "cat"; front: number; bias: number };
  const drawList: DrawEntry[] = furnitureDrawn.map((place) => {
    const item = itemsById.get(place.id);
    const depth = item ? furnitureDepthKey(place, item) : { front: 0, bias: 0 };
    return { kind: "furniture" as const, place, front: depth.front, bias: depth.bias };
  });
  if (catView.ready) {
    const depth = catDepthKey(catView.depthCol, catView.depthRow);
    drawList.push({ kind: "cat", front: depth.front, bias: depth.bias });
  }
  drawList.sort((a, b) => (a.front !== b.front ? a.front - b.front : a.bias - b.bias));

  return (
    <div
      className={`lucky-world ${painting ? "is-painting" : ""} ${mode === "view" ? "is-view" : ""}`}
      onPointerDown={onFloorPointerDown}
    >
      <Layer src="world/base-bg.webp" />
      <div className="lucky-world-layer lucky-floor-tiles" aria-hidden="true">
        {layout.floorTiles.map((row, r) =>
          row.map((id, c) => {
            const rect = floorTileRect(c, r);
            return (
              <img
                key={`ft-${c}-${r}`}
                className="lucky-floor-tile"
                src={roomAsset(floorTileSrc(id, c, r))}
                alt=""
                draggable={false}
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              />
            );
          }),
        )}
      </div>
      <div className="lucky-world-layer lucky-wall-tiles" aria-hidden="true">
        {(["L", "R"] as const).flatMap((wall) =>
          layout.wallTiles[wall].map((id, index) => {
            const rect = wallStripRect(wall, index);
            return (
              <img
                key={`wt-${wall}-${index}`}
                className={`lucky-wall-tile is-${wall}`}
                src={roomAsset(wallStripSrc(id, wall, index))}
                alt=""
                draggable={false}
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
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
            <TilePoly key={`s-${tile.col}-${tile.row}`} col={tile.col} row={tile.row} tone="selected" />
          ))}
          {dragTiles.map((tile) => (
            <TilePoly
              key={`d-${tile.col}-${tile.row}`}
              col={tile.col}
              row={tile.row}
              tone={tile.valid ? "valid" : "invalid"}
            />
          ))}
          {paintHover?.kind === "floor" ? (
            <TilePoly key="paint-floor" col={paintHover.col} row={paintHover.row} tone="paint" />
          ) : null}
        </svg>
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

      {mode === "edit" && paintHover?.kind === "wall" ? (
        <svg className="lucky-world-layer lucky-paint-layer" viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}>
          <polygon className="lucky-tile is-paint is-wall" points={wallStripPoints(paintHover.wall, paintHover.index)} />
        </svg>
      ) : null}

      {decals.map((place) => {
        const item = itemsById.get(place.id);
        if (!item) return null;
        const rect = spriteRect(item, place, shownFloor, itemsById);
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
                style={{
                  left: shadow.x,
                  top: shadow.y,
                  width: shadow.w,
                  height: shadow.h,
                }}
              />
            );
          })
        : null}

      {catView.ready ? <RoamingCatShadow view={catView} motionRef={catMotionRef} /> : null}

      {shownWalls.map((place) => (
        <WallSprite
          key={place.instanceId}
          place={place}
          item={itemsById.get(place.id)}
          selected={place.instanceId === selectedId}
          lifted={place.instanceId === selectedId && mode === "edit"}
          shaking={place.instanceId === shakeId}
          thumbs={frameThumbs}
          onSelect={(id) => onSelect(id, "wall")}
          onItemPointerDown={onItemPointerDown}
        />
      ))}

      {/* string lights are baked into world/room-frame-* */}

      {drawList.map((entry) => {
        if (entry.kind === "cat") {
          return (
            <RoamingCatBody key="roaming-cat" view={catView} motionRef={catMotionRef} onTap={tapCat} />
          );
        }
        const place = entry.place;
        const item = itemsById.get(place.id);
        if (!item) return null;
        const rect = spriteRect(item, place, shownFloor, itemsById);
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
          style={{ transform: `translate(${glowShift.x}px, ${glowShift.y}px)` }}
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
  onSelect,
  onItemPointerDown,
}: {
  place: WallPlacement;
  item?: RoomItem;
  selected: boolean;
  lifted: boolean;
  shaking: boolean;
  thumbs: string[];
  onSelect: (id: string) => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
}) {
  if (!item) return null;
  const rect = wallSpriteRect(item, place);
  const frames = item.id === "cardframe" || item.id === "squareframe";
  return (
    <button
      type="button"
      className={`lucky-sprite is-wall is-wall-${place.wall} ${selected ? "is-selected" : ""} ${lifted ? "is-lifted" : ""} ${shaking ? "is-shake" : ""}`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        transform: lifted ? "translateY(-12px)" : undefined,
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
