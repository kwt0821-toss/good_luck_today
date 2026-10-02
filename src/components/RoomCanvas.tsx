import { useRef } from "react";

import { getItemById } from "../lib/items";
import type { Cat, RoomState } from "../types";

type RoomCanvasProps = {
  room: RoomState;
  cat: Cat | null;
  editable?: boolean;
  selectedInstanceId?: string | null;
  placingItemId?: string | null;
  onPlace?: (x: number, y: number) => void;
  onMove?: (instanceId: string, x: number, y: number) => void;
  onSelect?: (instanceId: string | null) => void;
};

function percentPoint(element: HTMLElement, clientX: number, clientY: number) {
  const box = element.getBoundingClientRect();
  return {
    x: ((clientX - box.left) / box.width) * 100,
    y: ((clientY - box.top) / box.height) * 100,
  };
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
  const wallpaper = getItemById(room.wallpaperId);
  const floor = getItemById(room.floorId);
  const sorted = [...room.placements].sort((a, b) => a.y - b.y);

  return (
    <div
      ref={roomRef}
      className={`cat-room ${editable ? "is-editable" : ""} ${placingItemId ? "is-placing" : ""}`}
      onPointerDown={(event) => {
        if (!editable || !roomRef.current) return;
        if ((event.target as HTMLElement).closest(".room-item")) return;
        const point = percentPoint(roomRef.current, event.clientX, event.clientY);
        if (placingItemId) onPlace?.(point.x, point.y);
        else onSelect?.(null);
      }}
      onPointerMove={(event) => {
        if (!editable || !dragRef.current || !roomRef.current) return;
        const point = percentPoint(roomRef.current, event.clientX, event.clientY);
        onMove?.(dragRef.current.instanceId, point.x, point.y);
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => {
        dragRef.current = null;
      }}
    >
      <div
        className="room-wall"
        style={{ backgroundImage: wallpaper ? `url("${wallpaper.imageUrl}")` : undefined }}
      />
      <div
        className="room-floor"
        style={{ backgroundImage: floor ? `url("${floor.imageUrl}")` : undefined }}
      />
      <div className="room-baseboard" />

      {sorted.map((placement) => {
        const item = getItemById(placement.itemId);
        if (!item) return null;
        const selected = selectedInstanceId === placement.instanceId;
        return (
          <button
            key={placement.instanceId}
            type="button"
            className={`room-item ${selected ? "is-selected" : ""}`}
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              width: `${item.width}%`,
              zIndex: Math.round(placement.y),
            }}
            aria-label={item.name}
            onPointerDown={(event) => {
              if (!editable) return;
              event.stopPropagation();
              dragRef.current = { instanceId: placement.instanceId };
              onSelect?.(placement.instanceId);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!editable || !dragRef.current || !roomRef.current) return;
              if (dragRef.current.instanceId !== placement.instanceId) return;
              const point = percentPoint(roomRef.current, event.clientX, event.clientY);
              onMove?.(placement.instanceId, point.x, point.y);
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          >
            <img src={item.imageUrl} alt="" draggable={false} />
          </button>
        );
      })}

      <div className="room-cat" aria-hidden="true">
        {cat ? <img src={cat.imageUrl} alt="" /> : <span>🐱</span>}
      </div>
    </div>
  );
}
