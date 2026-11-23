import assert from "node:assert/strict";

import {
  backingScale,
  boxesTouch,
  breatheScaleY,
  catBreathes,
  catNeedsDom,
  containBox,
  coverSource,
  depthOrder,
  frameArtBox,
  padBox,
  rememberCatBreeds,
  unionBox,
  visibleWorldBox,
} from "./depthPaint.ts";

const fitted = containBox(100, 50, { x: 0, y: 0, w: 100, h: 100 });
assert.equal(fitted.w, 100);
assert.equal(fitted.h, 50);
assert.equal(fitted.y, 25);

assert.equal(boxesTouch({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 2, h: 2 }), true);
assert.equal(boxesTouch({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 2, h: 2 }), false);

assert.deepEqual(unionBox([{ x: 0, y: 2, w: 4, h: 2 }, { x: 3, y: 0, w: 2, h: 2 }]), { x: 0, y: 0, w: 5, h: 4 });
assert.deepEqual(padBox({ x: 5, y: 5, w: 2, h: 2 }, 1), { x: 4, y: 4, w: 4, h: 4 });

const ordered = depthOrder([
  { id: "b", z: 2, order: 0 },
  { id: "a", z: 1, order: 1 },
  { id: "c", z: 2, order: 1 },
]);
assert.deepEqual(ordered.map((item) => item.id), ["a", "b", "c"]);

assert.equal(breatheScaleY(0), 1);
assert.equal(breatheScaleY(3600), 1);
assert.equal(breatheScaleY(1800), 1.025);
assert.ok(Math.abs(breatheScaleY(900) - breatheScaleY(2700)) < 1e-9);
assert.ok(breatheScaleY(900) > 1 && breatheScaleY(900) < 1.025);
assert.equal(breatheScaleY(1000, 2000, 0.03), 1.03);

assert.equal(backingScale(100, 100, 2), 2);
const fittedScale = backingScale(4000, 2000, 2);
const fittedW = Math.round(4000 * fittedScale);
const fittedH = Math.round(2000 * fittedScale);
assert.ok(fittedW * fittedH <= 4_000_000);

const cover = coverSource(100, 50, 20, 20);
assert.equal(cover.sh, 50);
assert.ok(cover.sw < 100);

const view = visibleWorldBox(
  { left: 0, top: 0, width: 200, height: 100 },
  { left: 50, top: 25, width: 100, height: 50 },
  3840,
  2160,
);
assert.ok(view);
assert.equal(view?.x, 3840 * 0.25);
assert.equal(view?.w, 3840 * 0.5);

assert.equal(catNeedsDom({ fx: "aura", anim: "idle_sit", pose: "" }, "bengal"), true);
assert.equal(catNeedsDom({ fx: "", anim: "scratch", pose: "" }, "bengal"), true);
assert.equal(catNeedsDom({ fx: "", anim: "idle_sit", pose: "sit_look" }, "cheese"), true);
assert.equal(catNeedsDom({ fx: "", anim: "idle_sit", pose: "sit_look" }, "bengal"), false);
assert.equal(catNeedsDom({ fx: "", anim: "walk_dl", pose: "" }, "cheese"), false);

assert.equal(catBreathes("loaf_r", false), true);
assert.equal(catBreathes("happy", true), true);
assert.equal(catBreathes("happy", false), false);
assert.equal(catBreathes("walk_dl", true), false);

const art = frameArtBox("cardframe", { x: 0, y: 0, w: 100, h: 100 });
assert.ok(Math.abs(art.x - 24) < 1e-9);
assert.ok(Math.abs(art.y - 22) < 1e-9);
assert.ok(Math.abs(art.w - 52) < 1e-9);
assert.ok(Math.abs(art.h - 60) < 1e-9);

let history: string[] = [];
for (const id of ["a", "b", "c", "d", "e"]) {
  const step = rememberCatBreeds(history, [id]);
  history = step.history;
}
const last = rememberCatBreeds(history, ["e"]);
assert.deepEqual(last.drop, []);
assert.ok(!last.history.includes("a"));
assert.ok(last.history.includes("e"));
assert.equal(last.history.filter((id) => id !== "e").length, 3);
