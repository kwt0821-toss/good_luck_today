import assert from "node:assert/strict";

import { cappedBitmapSize } from "./bitmapSize.ts";
import { LAYER_CROPS, layerBoxStyle } from "./layerCrops.ts";
import { floorCanvasKey } from "./paintFloor.ts";
import { warmRelatives } from "./warmList.ts";

const expected = {
  "room-frame-view.webp": { x: 631, y: 208, w: 658, h: 578 },
  "string-lights.webp": { x: 652, y: 237, w: 616, h: 174 },
  "lamp-glow-additive.webp": { x: 888, y: 346, w: 144, h: 130 },
  "front-puffs-view.webp": { x: 587, y: 589, w: 746, h: 255 },
};

for (const [name, box] of Object.entries(expected)) {
  const crop = LAYER_CROPS[name];
  assert.ok(crop, name);
  assert.equal(crop.x, box.x);
  assert.equal(crop.y, box.y);
  assert.equal(crop.w, box.w);
  assert.equal(crop.h, box.h);
  assert.equal(crop.sw, 1920);
  assert.equal(crop.sh, 1080);
  assert.equal(crop.file, name.replace(/\.webp$/, "-crop.webp"));
}

const frame = LAYER_CROPS["room-frame-view.webp"];
assert.equal(layerBoxStyle(frame).left, `${(631 / 1920) * 100}%`);
assert.equal(layerBoxStyle(frame).top, `${(208 / 1080) * 100}%`);
assert.equal(layerBoxStyle(frame).width, `${(658 / 1920) * 100}%`);
assert.equal(layerBoxStyle(frame).height, `${(578 / 1080) * 100}%`);

const glow = LAYER_CROPS["lamp-glow-additive.webp"];
const shifted = layerBoxStyle(glow, { x: 384, y: 216, worldW: 3840, worldH: 2160 });
assert.equal(shifted.left, `${(888 / 1920) * 100 + 10}%`);
assert.equal(shifted.top, `${(346 / 1080) * 100 + 10}%`);

const files = warmRelatives([["wood_honey"]], ["cheese"], ["world/room-frame-view-crop.webp"]);
assert.ok(files.includes("world/base-bg.webp"));
assert.ok(files.includes("world/room-frame-view-crop.webp"));
assert.ok(files.includes("cat/cat-sprite-half.webp"));
assert.ok(files.includes("floor/iso/wood_honey_00.png"));
assert.deepEqual(
  warmRelatives([], ["bengal"], []).filter((file) => file.startsWith("cat/")),
  ["cat/cat-sprite-bengal-half.webp"],
);
assert.deepEqual(
  warmRelatives([], [], []).filter((file) => file.startsWith("cat/")),
  ["cat/cat-sprite-half.webp"],
);

assert.deepEqual(cappedBitmapSize(100, 80), { width: 100, height: 80 });
assert.deepEqual(cappedBitmapSize(0, 10), { width: 0, height: 0 });
const big = cappedBitmapSize(4000, 2000);
assert.ok(big.width * big.height <= 4_000_000);
assert.ok(big.width * big.height > 3_900_000);

const tiles = [{ col: 1, row: 2, src: "/assets/room/floor/iso/wood_honey_00.png" }];
assert.equal(floorCanvasKey(tiles), floorCanvasKey([{ ...tiles[0] }]));
assert.notEqual(floorCanvasKey(tiles), floorCanvasKey([{ ...tiles[0], src: "other" }]));
