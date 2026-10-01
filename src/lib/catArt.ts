import type { Grade } from "../types";

function hash(value: string): number {
  let next = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    next ^= value.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
}

const COATS = [
  ["#F6C37A", "#E29A45"],
  ["#F7F1E8", "#D9D0C4"],
  ["#3A2A22", "#1D1410"],
  ["#8B6A4A", "#5C4330"],
  ["#C9B8A6", "#9C8A78"],
  ["#2F2F32", "#111114"],
  ["#E7A1B0", "#D4788C"],
  ["#7EA4C8", "#4E789C"],
  ["#B7D3A8", "#7FA36C"],
  ["#D8C4A2", "#B08962"],
  ["#F0D27A", "#D4A017"],
  ["#C4B0D6", "#8E74B0"],
];

export function catImageUrl(id: string, grade: Grade): string {
  const n = hash(id);
  const [light, dark] = COATS[n % COATS.length];
  const eye = grade === "SSS" || grade === "S" ? "#F4D35E" : "#191F28";
  const earTilt = (n % 11) - 5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${light}"/>
        <stop offset="1" stop-color="${dark}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" rx="72" fill="url(#bg)"/>
    <g fill="${n % 2 === 0 ? "#fff6ea" : "#1b1511"}">
      <polygon points="86,168 132,52 176,168" transform="rotate(${earTilt} 132 110)"/>
      <polygon points="224,168 268,52 314,168" transform="rotate(${-earTilt} 268 110)"/>
      <ellipse cx="200" cy="230" rx="118" ry="108"/>
    </g>
    <ellipse cx="158" cy="214" rx="16" ry="22" fill="${eye}"/>
    <ellipse cx="242" cy="214" rx="16" ry="22" fill="${eye}"/>
    <ellipse cx="200" cy="248" rx="14" ry="9" fill="#FF7A9A"/>
    <path d="M186 268 Q200 286 214 268" fill="none" stroke="#FF7A9A" stroke-width="8" stroke-linecap="round"/>
    <circle cx="320" cy="56" r="10" fill="rgba(255,255,255,0.7)"/>
    <circle cx="58" cy="86" r="7" fill="rgba(255,255,255,0.45)"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
