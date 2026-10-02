export class Pixmap {
  readonly width: number;
  readonly height: number;
  private readonly cells: (string | null)[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = Array<string | null>(width * height).fill(null);
  }

  set(x: number, y: number, color: string | null) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    this.cells[py * this.width + px] = color;
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.cells[y * this.width + x];
  }

  fillRect(x: number, y: number, w: number, h: number, color: string) {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) this.set(x + dx, y + dy, color);
    }
  }

  fillPoly(points: Array<{ x: number; y: number }>, color: string) {
    if (points.length < 3) return;
    const ys = points.map((point) => point.y);
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));
    for (let y = minY; y <= maxY; y += 1) {
      const hits: number[] = [];
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          const t = (y - a.y) / (b.y - a.y);
          hits.push(a.x + t * (b.x - a.x));
        }
      }
      hits.sort((left, right) => left - right);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const x0 = Math.round(hits[i]);
        const x1 = Math.round(hits[i + 1]);
        for (let x = x0; x <= x1; x += 1) this.set(x, y, color);
      }
    }
  }

  /** 2:1 isometric diamond. `topY` is the top vertex. */
  fillDiamond(cx: number, topY: number, width: number, color: string) {
    const height = Math.floor(width / 2);
    for (let y = 0; y < height; y += 1) {
      const dist = y <= (height - 1) / 2 ? y : height - 1 - y;
      const half = dist * 2;
      for (let x = -half; x <= half; x += 1) this.set(cx + x, topY + y, color);
    }
  }

  outlineDiamond(cx: number, topY: number, width: number, color: string) {
    const height = Math.floor(width / 2);
    for (let y = 0; y < height; y += 1) {
      const dist = y <= (height - 1) / 2 ? y : height - 1 - y;
      const half = dist * 2;
      this.set(cx - half, topY + y, color);
      this.set(cx + half, topY + y, color);
    }
  }

  isoBox(
    cx: number,
    groundY: number,
    width: number,
    height: number,
    top: string,
    left: string,
    right: string,
    line: string,
  ) {
    const d = Math.floor(width / 2);
    const topY = groundY - height - d;
    const hw = Math.floor(width / 2);
    this.fillDiamond(cx, topY, width, top);
    this.fillPoly(
      [
        { x: cx - hw, y: topY + d / 2 },
        { x: cx, y: topY + d },
        { x: cx, y: groundY },
        { x: cx - hw, y: groundY - d / 2 },
      ],
      left,
    );
    this.fillPoly(
      [
        { x: cx, y: topY + d },
        { x: cx + hw, y: topY + d / 2 },
        { x: cx + hw, y: groundY - d / 2 },
        { x: cx, y: groundY },
      ],
      right,
    );
    this.outlineDiamond(cx, topY, width, line);
    for (let y = 0; y <= height; y += 1) {
      this.set(cx - hw, topY + d / 2 + y, line);
      this.set(cx + hw, topY + d / 2 + y, line);
      this.set(cx, topY + d + y, line);
    }
  }

  circle(cx: number, cy: number, r: number, color: string) {
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        if (x * x + y * y <= r * r) this.set(cx + x, cy + y, color);
      }
    }
  }

  toSvg(): string {
    const rects: string[] = [];
    for (let y = 0; y < this.height; y += 1) {
      let x = 0;
      while (x < this.width) {
        const color = this.get(x, y);
        if (!color) {
          x += 1;
          continue;
        }
        let next = x + 1;
        while (next < this.width && this.get(next, y) === color) next += 1;
        rects.push(`<rect x="${x}" y="${y}" width="${next - x}" height="1" fill="${color}"/>`);
        x = next;
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" width="${this.width * 4}" height="${this.height * 4}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}

export function samplePattern(pattern: string[][], u: number, v: number): string {
  const h = pattern.length;
  const w = pattern[0]?.length ?? 1;
  const x = ((Math.floor(u) % w) + w) % w;
  const y = ((Math.floor(v) % h) + h) % h;
  return pattern[y][x];
}

export function makePattern(size: number, paint: (x: number, y: number) => string): string[][] {
  return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (__, x) => paint(x, y)));
}
