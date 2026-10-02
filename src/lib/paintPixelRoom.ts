import {
  ISO_ORIGIN_X,
  ISO_ORIGIN_Y,
  PIXEL,
  ROOM_SIZE,
  TILE_H,
  WALL_H,
  floorLeftCorner,
  floorRightCorner,
  isoProject,
  tileDiamond,
} from "./iso";
import {
  FLOOR_LINE,
  FLOOR_PATTERNS,
  WALL_LINE,
  WALL_PATTERNS,
  WINDOW_FRAME,
  WINDOW_GLASS,
  WINDOW_SHINE,
} from "./pixelPatterns";
import { samplePattern } from "./pixelMap";

export type GhostCell = { col: number; row: number };

function plot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  const px = Math.floor(x / PIXEL) * PIXEL;
  const py = Math.floor(y / PIXEL) * PIXEL;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, PIXEL, PIXEL);
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  colorAt: (x: number, y: number) => string,
) {
  const ys = points.map((point) => point.y);
  const minY = Math.floor(Math.min(...ys) / PIXEL) * PIXEL;
  const maxY = Math.ceil(Math.max(...ys) / PIXEL) * PIXEL;
  for (let y = minY; y <= maxY; y += PIXEL) {
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
      const x0 = Math.floor(hits[i] / PIXEL) * PIXEL;
      const x1 = Math.floor(hits[i + 1] / PIXEL) * PIXEL;
      for (let x = x0; x <= x1; x += PIXEL) {
        plot(ctx, x, y, colorAt(x, y));
      }
    }
  }
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function drawIsoWindow(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  side: "left" | "right",
) {
  const base = side === "left" ? isoProject(0, 1) : isoProject(1, 0);
  const topX = base.x + (side === "left" ? -8 : 8);
  const topY = base.y - 52;
  const dir = side === "left" ? -1 : 1;
  for (let v = 0; v <= 24; v += PIXEL) {
    for (let u = 0; u <= 18; u += PIXEL) {
      const x = originX + topX + dir * u;
      const y = originY + topY + v + u / 2;
      const frame = u <= PIXEL || u >= 16 || v <= PIXEL || v >= 22;
      const pane = !frame && v < 12 ? WINDOW_SHINE : WINDOW_GLASS;
      plot(ctx, x, y, frame ? WINDOW_FRAME : pane);
    }
  }
}

export function paintPixelRoom(
  ctx: CanvasRenderingContext2D,
  wallpaperId: string,
  floorId: string,
  ghostCells: GhostCell[],
  ghostValid: boolean,
) {
  const originX = ISO_ORIGIN_X;
  const originY = ISO_ORIGIN_Y;
  const wall = WALL_PATTERNS[wallpaperId] ?? WALL_PATTERNS.wall_mint;
  const floor = FLOOR_PATTERNS[floorId] ?? FLOOR_PATTERNS.floor_wood;
  const wallLine = WALL_LINE[wallpaperId] ?? WALL_LINE.wall_mint;
  const floorLine = FLOOR_LINE[floorId] ?? FLOOR_LINE.floor_wood;
  const back = { x: 0, y: 0 };
  const leftFront = floorLeftCorner();
  const rightFront = floorRightCorner();
  const ox = originX;
  const oy = originY;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < ctx.canvas.height; y += PIXEL) {
    for (let x = 0; x < ctx.canvas.width; x += PIXEL * 2) {
      const sky = (x + y) % 8 === 0 ? "#c9ebf6" : "#e7f6fc";
      ctx.fillStyle = sky;
      ctx.fillRect(x, y, PIXEL, PIXEL);
    }
  }

  const leftWallIso = [
    { x: back.x, y: back.y - WALL_H },
    { x: leftFront.x, y: leftFront.y - WALL_H },
    { x: leftFront.x, y: leftFront.y },
    { x: back.x, y: back.y },
  ];
  const rightWallIso = [
    { x: back.x, y: back.y - WALL_H },
    { x: rightFront.x, y: rightFront.y - WALL_H },
    { x: rightFront.x, y: rightFront.y },
    { x: back.x, y: back.y },
  ];
  const toCanvas = (points: Array<{ x: number; y: number }>) =>
    points.map((point) => ({ x: ox + point.x, y: oy + point.y }));

  fillQuad(ctx, toCanvas(leftWallIso), (x, y) => {
    const lx = x - ox;
    const ly = y - oy;
    const t = leftFront.x === 0 ? 0 : lx / leftFront.x;
    const floorY = t * leftFront.y;
    const u = (-lx) / PIXEL;
    const v = (floorY - ly) / PIXEL;
    return samplePattern(wall, u, v);
  });
  fillQuad(ctx, toCanvas(rightWallIso), (x, y) => {
    const lx = x - ox;
    const ly = y - oy;
    const t = rightFront.x === 0 ? 0 : lx / rightFront.x;
    const floorY = t * rightFront.y;
    const u = lx / PIXEL;
    const v = (floorY - ly) / PIXEL;
    return shade(samplePattern(wall, u, v), -18);
  });

  drawIsoWindow(ctx, ox, oy, "left");
  drawIsoWindow(ctx, ox, oy, "right");

  for (const edge of [
    [back, leftFront],
    [back, rightFront],
    [
      { x: back.x, y: back.y - WALL_H },
      { x: leftFront.x, y: leftFront.y - WALL_H },
    ],
    [
      { x: back.x, y: back.y - WALL_H },
      { x: rightFront.x, y: rightFront.y - WALL_H },
    ],
  ] as const) {
    const [a, b] = edge;
    const steps = Math.max(
      Math.abs(b.x - a.x) / PIXEL,
      Math.abs(b.y - a.y) / PIXEL,
    );
    for (let i = 0; i <= steps; i += 1) {
      const x = a.x + ((b.x - a.x) * i) / steps;
      const y = a.y + ((b.y - a.y) * i) / steps;
      plot(ctx, ox + x, oy + y, wallLine);
    }
  }

  for (let col = 0; col < ROOM_SIZE; col += 1) {
    for (let row = 0; row < ROOM_SIZE; row += 1) {
      const { x, y } = isoProject(col, row);
      const height = TILE_H;
      for (let dy = 0; dy < height; dy += PIXEL) {
        const dist = dy <= (height - PIXEL) / 2 ? dy : height - PIXEL - dy;
        const half = dist * 2;
        for (let dx = -half; dx <= half; dx += PIXEL) {
          const u = (col * 8 + dx / PIXEL + row * 3) / 1;
          const v = (row * 8 + dy / PIXEL) / 1;
          plot(ctx, ox + x + dx, oy + y + dy, samplePattern(floor, u, v));
        }
        plot(ctx, ox + x - half, oy + y + dy, floorLine);
        plot(ctx, ox + x + half, oy + y + dy, floorLine);
      }
    }
  }

  for (const cell of ghostCells) {
    const points = tileDiamond(cell.col, cell.row).split(" ").map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    });
    const color = ghostValid ? "rgba(58, 168, 138, 0.45)" : "rgba(214, 92, 92, 0.45)";
    fillQuad(
      ctx,
      points.map((point) => ({ x: ox + point.x, y: oy + point.y })),
      () => color,
    );
  }
}
