import { useEffect, useRef, type RefObject } from "react";

import { bakedFloorBytes } from "../lib/roomRender/floorBake";
import { cachedRoomImageBytes } from "../lib/roomRender/imageCache";
import { countRoomLayers, holdRoomPerf, readRoomPerf } from "../lib/roomRender/perf";
import { roomRenderLabel, type RoomRenderFlags } from "../lib/roomRender/renderer";

/** Imperative overlay. Updates text once a second and never stores the numbers in React. */
export function RoomPerfBox({
  rootRef,
  flags,
}: {
  rootRef: RefObject<HTMLElement | null>;
  flags: RoomRenderFlags;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const flagsRef = useRef(flags);
  flagsRef.current = flags;

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const write = () => {
      const root = rootRef.current;
      const perf = readRoomPerf();
      let imgs = 0;
      let canvases = 0;
      let nodes = 0;
      let bytes = 0;
      if (root) {
        root.querySelectorAll("img").forEach((img) => {
          imgs += 1;
          bytes += img.naturalWidth * img.naturalHeight * 4;
        });
        root.querySelectorAll("canvas").forEach((canvas) => {
          canvases += 1;
          bytes += canvas.width * canvas.height * 4;
        });
        nodes = root.querySelectorAll("*").length;
      }
      bytes += cachedRoomImageBytes() + bakedFloorBytes();
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      node.textContent = [
        `enter ${Math.round(perf.enterMs)}ms · long ${Math.round(perf.enterLongest)}ms`,
        `5s fps ${perf.fps.toFixed(0)} · >50ms ${perf.slowFrames} · long ${Math.round(perf.longest)}ms`,
        `img ${imgs} · canvas ${canvases} · el ${nodes}`,
        `mem ${mb}MB`,
        roomRenderLabel(flagsRef.current),
        `lite ${flagsRef.current.lite ? "on" : "off"} · pinchFreeze ${flagsRef.current.pinchFreeze ? "on" : "off"} · depth ${flagsRef.current.depth ? "on" : "off"} · depthCats ${flagsRef.current.depthCats ? "on" : "off"} · fx ${flagsRef.current.fx ? "on" : "off"}`,
        `레이어 후보 수 ${countRoomLayers(root)}`,
      ].join("\n");
    };
    write();
    const release = holdRoomPerf();
    const id = window.setInterval(write, 1000);
    return () => {
      window.clearInterval(id);
      release();
    };
  }, [rootRef]);

  return <div ref={boxRef} className="lucky-perf-box" />;
}
