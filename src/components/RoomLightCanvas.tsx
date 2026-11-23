import { useEffect, useRef } from "react";

import { subscribeRoomClock } from "../lib/roomRender/clock";
import { lampCurve, lampOpacity } from "../lib/roomRender/lightTable";
import type { RoomBright, RoomPeriod } from "../lib/roomMood";
import { cappedBitmapSize } from "../lib/roomRender/bitmapSize";

const MAX_PIXELS = 4_000_000;

type Props = {
  period: RoomPeriod;
  bright: RoomBright;
  reduceMotion: boolean;
  active: boolean;
  revision: string;
};

/** One screen-blend canvas for every lamp and item glow. The CSS animations stay off. */
export function RoomLightCanvas({ period, bright, reduceMotion, active, revision }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef({ period, bright, reduceMotion, active });
  liveRef.current = { period, bright, reduceMotion, active };

  useEffect(() => {
    const canvas = canvasRef.current;
    const world = canvas?.closest(".lucky-world");
    if (!canvas || !(world instanceof HTMLElement)) return;
    let dead = false;

    const paint = (now: number) => {
      if (dead) return;
      const live = liveRef.current;
      if (!live.active || document.hidden) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const scale = Math.min(1, window.devicePixelRatio || 1);
      const size = cappedBitmapSize(rect.width * scale, rect.height * scale, MAX_PIXELS);
      if (canvas.width !== size.width || canvas.height !== size.height) {
        canvas.width = size.width;
        canvas.height = size.height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const motion = lampCurve(live.period, live.bright);
      const opacity = live.reduceMotion || motion.staticOpacity != null
        ? (motion.staticOpacity ?? lampOpacity(motion.stops, 0.5))
        : lampOpacity(motion.stops, (now % 3200) / 3200);
      const fitX = canvas.width / rect.width;
      const fitY = canvas.height / rect.height;
      const glows = world.querySelectorAll<HTMLElement>(".lucky-lamp-glow, .lucky-item-glow");
      if (!glows.length) return;
      const editing = canvas.closest(".lucky-room")?.classList.contains("is-edit") === true;
      glows.forEach((glow) => {
        const box = glow.getBoundingClientRect();
        const x = (box.left - rect.left) * fitX;
        const y = (box.top - rect.top) * fitY;
        const w = box.width * fitX;
        const h = box.height * fitY;
        ctx.save();
        ctx.globalAlpha = opacity;
        const neon = glow.classList.contains("is-neon");
        if (editing && neon) ctx.filter = "brightness(0.8) sepia(0.35) hue-rotate(-20deg) saturate(2.4)";
        else if (editing) ctx.filter = "brightness(0.8)";
        else if (neon) ctx.filter = "sepia(0.35) hue-rotate(-20deg) saturate(2.4)";
        if (glow instanceof HTMLImageElement && glow.naturalWidth > 0) {
          ctx.drawImage(glow, x, y, w, h);
        } else {
          const gradient = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w / 2);
          if (glow.classList.contains("is-neon")) {
            gradient.addColorStop(0, "rgba(255, 150, 196, 0.9)");
            gradient.addColorStop(0.48, "rgba(255, 90, 160, 0.34)");
          } else {
            gradient.addColorStop(0, "rgba(255, 220, 160, 0.9)");
            gradient.addColorStop(0.46, "rgba(255, 176, 96, 0.32)");
          }
          gradient.addColorStop(0.72, "transparent");
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
      });
    };

    paint(performance.now());
    let stop = () => {};
    const arm = () => {
      stop();
      const live = liveRef.current;
      if (!live.active || live.reduceMotion || document.hidden) return;
      if (lampCurve(live.period, live.bright).staticOpacity != null) return;
      const glows = world.querySelectorAll(".lucky-lamp-glow, .lucky-item-glow");
      if (!glows.length) return;
      stop = subscribeRoomClock(paint);
    };
    arm();
    return () => {
      dead = true;
      stop();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [period, bright, reduceMotion, active, revision]);

  return <canvas ref={canvasRef} className="lucky-light-canvas" aria-hidden="true" />;
}
