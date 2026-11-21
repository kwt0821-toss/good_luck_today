/**
 * Repack cat sprite sheets so both sides are at most 4096px.
 * Prefer a wider grid at the original frame size. Scale down only when
 * that still does not fit. Frame names, animation order, and file paths stay.
 *
 * Run: node scripts/repack-cat-sprites.mjs
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const MAX = 4096;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public/assets/room/cat");

function choosePack(fw, fh, count) {
  let best = null;
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    const scale = Math.min(1, MAX / (cols * fw), MAX / (rows * fh));
    const cellW = Math.max(1, Math.floor(fw * scale));
    const cellH = Math.max(1, Math.floor(fh * scale));
    if (cols * cellW > MAX || rows * cellH > MAX) continue;
    const area = cols * cellW * rows * cellH;
    const fit = cellW / fw;
    if (
      !best ||
      fit > best.fit + 1e-9 ||
      (Math.abs(fit - best.fit) < 1e-9 && area < best.area)
    ) {
      best = { cols, rows, cellW, cellH, area, fit };
    }
  }
  if (!best) throw new Error(`no pack for ${fw}x${fh} x${count}`);
  return best;
}

function scaled(value, from, to) {
  return Math.round((value * to) / from);
}

function copyFrame(src, srcW, frame, dst, dstW, dx, dy) {
  for (let y = 0; y < frame.h; y += 1) {
    const si = ((frame.y + y) * srcW + frame.x) * 4;
    const di = ((dy + y) * dstW + dx) * 4;
    src.copy(dst, di, si, si + frame.w * 4);
  }
}

async function repack(file) {
  const jsonPath = path.join(dir, file.replace(/\.webp$/i, ".json"));
  const webpPath = path.join(dir, file);
  const meta = await sharp(webpPath).metadata();
  if ((meta.width ?? 0) <= MAX && (meta.height ?? 0) <= MAX) {
    console.log(`${file} already ${meta.width}x${meta.height}`);
    return;
  }
  const raw = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const names = Object.keys(raw.frames);
  const [fw, fh] = raw.frameSize;
  const pack = choosePack(fw, fh, names.length);
  const sheetW = pack.cols * pack.cellW;
  const sheetH = pack.rows * pack.cellH;
  const sameSize = pack.cellW === fw && pack.cellH === fh;
  const decoded = sameSize
    ? await sharp(webpPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    : null;
  const src = decoded?.data ?? null;
  const srcW = decoded?.info.width ?? 0;
  const sheet = Buffer.alloc(sheetW * sheetH * 4);
  const frames = {};
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    const frame = raw.frames[name];
    const dx = (i % pack.cols) * pack.cellW;
    const dy = Math.floor(i / pack.cols) * pack.cellH;
    if (src && sameSize) {
      copyFrame(src, srcW, frame, sheet, sheetW, dx, dy);
    } else {
      const piece = await sharp(webpPath)
        .extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h })
        .resize(pack.cellW, pack.cellH, { fit: "fill", kernel: "lanczos3" })
        .ensureAlpha()
        .raw()
        .toBuffer();
      for (let y = 0; y < pack.cellH; y += 1) {
        piece.copy(sheet, ((dy + y) * sheetW + dx) * 4, y * pack.cellW * 4, (y + 1) * pack.cellW * 4);
      }
    }
    frames[name] = { x: dx, y: dy, w: pack.cellW, h: pack.cellH };
  }
  const out = await sharp(sheet, { raw: { width: sheetW, height: sheetH, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 4, smartSubsample: false })
    .toBuffer();
  await fs.writeFile(webpPath, out);
  raw.frameSize = [pack.cellW, pack.cellH];
  raw.sheetSize = [sheetW, sheetH];
  raw.frames = frames;
  if (raw.anchor && pack.cellW !== fw) {
    raw.anchor.x = scaled(raw.anchor.x, fw, pack.cellW);
    raw.anchor.y = scaled(raw.anchor.y, fh, pack.cellH);
  } else if (raw.anchor && pack.cellH !== fh) {
    raw.anchor.y = scaled(raw.anchor.y, fh, pack.cellH);
  }
  if (raw.shadow && (pack.cellW !== fw || pack.cellH !== fh)) {
    raw.shadow.size = [
      scaled(raw.shadow.size[0], fw, pack.cellW),
      scaled(raw.shadow.size[1], fh, pack.cellH),
    ];
    raw.shadow.anchor = [
      scaled(raw.shadow.anchor[0], fw, pack.cellW),
      scaled(raw.shadow.anchor[1], fh, pack.cellH),
    ];
  }
  await fs.writeFile(jsonPath, `${JSON.stringify(raw, null, 1)}\n`);
  const outMeta = await sharp(out).metadata();
  console.log(
    `${file} ${fw}x${fh} x${names.length} -> ${outMeta.width}x${outMeta.height} cols=${pack.cols} scale=${pack.fit.toFixed(3)}`,
  );
}

const files = (await fs.readdir(dir)).filter((name) => /^cat-sprite.*\.webp$/i.test(name)).sort();
for (const file of files) {
  await repack(file);
}
