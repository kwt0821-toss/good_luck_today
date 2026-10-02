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
  ["#5C4330", "#3A2A22", "#fff6ea"],
  ["#A8D8C8", "#6DB8A4", "#1b1511"],
  ["#7EA4C8", "#4E789C", "#fff6ea"],
  ["#2F2F32", "#111114", "#fff6ea"],
];

export function isoCatSprite(id: string): string {
  const n = hash(id);
  const [light, dark, inner] = COATS[n % COATS.length];
  const map = new Pixmap(32, 36);
  map.fillDiamond(16, 26, 20, "#e4d2b0");
  map.fillRect(11, 22, 11, 7, dark);
  map.fillRect(12, 21, 9, 2, light);
  map.fillRect(21, 24, 6, 3, dark);
  map.fillRect(22, 23, 5, 2, light);
  map.fillRect(10, 12, 13, 11, light);
  map.fillRect(11, 11, 11, 2, light);
  map.fillRect(9, 7, 5, 7, light);
  map.fillRect(18, 7, 5, 7, light);
  map.fillRect(10, 8, 3, 4, inner);
  map.fillRect(19, 8, 3, 4, inner);
  map.fillRect(13, 16, 2, 2, "#191F28");
  map.fillRect(18, 16, 2, 2, "#191F28");
  map.fillRect(15, 18, 3, 2, "#E8A070");
  map.fillRect(14, 21, 5, 1, "#E8A070");
  map.fillRect(8, 24, 3, 2, dark);
  return map.toSvg();
}
