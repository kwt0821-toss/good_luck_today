/**
 * Re-encode room PNGs as WebP and move the originals out of public/.
 *
 * Cat sprite sheets and cat-shadow.png always convert (quality 85, alpha kept).
 * Other PNGs under public/assets/room/{themes,items,floor,wall,world,tiles}
 * and public/room-art convert only when they are larger than 50KB.
 * Pixel size is unchanged. A sheet whose transparent edge grows a visible
 * fringe is encoded again at quality 90.
 *
 * Originals land in art-source/ so they stay in the repo and out of the app build.
 * Run: node scripts/convert-room-webp.mjs
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const SIZE_LIMIT = 50 * 1024;

const spriteDir = path.join(publicDir, "assets/room/cat");
const otherRoots = [
  path.join(publicDir, "assets/room/themes"),
  path.join(publicDir, "assets/room/items"),
  path.join(publicDir, "assets/room/floor"),
  path.join(publicDir, "assets/room/wall"),
  path.join(publicDir, "assets/room/world"),
  path.join(publicDir, "assets/room/tiles"),
  path.join(publicDir, "room-art"),
];

const textRoots = ["src", "public", "docs", "scripts"].map((dir) => path.join(root, dir));
const textExt = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".json"]);

async function walk(dir, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

function webpOptions(quality) {
  return {
    quality,
    alphaQuality: 100,
    effort: 4,
    smartSubsample: false,
    lossless: false,
  };
}

async function fringe(pngPath, webpPath) {
  const src = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const dst = await sharp(webpPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (src.info.width !== dst.info.width || src.info.height !== dst.info.height) {
    return { mismatch: true, fringe: 0, opaqueShift: 0 };
  }
  const step = 4;
  let transparent = 0;
  let fringeCount = 0;
  let opaque = 0;
  let shift = 0;
  const width = src.info.width;
  const channels = 4;
  for (let y = 0; y < src.info.height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const sa = src.data[i + 3];
      const da = dst.data[i + 3];
      if (sa === 0) {
        transparent += 1;
        if (da > 16) fringeCount += 1;
      } else if (sa > 220 && da > 200) {
        opaque += 1;
        shift +=
          Math.abs(src.data[i] - dst.data[i]) +
          Math.abs(src.data[i + 1] - dst.data[i + 1]) +
          Math.abs(src.data[i + 2] - dst.data[i + 2]);
      }
    }
  }
  return {
    mismatch: false,
    fringe: fringeCount,
    fringeRate: transparent ? fringeCount / transparent : 0,
    opaqueShift: opaque ? shift / opaque : 0,
  };
}

function looksDirty(score) {
  if (score.mismatch) return true;
  return score.fringe > 40 || score.fringeRate > 0.002 || score.opaqueShift > 36;
}

async function encode(pngPath, webpPath, quality) {
  const before = await sharp(pngPath).metadata();
  await sharp(pngPath).webp(webpOptions(quality)).toFile(webpPath);
  const after = await sharp(webpPath).metadata();
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(
      `${path.basename(pngPath)} size changed ${before.width}x${before.height} -> ${after.width}x${after.height}`,
    );
  }
  return { width: before.width, height: before.height };
}

async function moveFile(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
}

async function spriteJobs() {
  const files = (await fs.readdir(spriteDir)).filter(
    (name) => name.startsWith("cat-sprite") && name.endsWith(".png"),
  );
  if ((await fs.readdir(spriteDir)).includes("cat-shadow.png")) files.push("cat-shadow.png");
  return files.map((name) => ({
    png: path.join(spriteDir, name),
    webp: path.join(spriteDir, name.replace(/\.png$/i, ".webp")),
    archive: path.join(root, "art-source/room-cat-sheets", name),
    checkFringe: name.startsWith("cat-sprite"),
  }));
}

async function otherJobs() {
  const jobs = [];
  for (const dir of otherRoots) {
    const files = await walk(dir);
    for (const file of files) {
      if (!file.toLowerCase().endsWith(".png")) continue;
      const stat = await fs.stat(file);
      if (stat.size <= SIZE_LIMIT) continue;
      const rel = path.relative(publicDir, file);
      jobs.push({
        png: file,
        webp: file.replace(/\.png$/i, ".webp"),
        archive: path.join(root, "art-source/room-png", rel),
        checkFringe: true,
        skipEncodeIfWebp: true,
      });
    }
  }
  return jobs;
}

async function convertJob(job) {
  const sibling = job.skipEncodeIfWebp && (await fs.stat(job.webp).catch(() => null));
  if (sibling) {
    await moveFile(job.png, job.archive);
    return { file: path.relative(root, job.png), keptExistingWebp: true, bytes: sibling.size };
  }
  const tmp = `${job.webp}.tmp`;
  const size = await encode(job.png, tmp, 85);
  let quality = 85;
  let score = job.checkFringe ? await fringe(job.png, tmp) : null;
  if (score && looksDirty(score)) {
    await encode(job.png, tmp, 90);
    quality = 90;
    score = await fringe(job.png, tmp);
  }
  await fs.rename(tmp, job.webp);
  const webpStat = await fs.stat(job.webp);
  await moveFile(job.png, job.archive);
  return {
    file: path.relative(publicDir, job.webp),
    quality,
    width: size.width,
    height: size.height,
    webpBytes: webpStat.size,
    fringe: score?.fringe ?? 0,
    fringeRate: Number((score?.fringeRate ?? 0).toFixed(5)),
    opaqueShift: Number((score?.opaqueShift ?? 0).toFixed(2)),
  };
}

function pngRel(file) {
  return file.endsWith(".webp") ? file.replace(/\.webp$/i, ".png") : file;
}

async function publicPngNames() {
  const names = new Set();
  const files = await walk(publicDir);
  for (const file of files) {
    if (file.toLowerCase().endsWith(".png")) names.add(path.basename(file));
  }
  return names;
}

async function rewriteText(convertedFromPublic) {
  const pngs = convertedFromPublic.map(pngRel);
  const stillThere = await publicPngNames();
  // Sprite json stores only the file name. Other art is referenced by a folder path,
  // and a shared name (flat vs drawer) must not be rewritten everywhere.
  const basenames = pngs
    .filter((rel) => rel.startsWith("assets/room/cat/"))
    .map((rel) => path.posix.basename(rel))
    .filter((name) => !stillThere.has(name));
  const needles = [...pngs.flatMap((rel) => {
      const forms = [rel];
      const roomPrefix = "assets/room/";
      if (rel.startsWith(roomPrefix)) forms.push(rel.slice(roomPrefix.length));
      return forms;
    }), ...basenames]
    .sort((a, b) => b.length - a.length);
  if (!needles.length) return [];
  const changed = [];
  for (const dir of textRoots) {
    const files = await walk(dir);
    for (const file of files) {
      if (!textExt.has(path.extname(file))) continue;
      if (file.endsWith(`${path.sep}convert-room-webp.mjs`)) continue;
      let text = await fs.readFile(file, "utf8");
      const original = text;
      for (const needle of needles) {
        if (!needle.endsWith(".png")) continue;
        const next = needle.replace(/\.png$/i, ".webp");
        if (text.includes(needle)) text = text.split(needle).join(next);
      }
      if (text !== original) {
        await fs.writeFile(file, text);
        changed.push(path.relative(root, file));
      }
    }
  }
  return changed;
}

async function archivedPngRels() {
  const rels = [];
  const sheets = await walk(path.join(root, "art-source/room-cat-sheets"));
  for (const file of sheets) {
    if (file.endsWith(".png")) rels.push(`assets/room/cat/${path.basename(file)}`);
  }
  const room = await walk(path.join(root, "art-source/room-png"));
  const base = path.join(root, "art-source/room-png");
  for (const file of room) {
    if (!file.endsWith(".png")) continue;
    rels.push(path.relative(base, file).split(path.sep).join("/"));
  }
  return rels;
}

const jobs = [...(await spriteJobs()), ...(await otherJobs())];
const results = [];
for (const job of jobs) {
  results.push(await convertJob(job));
  const last = results[results.length - 1];
  console.log(
    last.keptExistingWebp
      ? `kept webp, moved png  ${last.file}`
      : `q${last.quality}  ${last.width}x${last.height}  ${(last.webpBytes / 1024).toFixed(0)}KB  ${last.file}`,
  );
}
const converted = results.filter((row) => !row.keptExistingWebp).map((row) => row.file);
const moved = results.length ? results.map((row) => row.file) : await archivedPngRels();
const rewritten = await rewriteText(moved);
console.log(`converted ${converted.length}, moved existing-webp pngs ${results.length - converted.length}`);
console.log(`rewrote ${rewritten.length} files`);
for (const file of rewritten) console.log(`  ${file}`);
