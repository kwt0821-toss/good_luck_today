import { useLayoutEffect, useRef } from "react";
import { defaultSitFrame, type CatSpriteSheet } from "../lib/roomCat";
import type { CatMotionRef, RoomCatMotion } from "../lib/useRoomCat";
import {
  backingScale,
  boxesTouch,
  breatheScaleY,
  coverListKey,
  coveredSpriteKeys,
  type CoverOccluder,
  catBreathes,
  catNeedsDom,
  containBox,
  coverSource,
  depthOrder,
  frameArtBox,
  padBox,
  unionBox,
  type PaintBox,
} from "../lib/roomRender/depthPaint";
import { catSheetUrl, markCatSheetMissing } from "../lib/roomRender/catSheets";
import { loadRoomImage, peekRoomImage } from "../lib/roomRender/imageCache";
import { markRoomRendererFailed } from "../lib/roomRender/renderer";
import { WORLD_H, WORLD_W } from "../lib/roomLayout";

export type DepthSprite = {
  key: string;
  src: string;
  rect: { x: number; y: number; w: number; h: number };
  flip: boolean;
  z: number;
  order: number;
  breathe: boolean;
  /** Cat beds stay in the DOM so their CSS breathe keeps running. */
  stayHtml?: boolean;
  frameKind: "cardframe" | "squareframe" | null;
  frameThumb: string | null;
};

export type DepthCat = {
  id: string;
  breedId: string;
  sheet: CatSpriteSheet;
  motionRef: CatMotionRef;
  happyFrames: number;
};

type Props = {
  sprites: DepthSprite[];
  spriteKey: string;
  cats: DepthCat[];
  catKey: string;
  /** Draw cats into this canvas. Off, they stay in the DOM and furniture covers them. */
  drawCats?: boolean;
  active: boolean;
  reduceMotion: boolean;
  onFail: () => void;
  onPainted?: () => void;
};

const MAX_PIXELS = 4_000_000;
const CAT_FPS = 30;
const BREATHE_FPS = 12;

export function RoomDepthCanvas({
  sprites,
  spriteKey,
  cats,
  catKey,
  drawCats = false,
  active,
  reduceMotion,
  onFail,
  onPainted,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef(sprites);
  const catsRef = useRef(cats);
  const drawCatsRef = useRef(drawCats);
  const liveRef = useRef({ active, reduceMotion });
  const failRef = useRef(onFail);
  const paintedRef = useRef(onPainted);
  paintedRef.current = onPainted;
  const redrawRef = useRef<() => void>(() => {});
  const runRef = useRef<() => void>(() => {});
  const kickQueued = useRef(false);
  failRef.current = onFail;
  spritesRef.current = sprites;
  catsRef.current = cats;
  drawCatsRef.current = drawCats;
  liveRef.current = { active, reduceMotion };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      markRoomRendererFailed();
      failRef.current();
      return;
    }
    let dead = false;
    let toldPaint = false;
    let timer = 0;
    let raf = 0;
    const images = new Map<string, HTMLImageElement | null>();
    const catBoxes = new Map<string, PaintBox>();
    let failed = false;
    let lastCover = "";

    const fail = () => {
      if (failed || dead) return;
      failed = true;
      markRoomRendererFailed();
      failRef.current();
    };

    const ensure = (url: string) => {
      if (!url || images.has(url)) return images.get(url) ?? null;
      const ready = peekRoomImage(url);
      if (ready) {
        images.set(url, ready);
        return ready;
      }
      if (ready === undefined) {
        images.set(url, null);
        void loadRoomImage(url).then((image) => {
          images.set(url, image);
          if (!dead) paint(null);
        });
      } else images.set(url, null);
      return null;
    };

    const toCanvas = (box: PaintBox, width: number, height: number): PaintBox => {
      const scaleX = width / WORLD_W;
      const scaleY = height / WORLD_H;
      return {
        x: box.x * scaleX,
        y: box.y * scaleY,
        w: box.w * scaleX,
        h: box.h * scaleY,
      };
    };

    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      const cap = liveRef.current.active ? 2 : 1;
      const dpr = Math.min(window.devicePixelRatio || 1, cap);
      const scale = backingScale(rect.width, rect.height, dpr, MAX_PIXELS);
      const width = Math.max(1, Math.round(rect.width * scale));
      const height = Math.max(1, Math.round(rect.height * scale));
      if (width * height > MAX_PIXELS) return false;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return true;
    };

    const drawImage = (image: HTMLImageElement, dest: PaintBox, alpha: number, flip: boolean, breathe: number, origin: { x: number; y: number }, flipOrigin: { x: number; y: number }, source?: { sx: number; sy: number; sw: number; sh: number }) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(flipOrigin.x, flipOrigin.y);
      ctx.scale(flip ? -1 : 1, 1);
      ctx.translate(-flipOrigin.x, -flipOrigin.y);
      ctx.translate(origin.x, origin.y);
      ctx.scale(1, breathe);
      ctx.translate(-origin.x, -origin.y);
      if (source) ctx.drawImage(image, source.sx, source.sy, source.sw, source.sh, dest.x, dest.y, dest.w, dest.h);
      else ctx.drawImage(image, dest.x, dest.y, dest.w, dest.h);
      ctx.restore();
    };

    const spriteBox = (sprite: DepthSprite): PaintBox => padBox(sprite.rect, Math.max(8, sprite.rect.h * 0.04));

    const catState = (cat: DepthCat) => cat.motionRef.current;

    const catWorldBox = (cat: DepthCat, motion: RoomCatMotion): PaintBox => {
      const [fw, fh] = cat.sheet.frameSize;
      return { x: motion.worldX - cat.sheet.anchor.x, y: motion.worldY - cat.sheet.anchor.y, w: fw, h: fh };
    };

    const coverKeyNow = () => {
      const occluders: CoverOccluder[] = [];
      if (!drawCatsRef.current) {
        for (const cat of catsRef.current) {
          const motion = catState(cat);
          occluders.push({ z: motion.zIndex, box: catWorldBox(cat, motion) });
        }
      }
      for (const sprite of spritesRef.current) {
        if (sprite.stayHtml) occluders.push({ z: sprite.z, box: sprite.rect });
      }
      const targets = spritesRef.current
        .filter((sprite) => !sprite.stayHtml)
        .map((sprite) => ({ key: sprite.key, z: sprite.z, box: sprite.rect }));
      return coverListKey(coveredSpriteKeys(targets, occluders));
    };

    const paint = (dirty: PaintBox | null) => {
      if (dead) return;
      try {
        if (!sizeCanvas()) return;
        const width = canvas.width;
        const height = canvas.height;
        ctx.imageSmoothingEnabled = true;
        try {
          ctx.imageSmoothingQuality = "high";
        } catch {
          /* Older 2D contexts ignore the quality hint. */
        }
        const now = performance.now();
        const live = liveRef.current;
        const covered = new Set(coverKeyNow().split(",").filter(Boolean));
        const root = canvas.closest(".lucky-world");
        root?.querySelectorAll<HTMLElement>(".lucky-sprite.is-canvas").forEach((button) => {
          button.classList.toggle("is-over-cat", covered.has(button.dataset.spriteKey ?? ""));
        });
        const coverKey = coverListKey(covered);
        const coverChanged = coverKey !== lastCover;
        lastCover = coverKey;
        const region = !coverChanged && dirty ? padBox(dirty, 2) : null;
        ctx.save();
        if (region) {
          ctx.beginPath();
          ctx.rect(region.x, region.y, region.w, region.h);
          ctx.clip();
          ctx.clearRect(region.x, region.y, region.w, region.h);
        } else ctx.clearRect(0, 0, width, height);
        const items: { z: number; order: number; draw: () => void; box: PaintBox }[] = [];
        for (const sprite of spritesRef.current) {
          if (sprite.stayHtml || covered.has(sprite.key)) continue;
          const image = ensure(sprite.src);
          const box = toCanvas(spriteBox(sprite), width, height);
          if (region && !boxesTouch(region, box)) continue;
          items.push({
            z: sprite.z,
            order: sprite.order,
            box,
            draw: () => {
              if (!image || image.naturalWidth <= 0) return;
              const button = toCanvas(sprite.rect, width, height);
              const fitted = containBox(image.naturalWidth, image.naturalHeight, button);
              const breathe = sprite.breathe && live.active && !live.reduceMotion ? breatheScaleY(now) : 1;
              drawImage(
                image,
                fitted,
                1,
                sprite.flip,
                breathe,
                { x: button.x + button.w / 2, y: button.y + button.h * 0.86 },
                { x: button.x + button.w / 2, y: button.y + button.h },
              );
              if (!sprite.frameKind || !sprite.frameThumb) return;
              const thumb = ensure(sprite.frameThumb);
              if (!thumb || thumb.naturalWidth <= 0) return;
              const art = toCanvas(frameArtBox(sprite.frameKind, sprite.rect), width, height);
              const source = coverSource(thumb.naturalWidth, thumb.naturalHeight, art.w, art.h);
              drawImage(thumb, art, 1, sprite.flip, breathe, { x: button.x + button.w / 2, y: button.y + button.h * 0.86 }, { x: button.x + button.w / 2, y: button.y + button.h }, source);
            },
          });
        }

        if (drawCatsRef.current) catsRef.current.forEach((cat, index) => {
          const motion = catState(cat);
          const world = catWorldBox(cat, motion);
          const box = toCanvas(padBox(world, Math.max(8, world.h * 0.05)), width, height);
          const previous = catBoxes.get(cat.id);
          catBoxes.set(cat.id, box);
          const dom = catNeedsDom(motion, cat.breedId) || motion.spriteHidden || motion.opacity <= 0.01;
          if (dom) return;
          if (region && !boxesTouch(region, box) && !(previous && boxesTouch(region, previous))) return;
          const sheetUrl = catSheetUrl(cat.sheet.image);
          const image = ensure(sheetUrl);
          const halfFailed = !image && peekRoomImage(sheetUrl) === null;
          if (halfFailed && sheetUrl.endsWith("-half.webp")) markCatSheetMissing(cat.sheet.image);
          items.push({
            z: motion.zIndex,
            order: 1000 + index,
            box,
            draw: () => {
              const drawn = image && image.naturalWidth > 0
                ? image
                : halfFailed
                  ? ensure(catSheetUrl(cat.sheet.image))
                  : null;
              if (!drawn || drawn.naturalWidth <= 0) return;
              const frame = cat.sheet.frames[motion.frameName] ?? cat.sheet.frames[defaultSitFrame(cat.sheet)];
              if (!frame) return;
              const scaleX = drawn.naturalWidth / cat.sheet.sheetSize[0];
              const scaleY = drawn.naturalHeight / cat.sheet.sheetSize[1];
              const dest = toCanvas(world, width, height);
              const breathe = !live.reduceMotion && catBreathes(motion.anim, cat.happyFrames < 2)
                ? breatheScaleY(now, 2000, 0.03)
                : 1;
              const originX = dest.x + (cat.sheet.anchor.x / world.w) * dest.w;
              const originY = dest.y + dest.h;
              drawImage(drawn, dest, motion.opacity, motion.flip, breathe, { x: originX, y: originY }, { x: originX, y: originY }, {
                sx: frame.x * scaleX,
                sy: frame.y * scaleY,
                sw: frame.w * scaleX,
                sh: frame.h * scaleY,
              });
            },
          });
        });

        for (const item of depthOrder(items)) item.draw();
        ctx.restore();
        if (!dirty && !toldPaint) {
          toldPaint = true;
          paintedRef.current?.();
        }
      } catch {
        fail();
      }
    };

    const dirtyNow = (): PaintBox | null => {
      const width = canvas.width;
      const height = canvas.height;
      const boxes: PaintBox[] = [];
      if (liveRef.current.active && !liveRef.current.reduceMotion) {
        for (const sprite of spritesRef.current) {
          if (sprite.breathe && !sprite.stayHtml) boxes.push(toCanvas(spriteBox(sprite), width, height));
        }
      }
      for (const cat of catsRef.current) {
        const motion = catState(cat);
        const world = catWorldBox(cat, motion);
        const next = toCanvas(padBox(world, Math.max(8, world.h * 0.05)), width, height);
        const prev = catBoxes.get(cat.id);
        if (prev) boxes.push(prev);
        boxes.push(next);
      }
      return unionBox(boxes);
    };

    const moving = () => {
      if (!liveRef.current.active || document.hidden) return false;
      if (!liveRef.current.reduceMotion && spritesRef.current.some((sprite) => sprite.breathe && !sprite.stayHtml)) return true;
      return catsRef.current.some((cat) => {
        const motion = catState(cat);
        if (catNeedsDom(motion, cat.breedId) || motion.spriteHidden) return false;
        if (!drawCatsRef.current) return false;
        return motion.anim.startsWith("walk") || (!liveRef.current.reduceMotion && catBreathes(motion.anim, cat.happyFrames < 2));
      });
    };

    const loop = () => {
      if (dead || !moving()) return;
      const catsMoving = catsRef.current.some((cat) => catState(cat).anim.startsWith("walk"));
      const gap = catsMoving ? 1000 / CAT_FPS : 1000 / BREATHE_FPS;
      timer = window.setTimeout(() => {
        timer = 0;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!dead && liveRef.current.active && !document.hidden) paint(dirtyNow());
          loop();
        });
      }, gap);
    };

    const kick = () => {
      runRef.current = () => {
        if (dead) return;
        window.clearTimeout(timer);
        timer = 0;
        cancelAnimationFrame(raf);
        raf = 0;
        if (document.hidden) return;
        paint(null);
        loop();
      };
      if (kickQueued.current) return;
      kickQueued.current = true;
      requestAnimationFrame(() => {
        kickQueued.current = false;
        runRef.current();
      });
    };
    redrawRef.current = kick;

    const onShow = () => {
      if (!document.hidden) kick();
    };
    let sawSize = false;
    let lastW = -1;
    let lastH = -1;
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (!sawSize) {
        sawSize = true;
        lastW = w;
        lastH = h;
        return;
      }
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      kick();
    });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", onShow);
    const unsubs = catsRef.current.map((cat) => cat.motionRef.subscribe(() => {
      if (dead || document.hidden || !liveRef.current.active) return;
      if (!drawCatsRef.current) {
        const next = coverKeyNow();
        if (next === lastCover) return;
        if (raf || timer) return;
        timer = window.setTimeout(() => {
          timer = 0;
          raf = requestAnimationFrame(() => {
            raf = 0;
            if (dead || document.hidden) return;
            if (coverKeyNow() === lastCover) return;
            paint(null);
          });
        }, 1000 / CAT_FPS);
        return;
      }
      if (raf || timer) return;
      const walking = catsRef.current.some((entry) => catState(entry).anim.startsWith("walk"));
      const gap = walking ? 1000 / CAT_FPS : 1000 / BREATHE_FPS;
      timer = window.setTimeout(() => {
        timer = 0;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (dead || document.hidden) return;
          paint(dirtyNow());
          if (moving()) loop();
        });
      }, gap);
    }));
    kick();

    return () => {
      dead = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onShow);
      for (const unsub of unsubs) unsub();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [spriteKey, catKey, drawCats, active, reduceMotion]);

  return <canvas ref={canvasRef} className="lucky-depth-canvas" data-photo-z="19" aria-hidden="true" />;
}
