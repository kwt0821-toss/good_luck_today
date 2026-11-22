import { floorCanvasBounds, floorTilePolygon, floorTileRect } from "../roomTiles.ts";
import { peekBakedFloor, storeBakedFloor } from "./floorBake.ts";
import { loadRoomImage } from "./imageCache.ts";

export type FloorCanvasTile = { col: number; row: number; src: string };

const BOUNDS = floorCanvasBounds();

export function floorCanvasBox() {
  return BOUNDS;
}

/** Same key the on-screen floor canvas uses, so a pre-drawn floor is one drawImage. */
export function floorCanvasKey(tiles: FloorCanvasTile[]): string {
  return `${BOUNDS.w}x${BOUNDS.h}|${tiles.map((tile) => `${tile.col},${tile.row},${tile.src}`).join(";")}`;
}

export function paintFloorCells(
  ctx: CanvasRenderingContext2D,
  tiles: FloorCanvasTile[],
  images: Map<string, HTMLImageElement | null>,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, BOUNDS.w, BOUNDS.h);
  for (const tile of tiles) {
    const image = images.get(tile.src);
    if (!image) continue;
    const rect = floorTileRect(tile.col, tile.row);
    const poly = floorTilePolygon(tile.col, tile.row);
    ctx.save();
    ctx.beginPath();
    poly.forEach((point, index) => {
      const x = point.x - BOUNDS.x;
      const y = point.y - BOUNDS.y;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, rect.x - BOUNDS.x, rect.y - BOUNDS.y, rect.w, rect.h);
    ctx.restore();
  }
}

/** Draw the current room's floor into the bake cache. A failure here does not disable the room. */
export async function prebakeFloor(tiles: FloorCanvasTile[]): Promise<void> {
  if (typeof document === "undefined" || tiles.length === 0) return;
  const key = floorCanvasKey(tiles);
  if (peekBakedFloor(key)) return;
  const images = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    [...new Set(tiles.map((tile) => tile.src))].map(async (src) => {
      images.set(src, await loadRoomImage(src));
    }),
  );
  const canvas = document.createElement("canvas");
  canvas.width = BOUNDS.w;
  canvas.height = BOUNDS.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    return;
  }
  try {
    paintFloorCells(ctx, tiles, images);
    storeBakedFloor(key, canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
