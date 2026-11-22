import { toKstDateKey } from "./date";
import { roomAsset } from "./roomCatalog";
import { floorTileClip, wallStripClip } from "./roomTiles";
import { functionEndpoint, readSaveToken, refreshSaveToken } from "./serverSave";
import { resolveWalletMode } from "./serverWallet";
import { isTossApp } from "./tossEnv";
import { ensureGameUserHash } from "./user";

export type PhotoFrame = {
  id: string;
  nameKo: string;
  src: string;
  width: number;
  height: number;
  /** Transparent window inside the frame, in frame pixels. */
  photo: { x: number; y: number; w: number; h: number };
  footerTop: number;
};

type FrameFile = Record<
  string,
  {
    id?: string;
    nameKo?: string;
    image?: string;
    size?: number[];
    photoBox?: number[];
    footerTop?: number;
  }
>;

const CARD_W = 720;
const CARD_H = 1140;

let framesPromise: Promise<PhotoFrame[]> | null = null;

export function loadPhotoFrames(): Promise<PhotoFrame[]> {
  if (!framesPromise) {
    framesPromise = fetch(roomAsset("photo-frames/frames.json"))
      .then((res) => {
        if (!res.ok) throw new Error("frames");
        return res.json() as Promise<FrameFile>;
      })
      .then((file) => {
        const frames = Object.values(file)
          .map(parseFrame)
          .filter((frame): frame is PhotoFrame => frame != null);
        if (!frames.length) throw new Error("frames");
        return frames;
      });
  }
  return framesPromise;
}

function parseFrame(raw: FrameFile[string]): PhotoFrame | null {
  if (!raw?.image || !raw.size || raw.size.length < 2 || !raw.photoBox || raw.photoBox.length < 4) return null;
  const width = raw.size[0];
  const height = raw.size[1];
  const photo = photoRect(raw.photoBox, width, height);
  if (!photo) return null;
  return {
    id: raw.id || raw.image,
    nameKo: raw.nameKo || raw.id || "테두리",
    src: roomAsset(raw.image),
    width,
    height,
    photo,
    footerTop: typeof raw.footerTop === "number" ? raw.footerTop : photo.y + photo.h,
  };
}

/** `[x, y, x2, y2]` when the far edge mirrors the near inset. Otherwise `[x, y, w, h]`. */
function photoRect(
  box: number[],
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } | null {
  const [x, y, c, d] = box;
  if (![x, y, c, d].every((n) => Number.isFinite(n))) return null;
  const asEnd = c > x && d > y && c <= width && d <= height && width - c === x && height - d > 0;
  const w = asEnd ? c - x : c;
  const h = asEnd ? d - y : d;
  if (w < 8 || h < 8) return null;
  return { x, y, w, h };
}

/** `2026.11.18` in Asia/Seoul. */
export function roomPhotoDate(date = new Date()): string {
  return toKstDateKey(date).replace(/-/g, ".");
}

export function roomPhotoFileName(date = new Date()): string {
  return `행운냥-방-${toKstDateKey(date).replace(/-/g, "")}.png`;
}

/** Letterbox color behind the island. Matches the room's time-of-day sky. */
export function roomSkyColor(room: HTMLElement | null): string {
  const names = room?.classList;
  if (names?.contains("is-tod-morning")) return "#f6c3d0";
  if (names?.contains("is-tod-day")) return "#8ecfff";
  if (names?.contains("is-tod-sunset")) return "#e07ab8";
  return "#24182c";
}

export async function captureRoomIsland(root: HTMLElement): Promise<HTMLCanvasElement> {
  const rootRect = root.getBoundingClientRect();
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rootRect.width * scale));
  canvas.height = Math.max(1, Math.round(rootRect.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.scale(scale, scale);
  ctx.filter = root.classList.contains("is-mood-bright")
    ? "brightness(1.1)"
    : root.classList.contains("is-mood-cozy")
      ? "brightness(0.8) saturate(1.05)"
      : "none";

  const nodes = [...root.querySelectorAll("img, canvas, .lucky-roam-frame, .lucky-set-bit")];
  const ranked = nodes.map((node, index) => ({ node, index, z: stackZ(node, root) }));
  ranked.sort((a, b) => a.z - b.z || a.index - b.index);
  const images = new Map<string, CanvasImageSource>();

  for (const { node } of ranked) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.hidden || usedOpacity(node, root) <= 0.01) continue;
    const opacity = usedOpacity(node, root);
    if (node instanceof HTMLImageElement) {
      if (!node.naturalWidth) continue;
      drawElementImage(ctx, node, root, rootRect, opacity);
    } else if (node instanceof HTMLCanvasElement) {
      if (!node.width || !node.height) continue;
      drawBoxImage(ctx, node, node.getBoundingClientRect(), rootRect, opacity, flipped(node, root));
    } else if (node.classList.contains("lucky-roam-frame")) {
      await drawCatFrame(ctx, node, rootRect, opacity, images);
    } else if (node.classList.contains("lucky-set-bit")) {
      drawBit(ctx, node, rootRect, opacity);
    }
  }
  return canvas;
}

export async function composeRoomCard(options: {
  island: HTMLCanvasElement;
  frame: PhotoFrame;
  cozyLevel: number;
  dateLabel: string;
  sky: string;
}): Promise<{ png: string; base64: string; blob: Blob }> {
  await document.fonts?.load?.("700 56px 'Noto Sans KR'");
  const frameImage = await loadImage(options.frame.src);
  const canvas = document.createElement("canvas");
  canvas.width = options.frame.width || CARD_W;
  canvas.height = options.frame.height || CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  const photo = options.frame.photo;
  ctx.fillStyle = options.sky;
  ctx.fillRect(photo.x, photo.y, photo.w, photo.h);
  const source = contentBounds(options.island, options.sky);
  const fitted = contain(photo.w, photo.h, source.w, source.h);
  ctx.drawImage(
    options.island,
    source.x,
    source.y,
    source.w,
    source.h,
    photo.x + (photo.w - fitted.w) / 2,
    photo.y + (photo.h - fitted.h) / 2,
    fitted.w,
    fitted.h,
  );
  ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  drawFooter(ctx, options.frame, options.cozyLevel, options.dateLabel);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("png"))), "image/png");
  });
  const png = canvas.toDataURL("image/png");
  const base64 = png.replace(/^data:image\/png;base64,/, "");
  return { png, base64, blob };
}

function drawFooter(ctx: CanvasRenderingContext2D, frame: PhotoFrame, cozyLevel: number, dateLabel: string) {
  const cx = frame.width / 2;
  const top = frame.footerTop;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#5c3b22";
  ctx.font = "600 28px 'Noto Sans KR', sans-serif";
  ctx.fillText(`아늑함 Lv.${cozyLevel}`, cx, top + 56);
  ctx.font = "700 58px 'Noto Sans KR', sans-serif";
  ctx.fillText("행운냥", cx, top + 124);
  ctx.fillStyle = "#a6793c";
  ctx.font = "600 22px 'Noto Sans KR', sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText("LUCKY CAT.", cx, top + 176);
  ctx.letterSpacing = "0px";
  ctx.font = "500 24px 'Noto Sans KR', sans-serif";
  ctx.fillText(dateLabel, cx, top + 220);
}

function contentBounds(canvas: HTMLCanvasElement, sky: string) {
  const full = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || canvas.width < 2 || canvas.height < 2) return full;
  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return full;
  }
  const target = hexRgb(sky);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  const step = 3;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const i = (y * canvas.width + x) * 4;
      if (pixels[i + 3] < 24) continue;
      if (target && nearColor(pixels[i], pixels[i + 1], pixels[i + 2], target)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) return full;
  const pad = Math.round(12 * (canvas.width / 720));
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return {
    x,
    y,
    w: Math.min(canvas.width - x, maxX - x + pad),
    h: Math.min(canvas.height - y, maxY - y + pad),
  };
}

function hexRgb(hex: string): [number, number, number] | null {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function nearColor(r: number, g: number, b: number, target: [number, number, number]) {
  return Math.abs(r - target[0]) + Math.abs(g - target[1]) + Math.abs(b - target[2]) < 48;
}

function contain(boxW: number, boxH: number, srcW: number, srcH: number) {
  const scale = Math.min(boxW / srcW, boxH / srcH);
  return { w: srcW * scale, h: srcH * scale };
}

function stackZ(node: Element, root: HTMLElement): number {
  let current: Element | null = node;
  while (current && current !== root) {
    const style = getComputedStyle(current);
    if (style.position !== "static" && style.zIndex !== "auto") return Number(style.zIndex) || 0;
    current = current.parentElement;
  }
  return 0;
}

function usedOpacity(node: HTMLElement, root: HTMLElement): number {
  let opacity = 1;
  let current: HTMLElement | null = node;
  while (current && current !== root) {
    if (current.hidden) return 0;
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return 0;
    opacity *= Number(style.opacity || 1);
    current = current.parentElement;
  }
  return opacity;
}

function flipped(node: Element, root: HTMLElement): boolean {
  let current: Element | null = node;
  while (current && current !== root) {
    const transform = getComputedStyle(current).transform;
    if (transform && transform !== "none") {
      const matrix = transform.match(/matrix\(([^)]+)\)/);
      if (matrix) {
        const a = Number(matrix[1].split(",")[0]);
        if (a < 0) return true;
      }
    }
    current = current.parentElement;
  }
  return false;
}

function drawElementImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  root: HTMLElement,
  rootRect: DOMRect,
  opacity: number,
) {
  const box = img.getBoundingClientRect();
  const fitted = contain(box.width, box.height, img.naturalWidth, img.naturalHeight);
  const dx = box.left + (box.width - fitted.w) / 2;
  const dy = box.top + (box.height - fitted.h) / 2;
  ctx.save();
  clipTile(ctx, img, box, rootRect);
  drawBoxImage(ctx, img, new DOMRect(dx, dy, fitted.w, fitted.h), rootRect, opacity, flipped(img, root));
  ctx.restore();
}

function tileClipCss(img: HTMLImageElement): string | null {
  if (img.classList.contains("lucky-wall-tile")) {
    if (img.classList.contains("is-L")) return wallStripClip("L");
    if (img.classList.contains("is-R")) return wallStripClip("R");
    return null;
  }
  if (img.classList.contains("lucky-floor-tile")) return floorTileClip();
  return null;
}

/** Same polygon the screen uses, in canvas pixels of the island. */
function clipTile(ctx: CanvasRenderingContext2D, img: HTMLImageElement, box: DOMRect, rootRect: DOMRect) {
  const clip = tileClipCss(img);
  if (!clip) return;
  const nums = [...clip.matchAll(/(-?\d*\.?\d+)%\s+(-?\d*\.?\d+)%/g)];
  if (nums.length < 3) return;
  ctx.beginPath();
  nums.forEach((match, index) => {
    const x = box.left - rootRect.left + (Number(match[1]) / 100) * box.width;
    const y = box.top - rootRect.top + (Number(match[2]) / 100) * box.height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.clip();
}

function drawBoxImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  box: DOMRect,
  rootRect: DOMRect,
  opacity: number,
  mirror: boolean,
) {
  const x = box.left - rootRect.left;
  const y = box.top - rootRect.top;
  ctx.save();
  ctx.globalAlpha = opacity;
  if (mirror) {
    ctx.translate(x + box.width / 2, y + box.height / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(source, -box.width / 2, -box.height / 2, box.width, box.height);
  } else {
    ctx.drawImage(source, x, y, box.width, box.height);
  }
  ctx.restore();
}

async function drawCatFrame(
  ctx: CanvasRenderingContext2D,
  frame: HTMLElement,
  rootRect: DOMRect,
  opacity: number,
  images: Map<string, CanvasImageSource>,
) {
  const style = getComputedStyle(frame);
  const url = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
  if (!url || url === "none") return;
  const sheet = images.get(url) ?? (await loadImage(url));
  images.set(url, sheet);
  const button = frame.parentElement instanceof HTMLElement ? frame.parentElement : frame;
  const box = button.getBoundingClientRect();
  const size = style.backgroundSize.split(/\s+/);
  const pos = style.backgroundPosition.split(/\s+/);
  const bw = (parseFloat(size[0]) / 100) * box.width;
  const bh = (parseFloat(size[1]) / 100) * box.height;
  const px = (parseFloat(pos[0]) || 0) / 100;
  const py = (parseFloat(pos[1]) || 0) / 100;
  const dx = (box.width - bw) * px;
  const dy = (box.height - bh) * py;
  const origin = style.transformOrigin.split(/\s+/);
  const ox = box.left + parseFloat(origin[0] || "0") - rootRect.left;
  const oy = box.top + parseFloat(origin[1] || "0") - rootRect.top;
  const mirror = flipped(frame, frame.parentElement ?? frame);

  ctx.save();
  ctx.globalAlpha = opacity;
  if (mirror) {
    ctx.translate(ox, oy);
    ctx.scale(-1, 1);
    ctx.translate(-ox, -oy);
  }
  ctx.beginPath();
  ctx.rect(box.left - rootRect.left, box.top - rootRect.top, box.width, box.height);
  ctx.clip();
  ctx.drawImage(sheet, box.left - rootRect.left + dx, box.top - rootRect.top + dy, bw, bh);
  ctx.restore();
}

function drawBit(ctx: CanvasRenderingContext2D, bit: HTMLElement, rootRect: DOMRect, opacity: number) {
  const box = bit.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return;
  const color = bit.classList.contains("is-bean")
    ? "#7a4124"
    : bit.classList.contains("is-snow") || bit.closest(".is-snow")
      ? "#ffffff"
      : bit.closest(".is-petals")
        ? "#ff7aa8"
        : "rgba(255,248,240,0.9)";
  ctx.save();
  ctx.globalAlpha = Math.min(0.95, opacity);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(
    box.left - rootRect.left + box.width / 2,
    box.top - rootRect.top + box.height / 2,
    box.width / 2,
    box.height / 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

/** Small JPEG for the visit list. The data-URL prefix is already removed. */
export function canvasToJpeg(source: HTMLCanvasElement, maxEdge = 720, quality = 0.72): string {
  const longest = Math.max(source.width, source.height, 1);
  const scale = Math.min(1, maxEdge / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", quality);
  const comma = url.indexOf(",");
  return comma >= 0 ? url.slice(comma + 1) : url;
}

function bareBase64(value: string): string {
  const comma = value.indexOf(",");
  if (value.startsWith("data:") && comma >= 0) return value.slice(comma + 1);
  return value.trim();
}

function photoLimited(error: string, status: number): boolean {
  if (status === 429) return true;
  return /limit|quota|too_many|daily|photo_cap/i.test(error);
}

export type RoomPhotoUpload =
  | { ok: true }
  | { ok: false; error: string; limit?: boolean; network?: boolean };

/** room-photo upload. One token refresh, then stop. Does not log the image or the hash. */
export async function uploadRoomPhoto(imageBase64: string): Promise<RoomPhotoUpload> {
  const image = bareBase64(imageBase64);
  if (!image) return { ok: false, error: "empty" };
  if ((await resolveWalletMode()) !== "server") return { ok: false, error: "local" };
  const target = functionEndpoint("room-photo");
  if (!target || !isTossApp()) return { ok: false, error: "local" };
  const identity = await ensureGameUserHash();
  if (!identity.ok || !identity.hash || identity.hash === "local-dev") {
    return { ok: false, error: "local" };
  }
  const send = async (token: string | null): Promise<RoomPhotoUpload> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: target.apikey,
    };
    if (token) headers["x-save-token"] = token;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(target.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "upload",
          hash: identity.hash,
          mime: "image/jpeg",
          imageBase64: image,
        }),
        signal: controller.signal,
      });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }
      const record = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
      if (record && record.ok === true) return { ok: true };
      const error =
        record && typeof record.error === "string" && record.error ? record.error : `http_${response.status}`;
      return {
        ok: false,
        error,
        limit: photoLimited(error, response.status),
        network: response.status === 0,
      };
    } catch {
      return { ok: false, error: "network", network: true };
    } finally {
      window.clearTimeout(timer);
    }
  };
  const first = await send(await readSaveToken());
  if (first.ok || first.error !== "save_token_invalid") return first;
  const next = await refreshSaveToken();
  if (!next) return first;
  return send(next);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}
