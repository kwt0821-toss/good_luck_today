import assert from "node:assert/strict";

import {
  acceptMailboxIdentity,
  countGiftableLetters,
  letterHasGift,
  mailboxLetterId,
} from "./mailboxParse.ts";

assert.equal(mailboxLetterId(123), "123");
assert.equal(mailboxLetterId("123"), "123");
assert.equal(mailboxLetterId("cozy-letter"), "cozy-letter");
assert.equal(mailboxLetterId(0), null);
assert.equal(mailboxLetterId(1.5), null);
assert.equal(mailboxLetterId(-3), null);
assert.equal(mailboxLetterId(""), null);
assert.equal(mailboxLetterId(null), null);

assert.equal(acceptMailboxIdentity(123, "cozy"), "123");
assert.equal(acceptMailboxIdentity("weekly-1", "weekly"), "weekly-1");
assert.equal(acceptMailboxIdentity(8, "mystery"), null);
assert.equal(acceptMailboxIdentity("ok", "operator"), "ok");
assert.equal(acceptMailboxIdentity(4, ""), null);

const letters = [
  { status: "pending", jelly: 10, nyang: 0, tickets: 0 },
  { status: "pending", jelly: 0, nyang: 0, tickets: 0 },
  { status: "claimed", jelly: 10, nyang: 0, tickets: 0 },
  { status: "pending", jelly: 0, nyang: 2, tickets: 0 },
  { status: "pending", jelly: 0, nyang: 0, tickets: 1 },
  { status: "expired", jelly: 0, nyang: 0, tickets: 3 },
];

assert.equal(letterHasGift(letters[0]), true);
assert.equal(letterHasGift(letters[1]), false);
assert.equal(letterHasGift(letters[2]), false);
assert.equal(countGiftableLetters(letters), 3);
