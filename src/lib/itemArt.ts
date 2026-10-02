import { Pixmap } from "./pixelMap";

function wrap(map: Pixmap): string {
  return map.toSvg();
}

function shadow(map: Pixmap, cx: number, y: number, width: number) {
  map.fillDiamond(cx, y, width, "#eadcc0");
}

export function wallpaperArt(kind: "mint" | "sky" | "lemon"): string {
  const map = new Pixmap(48, 48);
  const wall = kind === "sky" ? "#c9ebf6" : kind === "lemon" ? "#fff4c8" : "#d8f3ee";
  const wallDeep = kind === "sky" ? "#b0ddee" : kind === "lemon" ? "#ffe59a" : "#b4dfd5";
  const floor = kind === "sky" ? "#eef9fd" : kind === "lemon" ? "#fff0b8" : "#edd7b0";
  map.fillRect(0, 0, 48, 48, "#e7f6fc");
  map.fillPoly(
    [
      { x: 24, y: 4 },
      { x: 6, y: 14 },
      { x: 6, y: 30 },
      { x: 24, y: 20 },
    ],
    wall,
  );
  map.fillPoly(
    [
      { x: 24, y: 4 },
      { x: 42, y: 14 },
      { x: 42, y: 30 },
      { x: 24, y: 20 },
    ],
    wallDeep,
  );
  map.fillDiamond(24, 20, 36, floor);
  return wrap(map);
}

export function floorArt(kind: "wood" | "tile" | "cloud"): string {
  const map = new Pixmap(48, 32);
  const a = kind === "tile" ? "#d8f3ee" : kind === "cloud" ? "#eef9fd" : "#f3e2c4";
  const b = kind === "tile" ? "#b4dfd5" : kind === "cloud" ? "#dceff8" : "#edd7b0";
  map.fillRect(0, 0, 48, 32, "#e7f6fc");
  map.fillDiamond(24, 2, 44, a);
  map.fillDiamond(24, 10, 28, b);
  map.outlineDiamond(24, 2, 44, "#c9a36a");
  return wrap(map);
}

export function furnitureArt(kind: "tower" | "bed" | "bowl" | "shelf"): string {
  if (kind === "bed") {
    const map = new Pixmap(80, 48);
    shadow(map, 40, 30, 56);
    map.isoBox(40, 44, 52, 10, "#eaf8fd", "#8ec9dc", "#c9ebf6", "#5aabb8");
    map.isoBox(24, 34, 16, 6, "#fff4c8", "#e8c86a", "#ffe08a", "#d4c07a");
    map.isoBox(54, 34, 16, 6, "#fff4c8", "#e8c86a", "#ffe08a", "#d4c07a");
    return wrap(map);
  }
  if (kind === "bowl") {
    const map = new Pixmap(48, 40);
    shadow(map, 24, 24, 24);
    map.circle(24, 26, 10, "#f7d56a");
    map.circle(24, 24, 8, "#fff4c8");
    map.fillRect(16, 20, 3, 8, "#6ec8d4");
    map.fillRect(17, 16, 3, 5, "#6ec8d4");
    return wrap(map);
  }
  if (kind === "shelf") {
    const map = new Pixmap(80, 48);
    shadow(map, 40, 32, 52);
    map.isoBox(40, 44, 48, 6, "#f3e2c4", "#d8b77e", "#e4cc9f", "#c9a36a");
    map.isoBox(40, 34, 40, 5, "#fff4c8", "#d8b77e", "#e4cc9f", "#c9a36a");
    map.isoBox(28, 28, 12, 10, "#c9ebf6", "#8ec9dc", "#b0ddee", "#5aabb8");
    map.isoBox(50, 28, 12, 8, "#d8f3ee", "#7fc9bc", "#b4dfd5", "#5aabb8");
    return wrap(map);
  }
  const map = new Pixmap(48, 56);
  shadow(map, 24, 42, 22);
  map.isoBox(18, 52, 10, 28, "#fff4c8", "#d4c07a", "#e8d48a", "#c9a36a");
  map.isoBox(30, 52, 10, 20, "#fff4c8", "#d4c07a", "#e8d48a", "#c9a36a");
  map.isoBox(24, 30, 24, 6, "#c9ebf6", "#8ec9dc", "#b0ddee", "#5aabb8");
  map.isoBox(24, 40, 20, 5, "#d8f3ee", "#7fc9bc", "#b4dfd5", "#5aabb8");
  return wrap(map);
}

export function decorArt(kind: "plant" | "yarn" | "lamp" | "toy" | "clock"): string {
  if (kind === "yarn") {
    const map = new Pixmap(40, 40);
    shadow(map, 20, 26, 18);
    map.circle(20, 20, 10, "#f4b4c4");
    map.fillRect(14, 16, 12, 2, "#ffffff");
    map.fillRect(13, 21, 12, 2, "#ffffff");
    map.fillRect(28, 12, 4, 2, "#f4b4c4");
    return wrap(map);
  }
  if (kind === "lamp") {
    const map = new Pixmap(40, 48);
    shadow(map, 20, 34, 16);
    map.isoBox(20, 44, 8, 16, "#e4cc9f", "#c9a36a", "#d8b77e", "#a9844a");
    map.fillPoly(
      [
        { x: 8, y: 20 },
        { x: 20, y: 8 },
        { x: 32, y: 20 },
        { x: 20, y: 24 },
      ],
      "#fff4c8",
    );
    return wrap(map);
  }
  if (kind === "toy") {
    const map = new Pixmap(40, 48);
    shadow(map, 22, 36, 18);
    for (let i = 0; i < 18; i += 1) map.set(12 + Math.floor(i / 3), 10 + i, "#d8b77e");
    map.circle(12, 10, 3, "#6ec8d4");
    map.circle(26, 36, 5, "#c9ebf6");
    map.circle(30, 32, 4, "#fff4c8");
    return wrap(map);
  }
  if (kind === "clock") {
    const map = new Pixmap(40, 48);
    shadow(map, 20, 34, 16);
    map.circle(20, 20, 12, "#e7f6fc");
    map.circle(20, 20, 10, "#c9ebf6");
    map.fillRect(19, 12, 2, 8, "#2f6580");
    map.fillRect(20, 19, 7, 2, "#2f6580");
    map.circle(20, 20, 2, "#5aabb8");
    return wrap(map);
  }
  const map = new Pixmap(40, 48);
  shadow(map, 20, 36, 16);
  map.isoBox(20, 44, 14, 8, "#e8a070", "#c98458", "#d48958", "#a96a40");
  map.circle(20, 22, 8, "#7fc9bc");
  map.circle(26, 24, 5, "#9edcc8");
  return wrap(map);
}
