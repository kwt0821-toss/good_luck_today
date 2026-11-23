import { rememberCatBreeds } from "./depthPaint.ts";
import { releaseRoomImage } from "./imageCache.ts";
import { releaseHeldWarm } from "./warmRoom.ts";

const ROOT = "/assets/room/cat/";
const missing = new Set<string>();
let history: string[] = [];

export function halfSheetName(file: string): string {
  return file.replace(/\.webp$/i, "-half.webp");
}

/** Always the half sheet. A missing half falls back to the original file. */
export function catSheetUrl(file: string): string {
  const name = missing.has(file) ? file : halfSheetName(file);
  return `${ROOT}${name.replace(/^\//, "")}`;
}

export function markCatSheetMissing(file: string) {
  missing.add(file);
}

/** Drop breed sheets that left the room, keeping the three most recent. */
export function noteRoomCatSheets(files: string[]) {
  const step = rememberCatBreeds(history, files, 3);
  history = step.history;
  for (const file of step.drop) {
    for (const url of [`${ROOT}${halfSheetName(file).replace(/^\//, "")}`, `${ROOT}${file.replace(/^\//, "")}`]) {
      releaseRoomImage(url);
      releaseHeldWarm(url);
    }
  }
}
