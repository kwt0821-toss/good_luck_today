import { captureRoomIsland } from "../roomPhoto";
import { cappedBitmapSize } from "./bitmapSize";
import { composeRoom } from "./composeRoom";

const PINCH_PIXELS = 1_500_000;

/** One picture of the center room. A stale call leaves the previous picture. */
export async function paintPinchFreeze(
  island: HTMLElement,
  canvas: HTMLCanvasElement,
  stale?: () => boolean,
  options?: { compose?: boolean },
): Promise<void> {
  if (stale?.()) return;
  const rect = island.getBoundingClientRect();
  const shot = options?.compose
    ? await composeRoom(island, { maxScale: 1 })
    : await captureRoomIsland(island);
  if (stale?.()) {
    shot.width = 0;
    shot.height = 0;
    return;
  }
  const cap = cappedBitmapSize(Math.max(1, rect.width), Math.max(1, rect.height), PINCH_PIXELS);
  const size = cappedBitmapSize(Math.min(shot.width, cap.width), Math.min(shot.height, cap.height), PINCH_PIXELS);
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

export function scheduleIdle(run: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, timeout);
  return () => window.clearTimeout(id);
}
