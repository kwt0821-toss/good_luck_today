import { useEffect, useState } from "react";

import { roomAsset } from "./roomCatalog";

export const HEART_BED_ID = "heart_cushion_bed";

const BAKED: Record<string, { image: string; mirrored: string; thumb: string }> = {
  "": {
    image: "items/furniture/heart_cushion_bed_peach.webp",
    mirrored: "items/furniture/heart_cushion_bed_peach_m.webp",
    thumb: "items/furniture/thumbs/heart_cushion_bed_peach.webp",
  },
  cheese: {
    image: "items/furniture/heart_cushion_bed_cheese.webp",
    mirrored: "items/furniture/heart_cushion_bed_cheese_m.webp",
    thumb: "items/furniture/thumbs/heart_cushion_bed_cheese.webp",
  },
  russian_blue: {
    image: "items/furniture/heart_cushion_bed_blue.webp",
    mirrored: "items/furniture/heart_cushion_bed_blue_m.webp",
    thumb: "items/furniture/thumbs/heart_cushion_bed_blue.webp",
  },
};

type BedView = { image: string; thumb: string };

let view: BedView = {
  image: roomAsset(BAKED[""].image),
  thumb: roomAsset(BAKED[""].thumb),
};
const listeners = new Set<() => void>();
let request = 0;

function emit() {
  for (const listener of listeners) listener();
}

function hsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function hueFor(image: HTMLImageElement): number {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 12;
  ctx.drawImage(image, 0, 0, 24, 24);
  const data = ctx.getImageData(0, 0, 24, 24).data;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.25 || l < 0.25 || l > 0.92) continue;
    void h;
    sr += data[i];
    sg += data[i + 1];
    sb += data[i + 2];
    n += 1;
  }
  if (!n) return 12;
  return hsl(sr / n, sg / n, sb / n)[0];
}

async function loadImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

async function paintBreed(name: string, iconSrc: string): Promise<BedView> {
  const base = await loadImage(roomAsset(BAKED[""].image));
  const icon = await loadImage(iconSrc);
  const hue = hueFor(icon);
  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { image: roomAsset(BAKED[""].image), thumb: roomAsset(BAKED[""].thumb) };
  ctx.drawImage(base, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = frame.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 16) continue;
    const [h, s, l] = hsl(px[i], px[i + 1], px[i + 2]);
    const pink = s > 0.28 && l > 0.45 && l < 0.93 && (h < 20 || h > 330);
    if (!pink) continue;
    const [r, g, b] = fromHsl(hue, Math.min(0.78, Math.max(0.45, s)), Math.min(0.84, l * 0.96));
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(frame, 0, 0);
  const tagX = canvas.width * (226 / 884);
  const tagY = canvas.height * (600 / 764);
  const tagW = canvas.width * (168 / 884);
  const tagH = canvas.height * (36 / 764);
  ctx.fillStyle = "#f3d0a4";
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = "#5c3b22";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = Math.floor(tagH * 0.62);
  const label = name || "최애냥";
  do {
    ctx.font = `700 ${size}px 'Noto Sans KR', sans-serif`;
    if (ctx.measureText(label).width <= tagW * 0.9 || size <= 8) break;
    size -= 1;
  } while (size > 8);
  ctx.fillText(label, tagX + tagW / 2, tagY + tagH / 2);
  const url = canvas.toDataURL("image/png");
  return { image: url, thumb: url };
}

/** Point the placed bed at this favorite. Baked peach, cheese, and blue stay as files. */
export function syncHeartBed(catId: string | null, nameKo: string, iconSrc: string | null) {
  const ticket = ++request;
  const baked = BAKED[catId ?? ""] ?? null;
  if (baked || !catId || !iconSrc) {
    const file = baked ?? BAKED[""];
    view = { image: roomAsset(file.image), thumb: roomAsset(file.thumb) };
    emit();
    return;
  }
  void paintBreed(nameKo, iconSrc).then((next) => {
    if (ticket !== request) return;
    view = next;
    emit();
  });
}

export function useHeartBedSrc(enabled: boolean, kind: "image" | "thumb" = "image"): string {
  const [src, setSrc] = useState(kind === "thumb" ? view.thumb : view.image);
  useEffect(() => {
    if (!enabled) return;
    const sync = () => setSrc(kind === "thumb" ? view.thumb : view.image);
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, [enabled, kind]);
  return enabled ? src : "";
}
