import { roomAsset } from "../roomCatalog";
import { DEFAULT_CAT_BREED_ID } from "../roomCat";
import { normalizeRoomCatIds } from "../roomStore";
import { floorTileSrc, wallStripSrc } from "../roomTiles";
import type { RoomItem, RoomOrientation } from "../roomTypes";
import { catSheetFile } from "./warmList";

export type RoomImageSource = {
  floorTiles: readonly (readonly string[])[];
  wallTiles: { L: readonly string[]; R: readonly string[] };
  floor: readonly { id: string; orientation: RoomOrientation }[];
  walls: readonly { id: string; wall: "L" | "R" }[];
  roamingCatIds?: unknown;
};

function pushRoomAsset(urls: Set<string>, relative: string | null | undefined) {
  const url = roomAsset(relative);
  if (url) urls.add(url);
}

/** Absolute urls for one room's floor, walls, furniture, and cat sheets. */
export function roomImageUrls(room: RoomImageSource, itemsById: Map<string, RoomItem>): string[] {
  const urls = new Set<string>();
  room.floorTiles.forEach((row, rowIndex) => {
    row.forEach((tile, col) => pushRoomAsset(urls, floorTileSrc(tile, col, rowIndex)));
  });
  room.wallTiles.L.forEach((tile, index) => pushRoomAsset(urls, wallStripSrc(tile, "L", index)));
  room.wallTiles.R.forEach((tile, index) => pushRoomAsset(urls, wallStripSrc(tile, "R", index)));
  for (const place of room.floor) {
    const item = itemsById.get(place.id);
    if (!item) continue;
    pushRoomAsset(urls, item.furniture?.[place.orientation]?.image ?? item.image);
    pushRoomAsset(urls, item.tileImage);
  }
  for (const place of room.walls) {
    const item = itemsById.get(place.id);
    if (!item) continue;
    const side = place.wall === "L" ? item.wallImages?.left : item.wallImages?.right;
    pushRoomAsset(urls, side || item.image);
  }
  const cats = normalizeRoomCatIds(room.roamingCatIds);
  const breeds = cats.length > 0 ? cats : [DEFAULT_CAT_BREED_ID];
  for (const catId of breeds) pushRoomAsset(urls, catSheetFile(catId));
  return [...urls];
}
