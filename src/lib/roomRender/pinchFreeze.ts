import { captureRoomIsland } from "../roomPhoto";
import { cappedBitmapSize } from "./bitmapSize";

/** One picture of the center room, at most 4 million pixels. A stale call leaves the previous picture. */
export async function paintPinchFreeze(
  island: HTMLElement,
  canvas: HTMLCanvasElement,
  stale?: () => boolean,
): Promise<void> {
  if (stale?.()) return;
  const shot = await captureRoomIsland(island);
  if (stale?.()) {
    shot.width = 0;
    shot.height = 0;
    return;
  }
  const size = cappedBitmapSize(shot.width, shot.height);
  if (size.width < 1 || size.height < 1) {
    shot.width = 0;
    shot.height = 0;
    return;
  }
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    shot.width = 0;
    shot.height = 0;
    return;
  }
  ctx.drawImage(shot, 0, 0, size.width, size.height);
  shot.width = 0;
  shot.height = 0;
}
