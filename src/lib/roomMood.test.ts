import assert from "node:assert/strict";

import { moodWash, parseRoomMoods } from "./roomMood.ts";

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

assert.equal(moodWash("normal", "day"), null);
assert.equal(moodWash("bright", "day")?.background, "rgba(255,255,250,.62)");
assert.equal(moodWash("bright", "night")?.background, "rgba(255,250,244,.34)");
assert.equal(moodWash("bright", "sunset")?.blend, "soft-light");
assert.equal(
  moodWash("cozy", "morning")?.background,
  "linear-gradient(180deg, rgba(255,196,140,.85), rgba(255,170,120,.5))",
);
assert.equal(
  moodWash("cozy", "day")?.background,
  "linear-gradient(180deg, rgba(255,206,150,.75), rgba(255,180,120,.5))",
);
assert.equal(
  moodWash("cozy", "sunset")?.background,
  "linear-gradient(180deg, rgba(255,176,104,.78), rgba(255,140,110,.45))",
);
assert.equal(
  moodWash("cozy", "night")?.background,
  "linear-gradient(180deg, rgba(255,184,118,.46), rgba(255,150,100,.3))",
);
