import { Pixmap } from "./pixelMap";

function hash(value: string): number {
  let next = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    next ^= value.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
}

const COATS: Array<[string, string, string]> = [
  ["#F6C37A", "#E29A45", "#fff6ea"],
  ["#F7F1E8", "#D9D0C4", "#fff6ea"],
  ["#3A2A22", "#1D1410", "#fff6ea"],
  ["#8B6A4A", "#5C4330", "#fff6ea"],
  ["#2F2F32", "#111114", "#fff6ea"],
  ["#A8D8C8", "#6DB8A4", "#1b1511"],
  ["#7EA4C8", "#4E789C", "#fff6ea"],
];

export function isoCatSprite(id: string): string {
  const n = hash(id);
  const [light, dark, inner] = COATS[n % COATS.length];
  const map = new Pixmap(32, 32);
  map.fillDiamond(16, 24, 18, "#eadcc0");
  map.fillRect(10, 18, 12, 8, dark);
  map.fillRect(11, 17, 10, 2, light);
  map.fillRect(8, 20, 4, 4, dark);
  map.fillRect(20, 20, 6, 3, dark);
  map.fillRect(11, 8, 11, 10, light);
  map.fillRect(12, 7, 9, 2, light);
  map.fillRect(10, 4, 4, 5, light);
  map.fillRect(18, 4, 4, 5, light);
  map.fillRect(11, 5, 2, 3, inner);
  map.fillRect(19, 5, 2, 3, inner);
  map.fillRect(13, 11, 2, 2, "#191F28");
  map.fillRect(18, 11, 2, 2, "#191F28");
  map.fillRect(15, 13, 2, 2, "#E8A070");
  map.fillRect(14, 16, 4, 1, "#E8A070");
  return map.toSvg();
}
