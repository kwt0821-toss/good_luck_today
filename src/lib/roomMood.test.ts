import assert from "node:assert/strict";

import { moodFilter, parseRoomMoods } from "./roomMood.ts";

const parsed = parseRoomMoods(
  JSON.stringify({
    winter_cabin: { bright: "cozy", sound: true },
    cat_cafe: { bright: "bright", sound: false },
    bad: { bright: "nope", sound: "yes" },
  }),
);

assert.deepEqual(parsed.winter_cabin, { bright: "cozy", sound: true });
assert.deepEqual(parsed.cat_cafe, { bright: "bright", sound: false });
assert.deepEqual(parsed.bad, { bright: "normal", sound: false });
assert.deepEqual(parseRoomMoods("not-json"), {});
assert.equal(moodFilter("bright"), "brightness(1.1)");
assert.equal(moodFilter("normal"), "none");
assert.equal(moodFilter("cozy"), "brightness(0.8) saturate(1.05)");
