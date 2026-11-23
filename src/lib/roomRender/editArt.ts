/** Half-size edit overlays. The full webp stays on disk for the fallback. */
export const EDIT_HALF = {
  frame: "world/room-frame-edit-half.webp",
  puffs: "world/front-puffs-edit-half.webp",
  grid: "world/room-floor-edit-grid-half.webp",
  hints: "world/edit-footprint-hints-half.webp",
} as const;

export const EDIT_FULL = {
  frame: "world/room-frame-edit.webp",
  puffs: "world/front-puffs-edit.webp",
  grid: "world/room-floor-edit-grid.webp",
  hints: "world/edit-footprint-hints.webp",
} as const;
