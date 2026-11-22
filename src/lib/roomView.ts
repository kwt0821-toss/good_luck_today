import { screenOf, WORLD_H, WORLD_W } from "./roomLayout";
import type { RoomMode } from "./roomTypes";

/** Floor diamond width in world pixels (8 tiles × 156). */
export const ROOM_FLOOR_WORLD = 1248;
/** Top of the wall faces and the front tip of the floor, in world pixels. */
export const ROOM_CONTENT_TOP = 420;
export const ROOM_CONTENT_BOTTOM = 1524;
/** View-mode enlargement cap. 360px phones land just under this. */
export const ROOM_VIEW_FIT_MAX = 1.1;
export const ROOM_ZOOM_MIN = 1;
export const ROOM_ZOOM_MAX = 2;
/** iPhone DPR 3 dies on huge layers. One constant so the cap can drop. */
export const ROOM_ZOOM_MAX_IOS = 1.6;
export const ROOM_ZOOM_STEP = 0.25;
/** Above this, one-finger pan replaces room swipes. */
export const ROOM_PAN_ZOOM = 1.05;
export const ROOM_ZOOM_HINT_KEY = "lucky-cat.room-zoom-hint.v1";

export type RoomPose = { zoom: number; panX: number; panY: number };
export type RoomFrame = {
  mode: RoomMode;
  viewW: number;
  viewH: number;
  bandTop: number;
  bandBottom: number;
  fit: number;
};
export type ViewXf = { tx: number; ty: number; s: number };

export function roomZoomMax(ios: boolean, dpr: number) {
  return ios && dpr >= 3 ? ROOM_ZOOM_MAX_IOS : ROOM_ZOOM_MAX;
}

export function clampZoom(zoom: number, max = ROOM_ZOOM_MAX) {
  return Math.max(ROOM_ZOOM_MIN, Math.min(max, zoom));
}

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

/** Fit + zoom + pan, clamped so the room keeps covering the band while zoomed. */
export function layoutPose(frame: RoomFrame, pose: RoomPose, maxZoom = ROOM_ZOOM_MAX): { pose: RoomPose; xf: ViewXf } {
  const zoom = clampZoom(pose.zoom, maxZoom);
  const s = frame.fit * zoom;
  const box = contentBox(frame.mode);
  const targetX = frame.viewW / 2;
  const targetY = (frame.bandTop + frame.bandBottom) / 2;
  let panX = zoom <= ROOM_PAN_ZOOM ? 0 : pose.panX;
  let panY = zoom <= ROOM_PAN_ZOOM ? 0 : pose.panY;
  let tx = targetX - box.cx * s + panX;
  let ty = targetY - box.cy * s + panY;
  if (zoom > ROOM_PAN_ZOOM) {
    const viewL = 0;
    const viewR = frame.viewW;
    const viewT = frame.bandTop;
    const viewB = Math.max(frame.bandTop + 8, frame.bandBottom);
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    if (width * s <= viewR - viewL) {
      tx = targetX - box.cx * s;
    } else {
      if (tx + box.left * s > viewL) tx -= tx + box.left * s - viewL;
      if (tx + box.right * s < viewR) tx += viewR - (tx + box.right * s);
    }
    if (height * s <= viewB - viewT) {
      ty = targetY - box.cy * s;
    } else {
      if (ty + box.top * s > viewT) ty -= ty + box.top * s - viewT;
      if (ty + box.bottom * s < viewB) ty += viewB - (ty + box.bottom * s);
    }
    panX = tx - (targetX - box.cx * s);
    panY = ty - (targetY - box.cy * s);
  }
  return { pose: { zoom, panX, panY }, xf: { tx, ty, s } };
}

/** Keep the stage point under (focalX, focalY) fixed while the zoom changes. */
export function zoomAround(
  frame: RoomFrame,
  pose: RoomPose,
  nextZoom: number,
  focalX: number,
  focalY: number,
  maxZoom = ROOM_ZOOM_MAX,
): RoomPose {
  const cur = layoutPose(frame, pose, maxZoom);
  const zoom = clampZoom(nextZoom, maxZoom);
  const s1 = frame.fit * zoom;
  const pX = (focalX - cur.xf.tx) / cur.xf.s;
  const pY = (focalY - cur.xf.ty) / cur.xf.s;
  const tx = focalX - pX * s1;
  const ty = focalY - pY * s1;
  const box = contentBox(frame.mode);
  const targetX = frame.viewW / 2;
  const targetY = (frame.bandTop + frame.bandBottom) / 2;
  return layoutPose(
    frame,
    {
      zoom,
      panX: tx - (targetX - box.cx * s1),
      panY: ty - (targetY - box.cy * s1),
    },
    maxZoom,
  ).pose;
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

export function focusContent(
  frame: RoomFrame,
  pose: RoomPose,
  nx: number,
  ny: number,
  maxZoom = ROOM_ZOOM_MAX,
): RoomPose {
  const zoom = clampZoom(pose.zoom, maxZoom);
  const s = frame.fit * zoom;
  const box = contentBox(frame.mode);
  const sx = box.left + nx * (box.right - box.left);
  const sy = box.top + ny * (box.bottom - box.top);
  const targetX = frame.viewW / 2;
  const targetY = (frame.bandTop + frame.bandBottom) / 2;
  const tx = targetX - sx * s;
  const ty = targetY - sy * s;
  return layoutPose(
    frame,
    {
      zoom,
      panX: tx - (targetX - box.cx * s),
      panY: ty - (targetY - box.cy * s),
    },
    maxZoom,
  ).pose;
}

export function zoomHintSeen() {
  try {
    return localStorage.getItem(ROOM_ZOOM_HINT_KEY) === "1";
  } catch {
    return true;
  }
}

export function markZoomHintSeen() {
  try {
    localStorage.setItem(ROOM_ZOOM_HINT_KEY, "1");
  } catch {
    // private mode
  }
}
