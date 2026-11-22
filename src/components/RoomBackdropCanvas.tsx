import { useEffect, useRef } from "react";

import { WORLD_H, WORLD_W } from "../lib/roomLayout";
import { storeBakedFloor, takeBakedFloor } from "../lib/roomRender/floorBake";
import { loadRoomImage, peekRoomImage } from "../lib/roomRender/imageCache";
import { floorCanvasBox, floorCanvasKey, paintFloorCells, type FloorCanvasTile } from "../lib/roomRender/paintFloor";
import { markRoomRendererFailed } from "../lib/roomRender/renderer";

export type { FloorCanvasTile };

type Props = {
  tiles: FloorCanvasTile[];
  active: boolean;
  onFail: () => void;
};

const BOUNDS = floorCanvasBox();

/** One floor canvas per room. Finished bitmaps are reused; inactive rooms wait 0.35s. */
export function RoomBackdropCanvas({ tiles, active, onFail }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const key = floorCanvasKey(tiles);

  useEffect(() => {
    const canvas = ref.current;
    return () => {
      if (!canvas) return;
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let dead = false;
    let timer = 0;
    let raf = 0;
    const cells = tilesRef.current;

    const paint = (ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement | null>, bake: boolean) => {
      if (canvas.width !== BOUNDS.w || canvas.height !== BOUNDS.h) {
        canvas.width = BOUNDS.w;
        canvas.height = BOUNDS.h;
      }
      paintFloorCells(ctx, cells, images);
      if (bake) storeBakedFloor(key, canvas);
    };

    const fail = () => {
      markRoomRendererFailed();
      failRef.current();
    };

    const draw = () => {
      if (dead) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        fail();
        return;
      }
      try {
        const baked = takeBakedFloor(key);
        if (baked) {
          if (canvas.width !== BOUNDS.w || canvas.height !== BOUNDS.h) {
            canvas.width = BOUNDS.w;
            canvas.height = BOUNDS.h;
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, BOUNDS.w, BOUNDS.h);
          ctx.drawImage(baked, 0, 0);
          return;
        }
        const images = new Map<string, HTMLImageElement | null>();
        const waiting: Promise<unknown>[] = [];
        for (const src of new Set(cells.map((tile) => tile.src))) {
          const known = peekRoomImage(src);
          if (known !== undefined) images.set(src, known);
          else waiting.push(loadRoomImage(src).then((image) => images.set(src, image)));
        }
        paint(ctx, images, waiting.length === 0);
        if (!waiting.length) return;
        void Promise.all(waiting).then(() => {
          if (dead) return;
          raf = requestAnimationFrame(() => {
            if (dead) return;
            const next = canvas.getContext("2d");
            if (!next) return;
            try {
              paint(next, images, true);
            } catch {
              fail();
            }
          });
        });
      } catch {
        fail();
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible" || dead) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const images = new Map<string, HTMLImageElement | null>();
      const waiting: Promise<unknown>[] = [];
      for (const src of new Set(cells.map((tile) => tile.src))) {
        const known = peekRoomImage(src);
        if (known !== undefined) images.set(src, known);
        else waiting.push(loadRoomImage(src).then((image) => images.set(src, image)));
      }
      const finish = () => {
        if (dead) return;
        try {
          paint(ctx, images, true);
        } catch {
          fail();
        }
      };
      if (waiting.length) void Promise.all(waiting).then(finish);
      else finish();
    };

    if (active) draw();
    else timer = window.setTimeout(draw, 350);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      dead = true;
      window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, active]);

  return (
    <canvas
      ref={ref}
      className="lucky-floor-canvas"
      aria-hidden="true"
      style={{
        left: `${(BOUNDS.x / WORLD_W) * 100}%`,
        top: `${(BOUNDS.y / WORLD_H) * 100}%`,
        width: `${(BOUNDS.w / WORLD_W) * 100}%`,
        height: `${(BOUNDS.h / WORLD_H) * 100}%`,
      }}
    />
  );
}
