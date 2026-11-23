/**
 * Half-size copies of the 3840×2160 edit overlays.
 *
 *   node scripts/make-edit-half.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = "public/assets/room/world";
const files = [
  "room-frame-edit.webp",
  "front-puffs-edit.webp",
  "room-floor-edit-grid.webp",
  "edit-footprint-hints.webp",
];

for (const name of files) {
  const source = path.join(dir, name);
  const meta = await sharp(source).metadata();
  const width = 1920;
  const height = 1080;
  const buf = await sharp(source).resize(width, height, { fit: "fill" }).webp({ quality: 80, alphaQuality: 100, effort: 4 }).toBuffer();
  const out = path.join(dir, name.replace(/\.webp$/, "-half.webp"));
  fs.writeFileSync(out, buf);
  console.log(`${name} ${meta.width}x${meta.height} -> ${width}x${height} ${buf.length}B`);
}
