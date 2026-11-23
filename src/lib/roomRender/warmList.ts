import { floorTileSrc } from "../roomTiles.ts";

const CHEESE_SHEET = "cat/cat-sprite.webp";

export function catSheetFile(catId: string): string {
  const file = catId === "cheese" ? CHEESE_SHEET : `cat/cat-sprite-${catId}.webp`;
  return file.replace(/\.webp$/, "-half.webp");
}

/** Relative room-asset paths to decode before the room opens. */
export function warmRelatives(floor: string[][], catIds: string[], crops: string[]): string[] {
  const cats = catIds.length ? catIds : ["cheese"];
  const files = ["world/base-bg.webp", ...crops, ...cats.map(catSheetFile)];
  for (let row = 0; row < floor.length; row += 1) {
    const line = floor[row] ?? [];
    for (let col = 0; col < line.length; col += 1) {
      const id = line[col];
      if (!id) continue;
      files.push(floorTileSrc(id, col, row));
    }
  }
  return files;
}
