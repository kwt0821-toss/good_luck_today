import assert from "node:assert/strict";

import { LAMP_CURVES, lampCurve, lampOpacity, skyPaint, washPaint, windowPaint } from "./lightTable.ts";

assert.equal(lampOpacity(LAMP_CURVES.lamp, 0), 0.85);
assert.equal(lampOpacity(LAMP_CURVES.lamp, 0.4), 1);
assert.equal(lampOpacity(LAMP_CURVES.lamp, 0.7), 0.9);
assert.equal(lampOpacity(LAMP_CURVES.lamp, 1), 0.85);
assert.ok(lampOpacity(LAMP_CURVES.lamp, 0.2) > 0.85 && lampOpacity(LAMP_CURVES.lamp, 0.2) < 1);

assert.equal(lampOpacity(LAMP_CURVES.dusk, 0), 0.55);
assert.equal(lampOpacity(LAMP_CURVES.dusk, 0.4), 0.78);
assert.equal(lampOpacity(LAMP_CURVES.cozy, 0.7), 1);
assert.equal(lampOpacity(LAMP_CURVES.duskCozy, 0), 0.825);
assert.equal(lampOpacity(LAMP_CURVES.duskCozy, 0.7), 0.96);

assert.equal(lampCurve("morning", "normal").staticOpacity, 0.18);
assert.equal(lampCurve("day", "normal").staticOpacity, 0.18);
assert.equal(lampCurve("sunset", "normal").stops, LAMP_CURVES.dusk);
assert.equal(lampCurve("sunset", "cozy").stops, LAMP_CURVES.duskCozy);
assert.equal(lampCurve("night", "cozy").stops, LAMP_CURVES.cozy);
assert.equal(lampCurve("night", "cozy").staticOpacity, 1);
assert.equal(lampCurve("morning", "cozy").staticOpacity, 0.27);
assert.equal(lampCurve("day", "cozy").staticOpacity, 0.27);
assert.equal(lampCurve("night", "normal").stops, LAMP_CURVES.lamp);

assert.equal(washPaint("morning", "normal").blend, "soft-light");
assert.equal(washPaint("morning", "normal").background, "linear-gradient(180deg, rgba(255, 214, 186, 0.72), rgba(244, 186, 214, 0.4))");
assert.equal(washPaint("day", "normal").background, "rgba(255, 252, 246, 0.5)");
assert.equal(washPaint("night", "normal").blend, "multiply");
assert.equal(washPaint("night", "normal").background, "rgba(16, 8, 28, 0.32)");
assert.equal(washPaint("day", "cozy").background, "linear-gradient(180deg, rgba(255,206,150,.75), rgba(255,180,120,.5))");
assert.equal(washPaint("night", "bright").background, "rgba(255,250,244,.34)");
assert.equal(washPaint("day", "bright").background, "rgba(255,255,250,.62)");

assert.equal(skyPaint("day")?.blend, "screen");
assert.equal(skyPaint("day")?.opacity, 0.94);
assert.equal(skyPaint("night"), null);
assert.equal(windowPaint("morning")?.background, "linear-gradient(165deg, #ffd0c0, #efc6f4)");
assert.equal(windowPaint("night"), null);

console.log("lightTable.test.ts ok");
