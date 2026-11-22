import assert from "node:assert/strict";

import { cozyClaimOwned, cozyGiftLevels, nextCozyGiftLevel } from "./cozyGiftMath.ts";
import { dealRemainLabel, roomDealRewardId } from "./roomDeals.ts";
import { parseCozyStatusBody, parseDealListBody } from "./walletBodies.ts";

const attend = { id: "moon_lamp", attendanceOnly: true };
const gift = { id: "heart_bed", affectionGift: true };
const shop = { id: "chair" };
const items = [attend, gift, shop];

assert.deepEqual(
  cozyClaimOwned({ chair: 2, moon_lamp: 1 }, ["heart_bed"], items, false),
  { chair: 2, moon_lamp: 1, heart_bed: 1 },
);
assert.deepEqual(
  cozyClaimOwned({ chair: 2, moon_lamp: 1 }, ["heart_bed", "chair"], items, true),
  { moon_lamp: 1, heart_bed: 1 },
);

assert.deepEqual(cozyGiftLevels(), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
assert.equal(nextCozyGiftLevel(0), 11);
assert.equal(nextCozyGiftLevel(14), 15);
assert.equal(nextCozyGiftLevel(25), 26);

const status = parseCozyStatusBody({
  level: 16,
  points: 80,
  claimedLevel: 14,
  fromLevel: 11,
  perLevel: 50,
  milestones: { "15": "cozy_aurora_globe", skip: 1 },
  retroCap: 1000,
  items: ["cozy_aurora_globe"],
  waitingItems: [],
});
assert.equal(status?.perLevel, 50);
assert.deepEqual(status?.milestones, { "15": "cozy_aurora_globe" });
assert.equal(parseCozyStatusBody({}), null);

const deals = parseDealListBody({
  date: "2026-11-22",
  refreshesLeft: 1,
  resetAt: "2026-11-22T15:00:00.000Z",
  items: [
    { itemId: "cup_tower", pct: 30, price: 650, salePrice: 450, bought: false },
    { itemId: "bad", pct: "30" },
  ],
});
assert.equal(deals?.items.length, 1);
assert.equal(deals?.items[0]?.salePrice, 450);
assert.equal(deals?.items[0]?.pct, 30);
assert.equal(parseDealListBody({ items: [] }), null);

assert.equal(roomDealRewardId("wall_rose", "2026-11-22", "deal-1"), "roomDeal:wall_rose:2026-11-22:deal-1");
assert.equal(dealRemainLabel("2026-11-22T15:00:00.000Z", Date.parse("2026-11-22T12:30:00.000Z")), "02:30");
assert.equal(dealRemainLabel("2026-11-22T12:00:00.000Z", Date.parse("2026-11-22T13:00:00.000Z")), "00:00");
