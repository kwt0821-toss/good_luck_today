import type { RoomCatalog, RoomItem } from "./roomTypes";

export const ROOM_BASE = "/assets/room";

export function roomAsset(relative: string | null | undefined): string {
  if (!relative) return "";
  return `${ROOM_BASE}/${relative.replace(/^\//, "")}`;
}

let catalogPromise: Promise<RoomCatalog> | null = null;
let gridPromise: Promise<unknown> | null = null;

export function loadRoomCatalog(): Promise<RoomCatalog> {
  if (!catalogPromise) {
    catalogPromise = fetch(roomAsset("items.json"))
      .then((res) => {
        if (!res.ok) throw new Error("room catalog missing");
        return res.json() as Promise<{ items: RoomItem[] }>;
      })
      .then((data) => ({ items: data.items ?? [] }))
      .catch(() => ({ items: [] }));
  }
  return catalogPromise;
}

export function loadRoomGrid(): Promise<unknown> {
  if (!gridPromise) {
    gridPromise = fetch(roomAsset("grid.json"))
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  return gridPromise;
}

export function itemMap(items: RoomItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export const ROOM_TABS: { id: RoomItem["category"]; label: string }[] = [
  { id: "가구", label: "가구" },
  { id: "소품", label: "소품" },
  { id: "벽지", label: "벽지" },
  { id: "바닥", label: "바닥" },
  { id: "카드액자", label: "카드액자" },
];
