import { screenOf, WORLD_H, WORLD_W } from "./roomLayout";
import type { RoomMode } from "./roomTypes";

/** Floor diamond width in world pixels (8 tiles × 156). */
export const ROOM_FLOOR_WORLD = 1248;
/** Top of the wall faces and the front tip of the floor, in world pixels. */
export const ROOM_CONTENT_TOP = 420;
export const ROOM_CONTENT_BOTTOM = 1524;
/** View-mode enlargement cap. 360px phones land just under this. */
export const ROOM_VIEW_FIT_MAX = 1.1;

export type RoomFrame = {
  mode: RoomMode;
  viewW: number;
  viewH: number;
  bandTop: number;
  bandBottom: number;
  fit: number;
};
export type ViewXf = { tx: number; ty: number; s: number };

export function computeFit(mode: RoomMode, viewW: number, bandHeight: number) {
  const scr = screenOf(mode);
  const floor = ROOM_FLOOR_WORLD * (scr.width / WORLD_W);
  const contentH = (ROOM_CONTENT_BOTTOM - ROOM_CONTENT_TOP) * (scr.height / WORLD_H);
  if (mode === "view") return Math.min(ROOM_VIEW_FIT_MAX, (viewW * 0.94) / Math.max(1, floor));
  const byW = (viewW * 0.96) / Math.max(1, floor);
  const byH = bandHeight > 8 ? bandHeight / Math.max(1, contentH) : byW;
  return Math.max(0.2, Math.min(byW, byH));
}

export function contentBox(mode: RoomMode) {
  const scr = screenOf(mode);
  const x = (worldX: number) => scr.left + (worldX / WORLD_W) * scr.width;
  const y = (worldY: number) => scr.top + (worldY / WORLD_H) * scr.height;
  return {
    left: x(1920 - ROOM_FLOOR_WORLD / 2),
    right: x(1920 + ROOM_FLOOR_WORLD / 2),
    top: y(ROOM_CONTENT_TOP),
    bottom: y(ROOM_CONTENT_BOTTOM),
    cx: x(1920),
    cy: y((ROOM_CONTENT_TOP + ROOM_CONTENT_BOTTOM) / 2),
  };
}

/** Place the room at its fitted size, centered in the band. */
export function layoutPose(frame: RoomFrame): ViewXf {
  const s = frame.fit;
  const box = contentBox(frame.mode);
  const targetX = frame.viewW / 2;
  const targetY = (frame.bandTop + frame.bandBottom) / 2;
  return { tx: targetX - box.cx * s, ty: targetY - box.cy * s, s };
}

export function clientToStage(clientX: number, clientY: number, stage: DOMRect, xf: ViewXf) {
  const x = clientX - stage.left;
  const y = clientY - stage.top;
  const s = xf.s || 1;
  return { x: (x - xf.tx) / s, y: (y - xf.ty) / s };
}

export function stageToClient(localX: number, localY: number, stage: DOMRect, xf: ViewXf) {
  return {
    x: stage.left + xf.tx + localX * xf.s,
    y: stage.top + xf.ty + localY * xf.s,
  };
}
