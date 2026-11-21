import assert from "node:assert/strict";

import { toKstMondayWeekKey } from "./date.ts";
import {
  absorbWeeklySources,
  applyChestGrant,
  applyChestTicketKeys,
  emptyWeeklyLog,
  mergeWeeklyLogs,
  recountWeekly,
  chestMailboxLabel,
  ticketFractionLabel,
} from "./weeklyMissions.ts";

const sundayNight = new Date("2026-11-22T14:59:59Z");
const mondayMidnight = new Date("2026-11-22T15:00:00Z");

assert.equal(toKstMondayWeekKey(sundayNight), "2026-11-16");
assert.equal(toKstMondayWeekKey(mondayMidnight), "2026-11-23");
assert.notEqual(toKstMondayWeekKey(sundayNight), toKstMondayWeekKey(mondayMidnight));

const deviceA = {
  ...emptyWeeklyLog("2026-11-16"),
  draws: 10,
  attendDates: ["2026-11-16", "2026-11-17"],
  petsByDate: { "2026-11-16": 3 },
};
const deviceB = {
  ...emptyWeeklyLog("2026-11-16"),
  draws: 5,
  attendDates: ["2026-11-18"],
  petsByDate: { "2026-11-16": 1 },
  roomSaved: true,
};
const merged = mergeWeeklyLogs(deviceA, deviceB);
assert.equal(merged.draws, 10);
assert.deepEqual(merged.attendDates, ["2026-11-16", "2026-11-17", "2026-11-18"]);
assert.equal(merged.roomSaved, true);
assert.equal(merged.petsByDate["2026-11-16"], 3);

const known = applyChestTicketKeys(3, ["weeklyChest:2026-11-16:6"], ["weeklyChest:2026-11-16:6"], 3, 4);
assert.equal(known.held, 3);
assert.deepEqual(known.keys, ["weeklyChest:2026-11-16:6"]);

const logged = absorbWeeklySources(null, {
  weekKey: "2026-11-16",
  today: "2026-11-18",
  drawsByDate: { "2026-11-16": 20 },
});
const firstRecount = recountWeekly(logged);
const secondRecount = recountWeekly(logged);
assert.equal(firstRecount.stamps, 2);
assert.deepEqual(secondRecount, firstRecount);

const fresh = { held: 3, keys: [] as string[] };
const once = applyChestGrant(
  [],
  {
    weekKey: "2026-11-16",
    kind: "6",
    jelly: 50,
    nyang: 0,
    ticketKeys: ["weeklyChest:2026-11-16:6"],
  },
  fresh,
);
const twice = applyChestGrant(
  once.applied,
  {
    weekKey: "2026-11-16",
    kind: "6",
    jelly: 50,
    nyang: 0,
    ticketKeys: ["weeklyChest:2026-11-16:6"],
  },
  once.tickets,
);
assert.equal(once.jelly, 50);
assert.equal(once.nyang, 0);
assert.equal(once.tickets.held, 4);
assert.equal(twice.jelly, 0);
assert.equal(twice.nyang, 0);
assert.equal(twice.tickets.held, 4);

const nyang = applyChestGrant(
  [],
  { weekKey: "2026-11-16", kind: "9", jelly: 100, nyang: 20, ticketKeys: [] },
  { held: 0, keys: [] },
);
const nyangAgain = applyChestGrant(
  nyang.applied,
  { weekKey: "2026-11-16", kind: "9", jelly: 100, nyang: 20, ticketKeys: [] },
  nyang.tickets,
);
assert.equal(nyang.jelly, 100);
assert.equal(nyang.nyang, 20);
assert.equal(nyangAgain.jelly, 0);
assert.equal(nyangAgain.nyang, 0);

const four = ticketFractionLabel(4, 3);
const three = ticketFractionLabel(3, 3);
assert.equal(four, "4장 (보너스 1장 포함)");
assert.equal(three, "3/3");
assert.equal(four.includes("4/3"), false);
assert.equal(ticketFractionLabel(2, 3).includes("4/3"), false);

assert.deepEqual(chestMailboxLabel(false, false, "none"), { state: "locked", label: "잠김" });
assert.deepEqual(chestMailboxLabel(true, false, "none"), { state: "sent", label: "편지함으로 보냈어요" });
assert.deepEqual(chestMailboxLabel(true, false, "pending"), { state: "sent", label: "편지함으로 보냈어요" });
assert.deepEqual(chestMailboxLabel(true, true, "claimed"), { state: "claimed", label: "받음" });
assert.equal(chestMailboxLabel(true, false, "pending").label.includes("받기"), false);

console.log("weeklyMissions.test.ts ok");
