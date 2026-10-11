import type { PointerEvent } from "react";

import { roomAsset } from "../lib/roomCatalog";
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
import type { FloorPlacement, RoomDrag, RoomItem, RoomLayoutState, RoomMode, SpriteRect, WallPlacement } from "../lib/roomTypes";

type RoomWorldProps = {
  mode: RoomMode;
  itemsById: Map<string, RoomItem>;
  layout: RoomLayoutState;
  selectedId: string | null;
  dragging: RoomDrag | null;
  hints: { col: number; row: number }[] | null;
  frameThumbs: string[];
  shakeId: string | null;
  shadowsEnabled: boolean;
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
  tone: "selected" | "valid" | "invalid" | "hint";
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

export function RoomWorld({
  mode,
  itemsById,
  layout,
  selectedId,
  dragging,
  hints,
  frameThumbs,
  shakeId,
  shadowsEnabled,
  onSelect,
  onItemPointerDown,
  onFloorPointerDown,
}: RoomWorldProps) {
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

  return (
    <div className="lucky-world" onPointerDown={onFloorPointerDown}>
      <Layer src="world/base-bg.webp" />
      <Layer src="world/room-walls.svg" />
      <Layer src={mode === "edit" ? "world/room-floor-edit-grid.svg" : "world/room-floor.svg"} />

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

      <Layer src="world/string-lights.svg" className="is-lights" />

      {furnitureDrawn.map((place) => {
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
