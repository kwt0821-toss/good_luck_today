import { useEffect, useMemo, useRef, useState } from "react";

import {
  CAT_TILE,
  FLOOR_PATTERN_TRANSFORM,
  ISO_ORIGIN_X,
  ISO_ORIGIN_Y,
  ISO_VIEW_H,
  ISO_VIEW_W,
  LEFT_WALL_PATTERN_TRANSFORM,
  RIGHT_WALL_PATTERN_TRANSFORM,
  ROOM_SIZE,
  SURFACE_PATTERN_SIZE,
  TILE_W,
  WALL_H,
  canOccupy,
  floorBackCorner,
  floorLeftCorner,
  floorRightCorner,
  floorTheme,
  footprintAnchor,
  footprintCells,
  isoUnproject,
  sortDrawOrder,
  tileDiamond,
  wallTheme,
} from "../lib/iso";
import { getItemById } from "../lib/items";
import { customArtUrlById } from "../lib/roomArt";
import type { Cat, RoomState } from "../types";
import { RoomArtImage } from "./RoomArtImage";

type RoomCanvasProps = {
  room: RoomState;
  cat: Cat | null;
  editable?: boolean;
  selectedInstanceId?: string | null;
  placingItemId?: string | null;
  onPlace?: (col: number, row: number) => void;
  onMove?: (instanceId: string, col: number, row: number) => void;
  onSelect?: (instanceId: string | null) => void;
};

function useRoomTexture(url: string): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setOk(true);
    };
    image.onerror = () => {
      if (!cancelled) setOk(false);
    };
    image.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return ok;
}

function pointerTile(element: HTMLElement, clientX: number, clientY: number) {
  const world = element.querySelector(".iso-world") ?? element;
  const box = world.getBoundingClientRect();
  const scaleX = ISO_VIEW_W / box.width;
  const scaleY = ISO_VIEW_H / box.height;
  const x = (clientX - box.left) * scaleX - ISO_ORIGIN_X;
  const y = (clientY - box.top) * scaleY - ISO_ORIGIN_Y;
  return isoUnproject(x, y);
}

export function RoomCanvas({
  room,
  cat,
  editable = false,
  selectedInstanceId = null,
  placingItemId = null,
  onPlace,
  onMove,
  onSelect,
}: RoomCanvasProps) {
  const roomRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ instanceId: string } | null>(null);
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);
  const walls = wallTheme(room.wallpaperId);
  const floors = floorTheme(room.floorId);
  const wallTexture = customArtUrlById(room.wallpaperId, "wallpaper");
  const floorTexture = customArtUrlById(room.floorId, "floor");
  const hasWallTexture = useRoomTexture(wallTexture);
  const hasFloorTexture = useRoomTexture(floorTexture);
  const placing = placingItemId ? getItemById(placingItemId) : undefined;
  const ghostItem = placing;
  const ghostValid =
    hover && ghostItem
      ? canOccupy(
          room.placements,
          ghostItem,
          hover.col,
          hover.row,
          dragRef.current?.instanceId ?? null,
        )
      : false;
  const ghostCells =
    hover && ghostItem ? footprintCells(ghostItem, hover.col, hover.row) : [];

  const objects = useMemo(() => {
    const list = room.placements
      .map((placement) => {
        const item = getItemById(placement.itemId);
        if (!item) return null;
        const anchor = footprintAnchor(item, placement.col, placement.row);
        return {
          key: placement.instanceId,
          placement,
          item,
          anchor,
          order: sortDrawOrder(placement.col, placement.row),
        };
      })
      .filter((entry) => entry !== null);
    return list.sort((a, b) => a.order - b.order);
  }, [room.placements]);

  const catAnchor = footprintAnchor({ tilesW: 1, tilesH: 1 }, CAT_TILE.col, CAT_TILE.row);

  const back = floorBackCorner();
  const leftFront = floorLeftCorner();
  const rightFront = floorRightCorner();

  return (
    <div
      ref={roomRef}
      className={`iso-stage ${editable ? "is-editable" : ""} ${placingItemId ? "is-placing" : ""}`}
      onPointerDown={(event) => {
        if (!editable || !roomRef.current) return;
        if ((event.target as HTMLElement).closest(".iso-item")) return;
        const tile = pointerTile(roomRef.current, event.clientX, event.clientY);
        if (placingItemId) onPlace?.(tile.col, tile.row);
        else onSelect?.(null);
      }}
      onPointerMove={(event) => {
        if (!editable || !roomRef.current) return;
        const tile = pointerTile(roomRef.current, event.clientX, event.clientY);
        setHover(tile);
        if (dragRef.current) onMove?.(dragRef.current.instanceId, tile.col, tile.row);
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => {
        dragRef.current = null;
        setHover(null);
      }}
    >
      <div className="iso-world" style={{ width: ISO_VIEW_W, height: ISO_VIEW_H }}>
        <svg
          className="iso-shell"
          viewBox={`0 0 ${ISO_VIEW_W} ${ISO_VIEW_H}`}
          aria-hidden="true"
        >
          <defs>
            {hasWallTexture ? (
              <>
                <pattern
                  id="room-wall-left-tex"
                  width={SURFACE_PATTERN_SIZE}
                  height={SURFACE_PATTERN_SIZE}
                  patternUnits="userSpaceOnUse"
                  patternTransform={LEFT_WALL_PATTERN_TRANSFORM}
                >
                  <image
                    href={wallTexture}
                    width={SURFACE_PATTERN_SIZE}
                    height={SURFACE_PATTERN_SIZE}
                    preserveAspectRatio="none"
                  />
                </pattern>
                <pattern
                  id="room-wall-right-tex"
                  width={SURFACE_PATTERN_SIZE}
                  height={SURFACE_PATTERN_SIZE}
                  patternUnits="userSpaceOnUse"
                  patternTransform={RIGHT_WALL_PATTERN_TRANSFORM}
                >
                  <image
                    href={wallTexture}
                    width={SURFACE_PATTERN_SIZE}
                    height={SURFACE_PATTERN_SIZE}
                    preserveAspectRatio="none"
                  />
                </pattern>
              </>
            ) : null}
            {hasFloorTexture ? (
              <pattern
                id="room-floor-tex"
                width={SURFACE_PATTERN_SIZE}
                height={SURFACE_PATTERN_SIZE}
                patternUnits="userSpaceOnUse"
                patternTransform={FLOOR_PATTERN_TRANSFORM}
              >
                <image
                  href={floorTexture}
                  width={SURFACE_PATTERN_SIZE}
                  height={SURFACE_PATTERN_SIZE}
                  preserveAspectRatio="none"
                />
              </pattern>
            ) : null}
          </defs>
          <g transform={`translate(${ISO_ORIGIN_X} ${ISO_ORIGIN_Y})`}>
            <polygon
              points={`${back.x},${back.y - WALL_H} ${leftFront.x},${leftFront.y - WALL_H} ${leftFront.x},${leftFront.y} ${back.x},${back.y}`}
              fill={hasWallTexture ? "url(#room-wall-left-tex)" : walls.light}
              stroke={walls.line}
              strokeWidth="1.5"
            />
            <polygon
              points={`${back.x},${back.y - WALL_H} ${rightFront.x},${rightFront.y - WALL_H} ${rightFront.x},${rightFront.y} ${back.x},${back.y}`}
              fill={hasWallTexture ? "url(#room-wall-right-tex)" : walls.dark}
              stroke={walls.line}
              strokeWidth="1.5"
            />
            {hasWallTexture ? (
              <polygon
                points={`${back.x},${back.y - WALL_H} ${rightFront.x},${rightFront.y - WALL_H} ${rightFront.x},${rightFront.y} ${back.x},${back.y}`}
                fill="rgba(47, 101, 104, 0.12)"
              />
            ) : null}
            <ellipse cx={-72} cy={-48} rx="10" ry="14" fill={walls.window} stroke={walls.line} strokeWidth="3" />
            <ellipse cx={-72} cy={-62} rx="7" ry="7" fill={walls.window} stroke={walls.line} strokeWidth="3" />
            <ellipse cx={-58} cy={-62} rx="7" ry="7" fill={walls.window} stroke={walls.line} strokeWidth="3" />
            <rect
              x="48"
              y={-86}
              width="36"
              height="34"
              rx="6"
              fill={walls.window}
              stroke={walls.line}
              strokeWidth="3"
              transform="skewY(26) translate(8 8)"
            />
            {Array.from({ length: ROOM_SIZE }).flatMap((_, col) =>
              Array.from({ length: ROOM_SIZE }).map((__, row) => (
                <polygon
                  key={`${col}-${row}`}
                  points={tileDiamond(col, row)}
                  fill={
                    hasFloorTexture
                      ? "url(#room-floor-tex)"
                      : (col + row) % 2 === 0
                        ? floors.a
                        : floors.b
                  }
                  stroke={floors.line}
                  strokeWidth="1"
                />
              )),
            )}
            {ghostCells.map((cell) => (
              <polygon
                key={`ghost-${cell.col}-${cell.row}`}
                points={tileDiamond(cell.col, cell.row)}
                className={ghostValid ? "iso-ghost is-valid" : "iso-ghost is-invalid"}
              />
            ))}
          </g>
        </svg>

        {objects.map((entry) => {
          const selected = selectedInstanceId === entry.placement.instanceId;
          return (
            <button
              key={entry.key}
              type="button"
              className={`iso-item ${selected ? "is-selected" : ""}`}
              style={{
                left: ISO_ORIGIN_X + entry.anchor.x,
                top: ISO_ORIGIN_Y + entry.anchor.y,
                width: entry.item.tilesW * TILE_W * 0.92,
                zIndex: 10 + entry.order,
              }}
              aria-label={entry.item.name}
              onPointerDown={(event) => {
                if (!editable) return;
                event.stopPropagation();
                dragRef.current = { instanceId: entry.placement.instanceId };
                onSelect?.(entry.placement.instanceId);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
            >
              <RoomArtImage item={entry.item} />
            </button>
          );
        })}

        <div
          className="iso-cat"
          style={{
            left: ISO_ORIGIN_X + catAnchor.x,
            top: ISO_ORIGIN_Y + catAnchor.y,
            zIndex: 10 + sortDrawOrder(CAT_TILE.col, CAT_TILE.row),
          }}
          aria-hidden="true"
        >
          {cat ? <img src={cat.imageUrl} alt="" /> : <span>🐱</span>}
        </div>
      </div>
    </div>
  );
}
