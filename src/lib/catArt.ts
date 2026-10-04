import type { Star } from "../types";

function hash(value: string): number {
  let next = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    next ^= value.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
}

const COATS: Record<string, [string, string]> = {
  calico: ["#F6C37A", "#E29A45"],
  ragdoll: ["#F7F1E8", "#D9D0C4"],
  persian: ["#C4B0D6", "#8E74B0"],
  siamese: ["#D8C4A2", "#8B6A4A"],
  russian_blue: ["#7EA4C8", "#4E789C"],
  maine_coon: ["#8B6A4A", "#5C4330"],
  scottish_fold: ["#C9B8A6", "#9C8A78"],
  shorthair: ["#F0D27A", "#D4A017"],
  tuxedo: ["#2F2F32", "#111114"],
  mackerel: ["#A8B8C4", "#6A7A88"],
};

export function catImageUrl(id: string, speciesId: string, star: Star): string {
  const n = hash(id);
  const [light, dark] = COATS[speciesId] ?? COATS.shorthair;
  const eye = star >= 4 ? "#F4D35E" : "#191F28";
  const earTilt = (n % 11) - 5;
  const sparkles =
    star >= 4
      ? `<circle cx="320" cy="56" r="10" fill="rgba(255,255,255,0.7)"/>
         <circle cx="58" cy="86" r="7" fill="rgba(255,255,255,0.45)"/>
         <circle cx="340" cy="120" r="5" fill="rgba(255,232,140,0.9)"/>`
      : star >= 2
        ? `<circle cx="320" cy="56" r="8" fill="rgba(255,255,255,0.55)"/>`
        : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${light}"/>
        <stop offset="1" stop-color="${dark}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" rx="28" fill="url(#bg)"/>
    <g fill="${n % 2 === 0 ? "#fff6ea" : "#1b1511"}">
      <polygon points="86,168 132,52 176,168" transform="rotate(${earTilt} 132 110)"/>
      <polygon points="224,168 268,52 314,168" transform="rotate(${-earTilt} 268 110)"/>
      <ellipse cx="200" cy="230" rx="118" ry="108"/>
    </g>
    <ellipse cx="158" cy="214" rx="16" ry="22" fill="${eye}"/>
    <ellipse cx="242" cy="214" rx="16" ry="22" fill="${eye}"/>
    <ellipse cx="200" cy="248" rx="14" ry="9" fill="#E8A070"/>
    <path d="M186 268 Q200 286 214 268" fill="none" stroke="#E8A070" stroke-width="8" stroke-linecap="round"/>
    ${sparkles}
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
