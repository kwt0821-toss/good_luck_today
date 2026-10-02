import { makePattern } from "./pixelMap";

export const PATTERN_SIZE = 16;

export const WALL_PATTERNS: Record<string, string[][]> = {
  wall_mint: makePattern(PATTERN_SIZE, (x, y) => {
    if ((x + y * 3) % 7 === 2 && (x % 5 === 1)) return "#9fd4c6";
    if (x % 8 === 3 && y % 8 === 4) return "#ffffff";
    return y % 2 === 0 ? "#d8f3ee" : "#cfeee6";
  }),
  wall_sky: makePattern(PATTERN_SIZE, (x, y) => {
    if ((x + y) % 6 === 0 && y % 3 === 1) return "#ffffff";
    if (x % 8 === 2 && y % 8 === 2) return "#fff6c2";
    return y % 2 === 0 ? "#d7f1fa" : "#c9ebf6";
  }),
  wall_lemon: makePattern(PATTERN_SIZE, (x, y) => {
    if ((x * 3 + y) % 8 === 1) return "#ffe08a";
    if (x % 7 === 4 && y % 7 === 2) return "#ffffff";
    return y % 2 === 0 ? "#fff8d8" : "#fff0b8";
  }),
};

export const FLOOR_PATTERNS: Record<string, string[][]> = {
  floor_wood: makePattern(PATTERN_SIZE, (x, y) => {
    const plank = Math.floor(y / 4);
    const gap = y % 4 === 3;
    if (gap) return "#d8b77e";
    const shift = plank % 2 === 0 ? 0 : 6;
    const knot = (x + shift) % 16 === 5 && y % 4 === 1;
    if (knot) return "#c9a36a";
    return plank % 2 === 0 ? "#f3e2c4" : "#edd7b0";
  }),
  floor_tile: makePattern(PATTERN_SIZE, (x, y) => {
    const gx = Math.floor(x / 4);
    const gy = Math.floor(y / 4);
    if (x % 4 === 3 || y % 4 === 3) return "#9fd4c6";
    return (gx + gy) % 2 === 0 ? "#d8f3ee" : "#b4dfd5";
  }),
  floor_cloud: makePattern(PATTERN_SIZE, (x, y) => {
    if ((x + y * 2) % 5 === 0) return "#ffffff";
    return (x + y) % 2 === 0 ? "#eef9fd" : "#dceff8";
  }),
};

export const WALL_LINE: Record<string, string> = {
  wall_mint: "#7fc9bc",
  wall_sky: "#8ec9dc",
  wall_lemon: "#e8c86a",
};

export const FLOOR_LINE: Record<string, string> = {
  floor_wood: "#c9a36a",
  floor_tile: "#7fc9bc",
  floor_cloud: "#b7dcec",
};

export const WINDOW_GLASS = "#9bd7ea";
export const WINDOW_FRAME = "#5aabb8";
export const WINDOW_SHINE = "#ffffff";
