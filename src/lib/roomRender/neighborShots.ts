export function roomPictureKey(
  roomId: string,
  layout: {
    floor: unknown;
    walls: unknown;
    floorTiles: unknown;
    wallTiles: unknown;
    roamingCatIds?: unknown;
    shadowsEnabled?: unknown;
  },
  period: string,
  bright: string,
): string {
  return JSON.stringify({
    roomId,
    floor: layout.floor,
    walls: layout.walls,
    floorTiles: layout.floorTiles,
    wallTiles: layout.wallTiles,
    cats: layout.roamingCatIds ?? [],
    shadows: layout.shadowsEnabled === true,
    period,
    bright,
  });
}

const shots = new Map<string, HTMLCanvasElement>();
const order: string[] = [];

export function peekNeighborShot(key: string): HTMLCanvasElement | null {
  const shot = shots.get(key);
  return shot && shot.width > 0 ? shot : null;
}

/** Keep the four newest pictures. Older ones release their pixels. */
export function rememberNeighborShot(key: string, canvas: HTMLCanvasElement) {
  const prev = shots.get(key);
  if (prev && prev !== canvas) {
    prev.width = 0;
    prev.height = 0;
  }
  shots.delete(key);
  const index = order.indexOf(key);
  if (index >= 0) order.splice(index, 1);
  shots.set(key, canvas);
  order.push(key);
  while (order.length > 4) {
    const old = order.shift();
    if (!old) break;
    const dropped = shots.get(old);
    shots.delete(old);
    if (dropped) {
      dropped.width = 0;
      dropped.height = 0;
    }
  }
}
