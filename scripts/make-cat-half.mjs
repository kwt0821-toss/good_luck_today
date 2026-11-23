/**
 * Write a half-resolution copy of every cat sprite sheet.
 * Frame JSON stays in original pixels; painters multiply by imageWidth / sheetSize.
 *
 *   node scripts/make-cat-half.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = "public/assets/room/cat";
const files = fs
  .readdirSync(dir)
  .filter((name) => /^cat-sprite(-[a-z0-9_]+)?\.webp$/.test(name))
  .sort();

let before = 0;
let after = 0;
for (const name of files) {
  const source = path.join(dir, name);
  const original = fs.statSync(source).size;
  const meta = await sharp(source).metadata();
  const width = Math.max(1, Math.round((meta.width ?? 1) / 2));
  const height = Math.max(1, Math.round((meta.height ?? 1) / 2));
  const buf = await sharp(source)
    .resize(width, height, { fit: "fill" })
    .webp({ quality: 78, alphaQuality: 100, effort: 4 })
    .toBuffer();
  const out = path.join(dir, name.replace(/\.webp$/, "-half.webp"));
  fs.writeFileSync(out, buf);
  before += original;
  after += buf.length;
  console.log(`${name} ${meta.width}x${meta.height} -> ${width}x${height} ${buf.length}B (was ${original}B)`);
}
console.log(`total ${after}B / ${before}B (${((after / before) * 100).toFixed(1)}%)`);
