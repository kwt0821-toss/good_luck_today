import assert from "node:assert/strict";

import {
  floorCanvasBounds,
  floorTileClip,
  floorTilePolygon,
  floorTileRect,
  wallStripClip,
  wallStripPolygon,
  wallStripRect,
} from "./roomTiles.ts";

function clipPercents(clip: string) {
  return [...clip.matchAll(/(-?\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1]));
}

function near(points: { x: number; y: number }[], rect: { x: number; y: number; w: number; h: number }, clip: string) {
  const percents = clipPercents(clip);
  assert.equal(percents.length, points.length * 2);
  points.forEach((point, index) => {
    const px = ((point.x - rect.x) / rect.w) * 100;
    const py = ((point.y - rect.y) / rect.h) * 100;
    assert.ok(Math.abs(px - percents[index * 2]) < 0.02, `x ${px} vs ${percents[index * 2]}`);
    assert.ok(Math.abs(py - percents[index * 2 + 1]) < 0.02, `y ${py} vs ${percents[index * 2 + 1]}`);
  });
}

const floor = floorTilePolygon(3, 2);
assert.equal(floor.length, 4);
near(floor, floorTileRect(3, 2), floorTileClip());
near(floorTilePolygon(0, 7), floorTileRect(0, 7), floorTileClip());

const wall = wallStripPolygon("L", 4);
assert.equal(wall.length, 4);
near(wall, wallStripRect("L", 4), wallStripClip("L"));
near(wallStripPolygon("R", 1), wallStripRect("R", 1), wallStripClip("R"));

const box = floorCanvasBounds();
assert.ok(box.w > 0 && box.h > 0);
assert.ok(box.w * box.h <= 4_000_000, `${box.w}x${box.h}`);
assert.ok(box.w < 2000 && box.h < 1200, `${box.w}x${box.h}`);
