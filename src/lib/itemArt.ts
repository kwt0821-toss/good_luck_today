function toDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function wrap(body: string, viewBox = "0 0 240 240"): string {
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="240" height="240">${body}</svg>`,
  );
}

export function wallpaperArt(kind: "mint" | "sky" | "lemon"): string {
  if (kind === "sky") {
    return wrap(`
      <rect width="240" height="240" fill="#c9ebf6"/>
      <rect y="150" width="240" height="90" fill="#b7e2f0"/>
      <circle cx="48" cy="44" r="22" fill="#fff6c2"/>
      <rect x="132" y="38" width="78" height="70" rx="10" fill="#eef9fd" stroke="#8ec9dc" stroke-width="6"/>
      <rect x="144" y="50" width="24" height="46" fill="#d8f3ee"/>
      <rect x="174" y="50" width="24" height="46" fill="#fff4c8"/>
    `);
  }
  if (kind === "lemon") {
    return wrap(`
      <rect width="240" height="240" fill="#fff4c8"/>
      <rect y="150" width="240" height="90" fill="#ffe59a"/>
      <circle cx="200" cy="36" r="26" fill="#ffe08a"/>
      <rect x="28" y="42" width="86" height="64" rx="10" fill="#fffdf3" stroke="#e8c86a" stroke-width="6"/>
      <path d="M28 74h86" stroke="#e8c86a" stroke-width="6"/>
      <path d="M71 42v64" stroke="#e8c86a" stroke-width="6"/>
    `);
  }
  return wrap(`
    <rect width="240" height="240" fill="#d8f3ee"/>
    <rect y="150" width="240" height="90" fill="#c5eae3"/>
    <circle cx="42" cy="40" r="18" fill="#fff6c2"/>
    <rect x="128" y="36" width="82" height="72" rx="12" fill="#eefaf8" stroke="#7fc9bc" stroke-width="6"/>
    <rect x="140" y="50" width="26" height="44" fill="#c9ebf6"/>
    <rect x="172" y="50" width="26" height="44" fill="#fff4c8"/>
  `);
}

export function floorArt(kind: "wood" | "tile" | "cloud"): string {
  if (kind === "tile") {
    return wrap(`
      <rect width="240" height="240" fill="#cdeed8"/>
      <path d="M0 80h240M0 160h240M80 0v240M160 0v240" stroke="#b4e0c8" stroke-width="8"/>
    `);
  }
  if (kind === "cloud") {
    return wrap(`
      <rect width="240" height="240" fill="#e7f6fc"/>
      <ellipse cx="70" cy="90" rx="48" ry="22" fill="#ffffff"/>
      <ellipse cx="108" cy="90" rx="32" ry="18" fill="#ffffff"/>
      <ellipse cx="168" cy="160" rx="54" ry="24" fill="#ffffff"/>
    `);
  }
  return wrap(`
    <rect width="240" height="240" fill="#f3e2c4"/>
    <path d="M0 48h240M0 96h240M0 144h240M0 192h240" stroke="#e4cc9f" stroke-width="10"/>
  `);
}

export function furnitureArt(kind: "tower" | "bed" | "bowl" | "shelf"): string {
  if (kind === "bed") {
    return wrap(`
      <ellipse cx="120" cy="176" rx="92" ry="22" fill="#d8ebe4"/>
      <ellipse cx="120" cy="150" rx="96" ry="46" fill="#c9ebf6"/>
      <ellipse cx="120" cy="138" rx="78" ry="32" fill="#eaf8fd"/>
      <circle cx="58" cy="128" r="18" fill="#fff4c8"/>
      <circle cx="182" cy="128" r="18" fill="#fff4c8"/>
    `);
  }
  if (kind === "bowl") {
    return wrap(`
      <ellipse cx="120" cy="96" rx="54" ry="18" fill="#fff4c8"/>
      <path d="M66 96c6 46 102 46 108 0" fill="#f7d56a"/>
      <ellipse cx="120" cy="96" rx="54" ry="14" fill="#ffe9a0"/>
      <path d="M92 84c18-22 44-8 50 8" fill="none" stroke="#6ec8d4" stroke-width="8" stroke-linecap="round"/>
      <circle cx="148" cy="78" r="6" fill="#6ec8d4"/>
    `);
  }
  if (kind === "shelf") {
    return wrap(`
      <rect x="28" y="48" width="184" height="18" rx="9" fill="#e4cc9f"/>
      <rect x="40" y="66" width="12" height="110" rx="6" fill="#d8b77e"/>
      <rect x="188" y="66" width="12" height="110" rx="6" fill="#d8b77e"/>
      <rect x="52" y="78" width="136" height="14" rx="7" fill="#f3e2c4"/>
      <ellipse cx="92" cy="70" rx="16" ry="10" fill="#c9ebf6"/>
      <ellipse cx="148" cy="70" rx="18" ry="11" fill="#d8f3ee"/>
    `);
  }
  return wrap(`
    <rect x="70" y="36" width="18" height="168" rx="8" fill="#b7dcc8"/>
    <rect x="152" y="70" width="18" height="134" rx="8" fill="#b7dcc8"/>
    <rect x="46" y="70" width="148" height="16" rx="8" fill="#fff4c8"/>
    <rect x="62" y="124" width="116" height="16" rx="8" fill="#c9ebf6"/>
    <rect x="78" y="176" width="92" height="16" rx="8" fill="#d8f3ee"/>
  `);
}

export function decorArt(kind: "plant" | "yarn" | "lamp" | "toy" | "clock"): string {
  if (kind === "yarn") {
    return wrap(`
      <circle cx="120" cy="128" r="58" fill="#f4b4c4"/>
      <path d="M78 108c28 8 56-8 80 10M74 136c36-18 70 4 90-8M92 86c10 40 8 62-4 82" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
      <path d="M168 92c22-28 38-18 44-8" fill="none" stroke="#f4b4c4" stroke-width="8" stroke-linecap="round"/>
    `);
  }
  if (kind === "lamp") {
    return wrap(`
      <rect x="110" y="128" width="20" height="70" rx="8" fill="#d8b77e"/>
      <ellipse cx="120" cy="204" rx="36" ry="10" fill="#e4cc9f"/>
      <path d="M64 128c10-70 102-70 112 0z" fill="#fff4c8"/>
      <ellipse cx="120" cy="128" rx="56" ry="10" fill="#ffe9a0"/>
    `);
  }
  if (kind === "toy") {
    return wrap(`
      <path d="M48 40c40 18 86 86 92 140" fill="none" stroke="#d8b77e" stroke-width="10" stroke-linecap="round"/>
      <circle cx="48" cy="40" r="12" fill="#6ec8d4"/>
      <path d="M140 176c18 8 28 28 10 40" fill="#c9ebf6"/>
      <path d="M156 168c24-4 36 22 16 36" fill="#fff4c8"/>
      <circle cx="148" cy="188" r="10" fill="#f4b4c4"/>
    `);
  }
  if (kind === "clock") {
    return wrap(`
      <circle cx="120" cy="120" r="70" fill="#e7f6fc" stroke="#8ec9dc" stroke-width="10"/>
      <circle cx="120" cy="120" r="8" fill="#5aabb8"/>
      <path d="M120 120v-36" stroke="#2f6580" stroke-width="8" stroke-linecap="round"/>
      <path d="M120 120h28" stroke="#2f6580" stroke-width="8" stroke-linecap="round"/>
      <circle cx="120" cy="58" r="6" fill="#f7d56a"/>
    `);
  }
  return wrap(`
    <rect x="88" y="150" width="64" height="50" rx="10" fill="#e8a070"/>
    <rect x="80" y="142" width="80" height="16" rx="8" fill="#d48958"/>
    <path d="M120 40c-40 44-52 84-20 108 8-28 28-40 40-18 18-36 8-70-20-90z" fill="#7fc9bc"/>
    <path d="M148 86c18 22 8 54-16 70 22-4 40-30 16-70z" fill="#9edcc8"/>
  `);
}
