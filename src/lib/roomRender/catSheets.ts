import { rememberCatBreeds } from "./depthPaint.ts";
import { releaseRoomImage } from "./imageCache.ts";
import { releaseHeldWarm } from "./warmRoom.ts";

const ROOT = "/assets/room/cat/";
const missing = new Set<string>();
let history: string[] = [];

export function halfSheetName(file: string): string {
  return file.replace(/\.webp$/i, "-half.webp");
}

/** Half sheet below 1.5x. The full sheet after a pinch ends above that. A missing half falls back. */
export function catSheetUrl(file: string, zoom: number): string {
  const name = zoom >= 1.5 || missing.has(file) ? file : halfSheetName(file);
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
    for (const url of [catSheetUrl(file, 1), catSheetUrl(file, 2)]) {
      releaseRoomImage(url);
      releaseHeldWarm(url);
    }
  }
}
