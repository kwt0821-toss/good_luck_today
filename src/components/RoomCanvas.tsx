import { useEffect, useMemo, useRef, useState } from "react";

import {
  CAT_TILE,
  ISO_ORIGIN_X,
  ISO_ORIGIN_Y,
  ISO_VIEW_H,
  ISO_VIEW_W,
  TILE_W,
  canOccupy,
  footprintAnchor,
  footprintCells,
  isoUnproject,
  sortDrawOrder,
} from "../lib/iso";
import { isoCatSprite } from "../lib/isoCat";
import { getItemById } from "../lib/items";
import { paintPixelRoom } from "../lib/paintPixelRoom";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ instanceId: string } | null>(null);
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);
  const placing = placingItemId ? getItemById(placingItemId) : undefined;
  const ghostCells = useMemo(() => {
    if (!hover || !placing) return [];
    return footprintCells(placing, hover.col, hover.row);
  }, [hover, placing]);
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
  const catSprite = useMemo(() => (cat ? isoCatSprite(cat.id) : null), [cat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    paintPixelRoom(ctx, room.wallpaperId, room.floorId, ghostCells, ghostValid);
  }, [room.wallpaperId, room.floorId, ghostCells, ghostValid]);

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
        <canvas
          ref={canvasRef}
          className="iso-shell"
          width={ISO_VIEW_W}
          height={ISO_VIEW_H}
          aria-hidden="true"
        />

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
                width: entry.item.tilesW * TILE_W,
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
          {catSprite ? <img src={catSprite} alt="" /> : <span>🐱</span>}
        </div>
      </div>
    </div>
  );
}
