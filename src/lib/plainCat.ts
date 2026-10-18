/**
 * The dex fronts bake an English name, stars, and the fortune into the art.
 * Those pixels are cleared so the frame plate, ribbon, and CardViewer own the text.
 * The illustration itself is left in place.
 */

type RGB = { r: number; g: number; b: number };

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function lum(r: number, g: number, b: number): number {
  return (r + g + b) / 3;
}

function sampleBg(data: Uint8ClampedArray, w: number, h: number): RGB {
  const pts: RGB[] = [];
  for (const yf of [0.13, 0.16, 0.2]) {
    for (const xf of [0.16, 0.84]) {
      const x = Math.min(w - 1, Math.max(0, Math.round(w * xf)));
      const y = Math.min(h - 1, Math.max(0, Math.round(h * yf)));
      const i = (y * w + x) * 4;
      pts.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  }
  pts.sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));
  return pts[Math.floor(pts.length / 2)] ?? { r: 235, g: 244, b: 232 };
}

function paint(data: Uint8ClampedArray, w: number, x: number, y: number, bg: RGB) {
  const i = (y * w + x) * 4;
  data[i] = bg.r;
  data[i + 1] = bg.g;
  data[i + 2] = bg.b;
  data[i + 3] = 255;
}

function read(data: Uint8ClampedArray, w: number, x: number, y: number): RGB {
  const i = (y * w + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

function clearBakedText(data: Uint8ClampedArray, w: number, h: number) {
  const bg = sampleBg(data, w, h);
  const bgL = lum(bg.r, bg.g, bg.b);
  const darkBg = bgL < 110;

  const topY0 = Math.round(h * 0.03);
  const topY1 = Math.round(h * 0.095);
  const topX0 = Math.round(w * 0.06);
  const topX1 = Math.round(w * 0.94);
  for (let y = topY0; y < topY1; y += 1) {
    for (let x = topX0; x < topX1; x += 1) paint(data, w, x, y, bg);
  }

  const y0 = Math.round(h * 0.58);
  const y1 = Math.round(h * 0.96);
  const x0 = Math.round(w * 0.04);
  const x1 = Math.round(w * 0.96);
  const ink = new Uint8Array(w * h);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = read(data, w, x, y);
      const L = lum(p.r, p.g, p.b);
      const chroma = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
      const hit = darkBg ? L > bgL + 55 : chroma < 48 && L < bgL - 28;
      if (hit) ink[y * w + x] = 1;
    }
  }

  const seen = new Uint8Array(w * h);
  const erase: number[] = [];
  const stack: number[] = [];
  for (let y = y0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x;
      if (!ink[start] || seen[start]) continue;
      stack.push(start);
      seen[start] = 1;
      const comp: number[] = [];
      let touches = false;
      while (stack.length) {
        const cur = stack.pop() as number;
        comp.push(cur);
        const cy = Math.floor(cur / w);
        const cx = cur - cy * w;
        if (cy <= y0 + 1) touches = true;
        const neighbors = [cur - 1, cur + 1, cur - w, cur + w];
        for (const n of neighbors) {
          if (n < 0 || n >= ink.length || seen[n] || !ink[n]) continue;
          const ny = Math.floor(n / w);
          const nx = n - ny * w;
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      if (touches || comp.length > 9000) continue;
      erase.push(...comp);
    }
  }

  for (const i of erase) {
    const y = Math.floor(i / w);
    const x = i - y * w;
    paint(data, w, x, y, bg);
  }
  for (const i of erase) {
    const y = Math.floor(i / w);
    const x = i - y * w;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny < y0 || ny >= h || nx < 0 || nx >= w) continue;
        const p = read(data, w, nx, ny);
        const L = lum(p.r, p.g, p.b);
        const chroma = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
        if (darkBg ? L > bgL + 30 : chroma < 40 && Math.abs(L - bgL) > 12) {
          paint(data, w, nx, ny, bg);
        }
      }
    }
  }

  if (darkBg) {
    const band0 = Math.round(h * 0.64);
    const band1 = Math.round(h * 0.94);
    const bx0 = Math.round(w * 0.08);
    const bx1 = Math.round(w * 0.92);
    for (let y = band0; y < band1; y += 1) {
      for (let x = bx0; x < bx1; x += 1) {
        const p = read(data, w, x, y);
        if (lum(p.r, p.g, p.b) > bgL + 25) paint(data, w, x, y, bg);
      }
    }
  }
}

function renderPlain(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || !canvas.width || !canvas.height) {
        resolve(src);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      clearBakedText(frame.data, canvas.width, canvas.height);
      ctx.putImageData(frame, 0, 0);
      resolve(canvas.toDataURL("image/webp", 0.92));
    };
    img.onerror = () => reject(new Error("cat art"));
    img.src = src;
  });
}

export function peekPlainCat(src: string): string | null {
  return cache.get(src) ?? null;
}

export function loadPlainCat(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(src);
  if (inflight) return inflight;
  const task = renderPlain(src)
    .then((url) => {
      cache.set(src, url);
      pending.delete(src);
      return url;
    })
    .catch(() => {
      pending.delete(src);
      return src;
    });
  pending.set(src, task);
  return task;
}
