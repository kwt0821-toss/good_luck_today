const settled = new Map<string, HTMLImageElement | null>();

export function cachedRoomImageBytes(): number {
  let bytes = 0;
  settled.forEach((image) => {
    if (image) bytes += image.naturalWidth * image.naturalHeight * 4;
  });
  return bytes;
}
const inflight = new Map<string, Promise<HTMLImageElement | null>>();

/** Already decoded image, null after a failure, or undefined while it is still loading. */
export function peekRoomImage(url: string): HTMLImageElement | null | undefined {
  if (settled.has(url)) return settled.get(url) ?? null;
  return undefined;
}

/** Drop a decoded image so a breed that left the room can be collected. */
export function releaseRoomImage(url: string) {
  settled.delete(url);
  inflight.delete(url);
}

/** One Image per URL, kept until released. A failure resolves to null. */
export function loadRoomImage(url: string): Promise<HTMLImageElement | null> {
  if (settled.has(url)) return Promise.resolve(settled.get(url) ?? null);
  const pending = inflight.get(url);
  if (pending) return pending;
  const next = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const finish = (value: HTMLImageElement | null) => {
      settled.set(url, value);
      inflight.delete(url);
      resolve(value);
    };
    img.onload = () => {
      if (typeof img.decode === "function") void img.decode().then(() => finish(img)).catch(() => finish(img));
      else finish(img);
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
  inflight.set(url, next);
  return next;
}
