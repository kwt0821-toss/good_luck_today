import assert from "node:assert/strict";

import { roomRenderFlags, roomRenderLabel } from "./renderer.ts";

const canvas = { renderer: "canvas", tiles: true, backdrop: false, depth: false, fx: false };

assert.deepEqual(roomRenderFlags({ config: canvas, canvasSupported: true }), {
  canvas: true,
  tiles: true,
  backdrop: false,
  depth: false,
  fx: false,
  lite: false,
  depthCats: false,
});

assert.deepEqual(roomRenderFlags({ config: { renderer: "dom", tiles: true }, canvasSupported: true }), {
  canvas: false,
  tiles: false,
  backdrop: false,
  depth: false,
  fx: false,
  lite: false,
  depthCats: false,
});

assert.equal(roomRenderFlags({ config: canvas, search: "?roomDom=1", canvasSupported: true }).canvas, false);
assert.equal(
  roomRenderFlags({
    config: canvas,
    schemeUrl: "intoss://lucky-cat?roomDom=1",
    canvasSupported: true,
  }).tiles,
  false,
);
assert.equal(roomRenderFlags({ config: canvas, failed: true, canvasSupported: true }).canvas, false);
assert.equal(roomRenderFlags({ config: canvas, canvasSupported: false }).tiles, false);
assert.equal(roomRenderFlags({ config: { renderer: "canvas", tiles: false }, canvasSupported: true }).tiles, false);

assert.equal(roomRenderLabel(roomRenderFlags({ config: canvas, canvasSupported: true })), "canvas tiles");
assert.equal(roomRenderLabel(roomRenderFlags({ config: { renderer: "dom" } })), "dom");

const lite = { ...canvas, lite: true };
assert.equal(roomRenderFlags({ config: lite, canvasSupported: true }).lite, true);
assert.equal(roomRenderFlags({ config: lite, search: "?roomDom=1", canvasSupported: true }).lite, false);
assert.equal(roomRenderFlags({ config: lite, failed: true, canvasSupported: true }).lite, false);

const depth = { ...canvas, depth: true, depthCats: false };
assert.equal(roomRenderFlags({ config: depth, canvasSupported: true }).depth, true);
assert.equal(roomRenderFlags({ config: depth, canvasSupported: true }).depthCats, false);
assert.equal(roomRenderFlags({ config: { ...depth, depthCats: true }, canvasSupported: true }).depthCats, true);
assert.equal(roomRenderFlags({ config: canvas, search: "?depthCats=1", canvasSupported: true }).depth, true);
assert.equal(roomRenderFlags({ config: canvas, search: "?depthCats=1", canvasSupported: true }).depthCats, true);
assert.equal(roomRenderFlags({ config: { ...depth, depthCats: true }, search: "?depthCats=0", canvasSupported: true }).depth, true);
assert.equal(roomRenderFlags({ config: { ...depth, depthCats: true }, search: "?depthCats=0", canvasSupported: true }).depthCats, false);
assert.equal(roomRenderFlags({ config: { ...depth, depthCats: true }, search: "?roomDom=1&depthCats=1", canvasSupported: true }).depth, false);
assert.equal(roomRenderFlags({ config: { ...depth, depthCats: true }, search: "?roomDom=1&depthCats=1", canvasSupported: true }).depthCats, false);
assert.equal(
  roomRenderLabel(roomRenderFlags({ config: { ...depth, depthCats: true }, canvasSupported: true })),
  "canvas tiles depth depthCats",
);
