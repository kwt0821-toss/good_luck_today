import assert from "node:assert/strict";

import { chunkDexCards, dexBannerAfter, dexBannerStride } from "./dexBanners.ts";

const breedHits = Array.from({ length: 18 }, (_, index) => index).filter((index) =>
  dexBannerAfter(index, dexBannerStride("breed")),
);
assert.deepEqual(breedHits, [3, 7, 11, 15]);
assert.equal(
  [0, 1, 2].some((index) => dexBannerAfter(index, 4)),
  false,
);
assert.equal(dexBannerAfter(11, dexBannerStride("special")), true);
assert.equal(dexBannerAfter(10, dexBannerStride("season")), false);
assert.equal(dexBannerAfter(7, dexBannerStride("legend")), true);
assert.equal(dexBannerAfter(6, dexBannerStride("legend")), false);

const special = chunkDexCards(Array.from({ length: 18 }, (_, index) => index), 12);
assert.deepEqual(special.map((chunk) => chunk.length), [12, 6]);
const legend = chunkDexCards(Array.from({ length: 8 }, (_, index) => index), 8);
assert.deepEqual(legend.map((chunk) => chunk.length), [8]);
const short = chunkDexCards(Array.from({ length: 5 }, (_, index) => index), 12);
assert.deepEqual(short.map((chunk) => chunk.length), [5]);
console.log("dex banners ok");
