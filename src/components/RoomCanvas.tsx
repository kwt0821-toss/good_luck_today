import { useId, useMemo, useRef, useState } from "react";

import {
  CAT_TILE,
  ISO_ORIGIN_X,
  ISO_ORIGIN_Y,
  ISO_VIEW_H,
  ISO_VIEW_W,
  ROOM_SIZE,
  TILE_H,
  TILE_W,
  WALL_H,
  canOccupy,
  floorBackCorner,
  floorFrontCorner,
  floorLeftCorner,
  floorRightCorner,
  floorTheme,
  footprintAnchor,
  footprintCells,
  isoUnproject,
  itemDisplayWidth,
  sortDrawOrder,
  tileDiamond,
  wallTheme,
} from "../lib/iso";
import { getItemById } from "../lib/items";
import { customArtUrlById, floorArtBox, hasCustomSurfaceArt, wallArtBox } from "../lib/roomArt";
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

function pointerTile(element: HTMLElement, clientX: number, clientY: number) {
  const world = element.querySelector(".iso-world") ?? element;
  const box = world.getBoundingClientRect();
  const scaleX = ISO_VIEW_W / box.width;
  const scaleY = ISO_VIEW_H / box.height;
  const x = (clientX - box.left) * scaleX - ISO_ORIGIN_X;
  const y = (clientY - box.top) * scaleY - ISO_ORIGIN_Y;
  return isoUnproject(x, y);
}

function poly(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
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
  const clipId = useId().replace(/:/g, "");
  const walls = wallTheme(room.wallpaperId);
  const floors = floorTheme(room.floorId);
  const wallArt = hasCustomSurfaceArt(room.wallpaperId, "wallpaper")
    ? customArtUrlById(room.wallpaperId, "wallpaper")
    : null;
  const floorArt = hasCustomSurfaceArt(room.floorId, "floor")
    ? customArtUrlById(room.floorId, "floor")
    : null;
  const placing = placingItemId ? getItemById(placingItemId) : undefined;
  const ghostValid =
    hover && placing
      ? canOccupy(
          room.placements,
          placing,
          hover.col,
          hover.row,
          dragRef.current?.instanceId ?? null,
        )
      : false;
  const ghostCells =
    hover && placing ? footprintCells(placing, hover.col, hover.row) : [];

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
  const front = floorFrontCorner();
  const patternId = `wall-pattern-${room.wallpaperId}`;
  const wallClipId = `iso-wall-clip-${clipId}`;
  const floorClipId = `iso-floor-clip-${clipId}`;
  const leftWall = [
    { x: back.x, y: back.y - WALL_H },
    { x: leftFront.x, y: leftFront.y - WALL_H },
    { x: leftFront.x, y: leftFront.y },
    { x: back.x, y: back.y },
  ];
  const rightWall = [
    { x: back.x, y: back.y - WALL_H },
    { x: rightFront.x, y: rightFront.y - WALL_H },
    { x: rightFront.x, y: rightFront.y },
    { x: back.x, y: back.y },
  ];
  const floorSlab = [
    back,
    rightFront,
    { x: rightFront.x, y: rightFront.y + TILE_H },
    { x: front.x, y: front.y + TILE_H },
    { x: leftFront.x, y: leftFront.y + TILE_H },
    leftFront,
  ];
  const floorBox = floorArt ? floorArtBox(room.floorId, TILE_W, TILE_H, ROOM_SIZE) : null;
  const wallBox = wallArt ? wallArtBox(room.wallpaperId, TILE_W, TILE_H, WALL_H, ROOM_SIZE) : null;

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
            <linearGradient id="iso-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#cfeee6" />
              <stop offset="1" stopColor="#f7fcfb" />
            </linearGradient>
            <pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse">
              <rect width="28" height="28" fill={walls.light} />
              <circle cx="8" cy="9" r="2.4" fill={walls.mid} />
              <circle cx="21" cy="20" r="1.8" fill="#ffffff" opacity="0.72" />
            </pattern>
          </defs>
          <rect width={ISO_VIEW_W} height={ISO_VIEW_H} fill="url(#iso-sky)" />
          <g transform={`translate(${ISO_ORIGIN_X} ${ISO_ORIGIN_Y})`}>
            <defs>
              <clipPath id={wallClipId}>
                <polygon points={poly(leftWall)} />
                <polygon points={poly(rightWall)} />
              </clipPath>
              <clipPath id={floorClipId}>
                <polygon points={poly(floorSlab)} />
              </clipPath>
            </defs>
            <polygon
              points={poly(leftWall)}
              fill={`url(#${patternId})`}
              stroke={walls.line}
              strokeWidth="1.5"
            />
            <polygon
              points={poly(rightWall)}
              fill={walls.dark}
              stroke={walls.line}
              strokeWidth="1.5"
            />
            <polygon
              points={poly(rightWall)}
              fill={`url(#${patternId})`}
              opacity="0.55"
            />
            {wallArt && wallBox ? (
              <g clipPath={`url(#${wallClipId})`}>
                <image
                  href={wallArt}
                  x={wallBox.x}
                  y={wallBox.y}
                  width={wallBox.width}
                  height={wallBox.height}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                />
              </g>
            ) : null}
            <ellipse
              cx={-70}
              cy={-50}
              rx="11"
              ry="15"
              fill={walls.window}
              stroke={walls.line}
              strokeWidth="3"
              opacity={wallArt ? 0 : 1}
            />
            <ellipse cx={-70} cy={-66} rx="7.5" ry="7.5" fill={walls.window} stroke={walls.line} strokeWidth="3" opacity={wallArt ? 0 : 1} />
            <ellipse cx={-55} cy={-66} rx="7.5" ry="7.5" fill={walls.window} stroke={walls.line} strokeWidth="3" opacity={wallArt ? 0 : 1} />
            <rect
              x="46"
              y={-88}
              width="38"
              height="36"
              rx="8"
              fill={walls.window}
              stroke={walls.line}
              strokeWidth="3"
              transform="skewY(26) translate(8 8)"
              opacity={wallArt ? 0 : 1}
            />
            {Array.from({ length: ROOM_SIZE }).flatMap((_, col) =>
              Array.from({ length: ROOM_SIZE }).map((__, row) => (
                <polygon
                  key={`${col}-${row}`}
                  points={tileDiamond(col, row)}
                  fill={(col + row) % 2 === 0 ? floors.a : floors.b}
                  stroke={floors.line}
                  strokeWidth="1"
                />
              )),
            )}
            {floorArt && floorBox ? (
              <g clipPath={`url(#${floorClipId})`}>
                <image
                  href={floorArt}
                  x={floorBox.x}
                  y={floorBox.y}
                  width={floorBox.width}
                  height={floorBox.height}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                />
              </g>
            ) : null}
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
                width: itemDisplayWidth(entry.item),
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
