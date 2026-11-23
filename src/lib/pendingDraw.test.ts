import assert from "node:assert/strict";

import { parsePendingDraw, shouldResumeReveal } from "./pendingDraw.ts";

const confirmed = {
  drawId: "draw-1",
  cardId: "card-1",
  slot: "normal",
  rateUp: false,
  rarity: "b3",
  isNew: true,
  dupPaw: 0,
  frontUrl: "/front.webp",
  backUrl: "/back.webp",
  thumbUrl: "/thumb.webp",
  nameKo: "치즈",
  starsLabel: "★★★",
  remainingAfter: 4,
  createdAt: 1_700_000_000_000,
  confirmed: true,
  usedAd: true,
  adNyangCoin: 3,
};

assert.deepEqual(parsePendingDraw(confirmed), confirmed);
assert.equal(shouldResumeReveal(parsePendingDraw(confirmed)), true);

const unconfirmed = parsePendingDraw({ ...confirmed, confirmed: false, usedAd: undefined, adNyangCoin: undefined });
assert.ok(unconfirmed);
assert.equal(unconfirmed.confirmed, false);
assert.equal("usedAd" in unconfirmed, false);
assert.equal("adNyangCoin" in unconfirmed, false);
assert.equal(shouldResumeReveal(unconfirmed), false);

assert.equal(shouldResumeReveal(null), false);
assert.equal(shouldResumeReveal(undefined), false);

assert.equal(parsePendingDraw(null), null);
assert.equal(parsePendingDraw({ ...confirmed, drawId: "" }), null);
assert.equal(parsePendingDraw({ ...confirmed, cardId: "" }), null);
assert.equal(parsePendingDraw({ ...confirmed, slot: "bonus" }), null);
assert.equal(parsePendingDraw({ ...confirmed, rarity: "mythic" }), null);
assert.equal(parsePendingDraw({ ...confirmed, createdAt: Number.NaN }), null);
assert.equal(parsePendingDraw({ ...confirmed, remainingAfter: "4" }), null);

console.log("pendingDraw.test.ts ok");
