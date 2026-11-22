const MAX_BAKED = 4;

type BakedFloor = {
  key: string;
  canvas: HTMLCanvasElement;
};

const baked: BakedFloor[] = [];

export function bakedFloorBytes(): number {
  let bytes = 0;
  for (const entry of baked) bytes += entry.canvas.width * entry.canvas.height * 4;
  return bytes;
}

export function takeBakedFloor(key: string): HTMLCanvasElement | null {
  const index = baked.findIndex((entry) => entry.key === key);
  if (index < 0) return null;
  const [hit] = baked.splice(index, 1);
  baked.push(hit);
  return hit.canvas.width > 0 ? hit.canvas : null;
}

/** Keep the last four finished floors. Older copies drop their bitmap. */
export function storeBakedFloor(key: string, source: HTMLCanvasElement): HTMLCanvasElement {
  const existing = baked.findIndex((entry) => entry.key === key);
  if (existing >= 0) {
    const [hit] = baked.splice(existing, 1);
    baked.push(hit);
    return hit.canvas;
  }
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d")?.drawImage(source, 0, 0);
  baked.push({ key, canvas: copy });
  while (baked.length > MAX_BAKED) {
    const old = baked.shift();
    if (!old) break;
    old.canvas.width = 0;
    old.canvas.height = 0;
  }
  return copy;
}
