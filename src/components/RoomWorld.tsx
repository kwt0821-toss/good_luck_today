import type { PointerEvent } from "react";

import { roomAsset } from "../lib/roomCatalog";
import {
  WORLD_H,
  WORLD_W,
  contactShadow,
  diamondPoints,
  isDecal,
  itemSize,
  occupancy,
  previewTiles,
  sortFloor,
  spriteWorldPos,
  wallSpritePos,
} from "../lib/roomLayout";
import type { FloorPlacement, RoomItem, RoomLayoutState, RoomMode, WallPlacement } from "../lib/roomTypes";

type RoomWorldProps = {
  mode: RoomMode;
  itemsById: Map<string, RoomItem>;
  layout: RoomLayoutState;
  selectedId: string | null;
  dragging: { instanceId: string; col: number; row: number } | null;
  hints: { col: number; row: number }[] | null;
  frameThumbs: string[];
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

function FloorSprite({
  place,
  item,
  selected,
  lifted,
  thumbs,
  onSelect,
  onItemPointerDown,
}: {
  place: FloorPlacement;
  item: RoomItem;
  selected: boolean;
  lifted: boolean;
  thumbs: string[];
  onSelect: (id: string) => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
}) {
  const pos = spriteWorldPos(item, place.col, place.row, place.rot);
  const size = item.spriteWorldPx ?? [156, 156];
  const src = item.image ? roomAsset(item.image) : item.tileImage ? roomAsset(item.tileImage) : "";
  const flip = place.flip || place.rot === 1;
  return (
    <button
      type="button"
      className={`lucky-sprite ${selected ? "is-selected" : ""} ${lifted ? "is-lifted" : ""} ${item.id === "catbed" ? "is-catbed" : ""}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size[0],
        height: size[1],
        transform: `${flip ? "scaleX(-1) " : ""}${lifted ? "translateY(-12px)" : ""}`,
      }}
      aria-label={item.nameKo}
      onPointerDown={(event) => onItemPointerDown(event, place.instanceId)}
      onClick={() => onSelect(place.instanceId)}
    >
      {src ? <img src={src} alt="" draggable={false} /> : <span className="lucky-sprite-fallback">{item.nameKo}</span>}
      {item.id === "frames" ? (
        <span className="lucky-frame-arts" aria-hidden="true">
          {thumbs.slice(0, 3).map((thumb) => (
            <img key={thumb} src={thumb} alt="" />
          ))}
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
  onSelect,
  onItemPointerDown,
  onFloorPointerDown,
}: RoomWorldProps) {
  const selected = [...layout.floor, ...layout.walls].find((item) => item.instanceId === selectedId);
  const selectedItem = selected ? itemsById.get(selected.id) : undefined;
  const used = occupancy(layout.floor, itemsById, dragging?.instanceId ?? selectedId ?? undefined);
  const dragItem = dragging ? itemsById.get(layout.floor.find((p) => p.instanceId === dragging.instanceId)?.id ?? "") : undefined;
  const dragTiles =
    dragging && dragItem
      ? previewTiles(dragItem, dragging.col, dragging.row, layout.floor.find((p) => p.instanceId === dragging.instanceId)?.rot ?? 0, used)
      : [];
  const selectedFloor = selected && "col" in selected ? (selected as FloorPlacement) : null;
  const selectedTiles =
    mode === "edit" && selectedFloor && selectedItem && selectedItem.placement === "floor" && !dragging
      ? footprintTilesSafe(selectedFloor, selectedItem)
      : [];
  const floorSorted = sortFloor(layout.floor, itemsById);
  const decals = floorSorted.filter((place) => isDecal(itemsById.get(place.id)));
  const furniture = floorSorted.filter((place) => !isDecal(itemsById.get(place.id)));
  const lamp = layout.floor.find((place) => place.id === "floorlamp");
  const lampItem = itemsById.get("floorlamp");
  const lampPos = lamp && lampItem ? spriteWorldPos(lampItem, lamp.col, lamp.row, lamp.rot) : null;
  const defaultLamp = spriteWorldPos(lampItem ?? ({ id: "floorlamp", footprint: [1, 1], placement: "floor" } as RoomItem), 6, 0, 0);
  const glowShift = lampPos ? { x: lampPos.x - defaultLamp.x, y: lampPos.y - defaultLamp.y } : { x: 0, y: 0 };

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

      {decals.map((place) => {
        const item = itemsById.get(place.id);
        if (!item) return null;
        return (
          <FloorSprite
            key={place.instanceId}
            place={dragging?.instanceId === place.instanceId ? { ...place, col: dragging.col, row: dragging.row } : place}
            item={item}
            selected={place.instanceId === selectedId}
            lifted={place.instanceId === selectedId && mode === "edit"}
            thumbs={frameThumbs}
            onSelect={(id) => onSelect(id, "floor")}
            onItemPointerDown={onItemPointerDown}
          />
        );
      })}

      <svg className="lucky-world-layer lucky-shadow-layer" viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}>
        {furniture.map((place) => {
          const item = itemsById.get(place.id);
          if (!item) return null;
          const shown = dragging?.instanceId === place.instanceId ? { ...place, col: dragging.col, row: dragging.row } : place;
          const shadow = contactShadow(item, shown.col, shown.row, shown.rot);
          return (
            <ellipse
              key={place.instanceId}
              cx={shadow.cx}
              cy={shadow.cy}
              rx={shadow.rx}
              ry={shadow.ry}
              fill="#2A1530"
              fillOpacity="0.32"
              style={{ filter: "blur(9px)" }}
            />
          );
        })}
      </svg>

      {layout.walls.map((place) => (
        <WallSprite
          key={place.instanceId}
          place={place}
          item={itemsById.get(place.id)}
          selected={place.instanceId === selectedId}
          thumbs={frameThumbs}
          onSelect={(id) => onSelect(id, "wall")}
          onItemPointerDown={onItemPointerDown}
        />
      ))}

      <Layer src="world/string-lights.svg" className="is-lights" />

      {furniture.map((place) => {
        const item = itemsById.get(place.id);
        if (!item) return null;
        return (
          <FloorSprite
            key={place.instanceId}
            place={dragging?.instanceId === place.instanceId ? { ...place, col: dragging.col, row: dragging.row } : place}
            item={item}
            selected={place.instanceId === selectedId}
            lifted={place.instanceId === selectedId && mode === "edit"}
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
  const [w, d] = itemSize(item, place.rot);
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
  thumbs,
  onSelect,
  onItemPointerDown,
}: {
  place: WallPlacement;
  item?: RoomItem;
  selected: boolean;
  thumbs: string[];
  onSelect: (id: string) => void;
  onItemPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string) => void;
}) {
  if (!item) return null;
  const pos = wallSpritePos(item, place);
  const size = item.spriteWorldPx ?? [230, 341];
  const src = item.image ? roomAsset(item.image) : "";
  return (
    <button
      type="button"
      className={`lucky-sprite is-wall ${selected ? "is-selected" : ""}`}
      style={{ left: pos.x, top: pos.y, width: size[0], height: size[1] }}
      aria-label={item.nameKo}
      onPointerDown={(event) => onItemPointerDown(event, place.instanceId)}
      onClick={() => onSelect(place.instanceId)}
    >
      {src ? <img src={src} alt="" draggable={false} /> : null}
      {item.id === "frames" ? (
        <span className="lucky-frame-arts" aria-hidden="true">
          {thumbs.slice(0, 3).map((thumb) => (
            <img key={thumb} src={thumb} alt="" />
          ))}
        </span>
      ) : null}
    </button>
  );
}
