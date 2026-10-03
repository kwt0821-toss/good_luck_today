function toDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function wrap(body: string, viewBox = "0 0 160 160"): string {
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="240" height="240">${body}</svg>`,
  );
}

function diamond(x: number, y: number, w: number, h: number, fill: string): string {
  return `<polygon points="${x},${y} ${x + w / 2},${y + h / 2} ${x},${y + h} ${x - w / 2},${y + h / 2}" fill="${fill}"/>`;
}

function box(x: number, y: number, w: number, d: number, h: number, top: string, left: string, right: string): string {
  const hw = w / 2;
  const hd = d / 2;
  const topY = y - h;
  return `
    <polygon points="${x},${topY} ${x + hw},${topY + hd} ${x + hw - hw},${topY + hd + hd} ${x - hw},${topY + hd}" fill="${top}"/>
    <polygon points="${x - hw},${topY + hd} ${x},${topY + hd + hd} ${x},${y + hd} ${x - hw},${y}" fill="${left}"/>
    <polygon points="${x},${topY + hd + hd} ${x + hw},${topY + hd} ${x + hw},${y} ${x},${y + hd}" fill="${right}"/>
  `;
}

export function wallpaperArt(kind: "mint" | "sky" | "lemon"): string {
  const fill = kind === "sky" ? "#c9ebf6" : kind === "lemon" ? "#fff4c8" : "#d8f3ee";
  const deep = kind === "sky" ? "#b0ddee" : kind === "lemon" ? "#ffe59a" : "#b4dfd5";
  return wrap(`
    <rect width="160" height="160" fill="${fill}"/>
    <polygon points="80,18 150,52 80,86 10,52" fill="${deep}"/>
    <polygon points="10,52 80,86 80,150 10,116" fill="${fill}"/>
    <polygon points="80,86 150,52 150,116 80,150" fill="${deep}"/>
    <circle cx="118" cy="58" r="14" fill="#fff6c2"/>
  `);
}

export function floorArt(kind: "wood" | "tile" | "cloud"): string {
  const a = kind === "tile" ? "#d8f3ee" : kind === "cloud" ? "#eef9fd" : "#f6e6c8";
  const b = kind === "tile" ? "#c3e8dc" : kind === "cloud" ? "#dceff8" : "#edd7b0";
  return wrap(`
    <rect width="160" height="160" fill="${a}"/>
    ${diamond(80, 20, 120, 60, b)}
    ${diamond(80, 55, 120, 60, a)}
    ${diamond(80, 90, 120, 60, b)}
  `);
}

export function furnitureArt(kind: "tower" | "bed" | "bowl" | "shelf"): string {
  if (kind === "bed") {
    return wrap(`
      ${diamond(80, 92, 120, 52, "#d9ece4")}
      ${box(80, 108, 108, 48, 22, "#eaf8fd", "#b7d8e8", "#c9ebf6")}
      ${box(52, 96, 28, 24, 14, "#fff4c8", "#e8c86a", "#ffe08a")}
      ${box(108, 96, 28, 24, 14, "#fff4c8", "#e8c86a", "#ffe08a")}
    `);
  }
  if (kind === "bowl") {
    return wrap(`
      ${diamond(80, 96, 70, 32, "#eadcc0")}
      <ellipse cx="80" cy="108" rx="34" ry="12" fill="#f7d56a"/>
      <ellipse cx="80" cy="102" rx="30" ry="10" fill="#fff4c8"/>
      <path d="M64 98c10-14 24-6 28 6" fill="none" stroke="#6ec8d4" stroke-width="5" stroke-linecap="round"/>
    `);
  }
  if (kind === "shelf") {
    return wrap(`
      ${diamond(80, 108, 110, 40, "#eadcc0")}
      ${box(80, 118, 96, 28, 10, "#f3e2c4", "#d8b77e", "#e4cc9f")}
      ${box(80, 96, 88, 24, 8, "#fff4c8", "#d8b77e", "#e4cc9f")}
      ${box(58, 88, 22, 16, 16, "#c9ebf6", "#8ec9dc", "#b0ddee")}
      ${box(98, 88, 22, 16, 14, "#d8f3ee", "#7fc9bc", "#b4dfd5")}
    `);
  }
  return wrap(`
    ${diamond(80, 108, 64, 28, "#d9ece4")}
    ${box(68, 118, 18, 18, 70, "#fff4c8", "#d4c07a", "#e8d48a")}
    ${box(92, 118, 18, 18, 54, "#fff4c8", "#d4c07a", "#e8d48a")}
    ${box(80, 78, 56, 26, 8, "#c9ebf6", "#8ec9dc", "#b0ddee")}
    ${box(80, 100, 48, 22, 8, "#d8f3ee", "#7fc9bc", "#b4dfd5")}
    ${box(80, 118, 40, 18, 8, "#fff8d6", "#e8c86a", "#ffe08a")}
  `);
}

export function decorArt(kind: "plant" | "yarn" | "lamp" | "toy" | "clock"): string {
  if (kind === "yarn") {
    return wrap(`
      ${diamond(80, 108, 56, 24, "#eadcc0")}
      <circle cx="80" cy="96" r="28" fill="#f4b4c4"/>
      <path d="M62 88c12 4 24-4 34 6M60 100c16-8 30 2 40-4" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      <path d="M102 80c10-12 18-8 22-4" fill="none" stroke="#f4b4c4" stroke-width="5" stroke-linecap="round"/>
    `);
  }
  if (kind === "lamp") {
    return wrap(`
      ${diamond(80, 116, 50, 22, "#eadcc0")}
      ${box(80, 122, 14, 14, 36, "#e4cc9f", "#c9a36a", "#d8b77e")}
      <path d="M52 86 L80 54 L108 86 Z" fill="#fff4c8"/>
      <polygon points="52,86 80,96 108,86 80,76" fill="#ffe08a"/>
    `);
  }
  if (kind === "toy") {
    return wrap(`
      ${diamond(80, 114, 60, 24, "#eadcc0")}
      <path d="M52 48c16 14 34 48 38 70" fill="none" stroke="#d8b77e" stroke-width="6" stroke-linecap="round"/>
      <circle cx="50" cy="46" r="7" fill="#6ec8d4"/>
      <ellipse cx="96" cy="118" rx="16" ry="10" fill="#c9ebf6"/>
      <ellipse cx="108" cy="112" rx="12" ry="8" fill="#fff4c8"/>
    `);
  }
  if (kind === "clock") {
    return wrap(`
      ${diamond(80, 118, 54, 22, "#eadcc0")}
      <circle cx="80" cy="78" r="32" fill="#e7f6fc" stroke="#8ec9dc" stroke-width="6"/>
      <circle cx="80" cy="78" r="4" fill="#5aabb8"/>
      <path d="M80 78v-16M80 78h12" stroke="#2f6580" stroke-width="4" stroke-linecap="round"/>
    `);
  }
  return wrap(`
    ${diamond(80, 118, 52, 22, "#eadcc0")}
    ${box(80, 124, 32, 22, 18, "#e8a070", "#c98458", "#d48958")}
    <ellipse cx="80" cy="78" rx="18" ry="26" fill="#7fc9bc"/>
    <ellipse cx="96" cy="86" rx="12" ry="20" fill="#9edcc8"/>
  `);
}
